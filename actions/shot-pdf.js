/**
 * actions/shot-pdf
 */

const fsp = require('fs-extra');
const Promise = require('bluebird');

const ShotAction = require('./shot');

// TODO: Don't know why
// https://bugs.chromium.org/p/chromium/issues/detail?id=741049
const CHROME_DEFAULT_API = 937;

class ShotPdf extends ShotAction {
    async main() {
        const page = this.page;
        const cfg = this.config;
        const pdfOptions = cfg.pdfOptions;
        const result = {
            pdf: null,
            scale: 1
        };

        const dpi = pdfOptions.dpi || 300;
        if(dpi !== CHROME_DEFAULT_API) {
            result.scale = dpi / CHROME_DEFAULT_API;

            pdfOptions.scale = result.scale;
        }

        this.log(`page.pdf`, {
            pdfOptions
        });

        if(!pdfOptions.width && !pdfOptions.height) {
            const elem = await page.$(cfg.wrapSelector);
            const rect = await elem.boundingBox();

            const width = rect.width * result.scale;
            const height = rect.height * result.scale;

            // @TODO: 未知原因，需要增加偏移，否则会多出一页
            pdfOptions.height = Math.round(height) + 1;
            pdfOptions.width = Math.round(width);

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
