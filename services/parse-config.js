/**
 * parse-config
 */

const path = require('path');
const fsp = require('fs-extra');
const lodash = require('lodash');
const Promise = require('bluebird');

const uuid = require('../lib/uuid');
const fill = require('../lib/fill');
const prettyDate = require('../lib/pretty-date');
const env = process.env;

const SHOT_HTML_TPL_PATH = path.resolve(__dirname, '..', env.SHOT_HTML_TPL_PATH);
const SHOT_IMAGE_MAX_HEIGHT = +env.SHOT_IMAGE_MAX_HEIGHT || 8000;
const SHOT_IMAGE_MAX_WIDTH = +env.SHOT_IMAGE_MAX_WIDTH || 8000;

// default, local config
const defaultConfig = require('../config.default');
const localConfig = path.join(__dirname, '../config.json');

const getLocalConfigPromise = Promise.try(() => {
    if(fsp.existsSync(localConfig)) {
        return fsp.readJSON(localConfig);
    }

    return null;
})
.then(config => {
    return lodash.merge({}, defaultConfig, config);
});

// Switch dir per 10 mins
const getCurrOutPath = (id = 'tmp') => {
    const now = Date.now();
    const interval = 30 * 60 * 1000;
    const prefixDir = String(Math.floor(now / interval));

    let outPath = process.env.OUT_PATH;
    if(outPath.charAt(0) !== '/') {
        outPath = path.resolve('.', outPath);
    }

    outPath = path.join(outPath, prefixDir, id);

    return outPath;
};

module.exports = cfg => {
    return Promise.try(() => {
        return getLocalConfigPromise;
    })
    .then(localCfg => {
        return lodash.merge({}, localCfg, cfg);
    })
    .then(cfg => {
        // Default action
        if(!cfg.action || cfg.action === 'makeshot') {
            cfg.action = 'shot';
        }

        // id
        if(!cfg.id) {
            const rNotNumber = /\D+/g;
            const nowStr = prettyDate(new Date());

            cfg.id = [
                cfg.action,
                nowStr.replace(rNotNumber, ''),
                uuid()
            ].join('_');
        }

        // Fix viewport
        let viewport = cfg.viewport || [];
        if(typeof viewport === 'string') {
            viewport = viewport.replace(/[[\]]/, '').split(',');
        }
        cfg.viewport = [
            +viewport[0] || 800,
            +viewport[1] || 600
        ];

        // wrapMaxCount
        cfg.wrapMaxCount = cfg.wrapMaxCount > 0
            ? +cfg.wrapMaxCount
            : 999;

        // Limit output type
        if(cfg.dataType === 'image') {
            cfg.wrapMaxCount = 1;
        }

        // Pdf limit
        if(cfg.action === 'shotpdf') {
            const pdfOptions = Object.assign({
                preferCSSPageSize: false,
                printBackground: true
            }, cfg.pdfOptions || {});

            delete pdfOptions.path;

            cfg.pdfOptions = pdfOptions;
        }
        else {
            cfg.imageQuality = parseInt(cfg.imageQuality, 10) || 80;

            // imageSize
            let imageSize = cfg.imageSize;
            if(imageSize && typeof imageSize === 'string') {
                let arr = imageSize.split(',');

                imageSize = {
                    height: +arr[1] || 0,
                    width: +arr[0] || 0
                };
            }

            cfg.imageSize = imageSize || null;
            cfg.maxImageWidth = SHOT_IMAGE_MAX_WIDTH;
            cfg.maxImageHeight = SHOT_IMAGE_MAX_HEIGHT;
        }

        return cfg;
    })
    // process out config
    .then(cfg => {
        if(cfg.out) {
            return cfg;
        }

        // out config
        const { id, action, imageType, imageExtname } = cfg;
        const outPath = getCurrOutPath(id);
        const outName = 'out';

        cfg.out = {
            path: outPath,
            metadata: {}
        };

        if(action === 'shotpdf') {
            cfg.out.pdf = path.join(outPath, outName + '.pdf');
        }
        else {
            const rJpeg = /\.?jpe?g$/i;
            const cfgImageType = imageType || imageExtname;
            const imgExt = rJpeg.test(cfgImageType) ? '.jpg' : '.png';

            cfg.out.imageType = imgExt === '.png' ? 'png' : 'jpeg';
            cfg.out.image = path.join(outPath, outName + imgExt);
        }

        return cfg;
    })
    // process url & content
    .then(cfg => {
        const rAbsUrl = /^\w+:\/\//;
        const url = cfg.url;

        // whitout content, padding url
        if(!cfg.content && url && !rAbsUrl.test(url)) {
            cfg.url = 'http://' + url;
        }

        if(!cfg.content) {
            return cfg;
        }

        const rHTMLExt = /\.html$/i;
        const tplName = cfg.htmlTpl || cfg.contentTemplate || 'default';
        const tplFileName = tplName.replace(rHTMLExt, '') + '.html';
        const tplPath = path.join(SHOT_HTML_TPL_PATH, tplFileName);

        return fsp.exists(tplPath)
        .then(exists => {
            if(!exists) {
                throw new Error('Template not exists: ' + tplName);
            }

            return fsp.readFile(tplPath);
        })
        .then(htmlTpl => {
            const html = fill(htmlTpl, cfg);

            cfg.contentTemplate = tplName;
            cfg.url = 'data:text/html;base64,' + Buffer.from(html).toString('base64');
            // cfg.url = 'data:text/html,' + html;
            // cfg.url = 'about:blank';
            // cfg.htmlContent = html;

            return cfg;
        });
    });
};
