/**
 * controllers/file
 *
 * @description get file
 *
 */

const fs = require('fs');
const path = require('path');

module.exports = function(router) {
    const rPng = /\.png(?:\?|$)/i;
    const fileRoot = process.env.OUT_PATH;
    const filePrefix = '/file';

    router.get(filePrefix + '/*', function *() {
        const filePath = this.path.replace(/\?.*/, '').replace(filePrefix, '');
        const fullPath = path.join(fileRoot, filePath);

        this.type = rPng.test(fullPath) ? 'image/png' : 'image/jpeg';
        this.body = fs.createReadStream(fullPath);
    });
};
