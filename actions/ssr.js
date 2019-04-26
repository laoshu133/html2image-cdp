/**
 * actions/ssr
 */

const BaseAction = require('./base');

class SSR extends BaseAction {
    async main() {
        const page = this.page;
        const html = await page.evaluate(() => {
            let ret = document.doctype
                // fix ssr sometimes crash in XMLSerializer
                // ? new XMLSerializer().serializeToString(document.doctype)
                ? '<!DOCTYPE html>'
                : '';

            if(document.documentElement) {
                ret += document.documentElement.outerHTML;
            }

            return ret;
        });

        this.result = {
            metadata: {
                html
            }
        };
    }
}

module.exports = SSR;
