/**
 * BaseAction
 */

const EventEmitter = require('events');

const waitFor = require('../lib/wait-for');
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
            shot_id: cfg.id
        }, {
            logElapsed: true
        });

        this.bridge = this.options.bridge;
    }

    log(type = '', metadata = null) {
        const msg = `Shot.${type}`;

        this.logger.info(msg, metadata);
    }

    throwError(err, status = 400) {
        if(!(err instanceof Error)) {
            err = new Error(err);
        }

        if(!err.status) {
            err.status = status || 400;
        }

        throw err;
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
        //             return 'page.log.item.error: ' + err.message;
        //         });
        //     })
        //     .then(args => {
        //         console.log('\npage.log:');
        //         console.log(...args);
        //         console.log('page.log.end\n');
        //     });
        // });
    }

    async setRequestInterception() {
        const { requestInterceptor } = this.options;
        const page = this.page;

        if(!page || !requestInterceptor.hasInterception()) {
            return;
        }

        page.on('request', req => {
            return requestInterceptor.interceptRequest(req);
        });

        // RequestInterception
        await page.setRequestInterception(true);

        // Re-enable page caching
        await page.setCacheEnabled(true);

        this.log('page.setRequestInterception.done');
    }

    async load() {
        const cfg = this.config;

        if(!cfg.url) {
            this.throwError('url or content not provided');
        }

        this.log('page.request');

        const page = await this.bridge.createPage().catch(err => {
            if(!(err instanceof Error)) {
                err = new Error(err);
            }

            err.message = `Page create error: ${err.message}`;

            throw err;
        });

        // Assign page
        this.page = page;

        // interceptions
        await this.setErrorInterception();

        // TODO: fix dataURL RequestInterception
        // 当页面 URL 为 dataURL 时开启请求拦截会导致请求失败
        if(cfg.url.indexOf('data:') !== 0) {
            await this.setRequestInterception();
        }

        this.log('page.open', {
            hasContent: !!cfg.content,
            viewport: cfg.viewport
        });

        await page.setDefaultNavigationTimeout(cfg.wrapFindTimeout);

        if(!cfg.htmlContent) {
            await this.bridge.goto(page, cfg.url);
        }
        else {
            this.log('page.updateDocumentContent', {
                contentTemplate: cfg.contentTemplate
            });

            await page.setContent(cfg.htmlContent, {
                waitUntil: 'load'
            });
        }

        this.log('page.open.done');

        return page;
    }

    async check() {
        const cfg = this.config;
        const page = await this.load();
        const wrapConfig = {
            errorSelector: cfg.errorSelector,
            wrapSelector: cfg.wrapSelector,
            wrapMinCount: cfg.wrapMinCount
        };

        this.log('page.check', {
            wrapFindTimeout: cfg.wrapFindTimeout,

            ...wrapConfig
        });

        await waitFor((resolve, reject, abort) => {
            return page.evaluate(cfg => {
                const $$ = document.querySelectorAll.bind(document);

                return {
                    errorNodeCount: $$(cfg.errorSelector).length,
                    wrapNodeCount: $$(cfg.wrapSelector).length,
                    readyState: document.readyState
                };
            }, wrapConfig)
            .then(statusData => {
                const err = new Error('Page check failed');

                err.statusData = statusData;
                err.status = 400;

                // Check page load status
                if(statusData.readyState !== 'complete') {
                    err.message = `Page load failed: ${statusData.readyState}`;

                    throw err;
                }

                // Check render error first
                if(statusData.errorNodeCount) {
                    err.message = `Page render error by ${cfg.errorSelector}`;

                    // Force abort
                    abort(err);

                    throw err;
                }

                // Check wrap node count
                if(
                    !statusData.wrapNodeCount ||
                    statusData.wrapNodeCount < cfg.wrapMinCount
                ) {
                    err.message = `Find elements timeout by ${cfg.wrapSelector}`;
                    err.status = 408;

                    throw err;
                }

                return statusData;
            })
            .then(resolve)
            .catch(reject);
        }, {
            timeout: cfg.wrapFindTimeout,
            interval: 16
        })
        .catch(err => {
            const statusData = err.statusData || {};

            this.log(`page.check.failed: ${err.message}`, statusData);

            throw err;
        });

        this.log('page.check.done');
    }

    async ready() {
        return this.check();
    }

    async main() {
        // ...
    }

    async release() {
        const page = this.page;
        if(!this.page) {
            return;
        }

        this.page = null;

        try{
            const browser = await page.browser();

            // await page.close();
            await browser.disconnect();
        }
        // Ignore release error
        catch(err) {
            this.log('client.release.error: ' + err.message, {
                stack: err.stack
            });
        }

        this.log('client.release');
    }

    async run() {
        const cfg = this.config;

        try {
            this.log('start', {
                wrapSelector: cfg.wrapSelector,
                shot_url: cfg.url
            });

            await this.ready();
            await this.main();

            this.log('done', {
                wrapSelector: cfg.wrapSelector,
                shot_url: cfg.url
            });
        }
        catch(err) {
            const pageErrors = (this.page && this.page.pageErrors) || [];
            const pageErrorStacks = pageErrors.map(err => {
                return err.stack || err.message;
            });

            this.log(`error: ${err.message}`, {
                shot_url: cfg.url,
                wrapSelector: cfg.wrapSelector,
                errorSelector: cfg.errorSelector,
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
