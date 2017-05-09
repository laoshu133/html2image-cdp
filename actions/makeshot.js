/**
 * actions/makeshot
 */

const path = require('path');
const sharp = require('sharp');
const lodash = require('lodash');
const fsp = require('fs-promise');
const Promise = require('bluebird');

const cpuCount = require('os').cpus().length;
const bridge = require('../services/bridge');
const wait = require('../lib/wait-promise');

const env = process.env;
const CDP_CLIENT_MAX_COUNT = +env.CDP_CLIENT_MAX_COUNT || 10;
const CDP_CLIENT_REQUEST_TIMEOUT = +env.CDP_CLIENT_REQUEST_TIMEOUT || 10000;

const shotCounts = {
    total: 0,
    success: 0,
    error: 0
};

const makeshot = function(cfg, hooks) {
    let client = null;
    let clientInited = false;

    // hooks
    hooks = lodash.defaults(hooks, {
        beforeCheck: lodash.noop,
        beforeShot: lodash.noop,
        afterShot: lodash.noop,
        beforeOptimize: lodash.noop,
        afterOptimize: lodash.noop
    });

    return Promise.try(() => {
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
        .timeout(CDP_CLIENT_REQUEST_TIMEOUT);
    })
    .then(() => {
        shotCounts.total += 1;
        clientInited = true;

        return bridge.openPage(cfg.url);
    })
    .tap(clt => {
        client = clt;

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
            timeout: Math.min(maxTTL, ttl)
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
    // croper rects
    .then(() => {
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
    // Clac viewport
    .then(rects => {
        const viewport = cfg.viewport;
        const Emulation = client.Emulation;

        let viewWidth = viewport[0];
        let viewHeight = viewport[1];

        rects.forEach(rect => {
            if(rect.right > viewWidth) {
                viewWidth = rect.right;
            }
            if(rect.bottom > viewHeight) {
                viewHeight = rect.bottom;
            }
        });

        // Ensure rect in viewport
        let promise = Promise.resolve();
        if(viewWidth !== viewport[0] || viewHeight !== viewport[1]) {
            promise = Emulation.setVisibleSize({
                height: viewHeight,
                width: viewWidth
            });
        }

        // https://medium.com/@dschnr/using-headless-chrome-as-an-automated-screenshot-tool-4b07dffba79a
        // This forceViewport call ensures that content outside the viewport is
        // rendered, otherwise it shows up as grey. Possibly a bug?
        return promise.then(() => {
            return Emulation.forceViewport({
                scale: 1,
                x: 0,
                y: 0
            });
        })
        .then(() => {
            return rects;
        });
    })
    // delay render
    .delay(Math.min(1000, cfg.renderDelay))
    // screen shot
    .then(rects => {
        return client.Page.captureScreenshot({
            format: 'png'
        })
        .then(({data}) => {
            return {
                image: new Buffer(data, 'base64'),
                rects: rects
            };
        });
    })
    // clean
    .finally(() => {
        if(client) {
            return client.close();
        }
    })
    // Extract and resize image
    .then(({image, rects}) => {
        const imageSize = cfg.imageSize || {};

        return Promise.map(rects, rect => {
            let img = sharp(image).extract({
                height: rect.height,
                width: rect.width,
                left: rect.left,
                top: rect.top
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

                img = img.resize(imageWidth, imageHeight);
                img = img.crop(strategy);
            }

            return img;
        }, {
            concurrency: cpuCount
        })
        .then(images => {
            return {
                images,
                rects
            };
        });
    })
    // hooks: beforeOptimize
    .tap(() => {
        return hooks.beforeOptimize(cfg);
    })
    // Optimize image
    .then(({images, rects}) => {
        const ext = path.extname(cfg.out.image);
        const imageQuality = cfg.imageQuality;

        return Promise.map(images, img => {
            if(ext === '.png') {
                img = img.png({
                    compressionLevel: Math.floor(imageQuality / 100),
                    progressive: false
                });
            }
            else {
                img = img.jpeg({
                    quality: imageQuality,
                    progressive: false
                });
            }

            return img;
        }, {
            concurrency: cpuCount
        })
        .then(images => {
            return {
                images,
                rects
            };
        });
    })
    // hooks: afterOptimize
    .tap(() => {
        return hooks.afterOptimize(cfg);
    })
    // Save images
    .then(({images, rects}) => {
        const out = cfg.out;
        const outPath = out.path;
        const ext = path.extname(out.image);
        const name = path.basename(out.image, ext);

        return Promise.try(() => {
            return fsp.ensureDir(outPath);
        })
        .then(() => images)
        .map((img, idx) => {
            const outName = name + (idx > 0 ? '-' + (idx + 1) : '');
            const outPath = path.join(out.path, `${outName}${ext}`);

            return img.toFile(outPath)
            .then(() => {
                return outPath;
            });
        })
        .then(imagePaths => {
            return {
                imagePaths,
                images,
                rects
            };
        });
    })
    // hooks: afterShot
    .tap(data => {
        return hooks.afterShot(cfg, data);
    })
    // Formar result
    .then(({imagePaths, rects}) => {
        const ret = lodash.clone(cfg.out);
        const metadata = ret.metadata || {};

        // Assign crops
        metadata.crops = rects;

        ret.images = imagePaths;
        ret.metadata = metadata;

        return ret;
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
