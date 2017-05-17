/**
 * actions/makeshot
 */

const path = require('path');
const sharp = require('sharp');
const lodash = require('lodash');
const fsp = require('fs-promise');
const Promise = require('bluebird');

const cpuCount = require('os').cpus().length;
const clearTimeoutShots = require('../services/clear-timeout-shots');
const bridge = require('../services/bridge');
const logger = require('../services/logger');
const wait = require('../lib/wait-promise');

const env = process.env;
const SHOT_CLEAR_CHECK_INTERVAL = +env.SHOT_CLEAR_CHECK_INTERVAL || 100; // 每 N 次检查一次是否需要清理
const SHOT_IMAGE_MAX_HEIGHT = +env.SHOT_IMAGE_MAX_HEIGHT || 8000;
const SHOT_IMAGE_MAX_WIDTH = +env.SHOT_IMAGE_MAX_WIDTH || 5000;

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

    const traceInfo = function(type, metadata) {
        const msg = `Makeshot.${type}`;

        return logger.info(msg, lodash.assign({
            selector: cfg.wrapSelector,
            shot_id: cfg.id,
            url: cfg.url
        }, metadata));
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

        return bridge.requestClient();
    })
    .then(clt => {
        traceInfo('page.open', {
            url: cfg.url
        });

        // Client ready
        client = clt;

        return client.openPage(cfg.url, {
            viewport: {
                height: cfg.viewport[1],
                width: cfg.viewport[0]
            }
        });
    })
    // set html content
    .then(() => {
        if(!cfg.htmlContent) {
            return;
        }

        traceInfo('page.setHTMLContent');

        return client.setDocumentContent(cfg.htmlContent);
    })
    .then(() => {
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

        return wait((resolve, reject) => {
            Promise.try(() => {
                return client.querySelectorAll(selector);
            })
            .then(({nodeIds}) => {
                if(nodeIds.length >= minCount) {
                    return nodeIds;
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
        }, {
            timeout: Math.min(maxTTL, ttl),
            interval: 100
        });
    })
    // hook: beforeShot
    .tap(() => {
        return hooks.beforeShot(cfg, client);
    })
    // clac rects
    .tap(() => {
        traceInfo('page.clacRects');
    })
    .map(nodeId => {
        return client.getBoxModel(nodeId);
    })
    .map(model => {
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
    })
    // Filter
    .then(models => {
        if(cfg.wrapMaxCount > 0) {
            return models.slice(0, cfg.wrapMaxCount);
        }

        return models;
    })
    // delay render
    .delay(Math.min(1000, cfg.renderDelay))

    // Clac viewport
    .tap(rects => {
        const viewport = cfg.viewport;
        let viewHeight = viewport[1];
        let viewWidth = viewport[0];

        // x use right, y use height by elem.scrollIntoView
        rects.forEach(rect => {
            if(rect.right > viewWidth) {
                viewWidth = rect.right;
            }
            if(rect.height > viewHeight) {
                viewHeight = rect.height;
            }
        });

        // log
        traceInfo('client.setVisibleSize', {
            size: [viewWidth, viewHeight],
            viewport: viewport
        });

        if(viewWidth > SHOT_IMAGE_MAX_WIDTH || viewHeight > SHOT_IMAGE_MAX_HEIGHT) {
            const maxSize = `${SHOT_IMAGE_MAX_WIDTH}x${SHOT_IMAGE_MAX_HEIGHT}`;

            throw new Error(`Request Image size is out of limit: ${maxSize}`);
        }

        if(viewWidth > viewport[0] || viewHeight > viewport[1]) {
            const height = Math.max(viewHeight, viewport[1]);
            const width = Math.max(viewWidth, viewport[0]);

            return client.setVisibleSize(width, height);
        }
    })
    // Set background color
    // @TODO: 目前和 remote debugger 有冲突
    // https://bugs.chromium.org/p/chromium/issues/detail?id=689349
    .tap(() => {
        const isPng = cfg.out.imageType === 'png';
        const backgroundColor = isPng ? '#00000000' : '#FFFFFFFF';

        traceInfo('page.setBackgorundColor', {
            color: backgroundColor
        });

        return client.setBackgroundColor(backgroundColor);
    })

    // Focus element and Screenshot
    .mapSeries((rect, idx) => {
        traceInfo('client.captureScreenshot-' + idx);

        const ret = {
            cropRect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            },
            rect
        };
        const focusElementCode = `
            var elems = document.querySelectorAll('${cfg.wrapSelector}');
            var elem = elems[${idx}];
            if(elem) {
                elem.scrollIntoView();
            }

            var x = 0;
            var y = 0;
            while(elem) {
                y += elem.offsetTop;
                x += elem.offsetLeft;
                elem = elem.offsetParent;
            }

            var offset = {
                x: Math.max(0, x - window.pageXOffset),
                y: Math.max(0, y - window.pageYOffset)
            };

            offset.x + ':' + offset.y;
        `;

        return client.evaluate(focusElementCode)
        .then(result => {
            const offset = String(result.value).split(':');

            // Fix page offset
            ret.cropRect.top = +offset[1] || 0;
            ret.cropRect.left = +offset[0] || 0;

            return client.captureScreenshot({
                format: 'png'
            });
        })
        .then(buf => {
            ret.image = buf;

            return ret;
        });
    })
    // clean
    .finally(() => {
        if(client) {
            traceInfo('client.release');

            return bridge.releaseClient(client);
        }
    })
    .tap(() => {
        traceInfo('client.extractImage');
    })
    // Extract image
    .map(({image, rect, cropRect}) => {
        const imageSize = cfg.imageSize || {};

        image = sharp(image).extract(cropRect);

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
        const imageType = cfg.out.imageType;
        const imageQuality = cfg.imageQuality;

        if(imageType === 'png') {
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
    // Check clean
    .tap(() => {
        if(shotCounts.total % SHOT_CLEAR_CHECK_INTERVAL === 0) {
            return clearTimeoutShots();
        }
    })

    .catch(err => {
        shotCounts.error += 1;

        throw err;
    });
};

// status counts
makeshot.shotCounts = shotCounts;

module.exports = makeshot;
