/**
 * actions/debug
 */

const ShotAction = require('./shot');

class DebugAction extends ShotAction {
    async main() {
        const page = this.page;
        const html = await page.content();

        await super.main();

        this.result.metadata.html = html;
    }
}

module.exports = DebugAction;
