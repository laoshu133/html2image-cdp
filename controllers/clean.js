/**
 * controllers/status
 *
 */

// const makeshot = require('../actions/makeshot');

module.exports = function(router) {
    router.get('/clean', function *() {
        // 超时删除
        // const removedIds = yield makeshot.clearTimeoutShots();

        const removedIds = [];

        this.body = {
            status: 'success',
            removedIds: removedIds
        };
    });
};