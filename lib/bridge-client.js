/**
 * BridgeClient
 *
 * @see https://chromedevtools.github.io/devtools-protocol
 */

const lodash = require('lodash');
const Promise = require('bluebird');
const EventEmitter = require('events');
const CDP = require('chrome-remote-interface');

const CAPTURE_SCREENSHOT_MAX_TIMEOUT = +process.env.CAPTURE_SCREENSHOT_MAX_TIMEOUT || 10000;

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
        this.captureScreenshotTimeout = CAPTURE_SCREENSHOT_MAX_TIMEOUT;

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
        const viewport = options.viewport || {
            height: 600,
            width: 800
        };

        // setup
        return this.getCDP()
        .tap(cdp => {
            this.loading = true;

            return Promise.all([
                cdp.DOM.enable(),
                cdp.Page.enable(),
                cdp.Network.enable(),
                cdp.Runtime.enable(),
                this.setVisibleSize(viewport.width, viewport.height)
            ]);
        })
        // Load page
        .then(cdp => {
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

    getDocumentContent() {
        const code = `
            var root = document.documentElement;
            var html = root.outerHTML || root.innerHTML;

            html;
        `;

        return this.evaluate(code)
        .then(ret => {
            return ret.value;
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

    getVisibleSize() {
        const code = `
            var data = {
                width: window.innerWidth,
                height: window.innerHeight
            };

            JSON.stringify(data);
        `;

        return this.evaluate(code)
        .then(ret => {
            return JSON.parse(ret.value);
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
            // 关闭此处，会导致 captureScreenshot 始终在第一屏
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

    setBackgroundColor(color) {
        return this.getCDP()
        .then(cdp => {
            color = parseColor(color);

            return cdp.Emulation.setDefaultBackgroundColorOverride({
                color
            });
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
        const maxTimeout = this.captureScreenshotTimeout;

        return this.getCDP()
        .then(cdp => {
            return cdp.Page.captureScreenshot(options);
        })
        .then(({data}) => {
            return new Buffer(data, 'base64');
        })
        .timeout(maxTimeout, 'Capture screenshot timeout');
    }

    release() {
        const idleURL = 'about:blank';

        return this.openPage(idleURL);
    }

    close() {
        return this.getCDP()
        .then(cdp => {
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
