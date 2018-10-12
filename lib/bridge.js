/**
 * Bridge
 */

const URL = require('url');
const axios = require('axios');
const lodash = require('lodash');
const puppeteer = require('puppeteer');
const EventEmitter = require('events');

class Bridge extends EventEmitter {
    constructor(options) {
        super();

        this.httpEndpoint = 'http://localhost:9222';
        this.http = null;

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

        // httpEndpoint
        const wsUrl = URL.parse(this._options.browserWSEndpoint);
        const httpEndpoint = URL.format({
            protocol: wsUrl.protocol === 'wss:' ? 'https:' : 'http:',
            hostname: wsUrl.hostname,
            port: wsUrl.port
        });

        this.httpEndpoint = httpEndpoint;
        this.http = axios.create({
            baseURL: httpEndpoint
        });
    }

    async createBrowser() {
        return puppeteer.connect(this.options);
    }

    async createPage() {
        const browser = await this.createBrowser();

        return browser.newPage();
    }

    async get(url = '', query = {}) {
        if(!this.http) {
            throw new Error('No bridge httpEndpoint init');
        }

        return this.http.get(url, query);
    }

    async getClientVersion() {
        const res = await this.get('/json/version');

        return res.data;
    }

    async getPressure() {
        let res = null;

        try {
            res = await this.get('/pressure');
        }
        catch(err) {
            // Ignore this error, powered by browserless
        }

        const data = (res && res.data) || {};
        const pressure = data.pressure || null;

        if(pressure) {
            return Object.assign({
                hostname: data.hostname || '-'
            }, pressure);
        }

        return null;
    }

    async setBackgroundColor(page, rgba = null) {
        rgba = Object.assign({
            r: 0,
            g: 0,
            b: 0,
            a: 0
        }, rgba || {});

        await page._client.send('Emulation.setDefaultBackgroundColorOverride', {
            color: rgba
        });
    }

    async enableBackground(page) {
        await this.setBackgroundColor(page, {
            r: 255,
            g: 255,
            b: 255,
            a: 255
        });
    }

    async disableBackground(page) {
        await this.setBackgroundColor(page, null);
    }

    // Reimplement screenshot to ensure performance
    async screenshot(page, options = {}) {
        const client = page._client;
        const format = options.format || options.type;
        const captureOptions = { format };

        if(format !== 'png' && options.quality > 0) {
            captureOptions.quality = options.quality;
        }

        if(options.clip) {
            captureOptions.clip = Object.assign({
                scale: 1,
                width: 1,
                height: 1,
                x: 0,
                y: 0
            }, options.clip);
        }

        const ret = await client.send('Page.captureScreenshot', captureOptions);

        return Buffer.from(ret.data, 'base64');
    }

    async screenshotElement(elem, options = {}) {
        const page = elem._page;
        const rect = await page.evaluate((elem) => {
            elem.scrollIntoView({
                behavior: 'instant',
                inline: 'nearest',
                block: 'start'
            });

            const rect = elem.getBoundingClientRect();

            return {
                width: rect.width,
                height: rect.height,
                left: rect.left,
                top: rect.top
            };
        }, elem);

        // A issue by chrome-headless screenshot with clip
        // https://github.com/GoogleChrome/puppeteer/issues/1996
        // .then(rect => {
        //     return page._client.send('Page.getLayoutMetrics')
        //     .then(res => {
        //         const layoutViewport = res.layoutViewport;
        //         const { pageX, pageY } = layoutViewport;

        //         rect.left += pageX;
        //         rect.top += pageY;

        //         return rect;
        //     });
        // })
        // .then(rect => {
        //     options.clip = {
        //         width: Math.floor(rect.width),
        //         height: Math.floor(rect.height),
        //         x: Math.floor(rect.left),
        //         y: Math.floor(rect.top)
        //     };

        //     return this.screenshot(page, options);
        // });

        // Limit rect to int
        Object.assign(rect, {
            width: Math.floor(rect.width),
            height: Math.floor(rect.height),
            left: Math.floor(rect.left),
            top: Math.floor(rect.top)
        });

        const viewport = Object.assign({}, page.viewport(), {
            height: rect.top + rect.height,
            width: rect.left + rect.width
        });

        // @TODO: 暂时不考虑页面自适应的情况
        await page.setViewport(viewport);

        const buffer = await this.screenshot(page, options);

        return {
            shotRect: rect,
            buffer
        };
    }
}

module.exports = Bridge;
