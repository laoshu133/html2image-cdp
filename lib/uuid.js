/**
 * uuid
 */

const rndStr = require('./random-string');

let _uid = 0;

const uuid = (len = 6, prepadding = true) => {
    const uidSub = `_${++_uid}`;
    const retLen = prepadding ? len + uidSub.length : len;

    return (rndStr(len) + uidSub).slice(-retLen);
};

module.exports = uuid;
