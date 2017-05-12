/**
 * actions/makeshot
 */

const path = require('path');
const sharp = require('sharp');
const lodash = require('lodash');
const fsp = require('fs-promise');
const Promise = require('bluebird');

const cpuCount = require('os').cpus().length;
const pathToUrl = require('../services/path-to-url');
const bridge = require('../services/bridge');
const logger = require('../services/logger');
const wait = require('../lib/wait-promise');

const env = process.env;
const MAX_IMAGE_WIDTH = +env.MAX_IMAGE_HEIGHT || 5000;
const MAX_IMAGE_HEIGHT = +env.MAX_IMAGE_HEIGHT || 5000;
const CDP_CLIENT_MAX_COUNT = +env.CDP_CLIENT_MAX_COUNT || 10;
const CDP_CLIENT_REQUEST_TIMEOUT = +env.CDP_CLIENT_REQUEST_TIMEOUT || 10000;

const shotCounts = {
    success: 0,
    error: 0
};
Object.defineProperty(shotCounts, 'total', {
    enumerable: true,
    get() {
        return shotCounts.success + shotCounts.error;
    }
});

const makeshot = function(cfg, hooks) {
    let client = null;
    let clientInited = false;

    const traceInfo = function(type) {
        const msg = `Makeshot.${type}`;

        return logger.info(msg, {
            selector: cfg.wrapSelector,
            shot_id: cfg.id,
            url: cfg.url
        });
    };

    // hooks
    hooks = lodash.defaults(hooks, {
        beforeCheck: lodash.noop,
        beforeShot: lodash.noop,
        afterShot: lodash.noop,
        beforeOptimize: lodash.noop,
        afterOptimize: lodash.noop
    });

    return Promise.try(() => {
        traceInfo('start');

        if(!cfg.url) {
            throw new Error('url not provided');
        }

        if(bridge.clientCount < CDP_CLIENT_MAX_COUNT) {
            return;
        }

        return new Promise((resolve, reject) => {
            bridge.on('client.close', resolve);
            bridge.on('client.error', reject);
        })
        .timeout(CDP_CLIENT_REQUEST_TIMEOUT, 'Request client timeout');
    })
    .then(() => {
        const rAbsUrl = /^\w+:\/\//;

        let url = cfg.url;
        if(!rAbsUrl.test(url)) {
            url = pathToUrl(url);
        }

        clientInited = true;

        traceInfo('page.open');

        return bridge.openPage(url, {
            viewport: {
                height: cfg.viewport[1],
                width: cfg.viewport[0]
            }
        });
    })
    .tap(clt => {
        client = clt;

        traceInfo('page.check');

        // hook: beforeCheck
        return hooks.beforeCheck(cfg, client);
    })
    // check wrap count
    .then(() => {
        const selector = cfg.wrapSelector;
        const minCount = cfg.wrapMinCount;
        const ttl = +cfg.wrapFindTimeout || 1000;
        const maxTTL = +process.env.SHOT_MAX_TIMEOUT | 10000;

        const options = {
            timeout: Math.min(maxTTL, ttl),
            interval: 100
        };

        return wait((resolve, reject) => {
            Promise.try(() => {
                return bridge.querySelectorAllByClient(client, selector);
            })
            .then(({nodeIds}) => {
                if(nodeIds.length >= minCount) {
                    return;
                }

                const msg = `Elements not found: ${cfg.wrapSelector}`;
                const err = new Error(msg);

                err.status = 404;

                throw err;
            })
            .then(resolve)
            .catch(err => {
                reject(err);
            });
        }, options);
    })
    // hook: beforeShot
    .tap(() => {
        return hooks.beforeShot(cfg, client);
    })
    // clac rects
    .then(() => {
        traceInfo('page.clacRects');

        const selector = cfg.wrapSelector;

        return bridge.querySelectorAllByClient(client, selector)
        .then(({nodeIds}) => {
            return nodeIds;
        });
    })
    .map(nodeId => {
        const DOM = client.DOM;

        return DOM.getBoxModel({ nodeId })
        .then(({model}) => {
            const ret = {
                top: Infinity,
                left: Infinity,
                right: -Infinity,
                bottom: -Infinity,
                height: 0,
                width: 0
            };

            // consider rotate
            model.border.forEach((val, idx) => {
                if(idx % 2 === 0) {
                    if(val < ret.left) {
                        ret.left = val;
                    }
                    else if(val > ret.right) {
                        ret.right = val;
                    }
                }
                else {
                    if(val < ret.top) {
                        ret.top = val;
                    }
                    else if(val > ret.bottom) {
                        ret.bottom = val;
                    }
                }
            });

            ret.height = ret.bottom - ret.top;
            ret.width = ret.right - ret.left;

            return ret;
        });
    })
    // Filter
    .filter((rect, idx) => {
        return !cfg.wrapMaxCount || idx < cfg.wrapMaxCount;
    })
    // delay render
    .delay(Math.min(1000, cfg.renderDelay))

    // Clac viewport
    .tap(rects => {
        traceInfo('client.clacViewport');

        const viewport = cfg.viewport;
        const Emulation = client.Emulation;

        let viewWidth = viewport[0];
        let viewHeight = viewport[1];

        // x use right, y use height by elem.scrollIntoView
        rects.forEach(rect => {
            if(rect.right > viewWidth) {
                viewWidth = rect.right;
            }
            if(rect.height > viewHeight) {
                viewHeight = rect.height;
            }
        });

        if(viewWidth > MAX_IMAGE_WIDTH || viewHeight > MAX_IMAGE_HEIGHT) {
            throw new Error(`Request Image size is out of limit: ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_WIDTH}`);
        }

        return Promise.try(() => {
            if(viewWidth > viewport[0] || viewHeight > viewport[1]) {
                return Emulation.setVisibleSize({
                    viewHeight: Math.max(viewHeight, viewport[1]),
                    viewWidth: Math.max(viewWidth, viewport[0])
                });
            }
        })
        .then(() => {
            // // https://medium.com/@dschnr/using-headless-chrome-as-an-automated-screenshot-tool-4b07dffba79a
            // // This forceViewport call ensures that content outside the viewport is
            // // rendered, otherwise it shows up as grey. Possibly a bug?
            // return promise.then(() => {
            //     return Emulation.forceViewport({
            //         scale: 1,
            //         x: 0,
            //         y: 0
            //     });
            // })
            // .then(() => {
            //     return rects;
            // });
        });
    })

    // Focus element and Screenshot
    .mapSeries((rect, idx) => {
        traceInfo('client.captureScreenshot-' + idx);

        const Runtime = client.Runtime;
        const Page = client.Page;
        const ret = {
            xOffset: rect.left,
            yOffset: rect.top,
            rect
        };

        return Runtime.evaluate({
            expression: `
                var elems = document.querySelectorAll('${cfg.wrapSelector}');
                var elem = elems[${idx}];
                var ret = 0;

                if(elem) {
                    elem.scrollIntoView(true);

                    ret = pageYOffset;
                };

                ret;
            `
        })
        .then(({result}) => {
            // Fix page y offset
            ret.yOffset -= +result.value || 0;

            return Page.captureScreenshot({
                format: 'png'
            });
        })
        .then(({data}) => {
            ret.image = new Buffer(data, 'base64');

            return ret;
        });
    })
    // clean
    .finally(() => {
        if(client) {
            traceInfo('client.close');

            return client.close();
        }
    })
    .tap(() => {
        traceInfo('client.extractImage');
    })
    // Extract image
    .map(({image, rect, xOffset, yOffset}) => {
        const imageSize = cfg.imageSize || {};

        image = sharp(image).extract({
            height: rect.height,
            width: rect.width,
            left: xOffset,
            top: yOffset
        });

        const imageWidth = +imageSize.width || null;
        const imageHeight = +imageSize.height || null;
        if(imageWidth || imageHeight) {
            const cropStrategies = sharp.gravity;
            const oldStrategiesMap = {
                10: cropStrategies.north,
                11: cropStrategies.northwest,
                12: cropStrategies.northeast
            };

            let strategy = imageSize.type || imageSize.strategy;

            strategy = oldStrategiesMap[strategy] || cropStrategies[strategy];
            if(!strategy) {
                strategy = cropStrategies.north;
            }

            image = image.resize(imageWidth, imageHeight);
            image = image.crop(strategy);
        }

        return { image, rect };
    }, {
        concurrency: cpuCount
    })
    // hooks: beforeOptimize
    .tap(() => {
        traceInfo('client.optimizeImage');

        return hooks.beforeOptimize(cfg);
    })
    // Optimize image
    .map(({image, rect}) => {
        const ext = path.extname(cfg.out.image);
        const imageQuality = cfg.imageQuality;

        if(ext === '.png') {
            image = image.png({
                compressionLevel: Math.floor(imageQuality / 100),
                progressive: false
            });
        }
        else {
            image = image.jpeg({
                quality: imageQuality,
                progressive: false
            });
        }

        return { image, rect };
    }, {
        concurrency: cpuCount
    })
    // hooks: afterOptimize
    .tap(() => {
        return hooks.afterOptimize(cfg);
    })
    // Save images
    .tap(() => {
        traceInfo('client.saveImage');

        return fsp.ensureDir(cfg.out.path);
    })
    .map(({image, rect}, idx) => {
        const out = cfg.out;
        const ext = path.extname(out.image);
        const name = path.basename(out.image, ext);
        const outName = name + (idx > 0 ? '-' + (idx + 1) : '');
        const imagePath = path.join(out.path, `${outName}${ext}`);

        return image.toFile(imagePath)
        .then(() => {
            return {
                imagePath,
                image,
                rect
            };
        });
    }, {
        concurrency: cpuCount
    })
    // hooks: afterShot
    .tap(data => {
        return hooks.afterShot(cfg, data);
    })

    // Formar result
    .then(items => {
        traceInfo('client.formatResult');

        const ret = lodash.clone(cfg.out);

        const images = ret.images = [];
        const metadata = ret.metadata = {};
        const crops = metadata.crops = [];

        items.forEach(item => {
            images.push(item.imagePath);
            crops.push(item.rect);
        });

        return ret;
    }, {
        concurrency: cpuCount
    })

    // Count
    .tap(() => {
        shotCounts.success += 1;
    })
    .catch(err => {
        if(clientInited) {
            shotCounts.error += 1;
        }

        throw err;
    });
};

// status counts
makeshot.shotCounts = shotCounts;

module.exports = makeshot;
