import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import Crc32 from '../../src/io/Crc32.js';
import SoftwareAlphaSprite from '../../src/graphics/SoftwareAlphaSprite.js';
import SoftwareFont from '../../src/graphics/SoftwareFont.js';
import Pix8 from '../../src/graphics/Pix8.js';
import Pix32 from '../../src/graphics/Pix32.js';
import SpriteLoader from '../../src/graphics/SpriteLoader.js';
import { arrayPut } from '../../src/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';

// SpriteLoader (a logical class built from statics of og, mk, ja, hl, df, ed, oc, p, pk, qd, vi, ud, rk, uk, tf, gi, ha,
// ii, lc, ml, nh, oh, qc, sj, u, wb and wh) against client.jar.
//
// The test writes one script. spriteloader/SpriteLoaderOracle.java runs it on the real gamepack statics and this file
// runs it through the TS port. Every line reports the outcome (ok or the Java exception), a digest of the return value
// (each sprite's geometry and a hash of its pixels; for ch also its palette; for fg the font metrics and glyph masks)
// and the full staging state: lc.q, ad.g, lh.g and hashes of qj.B, ff.s, jh.l, df.H, ke.m, every vg.hb and tb.d plane
// and c.v. A throwing operation reports the state it left behind too.
//
// Inputs: all 1,707 groups of cache archive 8, read through a real al on the Java side and Js5Archive on the TS side,
// each group once through a rotating loader and once through ja.a plus a rotating builder; the 18 font groups through
// ja.a and tf.a with their archive 13 metrics. Then seeded synthetic sprite files covering row- and column-major
// frames, alpha planes (with and without non-0xff alpha), zero-size frames, palette indices past the palette, zero
// palette entries and 256-frame font sheets, plus truncated, bit-flipped and recounted copies of synthetic and real
// files, followed by every builder (twice, so the second runs on the freed staging), staging arrays nulled or
// shortened, and loader edge cases (null archive, missing group or file).

const SYNTHETIC_CASES = 2500;
const FONT_GROUPS = [305, 307, 468, 473, 494, 495, 496, 497, 584, 591, 645, 646, 647, 648, 764, 776, 819, 1591];
const LOADERS = ['ja', 'hl', 'gi', 'ha', 'ii', 'lc', 'ml', 'nh', 'oh', 'qc', 'sj', 'u', 'wb'];
const BUILDERS = ['df', 'ed', 'oc', 'p', 'pk', 'qd', 'vi', 'ud', 'rk', 'uk', 'tf'];
// Allocation guard: the decoder and builders allocate width*height per frame, so inputs whose sizes would ask for
// gigabytes are skipped (negative products still go through: they throw NegativeArraySizeException on both sides).
const MAX_FRAME = 1 << 20;
const MAX_TOTAL = 1 << 22;

class Rng {
    constructor(private state: number) {}

    next(): number {
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.state = x | 0;
        return this.state;
    }

    int(lo: number, hi: number): number {
        const n = hi - lo + 1;
        return lo + (((this.next() % n) + n) % n);
    }

    pick<T>(values: readonly T[]): T {
        return values[this.int(0, values.length - 1)];
    }

    chance(n: number): boolean {
        return this.int(0, n - 1) === 0;
    }
}

const b64 = (b: Uint8Array) => Buffer.from(b).toString('base64');
const tBytes = (b: Uint8Array | null) => (b === null ? 'n' : 'b' + b64(b));
const fromToken = (t: string): Uint8Array | null => (t === 'n' ? null : new Uint8Array(Buffer.from(t.slice(1), 'base64')));

// The JS5 container without the two-byte version trailer that the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

function runOracle(script: string): string[] {
    const source = fileURLToPath(new URL('./spriteloader/SpriteLoaderOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'spriteloader-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Xmx1g', '-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'SpriteLoaderOracle'], {
            input: script,
            timeout: 240000,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 1024
        });
        if (java.status !== 0) throw new Error(`oracle failed (${java.status} ${java.signal}): ${java.stderr}`);
        return java.stdout
            .split('\n')
            .map(line => line.trimEnd())
            .filter(line => line.length > 0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

// ---- digests (identical to the oracle's) ----

function ints(a: Int32Array | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0;
    return `${a.length}:${h}`;
}

function planeHash(p: Uint8Array): number {
    let h = p.length;
    for (let i = 0; i < p.length; i++) h = (Math.imul(h, 31) + (p[i] & 255)) | 0;
    return h;
}

const bytes = (a: Uint8Array | null) => (a === null ? 'null' : String(planeHash(a)));

function planes(a: (Uint8Array | null)[] | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (const p of a) h = (Math.imul(h, 31) + (p === null ? 7 : planeHash(p))) | 0;
    return `${a.length}:${h}`;
}

function bools(a: boolean[] | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (const v of a) h = (Math.imul(h, 31) + (v ? 2 : 1)) | 0;
    return `${a.length}:${h}`;
}

function staging(): string {
    const s = SpriteLoader;
    return `${s.count},${s.canvasWidth},${s.height} ${ints(s.xOffsets)} ${ints(s.yOffsets)} ${ints(s.widths)} ${ints(s.innerHeights)} ${ints(s.palette)} ${planes(s.pixels)} ${planes(s.alphas)} ${bools(s.hasAlpha)}`;
}

function digest(o: unknown): string {
    if (o === null || o === undefined) return 'null';
    if (typeof o === 'boolean' || typeof o === 'number') return String(o);
    if (Array.isArray(o)) return '[' + o.map(digest).join(';') + ']';
    if (o instanceof Pix32) {
        return `${o instanceof SoftwareAlphaSprite ? 'vh' : 'rh'}:${o.height},${o.width},${o.yOffset},${o.cropH},${o.xOffset},${o.cropW},${ints(o.pixels)}`;
    }
    if (o instanceof Pix8) {
        return `ch:${o.xOffset},${o.cropH},${o.yOffset},${o.width},${o.height},${o.cropW},${bytes(o.pixels)},${ints(o['palette'])}`;
    }
    if (o instanceof SoftwareFont) {
        return `fg:${o.lineHeight},${o['paddingTop']},${o['paddingBottom']},${ints(o['glyphHeights'])},${ints(o['glyphYOffsets'])},${ints(o['glyphXOffsets'])},${ints(o['glyphWidths'])},${ints(o['glyphAdvances'])},${bytes(o['kerning'])},${planes(o['glyphMasks'])}`;
    }
    throw new Error('unexpected value ' + String(o));
}

function classify(e: unknown): string {
    if (e instanceof TypeError && /^Null (reference|array|byte array)$/.test(e.message)) return 'npe';
    if (e instanceof RangeError) {
        if (e.message === '/ by zero') return 'arith';
        if (e.message.startsWith('array index ') || e.message.startsWith('byte array index ')) return 'aioobe';
        if (/negative|Invalid typed array length|Invalid array length/.test(e.message)) return 'neg';
    }
    if (e instanceof Error && e.constructor === Error) return 'rt';
    throw e;
}

// ---- the TS side ----

// The JS5 provider behind both archives: it serves the index and group containers the script supplied, like the
// oracle's ud subclass.
class Provider extends Js5ResourceProvider {
    constructor(
        private readonly table: Js5Index | null,
        private readonly groups: Map<number, Uint8Array>
    ) {
        super();
    }

    index(): Js5Index | null {
        return this.table;
    }

    group(_mode: number, group: number): Uint8Array | null {
        return this.groups.get(group) ?? null;
    }

    prefetchGroup(_group: number): void {}

    GetGroupLoadPercentage(_group: number): number {
        return 100;
    }
}

class Runner {
    readonly indexes = new Map<number, Uint8Array>();
    readonly groups = new Map<number, Map<number, Uint8Array>>();
    readonly archives = new Map<number, Js5>();

    archive(tok: string): Js5 | null {
        return tok === 'n' ? null : (this.archives.get(Number(tok)) ?? null);
    }

    run(a: string[]): unknown {
        switch (a[0]) {
            case 'idx':
                this.indexes.set(Number(a[1]), fromToken(a[2]) ?? new Uint8Array(0));
                return null;
            case 'grp': {
                const id = Number(a[1]);
                let map = this.groups.get(id);
                if (map === undefined) {
                    map = new Map();
                    this.groups.set(id, map);
                }
                map.set(Number(a[2]), fromToken(a[3]) ?? new Uint8Array(0));
                return null;
            }
            case 'arch': {
                const id = Number(a[1]);
                const src = this.indexes.get(id);
                const table = src === undefined ? null : new Js5Index(src, Crc32.prefix(src, src.length));
                this.archives.set(id, new Js5(new Provider(table, this.groups.get(id) ?? new Map()), a[2] === '1', a[3] === '1'));
                return null;
            }
            case 'dec':
                SpriteLoader.decode(fromToken(a[1]));
                return null;
            case 'clear':
                SpriteLoader.clear();
                return null;
            case 'total':
                return SpriteLoader.total();
            case 'drop':
                switch (a[1]) {
                    case 'q':
                        SpriteLoader.count = Number(a[2]);
                        break;
                    case 'X':
                        SpriteLoader.xOffsets = null;
                        break;
                    case 'Y':
                        SpriteLoader.yOffsets = null;
                        break;
                    case 'W':
                        SpriteLoader.widths = null;
                        break;
                    case 'H':
                        SpriteLoader.innerHeights = null;
                        break;
                    case 'P':
                        SpriteLoader.palette = null;
                        break;
                    case 'pix':
                        SpriteLoader.pixels = null;
                        break;
                    case 'alp':
                        SpriteLoader.alphas = null;
                        break;
                    case 'has':
                        SpriteLoader.hasAlpha = null;
                        break;
                    case 'pix0':
                        arrayPut(SpriteLoader.pixels, 0, null);
                        break;
                    case 'alp0':
                        arrayPut(SpriteLoader.alphas, 0, null);
                        break;
                    case 'pal1':
                        SpriteLoader.palette = new Int32Array(1);
                        break;
                    default:
                        throw new Error('bad drop ' + a[1]);
                }
                return null;
            case 'build':
                switch (a[1]) {
                    case 'df':
                        return SpriteLoader.toSoftwareSprite();
                    case 'ed':
                        return SpriteLoader.toSoftwareSprites();
                    case 'oc':
                        return SpriteLoader.createSoftwareSprites();
                    case 'p':
                        return SpriteLoader.createSprites();
                    case 'pk':
                        return SpriteLoader.toSprite();
                    case 'qd':
                        return SpriteLoader.toIndexedSprites();
                    case 'vi':
                        return SpriteLoader.createIndexedSprites();
                    case 'ud':
                        return SpriteLoader.createSprite();
                    case 'rk':
                        return SpriteLoader.createIndexedSprite();
                    case 'uk':
                        return SpriteLoader.createIndexedSprite2(Number(a[2]));
                    case 'tf':
                        return SpriteLoader.createFont(fromToken(a[2]));
                    default:
                        throw new Error('bad build ' + a[1]);
                }
            case 'ldr': {
                const arch = this.archive(a[2]);
                const x = Number(a[3]);
                const y = a.length > 4 ? Number(a[4]) : 0;
                switch (a[1]) {
                    case 'ja':
                        return SpriteLoader.load(x, y, arch);
                    case 'hl':
                        return SpriteLoader.loadGroup(arch, x);
                    case 'gi':
                        return SpriteLoader.loadSoftwareSpriteWithAlpha(x, arch, y);
                    case 'ha':
                        return SpriteLoader.loadSoftwareSprites(x, arch, y);
                    case 'ii':
                        return SpriteLoader.loadSprite(x, arch);
                    case 'lc':
                        return SpriteLoader.loadIndexedSprites(arch, x);
                    case 'ml':
                        return SpriteLoader.loadSprite2(arch, x, y);
                    case 'nh':
                        return SpriteLoader.loadSprites(x, arch, y);
                    case 'oh':
                        return SpriteLoader.loadSprites2(x, arch, y);
                    case 'qc':
                        return SpriteLoader.loadIndexedSprite(x, arch, y);
                    case 'sj':
                        return SpriteLoader.loadSprite3(x, arch);
                    case 'u':
                        return SpriteLoader.loadIndexedSprite2(x, arch);
                    case 'wb':
                        return SpriteLoader.loadIndexedSprites2(x, y, arch);
                    default:
                        throw new Error('bad loader ' + a[1]);
                }
            }
            default:
                throw new Error('bad op ' + a[0]);
        }
    }

    execute(index: number, line: string): string {
        const a = line.split(' ');
        let result = 'ok';
        let value = '-';
        try {
            value = digest(this.run(a));
        } catch (e) {
            result = classify(e);
        }
        return `${index} ${a[0]} ${result} ${value} ${staging()}`;
    }
}

// ---- script ----

type Frame = { w: number; h: number; flags: number; pixels: number[]; alphas: number[] };

// Writes the og.a format: frame data from 0 (flags byte, w*h index bytes, then w*h alpha bytes when flags & 2; column
// major when flags & 1), the palette (paletteSize - 1 three-byte entries), then the trailer: canvas width, canvas
// height, paletteSize - 1, the x offsets, y offsets, widths and heights of every frame and finally the frame count.
function encode(canvasW: number, canvasH: number, palette: number[], xOffs: number[], yOffs: number[], frames: Frame[]): Uint8Array {
    const out: number[] = [];
    for (const f of frames) {
        out.push(f.flags & 255);
        const plane = (src: number[]) => {
            if ((f.flags & 1) === 0) {
                for (let i = 0; i < f.w * f.h; i++) out.push(src[i] & 255);
            } else {
                for (let x = 0; x < f.w; x++) for (let y = 0; y < f.h; y++) out.push(src[x + f.w * y] & 255);
            }
        };
        plane(f.pixels);
        if ((f.flags & 2) !== 0) plane(f.alphas);
    }
    for (const c of palette) out.push((c >> 16) & 255, (c >> 8) & 255, c & 255);
    const p2 = (v: number) => out.push((v >> 8) & 255, v & 255);
    p2(canvasW);
    p2(canvasH);
    out.push(palette.length & 255);
    for (const v of xOffs) p2(v);
    for (const v of yOffs) p2(v);
    for (const f of frames) p2(f.w);
    for (const f of frames) p2(f.h);
    p2(frames.length);
    return Uint8Array.from(out);
}

function syntheticSprite(r: Rng, frameCount: number, maxDim: number): Uint8Array {
    const paletteSize = r.chance(6) ? 1 : r.chance(3) ? 256 : r.int(1, 256);
    const palette: number[] = [];
    for (let i = 1; i < paletteSize; i++) palette.push(r.chance(8) ? 0 : r.int(0, 0xffffff));
    const frames: Frame[] = [];
    const xOffs: number[] = [];
    const yOffs: number[] = [];
    const indexMax = r.chance(5) ? 255 : Math.max(paletteSize - 1, 0);
    for (let i = 0; i < frameCount; i++) {
        const w = r.chance(12) ? 0 : r.int(1, maxDim);
        const h = r.chance(12) ? 0 : r.int(1, maxDim);
        const flags = r.pick([0, 1, 2, 3, 0, 1, 2, 3, 4, 7, 254, 255]);
        const opaque = r.chance(3);
        const pixels: number[] = [];
        const alphas: number[] = [];
        for (let j = 0; j < w * h; j++) {
            pixels.push(r.chance(4) ? 0 : r.int(0, indexMax));
            alphas.push(opaque ? 255 : r.chance(3) ? 255 : r.int(0, 255));
        }
        frames.push({ w, h, flags, pixels, alphas });
        xOffs.push(r.int(0, 70000) & 0xffff);
        yOffs.push(r.int(0, 70000) & 0xffff);
    }
    return encode(r.int(0, 65535), r.int(0, 65535), palette, xOffs, yOffs, frames);
}

function mutate(r: Rng, src: Uint8Array): Uint8Array {
    const k = r.int(0, 5);
    if (k === 0) return src.slice(0, r.int(0, src.length));
    if (k === 1) return src.slice(r.int(0, Math.min(src.length, 20)));
    const out = src.slice();
    if (k === 2 || k === 3) {
        for (let n = r.int(1, 4); n > 0 && out.length > 0; n--) out[r.int(0, out.length - 1)] ^= 1 << r.int(0, 7);
    } else if (k === 4 && out.length >= 2) {
        const count = r.int(0, 12);
        out[out.length - 2] = count >> 8;
        out[out.length - 1] = count & 255;
    } else if (out.length >= 1) {
        out[r.int(Math.max(0, out.length - 30), out.length - 1)] = r.int(0, 255);
    }
    return out;
}

// Mirrors the decoder's trailer reads to keep the allocation sizes bounded.
function bounded(data: Uint8Array): boolean {
    const len = data.length;
    if (len < 2) return true;
    const count = (data[len - 2] << 8) | data[len - 1];
    const pos = len - 7 - 8 * count;
    if (pos < 0) return true;
    let total = 0;
    for (let i = 0; i < count; i++) {
        const wPos = pos + 5 + 4 * count + 2 * i;
        const hPos = pos + 5 + 6 * count + 2 * i;
        const product = Math.imul((data[hPos] << 8) | data[hPos + 1], (data[wPos] << 8) | data[wPos + 1]);
        if (product < 0) continue;
        if (product > MAX_FRAME) return false;
        total += product;
    }
    return total <= MAX_TOTAL;
}

function generate(): string[] {
    const r = new Rng(0x5eed0b8);
    const s: string[] = [];

    // Archives 8 and 13, served from the sector files. The TS side reads the same containers back from the script.
    const groups8 = readGroup(cachePath, 255, 8);
    s.push(`idx 8 ${tBytes(container(groups8))}`);
    const total8 = 1707;
    for (let g = 0; g < total8; g++) s.push(`grp 8 ${g} ${tBytes(container(readGroup(cachePath, 8, g)))}`);
    s.push(`idx 13 ${tBytes(container(readGroup(cachePath, 255, 13)))}`);
    for (const g of FONT_GROUPS) s.push(`grp 13 ${g} ${tBytes(container(readGroup(cachePath, 13, g)))}`);
    s.push('arch 8 0 1', 'arch 13 0 1', 'total');

    // Every archive 8 group through a rotating loader, then through ja.a and a rotating builder.
    for (let g = 0; g < total8; g++) {
        const loader = LOADERS[g % LOADERS.length];
        const fileFirst = loader === 'gi' || loader === 'oh';
        const groupFile = loader === 'ha' || loader === 'ml' || loader === 'nh' || loader === 'qc' || loader === 'wb';
        if (fileFirst) s.push(`ldr ${loader} 8 0 ${g}`);
        else if (groupFile) s.push(`ldr ${loader} 8 ${g} 0`);
        else if (loader === 'ja') s.push(`ldr ja 8 0 ${g}`);
        else s.push(`ldr ${loader} 8 ${g}`);
        s.push(`ldr ja 8 0 ${g}`);
        const builder = BUILDERS[(g * 7) % BUILDERS.length];
        s.push(builder === 'uk' ? 'build uk 0' : builder === 'tf' ? 'build tf n' : `build ${builder}`);
        if (g % 97 === 0) s.push(`build ${BUILDERS[g % 9]}`);
    }

    // Fonts: the glyph sheet through ja.a, then tf.a with the metrics file (fetched by the TS side and passed as bytes).
    const metrics = new Runner();
    metrics.run(['idx', '13', tBytes(container(readGroup(cachePath, 255, 13)))]);
    for (const g of FONT_GROUPS) metrics.run(['grp', '13', String(g), tBytes(container(readGroup(cachePath, 13, g)))]);
    metrics.run(['arch', '13', '0', '1']);
    const metricBytes = (g: number) => tBytes(metrics.archives.get(13)?.GetFile(0, g) ?? null);
    for (const g of FONT_GROUPS) s.push(`ldr ja 8 0 ${g}`, `build tf ${metricBytes(g)}`, 'build tf n');
    s.push(`ldr ja 8 0 ${FONT_GROUPS[0]}`, 'build tf n', `build tf ${metricBytes(FONT_GROUPS[0])}`);

    // Loader edge cases: null archive, missing groups and files, out-of-range ids.
    for (const loader of LOADERS) {
        for (const [x, y] of [
            [0, 0],
            [5, 0],
            [0, 5],
            [1, 5],
            [5, 1],
            [-1, 0],
            [0, -1],
            [1706, 0],
            [0, 1706],
            [1707, 0],
            [0, 1707],
            [100000, 0],
            [0, 100000]
        ]) {
            s.push(`ldr ${loader} 8 ${x} ${y}`, `ldr ${loader} n ${x} ${y}`);
        }
    }

    // Staging misuse on real data.
    const drops = ['X', 'Y', 'W', 'H', 'P', 'pix', 'alp', 'has', 'pix0', 'alp0', 'pal1'];
    for (const d of drops) {
        for (const b of BUILDERS) {
            s.push('ldr ja 8 0 1', `drop ${d}`, b === 'uk' ? 'build uk 0' : b === 'tf' ? `build tf ${metricBytes(494)}` : `build ${b}`);
        }
    }
    for (const q of [0, 1, 2, 5, 40]) {
        for (const b of BUILDERS) s.push('ldr ja 8 0 494', `drop q ${q}`, b === 'uk' ? `build uk ${q}` : b === 'tf' ? `build tf ${metricBytes(494)}` : `build ${b}`);
    }
    s.push('clear', 'build df', 'dec n', 'dec b', 'build ed', 'clear', 'total');

    // Sizes whose int product overflows to a negative array length (NegativeArraySizeException in og.a and the builders).
    const p2 = (v: number) => [(v >> 8) & 255, v & 255];
    const trailer = (frames: number[][], head: number[] = []) =>
        Uint8Array.from([...head, ...p2(7), ...p2(9), 0, ...frames.flatMap(() => p2(1)), ...frames.flatMap(() => p2(2)), ...frames.flatMap(f => p2(f[0])), ...frames.flatMap(f => p2(f[1])), ...p2(frames.length)]);
    for (const frames of [
        [[65535, 65535]],
        [[46341, 46341]],
        [
            [2, 2],
            [65535, 40000]
        ],
        [
            [0, 0],
            [50000, 50000]
        ]
    ]) {
        const head = frames[0][0] === 2 ? [0, 0, 0, 0, 0] : frames[0][0] === 0 ? [0] : [];
        for (const b of ['df', 'ed', 'oc', 'p', 'pk', 'ud', 'qd', 'rk']) s.push(`dec ${tBytes(trailer(frames, head))}`, `build ${b}`);
    }

    // Synthetic files and mutated copies.
    const realSample = [0, 1, 2, 13, 100, 305, 494, 1000, 1500];
    const arch8 = new Runner();
    arch8.run(['idx', '8', tBytes(container(groups8))]);
    for (const g of realSample) arch8.run(['grp', '8', String(g), tBytes(container(readGroup(cachePath, 8, g)))]);
    arch8.run(['arch', '8', '0', '1']);
    const realFiles = realSample.map(g => arch8.archives.get(8)?.GetFile(0, g) ?? new Uint8Array(0));

    let made = 0;
    while (made < SYNTHETIC_CASES) {
        let data: Uint8Array;
        const kind = r.int(0, 99);
        if (kind < 55) data = syntheticSprite(r, r.int(1, 6), r.chance(4) ? 3 : 40);
        else if (kind < 60) data = syntheticSprite(r, 256, 3);
        else if (kind < 85) data = mutate(r, syntheticSprite(r, r.int(1, 4), 12));
        else data = mutate(r, r.pick(realFiles));
        if (!bounded(data)) continue;
        made++;
        s.push(`dec ${tBytes(data)}`);
        if (r.chance(10)) s.push(`drop ${r.pick(drops)}`);
        const builder = r.pick(BUILDERS);
        const arg = builder === 'uk' ? ` ${r.int(-1, 7)}` : builder === 'tf' ? ` ${r.chance(3) ? 'n' : metricBytes(r.pick(FONT_GROUPS))}` : '';
        s.push(`build ${builder}${arg}`);
        if (r.chance(4)) s.push(`build ${r.pick(BUILDERS.slice(0, 9))}`);
    }

    return s;
}

test('SpriteLoader matches client.jar', () => {
    const script = generate();
    // The oracle's JVM starts from the staging statics' clinit values (zero and null), but this Bun process may have
    // run other test files first (the stage-80 loader leaves 2/31/31 behind), so reset them for the run and put the
    // incoming values back afterwards.
    const s = SpriteLoader;
    const incoming = [s.count, s.canvasWidth, s.height, s.xOffsets, s.yOffsets, s.widths, s.innerHeights, s.palette, s.pixels, s.alphas, s.hasAlpha] as const;
    let ours: string[];
    try {
        s.count = 0;
        s.canvasWidth = 0;
        s.height = 0;
        s.xOffsets = s.yOffsets = s.widths = s.innerHeights = s.palette = null;
        s.pixels = s.alphas = null;
        s.hasAlpha = null;
        const runner = new Runner();
        ours = script.map((line, i) => runner.execute(i, line));
    } finally {
        [s.count, s.canvasWidth, s.height, s.xOffsets, s.yOffsets, s.widths, s.innerHeights, s.palette, s.pixels, s.alphas, s.hasAlpha] = incoming;
    }
    const theirs = runOracle(script.join('\n') + '\n');

    expect(theirs.length).toBe(ours.length);
    for (let i = 0; i < ours.length; i++) {
        if (ours[i] !== theirs[i]) {
            throw new Error(`mismatch at op ${i} "${script[i].slice(0, 120)}"\n  ts:   ${ours[i].slice(0, 2000)}\n  java: ${theirs[i].slice(0, 2000)}`);
        }
    }

    // The script reaches every outcome and every sprite class.
    const results = new Set(ours.map(line => line.split(' ')[2]));
    expect([...results].sort()).toEqual(['aioobe', 'neg', 'npe', 'ok']);
    const all = ours.join('\n');
    for (const tag of ['rh:', 'vh:', 'ch:', 'fg:']) expect(all.includes(tag)).toBe(true);
}, 600000);
