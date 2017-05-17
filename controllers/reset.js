/**
 * controllers/reset
 *
 */

const Promise = require('bluebird');

const bridge = require('../services/bridge');

module.exports = function(router) {
    router.get('/reset', function *() {
        if(+this.query.force !== 1) {
            this.throw(403, 'Not allowed');
        }

        const targets = yield bridge.getTargets();

        yield Promise.mapSeries(targets, target => {
            return bridge.closeClientById(target.id);
        });

        this.body = targets;
    });
};
