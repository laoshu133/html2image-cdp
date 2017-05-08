/**
 * pretty-date
 */

const rSingleNum = /\b(\d)\b/g;

module.exports = function(date) {
    return [
        date.getFullYear() + '/',
        date.getMonth() + 1 + '/',
        date.getDate() + ' ',
        date.getHours() + ':',
        date.getMinutes() + ':',
        date.getSeconds()
    ]
    .join('')
    .replace(rSingleNum, '0$1');
};
