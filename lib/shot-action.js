/**
 * ShotAction
 */

const path = require('path');
const fsp = require('fs-extra');
const Promise = require('bluebird');
const BaseAction = require('./base-action');

const cpuCount = require('os').cpus().length;

class ShotAction extends BaseAction {
    async main(page) {
        const cfg = this.config;
        const dataType = cfg.dataType;
        const wrapMaxCount = +cfg.wrapMaxCount || 999;

        const images = await Promise.try(() => {
            return page.$$(cfg.wrapSelector);
        })
        .filter((elem, i) => {
            return i < wrapMaxCount;
        })
        .mapSeries((elem, idx) => {
            this.log('client.captureScreenshot-' + idx);

            return elem.screenshot()
            .then(buf => {
                this.log('client.captureScreenshot.done-' + idx);

                return buf;
            });
        })
        // format images
        .map((buf, idx) => {
            const out = cfg.out;
            const ext = path.extname(out.image);
            const name = path.basename(out.image, ext);
            const outName = name + (idx > 0 ? '-' + (idx + 1) : '');
            const imagePath = path.join(out.path, `${outName}${ext}`);

            return {
                path: imagePath,
                buffer: buf
            };
        })
        // save image
        .map((image, idx) => {
            if(dataType !== 'image') {
                return image;
            }

            this.log(`client.saveImage-${idx}`);

            return fsp.outputFile(image.path, image.buffer)
            .then(() => {
                this.log(`client.saveImage.done-${idx}`);

                return image;
            })
        }, {
            concurrency: cpuCount
        });

        this.result = {
            images: images.map(image => {
                return dataType === 'image'
                    ? image.buffer
                    : image.path;
            }),
            metadata: {
                crops: images.map(() => {
                    return {
                        width: 0,
                        height: 0,
                        left: 0,
                        top: 0
                    };
                })
            }
        };
    }
}

module.exports = ShotAction;
