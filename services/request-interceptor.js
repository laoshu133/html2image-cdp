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
            ret.url = newUrl;
        }

        return ret;
    });
}

const requestInterceptor = {
    interceptors: defaultInterceptors,

    hasInterception() {
        return !!(this.interceptors && this.interceptors.length);
    },

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

            const headers = ret.headers = req.headers() || {};

            // Force set X-Real-URL for debug
            headers['X-Real-URL'] = req.url();

            // Force set Origin for cors request
            if(!headers['origin']) {
                const rOrigin = /^\w+:\/\/([^/?&]+)/;
                const pageURL = req.frame().url() || headers['referer'] || '';
                const pageOrigin = rOrigin.test(pageURL) ? RegExp.$1 : 'http://localhost';

                headers['origin'] = pageOrigin;
            }

            return req.continue(ret);
        }

        return req.abort('blockedbyclient');
    }
};

module.exports = requestInterceptor;
