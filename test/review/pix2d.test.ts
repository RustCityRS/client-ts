import { expect, test } from 'bun:test';
import TextureShapeRaster from '../../src/dash3d/TextureShapeRaster.js';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Pix3D from '../../src/dash3d/Pix3D.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import { arrayAt } from '../../src/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

// td (Pix2D) plus ea.a(IIIIII)V (Pix2D.drawLine) and ef.a(IIIIII)V (Pix2D.fillEllipseClipped) against client.jar.
// The test builds a seeded script of operations, runs it through the TS port as it goes, then pipes the same
// script into pix2d/Pix2DOracle.java, which runs it on the real gamepack classes. After every operation both
// sides report whether it completed or threw (and which Java exception), the whole framebuffer hash (so a
// partial write before an exception must match too), td's width, height, pixel-array identity, clip bounds,
// clip-mask identity and the we.z shape raster hash. Operations: every td member (private ones too), with
// clips at and outside the buffer, clip masks, save/restore, negative and huge coordinates, zero and negative
// sizes, alpha at and beyond 0..256, colours with the top byte set, short/null/empty buffers, thick lines via
// Pix3D, and circles at the edges. About 63,000 operations in all: directed edge cases, exhaustive drawLine2
// end-point sweeps (97x61, 400x6, 6x400), every ellipse radius pair up to 34x40, a drawLine end-point grid, and
// 12,000 + 3,000 + 6,000 seeded random operations on three framebuffer shapes and the shape raster.
//
// drawLine and fillEllipseClipped call the shape-raster statics (wa.j, gg.I, ia.m, sf.d, we.z and the helpers
// aj.a, ic.a, va.a, t.a, a.a, lk.a, al.a), which live on the native leaf dash3d/TextureShapeRaster.ts. The h*
// operations check those helpers directly against the jar methods in the same run.

const MIN = -2147483648;
const MAX = 2147483647;
const W = 97;
const H = 61;
const RW = 83;
const RH = 71;
const RANDOM_MAIN = 12000;
const RANDOM_SMALL = 2000;
const RANDOM_RASTER = 6000;

function runOracle(script: string): string[] {
    const source = fileURLToPath(new URL('./pix2d/Pix2DOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'pix2d-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'Pix2DOracle'], {
            input: script,
            timeout: 240000,
            encoding: 'utf8',
            maxBuffer: 256 * 1024 * 1024
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

function hash(values: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < values.length; i++) h = (Math.imul(h, 31) + values[i]) | 0;
    return h;
}

function pattern(i: number, seed: number): number {
    return Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
}

// The native shape raster leaf (gj/u statics): state and helpers, read and driven directly.
const shapes = TextureShapeRaster;
const shape = TextureShapeRaster;

// td's private statics, called the way the oracle reaches them through reflection.
const internals = Pix2D as unknown as {
    setPixel(x: number, y: number, colour: number): void;
    hlineTrans(x: number, y: number, width: number, colour: number, alpha: number): void;
    vlineTrans(x: number, y: number, height: number, colour: number, alpha: number): void;
    fillCircle(x: number, y: number, radius: number, colour: number): void;
};

// ---- TS executor: mirrors Pix2DOracle.main ----

let buf: Int32Array | null = null;
let lastOffsets: Int32Array | null = null;
let lastLengths: Int32Array | null = null;

function classify(e: unknown): string {
    if (e instanceof RangeError) {
        if (e.message.startsWith('/ by zero')) return 'arith';
        if (e.message.startsWith('array index')) return 'aioobe';
    }
    if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) return 'npe';
    if (e instanceof Error && e.message === 'IllegalArgumentException') return 'iae';
    throw e;
}

function pixelState(): string {
    const pixels = Pix2D.pixels;
    if (pixels === null) return 'null';
    return `${pixels === buf ? 'buf:' : 'other:'}${pixels.length}:${hash(pixels)}`;
}

function maskState(mask: Int32Array | null, last: Int32Array | null): string {
    if (mask === null) return '-';
    return `${mask === last ? '' : '?'}${mask.length}`;
}

function rasterState(): string {
    const z = shapes.raster;
    if (z === null) return 'null';
    let h = 1;
    for (const row of z) h = (Math.imul(h, 31) + (row === null ? 0x5bd1e995 : hash(row))) | 0;
    return `${z.length}:${h}`;
}

function intArray(length: number, values: number[]): Int32Array | null {
    if (length < 0) return null;
    return Int32Array.from(values.slice(0, length));
}

function execute(index: number, line: string): string {
    const f = line.split(' ');
    const op = f[0];
    const n = f.map(Number);
    let extra = '';
    let result = 'ok';
    try {
        switch (op) {
            case 'buf': {
                buf = n[1] < 0 ? null : new Int32Array(n[1]);
                if (buf !== null) for (let i = 0; i < buf.length; i++) buf[i] = pattern(i, n[4]);
                Pix2D.setPixels(buf, n[2], n[3]);
                break;
            }
            case 'fill':
                if (buf !== null) for (let i = 0; i < buf.length; i++) buf[i] = pattern(i, n[1]);
                break;
            case 'setclip':
                Pix2D.setClipping(n[1], n[2], n[3], n[4]);
                break;
            case 'rawclip':
                Pix2D.clipMinX = n[1];
                Pix2D.clipMinY = n[2];
                Pix2D.clipMaxX = n[3];
                Pix2D.clipMaxY = n[4];
                break;
            case 'intersect':
                Pix2D.intersectClipping(n[1], n[2], n[3], n[4]);
                break;
            case 'resetclip':
                Pix2D.resetClipping();
                break;
            case 'save': {
                const a = n[1] < 0 ? null : new Int32Array(n[1]).fill(0x55555555);
                try {
                    Pix2D.saveClipping(a);
                } finally {
                    if (a !== null) extra = ` [${Array.from(a).join(',')}]`;
                }
                break;
            }
            case 'restore': {
                const a = n[1] < 0 ? null : new Int32Array(n[1]);
                if (a !== null) for (let i = 0; i < a.length && i < 4; i++) a[i] = n[2 + i];
                Pix2D.restoreClipping(a);
                break;
            }
            case 'mask':
                lastOffsets = n[1] < 0 ? null : new Int32Array(n[1]);
                lastLengths = n[2] < 0 ? null : new Int32Array(n[2]);
                Pix2D.setClipMask(lastOffsets, lastLengths);
                break;
            case 'clearmask':
                Pix2D.clearClipMask();
                break;
            case 'cls':
                Pix2D.cls();
                break;
            case 'spans': {
                const no = n[4];
                const nl = n[5];
                const off = intArray(no, n.slice(6));
                const len = intArray(nl, n.slice(6 + Math.max(no, 0)));
                Pix2D.fillSpans(n[1], n[2], n[3], off, len);
                break;
            }
            case 'pixel':
                internals.setPixel(n[1], n[2], n[3]);
                break;
            case 'hline':
                Pix2D.hline(n[1], n[2], n[3], n[4]);
                break;
            case 'vline':
                Pix2D.vline(n[1], n[2], n[3], n[4]);
                break;
            case 'hlinet':
                internals.hlineTrans(n[1], n[2], n[3], n[4], n[5]);
                break;
            case 'vlinet':
                internals.vlineTrans(n[1], n[2], n[3], n[4], n[5]);
                break;
            case 'rect':
                Pix2D.drawRect(n[1], n[2], n[3], n[4], n[5]);
                break;
            case 'fillrect':
                Pix2D.fillRect(n[1], n[2], n[3], n[4], n[5]);
                break;
            case 'fillrectt':
                Pix2D.fillRectTrans(n[1], n[2], n[3], n[4], n[5], n[6]);
                break;
            case 'rectt':
                Pix2D.drawRectTrans(n[1], n[2], n[3], n[4], n[5], n[6]);
                break;
            case 'circle':
                internals.fillCircle(n[1], n[2], n[3], n[4]);
                break;
            case 'circlet':
                Pix2D.fillCircleTrans(n[1], n[2], n[3], n[4], n[5]);
                break;
            case 'line':
                Pix2D.drawLine2(n[1], n[2], n[3], n[4], n[5]);
                break;
            case 'thick':
                try {
                    Pix2D.drawThickLine(n[1], n[2], n[3], n[4], n[5], n[6]);
                } finally {
                    extra = ` hclip=${Pix3D.hclip ? 1 : 0}`;
                }
                break;
            case 'r3d':
                Pix3D.setRenderClipping();
                break;
            case 'origin':
                Pix3D.setOrigin(n[1], n[2]);
                break;
            case 'trans':
                Pix3D.trans = n[1];
                break;
            case 'raster': {
                if (n[2] < 0) {
                    shapes.raster = null;
                } else {
                    const rows: (Int32Array | null)[] = [];
                    let k = 0;
                    for (let r = 0; r < n[2]; r++) {
                        const row = new Int32Array(n[1]);
                        for (let i = 0; i < row.length; i++) row[i] = pattern(k++, n[4]);
                        rows.push(row);
                    }
                    if (n[3] >= 0 && n[3] < n[2]) rows[n[3]] = null;
                    shapes.raster = rows;
                }
                break;
            }
            case 'rclip':
                shapes.clipMinX = n[1];
                shapes.clipMaxX = n[2];
                shapes.clipTop = n[3];
                shapes.clipMaxY = n[4];
                break;
            case 'drawline':
                Pix2D.drawLine(n[1], n[2], n[3], n[4], n[5]);
                break;
            case 'ellipse':
                Pix2D.fillEllipseClipped(n[1], n[2], n[3], n[4], n[5]);
                break;
            case 'hclamp':
                extra = ` ${shapes.clamp(n[1], n[2], n[3])}`;
                break;
            case 'hfill':
                shapes.fillRow(n[1], arrayAt(shapes.raster, n[2]), n[3], n[4]);
                break;
            case 'hvline':
                shapes.drawVerticalLineClipped(n[1], n[2], n[3], n[4]);
                break;
            case 'hhline':
                shape.hline(n[1], n[2], n[3], n[4]);
                break;
            case 'hbres':
                shape.drawLine(n[1], n[2], n[3], n[4], n[5]);
                break;
            default:
                throw new Error(`unknown op ${op}`);
        }
    } catch (e) {
        result = classify(e);
    }
    return (
        `${index} ${op} ${result} ${Pix2D.width} ${Pix2D.height} ${pixelState()} ` +
        `${Pix2D.clipMinX} ${Pix2D.clipMinY} ${Pix2D.clipMaxX} ${Pix2D.clipMaxY} ` +
        `${maskState(Pix2D.maskOffsets, lastOffsets)}/${maskState(Pix2D.maskLengths, lastLengths)} ${rasterState()}${extra}`
    );
}

// ---- seeded script generation ----

class Rng {
    constructor(private state: number) {}

    next(): number {
        let s = this.state;
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        this.state = s | 0;
        return this.state;
    }

    int(lo: number, hi: number): number {
        return lo + Math.floor(((this.next() >>> 0) / 4294967296) * (hi - lo + 1));
    }

    pick<T>(values: readonly T[]): T {
        return values[this.int(0, values.length - 1)];
    }
}

const EXTREME = [MIN, MAX, MIN + 1, MAX - 1, 1 << 30, -(1 << 30), 65536, -65536, 46341, -46341, 0x7fff, -0x8000];
const ALPHAS = [0, 1, 127, 128, 255, 256];
const ODD_ALPHAS = [-1, 257, 512, -256, 65536, MIN, MAX, 1 << 24, 300, -100];
const COLOURS = [0, 0xffffff, 0xff000000 | 0, -1, 0x00ff00ff, 0x80808080 | 0, 0x7fffffff, 0x01010101, 0xff00ff00 | 0];
// Radii whose squares stay clear of int overflow trouble (46340/46341 make the Java span loops spin for ever).
const CIRCLE_EXTREME = [1 << 30, MAX, MIN, 65536, 40000, -40000, 1 << 20];

function coord(r: Rng, dim: number): number {
    const k = r.int(0, 99);
    if (k < 50) return r.int(0, dim - 1);
    if (k < 70) return r.int(-30, dim + 30);
    if (k < 85) return r.pick([0, -1, 1, dim - 1, dim, dim + 1, -dim, 2 * dim]);
    if (k < 95) return r.int(-5000, 5000);
    return r.pick(EXTREME);
}

function size(r: Rng, dim: number): number {
    const k = r.int(0, 99);
    if (k < 60) return r.int(0, dim + 10);
    if (k < 75) return r.int(-20, -1);
    if (k < 87) return r.pick([0, 1, 2, 3]);
    if (k < 95) return r.int(-5000, 5000);
    return r.pick(EXTREME);
}

function colour(r: Rng): number {
    return r.int(0, 9) < 7 ? r.next() : r.pick(COLOURS);
}

function alpha(r: Rng): number {
    const k = r.int(0, 99);
    if (k < 50) return r.pick(ALPHAS);
    if (k < 85) return r.int(0, 256);
    return r.pick(ODD_ALPHAS);
}

function radius(r: Rng): number {
    const k = r.int(0, 99);
    if (k < 70) return r.int(-60, 60);
    if (k < 85) return r.int(-400, 400);
    if (k < 95) return r.pick([0, 1, -1, 2]);
    return r.pick(CIRCLE_EXTREME);
}

// The width/height fillRect and fillRectTrans loop over after clipping. A huge row count with no columns
// would iterate ~2^31 times without touching the buffer, so the generator avoids those.
function clippedRect(x: number, y: number, w: number, h: number): [number, number] {
    if (x < Pix2D.clipMinX) {
        w = (w - (Pix2D.clipMinX - x)) | 0;
        x = Pix2D.clipMinX;
    }
    if (y < Pix2D.clipMinY) {
        h = (h - (Pix2D.clipMinY - y)) | 0;
        y = Pix2D.clipMinY;
    }
    if (((x + w) | 0) > Pix2D.clipMaxX) w = (Pix2D.clipMaxX - x) | 0;
    if (((y + h) | 0) > Pix2D.clipMaxY) h = (Pix2D.clipMaxY - y) | 0;
    return [w, h];
}

function randomTdOp(r: Rng, dimW: number, dimH: number): string {
    const k = r.int(0, 129);
    const c = colour(r);
    if (k < 4) return `fill ${r.int(0, 100000)}`;
    if (k < 7) {
        // clip within or slightly outside the buffer (setClipping clamps it); sometimes empty or inverted
        if (r.int(0, 9) === 0) return `setclip ${r.int(-10, dimW + 5)} ${r.int(-10, dimH + 5)} ${r.int(-10, dimW + 10)} ${r.int(-10, dimH + 10)}`;
        const l = r.int(-10, dimW >> 1);
        const t = r.int(-10, dimH >> 1);
        return `setclip ${l} ${t} ${r.int(l + 1, dimW + 10)} ${r.int(t + 1, dimH + 10)}`;
    }
    if (k < 8) return `intersect ${r.int(-10, dimW >> 2)} ${r.int(-10, dimH >> 2)} ${r.int((dimW * 3) >> 2, dimW + 10)} ${r.int((dimH * 3) >> 2, dimH + 10)}`;
    if (k < 11) return 'resetclip';
    if (k < 12) {
        // raw clip bounds past the buffer edges, as a caller writing td.e/b/h/d directly could leave them
        return `rawclip ${r.int(-8, 8)} ${r.int(-8, 8)} ${r.int(dimW - 8, dimW + 8)} ${r.int(dimH - 8, dimH + 8)}`;
    }
    if (k < 13) return `save ${r.pick([4, 4, 4, 5, 3, 0, -1])}`;
    if (k < 14) {
        const len = r.pick([4, 4, 4, 5, 3, 1, -1]);
        const l = r.int(-5, dimW);
        const t = r.int(-5, dimH);
        return `restore ${len} ${l} ${t} ${r.int(l, dimW + 5)} ${r.int(t, dimH + 5)}`;
    }
    if (k < 16) {
        const span = (Pix2D.clipMaxY - Pix2D.clipMinY) | 0;
        const pick = (): number => r.pick([span, span, span, span + 1, span - 1, -1, 0]);
        return `mask ${pick()} ${pick()}`;
    }
    if (k < 17) return 'clearmask';
    if (k < 18) return 'cls';
    if (k < 22) {
        const no = r.pick([0, 1, 3, 5, 8, 8, 12, -1]);
        const nl = r.int(0, 9) < 8 ? no : r.pick([-1, 0, no - 1, no + 1]);
        const values: number[] = [];
        for (let i = 0; i < Math.max(no, 0); i++) values.push(r.int(0, 9) < 9 ? r.int(-10, 30) : r.pick(EXTREME));
        for (let i = 0; i < Math.max(nl, 0); i++) values.push(r.int(0, 19) < 19 ? r.int(-3, 25) : r.pick([dimW * dimH, -1000]));
        return `spans ${coord(r, dimW)} ${coord(r, dimH)} ${c} ${no} ${nl}${values.map(v => ' ' + v).join('')}`;
    }
    if (k < 30) return `pixel ${coord(r, dimW)} ${coord(r, dimH)} ${c}`;
    if (k < 40) return `hline ${coord(r, dimW)} ${coord(r, dimH)} ${size(r, dimW)} ${c}`;
    if (k < 50) return `vline ${coord(r, dimW)} ${coord(r, dimH)} ${size(r, dimH)} ${c}`;
    if (k < 57) return `hlinet ${coord(r, dimW)} ${coord(r, dimH)} ${size(r, dimW)} ${c} ${alpha(r)}`;
    if (k < 64) return `vlinet ${coord(r, dimW)} ${coord(r, dimH)} ${size(r, dimH)} ${c} ${alpha(r)}`;
    if (k < 70) return `rect ${coord(r, dimW)} ${coord(r, dimH)} ${size(r, dimW)} ${size(r, dimH)} ${c}`;
    if (k < 84) {
        for (;;) {
            const x = coord(r, dimW);
            const y = coord(r, dimH);
            const w = size(r, dimW);
            const h = size(r, dimH);
            const [cw, ch] = clippedRect(x, y, w, h);
            if (ch > 100000 && cw <= 0) continue;
            return k < 77 ? `fillrect ${x} ${y} ${w} ${h} ${c}` : `fillrectt ${x} ${y} ${w} ${h} ${c} ${alpha(r)}`;
        }
    }
    if (k < 90) return `rectt ${coord(r, dimW)} ${coord(r, dimH)} ${size(r, dimW)} ${size(r, dimH)} ${c} ${alpha(r)}`;
    if (k < 98) return `circle ${coord(r, dimW)} ${coord(r, dimH)} ${radius(r)} ${c}`;
    if (k < 108) return `circlet ${coord(r, dimW)} ${coord(r, dimH)} ${radius(r)} ${c} ${alpha(r)}`;
    if (k < 120) return `line ${coord(r, dimW)} ${coord(r, dimH)} ${coord(r, dimW)} ${coord(r, dimH)} ${c}`;
    if (k < 122) return `trans ${r.pick([0, 0, 0, 128, 200, 254, 11, 255, 256, -5])}`;
    if (k < 123) return 'r3d';
    const thickness = r.int(0, 9) < 8 ? r.int(-4, 30) : r.pick([0, 1, 2, 100, -100, 1 << 16, MIN, MAX]);
    return `thick ${coord(r, dimW)} ${coord(r, dimH)} ${coord(r, dimW)} ${coord(r, dimH)} ${c} ${thickness}`;
}

function rasterCoord(r: Rng, dim: number): number {
    const k = r.int(0, 99);
    if (k < 50) return r.int(0, dim - 1);
    if (k < 75) return r.int(-15, dim + 15);
    if (k < 90) return r.pick([0, -1, 1, dim - 1, dim, dim + 1, -dim, 2 * dim]);
    if (k < 97) return r.int(-3000, 3000);
    return r.pick([MIN, MAX, 1 << 20, -(1 << 20), 1 << 30]);
}

function randomRasterOp(r: Rng): string {
    const k = r.int(0, 99);
    const c = colour(r);
    if (k < 3) return `raster ${RW} ${RH} ${r.int(0, 3) === 0 ? r.int(0, RH - 1) : -1} ${r.int(0, 100000)}`;
    if (k < 9) {
        const m = r.int(0, 99);
        if (m < 60) {
            const minX = r.int(0, (RW / 3) | 0);
            const top = r.int(0, (RH / 3) | 0);
            return `rclip ${minX} ${r.int(((RW * 2) / 3) | 0, RW - 1)} ${top} ${r.int(((RH * 2) / 3) | 0, RH - 1)}`;
        }
        if (m < 85) return `rclip ${r.int(-6, RW + 6)} ${r.int(-6, RW + 6)} ${r.int(-6, RH + 6)} ${r.int(-6, RH + 6)}`;
        return `rclip ${r.int(0, RW)} ${r.int(0, RW)} ${r.int(0, RH)} ${r.int(0, RH)}`;
    }
    if (k < 40) return `drawline ${rasterCoord(r, RW)} ${c} ${rasterCoord(r, RH)} ${rasterCoord(r, RH)} ${rasterCoord(r, RW)}`;
    if (k < 52) {
        // axis-aligned lines exercise the va.a / t.a branches of drawLine
        const x = rasterCoord(r, RW);
        const y = rasterCoord(r, RH);
        return r.int(0, 1) === 0 ? `drawline ${x} ${c} ${rasterCoord(r, RH)} ${rasterCoord(r, RH)} ${x}` : `drawline ${rasterCoord(r, RW)} ${c} ${y} ${y} ${rasterCoord(r, RW)}`;
    }
    if (k < 72) {
        const ry = r.int(0, 9) < 8 ? r.int(-5, 60) : r.int(-50, 300);
        const rx = r.int(0, 9) < 8 ? r.int(-5, 60) : r.int(-50, 300);
        return `ellipse ${ry} ${rasterCoord(r, RH)} ${rasterCoord(r, RW)} ${c} ${rx}`;
    }
    if (k < 77) return `hclamp ${rasterCoord(r, RW)} ${rasterCoord(r, RW)} ${rasterCoord(r, RW)}`;
    if (k < 83) return `hfill ${r.int(-5, RW + 5)} ${r.int(-2, RH + 1)} ${r.int(-5, RW + 5)} ${c}`;
    if (k < 89) return `hvline ${rasterCoord(r, RH)} ${rasterCoord(r, RH)} ${c} ${rasterCoord(r, RW)}`;
    if (k < 94) return `hhline ${c} ${rasterCoord(r, RH)} ${rasterCoord(r, RW)} ${rasterCoord(r, RW)}`;
    return `hbres ${r.int(-5, RH + 5)} ${c} ${r.int(-5, RW + 5)} ${r.int(-5, RH + 5)} ${r.int(-5, RW + 5)}`;
}

function directedCases(): string[] {
    const s: string[] = [];
    const len = W * H;
    s.push(`buf ${len} ${W} ${H} 1`, 'r3d', 'trans 0');

    // clip rectangles, save and restore
    s.push('setclip -10 -10 200 200', 'save 4', 'setclip 10 5 50 40', 'save 4', 'intersect 0 0 97 61', 'save 4');
    s.push('intersect 20 10 30 20', 'save 4', 'intersect 25 0 200 200', 'save 4', 'intersect 0 0 22 15', 'save 4');
    s.push('restore 4 3 4 90 50', 'save 4', 'resetclip', 'save 4', 'save 3', 'save 0', 'save -1', 'save 6');
    s.push('setclip 5 6 7 8', 'restore 3 1 2 3 0', 'save 4', 'restore 0', 'save 4', 'restore -1', 'save 4');
    s.push('restore 5 9 8 7 6', 'save 4', 'setclip 50 40 10 5', 'save 4', 'fillrect 0 0 97 61 -1', 'hline 0 45 97 -1');
    s.push('setclip 97 61 97 61', 'pixel 96 60 7', 'hline 0 60 97 7', 'setclip 0 0 0 0', 'fillrect 0 0 97 61 7');
    s.push('setclip -5 -5 -1 -1', 'save 4', 'setclip 200 200 300 300', 'save 4', 'resetclip');

    // clip masks
    s.push('mask 61 61', 'mask 60 61', 'mask 61 60', 'mask -1 61', 'mask 61 -1', 'mask -1 -1', 'mask 0 0');
    s.push('mask 61 61', 'setclip 0 0 97 61', 'mask 61 61', 'clearmask', 'mask 61 61', 'intersect 0 0 97 61');
    s.push('mask 61 61', 'restore 4 0 0 97 61', 'mask 61 61', 'resetclip', 'setclip 5 5 20 15', 'mask 10 10');
    s.push('mask 61 61', 'mask 10 61', 'setclip 0 0 97 61', 'mask 61 61', 'buf 5917 97 61 2', 'mask 61 61');
    s.push('rawclip 0 7 97 3', 'mask -4 -4', 'mask 0 0', 'mask 4 4', 'resetclip');

    // cls on several shapes of buffer
    s.push('fill 2', 'cls', 'fill 3', 'setclip 10 10 20 20', 'cls', 'resetclip');

    // alpha and colour edge cases for every translucent op
    const alphas = [0, 1, 127, 128, 255, 256, -1, 257, 1000, -256, MIN, MAX, 1 << 24];
    const colours = [0xff80c040 | 0, -1, 0, 0x00ffffff, MIN, 0x12345678];
    for (const a of alphas) {
        for (const c of colours) {
            s.push(`fill ${a & 0xffff}`);
            s.push(`fillrectt 5 5 30 20 ${c} ${a}`, `rectt 40 3 20 30 ${c} ${a}`, `circlet 70 30 12 ${c} ${a}`);
            s.push(`hlinet -3 50 40 ${c} ${a}`, `vlinet 90 -4 70 ${c} ${a}`, `rectt 60 50 2 2 ${c} ${a}`);
            s.push(`circlet 30 40 0 ${c} ${a}`, `circlet 5 5 -9 ${c} ${a}`);
        }
    }

    // rectangles and lines with zero, negative and huge sizes or positions
    for (const v of [0, -1, 1, MIN, MAX, MIN + 1, MAX - 1, 1 << 30, -(1 << 30), 97, 61, 98, 62]) {
        s.push(`fill ${v & 0xff}`);
        s.push(`hline ${v} 3 10 1`, `hline 3 ${v} 10 2`, `hline 3 3 ${v} 3`, `vline ${v} 3 10 4`, `vline 3 ${v} 10 5`, `vline 3 3 ${v} 6`);
        s.push(`hlinet ${v} 3 10 7 100`, `hlinet 3 3 ${v} 8 100`, `vlinet 3 ${v} 10 9 100`, `vlinet 3 3 ${v} 10 100`);
        s.push(`fillrect ${v} 3 10 10 11`, `fillrect 3 ${v} 10 10 12`, `fillrect 3 3 ${v} 10 13`, `fillrect 3 3 10 ${v} 14`);
        s.push(`fillrectt ${v} 3 10 10 15 99`, `fillrectt 3 ${v} 10 10 16 99`, `fillrectt 3 3 ${v} 10 17 99`, `fillrectt 3 3 10 ${v} 18 99`);
        s.push(`rect ${v} 3 10 10 19`, `rect 3 3 ${v} 10 20`, `rect 3 3 10 ${v} 21`, `rectt 3 3 ${v} 10 22 50`, `rectt 3 3 10 ${v} 23 50`);
        s.push(`pixel ${v} 5 24`, `pixel 5 ${v} 25`, `line ${v} 5 50 30 26`, `line 5 ${v} 50 30 27`, `line 5 5 ${v} 30 28`, `line 5 5 50 ${v} 29`);
    }

    // lines in every octant, axis-aligned in both directions, and crossing the clip edges
    s.push('setclip 10 8 80 50');
    const ends = [
        [0, 0],
        [96, 60],
        [96, 0],
        [0, 60],
        [48, -20],
        [48, 90],
        [-20, 30],
        [120, 30],
        [10, 8],
        [79, 49],
        [80, 50],
        [9, 7]
    ];
    for (const [x0, y0] of ends) for (const [x1, y1] of ends) s.push(`line ${x0} ${y0} ${x1} ${y1} ${(x0 * 131 + y1) | 0}`);
    for (const [x0, y0] of [
        [30, 30],
        [10, 8],
        [79, 49]
    ]) {
        for (const [dx, dy] of [
            [0, 0],
            [7, 0],
            [-7, 0],
            [0, 7],
            [0, -7],
            [7, 3],
            [-7, -3],
            [3, 7],
            [-3, -7],
            [7, -3],
            [-7, 3],
            [3, -7],
            [-3, 7],
            [5, 5],
            [-5, -5],
            [5, -5],
            [-5, 5]
        ]) {
            s.push(`line ${x0} ${y0} ${x0 + dx} ${y0 + dy} ${dx * 7 + dy}`);
        }
    }
    s.push('resetclip');

    // every end point from three corners: all slopes of drawLine2's 16.16 stepping, its Math.floor rounding,
    // and the dx + dy < 0 endpoint swap
    for (const [x0, y0] of [
        [0, 0],
        [96, 60],
        [0, 60]
    ]) {
        s.push(`fill ${x0 + y0}`);
        for (let y1 = 0; y1 < H; y1++) for (let x1 = 0; x1 < W; x1++) s.push(`line ${x0} ${y0} ${x1} ${y1} ${Math.imul(x1 * 64 + y1, 0x01030507)}`);
    }

    // circles at and past the edges, all radii signs, both opaque and translucent
    for (const [x, y] of [
        [0, 0],
        [96, 60],
        [96, 0],
        [0, 60],
        [48, 30],
        [-5, 30],
        [101, 30],
        [48, -5],
        [48, 66],
        [-30, -30],
        [130, 90]
    ]) {
        for (const rad of [0, 1, 2, 3, 7, -7, 30, 60, 100, -100]) {
            s.push(`circle ${x} ${y} ${rad} ${(x * 31 + rad) | 0}`, `circlet ${x} ${y} ${rad} ${(y * 17 - rad) | 0} 77`);
        }
    }
    s.push('setclip 20 15 70 45');
    for (const [x, y] of [
        [20, 15],
        [69, 44],
        [70, 45],
        [19, 14],
        [45, 30]
    ]) {
        for (const rad of [0, 1, 5, 20, 40]) s.push(`circle ${x} ${y} ${rad} 1234`, `circlet ${x} ${y} ${rad} 4321 200`);
    }
    for (const rad of CIRCLE_EXTREME) s.push(`circle 40 30 ${rad} 99`, `circlet 40 30 ${rad} 98 128`, `circlet 40 30 ${rad} 97 256`);
    s.push('resetclip');

    // fillSpans: empty, mismatched and null arrays, runs past the end
    s.push('spans 10 10 5 0 0', 'spans 10 10 5 3 3 0 1 2 5 5 5', 'spans 10 10 5 3 2 0 1 2 5 5', 'spans 10 10 5 2 3 0 1 5 5 5');
    s.push('spans 10 10 5 -1 3 1 2 3', 'spans 10 10 5 2 -1 1 2', 'spans 0 0 6 1 1 0 5917', 'spans 0 60 7 2 2 0 0 10 10');
    s.push('spans -1 0 8 1 1 0 3', 'spans 90 0 9 3 3 0 0 0 20 20 20', 'spans 0 0 10 1 1 -1 1', 'spans 5 5 11 2 2 3 4 -5 0');

    // thick lines through Pix3D: degenerate, every direction, thicknesses, translucency, offset clip origin
    for (const tr of [0, 128, 200]) {
        s.push(`trans ${tr}`);
        for (const [x0, y0, x1, y1] of [
            [10, 10, 10, 10],
            [10, 10, 80, 10],
            [10, 10, 10, 50],
            [10, 10, 80, 50],
            [80, 50, 10, 10],
            [80, 10, 10, 50],
            [10, 50, 80, 10],
            [-20, -20, 120, 90],
            [0, 30, 96, 31],
            [48, 0, 47, 60]
        ]) {
            for (const th of [0, 1, 2, 5, 16, -3]) s.push(`thick ${x0} ${y0} ${x1} ${y1} ${(x0 * 1000 + th) | 0} ${th}`);
        }
    }
    s.push('trans 0', 'setclip 20 10 80 50', 'r3d', 'thick 0 0 96 60 4660 6', 'thick 30 20 70 40 4661 3', 'origin 40 20', 'thick 30 20 70 40 4662 3');
    s.push('resetclip', 'r3d', 'thick 1 1 2 2 4663 MAX'.replace('MAX', String(MAX)), `thick ${MIN} 0 ${MAX} 60 4664 3`, `thick 0 0 60 40 4665 ${MIN}`);

    // pixel array shapes: short, longer than width*height, null, empty, 1x1, smaller than one cls block
    s.push('buf 100 97 61 4', 'cls', 'fillrect 0 0 97 61 5', 'hline 0 1 97 6', 'vline 1 0 61 7', 'circle 48 30 20 8', 'line 0 0 96 60 9');
    s.push('fillrectt 0 0 97 61 10 100', 'thick 0 0 96 60 11 3', 'spans 0 0 12 2 2 0 0 50 60');
    s.push('buf 200 13 7 5', 'cls', 'fill 6', 'fillrect -5 -5 100 100 13', 'circle 6 3 10 14', 'r3d', 'thick 0 0 12 6 15 4');
    s.push('buf -1 97 61 0', 'cls', 'hline 0 0 5 1', 'pixel 3 3 3', 'fillrect 0 0 1 1 2', 'circle 5 5 3 4', 'line 0 0 5 5 5', 'mask 61 61');
    s.push('buf 0 0 0 0', 'cls', 'hline 0 0 5 1', 'save 4', 'r3d', 'thick 0 0 5 5 1 2', 'origin 1 1', 'line 0 0 3 0 1');
    s.push('buf 1 1 1 7', 'cls', 'fill 8', 'pixel 0 0 9', 'circle 0 0 0 10', 'circle 0 0 3 11', 'circlet 0 0 3 12 128', 'line 0 0 0 0 13', 'line 0 0 3 0 14');
    s.push('buf 6 3 2 9', 'cls', 'fill 10', 'fillrectt 0 0 3 2 15 128', 'rectt 0 0 3 2 16 64', 'rect 0 0 3 2 17');
    s.push('buf 6 2 3 11', 'cls', 'buf 7 1 7 12', 'cls', 'buf 15 4 4 13', 'cls');

    // raw clip bounds past the buffer: writes run out of the array part-way
    s.push(`buf ${len} ${W} ${H} 14`, 'rawclip -5 -5 102 66', 'hline -5 -5 200 1', 'fill 15', 'hline -5 0 200 2', 'fill 16', 'vline 96 0 200 3');
    s.push('fill 17', 'fillrect 90 50 20 20 4', 'fill 18', 'fillrectt -5 -5 20 20 5 99', 'fill 19', 'circle 95 58 10 6', 'fill 20', 'circlet 2 2 10 7 99');
    s.push('fill 21', 'line -5 -5 101 65 8', 'fill 22', 'rect -5 -5 107 71 9', 'fill 23', 'rectt -5 -5 107 71 10 30', 'fill 24', 'pixel 100 0 11', 'pixel -1 1 12');
    s.push(`rawclip ${MIN} ${MIN} ${MAX} ${MAX}`, 'fill 25', 'hline 10 10 5 13', `hline ${MIN} 10 ${MAX} 14`, 'fill 26', 'vline 10 10 5 15', `vline 10 ${MIN} ${MAX} 16`);
    s.push('fill 27', `fillrect 10 10 ${MAX} 3 17`, 'fill 28', 'circle 10 10 5 18', 'fill 29', `pixel ${MIN} 0 19`, 'resetclip');
    s.push(`rawclip 0 0 ${W} ${H}`, 'r3d', 'resetclip', 'r3d');

    // r3d with a width of zero makes getOffsetX/Y divide by zero
    s.push('buf 50 0 50 30', 'r3d', 'thick 0 0 5 5 1 2', 'origin 3 3');

    // long shallow and long steep lines (|dx| or |dy| up to 399): drawLine2's step rounding only shows past ~100
    for (const [bw, bh] of [
        [400, 6],
        [6, 400]
    ]) {
        s.push(`buf ${bw * bh} ${bw} ${bh} ${bw}`);
        for (const [x0, y0] of [
            [0, 0],
            [bw - 1, bh - 1],
            [0, bh - 1]
        ]) {
            for (let y1 = 0; y1 < bh; y1++) for (let x1 = 0; x1 < bw; x1++) s.push(`line ${x0} ${y0} ${x1} ${y1} ${Math.imul(x1 * 512 + y1, 0x01030507)}`);
        }
    }
    s.push(`buf ${len} ${W} ${H} 31`, 'r3d', 'trans 0');
    return s;
}

function directedRasterCases(): string[] {
    const s: string[] = [];
    s.push(`raster ${RW} ${RH} -1 1`, `rclip 0 ${RW - 1} 0 ${RH - 1}`);
    // helper doubles at their boundaries
    for (const [v, max, min] of [
        [5, 10, 0],
        [-1, 10, 0],
        [11, 10, 0],
        [10, 10, 0],
        [0, 10, 0],
        [5, 0, 10],
        [MIN, MAX, MIN],
        [MAX, MIN, MAX]
    ])
        s.push(`hclamp ${v} ${max} ${min}`);
    for (const [a, b] of [
        [0, 0],
        [0, 1],
        [0, 7],
        [0, 8],
        [0, 9],
        [3, 82],
        [0, 83],
        [0, 84],
        [5, 2],
        [-1, 3],
        [80, 90]
    ])
        s.push(`hfill ${a} 3 ${b} ${a * 7 + b}`);
    s.push('hfill 0 -1 3 1', `hfill 0 ${RH} 3 1`, `hfill ${MIN} 4 ${MIN + 3} 2`, `hfill ${MAX - 3} 4 ${MAX} 3`);
    for (const [y1, y0, x] of [
        [5, 20, 3],
        [20, 5, 3],
        [5, 5, 3],
        [-5, 100, 4],
        [10, 20, -1],
        [10, 20, RW - 1],
        [10, 20, RW]
    ])
        s.push(`hvline ${y1} ${y0} 77 ${x}`);
    for (const [y, x0, x1] of [
        [5, 3, 20],
        [5, 20, 3],
        [5, 3, 3],
        [-1, 3, 20],
        [RH - 1, -5, 200],
        [RH, 0, 5]
    ])
        s.push(`hhline 78 ${y} ${x0} ${x1}`);
    for (const [y1, x1, y0, x0] of [
        [10, 10, 10, 10],
        [10, 20, 10, 10],
        [20, 10, 10, 10],
        [20, 30, 10, 10],
        [10, 10, 20, 30],
        [30, 10, 10, 20],
        [10, 40, 30, 10],
        [-1, 5, 5, 5],
        [5, 5, 5, -1]
    ]) {
        s.push(`hbres ${y1} 79 ${x1} ${y0} ${x0}`);
    }
    // drawLine: vertical, horizontal, shallow, steep, clipped on each side, zero slope (division by zero), point
    s.push('rclip 10 70 8 60');
    for (const [x1, y0, y1, x0] of [
        [30, 20, 40, 30],
        [30, 40, 20, 30],
        [30, 20, 20, 30],
        [5, 20, 20, 50],
        [50, 20, 20, 5],
        [60, 10, 50, 20],
        [20, 50, 10, 60],
        [0, 0, 70, 82],
        [82, 70, 0, 0],
        [-10, 30, 31, 90],
        [40, -10, 90, 41],
        [200, 30, 31, -100],
        [5, 30, 31, 3],
        [80, 2, 3, 75],
        [30, 5, 65, 31]
    ]) {
        s.push(`drawline ${x1} 4242 ${y0} ${y1} ${x0}`);
    }
    // fillEllipseClipped: degenerate, negative radii, clipped by every edge, overflowing squares
    for (const [ry, y, x, rx] of [
        [0, 30, 30, 0],
        [0, 30, 30, 10],
        [10, 30, 30, 0],
        [5, 30, 30, 20],
        [20, 30, 30, 5],
        [-5, 30, 30, 5],
        [5, 30, 30, -5],
        [40, 30, 40, 40],
        [30, 8, 40, 20],
        [30, 60, 40, 20],
        [30, 30, 10, 20],
        [30, 30, 70, 20],
        [30, 7, 40, 20],
        [30, 61, 40, 20],
        [100, 30, 40, 100],
        [1, 30, 40, 1]
    ]) {
        s.push(`ellipse ${ry} ${y} ${x} 5151 ${rx}`);
    }
    // every radius pair up to 40 inside the clip: the incremental error terms decide each row's span
    s.push(`rclip 0 ${RW - 1} 0 ${RH - 1}`);
    for (let ry = 0; ry <= 34; ry++) for (let rx = 0; rx <= 40; rx++) s.push(`ellipse ${ry} 35 41 ${Math.imul(ry * 64 + rx, 0x01030507)} ${rx}`);
    s.push('rclip 10 70 8 60');
    // drawLine from inside, outside and on-edge start points to a grid of end points around the clip
    for (const [x0, y0] of [
        [5, 5],
        [78, 66],
        [41, -10],
        [10, 8],
        [70, 60],
        [40, 30]
    ]) {
        s.push(`raster ${RW} ${RH} -1 ${x0 + y0}`);
        for (let y1 = -10; y1 <= RH + 10; y1 += 3) for (let x1 = -10; x1 <= RW + 10; x1 += 3) s.push(`drawline ${x1} ${Math.imul(x1 * 128 + y1, 0x01030507)} ${y0} ${y1} ${x0}`);
    }
    s.push(`raster ${RW} ${RH} 30 2`, 'ellipse 5 30 30 6 5', 'drawline 30 7 20 40 30', 'drawline 10 7 30 30 60', 'hvline 20 40 8 30', 'hhline 9 30 10 60');
    s.push(`raster ${RW} -1 -1 3`, 'ellipse 5 30 30 6 5', 'drawline 30 7 20 40 30', 'drawline 30 7 30 30 60', 'hfill 0 0 3 1', 'hhline 9 30 10 60', 'hbres 10 1 20 30 40');
    s.push(`raster ${RW} ${RH} -1 4`, `rclip 0 ${RW - 1} 0 ${RH - 1}`, 'ellipse 2000 35 41 6 2000', 'ellipse 3000 35 41 7 100', 'ellipse 100 35 41 8 30000');
    return s;
}

test('Pix2D matches td, ea.a and ef.a in client.jar', () => {
    // The shape raster statics are process-wide: start from their <clinit> values (as the fresh JVM does) and restore.
    const saved = { raster: shapes.raster, clipMinX: shapes.clipMinX, clipMaxX: shapes.clipMaxX, clipTop: shapes.clipTop, clipMaxY: shapes.clipMaxY };
    Object.assign(shapes, { raster: null, clipMinX: 0, clipMaxX: 100, clipTop: 0, clipMaxY: 100 });
    try {
        const script: string[] = [];
        const got: string[] = [];
        const emit = (line: string): void => {
            got.push(execute(script.length, line));
            script.push(line);
        };

        for (const line of directedCases()) emit(line);

        const r = new Rng(0x2c1b3c6d);
        emit(`buf ${W * H} ${W} ${H} 77`);
        emit('r3d');
        for (let i = 0; i < RANDOM_MAIN; i++) {
            emit(randomTdOp(r, W, H));
            if (script[script.length - 1].startsWith('setclip') || script[script.length - 1].startsWith('intersect') || script[script.length - 1] === 'resetclip') {
                if (r.int(0, 2) === 0) emit('r3d');
            }
        }

        // a narrow, tall framebuffer and a wide, short one
        emit('buf 1100 11 100 5');
        emit('r3d');
        for (let i = 0; i < RANDOM_SMALL; i++) emit(randomTdOp(r, 11, 100));
        emit('buf 2400 400 6 6');
        emit('r3d');
        for (let i = 0; i < RANDOM_SMALL / 2; i++) emit(randomTdOp(r, 400, 6));

        for (const line of directedRasterCases()) emit(line);
        emit(`raster ${RW} ${RH} -1 9`);
        emit(`rclip 0 ${RW - 1} 0 ${RH - 1}`);
        for (let i = 0; i < RANDOM_RASTER; i++) emit(randomRasterOp(r));

        const want = runOracle(script.join('\n') + '\n');
        expect(want.length).toBe(script.length);
        const mismatches: string[] = [];
        for (let i = 0; i < want.length && mismatches.length < 20; i++) {
            if (want[i] !== got[i]) mismatches.push(`${script[i]}\n  java: ${want[i]}\n  ts:   ${got[i]}`);
        }
        expect(mismatches).toEqual([]);
        expect(got).toEqual(want);

        // the script must actually reach the interesting outcomes
        const results = new Set(want.map(line => line.split(' ')[2]));
        for (const result of ['ok', 'aioobe', 'npe', 'iae', 'arith']) expect(results.has(result)).toBe(true);
    } finally {
        Object.assign(shapes, saved);
    }
}, 600000);
