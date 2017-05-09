/**
 * fill
 */

module.exports = function(tpl, data) {
    let ret = String(tpl);

    for(let k in data) {
        let re = new RegExp('\\{' + k + '\\}', 'g');

        ret = ret.replace(re, data[k] || '');
    }

    return ret;
};
