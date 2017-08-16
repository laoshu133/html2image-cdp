/**
 * actions/debug
 *
 */

const makeshot = require('./makeshot');

module.exports = (cfg) => {
    return makeshot(cfg, {
        beforeShot(client) {
            return client.getDocumentContent()
            .then(html => {
                if(cfg.out.metadata) {
                    cfg.out.metadata.html = html;
                }
            });
        }
    });
};
