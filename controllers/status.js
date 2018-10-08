/**
 * controllers/status
 *
 */

const os = require('os');
const bridge = require('../services/bridge');
const prettyDate = require('../services/pretty-date');

const Shot = require('../actions/shot');

const prettyMs = ms => {
    return prettyDate(new Date(ms));
};

module.exports = router => {
    const serverStartTime = Date.now();

    router.get('/status', async (ctx) => {
        // const query = this.query;
        const clientVersion = await bridge.getClientVersion();

        // 多进程运行时部分数据非实时
        const data = {
            hostname: os.hostname(),
            host: ctx.host,
            protocol: ctx.protocol,
            // process_id: process.pid,
            uptime: Date.now() - serverStartTime,
            startTime: serverStartTime,
            startTimePretty: prettyMs(serverStartTime),
            shotCounts: Shot.shotCounts,
            clientVersion: clientVersion
        };

        ctx.body = data;
    });
};
