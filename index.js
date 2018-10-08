/**
 * index
 */

// env
require('./env');

// deps
const Koa = require('koa');
const path = require('path');
const Router = require('koa-router');
const favicon = require('koa-favicon');
const onerror = require('koa-onerror');
const bodyParser = require('koa-bodyparser');

// logger
const logger = require('./services/logger');

// init app, whit proxy
const app = new Koa();

app.proxy = true;

// bodyParser
app.use(bodyParser({
    formLimit: '1mb',
    jsonLimit: '1mb'
}));

// 404
app.use(async(ctx, next) => {
    await next();

    if(ctx.status === 404 && ctx.body === undefined) {
        ctx.throw(404);
    }
});

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

    const body = ctx.req.body || ctx.request.body;
    err.data = {
        url: ctx.url,
        method: ctx.method,
        query: ctx.request.query,
        body: body ? JSON.stringify(body) : null,
        status: err.status || err.statusCode || ctx.status,
        meta: meta ? JSON.stringify(meta) : null,
        referer: ctx.get('Referer'),
        ua: ctx.get('User-Agent'),
        ip: ctx.ip
    };

    logger.error(err, err.data);
});

// favicon, maxAge, 1 month
const WWW_FAVICON = path.join(__dirname, process.env.WWW_FAVICON);
app.use(favicon(WWW_FAVICON, {
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


// startup
app.start = (port = process.env.PORT, host = process.env.IP) => {
    host = host || '0.0.0.0';
    port = +port || 3009;

    app.port = port;
    app.listen(app.port, host, () => {
        // ready message
        if(process.send) {
            process.send('ready');
        }

        logger.info('Server Start...', {
            www: 'http://' + process.env.WWW_HOST,
            port: port
        });
    });
};

// process.crash log
process.on('uncaughtException', ex => {
    logger.info(`app.crashed: ${ex.stack || ex.message}`);
    logger.error(ex);

    process.exit(1);
});

// Run as a server
if(require.main === module) {
    app.start();
}


// exports
module.exports = app;
