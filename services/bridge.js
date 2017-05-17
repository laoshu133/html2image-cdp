/**
 * bridge
 */

const BridgeBase = require('../lib/bridge');

class Bridge extends BridgeBase {
    constructor(...args) {
        super(...args);

        this.clients = [];
    }
}

module.exports = new Bridge(process.env.CDP_HOST);
