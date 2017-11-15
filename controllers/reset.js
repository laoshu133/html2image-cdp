/**
 * controllers/reset
 *
 */

const bridge = require('../services/bridge');

module.exports = router => {
    const POWER = 1;

    router.get('/reset', function *() {
        const force = +this.query.force || 0;

        if(force < POWER) {
            this.throw(403, 'Not allowed');
        }

        // Reset clients
        const clients = yield bridge.removeAllClients(true);

        // Reset targets
        const targets = force > POWER
            ? yield bridge.closeAllTargets()
            : [];

        this.body = {
            status: 'success',
            clients: clients.map(client => {
                return client.target;
            }),
            targets
        };
    });
};
