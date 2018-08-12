/**
 * controllers/main
 *
 */

const os = require('os');
const lodash = require('lodash');
const Promise = require('bluebird');

const actions = require('../actions/index');
const pathToUrl = require('../services/path-to-url');
const parseConfig = require('../services/parse-config');
const renderReadme = require('../services/render-readme');
const bridge = require('../services/bridge');
const logger = require('../services/logger');

module.exports = function(router) {
    const shotMW = function *() {
        const timestamp = Date.now();
        const body = this.request.body;
        const query = this.query;

        // Assign base headers
        this.set('X-Shot-Host', os.hostname());

        // Guide and healthy check
        if(/^get|head$/i.test(this.method) && lodash.isEmpty(query)) {
            const clientVersion = yield Promise.try(() => {
                return bridge.getClientVersion();
            })
            .timeout(1600, 'Fetch bridge version timeout');

            this.set('X-Protocol-Version', clientVersion['Protocol-Version']);
            this.set('X-Browser-Version', clientVersion.Browser);

            this.body = yield renderReadme();

            return;
        }

        // parse config
        const requestCfg = lodash.merge({}, query, body);
        const cfg = yield parseConfig(requestCfg);

        // Assign base headers
        this.set('X-Shot-Id', cfg.id);

        let ret = null;
        if(actions[cfg.action]) {
            logger.info('Main controller init', {
                shot_id: cfg.id,
                shot_action: cfg.action,
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
            const rect = ret.metadata.crops[0];
            const buf = ret.images[0];

            this.set('X-Image-Width', rect.width);
            this.set('X-Image-Height', rect.height);
            this.set('X-Elapsed', Date.now() - timestamp);

            this.type = buf.type || 'image/png';
            this.body = buf;

            return;
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
