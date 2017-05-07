/**
 * controllers/status
 *
 */

const bridge = require('../bridge');

module.exports = function(app, router) {
    const prettyDate = function(date) {
        const rSingleNum = /\b(\d)\b/g;

        return [
            date.getFullYear() + '/',
            date.getMonth() + 1 + '/',
            date.getDate() + ' ',
            date.getHours() + ':',
            date.getMinutes() + ':',
            date.getSeconds()
        ]
        .join('')
        .replace(rSingleNum, '0$1');
    };
    const prettyMs = function(ms) {
        return prettyDate(new Date(ms));
    };

    const serverStartTime = Date.now();

    router.get('/status', function *() {
        const data = {
            totalShots: 0,
            host: process.env.WWW_HOST,
            startTimePretty: prettyMs(serverStartTime),
            startTime: serverStartTime,
            uptime: Date.now() - serverStartTime,
            currentTargets: yield bridge.syncTargets()
        };

        this.body = data;
    });
};
