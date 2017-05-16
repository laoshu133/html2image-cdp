/**
 * BridgeClient
 */

const path = require('path');
const lodash = require('lodash');
const Promise = require('bluebird');
const EventEmitter = require('events');
const CDP = require('chrome-remote-interface');

class BridgeClient extends EventEmitter {
    constructor(bridge) {
        super();

        this.bridge = bridge;
        this.resourceRequestTimeout = +process.env.CDP_RESOURCE_REQUEST_TIMEOUT || 5000;

        this.id = this.uid();
        this.status = 'pending';
        this.target = null;
        this.cdp = null;
    }

    uid() {
        if(!this._uid) {
            this._uid = 0;
        }

        return ++this._uid;
    }

    init() {
        return Promise.try(() => {
            return CDP.New(this.bridge.options);
        })
        .then(target => {
            return this.setTarget(target);
        });
    }

    setTarget(target) {
        return Promise.try(() => {
            this.target = target;

            const options = lodash.assign({
                target: target.webSocketDebuggerUrl
            }, this.bridge.options);

            return CDP(options);
        })
        .then(cdp => {
            return this.setCDP(cdp);
        });
    }

    setCDP(cdp) {
        return Promise.try(() => {
            if(this.cdp) {
                return this.cdp.close();
            }
        })
        .then(() => {
            cdp.on('disconnect', () => {
                this.emit('close');
            });

            cdp._ws.on('error', err => {
                this.emit('error', err);
            });

            this.cdp = cdp;
            this.status = 'ready';
        });
    }

    getCDP() {
        return Promise.try(() => {
            if(!this.cdp) {
                throw new Erro('Client not ready');
            }

            return this.cdp;
        });
    }

    openPage(url, options = {}) {
        const cdp = this.cdp;
        const rAbsUrl = /^\w+:\/\//;

        // viewport
        const viewport = options.viewport || {
            height: 600,
            width: 800
        };

        return this.getCDP()
        // setup
        .then(() => {
            return Promise.all([
                cdp.DOM.enable(),
                cdp.Page.enable(),
                cdp.Network.enable(),
                cdp.Runtime.enable(),
                cdp.Emulation.setVisibleSize({
                    height: viewport.height,
                    width: viewport.width
                })
            ]);
        })
        // Fix url & open url
        .then(() => {
            if(!rAbsUrl.test(url)) {
                url = 'file://' + path.resolve(url);
            }

            return cdp.Page.navigate({
                url
            });
        })
        // Wait page loaded
        .then(({frameId}) => {
            this.frameId = frameId;

            return new Promise((resolve) => {
                cdp.Page.loadEventFired(() => {
                    resolve();
                });
            })
            .timeout(this.resourceRequestTimeout, 'Page load failed: ' + url);
        })
        .then(() => {
            return this;
        });
    }

    querySelectorAll(selector) {
        const cdp = this.cdp;

        return this.getCDP()
        .then(() => {
            return cdp.DOM.getDocument();
        })
        .then(doc => {
            const rootNodeId = doc.root.nodeId;

            return cdp.DOM.querySelectorAll({
                selector: selector,
                nodeId: rootNodeId
            });
        });
    }
};

module.exports = BridgeClient;
