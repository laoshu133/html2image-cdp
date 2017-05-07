/**
 * config
 *
 */

const path = require('path');
const lodash = require('lodash');
const fsp = require('fs-promise');
const Promise = require('bluebird');

// const tools = require('../lib/tools');
const tools = {};

// default config
const defaultConfig = require('../config.default');

const config = {
    uuid: 0,
    defaultConfig: defaultConfig,
    getCurrentConfig: function() {
        if(this.currentConfig) {
            return Promise.resolve(this.currentConfig);
        }

        // local config
        let localConfig = path.join(__dirname, '../config.json');

        return fsp.exists(localConfig)
        .then(exists => {
            return exists ? fsp.readFile(localConfig) : null;
        })
        .then(buf => {
            return JSON.parse(buf);
        })
        .then(config => {
            config = lodash.merge({}, this.defaultConfig, config);

            this.currentConfig = config;

            return config;
        });
    },
    create: function(cfg) {
        return this.getCurrentConfig()
        .then(currCfg => {
            return lodash.merge({}, currCfg, cfg);
        })
        .then(cfg => {
            let action = cfg.action || 'shot';

            // id
            if(!cfg.id) {
                cfg.id = [action, Date.now(), ++this.uuid].join('_');
            }

            // viewport
            let viewport = cfg.viewport;
            if(viewport && typeof viewport === 'string') {
                viewport = viewport.replace(/[\[\]]/, '').split(',');

                cfg.viewport = [
                    +viewport[0] || 1920,
                    +viewport[1] || 1200
                ];
            }

            return cfg;
        });
    },
    processContent: Promise.method(function(cfg) {
        // processed
        if(cfg.out) {
            return cfg;
        }

        let imgExtMap = {
            'jpeg': '.jpg',
            'jpg': '.jpg',
            'png': '.png'
        };

        let imgExt = cfg.imageExtname;
        if(!imgExt) {
            imgExt = imgExtMap[cfg.imageType || 'png'];
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
            // name: '',
            path: outPath,
            dirname: outDir,
            html: path.join(outPath, outName + '.html'),
            image: path.join(outPath, outName + imgExt)
        };

        // url
        let url = cfg.url;
        let rAbsUrl = /^\w+:\/\//;

        // whitout content, padding url
        if(!cfg.content && url && !rAbsUrl.test(url)) {
            cfg.url = 'http://' + url;
        }

        // content
        if(cfg.content) {
            let tplName = String(cfg.htmlTpl || 'default').trim();

            // Filter
            tplName = tplName.replace(/\.html$/, '').replace(/[^\w]/g, '');
            tplName += '.html';

            let htmlTplPath = path.join(cwd, 'static/tpl', tplName);

            return fsp.exists(htmlTplPath)
            .then(exists => {
                if(!exists) {
                    throw new Error('Template not exists: ' + tplName);
                }

                return fsp.readFile(htmlTplPath);
            })
            .then(htmlTpl => {
                let content = tools.processHTML(cfg.content);
                let html = tools.fill(htmlTpl, {
                    content: content
                });

                url = path.join(outPath, 'out.html');

                return fsp.outputFile(url, html);
            })
            .then(() => {
                cfg.url = url;

                return cfg;
            });
        }

        return cfg;
    })
};

module.exports = config;
