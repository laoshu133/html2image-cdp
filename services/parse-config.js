/**
 * parse-config
 */

const path = require('path');
const lodash = require('lodash');
const fsp = require('fs-promise');
const Promise = require('bluebird');

const fill = require('../lib/fill');
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

// uuid
let uuid = 0;

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
            const notNumber = /[^\d]+/g;
            const nowStr = prettyDate(new Date());

            cfg.id = [
                action,
                nowStr.replace(notNumber, ''),
                ++uuid
            ].join('_');
        }

        // Fix viewport
        let viewport = cfg.viewport || [];
        if(typeof viewport === 'string') {
            viewport = viewport.replace(/[[\]]/, '').split(',');
        }
        cfg.viewport = [
            +viewport[0] || 1920,
            +viewport[1] || 1200
        ];

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
        let cwd = '.';
        let outDir = cfg.id || 'tmp';
        let outName = cfg.name || 'out';

        let outPath = process.env.OUT_PATH;
        if(outPath.charAt(0) !== '/') {
            outPath = path.join(cwd, outPath);
        }
        outPath = path.join(outPath, outDir);

        cfg.out = {
            path: outPath,
            dirname: outDir,
            html: path.join(outPath, outName + '.html'),
            image: path.join(outPath, outName + imgExt)
        };

        return cfg;
    })
    // process content
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

        cfg.url = path.join(cfg.out.path, 'out.html');

        // html tpl
        const htmlTpl = String(cfg.htmlTpl || 'default').trim();

        // Filter
        let tplName = htmlTpl.replace(/\.html$/, '');
        tplName = tplName.replace(/[^\w]/g, '');
        tplName += '.html';

        const htmlTplPath = path.join(SHOT_HTML_TPL_PATH, tplName);

        return fsp.exists(htmlTplPath)
        .then(exists => {
            if(!exists) {
                throw new Error('Template not exists: ' + tplName);
            }

            return fsp.readFile(htmlTplPath);
        })
        .then(htmlTpl => {
            const html = fill(htmlTpl, cfg);

            return fsp.outputFile(cfg.url, html);
        })
        .then(() => {
            return cfg;
        });
    });
};
