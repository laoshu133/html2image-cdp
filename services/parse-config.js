/**
 * parse-config
 */

const path = require('path');
const lodash = require('lodash');
const fsp = require('fs-promise');
const Promise = require('bluebird');

const uid = require('../lib/uid');
const fill = require('../lib/fill');
const randomString = require('../lib/random-string');
const prettyDate = require('./pretty-date');

const SHOT_HTML_TPL_PATH = path.resolve(__dirname, '..', process.env.SHOT_HTML_TPL_PATH);

// default, local config
const defaultConfig = require('../config.default');
const localConfig = path.join(__dirname, '../config.json');

const getLocalConfigPromise = Promise.try(() => {
    return fsp.exists(localConfig);
})
.then(exists => {
    return exists ? fsp.readFile(localConfig) : null;
})
.then(buf => {
    return JSON.parse(buf);
})
.then(config => {
    return lodash.merge({}, defaultConfig, config);
});

// Switch dir per 10 mins
const getCurrOutPath = (id = 'tmp') => {
    const now = Date.now();
    const interval = 10 * 60 * 1000;
    const prefixDir = String(Math.floor(now / interval));

    let outPath = process.env.OUT_PATH;
    if(outPath.charAt(0) !== '/') {
        outPath = path.resolve('.', outPath);
    }

    outPath = path.join(outPath, prefixDir, id);

    return outPath;
};

module.exports = function(cfg) {
    return Promise.try(() => {
        return getLocalConfigPromise;
    })
    .then(localCfg => {
        return lodash.merge({}, localCfg, cfg);
    })
    .then(cfg => {
        const action = cfg.action || 'makeshot';

        // id
        if(!cfg.id) {
            const rndLen = 5;
            const notNumber = /[^\d]+/g;
            const nowStr = prettyDate(new Date());

            cfg.id = [
                action,
                nowStr.replace(notNumber, ''),
                randomString(rndLen),
                uid()
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

        // Fix skipImagesShot
        if(typeof cfg.skipImagesShot !== 'boolean') {
            cfg.skipImagesShot = cfg.skipImagesShot === 'true';
        }

        // Fix imageQuality
        cfg.imageQuality = parseInt(cfg.imageQuality, 10) || 80;

        // Fix imageSize
        let imageSize = cfg.imageSize;
        if(imageSize && typeof imageSize === 'string') {
            let arr = imageSize.split(',');

            imageSize = {
                height: +arr[1] || 0,
                width: +arr[0] || 0
            };
        }
        cfg.imageSize = imageSize || null;

        // Limit output type
        if(cfg.dataType === 'image') {
            cfg.wrapMaxCount = 1;
        }

        return cfg;
    })
    // process out config
    .then(cfg => {
        if(cfg.out) {
            return cfg;
        }

        const rJpeg = /\.?jpe?g$/i;

        let imgExt = '.png';
        if(rJpeg.test(cfg.imageType || cfg.imageExtname)) {
            imgExt = '.jpg';
        }

        // out config
        const outName = cfg.name || 'out';
        const outPath = getCurrOutPath(cfg.id);

        cfg.out = {
            path: outPath,
            imageType: imgExt === '.png' ? 'png' : 'jpeg',
            image: path.join(outPath, outName + imgExt),
            metadata: {}
        };

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
