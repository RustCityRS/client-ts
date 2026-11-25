import { releaseReferences } from '#/util/StaticReferences';
import { glJar } from '#/client/ClientVariant';
import ArrayUtils from '#/util/ArrayUtils';
import { byteAt, putByte } from '#/io/JavaByteArray';
import JavaUrl from '#/io/JavaUrl';
import HashTable from './HashTable';
import StringNode from './StringNode';
import { arrayAtObj, requireNonNull } from '#/util/JavaArray';
import { utf8Bytes, utf8String } from '#/io/JavaText';
import { intDivide } from '#/util/IntUtils';
import WrappedException from '#/util/WrappedException';
import { isJavaRuntimeException } from '#/util/JavaException';
import type JStringMarker from './JStringMarker';
import { loadBrowserControl, loadClient, loadJavaError, loadLocalisedText, loadProtocol } from '#/util/GamepackClasses';

// Applet and LiveConnect operations exposed by the host.
export interface JagStringApplet {
    getParameter(name: string): string | null;
    call(name: string | null, args?: unknown[] | null): unknown;
    evaluate(script: string | null): void;
}

// uc.a(IZ)Z
function expands(c: number): boolean {
    return c === 198 || c === 230 || c === 156 || c === 140 || c === 223;
}

export default class JagString implements JStringMarker {
    // HD na.e(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'allocatedMemory');
            if (guard !== -8635) {
                releaseReferences(LocalisedText, 'allocatedMemory');
            }
            const Client = loadClient();
            releaseReferences(Client, 'soundEffectDelays');
            const Protocol = loadProtocol();
            releaseReferences(Protocol, 'allyReqSuffix');
            releaseReferences(LocalisedText, 'germanAttemptToReestablish', 'englishAllocatedMemory');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'na.R(' + guard + ')');
        }
    }

    // tf.B:[I
    static readonly collationOrder = Int32Array.of(
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        17,
        18,
        19,
        20,
        21,
        22,
        23,
        24,
        25,
        26,
        27,
        28,
        29,
        30,
        31,
        32,
        33,
        34,
        35,
        36,
        37,
        38,
        39,
        40,
        41,
        42,
        43,
        44,
        45,
        46,
        47,
        48,
        49,
        50,
        51,
        52,
        53,
        54,
        55,
        56,
        57,
        58,
        59,
        60,
        61,
        62,
        63,
        64,
        65,
        73,
        74,
        76,
        78,
        83,
        84,
        85,
        86,
        91,
        92,
        93,
        94,
        95,
        97,
        103,
        104,
        105,
        106,
        107,
        108,
        113,
        114,
        115,
        116,
        118,
        119,
        120,
        121,
        122,
        123,
        124,
        125,
        133,
        134,
        136,
        138,
        143,
        144,
        145,
        146,
        151,
        152,
        153,
        154,
        155,
        157,
        163,
        164,
        165,
        166,
        168,
        169,
        174,
        175,
        176,
        177,
        180,
        181,
        182,
        183,
        184,
        185,
        186,
        187,
        188,
        189,
        190,
        191,
        192,
        193,
        194,
        195,
        196,
        197,
        97,
        199,
        200,
        201,
        202,
        203,
        204,
        205,
        206,
        207,
        208,
        209,
        210,
        211,
        212,
        213,
        157,
        215,
        216,
        117,
        218,
        219,
        220,
        221,
        222,
        223,
        224,
        225,
        226,
        227,
        228,
        229,
        230,
        231,
        232,
        233,
        234,
        235,
        236,
        237,
        238,
        239,
        240,
        241,
        242,
        243,
        244,
        245,
        246,
        247,
        248,
        249,
        66,
        66,
        66,
        66,
        66,
        66,
        65,
        75,
        79,
        79,
        79,
        79,
        87,
        87,
        87,
        87,
        77,
        96,
        98,
        98,
        98,
        98,
        98,
        250,
        251,
        109,
        109,
        109,
        109,
        117,
        252,
        167,
        126,
        126,
        126,
        126,
        126,
        126,
        125,
        135,
        139,
        139,
        139,
        139,
        147,
        147,
        147,
        147,
        137,
        156,
        158,
        158,
        158,
        158,
        158,
        253,
        254,
        170,
        170,
        170,
        170,
        178,
        255,
        178
    );
    // rb.f:[B
    static readonly base37Alphabet = Uint8Array.from('_abcdefghijklmnopqrstuvwxyz0123456789', c => c.charCodeAt(0));

    // gi.t:Lnc;
    static internTable: HashTable<StringNode> | null = null;

    static empty2: JagString; // mc.O:Lid;
    static nullString2: JagString; // sd.S:Lid;
    static period: JagString; // je.R:Lid;
    static empty: JagString; // ga.J:Lid;
    static minusSign: JagString; // la.cb:Lid;
    static period2: JagString; // mk.H:Lid;
    static nullString: JagString; // j.g:Lid;
    static comma: JagString; // bj.g:Lid;
    static nbsp: JagString; // kh.x:Lid;
    static zero: JagString; // lg.I:Lid;

    // me.a(IZ)Z
    static isPrintable(c: number): boolean {
        return (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || c === 128 || c === 140 || c === 151 || c === 156 || c === 159;
    }

    // pa.f(II)Z
    static isAlphaNumeric(c: number): boolean {
        return (c >= 97 && c <= 122) || (c >= 65 && c <= 90) || (c >= 48 && c <= 57);
    }

    // qi.a(II)Z
    static isAlpha(c: number): boolean {
        return (c >= 97 && c <= 122) || (c >= 65 && c <= 90);
    }

    // uc.a(IB)Z
    static isDigit(c: number): boolean {
        return c >= 48 && c <= 57;
    }

    // ab.c(II)I
    static toLowerCaseChar(c: number): number {
        if ((c >= 65 && c <= 90) || (c >= 192 && c <= 222 && c !== 215)) return c + 32;
        if (c === 159) return 255;
        return c === 140 ? 156 : c;
    }

    // SD tb.a(IB)I / HD ld.a(IB)I
    static toUpperCaseChar(c: number, guard = 59): number {
        if ((c >= 97 && c <= 122) || (c >= 224 && c <= 254 && c !== 247)) return c - 32;
        if (c === 255) return 159;
        if (c === 156) return 140;
        if (guard !== 59) return 72;
        return c;
    }

    // ui.a(JIIBZ)Lid;
    static formatNumber(value: bigint, language: number, places: number, grouped: boolean): JagString {
        const sign = JagString.allocate(0);
        if (value < 0n) {
            value = BigInt.asIntN(64, -value);
            sign.append(JagString.minusSign);
        }
        let decimal = JagString.period2;
        let separator = JagString.comma;
        if (language === 1) {
            separator = JagString.period2;
            decimal = JagString.comma;
        }
        if (language === 2) {
            decimal = JagString.comma;
            separator = JagString.nbsp;
        }
        if (language === 3) {
            separator = JagString.period2;
            decimal = JagString.comma;
        }
        const fraction = JagString.allocate(0);
        for (let i = 0; i < places; i++) {
            fraction.append(JagString.fromInt(Number(value % 10n)));
            value /= 10n;
        }
        let integer: JagString;
        if (value === 0n) {
            integer = JagString.zero;
        } else {
            integer = JagString.allocate(0);
            for (let i = 0; value > 0n; i++) {
                if (grouped && i !== 0 && i % 3 === 0) integer.append(separator);
                integer.append(JagString.fromInt(Number(value % 10n)));
                value /= 10n;
            }
        }
        if (fraction.getLength() > 0) fraction.append(decimal);
        return JagString.join([sign, integer.reverse(), fraction.reverse()]);
    }

    // nl.b(IB)Lid;
    static fromCharCode(code: number): JagString {
        if (code > 0 && code <= 255) {
            const result = new JagString();
            result.length = 1;
            result.bytes = new Uint8Array(1);
            result.bytes[0] = code;
            return result;
        }
        throw new RangeError('Invalid character');
    }
    // id.c:I
    length = 0;
    // id.A:[B
    bytes: Uint8Array | null = null;
    // id.E:Z
    private mutable = true;

    // qc.a(IZ)Lid;
    static formatIpv4(address: number): JagString {
        return JagString.join([JagString.fromInt((address >>> 24) & 255), JagString.period, JagString.fromInt((address >>> 16) & 255), JagString.period, JagString.fromInt((address >>> 8) & 255), JagString.period, JagString.fromInt(address & 255)]);
    }

    // id.<init>()V
    constructor() {}

    // id.a(II)[Lid;
    split(separator: number): JagString[] {
        let count = 0;
        for (let i = 0; i < this.length; i++) {
            if (separator === (byteAt(this.bytes, i) << 24) >> 24) count++;
        }
        const parts = new Array<JagString>(count + 1);
        if (count === 0) {
            parts[0] = this;
            return parts;
        }
        let start = 0;
        for (let i = 0; i < count; i++) {
            let size = 0;
            while ((byteAt(this.bytes, start + size) << 24) >> 24 !== separator) size++;
            parts[i] = this.substring(start, start + size);
            start += 1 + size;
        }
        parts[count] = this.substring(start, this.length);
        return parts;
    }

    // id.a(B)Lid;
    reverse(): JagString {
        const result = new JagString();
        result.length = this.length;
        result.bytes = new Uint8Array(result.length);
        for (let i = 0; i < this.length; i++) result.bytes[this.length - i - 1] = byteAt(this.bytes, i);
        return result;
    }

    // id.a(BLjava/awt/FontMetrics;)I
    measure(metrics: { stringWidth(text: string): number } | null): number {
        const text = latin1String(this.bytes, 0, this.length);
        return requireNonNull(metrics).stringWidth(text);
    }

    // id.b(II)I
    charAt(index: number): number {
        return byteAt(this.bytes, index);
    }

    // id.b(I)Lid;
    formatName(start: number): JagString {
        let uppercase = true;
        const result = new JagString();
        result.length = this.length;
        result.bytes = new Uint8Array(this.length);
        for (let i = start; i < this.length; i++) {
            const c = byteAt(this.bytes, i);
            if (c === 95) {
                putByte(result.bytes, i, 32);
                uppercase = true;
            } else {
                putByte(result.bytes, i, c >= 97 && c <= 122 && uppercase ? c - 32 : c);
                uppercase = false;
            }
        }
        return result;
    }

    // id.b(B)J
    toBase37(): bigint {
        let value = 0n;
        for (let i = 0; i < this.length && i < 12; i++) {
            value *= 37n;
            const c = byteAt(this.bytes, i);
            if (c >= 65 && c <= 90) value += BigInt(c - 64);
            else if (c >= 97 && c <= 122) value += BigInt(c - 96);
            else if (c >= 48 && c <= 57) value += BigInt(c - 21);
        }
        while (value % 37n === 0n && value !== 0n) value /= 37n;
        return value;
    }

    // id.a(III)Lid;
    substring(start: number, end: number): JagString {
        const result = new JagString();
        result.bytes = new Uint8Array((end - start) | 0);
        result.length = (end - start) | 0;
        ArrayUtils.copyBytes(this.bytes, start, result.bytes, 0, result.length);
        return result;
    }

    // id.a(BI)Lid;
    substringFrom(start: number): JagString {
        return this.substring(start, this.length);
    }

    // SD id.a(Ljava/applet/Applet;B)Ljava/lang/Object;, HD na.a(ILjava/applet/Applet;)Ljava/lang/Object;
    callScript(applet: Pick<JagStringApplet, 'call'> | null, guard = glJar ? -1857 : 55): unknown {
        try {
            if (!glJar) intDivide(-33, intDivide(-50 - guard, 40));
            const name = utf8String(this.bytes, 0, this.length);
            // w's page-hook fields initialise JagStrings. Resolve w at the original invokestatic.
            const BrowserControl = loadBrowserControl();
            let value = BrowserControl.call(glJar ? -111 : -11594, applet, name);
            if (typeof value === 'string') {
                const bytes = utf8Bytes(value);
                value = JagString.fromBytes(bytes, 0, bytes.length);
            }
            if (glJar && guard !== -1857) this.setLength(116);
            return value;
        } catch (cause) {
            const JavaError = loadJavaError();
            if (!(cause instanceof Error) || cause instanceof JavaError) throw cause;
            const receiver = applet === null ? 'null' : '{...}';
            throw WrappedException.wrap(cause, glJar ? 'na.JA(' + guard + ',' + receiver + ')' : 'id.OA(' + receiver + ',' + guard + ')');
        }
    }

    // id.b(BI)I
    parseInt(radix: number): number {
        let negative = false,
            value = 0;
        if (radix < 1 || radix > 36) radix = 10;
        let hasDigit = false;
        for (let i = 0; i < this.length; i++) {
            let c = byteAt(this.bytes, i);
            if (i === 0 && c === 45) {
                negative = true;
                continue;
            }
            if (i === 0 && c === 43) continue;
            if (c >= 48 && c <= 57) c -= 48;
            else if (c >= 65 && c <= 90) c -= 55;
            else if (c >= 97 && c <= 122) c -= 87;
            else throw new Error('Invalid number');
            if (c >= radix) throw new Error('Invalid digit');
            if (negative) c = -c;
            const next = (Math.imul(radix, value) + c) | 0;
            if (value !== ((next / radix) | 0)) throw new Error('Integer overflow');
            hasDigit = true;
            value = next;
        }
        if (!hasDigit) throw new Error('Missing digits');
        return value;
    }

    // id.d(I)Lid;
    intern(): JagString {
        const hash = this.longHashCode();
        if (JagString.internTable !== null) {
            for (let node = JagString.internTable.get(hash); node !== null; node = JagString.internTable.nextWithKey()) {
                const value = node.value;
                if (value !== null && this.equals(value)) return value;
            }
        } else {
            JagString.internTable = new HashTable<StringNode>(4096);
        }
        const node = new StringNode();
        this.mutable = false;
        node.value = this;
        JagString.internTable.put(node, hash);
        return this;
    }

    // HD na.c(III)Lna;. tf.m() uses 40 as the middle argument.
    replaceChar(replacement: number, search: number): JagString {
        try {
            const from = search & 255;
            const result = new JagString();
            const to = replacement & 255;
            result.length = this.length;
            result.bytes = new Uint8Array(this.length);
            for (let i = 0; i < this.length; i++) {
                const value = byteAt(this.bytes, i);
                putByte(result.bytes, i, value === from ? to : value);
            }
            return result;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'na.HA(' + replacement + ',40,' + search + ')');
        }
    }

    // id.a(Lid;ZLid;)Lid;
    replace(needle: JagString, replacement: JagString): JagString {
        let size = this.length;
        const delta = (replacement.length - needle.length) | 0;
        let pos = 0;
        for (;;) {
            const match = this.indexOfFrom(needle, pos);
            if (match < 0) break;
            size = (size + delta) | 0;
            pos = (needle.length + match) | 0;
        }
        pos = 0;
        const result = JagString.allocate(size);
        for (;;) {
            const match = this.indexOfFrom(needle, pos);
            if (match < 0) {
                while (pos < this.length) result.appendChar(byteAt(this.bytes, pos++), 117);
                break;
            }
            while (pos < match) result.appendChar(byteAt(this.bytes, pos++), 125);
            result.append(replacement);
            pos = (pos + needle.length) | 0;
        }
        return result;
    }

    // id.a(IILid;I)Lid;
    appendRange(start: number, other: JagString, end: number): JagString {
        if (!this.mutable) throw new Error('Immutable JagString');
        if (start < 0 || start > end || end > other.length) throw new RangeError('String range');
        if (requireNonNull(this.bytes).length < ((this.length + end - start) | 0)) {
            let size = 1;
            while (size < ((this.length + other.length) | 0)) size = (size + size) | 0;
            const bytes = new Uint8Array(size);
            ArrayUtils.copyBytes(this.bytes, 0, bytes, 0, this.length);
            this.bytes = bytes;
        }
        ArrayUtils.copyBytes(other.bytes, start, this.bytes, this.length, (end - start) | 0);
        this.length = (this.length + end - start) | 0;
        return this;
    }

    // id.a(Z)Lid;
    asString(): JagString {
        return this;
    }

    // id.a(Ljava/net/URL;B)Ljava/net/URL;
    resolveUrl(base: JavaUrl | null): JavaUrl {
        return JavaUrl.parse(utf8String(this.bytes, 0, this.length), base);
    }

    // id.a(BLid;)I
    indexOf(needle: JagString): number {
        return this.indexOfFrom(needle, 0);
    }

    // id.f(I)Lid;
    trim(): JagString {
        let start = 0;
        while (start < this.length && (byteAt(this.bytes, start) <= 32 || byteAt(this.bytes, start) === 160)) start++;
        let end = this.length;
        while (end > start && (byteAt(this.bytes, end - 1) <= 32 || byteAt(this.bytes, end - 1) === 160)) end--;
        if (start === 0 && end === this.length) return this;
        const result = new JagString();
        result.length = end - start;
        result.bytes = new Uint8Array(result.length);
        for (let i = 0; i < result.length; i++) result.bytes[i] = byteAt(this.bytes, start + i);
        return result;
    }

    // id.a(ILid;)Z
    endsWith(other: JagString): boolean {
        if (other.length > this.length) return false;
        const start = this.length - other.length;
        for (let i = 0; i < other.length; i++) {
            if (byteAt(this.bytes, start + i) !== byteAt(other.bytes, i)) return false;
        }
        return true;
    }

    // id.d(B)Z
    isDecimal(): boolean {
        return this.isInteger(10);
    }

    // id.b(Z)[B
    toBytes(): Uint8Array {
        const bytes = new Uint8Array(this.length);
        ArrayUtils.copyBytes(this.bytes, 0, bytes, 0, this.length);
        return bytes;
    }

    // id.toString()Ljava/lang/String; / HD na.toString()Ljava/lang/String;
    toString(): string {
        try {
            throw new Error();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'na.toString()' : 'id.toString()');
        }
    }

    // id.e(B)Lid;
    trimToLength(): JagString {
        if (!this.mutable) throw new Error('Immutable JagString');
        if (requireNonNull(this.bytes).length !== this.length) {
            const bytes = new Uint8Array(this.length);
            ArrayUtils.copyBytes(this.bytes, 0, bytes, 0, this.length);
            this.bytes = bytes;
        }
        return this;
    }

    // id.c(II)Lid;
    withChar(c: number): JagString {
        if (c <= 0 || c > 255) throw new RangeError('Invalid character');
        const result = new JagString();
        result.bytes = new Uint8Array((1 + this.length) | 0);
        result.length = (1 + this.length) | 0;
        ArrayUtils.copyBytes(this.bytes, 0, result.bytes, 0, this.length);
        putByte(result.bytes, this.length, c);
        return result;
    }

    // id.a(Ljava/applet/Applet;I)Lid;
    getParameter(applet: Pick<JagStringApplet, 'getParameter'>): JagString | null {
        try {
            const name = utf8String(this.bytes, 0, this.length);
            const value = requireNonNull(applet).getParameter(name);
            return value === null ? null : fromJsString(value);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            const target = applet !== null ? '{...}' : 'null';
            throw WrappedException.wrap(error, glJar ? 'na.DB(126,' + target + ')' : 'id.V(' + target + ',31365)');
        }
    }

    // id.f(B)Lid;
    sentenceCase(): JagString {
        const result = new JagString();
        result.length = this.length;
        let state = 2;
        result.bytes = new Uint8Array(this.length);
        for (let i = 0; i < this.length; i++) {
            let c = byteAt(this.bytes, i);
            if ((c >= 97 && c <= 122) || (c >= 224 && c <= 254 && c !== 247)) {
                if (state === 2) c -= 32;
                state = 0;
            } else if ((c >= 65 && c <= 90) || (c >= 192 && c <= 222 && c !== 215)) {
                if (state === 0) c += 32;
                state = 0;
            } else if (c === 46 || c === 33 || c === 63) state = 2;
            else if (c !== 32 || state !== 2) state = 1;
            result.bytes[i] = c;
        }
        return result;
    }

    // id.b(ILid;)Z
    equalsIgnoreCase(other: JagString | null): boolean {
        if (other === null || other.length !== this.length) return false;
        for (let i = 0; i < this.length; i++) {
            let rhs = byteAt(other.bytes, i),
                lhs = byteAt(this.bytes, i);
            if ((lhs >= 65 && lhs <= 90) || (lhs >= 192 && lhs <= 222 && lhs !== 215)) lhs += 32;
            if ((rhs >= 65 && rhs <= 90) || (rhs >= 192 && rhs <= 222 && rhs !== 215)) rhs += 32;
            if (rhs !== lhs) return false;
        }
        return true;
    }

    // SD id.b(Ljava/applet/Applet;I)V, HD na.a(ZLjava/applet/Applet;)V
    evaluateScript(applet: Pick<JagStringApplet, 'evaluate'> | null, guard = glJar ? 1 : -23731): void {
        try {
            if (glJar && guard === 0) return;
            const script = utf8String(this.bytes, 0, this.length);
            const BrowserControl = loadBrowserControl();
            BrowserControl.eval(glJar ? 0 : 43, script, applet);
            if (!glJar && guard !== -23731) this.bytes = null;
        } catch (cause) {
            const JavaError = loadJavaError();
            if (!(cause instanceof Error) || cause instanceof JavaError) throw cause;
            const receiver = applet === null ? 'null' : '{...}';
            throw WrappedException.wrap(cause, glJar ? 'na.AA(true,' + receiver + ')' : 'id.F(' + receiver + ',' + guard + ')');
        }
    }

    // id.a(ZII)I
    indexOfChar(c: number, start: number): number {
        const needle = c & 255;
        for (let i = start; i < this.length; i++) if (byteAt(this.bytes, i) === needle) return i;
        return -1;
    }

    // id.c(BLid;)Z
    startsWithIgnoreCase(other: JagString): boolean {
        if (this.length < other.length) return false;
        for (let i = 0; i < other.length; i++) {
            let lhs = byteAt(this.bytes, i),
                rhs = byteAt(other.bytes, i);
            if ((lhs >= 65 && lhs <= 90) || (lhs >= 192 && lhs <= 222 && lhs !== 215)) lhs += 32;
            if ((rhs >= 65 && rhs <= 90) || (rhs >= 192 && rhs <= 222 && rhs !== 215)) rhs += 32;
            if (lhs !== rhs) return false;
        }
        return true;
    }

    // id.g(B)I
    decimal(): number {
        return this.parseInt(10);
    }

    // id.c(BI)Z
    private isInteger(radix: number): boolean {
        if (radix < 1 || radix > 36) radix = 10;
        let negative = false,
            hasDigit = false,
            value = 0;
        for (let i = 0; i < this.length; i++) {
            let c = byteAt(this.bytes, i);
            if (i === 0 && c === 45) {
                negative = true;
                continue;
            }
            if (i === 0 && c === 43) continue;
            if (c >= 48 && c <= 57) c -= 48;
            else if (c >= 65 && c <= 90) c -= 55;
            else if (c >= 97 && c <= 122) c -= 87;
            else return false;
            if (radix <= c) return false;
            if (negative) c = -c;
            const next = (Math.imul(value, radix) + c) | 0;
            if (value !== ((next / radix) | 0)) return false;
            hasDigit = true;
            value = next;
        }
        return hasDigit;
    }

    // id.a(Lid;II)I
    indexOfFrom(needle: JagString, start: number): number {
        const length = needle.length;
        if (start >= this.length) return length === 0 ? this.length : -1;
        if (start < 0) start = 0;
        if (length === 0) return start;
        const first = byteAt(needle.bytes, 0);
        const last = this.length - length;
        for (let i = start; i <= last; i++) {
            if (first !== byteAt(this.bytes, i)) {
                do {
                    if (++i > last) return -1;
                } while (byteAt(this.bytes, i) !== first);
            }
            let match = true,
                pos = i + 1;
            for (let j = 1; j < length; j++, pos++) {
                if (byteAt(this.bytes, pos) !== byteAt(needle.bytes, j)) {
                    match = false;
                    break;
                }
            }
            if (match) return i;
        }
        return -1;
    }

    // id.a(Lid;B)I
    compareCollated(other: JagString): number {
        let a = 0,
            b = 0;
        let remaining = this.length,
            remainingOther = other.length;
        let length = this.length,
            lengthOther = other.length;
        let i = 0,
            j = 0;
        while (remaining !== 0 && remainingOther !== 0) {
            if (a === 156 || a === 230) a = 101;
            else if (a === 140 || a === 198) a = 69;
            else if (a === 223) a = 115;
            else a = byteAt(this.bytes, i++);
            if (expands(a)) length++;
            else remaining--;
            if (b === 156 || b === 230) b = 101;
            else if (b === 140 || b === 198) b = 69;
            else if (b === 223) b = 115;
            else b = byteAt(other.bytes, j++);
            if (!expands(b)) remainingOther--;
            else lengthOther++;
            if (JagString.collationOrder[b] > JagString.collationOrder[a]) return -1;
            if (JagString.collationOrder[a] > JagString.collationOrder[b]) return 1;
        }
        if (lengthOther > length) return -1;
        return length > lengthOther ? 1 : 0;
    }

    // id.g(I)V
    print(offset: number): void {
        console.log(latin1String(this.bytes, offset, this.length));
    }

    // id.h(I)Lid;
    normalizeName(): JagString {
        return JagString.fromBase37(this.toBase37()) ?? JagString.empty2;
    }

    // mi.a(BJ)Lid;
    static fromBase37(value: bigint): JagString | null {
        if (value <= 0n || value >= 6582952005840035281n || value % 37n === 0n) return null;
        let size = 0;
        for (let n = value; n !== 0n; n /= 37n) size++;
        const bytes = new Uint8Array(size);
        do {
            const last = value;
            value /= 37n;
            bytes[--size] = JagString.base37Alphabet[Number(last - value * 37n)];
        } while (value !== 0n);
        const result = new JagString();
        result.bytes = bytes;
        result.length = bytes.length;
        return result;
    }

    // id.c(ILid;)I
    compare(other: JagString): number {
        const length = Math.min(this.length, other.length);
        for (let i = 0; i < length; i++) {
            if (byteAt(other.bytes, i) > byteAt(this.bytes, i)) return -1;
            if (byteAt(this.bytes, i) > byteAt(other.bytes, i)) return 1;
        }
        if (other.length > this.length) return -1;
        return this.length > other.length ? 1 : 0;
    }

    // SD id.d(II)Lid;, HD na.d(IB)Lna;.
    appendChar(c: number, guard: 111 | 112 | 115 | 117 | 125 | 127 = 115): JagString {
        try {
            if (c <= 0 || c > 255) throw new RangeError(glJar ? 'invalid char:' + c : 'Invalid character');
            if (!this.mutable) {
                if (glJar) throw new RangeError();
                throw new Error('Immutable JagString');
            }
            if (this.length === requireNonNull(this.bytes).length) {
                let size = 1;
                while (this.length >= size) size = (size + size) | 0;
                const bytes = new Uint8Array(size);
                ArrayUtils.copyBytes(this.bytes, 0, bytes, 0, this.length);
                this.bytes = bytes;
            }
            putByte(this.bytes, this.length++, c);
            return this;
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'na.L(' + c + ',' + guard + ')');
        }
    }

    // id.a(IILjava/awt/Graphics;I)V
    draw(x: number, graphics: { drawString(text: string, x: number, y: number): void } | null, y: number): void {
        const text = latin1String(this.bytes, 0, this.length);
        requireNonNull(graphics).drawString(text, x, y);
    }

    // id.a(Lid;I)Z
    startsWith(other: JagString): boolean {
        if (other.length > this.length) return false;
        for (let i = 0; i < other.length; i++) {
            if (byteAt(this.bytes, i) !== byteAt(other.bytes, i)) return false;
        }
        return true;
    }

    // id.i(I)Ljava/net/URL;
    toUrl(): JavaUrl {
        return JavaUrl.parse(utf8String(this.bytes, 0, this.length));
    }

    // id.e(II)V
    setLength(length: number): void {
        if (!this.mutable) throw new Error('Immutable JagString');
        if (length < 0) throw new RangeError('Negative string length');
        if (requireNonNull(this.bytes).length < length) {
            let size = 1;
            while (size < length) size = (size + size) | 0;
            const bytes = new Uint8Array(size);
            ArrayUtils.copyBytes(this.bytes, 0, bytes, 0, this.length);
            this.bytes = bytes;
        }
        for (let i = this.length; i < length; i++) putByte(this.bytes, i, 32);
        this.length = length;
    }

    // id.d(ILid;)Lid;
    append(other: JagString): JagString {
        if (!this.mutable) throw new Error('Immutable JagString');
        if (requireNonNull(this.bytes).length < ((other.length + this.length) | 0)) {
            let size = 1;
            while (size < ((other.length + this.length) | 0)) size = (size + size) | 0;
            const bytes = new Uint8Array(size);
            ArrayUtils.copyBytes(this.bytes, 0, bytes, 0, this.length);
            this.bytes = bytes;
        }
        ArrayUtils.copyBytes(other.bytes, 0, this.bytes, this.length, other.length);
        this.length = (this.length + other.length) | 0;
        return this;
    }

    // ba.a(BI)Lid;
    static allocate(capacity: number): JagString {
        const result = new JagString();
        result.length = 0;
        result.bytes = new Uint8Array(capacity);
        return result;
    }

    // s.a([Lid;I)Lid;
    static join(parts: (JagString | null)[]): JagString {
        if (parts.length < 2) throw new Error('Expected at least two strings');
        return JagString.joinRange(parts.length, parts, 0);
    }

    // ug.a(I[Lid;IB)Lid;
    static joinRange(count: number, parts: (JagString | null)[], start: number): JagString {
        let size = 0;
        for (let i = 0; i < count; i++) {
            const index = (start + i) | 0;
            const part = arrayAtObj(parts, index) ?? (parts[index] = JagString.nullString2);
            size = (size + part.length) | 0;
        }
        const bytes = new Uint8Array(size);
        let dest = 0;
        for (let i = 0; i < count; i++) {
            const part = requireNonNull(arrayAtObj(parts, (i + start) | 0));
            ArrayUtils.copyBytes(part.bytes, 0, bytes, dest, part.length);
            dest = (dest + part.length) | 0;
        }
        const result = new JagString();
        result.bytes = bytes;
        result.length = size;
        return result;
    }

    // fd.a(IJZI)Lid;
    static formatLong(start: number, value: bigint, plus: boolean, radix: number): JagString {
        if (radix < 2 || radix > 36) throw new RangeError('Invalid radix:' + radix);
        value = BigInt.asIntN(64, value);
        const base = BigInt(radix);
        let digits = 1;
        for (let n = value / base; n !== 0n; n /= base) digits++;
        const size = value < 0n || plus ? digits + 1 : digits;
        const bytes = new Uint8Array(size);
        if (value < 0n) bytes[0] = 45;
        else if (plus) bytes[0] = 43;
        for (let i = start; i < digits; i++) {
            let digit = Number(value % base);
            value /= base;
            if (digit < 0) digit = -digit;
            if (digit > 9) digit += 39;
            putByte(bytes, (size - i - 1) | 0, digit + 48);
        }
        const result = new JagString();
        result.bytes = bytes;
        result.length = size;
        return result;
    }

    // ph.a(IJ)Lid;
    static fromLong(value: bigint): JagString {
        return JagString.formatLong(0, value, false, 10);
    }

    // fa.a(ZIII)Lid;
    static formatInteger(plus: boolean, start: number, value: number, radix: number): JagString {
        if (radix < 2 || radix > 36) throw new RangeError('Invalid radix');
        let digits = 1;
        for (let v = (value / radix) | 0; v !== 0; v = (v / radix) | 0) digits++;
        let size = digits;
        if (value < 0 || plus) size++;
        const bytes = new Uint8Array(size);
        if (value < 0) bytes[0] = 45;
        else if (plus) bytes[0] = 43;
        for (let i = start; i < digits; i++) {
            let d = value % radix;
            value = (value / radix) | 0;
            if (d < 0) d = -d;
            if (d > 9) d += 39;
            putByte(bytes, size - i - 1, 48 + d);
        }
        const result = new JagString();
        result.bytes = bytes;
        result.length = size;
        return result;
    }

    // lf.a(IZ)Lid;
    static fromInt(value: number): JagString {
        return JagString.formatInteger(false, 0, value, 10);
    }

    // ad.a(IZZ)Lid;
    static fromSignedInt(value: number, plus: boolean): JagString {
        return JagString.formatInteger(plus, 0, value, 10);
    }

    // id.b(BLid;)Z
    equals(other: JagString | null): boolean {
        if (other === null) return false;
        if (other === this) return true;
        if (this.length !== other.length) return false;
        const rhs = other.bytes;
        const lhs = this.bytes;
        for (let i = 0; i < this.length; i++) {
            if (byteAt(rhs, i) !== byteAt(lhs, i)) return false;
        }
        return true;
    }

    // id.equals(Ljava/lang/Object;)Z
    equalsObject(other: unknown): boolean {
        if (other instanceof JagString) return this.equals(other);
        throw new TypeError('Expected JagString');
    }

    // id.hashCode()I
    objectHashCode(): number {
        return this.hashCode();
    }

    // id.a(I)Lid;
    toLowerCase(): JagString {
        const result = new JagString();
        result.length = this.length;
        result.bytes = new Uint8Array(this.length);
        for (let i = 0; i < this.length; i++) {
            let value = (byteAt(this.bytes, i) << 24) >> 24;
            if ((value >= 65 && value <= 90) || (value >= -64 && value <= -34 && value !== -41)) {
                value = ((value + 32) << 24) >> 24;
            }
            putByte(result.bytes, i, value);
        }
        return result;
    }

    // id.c(I)J
    longHashCode(): bigint {
        let hash = 0n;
        for (let i = 0; i < this.length; i++) {
            hash = BigInt.asIntN(64, BigInt(byteAt(this.bytes, i)) + (hash << 5n) - hash);
        }
        return hash;
    }

    // id.c(B)I
    hashCode(): number {
        let hash = 0;
        for (let i = 0; i < this.length; i++) {
            hash = (-hash + (hash << 5) + byteAt(this.bytes, i)) | 0;
        }
        return hash;
    }

    // ea.a([BIII)Lid;
    static fromBytes(bytes: Uint8Array | null, start: number, size: number, initialLength = 0): JagString {
        const text = new JagString();
        text.bytes = new Uint8Array(size);
        text.length = initialLength;
        for (let i = start; i < ((start + size) | 0); i++) {
            if (byteAt(bytes, i) !== 0) putByte(text.bytes, text.length++, byteAt(bytes, i));
        }
        return text;
    }

    // id.h(B)I
    getLength(): number {
        return this.length;
    }

    // id.a(IIII[B)I
    copyTo(offset: number, end: number, start: number, dest: Uint8Array | null): number {
        ArrayUtils.copyBytes(this.bytes, start, dest, offset, (end - start) | 0);
        return (end - start) | 0;
    }
}

// Boundary between the game's byte strings and browser text.
function latin1String(bytes: Uint8Array | null, offset: number, length: number): string {
    if (bytes === null) throw new TypeError('Null byte array');
    if (offset < 0 || length < 0 || offset > bytes.length - length) throw new RangeError('String byte range');
    let text = '';
    for (let i = 0; i < length; i++) text += String.fromCharCode(bytes[offset + i]);
    return text;
}

export function toJsString(value: JagString): string {
    let text = '';
    for (let i = 0; i < value.length; i++) text += String.fromCharCode(byteAt(value.bytes, i));
    return text;
}

// aj.a(Ljava/lang/String;B)Lid;
export function fromJsString(value: string): JagString {
    const bytes = Uint8Array.from(value, ch => {
        const code = ch.charCodeAt(0);
        return code <= 255 ? code : 63;
    });
    const text = new JagString();
    text.bytes = bytes;
    for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] !== 0) bytes[text.length++] = bytes[i];
    }
    return text;
}

// vb.a(Ljava/lang/String;B)Lid;
export function fromLiteral(value: string): JagString {
    let i = 0;
    const bytes = utf8Bytes(value);
    const result = new JagString();
    result.bytes = new Uint8Array(bytes.length);
    while (i < bytes.length) {
        const c = bytes[i++];
        if (c >= 40 && c <= 45) {
            if (i >= bytes.length) break;
            result.bytes[result.length++] = (c - 40) * 43 - 48 + bytes[i++];
        } else if (c !== 0) result.bytes[result.length++] = c;
    }
    result.trimToLength();
    return result.intern();
}

// id.d(I)Lid; constructs gi.t:Lnc; on the first literal. The bucket sentinels
// in nc.<init>(I)V initialize jf and the string value node we re-enters
// id.d. Their literals retain the first table's objects when the outer new
// instructions return and publish their own tables.
export const linkableInitStrings = {
    memSuffix: fromLiteral('k'), // we.t:Lid;
    germanClose: fromLiteral('Schlie-8en'), // we.x:Lid;
    englishLoadedTextures: fromLiteral('Loaded textures'), // jf.c:Lid;
    shiftClickDisabled: fromLiteral('Shift)2click disabled)3'), // jf.f:Lid;
    englishLoadedConfig: fromLiteral('Loaded config'), // jf.h:Lid;
    englishStarted3dLibrary: fromLiteral('Started 3d Library') // jf.d:Lid;
};
JagString.internTable = new HashTable<StringNode>(4096);
// nc.<clinit>()V initializes gk after publishing nc.r.
export const hashTableInitStrings = {
    englishDiscard: fromLiteral('Discard'), // nc.k:Lid;
    englishLoadingConfig: fromLiteral('Loading config )2 '), // nc.a:Lid;
    percent4: fromLiteral('(U4'), // nc.r:Lid;
    lime: fromLiteral('<col=40ff00>'), // gk.f:Lid;
    playerCacheCommand: fromLiteral('::pcachesize'), // gk.a:Lid;
    germanUnableToFind: fromLiteral('Spieler kann nicht gefunden werden: ') // gk.l:Lid;
};
JagString.internTable = new HashTable<StringNode>(4096);

JagString.empty = fromLiteral('');
JagString.minusSign = fromLiteral(')2');
JagString.period2 = fromLiteral(')3');
JagString.comma = fromLiteral(')1');
JagString.nbsp = JagString.fromCharCode(160);
JagString.zero = fromLiteral('0');
JagString.nullString = fromLiteral('null');

JagString.empty2 = fromLiteral('');
JagString.nullString2 = fromLiteral('null');
JagString.period = fromLiteral(')3');
