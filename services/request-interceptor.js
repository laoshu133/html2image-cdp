/**
 * services/request-interceptor
 *
 */

const { isEmpty } = require('lodash');

const SHOT_HOSTS_MAP = process.env.SHOT_HOSTS_MAP || '';
const hostsMap = SHOT_HOSTS_MAP.split(/,+/)
.map(str => {
    const arr = str.split(/[@#]/);

    return {
        key: (arr[0] || '').trim(),
        value: (arr[1] || '').trim()
    };
})
.filter(item => {
    return !!item.key;
})
.reduce((ret, item) => {
    ret[item.key] = item.value;

    return ret;
}, {});

// default interceptors
const defaultInterceptors = [];

if(!isEmpty(hostsMap)) {
    const rHost = /^(\w+):\/\/([^/]+)/;

    defaultInterceptors.push(req => {
        // Defualt return null to continue next interceptor
        let ret = null;

        const url = req.url();
        const newUrl = url.replace(rHost, (a, protocol, host) => {
            if(hostsMap.hasOwnProperty(host)) {
                // Return false to break interceptor chain
                ret = hostsMap[host] ? { url: '' } : false;

                return `${protocol}://${hostsMap[host]}`;
            }

            return '';
        });

        if(ret) {
            ret.intercepted = newUrl !== url;
            ret.url = newUrl;
        }

        return ret;
    });
}

class Interceptor {
    constructor(page, interceptors = defaultInterceptors) {
        this.interceptors = interceptors || [];
        this.page = page;
    }

    async setup() {
        if(!this.hasInterception()) {
            return false;
        }

        const page = this.page;
        const requestHandler = req => {
            return this.interceptRequest(req);
        };

        // RequestInterception
        await page.setRequestInterception(true);

        // Try re-enable page caching
        await page.setCacheEnabled(true);

        // Intercept request
        page.on('request', requestHandler);
        page.once('close', () => {
            page.off('request', requestHandler);
        });
    }

    hasInterception() {
        return !!(this.interceptors && this.interceptors.length);
    }

    async interceptRequest(req) {
        let ret = null;

        for(let interceptor of this.interceptors) {
            ret = await interceptor(req);

            if(ret !== null) {
                break;
            }
        }

        if(ret !== false) {
            ret = ret || {};

            // Reset request headers if need
            if(ret.intercepted) {
                const reqURL = req.url() || '';
                const headers = req.headers() || {};

                // Force set origin for cors request
                const frame = req.frame && req.frame();
                if(!headers['origin'] && frame) {
                    const rOrigin = /^(\w+:\/\/[^/?&]+)/;
                    const pageURL = frame.url() || headers['referer'] || '';
                    const pageOrigin = rOrigin.test(pageURL) ? RegExp.$1 : 'http://localhost';

                    headers['origin'] = pageOrigin;
                }

                // Force set accept for cors request
                if(!headers['accept']) {
                    headers['accept'] = 'text/html,image/avif,image/webp,image/apng,*/*';
                }

                // Force set X-Real-URL for debug
                if(reqURL.indexOf('data:') !== 0) {
                    headers['X-Real-URL'] = reqURL;
                }

                // Assign request headers
                ret.headers = headers;
            }

            return req.continue(ret);
        }

        return req.abort('blockedbyclient');
    }
}

const requestInterceptor = {
    async isAllowIntercept(page) {
        const url = page ? page.url() : '';

        if(!url || url.indexOf('data:') === 0) {
            return false
        }

        return true;
    },

    async setupInterceptor(page, interceptors = defaultInterceptors) {
        const interceptor = new Interceptor(page, interceptors);

        page.requestInterceptor = interceptor;

        return await interceptor.setup();
    }
};

module.exports = requestInterceptor;
