/**
 * get-out-path
 *
 */

const os = require('os');
const path = require('path');
const trim = require('lodash').trim;

const rParam = /\${([\w_]+)}/g;

module.exports = (filePath = '', ctx = {}) => {
    const { OUT_PATH_URL_PREFIX, OUT_PATH, PORT } = process.env;
    const host = ctx.host || `localhost:${PORT}`;
    const protocol = ctx.protocol || 'http';

    const urlParams = {
        hostname: os.hostname()
    };

    const realPathPrefix = path.resolve(OUT_PATH);
    const _urlPrefix = OUT_PATH_URL_PREFIX.replace(rParam, (a, k) => {
        return urlParams[k] || '-';
    });
    const urlPrefix = `/${trim(_urlPrefix, '/')}`;

    // Clean & fix
    filePath = filePath.replace(realPathPrefix, '');
    filePath = trim(filePath, '/').replace(/^\.+/, '');

    const realPath = path.resolve(OUT_PATH, filePath);
    const urlPath = path.join(urlPrefix, filePath);

    return {
        url: `${protocol}://${host}${urlPath}`,
        realPath,
        urlPath
    };
};
