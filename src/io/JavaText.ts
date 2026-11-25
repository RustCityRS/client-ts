// The reference JVM's default charset is UTF-8. Java replaces an isolated
// UTF-16 surrogate with '?' when encoding and a surrogate byte sequence with
// one replacement character when decoding.
export function utf8Bytes(value: string): Uint8Array {
    return new TextEncoder().encode(value.replace(/[\uD800-\uDFFF]/gu, '?'));
}

export function utf8String(bytes: Uint8Array | null, offset: number, length: number): string {
    if (bytes === null) throw new TypeError('Null byte array');
    if (offset < 0 || length < 0 || offset > bytes.length - length) throw new RangeError('String byte range');
    const end = offset + length;
    let text = '',
        start = offset;
    const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
    for (let i = offset; i + 1 < end; i++) {
        if (bytes[i] === 0xed && bytes[i + 1] >= 0xa0 && bytes[i + 1] <= 0xbf) {
            text += decoder.decode(bytes.subarray(start, i)) + '\ufffd';
            i += i + 2 < end && (bytes[i + 2] & 0xc0) === 0x80 ? 2 : 1;
            start = i + 1;
        }
    }
    return text + decoder.decode(bytes.subarray(start, end));
}

// java.lang.Integer.parseInt(String), base ten. Java's char overload accepts BMP decimal digits.
export function parseJavaInt(text: string | null): number {
    if (text === null || text.length === 0) throw new RangeError('Invalid decimal integer');
    const negative = text[0] === '-';
    let pos = negative || text[0] === '+' ? 1 : 0;
    if (pos === text.length) throw new RangeError('Invalid decimal integer');
    let number = 0;
    const limit = negative ? 2147483648 : 2147483647;
    for (; pos < text.length; pos++) {
        const code = text.charCodeAt(pos);
        let digit = code - 48;
        if (digit < 0 || digit > 9) {
            if (!/\p{Nd}/u.test(text[pos])) throw new RangeError('Invalid decimal integer');
            let first = code;
            while (first > 0 && /\p{Nd}/u.test(String.fromCharCode(first - 1))) first--;
            digit = (code - first) % 10;
        }
        number = number * 10 + digit;
        if (number > limit) throw new RangeError('Integer overflow');
    }
    return (negative ? -number : number) | 0;
}
