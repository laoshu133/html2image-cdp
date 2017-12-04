/**
 * actions/ssr
 *
 */

const makeshot = require('./makeshot');

module.exports = (cfg) => {
    return makeshot(cfg, {
        beforeCheck() {
            // Do not sht images
            cfg.skipImagesShot = true;
            cfg.wrapMaxCount = 1;
            cfg.wrapMinCount = 1;
        },
        afterCheck(nodes, client) {
            return client.getDocumentContent()
            .then(html => {
                if(cfg.out.metadata) {
                    cfg.out.metadata.html = html;
                }
            });
        }
    });
};
