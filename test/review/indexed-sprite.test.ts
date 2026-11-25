import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Pix2D from '../../src/graphics/Pix2D.js';
import Pix8 from '../../src/graphics/Pix8.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import { gamepackPath } from '../reference.js';
import { PIX2D, withClinitStatics } from './staticState.js';

// si (AbstractIndexedSprite) and ch (SoftwareIndexedSprite) against client.jar.
//
// The test builds a seeded script, runs it through the TS port, then pipes the same script into
// indexed/IndexedSpriteOracle.java, which runs it on the real gamepack classes. After every operation both sides
// report whether it completed or threw (and which Java exception), the whole framebuffer hash (so a partial write
// before an exception must match too), the six si geometry fields and hashes of ch.y and the private palette ch.z.
//
// Operations: every ch member. The constructor; draw a(II)V and drawAlpha a(III)V at and across every clip edge;
// drawScaled a(IIII)V and drawScaledTinted a(IIIII)V with zero (ArithmeticException), negative, shrinking and
// growing target sizes; trim a()V (including the no-op case); rotateClockwise b()V (four turns, negative sizes);
// rgbAdjust b(III)V with clamping; the four private static plot routines called directly with arbitrary offsets,
// strides and steps. Inputs cover palette indices beyond the palette, null and short pixel/palette arrays, a null
// framebuffer, framebuffers shorter than width*height, clips outside the buffer, alpha outside 0..256, colours with
// the top byte set and inconsistent geometry set directly (geom). Directed cases come first, then seeded random ones.

const MIN = -2147483648;
const MAX = 2147483647;
const RANDOM_CASES = 20000;

function runOracle(script: string): string[] {
    const source = fileURLToPath(new URL('./indexed/IndexedSpriteOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'indexed-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'IndexedSpriteOracle'], {
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

function pattern(i: number, seed: number): number {
    return Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
}

function ints(a: Int32Array | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0;
    return `${a.length}:${h}`;
}

function bytes(a: Uint8Array | null): string {
    if (a === null) return 'null';
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + (a[i] & 255)) | 0;
    return `${a.length}:${h}`;
}

// ---- TS side ----

let sprite: Pix8 | null = null;

function spriteState(): string {
    if (sprite === null) return 'none';
    const s = sprite;
    return `${s.xOffset},${s.cropH},${s.yOffset},${s.width},${s.height},${s.cropW} ${bytes(s.pixels)} ${ints(s['palette'])}`;
}

function classify(e: unknown): string {
    if (e instanceof TypeError && /^Null (reference|array|byte array)$/.test(e.message)) return 'npe';
    if (e instanceof RangeError) {
        if (e.message === '/ by zero') return 'arith';
        if (e.message.startsWith('array index ') || e.message.startsWith('byte array index ')) return 'aioobe';
        // new Uint8Array(negative): the engine's wording varies ("Requested length is negative", "length cannot be negative").
        if (/negative|Invalid typed array length/.test(e.message)) return 'neg';
    }
    throw e;
}

function execute(index: number, line: string): string {
    const f = line.split(' ');
    const v = f.map((x, i) => (i === 0 ? 0 : Number.parseInt(x, 10)));
    let result = 'ok';
    try {
        switch (f[0]) {
            case 'pix': {
                let buf: Int32Array | null = null;
                if (v[1] >= 0) {
                    buf = new Int32Array(v[1]);
                    for (let i = 0; i < v[1]; i++) buf[i] = pattern(i, v[4]);
                }
                Pix2D.pixels = buf;
                Pix2D.width = v[2];
                Pix2D.height = v[3];
                break;
            }
            case 'clip':
                Pix2D.clipMinX = v[1];
                Pix2D.clipMinY = v[2];
                Pix2D.clipMaxX = v[3];
                Pix2D.clipMaxY = v[4];
                break;
            case 'spr': {
                let pixels: Uint8Array | null = null;
                if (v[7] >= 0) {
                    pixels = new Uint8Array(v[7]);
                    for (let i = 0; i < v[7]; i++) {
                        let value = (pattern(i, v[8]) >>> 8) % (v[9] + 1);
                        if (pattern(i, v[8] ^ 0x55) >>> 29 === 0) value = 0;
                        pixels[i] = value;
                    }
                }
                let palette: Int32Array | null = null;
                if (v[10] >= 0) {
                    palette = new Int32Array(v[10]);
                    for (let i = 0; i < v[10]; i++) palette[i] = pattern(i, v[11]);
                }
                sprite = new Pix8(v[1], v[2], v[3], v[4], v[5], v[6], pixels, palette);
                break;
            }
            case 'geom': {
                const s = requireNonNull(sprite);
                s.xOffset = v[1];
                s.cropH = v[2];
                s.yOffset = v[3];
                s.width = v[4];
                s.height = v[5];
                s.cropW = v[6];
                break;
            }
            case 'draw':
                requireNonNull(sprite).draw(v[1], v[2]);
                break;
            case 'alpha':
                requireNonNull(sprite).drawAlpha(v[1], v[2], v[3]);
                break;
            case 'scale':
                requireNonNull(sprite).drawScaled(v[1], v[2], v[3], v[4]);
                break;
            case 'tint':
                requireNonNull(sprite).drawScaledTinted(v[1], v[2], v[3], v[4], v[5]);
                break;
            case 'trim':
                requireNonNull(sprite).trim();
                break;
            case 'rot':
                requireNonNull(sprite).rotateClockwise();
                break;
            case 'rgb':
                requireNonNull(sprite).rgbAdjust(v[1], v[2], v[3]);
                break;
            case 'splot': {
                const s = requireNonNull(sprite);
                Pix8['plot'](Pix2D.pixels, s.pixels, s['palette'], v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
                break;
            }
            case 'salpha': {
                const s = requireNonNull(sprite);
                Pix8['plotAlpha'](Pix2D.pixels, s.pixels, s['palette'], v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
                break;
            }
            case 'sscale': {
                const s = requireNonNull(sprite);
                Pix8['plotScale'](Pix2D.pixels, s.pixels, s['palette'], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9]);
                break;
            }
            case 'stint': {
                const s = requireNonNull(sprite);
                Pix8['plotScaleTinted'](Pix2D.pixels, s.pixels, s['palette'], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10]);
                break;
            }
            default:
                throw new Error(`bad op ${f[0]}`);
        }
    } catch (e) {
        result = classify(e);
    }
    return `${index} ${f[0]} ${result} ${ints(Pix2D.pixels)} ${spriteState()}`;
}

// ---- script ----

const W = 40;
const H = 30;

type SpriteSpec = { cropW: number; cropH: number; xOff: number; yOff: number; w: number; h: number; pixLen: number; indexMax: number; palLen: number };

function generate(): string[] {
    const r = new Rng(0x1d872b41);
    const s: string[] = [];
    let seed = 1;
    const spr = (p: SpriteSpec) => s.push(`spr ${p.cropW} ${p.cropH} ${p.xOff} ${p.yOff} ${p.w} ${p.h} ${p.pixLen} ${seed++} ${p.indexMax} ${p.palLen} ${seed++}`);
    const sizes = [-5, -1, 0, 1, 2, 3, 5, 7, 12, 19, 20, 24, 33, 40, 57];
    const alphas = [MIN, -5, 0, 1, 64, 128, 255, 256, 300, MAX];
    const colours = [0, 0xffffff, 0x808080, 0xff0000, 0x00ff00, 0x0000ff, 0x123456, -1, MIN, 0x7f00ff80];

    const surfaces = [
        ['pix 1200 40 30 7', 'clip 0 0 40 30'],
        ['pix 1200 40 30 8', 'clip 5 4 33 25'],
        ['pix 1200 40 30 9', 'clip -3 -2 45 34'],
        ['pix 1000 40 30 10', 'clip 0 0 40 30'],
        ['pix -1 40 30 0', 'clip 0 0 40 30'],
        ['pix 1200 40 30 11', 'clip 20 15 20 15']
    ];
    const sprites: SpriteSpec[] = [
        { cropW: 20, cropH: 16, xOff: 3, yOff: 2, w: 12, h: 10, pixLen: 120, indexMax: 255, palLen: 256 },
        { cropW: 20, cropH: 16, xOff: 3, yOff: 2, w: 12, h: 10, pixLen: 120, indexMax: 9, palLen: 10 },
        { cropW: 20, cropH: 16, xOff: 3, yOff: 2, w: 12, h: 10, pixLen: 120, indexMax: 255, palLen: 10 },
        { cropW: 13, cropH: 9, xOff: 0, yOff: 0, w: 13, h: 9, pixLen: 117, indexMax: 255, palLen: 256 },
        { cropW: 17, cropH: 11, xOff: 4, yOff: 1, w: 9, h: 7, pixLen: 50, indexMax: 255, palLen: 256 },
        { cropW: 17, cropH: 11, xOff: 4, yOff: 1, w: 9, h: 7, pixLen: -1, indexMax: 255, palLen: 256 },
        { cropW: 17, cropH: 11, xOff: 4, yOff: 1, w: 9, h: 7, pixLen: 63, indexMax: 255, palLen: -1 },
        { cropW: 30, cropH: 25, xOff: 10, yOff: 8, w: 5, h: 6, pixLen: 30, indexMax: 255, palLen: 256 },
        { cropW: 5, cropH: 4, xOff: -2, yOff: -3, w: 9, h: 8, pixLen: 72, indexMax: 255, palLen: 256 },
        { cropW: 10, cropH: 10, xOff: 0, yOff: 0, w: 0, h: 0, pixLen: 0, indexMax: 255, palLen: 256 },
        { cropW: 10, cropH: 10, xOff: 1, yOff: 1, w: -3, h: 4, pixLen: 12, indexMax: 255, palLen: 256 },
        { cropW: 10, cropH: 10, xOff: 1, yOff: 1, w: 4, h: -3, pixLen: 12, indexMax: 255, palLen: 256 },
        { cropW: -4, cropH: 6, xOff: 0, yOff: 0, w: 3, h: 3, pixLen: 9, indexMax: 255, palLen: 256 },
        { cropW: 0, cropH: 0, xOff: 0, yOff: 0, w: 3, h: 3, pixLen: 9, indexMax: 255, palLen: 256 },
        { cropW: 21, cropH: 18, xOff: 2, yOff: 5, w: 16, h: 9, pixLen: 144, indexMax: 0, palLen: 1 }
    ];

    // Directed: every sprite on every surface, through every member.
    for (const surface of surfaces) {
        for (const p of sprites) {
            s.push(...surface);
            spr(p);
            for (const x of [-25, -13, -4, -3, 0, 1, 7, 19, 28, 31, 36, 39, 40, 55]) {
                for (const y of [-20, -11, -2, 0, 3, 14, 21, 25, 29, 30, 44]) {
                    s.push(`draw ${x} ${y}`);
                }
            }
            for (const [x, y] of [
                [MIN, 0],
                [MAX, 0],
                [0, MIN],
                [0, MAX],
                [MIN, MIN],
                [MAX, MAX],
                [MIN + 5, 3],
                [MAX - 5, 3]
            ]) {
                s.push(`draw ${x} ${y}`, `alpha ${x} ${y} 128`);
            }
            for (const a of alphas) {
                s.push(`alpha 5 4 ${a}`, `alpha -6 22 ${a}`, `alpha 31 -3 ${a}`);
            }
            for (const w of sizes) {
                for (const h of [-1, 0, 1, 6, 11, 23, 40]) {
                    s.push(`scale 4 3 ${w} ${h}`, `scale -9 21 ${w} ${h}`, `scale 30 -5 ${w} ${h}`);
                }
            }
            for (const c of colours) {
                s.push(`tint 2 2 14 12 ${c}`, `tint -7 -4 30 25 ${c}`, `tint 33 24 8 5 ${c}`, `tint 1 1 0 4 ${c}`);
            }
            s.push('trim', 'draw 3 4', 'scale 2 2 25 20', 'trim', 'alpha 10 10 100');
            s.push('rot', 'draw 3 4', 'rot', 'draw 3 4', 'rot', 'tint 3 4 18 18 16777215', 'rot', 'draw 3 4');
            for (const [rr, gg, bb] of [
                [0, 0, 0],
                [20, -20, 5],
                [300, -300, 0],
                [-255, 255, 128],
                [MIN, MAX, 1],
                [7, 7, 7]
            ]) {
                s.push(`rgb ${rr} ${gg} ${bb}`, 'draw 6 6');
            }
        }
    }

    // Inconsistent geometry.
    s.push(...surfaces[0]);
    spr(sprites[0]);
    s.push('geom 3 16 2 12 10 20', 'geom 3 16 2 13 10 20', 'draw 2 2', 'scale 1 1 30 30', 'trim');
    spr(sprites[0]);
    s.push('geom 3 16 2 12 11 20', 'rot', 'trim');
    spr(sprites[0]);
    s.push('geom 3 16 2 12 10 5', 'trim', 'geom 3 3 2 12 10 20', 'trim', 'rot');
    spr(sprites[0]);
    s.push('geom -100 16 -50 12 10 20', 'trim', 'draw 0 0');
    spr(sprites[0]);
    s.push('geom 0 -2 0 12 10 20', 'trim', 'scale 0 0 10 10');

    // Seeded random cases.
    const randomSprite = (): SpriteSpec => {
        const w = r.chance(20) ? r.int(-4, 0) : r.int(1, 24);
        const h = r.chance(20) ? r.int(-4, 0) : r.int(1, 24);
        const cropW = r.chance(15) ? r.int(-4, 0) : Math.max(w, 0) + r.int(r.chance(5) ? -6 : 0, 12);
        const cropH = r.chance(15) ? r.int(-4, 0) : Math.max(h, 0) + r.int(r.chance(5) ? -6 : 0, 12);
        const area = Math.max(w, 0) * Math.max(h, 0);
        const pixLen = r.chance(30) ? -1 : r.chance(8) ? r.int(0, area + 3) : area;
        const indexMax = r.chance(4) ? r.int(0, 15) : 255;
        const palLen = r.chance(30) ? -1 : r.chance(5) ? r.int(0, 20) : r.chance(3) ? indexMax + 1 : 256;
        return { cropW, cropH, xOff: r.int(-3, Math.max(cropW - w, 0) + 2), yOff: r.int(-3, Math.max(cropH - h, 0) + 2), w, h, pixLen, indexMax, palLen };
    };
    const coord = (lo: number, hi: number) => (r.chance(60) ? r.pick([MIN, MAX, MIN + r.int(0, 50), MAX - r.int(0, 50)]) : r.int(lo, hi));

    s.push(...surfaces[0]);
    spr(randomSprite());
    for (let i = 0; i < RANDOM_CASES; i++) {
        const k = r.int(0, 99);
        if (k < 1) {
            const len = r.chance(15) ? -1 : r.chance(5) ? r.int(0, W * H) : W * H;
            s.push(`pix ${len} ${W} ${H} ${r.int(0, 1000)}`);
        } else if (k < 4) {
            const left = r.int(-4, 25);
            const top = r.int(-4, 20);
            s.push(`clip ${left} ${top} ${r.chance(6) ? r.int(left - 3, W + 5) : r.int(left, W)} ${r.chance(6) ? r.int(top - 3, H + 5) : r.int(top, H)}`);
        } else if (k < 10) {
            spr(randomSprite());
        } else if (k < 11) {
            s.push(`geom ${r.int(-6, 12)} ${r.int(-3, 30)} ${r.int(-6, 12)} ${r.int(-3, 24)} ${r.int(-3, 24)} ${r.int(-3, 30)}`);
        } else if (k < 30) {
            s.push(`draw ${coord(-30, 70)} ${coord(-30, 60)}`);
        } else if (k < 45) {
            s.push(`alpha ${coord(-30, 70)} ${coord(-30, 60)} ${r.chance(10) ? r.pick(alphas) : r.int(0, 256)}`);
        } else if (k < 60) {
            s.push(`scale ${r.int(-40, 70)} ${r.int(-40, 60)} ${r.int(-5, 60)} ${r.int(-5, 60)}`);
        } else if (k < 72) {
            s.push(`tint ${r.int(-40, 70)} ${r.int(-40, 60)} ${r.int(-5, 60)} ${r.int(-5, 60)} ${r.chance(5) ? r.pick(colours) : r.int(0, 0xffffff)}`);
        } else if (k < 76) {
            s.push('trim');
        } else if (k < 80) {
            s.push('rot');
        } else if (k < 84) {
            s.push(`rgb ${r.int(-300, 300)} ${r.int(-300, 300)} ${r.int(-300, 300)}`);
        } else if (k < 88) {
            s.push(`splot ${r.int(MIN, MAX)} ${r.int(-2, 600)} ${r.int(-2, W * H + 2)} ${r.int(-2, 20)} ${r.int(-2, 20)} ${r.int(-5, 40)} ${r.int(-5, 40)}`);
        } else if (k < 92) {
            s.push(`salpha ${r.int(-2, 600)} ${r.int(-2, W * H + 2)} ${r.int(-2, 20)} ${r.int(-2, 20)} ${r.int(-5, 40)} ${r.int(-5, 40)} ${r.pick(alphas)}`);
        } else if (k < 96) {
            s.push(`sscale ${r.int(-70000, 900000)} ${r.int(-70000, 900000)} ${r.int(-2, W * H + 2)} ${r.int(-5, 40)} ${r.int(-2, 20)} ${r.int(-2, 20)} ${r.int(-70000, 200000)} ${r.int(-70000, 200000)} ${r.int(-3, 30)}`);
        } else {
            s.push(`stint ${r.int(-70000, 900000)} ${r.int(-70000, 900000)} ${r.int(-2, W * H + 2)} ${r.int(-5, 40)} ${r.int(-2, 20)} ${r.int(-2, 20)} ${r.int(-70000, 200000)} ${r.int(-70000, 200000)} ${r.int(-3, 30)} ${r.pick(colours)}`);
        }
    }

    return s;
}

test('si/ch indexed sprites match client.jar', () => {
    const script = generate();
    // Start Pix2D from td.<clinit> like the fresh JVM, and restore the incoming state afterwards.
    const ours = withClinitStatics([PIX2D()], () => script.map((line, i) => execute(i, line)));
    const theirs = runOracle(script.join('\n') + '\n');

    expect(theirs.length).toBe(ours.length);
    for (let i = 0; i < ours.length; i++) {
        if (ours[i] !== theirs[i]) {
            throw new Error(`mismatch at op ${i} "${script[i]}"\n  ts:   ${ours[i]}\n  java: ${theirs[i]}`);
        }
    }

    // The script reaches every outcome.
    const results = new Set(ours.map(line => line.split(' ')[2]));
    expect([...results].sort()).toEqual(['aioobe', 'arith', 'neg', 'npe', 'ok']);
}, 300000);
