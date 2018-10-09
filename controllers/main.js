/**
 * controllers/main
 *
 */

const os = require('os');
const { merge, isEmpty } = require('lodash');

const pathToUrl = require('../services/path-to-url');
const parseConfig = require('../services/parse-config');
const renderReadme = require('../services/render-readme');
const bridge = require('../services/bridge');
const logger = require('../services/logger');
const Actions = require('../actions');

const getClientVersion = async () => {
    if(!getClientVersion.promise) {
        getClientVersion.promise = bridge.getClientVersion();
    }

    return getClientVersion.promise;
};

module.exports = router => {
    const shotMW = async (ctx) => {
        const clientVersion = await getClientVersion();
        const body = ctx.request.body;
        const timestamp = Date.now();
        const query = ctx.query;

        // Assign base headers
        ctx.set('X-Browser-Version', clientVersion.browser);
        ctx.set('X-Shot-Host', os.hostname());

        // Guide and healthy check
        if(/^get|head$/i.test(ctx.method) && isEmpty(query)) {
            ctx.body = await renderReadme();

            return;
        }

        // parse config
        const requestCfg = merge({}, query, body);
        const cfg = await parseConfig(requestCfg);

        // Assign base headers
        ctx.set('X-Shot-Id', cfg.id);

        let ret = null;
        if(Actions[cfg.action]) {
            logger.info('Main controller init', {
                shot_id: cfg.id,
                shot_action: cfg.action,
                user_agent: ctx.get('User-Agent'),
                user_ip: ctx.ip
            });

            const action = new Actions[cfg.action](cfg);

            await action.run();

            ret = action.result;
        }
        else {
            ctx.throw(400, 'No action defined: ' + cfg.action);
        }

        // check result
        if(!ret) {
            ctx.throw(500, 'Unknow error');
        }

        // elapsed
        const elapsed = Date.now() - timestamp;

        ctx.set('X-Elapsed', elapsed);

        // respone image
        if(cfg.dataType === 'image') {
            const rect = ret.metadata.crops[0];
            const buf = ret.images[0];

            ctx.set('X-Image-Width', rect.width);
            ctx.set('X-Image-Height', rect.height);

            ctx.type = buf.type || 'image/png';
            ctx.body = buf;

            return;
        }

        // respone pdf
        else if(cfg.dataType === 'pdf') {
            const buf = ret.pdf;

            ctx.type = buf.type || 'application/pdf';
            ctx.body = buf;

            return;
        }

        // covert result (local path -> url)
        const result = {
            id: cfg.id
        };

        if(ret.images) {
            result.images = ret.images.map(path => {
                return pathToUrl(path, ctx);
            });

            result.image = result.images[0] || null;
        }
        else if(ret.pdf) {
            result.pdf = pathToUrl(ret.pdf, ctx);
        }

        // ext data
        Object.assign(result, {
            metadata: ret.metadata || null,
            elapsed
        });

        ctx.body = result;
    };

    router.post('/', shotMW);
    router.get('/', shotMW);
};
