/**
 * controllers/status
 *
 */

const clearTimeoutShots = require('../services/clear-timeout-shots');

module.exports = router => {
    const POWER = 1;

    router.get('/clean', async (ctx) => {
        const force = +ctx.query.force || 0;

        if(force < POWER) {
            ctx.throw(403, 'Not allowed');
        }

        const removedIds = await clearTimeoutShots();

        ctx.body = {
            status: 'success',
            removedIds: removedIds
        };
    });
};
