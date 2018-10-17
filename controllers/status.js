/**
 * controllers/status
 *
 */

const os = require('os');
const bridge = require('../services/bridge');
const prettyDate = require('../lib/pretty-date');

const Shot = require('../actions/shot');

const prettyMs = ms => {
    return prettyDate(new Date(ms));
};

module.exports = router => {
    const serverStartTime = Date.now();

    router.get('/status', async (ctx) => {
        const pressure = await bridge.getPressure();
        const clientVersion = await bridge.getClientVersion();

        // 多实例运行时部分数据非实时
        const data = {
            hostname: os.hostname(),
            host: ctx.host,
            protocol: ctx.protocol,
            process_id: process.pid,
            uptime: Date.now() - serverStartTime,
            startTime: serverStartTime,
            startTimePretty: prettyMs(serverStartTime),
            shotCounts: Shot.shotCounts,
            clientVersion,
            pressure
        };

        ctx.body = data;
    });
};
