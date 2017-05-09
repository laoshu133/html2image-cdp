/**
 * controllers/status
 *
 */

const bridge = require('../services/bridge');
const prettyDate = require('../services/pretty-date');

const makeshot = require('../actions/makeshot');

const prettyMs = function(ms) {
    return prettyDate(new Date(ms));
};

module.exports = function(router) {
    const serverStartTime = Date.now();

    router.get('/status', function *() {
        const targets = yield bridge.getTargets();

        const data = {
            host: process.env.WWW_HOST,
            startTimePretty: prettyMs(serverStartTime),
            startTime: serverStartTime,
            uptime: Date.now() - serverStartTime,
            shotCounts: makeshot.shotCounts,
            clientCount: bridge.clientCount,
            targetCount: targets.length,
            currentTargets: targets
        };

        this.body = data;
    });
};
