/**
 * bridge
 */

const Bridge = require('../lib/bridge');

module.exports = new Bridge(process.env.CDP_HOST);
