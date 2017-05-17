/**
 * BridgeClient
 */

const path = require('path');
const lodash = require('lodash');
const Promise = require('bluebird');
const EventEmitter = require('events');
const CDP = require('chrome-remote-interface');

const parseColor = require('../lib/parse-color');

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
        })
        .catch(err => {
            this.emit('error', err);

            throw err;
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
        })
        .then(() => {
            return this;
        });
    }

    getCDP() {
        return Promise.try(() => {
            if(!this.cdp) {
                throw new Error('Client not ready');
            }

            return this.cdp;
        });
    }

    openPage(url, options = {}) {
        let cdp;

        // viewport
        const viewport = options.viewport || {
            height: 600,
            width: 800
        };

        return this.getCDP()
        // setup
        .then(() => {
            cdp = this.cdp;

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
            const rAbsUrl = /^\w+:\/\//;

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

    setDocumentContent(html) {
        return this.getCDP()
        .then(cdp => {
            return cdp.Page.setDocumentContent({
                frameId: this.frameId,
                html: html
            });
        })
        .then(() => {
            return this;
        });
    }

    setVisibleSize(width, height) {
        return this.getCDP()
        .then(cdp => {
            return cdp.Emulation.setVisibleSize({
                height,
                width
            });
        })
        .then(() => {
            // // https://medium.com/@dschnr/using-headless-chrome-as-an-automated-screenshot-tool-4b07dffba79a
            // // This forceViewport call ensures that content outside the viewport is
            // // rendered, otherwise it shows up as grey. Possibly a bug?
            //
            // const cdp = this.cdp;
            //
            // return cdp.Emulation.forceViewport({
            //     scale: 1,
            //     x: 0,
            //     y: 0
            // });
        });
    }

    // @TODO: 目前和 remote debugger 有冲突
    // https://bugs.chromium.org/p/chromium/issues/detail?id=689349
    setBackgroundColor(color) {
        return this.getCDP()
        .then(cdp => {
            color = parseColor(color);

            return cdp.Emulation.setDefaultBackgroundColorOverride(color);
        });
    }

    querySelectorAll(selector) {
        let cdp;

        return this.getCDP()
        .then(() => {
            cdp = this.cdp;

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

    getBoxModel(nodeId) {
        return this.getCDP()
        .then(cdp => {
            return cdp.DOM.getBoxModel({
                nodeId: nodeId
            });
        })
        .then(({model}) => {
            return model;
        });
    }

    evaluate(code) {
        return this.getCDP()
        .then(cdp => {
            return cdp.Runtime.evaluate({
                expression: code
            });
        })
        .then(({result}) => {
            return result;
        });
    }

    captureScreenshot(options) {
        return this.getCDP()
        .then(cdp => {
            return cdp.Page.captureScreenshot(options);
        })
        .then(({data}) => {
            return new Buffer(data, 'base64');
        });
    }
};

module.exports = BridgeClient;
