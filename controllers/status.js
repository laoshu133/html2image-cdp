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
        const query = this.query;
        const clientVersion = yield bridge.getClientVersion();

        // 多进程运行时部分数据非实时
        const data = {
            host: process.env.WWW_HOST,
            process_id: process.pid,
            uptime: Date.now() - serverStartTime,
            startTime: serverStartTime,
            startTimePretty: prettyMs(serverStartTime),
            shotCounts: makeshot.shotCounts,
            clientCount: bridge.clients.length,
            clientVersion: clientVersion
        };

        if(+query.show_targets === 1) {
            const targets = yield bridge.getTargets();

            data.targetCount = targets.length;
            data.targets = targets;
        }

        this.body = data;
    });
};
