/**
 * pxToMM
 */

const DEFAULT_RATIO = 3.779528;

const pxToMM = (n = 0, ratio = DEFAULT_RATIO) => {
    return n / ratio;
};

module.exports = pxToMM;
