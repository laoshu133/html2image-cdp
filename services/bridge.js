/**
 * bridge
 */

const BridgeBase = require('../lib/bridge');

const CDP_CLIENT_MAX_COUNT = +env.CDP_CLIENT_MAX_COUNT || 10;

class Bridge extends BridgeBase {
    constructor(...args) {
        super(...args);

        this.clients = [];
    }
}

module.exports = new Bridge(process.env.CDP_HOST);
