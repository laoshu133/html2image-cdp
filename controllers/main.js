/**
 * controllers/main
 *
 */

const path = require('path');
const lodash = require('lodash');
const send = require('koa-send');
const fsp = require('fs-promise');

const pkgs = require('../package.json');
const config = require('../services/config');
const actions = require('../actions/index');

module.exports = function(router) {
    const readmePath = `${__dirname}/../README.md`;
    const readmeTpl = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>{{title}}</title></head><body><pre>{{content}}</pre></body></html>';

    const pathToUrl = function(localPath) {
        const env = process.env;
        let url = 'http://' + env.WWW_HOST;

        localPath = path.relative(env.OUT_PATH, localPath);

        url += path.join('/file', localPath);

        return url;
    };

    const shotMW = function *() {
        const timestamp = Date.now();
        const body = this.request.body;
        const query = this.query;

        // Guide
        if(this.method === 'GET' && lodash.isEmpty(query)) {
            const rKeys = /\{\{(\w+)\}\}/g;
            const readmeContent = yield fsp.readFile(readmePath);
            const readmeData = {
                title: `Readme - ${pkgs.name}`,
                content: readmeContent.toString()
            };

            const readme = readmeTpl.replace(rKeys, (a, k) => {
                return readmeData[k] || '';
            });

            this.body = readme;

            return;
        }

        // parse config
        let cfg = yield config.create(lodash.merge(query, body));
        if(cfg.dataType === 'image') {
            cfg.wrapMaxCount = 1;
        }

        let ret = null;
        if(actions[cfg.action]) {
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
        let result = {
            id: cfg.id,
            image: pathToUrl(ret.image),
            images: lodash.map(ret.images, pathToUrl),
            metadata: ret.metadata || null,
            // elapsed
            elapsed: Date.now() - timestamp
        };
        if(ret.images) {
            result.images = ret.images.map(pathToUrl);
        }

        this.body = result;
    };

    router.post('/', shotMW);
    router.get('/', shotMW);
};
