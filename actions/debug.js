/**
 * actions/debug
 */

const ShotAction = require('./shot');

class DebugAction extends ShotAction {
    async main(page) {
        const html = await page.content();

        await super.main(page);

        this.result.metadata.html = html;
    }
}

module.exports = DebugAction;
