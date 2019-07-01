/**
 * pxToMM
 */

const DEFAULT_DPI = 96;
const INCH_TO_MM_RATIO = 25.4;

const pxToMM = (n = 0, dpi = DEFAULT_DPI) => {
    const ratio = dpi / INCH_TO_MM_RATIO;

    return n / ratio;
};

module.exports = pxToMM;
