/**
 * clear-timeout-shots
 *
 * 清理过期截图数据
 *
 */

const path = require('path');
const fsp = require('fs-extra');
const Promise = require('bluebird');

const getOutPath = require('./get-out-path');

const cpuCount = require('os').cpus().length;

const shotCacheTimeout = +process.env.SHOT_CACHE_MAX_TIMEOUT || 60 * 60 * 1000;
const rShotDir = /^\d+/i;

const getTimeoutShots = async () => {
    const now = Date.now();
    const shotsPath = getOutPath('').realPath;
    const dirList = await fsp.readdir(shotsPath);

    const shotItems = await Promise.map(dirList, name => {
        if(!rShotDir.test(name)) {
            return null;
        }

        return path.join(shotsPath, name);
    })
    .filter(shotPath => {
        if(!shotPath) {
            return false;
        }

        return fsp.stat(shotPath)
        .catch(() => {
            return false;
        })
        .then(stats => {
            const elapsed = now - stats.mtime.getTime();

            if(stats.isDirectory() && elapsed > shotCacheTimeout) {
                return true;
            }

            return false;
        });
    });

    return shotItems;
};

const clearTimeoutShots = async () => {
    const shotPaths = await getTimeoutShots();

    await Promise.map(shotPaths, shotPath => {
        return fsp.remove(shotPath);
    }, {
        concurrency: cpuCount
    });

    return shotPaths.map(shotPath => {
        return path.basename(shotPath);
    });
};

module.exports = clearTimeoutShots;
