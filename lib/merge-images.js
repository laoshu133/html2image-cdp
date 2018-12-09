/**
 * merge-images
 */

const Promise = require('bluebird');

const mergeFns = {
    async canvas(chunks, rect, options = {}) {
        const isPng = options.type === 'png';
        const imageQuality = +options.imageQuality || 90;

        const { createCanvas, loadImage } = require('canvas');
        const canvas = createCanvas(rect.width, rect.height);
        const ctx = canvas.getContext('2d');

        const images = await Promise.map(chunks, ({ buffer }) => {
            return loadImage(buffer);
        });

        await Promise.each(chunks, ({ clip }, idx) => {
            const img = images[idx];

            return ctx.drawImage(img, clip.x, clip.y);
        });

        if(isPng) {
            const minLevel = 4;
            const reqLevel = Math.floor(10 - imageQuality / 10);
            const level = Math.max(minLevel, reqLevel);

            return canvas.toBuffer('image/png', {
                compressionLevel: level
            });
        }

        return canvas.toBuffer('image/jpeg', {
            quality: imageQuality / 100,
            progressive: false
        });
    },

    async jimp(chunks, rect, options = {}) {
        const Jimp = require('jimp');

        const isPng = options.type === 'png';
        const imageQuality = +options.imageQuality || 90;
        const images = await Promise.map(chunks, ({ buffer }) => {
            return Jimp.read(buffer);
        });

        const img = images.reduce((ret, img, idx) => {
            const clip = chunks[idx].clip;

            ret.composite(img, clip.x, clip.y);

            return ret;
        }, new Jimp(rect.width, rect.height, 0));

        img.quality(imageQuality);

        const mime = `image/${isPng ? 'png' : 'jpeg'}`;
        const toBuffer = Promise.promisify(img.getBuffer);

        return toBuffer.call(img, mime);
    },

    async sharp(chunks, rect, options = {}) {
        const sharp = require('sharp');

        const imageQuality = +options.imageQuality || 90;
        const isPng = options.type === 'png';
        const sharpOptions = {
            raw: {
                width: rect.width,
                height: rect.height,
                channels: 4
            }
        };

        const image = await Promise.reduce(chunks, (lastBuf, chunk, idx) => {
            const { clip, buffer } = chunk;

            let image = lastBuf
                ? sharp(lastBuf, sharpOptions)
                : sharp({
                    create: {
                        ...sharpOptions.raw,
                        background: '#000000'
                    }
                });

            image = image.overlayWith(buffer, {
                left: clip.x,
                top: clip.y
            });

            if(chunks.length - idx > 1) {
                return image.raw().toBuffer();
            }

            return image;
        }, null);

        if(isPng) {
            const minLevel = 4;
            const reqLevel = Math.floor(10 - imageQuality / 10);
            const level = Math.max(minLevel, reqLevel);

            await image.png({
                compressionLevel: level,
                adaptiveFiltering: true,
                progressive: false,
                force: true
            });
        }
        else {
            await image.jpeg({
                quality: imageQuality,
                progressive: false,
                force: true
            });
        }

        return image.toBuffer();
    }
};

const mergeImages = async (chunks, rect, options, handler = 'canvas') => {
    const fn = mergeFns[handler];

    if(!fn) {
        throw new Error(`No ${handler} merge handler found.`);
    }

    // console.log('Merge.images...');
    // console.time('Merge.images');

    const ret = await fn(chunks, rect, options);

    // console.timeEnd('Merge.images');

    return ret;
};

module.exports = mergeImages;
