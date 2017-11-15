/**
 * uid
 */

const crypto = require('crypto');

module.exports = (len = 5) => {
    const n = Math.ceil(len / 2);
    const tmpStr = crypto.randomBytes(n).toString('hex');

    return tmpStr.slice(0, len);
};
