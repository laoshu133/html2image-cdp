/**
 * bridge
 */

const URL = require('url');
const lodash = require('lodash');
// const Promise = require('bluebird');
const CDP = require('chrome-remote-interface');

const bridge = {
    _options: {
        host: 'localhost',
        port: 9222,
        secure: false
    },
    targets: []
};

// extend props
Object.defineProperties(bridge, {
    options: {
        get() {
            return Object.assign({}, this._options);
        },
        set(options) {
            this._options = options;
        }
    }
});

// methods
lodash.assign(bridge, {
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
    },
    syncTargets() {
        return CDP.List(this.options)
        .then(targets => {
            this.targets = targets;

            return targets;
        });
    },
    createClient(url) {
        const options = lodash.defaults(this.options, {
            url: url || 'about:blank'
        });

        return CDP.New(options)
        .then(target => {
            return this.syncClients()
            .then(() => {
                return target;
            });
        });
    },
    closeClient(id) {
        const options = lodash.defaults(this.options, {
            id: id || null
        });

        console.log(999, this.options, options);

        return CDP.Close(options);
    }
});

module.exports = bridge;
