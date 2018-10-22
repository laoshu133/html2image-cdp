/**
 * wait-for
 *
 */

const Promise = require('bluebird');

module.exports = function(checker, options = {}) {
    options = Object.assign({
        timeout: 10 * 1000,
        interval: 64
    }, options);

    const dfd = {};
    const start = Date.now();
    const ttl = options.timeout;

    function check() {
        new Promise((resolve, reject) => {
            checker(resolve, reject, err => {
                if(!(err instanceof Error)) {
                    err = new Error(err);
                }

                err.aborted = true;

                reject(err);
            });
        })
        .then(ret => {
            dfd.resolve(ret);
        })
        .catch(err => {
            const now = Date.now();
            if(!err.aborted && now - start <= ttl) {
                setTimeout(check, options.interval);

                return;
            }

            dfd.reject(err);
        });
    }

    setTimeout(check, 0);

    return new Promise((resolve, reject) => {
        dfd.resolve = resolve;
        dfd.reject = reject;
    });
};
