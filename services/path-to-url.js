/**
 * path-to-url
 *
 */

const path = require('path');
const lodash = require('lodash');

module.exports = function(p) {
    const env = process.env;
    const OUT_PATH = env.OUT_PATH;
    const OUT_PATH_URL_PREFIX = env.OUT_PATH_URL_PREFIX;

    const urlPrefix = lodash.trim(OUT_PATH_URL_PREFIX, '/');
    const innerPath = path.relative(OUT_PATH, p);
    const uri = path.join('/', urlPrefix, innerPath);

    return `${env.WWW_PROTOCOL}://${env.WWW_HOST}${uri}`;
};
