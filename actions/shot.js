/**
 * actions/shot
 */

const path = require('path');
const sharp = require('sharp');
const fsp = require('fs-extra');
const Promise = require('bluebird');

const BaseAction = require('./base');
const clearTimeoutShots = require('../services/clear-timeout-shots');

const cpuCount = require('os').cpus().length;
const shotCheckInterval = +process.env.SHOT_CACHE_CHECK_INTERVAL || 100;

const oldCropTypesMap = {
    10: 'top',
    11: 'right top',
    12: 'left top'
};

const shotCounts = {
    success: 0,
    error: 0,
    total: 0
};

class ShotAction extends BaseAction {
    async _main() {
        const page = this.page;
        const cfg = this.config;
        const dataType = cfg.dataType;
        const imageType = cfg.out.imageType;
        const imageSize = cfg.imageSize || {};
        const imageQuality = cfg.imageQuality;
        const wrapMaxCount = cfg.wrapMaxCount;

        // Render delay
        await Math.min(1000, cfg.renderDelay);

        const images = await Promise.try(() => {
            return page.$$(cfg.wrapSelector);
        })
        .filter((elem, i) => {
            return i < wrapMaxCount;
        })
        .map((elem, idx) => {
            const out = cfg.out;
            const ext = path.extname(out.image);
            const name = path.basename(out.image, ext);
            const outName = name + (idx > 0 ? '-' + (idx + 1) : '');
            const imagePath = path.join(out.path, `${outName}${ext}`);

            return {
                path: imagePath,
                buffer: null,
                height: 0,
                width: 0,
                elem
            };
        })
        // Get crop rect and image size
        .mapSeries((image, idx) => {
            this.log(`page.getCropRect-${idx}`);

            return image.elem.boundingBox()
            .then(rect => {
                let imageWidth = parseInt(imageSize.width, 10) || 0;
                let imageHeight = parseInt(imageSize.height, 10) || 0;

                if(imageWidth || imageHeight) {
                    const aspect = rect.width / rect.height;

                    if(!imageWidth) {
                        imageWidth = Math.round(imageHeight * aspect);
                    }
                    else if(!imageHeight) {
                        imageHeight = Math.round(imageWidth / aspect);
                    }
                }
                else {
                    imageHeight = rect.height;
                    imageWidth = rect.width;
                }

                Object.assign(image, {
                    width: imageWidth,
                    height: imageHeight,
                    crop: {
                        width: Math.floor(rect.width),
                        height: Math.floor(rect.height),
                        left: Math.floor(rect.x),
                        top: Math.floor(rect.y)
                    }
                });

                this.log(`page.getCropRect.done-${idx}`, {
                    imageHeight: image.height,
                    imageWidth: image.width,
                    crop: image.crop,
                    rect
                });

                return image;
            });
        })
        // Calc viewport size and check image size limit
        .tap(images => {
            const viewport = cfg.viewport;

            let viewWidth = viewport[0];
            let viewHeight = viewport[1];

            images.forEach(({ crop }) => {
                if(crop.width >= viewWidth) {
                    viewWidth = crop.width;
                }

                if(crop.height >= viewHeight) {
                    viewHeight = crop.height;
                }
            });

            if(viewWidth > cfg.maxImageWidth || viewHeight > cfg.maxImageHeight) {
                const maxSize = `${cfg.maxImageWidth}x${cfg.maxImageHeight}`;
                const msg = `Request Image size is out of limit: ${maxSize}`;

                throw new Error(msg);
            }

            if(viewWidth > viewport[0] || viewHeight > viewport[1]) {
                const pageViewport = Object.assign({}, page.viewport(), {
                    height: viewHeight,
                    width: viewWidth
                });

                this.log('page.resetViewport', {
                    viewport: pageViewport
                });

                return page.setViewport(pageViewport);
            }
        })
        // Export image
        .mapSeries((image, idx) => {
            this.log(`page.focusElement-${idx}`);

            return Promise.try(() => {
                return page.evaluate((elem) => {
                    elem.scrollIntoView({
                        behavior: 'instant',
                        inline: 'nearest',
                        block: 'start'
                    });

                    const rect = elem.getBoundingClientRect();

                    return {
                        width: rect.width,
                        height: rect.height,
                        left: rect.left,
                        top: rect.top
                    };
                }, image.elem)
                .then(rect => {
                    return page._client.send('Page.getLayoutMetrics')
                    .then(res => {
                        console.log(111, res);

                        const layoutViewport = res.layoutViewport;
                        const { pageX, pageY } = layoutViewport;

                        rect.left += pageX;
                        rect.top += pageY;

                        return rect;
                    });
                })
                .then(rect => {
                    const crop = image.crop;
                    const options = {
                        omitBackground: imageType === 'png',
                        type: 'png',
                        clip: {
                            width: crop.width,
                            height: crop.height,
                            x: Math.floor(rect.left),
                            y: Math.floor(rect.top)
                        }
                    };

                    this.log(`page.captureScreenshot-${idx}`, {
                        screenshotOptions: JSON.stringify(options),
                        rect
                    });

                    return page.screenshot(options);
                });
            })
            .timeout(cfg.screenshotTimeout, 'Take image timeout')
            .then(buf => {
                buf.type = 'image/png';

                image.buffer = buf;

                this.log('page.captureScreenshot.done-' + idx, {
                    bufferLength: buf.length,
                    bufferType: buf.type
                });

                return image;
            });
        });

        // Release client asap
        await this.release();

        // Optimize images
        const position = imageSize.position || imageSize.type;
        const cropPosition = oldCropTypesMap[position] || 'top';

        for(let idx = 0, len = images.length; idx < len; idx++) {
            const image = images[idx];
            const { crop: rect, width: imageWidth, height: imageHeight } = image;
            const needsResize = imageWidth !== rect.width || imageHeight !== rect.height;

            // Skip image optimiztion if not need resize
            // @see: ibvips' PNG output supporting a minimum of 8 bits per pixel.
            // https://github.com/lovell/sharp/issues/478
            if(imageType === 'png' && !needsResize) {
                this.log(`client.optimizeImage.skip-${idx}`, {
                    imageQuality: cfg.imageQuality,
                    imageSize: cfg.imageSize,
                    imageHeight,
                    imageWidth
                });

                continue;
            }

            this.log(`client.optimizeImage-${idx}`, {
                imageQuality: cfg.imageQuality,
                imageSize: cfg.imageSize,
                imageHeight,
                imageWidth,
                cropPosition
            });

            let sharpImg = sharp(image.buffer);

            if(imageWidth !== rect.width || imageHeight !== rect.height) {
                sharpImg = sharpImg.resize(imageWidth, imageHeight, {
                    position: cropPosition
                });
            }

            if(imageType === 'png') {
                const minLevel = 4;
                const reqLevel = Math.floor(10 - imageQuality / 10);
                const level = Math.max(minLevel, reqLevel);

                sharpImg = sharpImg.png({
                    compressionLevel: level,
                    adaptiveFiltering: true,
                    progressive: false,
                    force: true
                });
            }
            else {
                sharpImg = sharpImg.jpeg({
                    quality: imageQuality,
                    progressive: false,
                    force: true
                });
            }

            const lastBufferLenght = image.buffer.length;
            const buf = await sharpImg.toBuffer();

            buf.type = `image/${imageType}`;

            image.buffer = buf;

            this.log(`client.optimizeImage.done-${idx}`, {
                imageQuality: cfg.imageQuality,
                imageSize: cfg.imageSize,
                bufferLength: buf.length,
                bufferType: buf.type,
                lastBufferLenght,
                cropPosition
            });
        }

        // Save images, skip if dataType is image
        if(dataType !== 'image') {
            await Promise.map(images, (image, idx) => {
                this.log(`client.saveImage-${idx}`);

                return fsp.outputFile(image.path, image.buffer)
                .then(() => {
                    this.log(`client.saveImage.done-${idx}`);
                });
            }, {
                concurrency: cpuCount
            });
        }

        // Format result
        this.result = {
            images: images.map(image => {
                return dataType === 'image'
                    ? image.buffer
                    : image.path;
            }),
            metadata: {
                crops: images.map(image => {
                    return image.crop;
                })
            }
        };

        this.log('client.formatResult');
    }

    // Check and clean
    async checkAndCleanShots() {
        if(!shotCheckInterval || shotCounts.total % shotCheckInterval > 0) {
            return;
        }

        try{
            const removedIds = await clearTimeoutShots();

            this.log('clearTimeoutShots', {
                removedIds
            });
        }
        catch(err) {
            this.log('clearTimeoutShots.error', {
                stack: err.stack || err.message
            });
        }
    }

    async main() {
        try{
            shotCounts.total += 1;

            await this._main();

            shotCounts.success += 1;

            await this.checkAndCleanShots();
        }
        catch(err) {
            shotCounts.error += 1;

            throw err;
        }
    }
}

ShotAction.shotCounts = shotCounts;

module.exports = ShotAction;
