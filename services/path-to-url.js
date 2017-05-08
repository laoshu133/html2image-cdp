/**
 * path-to-url
 *
 */

const path = require('path');
const lodash = require('lodash');

module.exports = function(p) {
    const env = process.env;
    const urlPrefix = lodash.trim(env.OUT_PATH_URL_PREFIX, '/');
    const uri = path.join('/', urlPrefix, p);

    return `${env.WWW_PROTOCOL}://${env.WWW_HOST}${uri}`;
};
