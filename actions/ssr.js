/**
 * actions/ssr
 */

const BaseAction = require('./base');

class SSR extends BaseAction {
    async main(page) {
        const html = await page.content();

        this.result = {
            metadata: {
                html
            }
        };
    }
}

module.exports = SSR;
