/**
 * Bridge
 */

const URL = require('url');
const path = require('path');
const lodash = require('lodash');
// const Promise = require('bluebird');
const EventEmitter = require('events');
const CDP = require('chrome-remote-interface');

const wait = require('../lib/wait-promise');
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

    // versions
    getClientVersion() {
        if(!this.getClientVersionPromise) {
            this.getClientVersionPromise = CDP.Version(this.options);
        }

        return this.getClientVersionPromise;
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
    addClient(client) {
        if(!client || !client.id) {
            throw new Error('Add client error');
        }

        client.on('close', () => {
            this.removeClient(client);

            this.emit('client.close', client);
        });

        client.on('error', err => {
            this.removeClient(client);

            this.emit('client.error', client, err);
        });

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
    createClient() {
        const client = new BridgeClient(this);

        // Sync add
        this.addClient(client);

        client.on('close', () => {
            this.emit('client.close', client);
        });

        client.on('error', err => {
            this.emit('client.error', client, err);
        });

        return client.init();
    }

    requestClient() {
        const clients = this.clients;

        return wait((resolve, reject) => {
            if(clients.length < this.clientsLimit) {
                resolve();

                return;
            }

            reject(new Error('Request client timeout'));
        }, {
            timeout: this.clientWaitTimeout,
            interval: 100
        })
        .then(() => {
            return this.createClient();
        });
    }

    releaseClient(client) {
        console.log(111, client);
    }
}

module.exports = Bridge;
