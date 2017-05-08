/**
 * Bridge
 */

const URL = require('url');
const lodash = require('lodash');
// const Promise = require('bluebird');
const CDP = require('chrome-remote-interface');

class Bridge {
    constructor(options) {
        this._clientCount = 0;

        this._options = {
            host: 'localhost',
            port: 9222,
            secure: false
        };

        this.setOptions(options);
    }

    get clientCount() {
        return this._clientCount;
    }

    get options() {
        return lodash.clone(this._options);
    }

    set options(options) {
        this._options = options;
    }

    setOptions(options) {
        if(typeof options === 'string') {
            const url = URL.parse(options);

            options = {
                secure: url.protocol === 'wss',
                host: url.hostname,
                port: url.port
            };
        }

        return lodash.assign(this._options, options);
    }

    syncTargets() {
        return CDP.List(this.options)
        .then(targets => {
            this.targets = targets;

            return targets;
        });
    }

    createClient(url) {
        const options = lodash.defaults(this.options, {
            url: url || 'about:blank'
        });

        this._clientCount += 1;

        return CDP.New(options)
        .then(client => {
            // hack client

            return client;
        })
        .catch(err => {
            this._clientCount -= 1;

            throw err;
        });
    }

    closeClient(id) {
        const options = lodash.defaults(this.options, {
            id: id || null
        });

        return CDP.Close(options)
        .then(() => {
            this._clientCount = Math.max(0, this._clientCount - 1);
        });
    }

    openPage(url) {
        return this.createClient(url)
        .then(target => {
            const options = lodash.defaults(this.options, {
                target: target.webSocketDebuggerUrl
            });

            return CDP(options);
        });
    }
}

module.exports = Bridge;
