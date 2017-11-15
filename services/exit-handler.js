/**
 * exit-handler
 */

const Promise = require('bluebird');

const logger = require('./logger');

const exitHandler = ({
    cleanup = null
} = {}, err) => {
    let exitCode = +err || 0;

    if(err && err.message) {
        logger.info(err.message, null, 'app.crashed');
        logger.error(err);

        exitCode = +err.code || 1;
    }

    // console.log(`app exit with code: ${exitCode}`);

    if(!cleanup) {
        process.exit(exitCode);

        return;
    }

    Promise.try(() => {
        return cleanup();
    })
    .then(() => {
        process.exit(exitCode);
    })
    .catch(() => {
        process.exit(exitCode !== 0 ? exitCode : 1);
    });
};

module.exports = exitHandler;
