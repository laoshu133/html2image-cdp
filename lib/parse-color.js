/**
 * parse-color
 */

const lodash = require('lodash');
const parseHexInt = function(inp) {
    return parseInt(inp, 16) || 0;
};

module.exports = function(inp) {
    const type = typeof inp;
    const ret = {
        r: 0,
        g: 0,
        b: 0,
        a: 255
    };

    if(type === 'string') {
        inp = inp.replace(/^(?:#|0x)/, '');

        if(inp.length <= 4) {
            inp = inp.replace(/(\w)/g, '$1$1');
        }

        ret.r = parseHexInt(inp.slice(0, 2));
        ret.g = parseHexInt(inp.slice(2, 4));
        ret.b = parseHexInt(inp.slice(4, 6));

        if(inp.length >= 8) {
            ret.a = parseHexInt(inp.slice(6, 8));
        }
    }
    else if(type === 'object') {
        lodash.forEach(ret, (v, k) => {
            if(lodash.has(inp, k)) {
                ret[k] = +v || 0;
            }
        });
    }

    return ret;
};
