import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { joglPath } from '../render/hd-reference.js';
import type { GL } from '#/jogl/GL.js';
import GLContext from '#/jogl/GLContext.js';
import GLException from '#/jogl/GLException.js';
import GLU from '#/jogl/GLU.js';
import type Extract from '#/jogl/glu/mipmap/Extract.js';
import Extract1010102 from '#/jogl/glu/mipmap/Extract1010102.js';
import Extract1555rev from '#/jogl/glu/mipmap/Extract1555rev.js';
import Extract2101010rev from '#/jogl/glu/mipmap/Extract2101010rev.js';
import Extract233rev from '#/jogl/glu/mipmap/Extract233rev.js';
import Extract332 from '#/jogl/glu/mipmap/Extract332.js';
import Extract4444 from '#/jogl/glu/mipmap/Extract4444.js';
import Extract4444rev from '#/jogl/glu/mipmap/Extract4444rev.js';
import Extract5551 from '#/jogl/glu/mipmap/Extract5551.js';
import Extract565 from '#/jogl/glu/mipmap/Extract565.js';
import Extract565rev from '#/jogl/glu/mipmap/Extract565rev.js';
import Extract8888 from '#/jogl/glu/mipmap/Extract8888.js';
import Extract8888rev from '#/jogl/glu/mipmap/Extract8888rev.js';
import HalveImage from '#/jogl/glu/mipmap/HalveImage.js';
import Image from '#/jogl/glu/mipmap/Image.js';
import Mipmap from '#/jogl/glu/mipmap/Mipmap.js';
import PixelStorageModes from '#/jogl/glu/mipmap/PixelStorageModes.js';
import ScaleInternal from '#/jogl/glu/mipmap/ScaleInternal.js';
import NioBuffer from '#/util/nio/Buffer.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';
import ByteOrder from '#/util/nio/ByteOrder.js';
import FloatBuffer from '#/util/nio/FloatBuffer.js';
import IntBuffer from '#/util/nio/IntBuffer.js';
import ShortBuffer from '#/util/nio/ShortBuffer.js';
import BufferOverflowException from '#/util/nio/BufferOverflowException.js';
import BufferUnderflowException from '#/util/nio/BufferUnderflowException.js';
import InvalidMarkException from '#/util/nio/InvalidMarkException.js';
import { bufferByteRange, bufferBytes, bufferKind } from '#/util/nio/BufferBytes.js';
import { JavaError } from '#/util/JavaException.js';

// The shared harness of the GLU mipmap oracle tests (glu-mipmap.test.ts, glu-mipmap-full.test.ts).
// GluMipmapOracle.java runs each case through the real shipped jogl.jar GLU/Mipmap/Image code with a recording
// java.lang.reflect.Proxy GL; runCase runs it through the port with the same recorder written in TS. Both print every
// GL call with its arguments (pixel buffers as B:<kind>:<pos>:<lim>:<cap>:<direct|heap>:<hex of the bytes GL reads
// for [pos,lim)>, so every mipmap level's bytes are compared), the result or the exception class, the caller's buffer
// position/limit/mark afterwards, and the final pixel-store state. The `fill` entry calls Image.fill_image directly
// (its only jogl.jar caller passes GL_BITMAP) and also prints the whole output ShortBuffer; the `extract` entry runs
// one Extract class directly (extract, then shove of four given floats) and prints the components and every byte.
// The `halve` and `scale` entries call HalveImage.halveImage and ScaleInternal.scale_internal directly on a
// ShortBuffer of the case's shorts (their only jogl.jar caller, bitmapBuild2DMipmaps, hands them 1-component or
// all-0/all-0xFFFF data, which hides the component stride) and print the whole output ShortBuffer.
// probeReads and blockLine are a block-entry probe: which source lines of HalveImage.ts and ScaleInternal.ts read
// the image while some code runs, and the line of a given block's first read.

export const GL_TEXTURE_2D = 3553,
    GL_RGBA = 6408,
    GL_UNSIGNED_BYTE = 5121;
export const STORE = [3312, 3313, 3314, 3315, 3316, 3317, 3328, 3329, 3330, 3331, 3332, 3333];
export const DEFAULT_STORE = [0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 4];
export const NVIDIA = '2.1.2 NVIDIA 169.21';

export type DataKind = 'bbheap' | 'bbdirect' | 'sbheap' | 'sbdirect' | 'ibheap' | 'fbheap' | 'bytes' | 'shorts' | 'ints' | 'floats' | 'null' | 'object';

export interface Case {
    id: string;
    entry: 'glu' | 'noctx' | 'mipmap' | 'fill' | 'extract' | 'halve' | 'scale';
    target: number;
    ifmt: number;
    w: number;
    h: number;
    fmt: number;
    type: number;
    data: DataKind;
    pos: number;
    bytes: Uint8Array;
    ver: string | null;
    max: number;
    store: number[];
    fault: string;
    cap: number;
    index: boolean; // fill/halve/scale entries: output ShortBuffer capacity in bytes; fill_image's index_format
    // extract entry: <be|le>,<swap 0|1>,<shove index>,<4 shove floats as raw int bits in hex>
    // halve entry: <components>; scale entry: <components>,<widthout>,<heightout> (w and h are the input size)
    x: string;
}

// mulberry32
export function random(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function randomBytes(length: number, seed: number): Uint8Array {
    const next = random(seed);
    return Uint8Array.from({ length }, () => Math.floor(next() * 256));
}

// float payloads never NaN or infinite (bit 30 of each big-endian float clear), so every float survives any host
// conversion
export function floatSafe(bytes: Uint8Array): Uint8Array {
    const copy = bytes.slice();
    for (let i = 0; i < copy.length; i += 4) copy[i] = (copy[i] ?? 0) & 0xbf;
    return copy;
}

export function make(id: string, w: number, h: number, extra: Partial<Case> = {}): Case {
    const c: Case = {
        id,
        entry: 'glu',
        target: GL_TEXTURE_2D,
        ifmt: GL_RGBA,
        w,
        h,
        fmt: GL_RGBA,
        type: GL_UNSIGNED_BYTE,
        data: 'bbheap',
        pos: 0,
        bytes: new Uint8Array(0),
        ver: NVIDIA,
        max: 4096,
        store: DEFAULT_STORE,
        fault: '-',
        cap: 0,
        index: false,
        x: '-',
        ...extra
    };
    if (extra.bytes === undefined) c.bytes = randomBytes(Math.max(0, w) * Math.max(0, h) * 4, id.length * 7919 + w * 31 + h);
    return c;
}

export function store(changes: Record<number, number>): number[] {
    return STORE.map((key, i) => changes[key] ?? DEFAULT_STORE[i] ?? 0);
}

export function hex(bytes: Uint8Array): string {
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function utf16(s: string): string {
    return Array.from({ length: s.length }, (_, i) => s.charCodeAt(i).toString(16).padStart(4, '0')).join('');
}

function inputLine(c: Case): string {
    return [
        'id=' + c.id,
        'entry=' + c.entry,
        'target=' + c.target,
        'ifmt=' + c.ifmt,
        'w=' + c.w,
        'h=' + c.h,
        'fmt=' + c.fmt,
        'type=' + c.type,
        'data=' + c.data,
        'pos=' + c.pos,
        'hex=' + (c.bytes.length === 0 ? '-' : hex(c.bytes)),
        'ver=' + (c.ver === null ? 'null' : utf16(c.ver)),
        'max=' + c.max,
        'store=' + c.store.join(','),
        'fault=' + c.fault,
        'cap=' + c.cap,
        'index=' + (c.index ? 1 : 0),
        'x=' + c.x
    ].join(' ');
}

export function javaName(e: unknown): string {
    if (e instanceof GLException) return 'javax.media.opengl.GLException';
    if (e instanceof BufferUnderflowException) return 'java.nio.BufferUnderflowException';
    if (e instanceof BufferOverflowException) return 'java.nio.BufferOverflowException';
    if (e instanceof InvalidMarkException) return 'java.nio.InvalidMarkException';
    if (e instanceof JavaError) return 'java.lang.' + e.message;
    if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) return 'java.lang.NullPointerException';
    if (e instanceof RangeError && e.message === '/ by zero') return 'java.lang.ArithmeticException';
    if (e instanceof RangeError && e.message.startsWith('StringIndexOutOfBoundsException')) return 'java.lang.StringIndexOutOfBoundsException';
    if (e instanceof RangeError && e.message === 'IndexOutOfBoundsException') return 'java.lang.IndexOutOfBoundsException';
    if (e instanceof RangeError && e.message.startsWith('array index ')) return 'java.lang.ArrayIndexOutOfBoundsException';
    if (e instanceof Error) {
        const named = /^(IllegalArgumentException|NumberFormatException|RuntimeException)(?::|$)/.exec(e.message);
        if (named !== null) return 'java.lang.' + named[1];
    }
    return 'HOST:' + String(e);
}

// A GL pixel buffer: B:<kind>:<pos>:<lim>:<cap>:<direct|heap>:<bytes GL reads for [pos, lim)>
function bufferLine(b: unknown): string {
    if (b === null) return 'null';
    if (!(b instanceof NioBuffer)) throw new Error('recorder: non-buffer reached GL');
    const direct = b instanceof ByteBuffer || b instanceof ShortBuffer || b instanceof IntBuffer || b instanceof FloatBuffer ? b.isDirect() : false;
    return 'B:' + bufferKind(b) + ':' + b.position() + ':' + b.limit() + ':' + b.capacity() + ':' + (direct ? 'direct' : 'heap') + ':' + hex(bufferBytes(b));
}

// The TS twin of GluMipmapOracle.handle: same answers, same state, same line format.
class Recorder {
    lines: string[] = [];
    seq = 0;
    calls = new Map<string, number>();
    store = new Map<number, number>();
    proxyTarget = 0;
    proxyLevel = 0;
    proxyW = 0;
    proxyH = 0;
    faultMethod: string | null = null;
    faultCall = 0;
    faultKind = '';

    constructor(readonly c: Case) {
        STORE.forEach((key, i) => this.store.set(key, c.store[i] ?? 0));
        if (c.fault !== '-') {
            const [method, nth, kind] = c.fault.split('#');
            this.faultMethod = method ?? null;
            this.faultCall = Number(nth);
            this.faultKind = kind ?? '';
        }
    }

    static proxy(target: number): boolean {
        return target === 32867 || target === 32868 || target === 34075;
    }

    handle(name: string, args: unknown[]): unknown {
        const count = (this.calls.get(name) ?? 0) + 1;
        this.calls.set(name, count);
        let line = ++this.seq + '\t' + name;
        const fault = name === this.faultMethod && count === this.faultCall;
        let result: unknown = undefined;
        const int = (i: number) => {
            const v = args[i];
            if (typeof v !== 'number') throw new Error('recorder: ' + name + ' argument ' + i);
            return v;
        };
        const ints = (i: number) => {
            const v = args[i];
            if (!(v instanceof Int32Array)) throw new Error('recorder: ' + name + ' argument ' + i);
            return v;
        };
        switch (name) {
            case 'glGetString': {
                line += '\t' + int(0);
                if (!fault) {
                    if (int(0) !== 7938) throw new Error('recorder: glGetString ' + int(0));
                    result = this.c.ver;
                    line += '\t=> ' + (this.c.ver === null ? 'null' : 'S:' + utf16(this.c.ver));
                }
                break;
            }
            case 'glGetIntegerv': {
                const pname = int(0),
                    params = ints(1),
                    offset = int(2);
                line += '\t' + pname + '\tI' + params.length + '@' + offset;
                if (!fault) {
                    let value: number;
                    const stored = this.store.get(pname);
                    if (pname === 3379) value = this.c.max;
                    else if (stored !== undefined) value = stored;
                    else throw new Error('recorder: glGetIntegerv ' + pname);
                    params[offset] = value;
                    line += '\t=> ' + value;
                }
                break;
            }
            case 'glGetTexLevelParameteriv': {
                const target = int(0),
                    level = int(1),
                    pname = int(2),
                    params = ints(3),
                    offset = int(4);
                line += '\t' + target + '\t' + level + '\t' + pname + '\tI' + params.length + '@' + offset;
                if (!fault) {
                    if (pname !== 4096) throw new Error('recorder: glGetTexLevelParameteriv ' + pname);
                    const value = target === this.proxyTarget && level === this.proxyLevel && this.proxyW << level <= this.c.max && this.proxyH << level <= this.c.max ? this.proxyW : 0;
                    params[offset] = value;
                    line += '\t=> ' + value;
                }
                break;
            }
            case 'glTexImage2D': {
                for (let i = 0; i < 8; i++) line += '\t' + int(i);
                line += '\t' + bufferLine(args[8]);
                if (!fault && Recorder.proxy(int(0))) {
                    this.proxyTarget = int(0);
                    this.proxyLevel = int(1);
                    this.proxyW = int(3);
                    this.proxyH = int(4);
                }
                break;
            }
            case 'glTexImage1D': {
                for (let i = 0; i < 7; i++) line += '\t' + int(i);
                line += '\t' + bufferLine(args[7]);
                if (!fault && Recorder.proxy(int(0))) {
                    this.proxyTarget = int(0);
                    this.proxyLevel = int(1);
                    this.proxyW = int(3);
                    this.proxyH = 1;
                }
                break;
            }
            case 'glPixelStorei': {
                const pname = int(0),
                    param = int(1);
                line += '\t' + pname + '\t' + param;
                if (!this.store.has(pname)) throw new Error('recorder: glPixelStorei ' + pname);
                if (!fault) this.store.set(pname, param);
                break;
            }
            default:
                throw new Error('recorder: unexpected GL call ' + name);
        }
        if (fault) line += '\t!! ' + this.faultKind;
        this.lines.push(line);
        if (fault) {
            if (this.faultKind === 'gle') throw new GLException('fault');
            throw new Error('RuntimeException: fault');
        }
        return result;
    }

    gl(): GL {
        return new Proxy(
            {},
            {
                get: (_target, prop) => {
                    return (...args: unknown[]) => this.handle(String(prop), args);
                }
            }
        ) as unknown as GL;
    }
}

class FakeContext extends GLContext {
    constructor(readonly gl: GL) {
        super();
    }
    makeCurrent(): number {
        GLContext.setCurrent(this);
        return GLContext.CONTEXT_CURRENT;
    }
    release(): void {
        GLContext.setCurrent(null);
    }
    destroy(): void {}
    getGL(): GL {
        return this.gl;
    }
}

function view(bytes: Uint8Array): DataView {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function shortsOf(bytes: Uint8Array): Int16Array {
    return Int16Array.from({ length: bytes.length >> 1 }, (_, i) => view(bytes).getInt16(i * 2, false));
}

function intsOf(bytes: Uint8Array): Int32Array {
    return Int32Array.from({ length: bytes.length >> 2 }, (_, i) => view(bytes).getInt32(i * 4, false));
}

function floatsOf(bytes: Uint8Array): Float32Array {
    return new Float32Array(intsOf(bytes).buffer);
}

function data(c: Case): object | null {
    const bytes = Int8Array.from(c.bytes, b => (b << 24) >> 24);
    switch (c.data) {
        case 'bbheap':
            return ByteBuffer.wrap(bytes).position(c.pos);
        case 'bbdirect':
            return ByteBuffer.allocateDirect(bytes.length).put(bytes).position(c.pos);
        case 'sbheap':
            return ShortBuffer.wrap(shortsOf(c.bytes)).position(c.pos);
        case 'sbdirect': {
            // a native-order direct view, as bitmapBuild2DMipmaps allocates its ShortBuffers
            const shorts = shortsOf(c.bytes);
            return ByteBuffer.allocateDirect(shorts.length * 2)
                .order(ByteOrder.nativeOrder())
                .asShortBuffer()
                .put(shorts)
                .position(c.pos);
        }
        case 'ibheap':
            return IntBuffer.wrap(intsOf(c.bytes)).position(c.pos);
        case 'fbheap':
            return FloatBuffer.wrap(floatsOf(c.bytes)).position(c.pos);
        case 'bytes':
            return bytes;
        case 'shorts':
            return shortsOf(c.bytes);
        case 'ints':
            return intsOf(c.bytes);
        case 'floats':
            return floatsOf(c.bytes);
        case 'null':
            return null;
        case 'object':
            return {};
    }
}

function extractFor(type: number): Extract {
    switch (type) {
        case 32818:
            return new Extract332();
        case 33634:
            return new Extract233rev();
        case 33635:
            return new Extract565();
        case 33636:
            return new Extract565rev();
        case 32819:
            return new Extract4444();
        case 33637:
            return new Extract4444rev();
        case 32820:
            return new Extract5551();
        case 33638:
            return new Extract1555rev();
        case 32821:
            return new Extract8888();
        case 33639:
            return new Extract8888rev();
        case 32822:
            return new Extract1010102();
        case 33640:
            return new Extract2101010rev();
        default:
            throw new Error('harness: extract type ' + type);
    }
}

function floatBits(v: number): string {
    return ((new Int32Array(new Float32Array([v]).buffer)[0] ?? 0) >>> 0).toString(16);
}

function bitsFloat(hexBits: string): number {
    return new Float32Array(new Int32Array([parseInt(hexBits, 16) | 0]).buffer)[0] ?? 0;
}

export function runCase(c: Case): string[] {
    const recorder = new Recorder(c);
    const gl = recorder.gl();
    const context = new FakeContext(gl);
    const d = data(c);
    const lines = ['case\t' + c.id];
    let image: ShortBuffer | null = null;
    let probe: ByteBuffer | null = null;
    const extracted: string[] = [];
    try {
        let result: number;
        if (c.entry === 'mipmap') {
            context.release();
            result = Mipmap.gluBuild2DMipmaps(gl, c.target, c.ifmt, c.w, c.h, c.fmt, c.type, d);
        } else if (c.entry === 'fill') {
            context.release();
            const psm = new PixelStorageModes();
            Mipmap.retrieveStoreModes(gl, psm);
            image = ByteBuffer.allocateDirect(c.cap).order(ByteOrder.nativeOrder()).asShortBuffer();
            if (d !== null && !(d instanceof ByteBuffer)) throw new Error('fill takes a java.nio.ByteBuffer');
            Image.fill_image(psm, c.w, c.h, c.fmt, c.type, c.index, d, image);
            result = 0;
        } else if (c.entry === 'extract') {
            context.release();
            const x = c.x.split(',');
            if (!(d instanceof ByteBuffer)) throw new Error('extract takes a java.nio.ByteBuffer');
            probe = d;
            d.order(x[0] === 'le' ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN);
            const e = extractFor(c.type);
            const got = new Float32Array(4);
            try {
                e.extract(x[1] === '1', d, got);
                extracted.push('extract\t' + d.position() + '\t' + Array.from(got, floatBits).join('\t'));
            } catch (error) {
                extracted.push('extract-throw\t' + javaName(error));
            }
            d.position(c.pos);
            const put = Float32Array.from({ length: 4 }, (_, k) => bitsFloat(x[3 + k] ?? '0'));
            e.shove(put, Number(x[2]), d);
            result = 0;
        } else if (c.entry === 'halve' || c.entry === 'scale') {
            context.release();
            const x = c.x.split(',').map(Number);
            if (!(d instanceof ShortBuffer)) throw new Error(c.entry + ' takes a java.nio.ShortBuffer');
            image = ByteBuffer.allocateDirect(c.cap).order(ByteOrder.nativeOrder()).asShortBuffer();
            if (c.entry === 'halve') HalveImage.halveImage(x[0] ?? 0, c.w, c.h, d, image);
            else ScaleInternal.scale_internal(x[0] ?? 0, c.w, c.h, d, x[1] ?? 0, x[2] ?? 0, image);
            result = 0;
        } else {
            if (c.entry === 'glu') context.makeCurrent();
            else context.release();
            if (d !== null && !(d instanceof NioBuffer)) throw new Error('GLU takes a java.nio.Buffer');
            result = new GLU().gluBuild2DMipmaps(c.target, c.ifmt, c.w, c.h, c.fmt, c.type, d);
        }
        lines.push(...recorder.lines, ...extracted, 'result\t' + result);
    } catch (e) {
        lines.push(...recorder.lines, ...extracted, 'throw\t' + javaName(e));
    } finally {
        context.release();
    }
    if (d instanceof NioBuffer) lines.push('data\t' + d.position() + '\t' + d.limit() + '\t' + d.markValue());
    if (probe !== null) lines.push('bytes\t' + hex(bufferByteRange(probe, 0, probe.capacity())));
    if (image !== null) lines.push('image\t' + image.position() + '\t' + image.limit() + '\t' + hex(bufferByteRange(image, 0, image.capacity())));
    lines.push('store\t' + STORE.map(key => recorder.store.get(key)).join('\t'));
    return lines;
}

export function javaRun(cases: Case[]): Map<string, string[]> {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-glu-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', joglPath, '-d', dir, join(import.meta.dir, 'GluMipmapOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const run = Bun.spawnSync(['java', '--add-opens', 'java.base/java.nio=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + joglPath, 'GluMipmapOracle'], {
            stdin: Buffer.from(cases.map(inputLine).join('\n') + '\n'),
            maxBuffer: 1024 * 1024 * 1024,
            timeout: 300000
        });
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        const blocks = new Map<string, string[]>();
        let current: string[] | null = null;
        for (const line of run.stdout.toString().split(/\r?\n/)) {
            if (line.startsWith('case\t')) {
                current = [line];
                blocks.set(line.slice(5), current);
            } else if (line.length > 0) {
                if (current === null) throw new Error('oracle output before the first case: ' + line);
                current.push(line);
            }
        }
        return blocks;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

export function clip(line: string | undefined): string {
    return line === undefined ? '<none>' : line.length > 300 ? line.slice(0, 300) + '...(' + line.length + ' chars)' : line;
}

// Runs every case through both sides and returns the first differing line of each mismatching case.
export function compareAll(cases: Case[], java: Map<string, string[]>): string[] {
    const mismatches: string[] = [];
    for (const c of cases) {
        const j = java.get(c.id);
        if (j === undefined) {
            mismatches.push(c.id + ': no oracle output');
            continue;
        }
        const t = runCase(c);
        for (let i = 0; i < Math.max(t.length, j.length); i++) {
            if (t[i] !== j[i]) {
                mismatches.push(c.id + ' line ' + i + '\n  java: ' + clip(j[i]) + '\n  ts:   ' + clip(t[i]));
                break;
            }
        }
    }
    return mismatches;
}

// Block-entry probe. A block is named by its method and a path of source-text anchors, each searched for after the
// previous one inside that method; the block's line is the first image read (`datain.get...`) after the last anchor.
// probeReads runs `run` with the ByteBuffer reads (get, getShort, getInt, getFloat) wrapped, and returns the
// '<file>:<line>' of every read made directly from HalveImage.ts or ScaleInternal.ts (the caller's frame of a
// three-frame stack; Bun reports TypeScript source lines). The wrapper only observes: it calls the original read.
export type ProbeFile = 'HalveImage' | 'ScaleInternal';
export interface Block {
    file: ProbeFile;
    method: string;
    path: string[];
}

export function blockLine(block: Block): number {
    const source = readFileSync(join(import.meta.dir, '../../src/jogl/glu/mipmap', block.file + '.ts'), 'utf8').split(/\r?\n/);
    let at = source.findIndex(line => line.includes('static ' + block.method + '('));
    if (at < 0) throw new Error('probe: ' + block.file + ' has no method ' + block.method);
    const start = at;
    let end = source.findIndex((line, i) => i > start && /^ {4}static /.test(line));
    if (end < 0) end = source.length;
    for (const anchor of [...block.path, 'datain.get']) {
        const from = at;
        const next = source.findIndex((line, i) => i > from && i < end && line.includes(anchor));
        if (next < 0) throw new Error('probe: ' + block.method + ' has no "' + anchor + '" after line ' + (from + 1));
        at = next;
    }
    return at + 1;
}

export function probeReads(run: () => void): Set<string> {
    const hits = new Set<string>();
    const proto = ByteBuffer.prototype;
    const names = ['get', 'getShort', 'getInt', 'getFloat'];
    const originals = names.map(name => {
        const original: unknown = Reflect.get(proto, name);
        if (typeof original !== 'function') throw new Error('probe: ByteBuffer.' + name + ' is not a method');
        return original;
    });
    const limit = Error.stackTraceLimit;
    Error.stackTraceLimit = 3;
    try {
        names.forEach((name, i) => {
            const original = originals[i];
            Reflect.set(proto, name, function (this: ByteBuffer, ...args: unknown[]): unknown {
                const caller = (new Error().stack ?? '').split('\n')[2] ?? '';
                const frame = /[\\/](HalveImage|ScaleInternal)\.ts:(\d+):\d+\)?$/.exec(caller);
                if (frame !== null) hits.add(frame[1] + ':' + frame[2]);
                return Reflect.apply(original, this, args);
            });
        });
        run();
    } finally {
        names.forEach((name, i) => Reflect.set(proto, name, originals[i]));
        Error.stackTraceLimit = limit;
    }
    return hits;
}
