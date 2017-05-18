/**
 * BridgeClient
 */

const path = require('path');
const lodash = require('lodash');
const Promise = require('bluebird');
const EventEmitter = require('events');
const CDP = require('chrome-remote-interface');

const parseColor = require('../lib/parse-color');

const uuid = function() {
    if(!uuid._uid) {
        uuid._uid = 0;
    }

    return ++uuid._uid;
};

class BridgeClient extends EventEmitter {
    constructor(bridge) {
        super();

        this.bridge = bridge;

        this.id = uuid();
        this.reset();
    }

    reset() {
        this.status = 'pending';
        this.loading = false;
        this.target = null;
        this.cdp = null;
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
        })
        .then(() => {
            this.emit('ready');

            return this;
        });
    }

    setTarget(target) {
        return Promise.try(() => {
            this.reset();
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
            const cdp = this.cdp;

            if(cdp) {
                this.cdp = null;

                return cdp.close();
            }
        })
        .then(() => {
            cdp.on('disconnect', () => {
                this.emit('close');
            });

            cdp._ws.on('error', err => {
                if(!err) {
                    err = new Error('Unknow error');
                }

                // Extend message
                err.message = 'CDP: ' + err.message;

                this.emit('error', err);
            });

            this.cdp = cdp;
            this.status = 'ready';

            return cdp;
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
        // viewport
        const viewport = options.viewport || {
            height: 600,
            width: 800
        };

        return this.getCDP()
        // setup
        .tap(cdp => {
            this.loading = true;

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
        .tap(cdp => {
            const rAbsUrl = /^\w+:/;

            if(!rAbsUrl.test(url)) {
                url = 'file://' + path.resolve(url);
            }

            return cdp.Page.navigate({
                url
            });
        })
        .finally(() => {
            this.loading = false;
        })
        .then(({frameId}) => {
            this.frameId = frameId;

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

    setPageScaleFactor(zoom) {
        return this.getCDP()
        .then(cdp => {
            return cdp.Emulation.setPageScaleFactor({
                pageScaleFactor: zoom || 1
            });
        });
    }

    setVisibleSize(width, height) {
        return this.getCDP()
        .tap(cdp => {
            return cdp.Emulation.setVisibleSize({
                height,
                width
            });
        })
        .then(() => {
            // // https://medium.com/@dschnr/using-headless-chrome-as-an-automated-screenshot-tool-4b07dffba79a
            // // This forceViewport call ensures that content outside the viewport is
            // // rendered, otherwise it shows up as grey. Possibly a bug?
            // return this.cdp.Emulation.forceViewport({
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
        return this.getCDP()
        .then(cdp => {
            return cdp.DOM.getDocument();
        })
        .then(({root}) => {
            const cdp = this.cdp;
            const rootNodeId = root.nodeId;

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

    release() {
        const idleURL = 'about:blank';

        return this.openPage(idleURL);
    }

    close() {
        return this.getCDP()
        .then(cdp => {
            this.reset();

            return cdp.close();
        });
    }

    destroy() {
        return this.getCDP()
        .then(() => {
            const bridge = this.bridge;
            const target = this.target;

            this.reset();

            return bridge.closeClientById(target.id);
        })
        .then(() => {
            this.emit('destroy');
        });
    }
};

module.exports = BridgeClient;
