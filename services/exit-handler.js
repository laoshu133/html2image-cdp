/**
 * exit-handler
 */

const Promise = require('bluebird');

const bridge = require('./bridge');
const logger = require('./logger');

const exitHandler = ({
    skipClean = false
} = {}, err) => {
    let exitCode = +err || 0;

    if(err && err.message) {
        logger.info(err.message, null, 'app.crashed');
        logger.error(err);

        exitCode = err.code || 1;
    }

    // console.log(`app exit with code: ${exitCode}`);

    Promise.try(() => {
        if(skipClean) {
            return;
        }

        return bridge.removeAllClients(true);
    })
    .then(() => {
        process.exit(exitCode);
    })
    .catch(() => {
        process.exit(exitCode !== 0 ? exitCode : 1);
    });
};

module.exports = exitHandler;
