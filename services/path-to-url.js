/**
 * path-to-url
 *
 */

const getOutPath = require('./get-out-path');

module.exports = (filePath = '', ctx = {}) => {
    const pathData = getOutPath(filePath, ctx);

    return pathData.url;
};
