/**
 * Bridge
 */

const URL = require('url');
const path = require('path');
const lodash = require('lodash');
// const Promise = require('bluebird');
const EventEmitter = require('events');
const CDP = require('chrome-remote-interface');

const BridgeClient = require('./bridge-client');

class Bridge extends EventEmitter {
    constructor(options) {
        super();

        this.clientWaitTimeout = +process.env.CDP_CLIENT_REQUEST_TIMEOUT || 15000;
        this.clientsLimit = +process.env.CDP_CLIENT_MAX_COUNT || 10;
        this.clients = [];

        this._options = {
            host: 'localhost',
            port: 9222,
            secure: false
        };

        this.setOptions(options);
    }

    // options
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

    // targets
    getTargets() {
        return CDP.List(this.options)
        .then(targets => {
            this.targets = targets;

            return targets;
        });
    }

    // clients
    createClient() {
        const client = new BridgeClient(this);

        // Sync add
        this.addClient(client);

        return client.init()
        .catch(err => {
            this.removeClient(client);

            throw err;
        })
        .then(() => {
            client.on('close', () => {
                this.removeClient(client);

                this.emit('client.close', client);
            });

            client.on('error', err => {
                this.removeClient(client);

                this.emit('client.error', client, err);
            });

            return client;
        });
    }
    addClient(client) {
        if(!client || !client.id) {
            throw new Error('Add client error');
        }

        this.clients.push(client);

        return client;
    }
    removeClient(client) {
        if(!client || !client.id) {
            throw new Error('Add client error');
        }

        lodash.remove(this.clients, item => {
            return item.id === client.id;
        });

        return client;
    }

    requestClient() {
        const clients = this.clients;
        return Promise.try(() => {
            if(clients.length < this.clientsLimit) {
                return;
            }

            return new Promise((resolve, reject) => {
                this.on('client.close', resolve);
                this.on('client.error', reject);
            })
            .timeout(this.clientWaitTimeout, 'Request client timeout');
        })
        .then(() => {
            return this.createClient();
        });
    }

    getClientVersion() {
        if(!this.getClientVersionPromise) {
            this.getClientVersionPromise = CDP.Version(this.options);
        }

        return this.getClientVersionPromise;
    }




    closeClient(id) {
        const options = lodash.defaults(this.options, {
            id: path.basename(id || '')
        });

        return CDP.Close(options)
        .then(() => {
            this._clientCount = Math.max(0, this._clientCount - 1);
        });
    }




}

module.exports = Bridge;
