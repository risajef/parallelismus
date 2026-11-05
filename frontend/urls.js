const configuredBase = globalThis.window?.__PARALLELISMUS_BASE__;
const base = configuredBase || new URL('./', globalThis.document?.currentScript?.src || globalThis.location?.href || 'http://localhost/').href;
export function pageUrl(name, hash = '') {
    const url = new URL(name, base);
    url.hash = hash;
    return url.href;
}
export function strongUrl(strong) { return pageUrl('strong.html', encodeURIComponent(strong)); }
