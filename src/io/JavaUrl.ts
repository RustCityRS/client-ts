// The game constructs java.net.URL values before passing them to the applet.
// Keep the Java external form until navigation crosses into the browser.
const protocols = new Set(['http', 'https', 'ftp', 'file', 'jar', 'jrt', 'jmod', 'mailto']);

function relativePath(path: string, jar: boolean): string {
    if (!jar) while (path.includes('/./')) path = path.replace('/./', '/');
    let from = 0;
    while (true) {
        const parent = path.indexOf('/../', from);
        if (parent === -1) break;
        const previous = path.lastIndexOf('/', parent - 1);
        if (parent > 0 && previous >= 0 && (jar || path.indexOf('/../', previous) !== 0)) {
            path = path.slice(0, previous) + path.slice(parent + 3);
            from = 0;
        } else if (jar) {
            path = path.slice(parent + 3);
        } else {
            from = parent + 3;
        }
    }
    if (jar) while (path.includes('/./')) path = path.replace('/./', '/');
    while (path.endsWith('/..')) {
        const parent = path.indexOf('/..');
        const previous = parent > 0 ? path.lastIndexOf('/', parent - 1) : -1;
        if (previous < 0 && !jar) break;
        path = path.slice(0, previous < 0 ? parent : previous + 1);
    }
    if (!jar && path.startsWith('./') && path.length > 2) path = path.slice(2);
    return path.endsWith('/.') ? path.slice(0, -1) : path;
}

function checkAuthority(authority: string): void {
    for (let i = 0; i < authority.length; i++) {
        const code = authority.charCodeAt(i);
        if (code < 32 || code === 127) throw new TypeError('Invalid URL authority');
    }
    if (/[#/?\\]/.test(authority)) throw new TypeError('Invalid URL authority');
    const at = authority.indexOf('@');
    // URLStreamHandler leaves host empty for an authority with several @ signs.
    if (at !== authority.lastIndexOf('@')) return;
    if (at >= 0 && /[[\]]/.test(authority.slice(0, at))) throw new TypeError('Invalid URL user info');
    let host = authority.slice(at + 1);
    let port: string | undefined;
    if (host.startsWith('[')) {
        const end = host.indexOf(']');
        if (end <= 2) throw new TypeError('Invalid IPv6 address');
        const rest = host.slice(end + 1);
        if (rest.length && rest[0] !== ':') throw new TypeError('Invalid URL authority');
        port = rest.slice(1);
        const ip = host.slice(1, end),
            zone = ip.indexOf('%');
        if (zone === ip.length - 1) throw new TypeError('Missing IPv6 zone');
        new URL('http://[' + (zone < 0 ? ip : ip.slice(0, zone)) + ']');
    } else {
        const colon = host.indexOf(':');
        if (colon >= 0) {
            port = host.slice(colon + 1);
            host = host.slice(0, colon);
        }
        if (/[ "<>[\]{}|^\x60\u2047-\u2049\u2100\u2101\u2105\u2106\u2a74\ufe55\ufe56\ufe5f\ufe6b\uff03\uff0f\uff1a\uff1f\uff20]/.test(host)) {
            throw new TypeError('Invalid URL host');
        }
    }
    if (port && (!/^[+-]?\d+$/.test(port) || Number(port) < -1 || Number(port) > 2147483647)) throw new TypeError('Invalid URL port');
}

export default class JavaUrl {
    private constructor(
        private protocol: string,
        private authority: string | null,
        private path: string,
        private query: string | null,
        private ref: string | null
    ) {}

    static parse(spec: string, context: JavaUrl | null = null): JavaUrl {
        let first = 0;
        let last = spec.length;
        while (first < last && spec.charCodeAt(first) <= 32) first++;
        while (last > first && spec.charCodeAt(last - 1) <= 32) last--;
        let input = spec.slice(first, last).replace(/^url:/i, '');
        const match = /^([a-z][a-z\d.+-]*):/i.exec(input);
        const protocol = match ? match[1].toLowerCase() : context?.protocol;
        if (!protocol || !protocols.has(protocol)) throw new TypeError('Unknown URL protocol');
        if (match) input = input.slice(match[0].length);
        if (match && (protocol !== context?.protocol || !context.path.startsWith('/'))) context = null;
        const hash = input.indexOf('#');
        let ref = hash < 0 ? null : input.slice(hash + 1);
        if (hash >= 0) input = input.slice(0, hash);
        if (protocol === 'file') input = input.replaceAll('\\', '/');
        if (protocol === 'mailto') {
            if (!input.trim()) throw new TypeError('No email address');
            return new JavaUrl(protocol, null, input, null, null);
        }
        if (protocol === 'jar') {
            let file = input;
            if (/^jar:/i.test(file)) throw new TypeError('Nested jar URL');
            if (match) {
                const marker = file.lastIndexOf('!/');
                if (marker < 0) throw new TypeError('Missing jar entry separator');
                JavaUrl.parse(file.slice(0, marker));
            } else {
                if (context === null) throw new TypeError('Missing jar context');
                const previous = context.path + (context.query === null ? '' : '?' + context.query);
                const marker = previous.lastIndexOf('!/') + 1;
                if (hash === 0) file = previous;
                else {
                    file = (input.startsWith('/') ? previous.slice(0, marker) : previous.slice(0, previous.lastIndexOf('/') + 1)) + input;
                    file = file.slice(0, marker) + relativePath(file.slice(marker), true);
                }
            }
            return new JavaUrl(protocol, null, file, null, ref);
        }
        let authority = context?.authority ?? null,
            path = context?.path ?? '';
        let query = input === '' ? (context?.query ?? null) : null;
        if (input === '' && ref === null) ref = context?.ref ?? null;
        const question = input.indexOf('?');
        if (question >= 0) {
            query = input.slice(question + 1);
            input = input.slice(0, question);
        }
        if (input.startsWith('//') && !input.startsWith('////')) {
            const slash = input.indexOf('/', 2);
            authority = input.slice(2, slash < 0 ? input.length : slash);
            checkAuthority(authority);
            input = slash < 0 ? '' : input.slice(slash);
            if (authority.length > 0) path = '';
        }
        if (input.startsWith('/')) path = input;
        else if (input !== '') {
            if (path !== '') {
                const slash = path.lastIndexOf('/');
                path = relativePath((slash < 0 && authority !== null ? '/' : path.slice(0, slash + 1)) + input, false);
            } else path = (authority === null ? '' : '/') + input;
        } else if (question === 0 && context !== null) {
            const slash = path.lastIndexOf('/');
            path = slash < 0 ? '/' : path.slice(0, slash + 1);
        }
        return new JavaUrl(protocol, authority, path, query, ref);
    }

    // java.net.URL.getHost()
    getHost(): string {
        const authority = this.authority;
        if (authority === null) return '';
        const at = authority.indexOf('@');
        if (at !== authority.lastIndexOf('@')) return '';
        const host = authority.slice(at + 1);
        if (host.startsWith('[')) return host.slice(0, host.indexOf(']') + 1);
        const colon = host.indexOf(':');
        return colon === -1 ? host : host.slice(0, colon);
    }

    toString(): string {
        return this.protocol + ':' + (this.authority ? '//' + this.authority : '') + this.path + (this.query === null ? '' : '?' + this.query) + (this.ref === null ? '' : '#' + this.ref);
    }
}
