/**
 * services/bridge
 */

const Bridge = require('../lib/bridge');

module.exports = new Bridge({
    ignoreHTTPSErrors: process.env.CDP_IGNORE_HTTPS_ERRORS === 'true',
    browserWSEndpoint: process.env.CDP_ENDPOINT
});
