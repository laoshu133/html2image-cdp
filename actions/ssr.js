/**
 * actions/ssr
 */

const BaseAction = require('./base');

class SSR extends BaseAction {
    async main() {
        const page = this.page;
        const html = await page.content();

        this.result = {
            metadata: {
                html
            }
        };
    }
}

module.exports = SSR;
