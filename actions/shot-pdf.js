/**
 * actions/shot-pdf
 */

const fsp = require('fs-extra');
const Promise = require('bluebird');

const ShotAction = require('./shot');

// TODO: Don't know why
// https://bugs.chromium.org/p/chromium/issues/detail?id=741049
const CHROME_DEFAULT_API = 937;

const PDF_DEFAULT_DPI = 300;

class ShotPdf extends ShotAction {
    async main() {
        const page = this.page;
        const cfg = this.config;
        const pdfOptions = cfg.pdfOptions;
        const pdfDPI = pdfOptions.dpi || 300;
        const result = {
            scale: cfg.dpi / PDF_DEFAULT_DPI,
            dpiScale: pdfDPI / CHROME_DEFAULT_API,
            pdfScale: 1,
            pdf: null
        };

        if(result.scale !== 1 || result.dpiScale !== 1) {
            pdfOptions.scale = result.dpiScale / result.scale;

            // Limit scale is outside [0.1 - 2]
            pdfOptions.scale = Math.max(0.1, Math.min(2, pdfOptions.scale));

            result.pdfScale = pdfOptions.scale;
        }

        this.log(`page.pdf`, {
            pdfOptions,
            ...result
        });

        if(!pdfOptions.width && !pdfOptions.height) {
            const elem = await page.$(cfg.wrapSelector);
            const rect = await elem.boundingBox();
            const scale = pdfOptions.scale;

            const width = rect.width * scale;
            const height = rect.height * scale;

            // @TODO: 未知原因，需要增加偏移，否则会多出一页
            pdfOptions.height = Math.ceil(height) + 1;
            pdfOptions.width = Math.ceil(width);

            this.log('page.pdf.getPageSize.done', {
                height: pdfOptions.height,
                width: pdfOptions.width
            });
        }

        result.pdf = await Promise.try(() => {
            return page.pdf(pdfOptions);
        })
        .timeout(cfg.screenshotTimeout, 'Capture pdf timeout');

        this.log(`page.pdf.done`, {
            pdfBufferLength: result.pdf.length
        });

        // Release client asap
        await this.release();

        // Save pdf, skip if dataType is pdf
        if(cfg.dataType !== 'pdf') {
            const pdfPath = cfg.out.pdf;

            await fsp.outputFile(cfg.out.pdf, result.pdf);

            result.pdf = pdfPath;
        }

        this.result = result;
    }
}

module.exports = ShotPdf;
