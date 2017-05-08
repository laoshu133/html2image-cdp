/**
 * controllers/status
 *
 */

const bridge = require('../services/bridge');
const prettyDate = require('../services/pretty-date');

const prettyMs = function(ms) {
    return prettyDate(new Date(ms));
};

module.exports = function(router) {
    const serverStartTime = Date.now();

    router.get('/status', function *() {
        const data = {
            totalShots: 0,
            host: process.env.WWW_HOST,
            startTimePretty: prettyMs(serverStartTime),
            startTime: serverStartTime,
            uptime: Date.now() - serverStartTime,
            currentTargets: yield bridge.getTargets()
        };

        this.body = data;
    });
};
