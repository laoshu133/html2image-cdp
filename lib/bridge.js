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

    getTargets() {
        return CDP.List(this.options)
        .then(targets => {
            this.targets = targets;

            return targets;
        });
    }

    createClient() {
        const options = this.options;

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
        let client;

        return this.createClient()
        .then(target => {
            const options = lodash.defaults(this.options, {
                target: target.webSocketDebuggerUrl
            });

            return CDP(options);
        })
        .then(clt => {
            client = clt;

            // setup
            return Promise.all([
                client.DOM.enable(),
                client.Page.enable(),
                client.Network.enable()
            ]);
        })
        .then(() => {
            return client.Page.navigate({
                url
            });
        })
        .then(() => {
            return new Promise((resolve) => {
                client.Page.loadEventFired(() => {
                    resolve();
                });
            });
        })
        .then(() => {
            return client;
        });
    }

    querySelectorAllByClient(client, selector) {
        const DOM = client.DOM;

        return DOM.getDocument()
        .then(doc => {
            const rootNodeId = doc.root.nodeId;

            return DOM.querySelectorAll({
                selector: selector,
                nodeId: rootNodeId
            });
        });
    }
}

module.exports = Bridge;
