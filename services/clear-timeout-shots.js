/**
 * clear-timeout-shots
 *
 * 清理过期截图数据
 *
 */

const path = require('path');
const fsp = require('fs-promise');
const Promise = require('bluebird');
const rShotId = /^[a-z]+_\d+/i;

const OUT_PATH = process.env.OUT_PATH;
const SHOT_MAX_TIMEOUT = +process.env.SHOT_MAX_TIMEOUT || 60000;

module.exports = function() {
    const now = Date.now();

    return Promise.try(() => {
        return fsp.readdir(OUT_PATH);
    })
    .filter(name => {
        if(!rShotId.test(name)) {
            return;
        }

        const shotPath = path.join(OUT_PATH, name);

        return fsp.stat(shotPath)
        .then(stats => {
            const elapsed = now - stats.mtime.getTime();

            if(stats.isDirectory() && elapsed > SHOT_MAX_TIMEOUT) {
                return true;
            }

            return false;
        });
    })
    .map(name => {
        const shotPath = path.join(OUT_PATH, name);

        return fsp.remove(shotPath)
        .then(() => {
            return name;
        });
    }, {
        concurrency: 5
    });
};
