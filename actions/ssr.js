/**
 * actions/ssr
 *
 */

const makeshot = require('./makeshot');

module.exports = (cfg) => {
    return makeshot(cfg, {
        beforeCheck() {
            // Do not shot images
            cfg.dataType = 'json';
            cfg.skipImagesShot = true;
            cfg.wrapMaxCount = 1;
            cfg.wrapMinCount = 1;
        },
        afterCheck(counts, client) {
            return client.getDocumentContent()
            .then(html => {
                if(cfg.out.metadata) {
                    cfg.out.metadata.html = html;
                }
            });
        }
    });
};
