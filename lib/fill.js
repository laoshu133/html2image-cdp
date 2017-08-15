/**
 * fill
 */

const rBlock = /\{\{(\w+)\}\}/g;

module.exports = function(tpl, data = {}) {
    return String(tpl).replace(rBlock, (a, k) => {
        return (k in data) ? data[k] : a;
    });
};
