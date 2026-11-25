import Buffer from '#/util/nio/Buffer';
import { bufferByteRange, bufferKind } from '#/util/nio/BufferBytes';
import GLCapabilities from '#/jogl/GLCapabilities';
import GLException from '#/jogl/GLException';
import { JavaCheckedException, JavaError } from '#/util/JavaException';

// GLTrace v1: the GL command trace format shared by the TS recorder (RecordingGL) and the Java recorder
// (GlRecorder.java). Not a Java class. src/gl/GLTRACE.md is the normative specification; this module is
// its TS implementation: the value tokens, the per-entry serialization rules (ENTRY_RULE_SOURCE, which the
// spec's entry table repeats verbatim and test/hd/gl-trace.test.ts compares), the record writer with
// name and object normalization, and the parser.

export const GLTRACE_HEADER = '#GLTrace v1';

// ---------------------------------------------------------------------------------------------------------
// Value model. Every column of a record is one TraceValue; formatValue gives its single canonical token.

export type NameKind = 'T' | 'B' | 'L' | 'P';
export type RefKind = 'F' | 'D' | 'C' | 'G' | 'O';
export type BufferTokenKind = 'byte' | 'short' | 'int' | 'float';
export type SlipForm = 'i?' | 'f?' | 'd?' | 'b?' | 'z?' | 'o?' | 'fv?' | 'iv?' | 'B?' | 'S?' | 'K?' | 'R?';

export type IntElem = { readonly t: 'int'; readonly v: number } | { readonly t: 'name'; readonly kind: NameKind; readonly id: number } | { readonly t: 'rawname'; readonly kind: NameKind; readonly v: number };

export interface CapsValue {
    readonly t: 'caps';
    readonly doubleBuffered: boolean;
    readonly stereo: boolean;
    readonly hardwareAccelerated: boolean;
    readonly depthBits: number;
    readonly stencilBits: number;
    readonly redBits: number;
    readonly greenBits: number;
    readonly blueBits: number;
    readonly alphaBits: number;
    readonly accumRedBits: number;
    readonly accumGreenBits: number;
    readonly accumBlueBits: number;
    readonly accumAlphaBits: number;
    readonly sampleBuffers: boolean;
    readonly numSamples: number;
}

export type TraceValue =
    | IntElem
    | { readonly t: 'float'; readonly bits: number }
    | { readonly t: 'double'; readonly bits: bigint }
    | { readonly t: 'bool'; readonly v: boolean }
    | { readonly t: 'long'; readonly v: bigint }
    | { readonly t: 'null' }
    | { readonly t: 'ref'; readonly kind: RefKind; readonly id: number }
    | { readonly t: 'fv'; readonly bits: readonly number[]; readonly missing: number }
    | { readonly t: 'iv'; readonly elems: readonly IntElem[]; readonly missing: number }
    | {
          readonly t: 'buffer';
          readonly kind: BufferTokenKind;
          readonly pos: number;
          readonly lim: number;
          readonly cap: number;
          readonly direct: boolean;
          readonly sha: string;
          readonly hex: string | null;
      }
    | { readonly t: 'string'; readonly len: number; readonly sha: string; readonly text: string | null }
    | CapsValue
    | { readonly t: 'label'; readonly text: string }
    | { readonly t: 'slip'; readonly form: SlipForm; readonly text: string };

export interface TraceRecord {
    readonly frame: number;
    // The ordered sequence number within the frame, or for a deletion record its deletion index within the frame.
    readonly seq: number;
    readonly deletion: boolean;
    readonly entry: string;
    readonly args: readonly TraceValue[];
    readonly ret: TraceValue | null;
    readonly thrown: ThrowKind | null;
    readonly stack: string | null;
}

export type ThrowKind = 'GLException' | 'RuntimeException' | 'Error' | 'Exception' | 'Throwable';
const THROW_KINDS: readonly ThrowKind[] = ['GLException', 'RuntimeException', 'Error', 'Exception', 'Throwable'];

export interface TraceFile {
    readonly meta: readonly string[];
    readonly records: readonly TraceRecord[];
}

const HEX = '0123456789abcdef';

export function hex8(u32: number): string {
    return (u32 >>> 0).toString(16).padStart(8, '0');
}

export function hex16(u64: bigint): string {
    return BigInt.asUintN(64, u64).toString(16).padStart(16, '0');
}

export function bytesToHex(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        s += HEX[b >>> 4] + HEX[b & 15];
    }
    return s;
}

const f32 = new Float32Array(1);
const f32u = new Uint32Array(f32.buffer);
const f64 = new Float64Array(1);
const f64u = new BigUint64Array(f64.buffer);

// binary32 bits of a number that is already a binary32 value (NaN gives the canonical 7fc00000)
export function floatBits(value: number): number {
    f32[0] = value;
    return f32u[0];
}

export function bitsToFloat(bits: number): number {
    f32u[0] = bits >>> 0;
    return f32[0];
}

export function doubleBits(value: number): bigint {
    f64[0] = value;
    return f64u[0];
}

// A number a Java int can hold. -0 counts as 0: Java ints have no negative zero, and -0 acts as 0 in every int
// operation the port uses (| 0, Math.imul, comparisons, array indices, Map keys). GLTRACE.md section 14.
export function isInt32(value: unknown): value is number {
    return typeof value === 'number' && (value | 0) === value;
}

function formatIntElem(e: IntElem): string {
    switch (e.t) {
        case 'int':
            return String(e.v);
        case 'name':
            return '#' + e.kind + e.id;
        case 'rawname':
            return '#' + e.kind + '?' + e.v;
    }
}

export function formatValue(v: TraceValue): string {
    switch (v.t) {
        case 'int':
        case 'name':
        case 'rawname':
            return formatIntElem(v);
        case 'float':
            return 'f:' + hex8(v.bits);
        case 'double':
            return 'd:' + hex16(v.bits);
        case 'bool':
            return v.v ? 'T' : 'F';
        case 'long':
            return 'o:' + v.v.toString();
        case 'null':
            return 'null';
        case 'ref':
            return '@' + v.kind + v.id;
        case 'fv': {
            const parts = v.bits.map(hex8);
            if (v.missing > 0) parts.push('!' + v.missing);
            return 'fv:' + parts.join(',');
        }
        case 'iv': {
            const parts = v.elems.map(formatIntElem);
            if (v.missing > 0) parts.push('!' + v.missing);
            return 'iv:' + parts.join(',');
        }
        case 'buffer':
            return 'B:' + v.kind + ':' + v.pos + ':' + v.lim + ':' + v.cap + ':' + (v.direct ? 'direct' : 'heap') + ':' + v.sha + (v.hex === null ? '' : ':' + v.hex);
        case 'string':
            return 'S:' + v.len + ':' + v.sha + (v.text === null ? '' : ':' + v.text);
        case 'caps': {
            const b = (x: boolean) => (x ? 'T' : 'F');
            return (
                'K:' +
                [
                    b(v.doubleBuffered),
                    b(v.stereo),
                    b(v.hardwareAccelerated),
                    v.depthBits,
                    v.stencilBits,
                    v.redBits,
                    v.greenBits,
                    v.blueBits,
                    v.alphaBits,
                    v.accumRedBits,
                    v.accumGreenBits,
                    v.accumBlueBits,
                    v.accumAlphaBits,
                    b(v.sampleBuffers),
                    v.numSamples
                ].join(':')
            );
        }
        case 'label':
            return v.text;
        case 'slip':
            return v.form + ':' + v.text;
    }
}

export class TraceParseError extends Error {}

const INT_RE = /^(0|-?[1-9][0-9]*)$/;
const LABEL_RE = /^[A-Za-z0-9_.:-]+$/;
const SHA_RE = /^[0-9a-f]{64}$/;
const HEXBYTES_RE = /^(?:[0-9a-f]{2})*$/;
const TEXT_RE = /^(?:[\x21-\x24\x26-\x7e]|%[0-9A-F]{2})*$/;

function parseIntToken(s: string): number {
    if (!INT_RE.test(s)) throw new TraceParseError('bad int: ' + s);
    const v = Number(s);
    if ((v | 0) !== v) throw new TraceParseError('int out of range: ' + s);
    return v;
}

function parseNonNeg(s: string): number {
    const v = parseIntToken(s);
    if (v < 0) throw new TraceParseError('negative: ' + s);
    return v;
}

function parseIntElem(s: string): IntElem {
    if (s.startsWith('#')) {
        const kind = s[1];
        if (kind !== 'T' && kind !== 'B' && kind !== 'L' && kind !== 'P') throw new TraceParseError('bad name kind: ' + s);
        if (s[2] === '?') return { t: 'rawname', kind, v: parseIntToken(s.slice(3)) };
        const id = parseNonNeg(s.slice(2));
        if (id < 1) throw new TraceParseError('bad name id: ' + s);
        return { t: 'name', kind, id };
    }
    return { t: 'int', v: parseIntToken(s) };
}

function parseHex8(s: string): number {
    if (!/^[0-9a-f]{8}$/.test(s)) throw new TraceParseError('bad float bits: ' + s);
    return parseInt(s, 16) >>> 0;
}

function parseBool(s: string): boolean {
    if (s === 'T') return true;
    if (s === 'F') return false;
    throw new TraceParseError('bad boolean: ' + s);
}

function splitElems(body: string): { parts: string[]; missing: number } {
    if (body === '') return { parts: [], missing: 0 };
    const parts = body.split(',');
    let missing = 0;
    const last = parts[parts.length - 1];
    if (last.startsWith('!')) {
        missing = parseNonNeg(last.slice(1));
        if (missing < 1) throw new TraceParseError('bad missing count: ' + last);
        parts.pop();
    }
    return { parts, missing };
}

// Parses one column token. `entry` selects the label form of ~mark's argument.
export function parseValue(s: string, entry: string = ''): TraceValue {
    if (entry === '~mark') {
        if (!LABEL_RE.test(s)) throw new TraceParseError('bad label: ' + s);
        return { t: 'label', text: s };
    }
    if (s === 'null') return { t: 'null' };
    if (s === 'T' || s === 'F') return { t: 'bool', v: s === 'T' };
    const slip = /^(i\?|f\?|d\?|b\?|z\?|o\?|fv\?|iv\?|B\?|S\?|K\?|R\?):(.*)$/.exec(s);
    if (slip !== null) {
        if (!/^[\x21-\x7e]*$/.test(slip[2])) throw new TraceParseError('bad slip text: ' + s);
        return { t: 'slip', form: slip[1] as SlipForm, text: slip[2] };
    }
    if (s.startsWith('f:')) return { t: 'float', bits: parseHex8(s.slice(2)) };
    if (s.startsWith('d:')) {
        const h = s.slice(2);
        if (!/^[0-9a-f]{16}$/.test(h)) throw new TraceParseError('bad double bits: ' + s);
        return { t: 'double', bits: BigInt('0x' + h) };
    }
    if (s.startsWith('o:')) {
        const n = s.slice(2);
        if (!INT_RE.test(n)) throw new TraceParseError('bad long: ' + s);
        const v = BigInt(n);
        if (BigInt.asIntN(64, v) !== v) throw new TraceParseError('long out of range: ' + s);
        return { t: 'long', v };
    }
    if (s.startsWith('@')) {
        const kind = s[1];
        if (kind !== 'F' && kind !== 'D' && kind !== 'C' && kind !== 'G' && kind !== 'O') throw new TraceParseError('bad ref kind: ' + s);
        const id = parseNonNeg(s.slice(2));
        if (id < 1) throw new TraceParseError('bad ref id: ' + s);
        return { t: 'ref', kind, id };
    }
    if (s.startsWith('fv:')) {
        const { parts, missing } = splitElems(s.slice(3));
        return { t: 'fv', bits: parts.map(parseHex8), missing };
    }
    if (s.startsWith('iv:')) {
        const { parts, missing } = splitElems(s.slice(3));
        return { t: 'iv', elems: parts.map(parseIntElem), missing };
    }
    if (s.startsWith('B:')) {
        const f = s.slice(2).split(':');
        if (f.length !== 6 && f.length !== 7) throw new TraceParseError('bad buffer: ' + s);
        const kind = f[0];
        if (kind !== 'byte' && kind !== 'short' && kind !== 'int' && kind !== 'float') throw new TraceParseError('bad buffer kind: ' + s);
        if (f[4] !== 'direct' && f[4] !== 'heap') throw new TraceParseError('bad buffer storage: ' + s);
        if (!SHA_RE.test(f[5])) throw new TraceParseError('bad buffer hash: ' + s);
        const hex = f.length === 7 ? f[6] : null;
        if (hex !== null && (!HEXBYTES_RE.test(hex) || hex.length > 512)) throw new TraceParseError('bad buffer hex: ' + s);
        return { t: 'buffer', kind, pos: parseNonNeg(f[1]), lim: parseNonNeg(f[2]), cap: parseNonNeg(f[3]), direct: f[4] === 'direct', sha: f[5], hex };
    }
    if (s.startsWith('S:')) {
        const m = /^S:(0|[1-9][0-9]*):([0-9a-f]{64})(?::(.*))?$/.exec(s);
        if (m === null) throw new TraceParseError('bad string: ' + s);
        const text = m[3] === undefined ? null : m[3];
        if (text !== null && !TEXT_RE.test(text)) throw new TraceParseError('bad string text: ' + s);
        return { t: 'string', len: Number(m[1]), sha: m[2], text };
    }
    if (s.startsWith('K:')) {
        const f = s.slice(2).split(':');
        if (f.length !== 15) throw new TraceParseError('bad capabilities: ' + s);
        return {
            t: 'caps',
            doubleBuffered: parseBool(f[0]),
            stereo: parseBool(f[1]),
            hardwareAccelerated: parseBool(f[2]),
            depthBits: parseIntToken(f[3]),
            stencilBits: parseIntToken(f[4]),
            redBits: parseIntToken(f[5]),
            greenBits: parseIntToken(f[6]),
            blueBits: parseIntToken(f[7]),
            alphaBits: parseIntToken(f[8]),
            accumRedBits: parseIntToken(f[9]),
            accumGreenBits: parseIntToken(f[10]),
            accumBlueBits: parseIntToken(f[11]),
            accumAlphaBits: parseIntToken(f[12]),
            sampleBuffers: parseBool(f[13]),
            numSamples: parseIntToken(f[14])
        };
    }
    if (s.startsWith('#')) return parseIntElem(s);
    return { t: 'int', v: parseIntToken(s) };
}

export function formatRecordLine(r: TraceRecord): string {
    let line = r.frame + '.' + (r.deletion ? 'd' : '') + r.seq + '\t' + r.entry;
    for (const a of r.args) line += '\t' + formatValue(a);
    if (r.ret !== null) line += '\t=> ' + formatValue(r.ret);
    if (r.thrown !== null) line += '\t!> ' + r.thrown;
    return line;
}

export function formatRecord(r: TraceRecord): string {
    const line = formatRecordLine(r);
    return r.stack === null ? line : line + '\n#@ ' + r.stack;
}

const ENTRY_RE = /^(~gl|~mark|[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)?)$/;

export function parseRecordLine(line: string): TraceRecord {
    const cols = line.split('\t');
    if (cols.length < 2) throw new TraceParseError('record needs an id and an entry: ' + line);
    const id = /^(0|[1-9][0-9]*)\.(d?)(0|[1-9][0-9]*)$/.exec(cols[0]);
    if (id === null) throw new TraceParseError('bad record id: ' + cols[0]);
    const entry = cols[1];
    if (!ENTRY_RE.test(entry)) throw new TraceParseError('bad entry: ' + entry);
    const args: TraceValue[] = [];
    let ret: TraceValue | null = null;
    let thrown: ThrowKind | null = null;
    for (let i = 2; i < cols.length; i++) {
        const c = cols[i];
        if (c.startsWith('=> ')) {
            if (i !== cols.length - 1 || ret !== null) throw new TraceParseError('return must be the last column: ' + line);
            ret = parseValue(c.slice(3));
        } else if (c.startsWith('!> ')) {
            if (i !== cols.length - 1) throw new TraceParseError('throw must be the last column: ' + line);
            const k = c.slice(3) as ThrowKind;
            if (!THROW_KINDS.includes(k)) throw new TraceParseError('bad throw kind: ' + c);
            thrown = k;
        } else {
            args.push(parseValue(c, entry));
        }
    }
    return { frame: Number(id[1]), seq: Number(id[3]), deletion: id[2] === 'd', entry, args, ret, thrown, stack: null };
}

export function serializeTrace(file: TraceFile): string {
    let out = GLTRACE_HEADER + '\n';
    for (const m of file.meta) out += '#! ' + m + '\n';
    for (const r of file.records) out += formatRecord(r) + '\n';
    return out;
}

export function parseTrace(text: string): TraceFile {
    const lines = text.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();
    else throw new TraceParseError('trace must end with a newline');
    if (lines[0] !== GLTRACE_HEADER) throw new TraceParseError('missing header ' + GLTRACE_HEADER);
    const meta: string[] = [];
    const records: TraceRecord[] = [];
    for (let n = 1; n < lines.length; n++) {
        const line = lines[n];
        try {
            if (line.startsWith('#! ')) {
                if (records.length > 0) throw new TraceParseError('meta line after the first record');
                meta.push(line.slice(3));
            } else if (line.startsWith('#@ ')) {
                const last = records.pop();
                if (last === undefined || last.stack !== null) throw new TraceParseError('stack line without a record');
                records.push({ ...last, stack: line.slice(3) });
            } else {
                records.push(parseRecordLine(line));
            }
        } catch (e) {
            if (e instanceof TraceParseError) throw new TraceParseError('line ' + (n + 1) + ': ' + e.message);
            throw e;
        }
    }
    return { meta, records };
}

// ---------------------------------------------------------------------------------------------------------
// Entry rules. One row per recorded entry point: [entry, descriptor, receiver, parameter roles, return role,
// flag]. The rows are normative (GLTRACE.md section 12 repeats them; the test compares the two).
//
// Parameter roles: int float double bool byte long string caps | name:K | ref:K | buf | buf[C] | out-buf[C] |
// in-f[C] out-f[C] out-i[C] | in-names:K[C] out-names:K[C]. Return roles: void int bool string ref:K
// alloc-lists[$k]. Counts C: a decimal, $k (the int value of argument k, negative as 0) or TABLE($k).

export const ENTRY_RULE_SOURCE: readonly (readonly [string, string, string, string, string, string])[] = [
    ['glActiveTexture', '(I)V', '-', 'int', 'void', '-'],
    ['glAlphaFunc', '(IF)V', '-', 'int float', 'void', '-'],
    ['glBegin', '(I)V', '-', 'int', 'void', '-'],
    ['glBindBufferARB', '(II)V', '-', 'int name:B', 'void', '-'],
    ['glBindProgramARB', '(II)V', '-', 'int name:P', 'void', '-'],
    ['glBindTexture', '(II)V', '-', 'int name:T', 'void', '-'],
    ['glBlendFunc', '(II)V', '-', 'int int', 'void', '-'],
    ['glBufferDataARB', '(IILjava/nio/Buffer;I)V', '-', 'int int buf int', 'void', '-'],
    ['glBufferSubDataARB', '(IIILjava/nio/Buffer;)V', '-', 'int int int buf', 'void', '-'],
    ['glCallList', '(I)V', '-', 'name:L', 'void', '-'],
    ['glClear', '(I)V', '-', 'int', 'void', '-'],
    ['glClearColor', '(FFFF)V', '-', 'float float float float', 'void', '-'],
    ['glClearDepth', '(D)V', '-', 'double', 'void', '-'],
    ['glClientActiveTexture', '(I)V', '-', 'int', 'void', '-'],
    ['glColor3ub', '(BBB)V', '-', 'byte byte byte', 'void', '-'],
    ['glColor4f', '(FFFF)V', '-', 'float float float float', 'void', '-'],
    ['glColor4fv', '([FI)V', '-', 'in-f[4] int', 'void', '-'],
    ['glColor4ub', '(BBBB)V', '-', 'byte byte byte byte', 'void', '-'],
    ['glColorMaterial', '(II)V', '-', 'int int', 'void', '-'],
    ['glColorPointer', '(IIILjava/nio/Buffer;)V', '-', 'int int int buf', 'void', '-'],
    ['glColorPointer', '(IIIJ)V', '-', 'int int int long', 'void', '-'],
    ['glCopyPixels', '(IIIII)V', '-', 'int int int int int', 'void', '-'],
    ['glCullFace', '(I)V', '-', 'int', 'void', '-'],
    ['glDeleteBuffersARB', '(I[II)V', '-', 'int in-names:B[$0] int', 'void', 'deletion'],
    ['glDeleteLists', '(II)V', '-', 'name:L int', 'void', 'deletion'],
    ['glDeleteTextures', '(I[II)V', '-', 'int in-names:T[$0] int', 'void', 'deletion'],
    ['glDepthFunc', '(I)V', '-', 'int', 'void', '-'],
    ['glDepthMask', '(Z)V', '-', 'bool', 'void', '-'],
    ['glDisable', '(I)V', '-', 'int', 'void', '-'],
    ['glDisableClientState', '(I)V', '-', 'int', 'void', '-'],
    ['glDrawBuffer', '(I)V', '-', 'int', 'void', '-'],
    ['glDrawElements', '(IIILjava/nio/Buffer;)V', '-', 'int int int buf', 'void', '-'],
    ['glDrawElements', '(IIIJ)V', '-', 'int int int long', 'void', '-'],
    ['glDrawPixels', '(IIIILjava/nio/Buffer;)V', '-', 'int int int int buf', 'void', '-'],
    ['glEnable', '(I)V', '-', 'int', 'void', '-'],
    ['glEnableClientState', '(I)V', '-', 'int', 'void', '-'],
    ['glEnd', '()V', '-', '', 'void', '-'],
    ['glEndList', '()V', '-', '', 'void', '-'],
    ['glFogf', '(IF)V', '-', 'int float', 'void', '-'],
    ['glFogfv', '(I[FI)V', '-', 'int in-f[FOGFV($0)] int', 'void', '-'],
    ['glFogi', '(II)V', '-', 'int int', 'void', '-'],
    ['glGenBuffersARB', '(I[II)V', '-', 'int out-names:B[$0] int', 'void', '-'],
    ['glGenLists', '(I)I', '-', 'int', 'alloc-lists[$0]', '-'],
    ['glGenProgramsARB', '(I[II)V', '-', 'int out-names:P[$0] int', 'void', '-'],
    ['glGenTextures', '(I[II)V', '-', 'int out-names:T[$0] int', 'void', '-'],
    ['glGetFloatv', '(ILjava/nio/FloatBuffer;)V', '-', 'int out-buf[GETFV($0)]', 'void', '-'],
    ['glGetFloatv', '(I[FI)V', '-', 'int out-f[GETFV($0)] int', 'void', '-'],
    ['glGetIntegerv', '(I[II)V', '-', 'int out-i[1] int', 'void', '-'],
    ['glGetString', '(I)Ljava/lang/String;', '-', 'int', 'string', '-'],
    ['glGetTexLevelParameteriv', '(III[II)V', '-', 'int int int out-i[1] int', 'void', '-'],
    ['glHint', '(II)V', '-', 'int int', 'void', '-'],
    ['glInterleavedArrays', '(IILjava/nio/Buffer;)V', '-', 'int int buf', 'void', '-'],
    ['glInterleavedArrays', '(IIJ)V', '-', 'int int long', 'void', '-'],
    ['glLightModelfv', '(I[FI)V', '-', 'int in-f[LIGHTMODELFV($0)] int', 'void', '-'],
    ['glLightf', '(IIF)V', '-', 'int int float', 'void', '-'],
    ['glLightfv', '(II[FI)V', '-', 'int int in-f[LIGHTFV($1)] int', 'void', '-'],
    ['glLoadIdentity', '()V', '-', '', 'void', '-'],
    ['glLoadMatrixf', '([FI)V', '-', 'in-f[16] int', 'void', '-'],
    ['glMatrixMode', '(I)V', '-', 'int', 'void', '-'],
    ['glMultiTexCoord2f', '(IFF)V', '-', 'int float float', 'void', '-'],
    ['glNewList', '(II)V', '-', 'name:L int', 'void', '-'],
    ['glNormalPointer', '(IILjava/nio/Buffer;)V', '-', 'int int buf', 'void', '-'],
    ['glNormalPointer', '(IIJ)V', '-', 'int int long', 'void', '-'],
    ['glOrtho', '(DDDDDD)V', '-', 'double double double double double double', 'void', '-'],
    ['glPixelStorei', '(II)V', '-', 'int int', 'void', '-'],
    ['glPixelZoom', '(FF)V', '-', 'float float', 'void', '-'],
    ['glPointParameterfARB', '(IF)V', '-', 'int float', 'void', '-'],
    ['glPointParameterfvARB', '(I[FI)V', '-', 'int in-f[POINTPARAMFV($0)] int', 'void', '-'],
    ['glPolygonMode', '(II)V', '-', 'int int', 'void', '-'],
    ['glPopAttrib', '()V', '-', '', 'void', '-'],
    ['glPopMatrix', '()V', '-', '', 'void', '-'],
    ['glProgramLocalParameter4fARB', '(IIFFFF)V', '-', 'int int float float float float', 'void', '-'],
    ['glProgramLocalParameter4fvARB', '(IILjava/nio/FloatBuffer;)V', '-', 'int int buf[4]', 'void', '-'],
    ['glProgramLocalParameter4fvARB', '(II[FI)V', '-', 'int int in-f[4] int', 'void', '-'],
    ['glProgramStringARB', '(IIILjava/lang/String;)V', '-', 'int int int string', 'void', '-'],
    ['glPushAttrib', '(I)V', '-', 'int', 'void', '-'],
    ['glPushMatrix', '()V', '-', '', 'void', '-'],
    ['glRasterPos2i', '(II)V', '-', 'int int', 'void', '-'],
    ['glReadBuffer', '(I)V', '-', 'int', 'void', '-'],
    ['glRotatef', '(FFFF)V', '-', 'float float float float', 'void', '-'],
    ['glScalef', '(FFF)V', '-', 'float float float', 'void', '-'],
    ['glScissor', '(IIII)V', '-', 'int int int int', 'void', '-'],
    ['glShadeModel', '(I)V', '-', 'int', 'void', '-'],
    ['glTexCoord2f', '(FF)V', '-', 'float float', 'void', '-'],
    ['glTexCoordPointer', '(IIILjava/nio/Buffer;)V', '-', 'int int int buf', 'void', '-'],
    ['glTexCoordPointer', '(IIIJ)V', '-', 'int int int long', 'void', '-'],
    ['glTexEnvf', '(IIF)V', '-', 'int int float', 'void', '-'],
    ['glTexEnvfv', '(II[FI)V', '-', 'int int in-f[TEXENVFV($1)] int', 'void', '-'],
    ['glTexEnvi', '(III)V', '-', 'int int int', 'void', '-'],
    ['glTexGenfv', '(II[FI)V', '-', 'int int in-f[TEXGENFV($1)] int', 'void', '-'],
    ['glTexGeni', '(III)V', '-', 'int int int', 'void', '-'],
    ['glTexImage1D', '(IIIIIIILjava/nio/Buffer;)V', '-', 'int int int int int int int buf', 'void', '-'],
    ['glTexImage2D', '(IIIIIIIILjava/nio/Buffer;)V', '-', 'int int int int int int int int buf', 'void', '-'],
    ['glTexImage3D', '(IIIIIIIIILjava/nio/Buffer;)V', '-', 'int int int int int int int int int buf', 'void', '-'],
    ['glTexParameteri', '(III)V', '-', 'int int int', 'void', '-'],
    ['glTranslatef', '(FFF)V', '-', 'float float float', 'void', '-'],
    ['glVertex2f', '(FF)V', '-', 'float float', 'void', '-'],
    ['glVertexPointer', '(IIILjava/nio/Buffer;)V', '-', 'int int int buf', 'void', '-'],
    ['glVertexPointer', '(IIIJ)V', '-', 'int int int long', 'void', '-'],
    ['glViewport', '(IIII)V', '-', 'int int int int', 'void', '-'],
    ['isExtensionAvailable', '(Ljava/lang/String;)Z', '-', 'string', 'bool', '-'],
    ['setSwapInterval', '(I)V', '-', 'int', 'void', '-'],
    ['GLDrawableFactory.getGLDrawable', '(Ljava/lang/Object;Ljavax/media/opengl/GLCapabilities;Ljavax/media/opengl/GLCapabilitiesChooser;)Ljavax/media/opengl/GLDrawable;', 'ref:F', 'ref:O caps ref:O', 'ref:D', '-'],
    ['GLDrawable.createContext', '(Ljavax/media/opengl/GLContext;)Ljavax/media/opengl/GLContext;', 'ref:D', 'ref:C', 'ref:C', '-'],
    ['GLDrawable.setRealized', '(Z)V', 'ref:D', 'bool', 'void', '-'],
    ['GLDrawable.swapBuffers', '()V', 'ref:D', '', 'void', 'ends-frame'],
    ['GLContext.makeCurrent', '()I', 'ref:C', '', 'int', '-'],
    ['GLContext.release', '()V', 'ref:C', '', 'void', '-'],
    ['GLContext.destroy', '()V', 'ref:C', '', 'void', '-'],
    ['GLContext.getGL', '()Ljavax/media/opengl/GL;', 'ref:C', '', 'ref:G', '-']
];

// Surface members that produce no record (GLTRACE.md section 11), with the reason.
export const UNRECORDED_MEMBERS: readonly (readonly [string, string, string])[] = [
    ['GLDrawableFactory.getFactory', '()Ljavax/media/opengl/GLDrawableFactory;', 'static; a Java recorder cannot intercept it'],
    ['GLContext.getCurrent', '()Ljavax/media/opengl/GLContext;', 'static; a Java recorder cannot intercept it'],
    ['GLCapabilities.<init>', '()V', 'concrete class; its state is recorded as the caps column of GLDrawableFactory.getGLDrawable'],
    ['GLCapabilities.setSampleBuffers', '(Z)V', 'concrete class; its state is recorded as the caps column of GLDrawableFactory.getGLDrawable'],
    ['GLCapabilities.setNumSamples', '(I)V', 'concrete class; its state is recorded as the caps column of GLDrawableFactory.getGLDrawable'],
    ['GLU.<init>', '()V', 'concrete class with an empty constructor; makes no GL call'],
    ['GLU.gluBuild2DMipmaps', '(IIIIIILjava/nio/Buffer;)I', 'concrete class; recorded through the GL calls it makes on GLContext.getCurrent().getGL()']
];

// Count tables: pname -> element count. Any pname not listed counts 1.
export const COUNT_TABLES: Readonly<Record<string, Readonly<Record<number, number>>>> = {
    LIGHTFV: { 4608: 4, 4609: 4, 4610: 4, 4611: 4, 4612: 3 }, // AMBIENT DIFFUSE SPECULAR POSITION 4, SPOT_DIRECTION 3
    FOGFV: { 2918: 4 }, // FOG_COLOR
    LIGHTMODELFV: { 2899: 4 }, // LIGHT_MODEL_AMBIENT
    TEXENVFV: { 8705: 4 }, // TEXTURE_ENV_COLOR
    TEXGENFV: { 9473: 4, 9474: 4 }, // OBJECT_PLANE EYE_PLANE
    POINTPARAMFV: { 33065: 3 }, // POINT_DISTANCE_ATTENUATION
    GETFV: { 2899: 4 } // LIGHT_MODEL_AMBIENT
};

export type Count = { readonly k: 'n'; readonly n: number } | { readonly k: 'arg'; readonly arg: number } | { readonly k: 'table'; readonly table: string; readonly arg: number };

export type Role =
    | { readonly r: 'int' | 'float' | 'double' | 'bool' | 'byte' | 'long' | 'string' | 'caps' | 'buf' }
    | { readonly r: 'name'; readonly kind: NameKind }
    | { readonly r: 'ref'; readonly kind: RefKind }
    | { readonly r: 'buf-n' | 'out-buf'; readonly count: Count }
    | { readonly r: 'in-f' | 'out-f' | 'out-i'; readonly count: Count }
    | { readonly r: 'in-names' | 'out-names'; readonly kind: NameKind; readonly count: Count };

export type ReturnRole = { readonly r: 'void' | 'int' | 'bool' | 'string' } | { readonly r: 'ref'; readonly kind: RefKind } | { readonly r: 'alloc-lists'; readonly arg: number };

export interface EntryRule {
    readonly entry: string;
    readonly descriptor: string;
    readonly receiver: RefKind | null;
    readonly params: readonly Role[];
    readonly ret: ReturnRole;
    readonly deletion: boolean;
    readonly endsFrame: boolean;
}

function parseCount(s: string): Count {
    if (/^[0-9]+$/.test(s)) return { k: 'n', n: Number(s) };
    const arg = /^\$([0-9])$/.exec(s);
    if (arg !== null) return { k: 'arg', arg: Number(arg[1]) };
    const table = /^([A-Z]+)\(\$([0-9])\)$/.exec(s);
    if (table !== null && table[1] in COUNT_TABLES) return { k: 'table', table: table[1], arg: Number(table[2]) };
    throw new Error('bad count: ' + s);
}

function parseKind<K extends string>(s: string, kinds: readonly K[]): K {
    const k = kinds.find(x => x === s);
    if (k === undefined) throw new Error('bad kind: ' + s);
    return k;
}

const NAME_KINDS: readonly NameKind[] = ['T', 'B', 'L', 'P'];
const REF_KINDS: readonly RefKind[] = ['F', 'D', 'C', 'G', 'O'];

export function parseRole(s: string): Role {
    switch (s) {
        case 'int':
        case 'float':
        case 'double':
        case 'bool':
        case 'byte':
        case 'long':
        case 'string':
        case 'caps':
        case 'buf':
            return { r: s };
    }
    let m = /^name:([A-Z])$/.exec(s);
    if (m !== null) return { r: 'name', kind: parseKind(m[1], NAME_KINDS) };
    m = /^ref:([A-Z])$/.exec(s);
    if (m !== null) return { r: 'ref', kind: parseKind(m[1], REF_KINDS) };
    m = /^(buf|out-buf|in-f|out-f|out-i)\[(.+)\]$/.exec(s);
    if (m !== null) {
        const count = parseCount(m[2]);
        if (m[1] === 'buf') return { r: 'buf-n', count };
        return { r: m[1] as 'out-buf' | 'in-f' | 'out-f' | 'out-i', count };
    }
    m = /^(in-names|out-names):([A-Z])\[(.+)\]$/.exec(s);
    if (m !== null) return { r: m[1] as 'in-names' | 'out-names', kind: parseKind(m[2], NAME_KINDS), count: parseCount(m[3]) };
    throw new Error('bad role: ' + s);
}

export function parseReturnRole(s: string): ReturnRole {
    if (s === 'void' || s === 'int' || s === 'bool' || s === 'string') return { r: s };
    let m = /^ref:([A-Z])$/.exec(s);
    if (m !== null) return { r: 'ref', kind: parseKind(m[1], REF_KINDS) };
    m = /^alloc-lists\[\$([0-9])\]$/.exec(s);
    if (m !== null) return { r: 'alloc-lists', arg: Number(m[1]) };
    throw new Error('bad return role: ' + s);
}

function buildRules(): ReadonlyMap<string, EntryRule> {
    const map = new Map<string, EntryRule>();
    for (const [entry, descriptor, receiver, params, ret, flag] of ENTRY_RULE_SOURCE) {
        const rule: EntryRule = {
            entry,
            descriptor,
            receiver: receiver === '-' ? null : parseKind(receiver.slice(4), REF_KINDS),
            params: params === '' ? [] : params.split(' ').map(parseRole),
            ret: parseReturnRole(ret),
            deletion: flag === 'deletion',
            endsFrame: flag === 'ends-frame'
        };
        map.set(entry + descriptor, rule);
    }
    return map;
}

// Keyed by entry + descriptor, e.g. 'glBindTexture(II)V'.
export const ENTRY_RULES: ReadonlyMap<string, EntryRule> = /* @__PURE__ */ buildRules();

export function entryRule(entry: string, descriptor: string): EntryRule {
    const rule = ENTRY_RULES.get(entry + descriptor);
    if (rule === undefined) throw new Error('no GLTrace rule for ' + entry + descriptor);
    return rule;
}

// Evaluates a count against the call's raw arguments. A non-int argument counts 0 (it is itself a slip token).
export function evalCount(count: Count, args: readonly unknown[]): number {
    switch (count.k) {
        case 'n':
            return count.n;
        case 'arg': {
            const v = args[count.arg];
            return isInt32(v) && v > 0 ? v : 0;
        }
        case 'table': {
            const v = args[count.arg];
            const table = COUNT_TABLES[count.table];
            if (!isInt32(v)) return 1;
            const n = table[v];
            return n === undefined ? 1 : n;
        }
    }
}

// ---------------------------------------------------------------------------------------------------------
// Value encoders (GLTRACE.md sections 5-8). Each is total: a TS value the Java type cannot hold becomes a slip
// token, which no Java trace contains, so a port slip shows up as a divergence at that column.

function slipText(value: unknown): string {
    let s: string;
    if (typeof value === 'bigint') s = value.toString() + 'n';
    else if (typeof value === 'number') s = Object.is(value, -0) ? '-0' : String(value);
    else if (value === null) s = 'null';
    else if (typeof value === 'object') s = (value as object).constructor?.name ?? 'Object';
    else s = String(value);
    return s.replace(/[^\x21-\x7e]/g, '_');
}

// An int or byte -0 is written as 0 (`| 0` drops the sign): Java holds the same value as plain 0. A -0 that
// reaches a float parameter still shows there as f:80000000.
export function encodeInt(value: unknown): TraceValue {
    return isInt32(value) ? { t: 'int', v: value | 0 } : { t: 'slip', form: 'i?', text: slipText(value) };
}

export function encodeByte(value: unknown): TraceValue {
    return isInt32(value) && value >= -128 && value <= 127 ? { t: 'int', v: value | 0 } : { t: 'slip', form: 'b?', text: slipText(value) };
}

export function encodeFloat(value: unknown): TraceValue {
    if (typeof value === 'number' && (Number.isNaN(value) || Math.fround(value) === value)) return { t: 'float', bits: floatBits(value) };
    if (typeof value === 'number') return { t: 'slip', form: 'f?', text: hex16(doubleBits(value)) };
    return { t: 'slip', form: 'f?', text: slipText(value) };
}

export function encodeDouble(value: unknown): TraceValue {
    return typeof value === 'number' ? { t: 'double', bits: doubleBits(value) } : { t: 'slip', form: 'd?', text: slipText(value) };
}

export function encodeBool(value: unknown): TraceValue {
    return typeof value === 'boolean' ? { t: 'bool', v: value } : { t: 'slip', form: 'z?', text: slipText(value) };
}

export function encodeLong(value: unknown): TraceValue {
    return typeof value === 'bigint' && BigInt.asIntN(64, value) === value ? { t: 'long', v: value } : { t: 'slip', form: 'o?', text: slipText(value) };
}

// The text part of a string token: the UTF-8 bytes, each byte outside 0x21..0x7e and each '%' as %XX.
export function escapeText(bytes: Uint8Array): string {
    let s = '';
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i];
        if (b >= 0x21 && b <= 0x7e && b !== 0x25) s += String.fromCharCode(b);
        else s += '%' + HEX[b >>> 4].toUpperCase() + HEX[b & 15].toUpperCase();
    }
    return s;
}

export function unescapeText(text: string): Uint8Array {
    const out: number[] = [];
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c === 0x25) {
            out.push(parseInt(text.slice(i + 1, i + 3), 16));
            i += 2;
        } else {
            out.push(c);
        }
    }
    return Uint8Array.from(out);
}

const utf8 = new TextEncoder();

// The bytes of a string token (GLTRACE.md section 8): what java.lang.String.getBytes(Ljava/nio/charset/Charset;)[B
// returns for StandardCharsets.UTF_8, the call both Java recorders make (verified against JDK 21 in gl-trace.test.ts).
// A surrogate pair is one 4-byte sequence, and every unpaired surrogate (a high surrogate not followed by a low one,
// or a low surrogate not preceded by a high one) becomes Java's replacement byte '?' (0x3F). TextEncoder, and
// String.prototype.toWellFormed, would give U+FFFD (EF BF BD) instead. So the unpaired surrogates are replaced here,
// before encoding, and the native TextEncoder only ever sees a well-formed string. This also avoids a crash: Bun
// 1.2.14's TextEncoder panics ("Internal assertion failure", exit 134) when a string ends in an unpaired high
// surrogate that follows a non-surrogate unit, for example 'A\uD800' (an ASCII prefix is enough; '\uD800' alone,
// '\uD800\uD800' and 'A\uD800B' encode normally).
export function javaUtf8Bytes(value: string): Uint8Array {
    let wellFormed = '';
    let start = 0;
    for (let i = 0; i < value.length; i++) {
        const c = value.charCodeAt(i);
        if (c < 0xd800 || c > 0xdfff) continue;
        if (c < 0xdc00 && i + 1 < value.length) {
            const next = value.charCodeAt(i + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                i++;
                continue;
            }
        }
        wellFormed += value.slice(start, i) + '?';
        start = i + 1;
    }
    return utf8.encode(start === 0 ? value : wellFormed + value.slice(start));
}

export const INLINE_LIMIT = 256;

export type BlobSink = (sha: string, bytes: Uint8Array) => void;

export function encodeString(value: unknown, blobs: BlobSink | null = null): TraceValue {
    if (value === null) return { t: 'null' };
    if (typeof value !== 'string') return { t: 'slip', form: 'S?', text: slipText(value) };
    const bytes = javaUtf8Bytes(value);
    const sha = sha256Hex(bytes);
    if (blobs !== null) blobs(sha, bytes);
    return { t: 'string', len: bytes.length, sha, text: bytes.length <= INLINE_LIMIT ? escapeText(bytes) : null };
}

// A buffer token. `count` limits the hashed range to [pos, min(pos + count, lim)); null hashes [pos, lim).
export function encodeBuffer(value: unknown, count: number | null = null, blobs: BlobSink | null = null): TraceValue {
    if (value === null) return { t: 'null' };
    if (!(value instanceof Buffer)) return { t: 'slip', form: 'B?', text: slipText(value) };
    let kind: BufferTokenKind;
    try {
        kind = bufferKind(value);
    } catch {
        return { t: 'slip', form: 'B?', text: slipText(value) };
    }
    const pos = value.position();
    const lim = value.limit();
    const end = count === null ? lim : Math.min(lim, pos + Math.max(0, count));
    const bytes = bufferByteRange(value, pos, end);
    const sha = sha256Hex(bytes);
    if (blobs !== null) blobs(sha, bytes);
    return {
        t: 'buffer',
        kind,
        pos,
        lim,
        cap: value.capacity(),
        direct: value.isDirect(),
        sha,
        hex: bytes.length <= INLINE_LIMIT ? bytesToHex(bytes) : null
    };
}

export function encodeCaps(value: unknown): TraceValue {
    if (value === null) return { t: 'null' };
    if (!(value instanceof GLCapabilities)) return { t: 'slip', form: 'K?', text: slipText(value) };
    return {
        t: 'caps',
        doubleBuffered: value.getDoubleBuffered(),
        stereo: value.getStereo(),
        hardwareAccelerated: value.getHardwareAccelerated(),
        depthBits: value.getDepthBits(),
        stencilBits: value.getStencilBits(),
        redBits: value.getRedBits(),
        greenBits: value.getGreenBits(),
        blueBits: value.getBlueBits(),
        alphaBits: value.getAlphaBits(),
        accumRedBits: value.getAccumRedBits(),
        accumGreenBits: value.getAccumGreenBits(),
        accumBlueBits: value.getAccumBlueBits(),
        accumAlphaBits: value.getAccumAlphaBits(),
        sampleBuffers: value.getSampleBuffers(),
        numSamples: value.getNumSamples()
    };
}

// Elements [offset, offset + count) of a float[]: raw bits read from the array memory (NaN payloads kept);
// indices outside the array become the trailing missing count.
export function encodeFloatArray(value: unknown, offset: unknown, count: number): TraceValue {
    if (value === null) return { t: 'null' };
    if (!(value instanceof Float32Array)) return { t: 'slip', form: 'fv?', text: slipText(value) };
    const bits: number[] = [];
    const off = isInt32(offset) ? offset : -1;
    if (off >= 0) {
        const raw = new Uint32Array(value.buffer, value.byteOffset, value.length);
        for (let i = 0; i < count && off + i < raw.length; i++) bits.push(raw[off + i]);
    }
    return { t: 'fv', bits, missing: count - bits.length };
}

// Elements [offset, offset + count) of an int[], each passed through `elem` (plain int or a name).
export function encodeIntArray(value: unknown, offset: unknown, count: number, elem: (v: number) => IntElem): TraceValue {
    if (value === null) return { t: 'null' };
    if (!(value instanceof Int32Array)) return { t: 'slip', form: 'iv?', text: slipText(value) };
    const elems: IntElem[] = [];
    const off = isInt32(offset) ? offset : -1;
    if (off >= 0) {
        for (let i = 0; i < count && off + i < value.length; i++) elems.push(elem(value[off + i]));
    }
    return { t: 'iv', elems, missing: count - elems.length };
}

export function throwKind(e: unknown): ThrowKind {
    if (e instanceof GLException) return 'GLException';
    if (e instanceof JavaError) return 'Error';
    if (e instanceof JavaCheckedException) return 'Exception';
    if (e instanceof Error) return 'RuntimeException';
    return 'Throwable';
}

// ---------------------------------------------------------------------------------------------------------
// The record writer: frame and sequence numbering, name normalization and object references.

export interface GlTraceWriterOptions {
    readonly meta?: readonly string[];
    // Receives every buffer and string payload by hash (the side blob store of HD_PLAN 3.2).
    readonly blobs?: BlobSink | null;
}

export class GlTraceWriter {
    readonly records: TraceRecord[] = [];
    readonly meta: string[];
    readonly blobs: BlobSink | null;
    private frame = 0;
    private seq = 0;
    private deletions = 0;
    private readonly nameIds: Record<NameKind, Map<number, number>> = { T: new Map(), B: new Map(), L: new Map(), P: new Map() };
    private readonly nameCount: Record<NameKind, number> = { T: 0, B: 0, L: 0, P: 0 };
    private readonly liveNames: Record<NameKind, Set<number>> = { T: new Set(), B: new Set(), L: new Set(), P: new Set() };
    private readonly refIds: Record<RefKind, Map<object, number>> = { F: new Map(), D: new Map(), C: new Map(), G: new Map(), O: new Map() };
    private lastGL: object | null = null;

    constructor(options: GlTraceWriterOptions = {}) {
        this.meta = options.meta === undefined ? [] : [...options.meta];
        this.blobs = options.blobs ?? null;
    }

    // A name argument: 0 stays 0; an allocated raw name gives its id (the latest allocation of that raw value);
    // any other value gives the raw form #K?<value>.
    nameValue(kind: NameKind, raw: number): IntElem {
        if (raw === 0) return { t: 'int', v: 0 };
        const id = this.nameIds[kind].get(raw);
        return id === undefined ? { t: 'rawname', kind, v: raw } : { t: 'name', kind, id };
    }

    // An allocated name: 0 is not an allocation; every other value gets the next id of its kind, even when the
    // raw value was allocated before (a driver may reuse freed names).
    allocName(kind: NameKind, raw: number): IntElem {
        if (raw === 0) return { t: 'int', v: 0 };
        const id = ++this.nameCount[kind];
        this.nameIds[kind].set(raw, id);
        this.liveNames[kind].add(id);
        return { t: 'name', kind, id };
    }

    deleteName(kind: NameKind, raw: number): void {
        const id = this.nameIds[kind].get(raw);
        if (id !== undefined) this.liveNames[kind].delete(id);
    }

    // Live normalized ids of a kind, ascending (allocated and not deleted).
    live(kind: NameKind): number[] {
        return [...this.liveNames[kind]].sort((a, b) => a - b);
    }

    refValue(kind: RefKind, obj: object | null): TraceValue {
        if (obj === null) return { t: 'null' };
        const map = this.refIds[kind];
        let id = map.get(obj);
        if (id === undefined) {
            id = map.size + 1;
            map.set(obj, id);
        }
        return { t: 'ref', kind, id };
    }

    // Called before an ordered GL record: emits ~gl when the receiving GL object differs from the previous one.
    noteGL(gl: object): void {
        if (this.lastGL === gl) return;
        this.lastGL = gl;
        this.append('~gl', [this.refValue('G', gl)], null, null, false, false, null);
    }

    append(entry: string, args: readonly TraceValue[], ret: TraceValue | null, thrown: ThrowKind | null, deletion: boolean, endsFrame: boolean, stack: string | null): TraceRecord {
        const record: TraceRecord = {
            frame: this.frame,
            seq: deletion ? this.deletions++ : this.seq++,
            deletion,
            entry,
            args,
            ret,
            thrown,
            stack
        };
        this.records.push(record);
        if (endsFrame) {
            this.frame++;
            this.seq = 0;
            this.deletions = 0;
        }
        return record;
    }

    // A checkpoint for the live-object comparison (GLTRACE.md section 15).
    mark(label: string): void {
        if (!LABEL_RE.test(label)) throw new Error('bad mark label: ' + label);
        this.append('~mark', [{ t: 'label', text: label }], null, null, false, false, null);
    }

    currentFrame(): number {
        return this.frame;
    }

    text(): string {
        return serializeTrace({ meta: this.meta, records: this.records });
    }
}

// ---------------------------------------------------------------------------------------------------------
// SHA-256 (FIPS 180-4), synchronous and host-independent so the recorder also runs in the browser.

const K256 = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const W256 = new Uint32Array(64);

export function sha256Hex(data: Uint8Array): string {
    let h0 = 0x6a09e667,
        h1 = 0xbb67ae85,
        h2 = 0x3c6ef372,
        h3 = 0xa54ff53a;
    let h4 = 0x510e527f,
        h5 = 0x9b05688c,
        h6 = 0x1f83d9ab,
        h7 = 0x5be0cd19;
    const len = data.length;
    const total = ((len + 9 + 63) >>> 6) << 6;
    const tail = new Uint8Array(total - (len & ~63));
    tail.set(data.subarray(len & ~63));
    tail[len & 63] = 0x80;
    const bits = len * 8;
    const tv = new DataView(tail.buffer);
    tv.setUint32(tail.length - 8, Math.floor(bits / 0x100000000));
    tv.setUint32(tail.length - 4, bits >>> 0);
    const full = len & ~63;
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const w = W256;
    for (let block = 0; block < total; block += 64) {
        const fromTail = block >= full;
        for (let i = 0; i < 16; i++) w[i] = fromTail ? tv.getUint32(block - full + i * 4) : dv.getUint32(block + i * 4);
        for (let i = 16; i < 64; i++) {
            const a = w[i - 15],
                b = w[i - 2];
            const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
            const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
        }
        let a = h0,
            b = h1,
            c = h2,
            d = h3,
            e = h4,
            f = h5,
            g = h6,
            h = h7;
        for (let i = 0; i < 64; i++) {
            const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
            const ch = (e & f) ^ (~e & g);
            const t1 = (h + S1 + ch + K256[i] + w[i]) | 0;
            const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
            const maj = (a & b) ^ (a & c) ^ (b & c);
            const t2 = (S0 + maj) | 0;
            h = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
        }
        h0 = (h0 + a) | 0;
        h1 = (h1 + b) | 0;
        h2 = (h2 + c) | 0;
        h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0;
        h5 = (h5 + f) | 0;
        h6 = (h6 + g) | 0;
        h7 = (h7 + h) | 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map(hex8).join('');
}
