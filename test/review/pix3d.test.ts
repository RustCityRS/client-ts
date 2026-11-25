import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import Pix3D from '../../src/dash3d/Pix3D.js';
import type TextureProvider from '../../src/dash3d/TextureProvider.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import { mathRandom } from '../../src/util/JavaRandom.js';
import { gamepackPath } from '../reference.js';

// dc (Pix3D), the pc (TextureProvider) calls it makes and the clip statics oj.j/vf.X/p.l/fl.m against client.jar.
// A seeded script of operations runs through test/review/pix3d/pix3dOracle.java (reflection on the real dc/td
// classes, with a Proxy over pc) and through the TS port. Each result line must match exactly: the result
// (ok, or the Java exception: aioobe/arith/npe/nase), the hash of the whole framebuffer (so the partial frame left by
// an exception counts too), textureFallback/lowMemTexture/opaque/hclip, and the ordered texture-loader calls with
// their arguments (the Java side flags any dummy argument other than the constant documented in TextureProvider.ts).
//
// Coverage: the sin/cos/reciprocal tables; setRenderClipping/setBounds (including the scanline reallocation, a
// zero-width framebuffer, negative sizes and NegativeArraySizeException), setOrigin/resetOrigin, getOffsetX/Y; the
// HSL colour table at brightness 0.6/0.7/0.8/0.9/1.0 and degenerate exponents, partial ranges, and seeded
// setBrightness/setRandomBrightness jitter; adjustLightness and testHclip; random flat, Gouraud, terrain-textured and
// model-textured triangles near, around, far outside and (int-overflowing) very far outside the viewport, projected
// 3D faces with a real texture basis, degenerate and zero-area faces, every trans mode, lowDetail on/off, hclip
// computed or forced; all six vertex orders of ten edge-case triangles; direct scanline (raster) calls; the
// 64 and 128 texel paths, opaque and transparent texels, a missing texture (average-colour fallback), mismatched texel
// sizes; a null texture loader, a null framebuffer and calls after unload().

// Fake textures, identical to pix3dOracle.java.
const LOW = [true, false, true, false, false, false, true, false];
const OPAQUE = [true, true, false, false, false, false, false, true];
const SIZE = [4096, 16384, 4096, 16384, -1, 4096, 16384, 4096];
const AVERAGE = [0x3f7a, 0xffff, 0, 0x007f, 0x1234, 0x8080, 0xc3ff, 0x2b40];

const BRIGHTNESS = [0.6, 0.7, 0.8, 0.9];
const TRANS = [0, 0, 0, 0, 1, 2, 10, 11, 64, 128, 200, 254, 254, 255, 255];
const PERMUTATIONS = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0]
];

function texel(t: number, i: number): number {
    if (i % 11 === 0) return 0;
    let v = Math.imul(i + 1, 0x9e3779b1 | 0) ^ Math.imul(t, 0x85ebca6b | 0);
    v ^= v >>> 13;
    v = Math.imul(v, 0x5bd1e995);
    v ^= v >>> 15;
    if (i % 13 === 0) return (v & 0xff000000) | 0x01000000;
    if (i % 17 === 0) return v;
    return v & 0xffffff;
}

function fillValue(seed: number, i: number): number {
    let v = Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
    v ^= v >>> 15;
    return v;
}

function fill(px: Int32Array, seed: number): void {
    for (let i = 0; i < px.length; i++) px[i] = fillValue(seed, i);
}

function hash(values: ArrayLike<number> | null): string {
    if (values === null) return 'null';
    let h = 1;
    for (let i = 0; i < values.length; i++) h = (Math.imul(h, 31) + values[i]) | 0;
    return String(h);
}

function floatBits(value: number): number {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, value);
    return view.getInt32(0);
}

function floatFromBits(bits: number): number {
    const view = new DataView(new ArrayBuffer(4));
    view.setInt32(0, bits);
    return view.getFloat32(0);
}

// xorshift32: only drives script generation, the script itself is what both sides consume.
class Rng {
    private s: number;

    constructor(seed: number) {
        this.s = seed | 0 || 1;
    }

    next(): number {
        let x = this.s;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        this.s = x | 0;
        return x >>> 0;
    }

    int(lo: number, hi: number): number {
        return lo + Math.floor((this.next() / 4294967296) * (hi - lo + 1));
    }

    i32(): number {
        return this.next() | 0;
    }

    bool(p = 0.5): boolean {
        return this.next() / 4294967296 < p;
    }

    pick<T>(values: readonly T[]): T {
        return values[this.int(0, values.length - 1)];
    }
}

type Kind = 'flat' | 'gouraud' | 'ttex' | 'tex';
interface Geometry {
    y: number[];
    x: number[];
    basis: number[] | null;
}

function generateScript(): string[] {
    const rng = new Rng(0x530dc0de);
    const ops: string[] = [];
    const vp = { fbw: 0, fbh: 0, x0: 0, y0: 0, w: 0, h: 0, ox: 0, oy: 0 };
    let fillSeed = 1;

    const fb = (w: number, h: number): void => {
        ops.push(`fb ${w} ${h} ${fillSeed++}`);
        vp.fbw = w;
        vp.fbh = h;
    };
    const setBounds = (op: 'clip' | 'bounds', x0: number, y0: number, x1: number, y1: number): void => {
        ops.push(`${op} ${x0} ${y0} ${x1} ${y1}`);
        vp.x0 = x0;
        vp.y0 = y0;
        vp.w = x1 - x0;
        vp.h = y1 - y0;
        vp.ox = (vp.w / 2) | 0;
        vp.oy = (vp.h / 2) | 0;
    };
    const origin = (x: number, y: number): void => {
        ops.push(`origin ${x} ${y}`);
        vp.ox = x - vp.x0;
        vp.oy = y - vp.y0;
    };
    const palette = (): void => {
        const b = floatBits(rng.pick(BRIGHTNESS));
        if (rng.bool()) ops.push(`bright ${b}`);
        else ops.push(`setbright ${rng.i32()} ${b}`);
    };
    const bit = (p = 0.5): number => (rng.bool(p) ? 1 : 0);

    // View-space point that projects (originX + (x << 9) / z) near screen position (sx, sy).
    const backProject = (sx: number, sy: number, z: number): number[] => [(((sx - vp.ox) * z) / 512) | 0, (((sy - vp.oy) * z) / 512) | 0, z];

    const basisFor = (g: { y: number[]; x: number[] }): number[] => {
        const r = rng.int(0, 99);
        if (r < 55) {
            const p = [0, 1, 2].map(k => backProject(g.x[k], g.y[k], rng.int(50, 3500)));
            const order = rng.pick(PERMUTATIONS);
            const q = order.map(k => p[k]);
            if (rng.bool(0.25)) q[2] = backProject(rng.int(-50, vp.w + 50), rng.int(-50, vp.h + 50), rng.int(50, 3500));
            return [q[0][0], q[1][0], q[2][0], q[0][1], q[1][1], q[2][1], q[0][2], q[1][2], q[2][2]];
        }
        if (r < 85) return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (i >= 6 ? rng.int(50, 3500) : rng.int(-3000, 3000)));
        if (r < 96) return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => rng.int(-1000000, 1000000));
        return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(() => rng.i32());
    };

    const projected = (): Geometry => {
        const zc = rng.int(80, 3000);
        const p = [0, 1, 2].map(() => backProject(rng.int(-40, vp.w + 40), rng.int(-40, vp.h + 40), Math.max(50, Math.min(3500, zc + rng.int(-(zc >> 1), zc >> 1)))));
        const x = p.map(v => (vp.ox + (((v[0] << 9) / v[2]) | 0)) | 0);
        const y = p.map(v => (vp.oy + (((v[1] << 9) / v[2]) | 0)) | 0);
        let q = p;
        const r = rng.int(0, 2);
        if (r === 0) q = rng.pick(PERMUTATIONS).map(k => p[k]);
        else if (r === 1) q = [p[0], p[1], backProject(rng.int(-40, vp.w + 40), rng.int(-40, vp.h + 40), rng.int(50, 3500))];
        return { y, x, basis: [q[0][0], q[1][0], q[2][0], q[0][1], q[1][1], q[2][1], q[0][2], q[1][2], q[2][2]] };
    };

    const screen = (): Geometry => {
        const r = rng.int(0, 99);
        let y: number[], x: number[];
        if (r < 40) {
            const s = rng.pick([0, 0, 8, 30]);
            const ty = [rng.int(-s, vp.h + s), rng.int(-s, vp.h + s)];
            const tx = [rng.int(-s, vp.w + s), rng.int(-s, vp.w + s)];
            y = [0, 1, 2].map(() => (rng.bool(0.3) ? rng.pick(ty) : rng.int(-s, vp.h + s)));
            x = [0, 1, 2].map(() => (rng.bool(0.15) ? rng.pick(tx) : rng.int(-s, vp.w + s)));
        } else if (r < 58) {
            y = [0, 1, 2].map(() => rng.int(-150, vp.h + 150));
            x = [0, 1, 2].map(() => rng.int(-150, vp.w + 150));
        } else if (r < 70) {
            // degenerate: identical points, a repeated point, collinear, one row, one column
            const a = [rng.int(-20, vp.h + 20), rng.int(-20, vp.w + 20)];
            const b = [rng.int(-20, vp.h + 20), rng.int(-20, vp.w + 20)];
            const d = rng.int(0, 5);
            let pts: number[][];
            if (d === 0) pts = [a, a, a];
            else if (d === 1) pts = [a, b, b];
            else if (d === 2) pts = [a, b, [2 * b[0] - a[0], 2 * b[1] - a[1]]];
            else if (d === 3) pts = [a, b, [(a[0] + b[0]) >> 1, (a[1] + b[1]) >> 1]];
            else if (d === 4) pts = [a, [a[0], b[1]], [a[0], rng.int(-20, vp.w + 20)]];
            else pts = [a, [b[0], a[1]], [rng.int(-20, vp.h + 20), a[1]]];
            const order = rng.pick(PERMUTATIONS);
            y = order.map(k => pts[k][0]);
            x = order.map(k => pts[k][1]);
        } else if (r < 76) {
            // slivers inside a 4x4 box
            const cy = rng.int(-2, vp.h + 2),
                cx = rng.int(-2, vp.w + 2);
            y = [0, 1, 2].map(() => cy + rng.int(0, 3));
            x = [0, 1, 2].map(() => cx + rng.int(0, 3));
        } else if (r < 95) {
            y = [0, 1, 2].map(() => rng.int(-200000, 200000));
            x = [0, 1, 2].map(() => rng.int(-200000, 200000));
        } else {
            y = [0, 1, 2].map(() => rng.i32());
            x = [0, 1, 2].map(() => rng.i32());
        }
        return { y, x, basis: null };
    };

    const colours = (kind: Kind): number[] => {
        if (kind === 'flat') {
            const r = rng.int(0, 9);
            return [r < 5 ? rng.int(0, 0xffffff) : r < 8 ? rng.i32() : rng.pick([0, 1, 0xffffff, 0xff00ff, -1])];
        }
        if (kind === 'gouraud') {
            const r = rng.int(0, 9);
            if (r < 7) {
                const hs = rng.int(0, 511) << 7;
                return [0, 1, 2].map(() => hs + rng.int(0, 127));
            }
            if (r < 9) return [0, 1, 2].map(() => rng.int(0, 65535));
            return [0, 1, 2].map(() => (rng.bool(0.7) ? rng.int(0, 65535) : rng.i32()));
        }
        const r = rng.int(0, 19);
        if (r < 12) return [0, 1, 2].map(() => rng.int(0, 127));
        if (r < 17) return [0, 1, 2].map(() => rng.int(0, 65535));
        return [0, 1, 2].map(() => rng.i32());
    };

    const triangle = (kind: Kind, g: Geometry, c: number[], tex: number, fixed?: { ld: number; trans: number; hclip?: number }): void => {
        if (rng.bool(0.92)) ops.push(`fill ${fillSeed++}`);
        const ld = fixed ? fixed.ld : bit();
        const trans = fixed ? fixed.trans : rng.bool(0.03) ? rng.pick([256, 300, -5, 512]) : rng.pick(TRANS);
        // hclip: 0..5 computed by testHclip from the x coordinates, 6..7 forced off, 8..9 forced on
        const mode = fixed && fixed.hclip !== undefined ? fixed.hclip : rng.int(0, 9);
        ops.push(`state ${ld} ${trans} ${mode >= 8 ? 1 : 0} ${bit()} ${bit()} ${bit()}`);
        if (mode <= 5) ops.push(`hclip ${g.x[0]} ${g.x[1]} ${g.x[2]}`);
        const args = [...g.y, ...g.x, ...c];
        if (kind === 'ttex' || kind === 'tex') args.push(...(g.basis ?? basisFor(g)), tex);
        ops.push(`${kind} ${args.join(' ')}`);
    };

    const randomTriangle = (): void => {
        const kind = rng.pick<Kind>(['flat', 'gouraud', 'gouraud', 'ttex', 'ttex', 'tex', 'tex', 'tex']);
        const g = kind !== 'flat' && rng.bool(0.3) ? projected() : screen();
        triangle(kind, g, colours(kind), rng.int(0, 7));
    };

    const raster = (): void => {
        if (rng.bool(0.9)) ops.push(`fill ${fillSeed++}`);
        const size = vp.fbw * vp.fbh;
        ops.push(`state ${bit()} ${rng.bool(0.04) ? rng.pick([256, 300, -5]) : rng.pick(TRANS)} ${bit()} ${bit()} ${bit()} ${bit()}`);
        const r = rng.int(0, 99);
        const row = Math.max(0, Math.min(vp.h - 1, rng.int(0, vp.h - 1)));
        const offset = r < 60 ? (vp.y0 + row) * vp.fbw + vp.x0 : r < 80 ? rng.int(0, Math.max(0, size - 1)) : r < 92 ? size - rng.int(0, 40) : -rng.int(0, 40);
        const huge = rng.bool(0.06);
        const x0 = huge ? rng.i32() : rng.int(-60, vp.w + 60);
        const x1 = huge ? rng.i32() : rng.int(-60, vp.w + 60);
        const kind = rng.pick(['rflat', 'rgour', 'rttex', 'rtex']);
        if (kind === 'rflat') {
            ops.push(`rflat ${offset} ${rng.bool(0.8) ? rng.int(0, 0xffffff) : rng.i32()} ${rng.i32()} ${x0} ${x1}`);
        } else if (kind === 'rgour') {
            const colour = rng.bool(0.9) ? rng.int(0, 65535) << 8 : rng.i32();
            const step = rng.bool(0.9) ? rng.int(-2048, 2048) : rng.i32();
            ops.push(`rgour ${offset} ${rng.i32()} ${rng.i32()} ${x0} ${x1} ${colour} ${step}`);
        } else {
            const tex = rng.int(0, 7);
            const shade = rng.bool(0.85) ? rng.int(0, 127 << 9) : rng.i32();
            const shadeStep = rng.bool(0.85) ? rng.int(-1024, 1024) : rng.i32();
            const p: number[] = [];
            const w = rng.int(0, 9);
            if (w < 2) {
                p.push(rng.int(-(1 << 24), 1 << 24), rng.int(-(1 << 24), 1 << 24), rng.int(-4095, 4095), rng.int(-4096, 4096), rng.int(-4096, 4096), rng.int(-64, 64));
            } else if (w < 7) {
                p.push(rng.int(-(1 << 26), 1 << 26), rng.int(-(1 << 26), 1 << 26), rng.int(1 << 12, 1 << 26), rng.int(-(1 << 18), 1 << 18), rng.int(-(1 << 18), 1 << 18), rng.int(-(1 << 14), 1 << 14));
            } else {
                for (let i = 0; i < 6; i++) p.push(rng.i32());
            }
            ops.push(`${kind} ${tex} ${rng.i32()} ${rng.i32()} ${offset} ${x0} ${x1} ${shade} ${shadeStep} ${p.join(' ')}`);
        }
    };

    const permutationSuite = (): void => {
        const w = vp.w,
            h = vp.h;
        // [y, x] per vertex
        const bases: number[][][] = [
            [
                [10, 20],
                [h - 10, 40],
                [h >> 1, w - 15]
            ],
            [
                [10, 20],
                [10, w - 20],
                [h - 10, w >> 1]
            ],
            [
                [10, w >> 1],
                [h - 10, 20],
                [h - 10, w - 20]
            ],
            [
                [-20, w >> 1],
                [h + 20, (w >> 1) + 3],
                [h >> 1, (w >> 1) + 1]
            ],
            [
                [h >> 1, -30],
                [(h >> 1) + 2, w + 30],
                [(h >> 1) + 1, w >> 1]
            ],
            [
                [-40, 30],
                [h >> 1, w + 50],
                [h + 40, -20]
            ],
            [
                [h >> 1, 10],
                [h >> 1, w >> 1],
                [h >> 1, w - 10]
            ],
            [
                [0, 0],
                [h, w],
                [0, w]
            ],
            [
                [0, 0],
                [h, 0],
                [h, w]
            ],
            [
                [(h / 3) | 0, -60],
                [((h * 2) / 3) | 0, w + 60],
                [((h * 2) / 3) | 0, (w / 3) | 0]
            ]
        ];
        for (const base of bases) {
            const basis = basisFor({ y: base.map(v => v[0]), x: base.map(v => v[1]) });
            const flat = rng.int(0, 0xffffff);
            const hs = rng.int(0, 511) << 7;
            const gouraud = [0, 1, 2].map(() => hs + rng.int(0, 127));
            const shade = [0, 1, 2].map(() => rng.int(0, 127));
            for (const order of PERMUTATIONS) {
                const g: Geometry = { y: order.map(k => base[k][0]), x: order.map(k => base[k][1]), basis };
                for (const ld of [0, 1]) {
                    for (const trans of [0, 128]) {
                        triangle('flat', g, [flat], 0, { ld, trans });
                        triangle(
                            'gouraud',
                            g,
                            order.map(k => gouraud[k]),
                            0,
                            { ld, trans }
                        );
                        for (const tex of [0, 3]) {
                            triangle(
                                'ttex',
                                g,
                                order.map(k => shade[k]),
                                tex,
                                { ld, trans }
                            );
                            triangle(
                                'tex',
                                g,
                                order.map(k => shade[k]),
                                tex,
                                { ld, trans }
                            );
                        }
                    }
                }
            }
        }
    };

    ops.push('tables');
    fb(257, 171);
    setBounds('clip', 0, 0, 257, 171);
    ops.push('offsets');

    // Colour table: the four client palettes, 1.0 and degenerate exponents (pow gives 0, 1, Infinity or NaN).
    for (const b of [...BRIGHTNESS, 1.0, 0.75, 0.8123]) ops.push(`bright ${floatBits(b)}`);
    for (const bits of [0, floatBits(-0.5), floatBits(2.5), floatBits(1e-30), 0x7fc00000, 0x7f800000, 0xff800000 | 0, 0x80000000 | 0]) ops.push(`bright ${bits}`);
    for (const [from, to] of [
        [0, 1],
        [511, 512],
        [100, 50],
        [37, 38],
        [0, 513],
        [-1, 2],
        [200, 260]
    ]) {
        ops.push(`bright ${floatBits(0.7)}`, `colours ${from} ${to}`);
    }
    for (let i = 0; i < 24; i++) ops.push(`setbright ${rng.i32()} ${floatBits(i < 16 ? BRIGHTNESS[i & 3] : rng.int(0, 2000) / 1000)}`);
    for (let i = 0; i < 16; i++) ops.push(`setrand ${rng.i32()} ${floatBits(i < 8 ? BRIGHTNESS[i & 3] : rng.int(-1000, 3000) / 1000)}`);
    for (let i = 0; i < 400; i++) {
        const a = i < 300 ? rng.int(0, 65535) : rng.i32();
        const b = i < 200 ? rng.int(0, 127) : i < 300 ? rng.int(-300, 400) : rng.i32();
        ops.push(`adjust ${a} ${b}`);
    }
    for (let i = 0; i < 200; i++) {
        const v = (): number => (i < 180 ? rng.int(-3, vp.w + 3) : rng.i32());
        ops.push(`hclip ${v()} ${v()} ${v()}`);
    }
    ops.push('loader 1');

    // Viewports: [fbw, fbh, op, x0, y0, x1, y1, origin x, origin y] (origin -1 keeps the centred origin).
    const viewports: [number, number, 'clip' | 'bounds', number, number, number, number, number, number][] = [
        [257, 171, 'clip', 0, 0, 257, 171, -1, -1],
        [257, 171, 'clip', 10, 7, 240, 160, 100, 60],
        [64, 48, 'clip', 0, 0, 64, 48, 5, 40],
        [512, 334, 'clip', 0, 0, 512, 334, -1, -1],
        [31, 17, 'bounds', 2, 1, 29, 16, -1, -1],
        [100, 1200, 'bounds', 0, 0, 100, 1100, 30, 900],
        [333, 250, 'clip', 13, 21, 300, 230, 200, 50]
    ];
    viewports.forEach(([fbw, fbh, op, x0, y0, x1, y1, ox, oy], block) => {
        fb(fbw, fbh);
        setBounds(op, x0, y0, x1, y1);
        if (ox >= 0) origin(ox, oy);
        ops.push('offsets');
        for (let i = 0; i < 1400; i++) {
            if (i % 350 === 0) palette();
            randomTriangle();
        }
        if (block === 0 || block === 2) permutationSuite();
        for (let i = 0; i < 300; i++) raster();
        if (ox >= 0) {
            ops.push('reset');
            vp.ox = (vp.w / 2) | 0;
            vp.oy = (vp.h / 2) | 0;
            for (let i = 0; i < 100; i++) randomTriangle();
        }
    });

    // A missing texture loader: the textured triangles throw before drawing anything.
    fb(64, 48);
    setBounds('clip', 0, 0, 64, 48);
    ops.push('loader 0');
    for (let i = 0; i < 20; i++) randomTriangle();
    ops.push('loader 1');

    // Odd viewports: negative width, zero height, a framebuffer narrower than the viewport, a null framebuffer.
    for (const [fbw, fbh, x0, y0, x1, y1] of [
        [64, 48, 50, 0, 40, 10],
        [64, 48, 0, 0, 64, 0],
        [16, 64, 0, 0, 40, 20],
        [64, 48, 0, 10, 64, 4]
    ]) {
        fb(fbw, fbh);
        setBounds('clip', x0, y0, x1, y1);
        ops.push('offsets');
        for (let i = 0; i < 40; i++) randomTriangle();
    }
    fb(64, 48);
    setBounds('clip', 0, 0, 64, 48);
    ops.push('fbnull');
    for (let i = 0; i < 20; i++) randomTriangle();
    fb(0, 10);
    setBounds('clip', 0, 0, 0, 10);
    ops.push('offsets', 'origin 1 1');
    fb(64, 48);
    setBounds('bounds', -5, -3, 60, 40);
    ops.push('offsets', 'origin 7 9');
    setBounds('bounds', 0, 0, 1, 1500000000);
    ops.push('offsets');
    setBounds('clip', 0, 0, 64, 48);
    for (let i = 0; i < 20; i++) randomTriangle();

    // After unload(): the tables, scanline offsets, colour table and loader are gone.
    ops.push('unload', 'tables', 'offsets', 'flat 1 20 40 5 60 30 255', 'gouraud 1 20 40 5 60 30 100 200 300', 'tex 1 20 40 5 60 30 50 60 70 0 10 0 0 0 10 500 500 500 3');
    ops.push('rflat 10 255 0 0 5', `bright ${floatBits(0.8)}`, 'clip 0 0 64 48', 'reset', 'hclip 1 2 3', 'adjust 300 50');
    return ops;
}

function runOracle(script: string[]): string[] {
    const source = fileURLToPath(new URL('./pix3d/pix3dOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-cp', gamepackPath, source], {
        stdin: Buffer.from(script.join('\n') + '\n'),
        timeout: 170000
    });
    if (java.exitCode !== 0) throw new Error(`pix3dOracle exited ${java.exitCode}: ${java.stderr.toString()}`);
    const lines = java.stdout.toString().split(/\r?\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
}

function run(body: () => void): string {
    try {
        body();
        return 'ok';
    } catch (e) {
        if (e instanceof RangeError) {
            if (e.message.startsWith('array index')) return 'aioobe';
            if (e.message === '/ by zero') return 'arith';
            // new Int32Array(negative): Java's NegativeArraySizeException. Bun words it per tier: cold
            // 'length cannot be negative: ...', JIT hot path 'Requested length is negative' (Codex, frozen suite 18:16).
            if (e.message.startsWith('Invalid typed array length') || e.message.startsWith('length cannot be negative') || e.message.startsWith('Requested length is negative')) return 'nase';
        }
        if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) return 'npe';
        return `error:${String(e)}`;
    }
}

test('Pix3D matches dc in client.jar on a seeded script of tables, bounds, palettes, triangles and scanlines', () => {
    const script = generateScript();
    const want = runOracle(script);

    const texels = SIZE.map((size, t) => (size < 0 ? null : Int32Array.from({ length: size }, (_, i) => texel(t, i))));
    const calls: string[] = [];
    const loader: TextureProvider = {
        getTextureSmall(id: number): boolean {
            calls.push(`L${id}`);
            return LOW[id];
        },
        isAvailable(id: number): boolean {
            calls.push(`A${id}`);
            return true;
        },
        getPixels(id: number): Int32Array | null {
            calls.push(`G${id}`);
            return texels[id];
        },
        isLoaded(id: number): boolean {
            calls.push(`D${id}`);
            return true;
        },
        getTextureData(id: number, brightness: number): Int32Array | null {
            calls.push(`P${id},${floatBits(brightness)}${Math.fround(brightness) === brightness ? '' : '!unrounded'}`);
            return texels[id];
        },
        getTextureColour(id: number): number {
            calls.push(`V${id}`);
            return AVERAGE[id];
        },
        getTextureSolid(id: number): boolean {
            calls.push(`O${id}`);
            return OPAQUE[id];
        }
    };

    // Other suites in the same bun process may have used Pix3D/Pix2D; start from dc's and td's fresh-JVM state and
    // put everything back afterwards (the script ends with unload()).
    const saved3d = {
        lowDetail: Pix3D.lowDetail,
        textureFallback: Pix3D.textureFallback,
        trans: Pix3D.trans,
        hclip: Pix3D.hclip,
        originX: Pix3D.originX,
        originY: Pix3D.originY,
        width: Pix3D.width,
        textureProvider: Pix3D.textureProvider,
        clipMinX: Pix3D.clipMinX,
        clipMaxX: Pix3D.clipMaxX,
        clipMinY: Pix3D.clipMinY,
        clipMaxY: Pix3D.clipMaxY,
        cosTable: Pix3D.cosTable,
        sinTable: Pix3D.sinTable,
        divTable2: Pix3D.divTable2,
        colourTable: Pix3D.colourTable,
        divTable: Pix3D['divTable'],
        scanline: Pix3D['scanline'],
        height: Pix3D['height'],
        brightness: Pix3D['brightness'],
        lowMemTexture: Pix3D['lowMemTexture'],
        opaque: Pix3D['opaque']
    };
    const saved2d = {
        pixels: Pix2D.pixels,
        width: Pix2D.width,
        height: Pix2D.height,
        clipMinX: Pix2D.clipMinX,
        clipMinY: Pix2D.clipMinY,
        clipMaxX: Pix2D.clipMaxX,
        clipMaxY: Pix2D.clipMaxY
    };
    Pix3D.lowDetail = true;
    Pix3D.textureFallback = false;
    Pix3D.trans = 0;
    Pix3D.hclip = false;
    Pix3D.originX = Pix3D.originY = Pix3D.width = 0;
    Pix3D['height'] = 0;
    Pix3D.clipMinX = Pix3D.clipMaxX = Pix3D.clipMinY = Pix3D.clipMaxY = 0;
    Pix3D.textureProvider = null;
    Pix3D.colourTable = new Int32Array(65536);
    Pix3D['scanline'] = new Int32Array(1024);
    Pix3D['brightness'] = 1.0;
    Pix3D['lowMemTexture'] = false;
    Pix3D['opaque'] = false;

    const flags = (): string => `${Pix3D.textureFallback ? 1 : 0}${Pix3D['lowMemTexture'] ? 1 : 0}${Pix3D['opaque'] ? 1 : 0}${Pix3D.hclip ? 1 : 0}`;
    const viewport = (r: string): string => {
        const d = Pix3D['scanline'];
        return `${r} ${Pix3D.width} ${Pix3D['height']} ${Pix3D.originX} ${Pix3D.originY} ${Pix3D.clipMinX} ${Pix3D.clipMaxX} ${Pix3D.clipMinY} ${Pix3D.clipMaxY} ${d === null ? -1 : d.length} ${hash(d)}`;
    };

    const got: string[] = [];
    const drawn = new Map<string, number>();
    const results = new Map<string, number>();
    try {
        for (const line of script) {
            const f = line.split(' ');
            const op = f[0];
            const a = f.slice(1).map(Number);
            calls.length = 0;
            let result: string;
            switch (op) {
                case 'tables':
                    result = `${hash(Pix3D.sinTable)} ${hash(Pix3D.cosTable)} ${hash(Pix3D['divTable'])} ${hash(Pix3D.divTable2)}`;
                    break;
                case 'fb': {
                    const px = new Int32Array(a[0] * a[1]);
                    fill(px, a[2]);
                    Pix2D.pixels = px;
                    Pix2D.width = a[0];
                    Pix2D.height = a[1];
                    result = 'ok';
                    break;
                }
                case 'fbnull':
                    Pix2D.pixels = null;
                    result = 'ok';
                    break;
                case 'fill': {
                    const px = Pix2D.pixels;
                    if (px !== null) fill(px, a[0]);
                    result = 'ok';
                    break;
                }
                case 'clip':
                    Pix2D.clipMinX = a[0];
                    Pix2D.clipMinY = a[1];
                    Pix2D.clipMaxX = a[2];
                    Pix2D.clipMaxY = a[3];
                    result = viewport(run(() => Pix3D.setRenderClipping()));
                    break;
                case 'bounds':
                    result = viewport(run(() => Pix3D['setBounds'](a[0], a[1], a[2], a[3])));
                    break;
                case 'origin':
                    result = viewport(run(() => Pix3D.setOrigin(a[0], a[1])));
                    break;
                case 'reset':
                    result = viewport(run(() => Pix3D.resetOrigin()));
                    break;
                case 'offsets': {
                    let y = 0,
                        x = 0;
                    const ry = run(() => {
                        y = Pix3D.getOffsetY();
                    });
                    const rx = run(() => {
                        x = Pix3D.getOffsetX();
                    });
                    result = `${ry} ${y} ${rx} ${x}`;
                    break;
                }
                case 'state':
                    Pix3D.lowDetail = a[0] !== 0;
                    Pix3D.trans = a[1];
                    Pix3D.hclip = a[2] !== 0;
                    Pix3D.textureFallback = a[3] !== 0;
                    Pix3D['lowMemTexture'] = a[4] !== 0;
                    Pix3D['opaque'] = a[5] !== 0;
                    result = 'ok';
                    break;
                case 'hclip':
                    Pix3D.testHclip(a[0], a[1], a[2]);
                    result = Pix3D.hclip ? '1' : '0';
                    break;
                case 'bright':
                    Pix3D['brightness'] = floatFromBits(a[0]);
                    result = `${run(() => Pix3D['initColourTable'](0, 512))} ${hash(Pix3D.colourTable)}`;
                    break;
                case 'colours':
                    result = `${run(() => Pix3D['initColourTable'](a[0], a[1]))} ${hash(Pix3D.colourTable)}`;
                    break;
                case 'setbright': {
                    mathRandom.setSeed(BigInt(a[0]));
                    const r = run(() => Pix3D.setBrightness(floatFromBits(a[1])));
                    result = `${r} ${floatBits(Pix3D['brightness'])} ${hash(Pix3D.colourTable)}`;
                    break;
                }
                case 'setrand':
                    mathRandom.setSeed(BigInt(a[0]));
                    Pix3D['setRandomBrightness'](floatFromBits(a[1]));
                    result = String(floatBits(Pix3D['brightness']));
                    break;
                case 'adjust':
                    result = String(Pix3D['adjustLightness'](a[0], a[1]));
                    break;
                case 'loader':
                    Pix3D.setTextures(a[0] === 0 ? null : loader);
                    result = Pix3D.textureProvider === null ? '0' : '1';
                    break;
                case 'unload':
                    Pix3D.unload();
                    result = [Pix3D['scanline'], Pix3D.colourTable, Pix3D.textureProvider, Pix3D['divTable'], Pix3D.divTable2, Pix3D.sinTable, Pix3D.cosTable].map(v => (v === null ? '1' : '0')).join('');
                    break;
                case 'flat':
                case 'gouraud':
                case 'ttex':
                case 'tex':
                case 'rflat':
                case 'rgour':
                case 'rttex':
                case 'rtex': {
                    const before = hash(Pix2D.pixels);
                    const r = run(() => {
                        const px = Pix2D.pixels;
                        if (op === 'flat') Pix3D.flatTriangle(a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
                        else if (op === 'gouraud') Pix3D.gouraudTriangle(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8]);
                        else if (op === 'ttex') Pix3D.terrainTextureTriangle(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15], a[16], a[17], a[18]);
                        else if (op === 'tex') Pix3D.textureTriangle(a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15], a[16], a[17], a[18]);
                        else if (op === 'rflat') Pix3D['flatRaster'](px, a[0], a[1], a[2], a[3], a[4]);
                        else if (op === 'rgour') Pix3D['gouraudRaster'](px, a[0], a[1], a[2], a[3], a[4], a[5], a[6]);
                        else if (op === 'rttex') Pix3D['terrainTextureRaster'](px, texels[a[0]], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13]);
                        else Pix3D['textureRaster'](px, texels[a[0]], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13]);
                    });
                    const after = hash(Pix2D.pixels);
                    result = `${r} ${after} ${flags()} ${calls.length === 0 ? '-' : calls.join(';')}`;
                    const path = op + (calls.includes(`O${a[18]}`) ? `:${a[18]}` : calls.some(c => c.startsWith('V')) ? ':fallback' : '');
                    if (after !== before) drawn.set(path, (drawn.get(path) ?? 0) + 1);
                    results.set(`${op} ${r}`, (results.get(`${op} ${r}`) ?? 0) + 1);
                    break;
                }
                default:
                    throw new Error(`unknown op ${line}`);
            }
            got.push(result);
        }
    } finally {
        Pix3D.lowDetail = saved3d.lowDetail;
        Pix3D.textureFallback = saved3d.textureFallback;
        Pix3D.trans = saved3d.trans;
        Pix3D.hclip = saved3d.hclip;
        Pix3D.originX = saved3d.originX;
        Pix3D.originY = saved3d.originY;
        Pix3D.width = saved3d.width;
        Pix3D.textureProvider = saved3d.textureProvider;
        Pix3D.clipMinX = saved3d.clipMinX;
        Pix3D.clipMaxX = saved3d.clipMaxX;
        Pix3D.clipMinY = saved3d.clipMinY;
        Pix3D.clipMaxY = saved3d.clipMaxY;
        Pix3D.cosTable = saved3d.cosTable;
        Pix3D.sinTable = saved3d.sinTable;
        Pix3D.divTable2 = saved3d.divTable2;
        Pix3D.colourTable = saved3d.colourTable;
        Pix3D['divTable'] = saved3d.divTable;
        Pix3D['scanline'] = saved3d.scanline;
        Pix3D['height'] = saved3d.height;
        Pix3D['brightness'] = saved3d.brightness;
        Pix3D['lowMemTexture'] = saved3d.lowMemTexture;
        Pix3D['opaque'] = saved3d.opaque;
        Pix2D.pixels = saved2d.pixels;
        Pix2D.width = saved2d.width;
        Pix2D.height = saved2d.height;
        Pix2D.clipMinX = saved2d.clipMinX;
        Pix2D.clipMinY = saved2d.clipMinY;
        Pix2D.clipMaxX = saved2d.clipMaxX;
        Pix2D.clipMaxY = saved2d.clipMaxY;
    }

    expect(want.length).toBe(script.length);
    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 25; i++) {
        if (got[i] !== want[i]) mismatches.push(`#${i} ${script[i]}\n  java: ${want[i]}\n  ts:   ${got[i]}`);
    }
    expect(mismatches).toEqual([]);

    // The script must actually reach the paths it claims to: every triangle kind and texture path draws, and each
    // Java exception the port has to reproduce occurs.
    const count = (key: string): number => drawn.get(key) ?? 0;
    for (const key of ['flat', 'gouraud', 'ttex:fallback', 'tex:fallback', 'rflat', 'rgour']) expect(count(key), key).toBeGreaterThan(100);
    for (const tex of [0, 1, 2, 3, 6]) {
        expect(count(`ttex:${tex}`), `ttex:${tex}`).toBeGreaterThan(50);
        expect(count(`tex:${tex}`), `tex:${tex}`).toBeGreaterThan(50);
    }
    expect(count('rttex') + count('rtex')).toBeGreaterThan(200);
    for (const key of ['flat aioobe', 'gouraud aioobe', 'ttex aioobe', 'tex aioobe', 'rflat aioobe', 'rgour aioobe', 'rttex aioobe', 'rtex aioobe', 'ttex npe', 'tex npe', 'rttex npe', 'flat npe', 'gouraud npe']) {
        expect(results.get(key) ?? 0, key).toBeGreaterThan(0);
    }
    for (const result of ['arith', 'nase'])
        expect(
            want.some(line => line.startsWith(result + ' ') || line.includes(` ${result} `)),
            result
        ).toBe(true);
    console.log(`pix3d: ${script.length} operations, ${[...results.values()].reduce((s, v) => s + v, 0)} triangle/scanline calls`);
}, 240000);
