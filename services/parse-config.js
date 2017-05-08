/**
 * parse-config
 */

const path = require('path');
const lodash = require('lodash');
const fsp = require('fs-promise');
const Promise = require('bluebird');

const prettyDate = require('./pretty-date');

// default, local config
const defaultConfig = require('../config.default');
const localConfig = path.join(__dirname, '../config.json');

const getLocalConfigPromise = Promise.try(() => {
    return fsp.exists(localConfig);
})
.then(exists => {
    return exists ? fsp.readFile(localConfig) : null;
})
.then(buf => {
    return JSON.parse(buf);
})
.then(config => {
    return lodash.merge({}, defaultConfig, config);
});

// uuid
let uuid = 0;

module.exports = function(cfg) {
    return Promise.try(() => {
        return getLocalConfigPromise;
    })
    .then(localCfg => {
        return lodash.merge({}, localCfg, cfg);
    })
    .then(cfg => {
        const action = cfg.action || 'makeshot';

        // id
        if(!cfg.id) {
            const notNumber = /[^\d]+/g;
            const nowStr = prettyDate(new Date());

            cfg.id = [
                action,
                nowStr.replace(notNumber, ''),
                ++uuid
            ].join('_');
        }

        // viewport
        let viewport = cfg.viewport;
        if(viewport && typeof viewport === 'string') {
            viewport = viewport.replace(/[[\]]/, '').split(',');

            cfg.viewport = [
                +viewport[0] || 1920,
                +viewport[1] || 1200
            ];
        }

        // limit
        if(cfg.dataType === 'image') {
            cfg.wrapMaxCount = 1;
        }

        return cfg;
    })
    .then(cfg => {
        return cfg;
    });
};
