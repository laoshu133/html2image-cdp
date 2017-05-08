/**
 * actions/makeshot
 */

const path = require('path');
const lodash = require('lodash');
const fsp = require('fs-promise');
const Promise = require('bluebird');

const bridge = require('../services/bridge');

const env = process.env;
const CDP_CLIENT_MAX_COUNT = +env.CDP_CLIENT_MAX_COUNT || 10;
const CDP_CLIENT_REQUEST_TIMEOUT = +env.CDP_CLIENT_REQUEST_TIMEOUT || 10000;

const makeshot = function(cfg) {
    let client = null;

    return Promise.try(() => {
        if(bridge.clientCount < CDP_CLIENT_MAX_COUNT) {
            return;
        }

        return new Promise((resolve, reject) => {
            bridge.on('client.close', resolve);
            bridge.on('client.error', reject);
        })
        .timeout(CDP_CLIENT_REQUEST_TIMEOUT);
    })
    .then(() => {
        return bridge.openPage(cfg.url);
    })
    .then(clt => {
        client = clt;

        console.log(222, client);
    })
    .then(() => {
        return {
            a: 1
        };
    })
    .finally(() => {
        const clt = client;

        client = null;

        return clt.close();
    });
};

// status counts
makeshot.shotCounts = {
    total: 0,
    success: 0,
    error: 0
};

module.exports = makeshot;
