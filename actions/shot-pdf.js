/**
 * actions/shot-pdf
 */

const fsp = require('fs-extra');

const ShotAction = require('./shot');

class ShotPdf extends ShotAction {
    async main(page) {
        const cfg = this.config;
        const result = {
            pdf: null
        };

        this.log(`page.pdf`, {
            pdfOptions: cfg.pdfOptions
        });

        result.pdf = await page.pdf(cfg.pdfOptions);

        this.log(`page.pdf.done`, {
            pdfBufferLength: result.pdf.length
        });

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
