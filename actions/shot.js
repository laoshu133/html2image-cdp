/**
 * actions/shot
 */

const path = require('path');
const sharp = require('sharp');
const fsp = require('fs-extra');
const Promise = require('bluebird');

const BaseAction = require('./base');
const clearTimeoutShots = require('../services/clear-timeout-shots');

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
                resetViewport: false,
                lastViewport: null,
                path: imagePath,
                buffer: null,
                height: 0,
                width: 0,
                elem
            };
        })
        .mapSeries((image, idx) => {
            this.log(`client.captureScreenshot-${idx}`);

            return Promise.try(() => {
                return image.elem.boundingBox();
            })
            .then(rect => {
                rect = image.crop = {
                    width: Math.floor(rect.width),
                    height: Math.floor(rect.height),
                    left: Math.round(rect.x),
                    top: Math.round(rect.y)
                };

                this.log(`page.getClipRect-${idx}`, {
                    crop: rect
                });

                return rect;
            })
            // Clac image size
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

                // Check image size limit
                if(
                    imageWidth > cfg.maxImageWidth ||
                    imageHeight > cfg.maxImageHeight
                ) {
                    const maxSize = `${cfg.maxImageWidth}x${cfg.maxImageHeight}`;
                    const msg = `Request Image size is out of limit: ${maxSize}`;

                    throw new Error(msg);
                }

                // Assign image size
                image.width = imageWidth;
                image.height = imageHeight;
            })
            // export png for image optimize
            .then(() => {
                return image.elem.screenshot({
                    type: 'png'
                });
            })
            .then(buf => {
                buf.type = 'image/png';

                image.buffer = buf;

                this.log('client.captureScreenshot.done-' + idx, {
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
                const level = Math.floor(10 - imageQuality / 10);

                sharpImg = sharpImg.png({
                    // Shim compression level
                    compressionLevel: Math.max(4, level),
                    adaptiveFiltering: false,
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
            for(let idx = 0, len = images.length; idx < len; idx++) {
                const image = images[idx];

                this.log(`client.saveImage-${idx}`);

                await fsp.outputFile(image.path, image.buffer);

                this.log(`client.saveImage.done-${idx}`);
            }
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
    }

    async main() {
        shotCounts.total += 1;

        await this._main()
        .then(() => {
            shotCounts.success += 1;

            // Check clean
            if(!shotCheckInterval || shotCounts.total % shotCheckInterval > 0) {
                return;
            }

            return clearTimeoutShots()
            .then(removedIds => {
                this.log('clearTimeoutShots', {
                    removedIds
                });
            })
            .catch(err => {
                this.log('clearTimeoutShots.error', {
                    stack: err.stack || err.message
                });
            });
        })
        .catch(err => {
            shotCounts.error += 1;

            // Ensure release client
            this.release();

            this.log('error: ' + err.message, {
                stack: err.stack
            });

            throw err;
        });
    }
}

ShotAction.shotCounts = shotCounts;

module.exports = ShotAction;
