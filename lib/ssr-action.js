/**
 * SSRAction
 */

const BaseAction = require('./base-action');

class SSRAction extends BaseAction {
    async main(page) {
        const html = await page.content();

        this.result = {
            metadata: {
                html
            }
        };
    }
}

module.exports = SSRAction;
