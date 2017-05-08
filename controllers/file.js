/**
 * controllers/file
 *
 * @description get file
 *
 */

const lodash = require('lodash');
const send = require('koa-send');

module.exports = function(router) {
    const env = process.env;
    const fileRoot = env.OUT_PATH;
    const fileURLPrefix = `/${lodash.trim(env.OUT_PATH_URL_PREFIX, '/')}/`;

    router.register('(.*)', ['get'], function *(next) {
        yield next;

        let uri = this.path;

        // check uri
        if(
            !this.body &&
            this.status === 404 &&
            uri.indexOf(fileURLPrefix) === 0
        ) {
            uri = uri.replace(fileURLPrefix, '');

            yield send(this, uri, {
                maxage: 24 * 60 * 60 * 1000,
                root: fileRoot
            });
        }
    });
};
