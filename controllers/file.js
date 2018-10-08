/**
 * controllers/file
 *
 * @description get file content
 *
 */

const path = require('path');
const fsp = require('fs-extra');
const getOutPath = require('../services/get-out-path');

const extToMimesMap = {
    pdf: 'application/pdf',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png'
};

module.exports = router => {
    const filePrefix = getOutPath('').urlPath;

    router.get(filePrefix + '/*', async (ctx) => {
        const filePath = ctx.path.replace(/\?.*/, '').replace(filePrefix, '');
        const ext = path.extname(filePath).replace('.', '');
        const outPathData = getOutPath(filePath);

        if(!(await fsp.exists(outPathData.realPath))) {
            ctx.throw(404);
        }

        if(ext && extToMimesMap[ext]) {
            ctx.type = extToMimesMap[ext];
        }

        ctx.body = fsp.createReadStream(outPathData.realPath);
    });
};
