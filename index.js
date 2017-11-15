/**
 * index
 */

// env
require('./env');

// deps
const Koa = require('koa');
const Router = require('koa-router');
const favicon = require('koa-favicon');
const onerror = require('koa-onerror');
const path = require('path');

// logger
const logger = require('./services/logger');
const exitHandler = require('./services/exit-handler');

// init app, whit proxy
const app = new Koa();
app.proxy = true;

// parse request body
app.use(require('koa-bodyparser')());

// 404
app.use(function *(next) {
    yield * next;

    if(this.status === 404 && this.body === undefined) {
        this.throw(404);
    }
});

// favicon
const WWW_FAVICON = path.join(__dirname, process.env.WWW_FAVICON);
app.use(favicon(WWW_FAVICON, {
    // maxAge, 1 month
    maxAge: 30 * 24 * 60 * 60 * 1000
}));

// init router
app.router = new Router();

// controllers
require('./controllers/index').forEach(ctrlFactory => {
    ctrlFactory(app.router, app);
});

// use routers
app.use(app.router.routes());


// Error handle
app.handleError = function(err, ctx) {
    let data = err.data || {};
    let statusCode = err.status;

    ctx.status = statusCode || 500;
    data.status = ctx.status;

    if(!data.message) {
        data.message = err.message;
    }

    if(app.env === 'development') {
        data.stack = err.stack.split('\n');
    }

    return data;
};
onerror(app, {
    accepts() {
        let type = this.accepts(['json', 'html']);

        if(type !== 'html') {
            type = 'json';
        }

        return type;
    },
    json(err) {
        const data = app.handleError(err, this);

        this.body = data;
    },
    html(err) {
        const data = app.handleError(err, this);

        this.body = `<!DOCTYPE html><html>
            <head><meta charset="UTF-8"/><title>${this.status} ${err.message}</title></head><body>
            <h1>[${this.status}] ${err.message}</h1><p><pre>${JSON.stringify(data, null, 2)}</pre></p>
            </body></html>`;
    }
});

// Error report
app.on('error', (err, ctx) => {
    let meta = err.data;

    // axios request error
    let response = err.response;
    if(response) {
        meta = response.data;

        if(meta) {
            err.message += ': ' + meta.message;
        }
    }

    err.data = {
        url: ctx.url,
        method: ctx.method,
        status: err.status || err.statusCode || ctx.status,
        meta: meta ? JSON.stringify(meta) : null,
        referer: ctx.get('Referer'),
        ua: ctx.get('User-Agent'),
        ip: ctx.ip
    };

    logger.error(err, err.data);
});

// defalut exit handler
const exitWithCleanupHandler = exitHandler.bind(null, {
    skipClean: false
});

// process crash
process.on('uncaughtException', exitWithCleanupHandler);

// Ctrl+C
process.on('SIGINT', exitWithCleanupHandler);

// // catches "kill pid" (for example: nodemon restart)
// process.on('SIGUSR1', exitWithCleanupHandler);
// process.on('SIGUSR2', exitWithCleanupHandler);

// exit event
process.on('exit', exitWithCleanupHandler);


// startup
const port = process.env.PORT || 3007;

app.listen(port);
logger.info('Server Start...', {
    port: port,
    www: 'http://' + process.env.WWW_HOST
});

// exports
module.exports = app;
