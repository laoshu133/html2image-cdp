/**
 * actions/shot-pdf
 */

const fsp = require('fs-extra');
const Promise = require('bluebird');

// const pxToMM = require('../lib/px-to-mm');
const ShotAction = require('./shot');

class ShotPdf extends ShotAction {
    async main() {
        const page = this.page;
        const cfg = this.config;
        const pdfOptions = cfg.pdfOptions;
        const result = {
            pdf: null
        };

        this.log(`page.pdf`, {
            pdfOptions: cfg.pdfOptions
        });

        if(!pdfOptions.width && !pdfOptions.height) {
            const elem = await page.$(cfg.wrapSelector);
            const rect = await elem.boundingBox();

            const width = rect.width;
            const height = rect.height;

            // pdfOptions.width = `${pxToMM(width)}mm`;
            // pdfOptions.height = `${pxToMM(height) + 0.05}mm`;

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
        .timeout(cfg.screenshotTimeout, 'Take pdf timeout');

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
