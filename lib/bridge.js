/**
 * Bridge
 */

const lodash = require('lodash');
const puppeteer = require('puppeteer');
// const Promise = require('bluebird');
const EventEmitter = require('events');

class Bridge extends EventEmitter {
    constructor(options) {
        super();

        this.setOptions(options);
    }

    get options() {
        return this._options || null;
    }

    setOptions(options) {
        if(!this._options) {
            this._options = {
                browserWSEndpoint: 'ws://localhost:9222',
                ignoreHTTPSErrors: true
            };
        }

        this._options = lodash.assign({}, this._options, options);
    }

    async createBrowser() {
        return puppeteer.connect(this.options);
    }

    async createPage() {
        const browser = await this.createBrowser();

        return browser.newPage();
    }

    async getClientVersion() {
        const browser = await this.createBrowser();
        const ret = {
            userAgent: await browser.userAgent(),
            browser: await browser.version()
        };

        await browser.disconnect();

        return ret;
    }
}

module.exports = Bridge;
