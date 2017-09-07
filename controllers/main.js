/**
 * controllers/main
 *
 */

const lodash = require('lodash');
const send = require('koa-send');

const actions = require('../actions/index');
const pathToUrl = require('../services/path-to-url');
const parseConfig = require('../services/parse-config');
const renderReadme = require('../services/render-readme');
const logger = require('../services/logger');

module.exports = function(router) {
    const shotMW = function *() {
        const timestamp = Date.now();
        const body = this.request.body;
        const query = this.query;

        // Guide
        if(this.method === 'GET' && lodash.isEmpty(query)) {
            this.body = yield renderReadme();

            return;
        }

        // parse config
        const requestCfg = lodash.merge({}, query, body);
        const cfg = yield parseConfig(requestCfg);

        let ret = null;
        if(actions[cfg.action]) {
            logger.info('Main controller init', {
                action: cfg.action,
                user_agent: this.get('User-Agent'),
                user_ip: this.ip
            });

            ret = yield actions[cfg.action](cfg);
        }
        else {
            this.throw(400, 'No action defined: ' + cfg.action);
        }

        // check result
        if(!ret) {
            this.throw(500, 'Unknow error');
        }

        // respone image
        if(cfg.dataType === 'image') {
            return yield send(this, ret.image);
        }

        // covert result (local path -> url)
        const result = {
            id: cfg.id,
            image: null,
            images: lodash.map(ret.images, pathToUrl),
            metadata: ret.metadata || null,
            // elapsed
            elapsed: Date.now() - timestamp
        };

        if(ret.images) {
            result.images = ret.images.map(pathToUrl);
            result.image = result.images[0] || null;
        }

        this.body = result;
    };

    router.post('/', shotMW);
    router.get('/', shotMW);
};
