/**
 * render-readme
 */

const fsp = require('fs-extra');
const lodash = require('lodash');

const pkgs = require('../package.json');

const rKeys = /\{\{(\w+)\}\}/g;
const readmeTpl = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>{{title}}</title></head><body><pre>{{content}}</pre></body></html>';

module.exports = function(readmePath = `${__dirname}/../README.md`, data) {
    return fsp.readFile(readmePath)
    .then(buf => {
        const readmeData = lodash.defaults(data, {
            title: `Guide - ${pkgs.name}`,
            content: buf.toString()
        });

        return readmeTpl.replace(rKeys, (a, k) => {
            return readmeData[k] || '';
        });
    });
};
