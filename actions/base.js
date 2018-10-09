/**
 * BaseAction
 */

const EventEmitter = require('events');

const logger = require('../services/logger');
const bridge = require('../services/bridge');
const requestInterceptor = require('../services/request-interceptor');

class BaseAction extends EventEmitter {
    constructor(cfg = {}, options = {}) {
        super();

        this.result = null;

        this.config = cfg;
        this.options = Object.assign({
            requestInterceptor,
            bridge,
            logger
        }, options || {});

        this.logger = this.options.logger.extend({
            // action: cfg.action,
            shot_id: cfg.id,
            shot_url: cfg.url,
            selector: cfg.wrapSelector
        }, {
            logElapsed: true
        });

        this.bridge = this.options.bridge;
    }

    log(type = '', metadata = null) {
        const msg = `Shot.${type}`;

        this.logger.info(msg, metadata);
    }

    async setErrorInterception() {
        const page = this.page;
        const pageErrors = page.pageErrors = [];

        page.on('requestfailed', req => {
            pageErrors.push(new Error(`Resource request failed: ${req.url()}`));
        });

        page.on('pageerror', err => {
            pageErrors.push(err);
        });

        // // Debug
        // page.on('console', msg => {
        //     const Promise = require('bluebird');

        //     Promise.map(msg.args(), argv => {
        //         return argv.jsonValue().catch(err => {
        //             return 'page.console.item.error: ' + err.message;
        //         });
        //     })
        //     .then(args => {
        //         console.log('\npage.console:');
        //         console.log(...args);
        //         console.log('page.console.end\n');
        //     });
        // });
    }

    async setRequestInterception() {
        const page = this.page;

        if(!page || !requestInterceptor.hasInterception()) {
            return;
        }

        this.log('page.setRequestInterception');

        page.on('request', req => {
            return requestInterceptor.interceptRequest(req);
        });

        // RequestInterception
        await page.setRequestInterception(true);
    }

    async load() {
        this.log('start');

        const cfg = this.config;
        const page = await this.bridge.createPage();

        // Assign page
        this.page = page;

        // interceptions
        await this.setErrorInterception();
        await this.setRequestInterception();

        this.log('page.open', {
            hasContent: !!cfg.content,
            viewport: cfg.viewport
        });

        await page.setDefaultNavigationTimeout(cfg.wrapFindTimeout);

        await page.goto(cfg.url, {
            // waitUntil: 'load'
        });

        if(cfg.htmlContent) {
            this.log('page.updateDocumentContent', {
                contentTemplate: cfg.contentTemplate
            });

            await page.setContent(cfg.htmlContent);
        }

        this.log('page.open.done');

        return page;
    }

    async check() {
        const cfg = this.config;
        const page = await this.load();

        this.log('page.check', {
            wrapFindTimeout: cfg.wrapFindTimeout,
            errorSelector: cfg.errorSelector
        });

        await page.waitForFunction(cfg => {
            const $$ = document.querySelectorAll.bind(document);
            const statusData = {
                errorNodeCount: $$(cfg.errorSelector).length,
                wrapNodeCount: $$(cfg.wrapSelector).length,
                readyState: document.readyState
            };

            // Check page load status
            if(statusData.readyState !== 'complete') {
                const msg = `Page load fialed: ${statusData.readyState}`;
                const err = new Error(msg);

                return Promise.reject(err);
            }

            // Check render error first
            if(statusData.errorNodeCount) {
                const msg = `Page render error by ${cfg.errorSelector}`;
                const err = new Error(msg);

                return Promise.reject(err);
            }

            // Check wrap node count
            return statusData.wrapNodeCount >= cfg.wrapMinCount;
        }, {
            timeout: cfg.wrapFindTimeout,
            polling: 64
        }, {
            errorSelector: cfg.errorSelector,
            wrapSelector: cfg.wrapSelector,
            wrapMinCount: cfg.wrapMinCount
        })
        .catch(err => {
            err.status = 400;

            if(err.message.includes('timeout')) {
                err.message = `Elements not found by ${cfg.wrapSelector}`;

                err.status = 404;
            }

            throw err;
        });

        this.log('page.check.done');

        return page;
    }

    async ready() {
        return this.check();
    }

    async main() {
        // ...
    }

    async release() {
        const page = this.page;
        if(page) {
            this.page = null;

            this.log('client.release');

            const browser = await page.browser();

            await page.close();
            await browser.disconnect();
        }
    }

    async run() {
        try {
            await this.ready();

            await this.main();
        }
        catch(err) {
            const pageErrors = (this.page && this.page.pageErrors) || [];
            const pageErrorStacks = pageErrors.map(err => {
                return err.statck || err.message;
            });

            this.log(`error: ${err.message}`, {
                pageErrors: pageErrorStacks.join('\n\n'),
                stack: err.stack
            });

            // Release client asap
            await this.release();

            throw err;
        }

        // Ensure release client
        await this.release();
    }
}

module.exports = BaseAction;
