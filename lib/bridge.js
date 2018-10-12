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
}

module.exports = Bridge;
