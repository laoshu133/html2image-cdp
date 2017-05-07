/**
 * services/logger
 *
 * 默认输出至控制台，建议基于 pm2 管理日志
 */

const debug = require('debug');

const APP_NAME = process.env.DEBUG.replace(/:\*$/, '');

const logger = require('hlg-logger').create({
    logServer: process.env.LOG_SERVER,
    app: APP_NAME
});


// debug.formatArgs
// 非 TTY 输出时，格式化时间为当地时间
if(!process.stdout.isTTY) {
    // let rSingleNum = /\b(\d)\b/g;

    debug.formatArgs = function() {
        let args = arguments;
        let name = this.namespace;

        // let now = new Date();
        // let timeStr = [
        //     now.getFullYear() + '/',
        //     now.getMonth() + 1 + '/',
        //     now.getDate() + ' ',
        //     now.getHours() + ':',
        //     now.getMinutes() + ':',
        //     now.getSeconds()
        // ]
        // .join('')
        // .replace(rSingleNum, '0$1');

        // args[0] = timeStr +' '+ name +' '+ args[0];

        // 取消内部格式化时间，使用 PM2 时间戳
        args[0] = name + ' ' + args[0];

        return args;
    };
}

module.exports = logger;
