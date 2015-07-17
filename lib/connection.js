'use strict';

import debug from 'debug';
import uuid from 'node-uuid';

import { EventEmitter } from 'events';
import { w3cwebsocket as W3CWebSocket } from 'websocket';
import { Account } from './account';

const SYLKRTC_PROTO = 'sylkRTC-1';
const DEBUG = debug('sylkrtc:Connection');
const INITIAL_DELAY = 0.5 * 1000;


class Connection extends EventEmitter {
    constructor(options = {}) {
        super();
        this._wsUri = options.server || 'wss://127.0.0.1:8088/webrtcgateway/ws';
        this._sock = null;
        this._ready = false;
        this._closed = false;
        this._timer = null;
        this._delay = INITIAL_DELAY;
        this._accounts = new Map();
        this._requests = new Map();
    }

    get ready() {
        return this._ready;
    }

    close() {
        if (this._closed) {
            return;
        }
        this._closed = true;
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        if (this._sock) {
            this._sock.close();
            this._sock = null;
        }
    }

    setupAccount(options = {}) {
        if (typeof options.account !== 'string' || typeof options.password !== 'string') {
            throw new Error('Invalid options, \"account\" and \"password\" must be supplied');
        }
        if (this._accounts.has(options.account)) {
            throw new Error('Account already setup');
        }
        let acc = new Account(options.account, options.password);
        acc._connection = this;
        this._accounts.set(acc.id, acc);
        return acc;
    }

    destroyAccount(account) {
        const acc = this._accounts.get(account.id);
        if (account !== acc) {
            throw new Error('Unknown account');
        }
        account.unbind();
        this._accounts.delete(account.id);
    }

    // Private API

    _initialize() {
        if (this._sock !== null) {
            throw new Error('WebSocket already initialized');
        }
        if (this._timer !== null) {
            throw new Error('Initialize is in progress');
        }

        DEBUG('Initializing');

        this._timer = setTimeout(() => {
            this._connect();
        }, this._delay);
    }

    _connect() {
        DEBUG('WebSocket connect');

        this._sock = new W3CWebSocket(this._wsUri, SYLKRTC_PROTO);
        this._sock.onopen = () => {
            DEBUG('WebSocket connection open');
            this._onOpen();
        };
        this._sock.onerror = () => {
            DEBUG('WebSocket connection got error');
        };
        this._sock.onclose = (event) => {
            DEBUG('WebSocket connection closed: %d: (reason=\"%s\", clean=%s)', event.code, event.reason, event.wasClean);
            this._onClose();
        };
        this._sock.onmessage = (event) => {
            DEBUG('WenSocket received message: %o', event);
            this._onMessage(event);
        };
    }

    _sendRequest(req, cb) {
        const transaction = uuid.v4();
        req.transaction = transaction;
        if (!this._ready) {
            setImmediate(() => {
                cb(new Error('Connection is not ready'));
            });
            return;
        }
        this._requests.set(transaction, {req: req, cb: cb});
        this._sock.send(JSON.stringify(req));
    }

    // WebSocket callbacks

    _onOpen() {
        clearTimeout(this._timer);
        this._timer = null;
        this._delay = INITIAL_DELAY;
    }

    _onClose() {
        this._ready = false;
        this._sock = null;
        if (!this._closed) {
            this._delay = this._delay * 2;
            if (this._delay > Number.MAX_VALUE) {
                this._delay = INITIAL_DELAY;
            }
            DEBUG('Retrying connection in %s seconds', this._delay / 1000);
            this._timer = setTimeout(() => {
                this._connect();
            }, this._delay);
        }
        this.emit('disconnected');
    }

    _onMessage(event) {
        let message = JSON.parse(event.data);
        if (typeof message.sylkrtc === 'undefined') {
            DEBUG('Unrecognized message received');
            return;
        }

        DEBUG('Received \"%s\" message: %o', message.sylkrtc, message);

        if (message.sylkrtc === 'event') {
            switch (message.event) {
                case 'ready':
                    this._ready = true;
                    this.emit('ready');
                    break;
                default:
                    break;
            }
        } else if (message.sylkrtc === 'account_event') {
            let acc = this._accounts.get(message.account);
            if (!acc) {
                DEBUG('Account %s not found', message.account);
                return;
            }
            acc._handleEvent(message);
        } else if (message.sylkrtc === 'session_event') {
            const sessionId = message.session;
            for (let acc of this._accounts.values()) {
                let call = acc._calls.get(sessionId);
                if (call) {
                    call._handleEvent(message);
                    break;
                }
            }
        } else if (message.sylkrtc === 'ack' || message.sylkrtc === 'error') {
            const transaction = message.transaction;
            const data = this._requests.get(transaction);
            if (!data) {
                DEBUG('Could not find transaction %s', transaction);
                return;
            }
            this._requests.delete(transaction);
            DEBUG('Received \"%s\" for request: %o', message.sylkrtc, data.req);
            if (data.cb) {
                if (message.sylkrtc === 'ack') {
                    data.cb(null);
                } else {
                    data.cb(new Error(message.error));
                }
            }
        }
    }

}


export { Connection };