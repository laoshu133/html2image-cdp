const path = require('path');
const sharp = require('sharp');
const fsp = require('fs-extra');
const Promise = require('bluebird');
const mergeImages = require('../lib/merge-images');

const rect = {
    width: 5000,
    height: 5000
};

const test = async (name, fn) => {
    console.log('Start test:', name);
    console.time(`test: ${name}`);

    const ret = await fn();
    console.log('End test:', name, 'result:', ret);

    console.timeEnd(`test: ${name}`);
};

const mergeImagesTest = async () => {
    const chunksPath = path.resolve(__dirname, 'image-chunks');
    const tmpPaths = await fsp.readdir(chunksPath);
    const imagePaths = tmpPaths.filter(p => {
        return /^\d+\.png$/.test(p);
    });

    if(!imagePaths.length) {
        throw new Error('Image chunks error');
    }


    let lastX = 0;
    let lastY = 0;

    const images = await Promise.map(imagePaths, p => {
        return fsp.readFile(path.join(chunksPath, p));
    })
    .mapSeries(buffer => {
        return sharp(buffer).metadata()
        .then(metadata => {
            const { width, height } = metadata;
            const maxWidth = rect.width;
            const ret = {
                // metadata,
                buffer,
                clip: {
                    height: height,
                    width: width,
                    y: lastY,
                    x: lastX
                }
            };

            lastX += width;
            if(lastX >= maxWidth) {
                lastY += height;
                lastX = 0;
            }

            return ret;
        });
    });

    // console.log(images);

    // await test('merge with sharp', async () => {
    //     const buffer = await mergeImages(images, rect, {}, 'sharp');

    //     await fsp.writeFile('./data/sharp.png', buffer);

    //     return {
    //         size: buffer.length,
    //         buffer
    //     };
    // });

    // await test('merge with jimp', async () => {
    //     const buffer = await mergeImages(images, rect, {}, 'jimp');

    //     await fsp.writeFile('./data/jimp.png', buffer);

    //     return {
    //         size: buffer.length,
    //         buffer
    //     };
    // });

    await test('merge with canvas', async () => {
        const buffer = await mergeImages(images, rect, {}, 'canvas');

        await fsp.writeFile('./data/canvas.png', buffer);

        return {
            size: buffer.length,
            buffer
        };
    });
};

test('Merge images', mergeImagesTest);
