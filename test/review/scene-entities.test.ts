import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Decor from '../../src/dash3d/Decor.js';
import Ground from '../../src/dash3d/Ground.js';
import GroundDecor from '../../src/dash3d/GroundDecor.js';
import GroundObject from '../../src/dash3d/GroundObject.js';
import Occlude from '../../src/dash3d/Occlude.js';
import QuickGround from '../../src/dash3d/QuickGround.js';
import Sprite from '../../src/dash3d/Sprite.js';
import Square from '../../src/dash3d/Square.js';
import Wall from '../../src/dash3d/Wall.js';
import { arrayPut } from '../../src/util/JavaArray.js';
import { gamepackPath } from '../reference.js';
import { withClinitStatics } from './staticState.js';

// The scene-graph entity classes against client.jar: kb (Ground), ra (Square), ma (QuickGround) and the no-argument
// entities ec/hk/nf/pk/mh/jg (Sprite/Wall/Decor/GroundDecor/GroundObject/Occlude), kb's statics f/i/q/r/t/u/v and
// kb.a()V (Ground.unload).
//
// A seeded script runs through scene-entities/SceneEntitiesOracle.java (compiled next to client.jar, so it calls the
// real constructors directly) and through the TS port; every result line must match exactly. A constructed instance
// prints every instance field the Java class declares (by obfuscated name, inherited jf fields of ra included), with
// its Java type tag (I/J/Z/[I/[L) and arrays element-wise, so a TS field of the wrong JS type (a number for a long, a
// float, -0, a plain array for an int[]) or a missing field fails the line. Every kb line also prints all kb statics
// element-wise with array identities, so a constructor that wrote to, replaced or aliased a shared table would fail.
//
// Coverage: all 13 shapes x 4 rotations with untextured, texture 0 and valid textures and distinct per-corner heights
// and colours (every vertex and face mapping is visible); every shape flat and with edge HSL colours (hue 0/63,
// saturation 0/7, lightness 0/1/126/127, 65535, 65536, the 12345678 hidden marker, -1, -2, int min/max); rotations
// outside 0..3 (4..7, negative, int min/max); shapes 13/14/-1/100/int min/max (the AIOOBE); tile coordinates where
// x * 128 and the 32/64/96 offsets overflow; heights and colours whose >> 1 midpoints overflow; each corner alone
// breaking flatness; ra with levels 0..3 and edges; ma with flat/textured/hidden tiles; the no-argument defaults
// (lconst_0 typecodes); writes into the static draw arrays (in range, out of range); kb.a()V and the NPEs after it.

const MIN = -2147483648;
const MAX = 2147483647;
const RANDOM_KB = 3000;
const RANDOM_RA = 300;
const RANDOM_MA = 300;

const FIELDS: Record<string, Record<string, string>> = {
    kb: {
        a: 'rotation',
        b: 'faceVertexB',
        c: 'vertexY',
        d: 'vertexX',
        e: 'faceColourA',
        g: 'faceColourB',
        h: 'flat',
        j: 'faceVertexC',
        k: 'faceTexture',
        l: 'minimapOverlay',
        m: 'shape',
        n: 'minimapUnderlay',
        o: 'faceVertexA',
        p: 'faceColourC',
        s: 'vertexZ'
    },
    ra: {
        t: 'spriteCount',
        u: 'groundDecor',
        v: 'z',
        w: 'x',
        x: 'ground',
        y: 'groundObject',
        z: 'wall',
        A: 'spriteSpan',
        B: 'drawFront',
        C: 'decor',
        D: 'cornerSides',
        E: 'drawSprites',
        F: 'quickGround',
        G: 'backWallTypes',
        H: 'sprites',
        I: 'sidesBeforeCorner',
        J: 'drawBack',
        K: 'level',
        L: 'linkedSquare',
        N: 'originalLevel',
        P: 'spriteSpans',
        U: 'sidesAfterCorner',
        'jf.g': 'next',
        'jf.k': 'key',
        'jf.p': 'prev'
    },
    ma: { c: 'colourSE', d: 'flat', f: 'colourSW', h: 'colourNW', i: 'colourNE', l: 'texture', m: 'minimapRgb' },
    ec: {
        a: 'minTileX',
        c: 'x',
        f: 'yaw',
        l: 'distance',
        m: 'minTileZ',
        n: 'maxTileX',
        r: 'cycle',
        s: 'z',
        t: 'y',
        u: 'typecode',
        w: 'level',
        y: 'maxTileZ',
        z: 'model'
    },
    hk: { c: 'model2', f: 'typecode', h: 'x', i: 'model1', j: 'angle2', k: 'angle1', l: 'y', m: 'z' },
    nf: { a: 'typecode', b: 'z', d: 'x', e: 'y', g: 'angle', h: 'offsetX', i: 'model', k: 'model2', l: 'offsetZ', m: 'wshape' },
    pk: { a: 'z', d: 'model', e: 'typecode', g: 'x', l: 'y' },
    mh: { a: 'z', b: 'middleObj', d: 'height', e: 'typecode', f: 'bottomObj', i: 'y', k: 'topObj', l: 'x' },
    jg: {
        a: 'minY',
        b: 'maxDeltaY',
        c: 'minX',
        d: 'type',
        e: 'minDeltaZ',
        f: 'minDeltaY',
        g: 'maxX',
        h: 'maxTileX',
        i: 'minZ',
        j: 'minDeltaX',
        m: 'minTileX',
        n: 'maxTileZ',
        o: 'maxZ',
        r: 'mode',
        s: 'maxDeltaZ',
        u: 'maxY',
        y: 'maxDeltaX',
        A: 'minTileZ'
    }
};

const CLASSES: Record<string, new (...args: never[]) => object> = {
    kb: Ground,
    ra: Square,
    ma: QuickGround,
    ec: Sprite,
    hk: Wall,
    nf: Decor,
    pk: GroundDecor,
    mh: GroundObject,
    jg: Occlude
};

const NO_ARG: Record<string, () => object> = {
    ec: () => new Sprite(),
    hk: () => new Wall(),
    nf: () => new Decor(),
    pk: () => new GroundDecor(),
    mh: () => new GroundObject(),
    jg: () => new Occlude()
};

// kb.<clinit>, in its store order. The first script line prints the jar's tables, so a mistake here fails that line.
function groundClinit(): Record<string, unknown> {
    return {
        drawVertexY: new Int32Array(6),
        shapeFaces: [
            Int32Array.of(0, 1, 2, 3, 0, 0, 1, 3),
            Int32Array.of(1, 1, 2, 3, 1, 0, 1, 3),
            Int32Array.of(0, 1, 2, 3, 1, 0, 1, 3),
            Int32Array.of(0, 0, 1, 2, 0, 0, 2, 4, 1, 0, 4, 3),
            Int32Array.of(0, 0, 1, 4, 0, 0, 4, 3, 1, 1, 2, 4),
            Int32Array.of(0, 0, 4, 3, 1, 0, 1, 2, 1, 0, 2, 4),
            Int32Array.of(0, 1, 2, 4, 1, 0, 1, 4, 1, 0, 4, 3),
            Int32Array.of(0, 4, 1, 2, 0, 4, 2, 5, 1, 0, 4, 5, 1, 0, 5, 3),
            Int32Array.of(0, 4, 1, 2, 0, 4, 2, 3, 0, 4, 3, 5, 1, 0, 4, 5),
            Int32Array.of(0, 0, 4, 5, 1, 4, 1, 2, 1, 4, 2, 3, 1, 4, 3, 5),
            Int32Array.of(0, 0, 1, 5, 0, 1, 4, 5, 0, 1, 2, 4, 1, 0, 5, 3, 1, 5, 4, 3, 1, 4, 2, 3),
            Int32Array.of(1, 0, 1, 5, 1, 1, 4, 5, 1, 1, 2, 4, 0, 0, 5, 3, 0, 5, 4, 3, 0, 4, 2, 3),
            Int32Array.of(1, 0, 5, 4, 1, 0, 1, 5, 0, 0, 4, 3, 0, 4, 5, 3, 0, 5, 2, 3, 0, 1, 2, 5)
        ],
        drawTextureVertexY: new Int32Array(6),
        shapePoints: [
            Int32Array.of(1, 3, 5, 7),
            Int32Array.of(1, 3, 5, 7),
            Int32Array.of(1, 3, 5, 7),
            Int32Array.of(1, 3, 5, 7, 6),
            Int32Array.of(1, 3, 5, 7, 6),
            Int32Array.of(1, 3, 5, 7, 6),
            Int32Array.of(1, 3, 5, 7, 6),
            Int32Array.of(1, 3, 5, 7, 2, 6),
            Int32Array.of(1, 3, 5, 7, 2, 8),
            Int32Array.of(1, 3, 5, 7, 2, 8),
            Int32Array.of(1, 3, 5, 7, 11, 12),
            Int32Array.of(1, 3, 5, 7, 11, 12),
            Int32Array.of(1, 3, 5, 7, 13, 14)
        ],
        drawTextureVertexZ: new Int32Array(6),
        drawTextureVertexX: new Int32Array(6),
        drawVertexX: new Int32Array(6)
    };
}

// The kb statics the poke op writes, by obfuscated name.
const DRAW_ARRAYS: Record<string, string> = { f: 'drawVertexY', q: 'drawTextureVertexY', r: 'drawTextureVertexZ', u: 'drawTextureVertexX', v: 'drawVertexX' };

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

    below(n: number): number {
        return Math.floor((this.next() / 4294967296) * n);
    }

    i32(): number {
        return this.next() | 0;
    }

    chance(p: number): boolean {
        return this.next() / 4294967296 < p;
    }

    pick<T>(values: readonly T[]): T {
        return values[this.below(values.length)];
    }
}

const hsl = (h: number, s: number, l: number): number => (h << 10) | (s << 7) | l;
const EDGE_HSL: number[] = [];
for (const h of [0, 63]) for (const s of [0, 7]) for (const l of [0, 1, 126, 127]) EDGE_HSL.push(hsl(h, s, l));
EDGE_HSL.push(65535, 65536, 12345678, -1, -2, MIN, MAX, 0x8000, 0x7fff);
const EDGE_ROTATIONS = [4, 5, 6, 7, 8, -1, -2, -3, -4, -5, MIN, MAX, MIN + 1, MAX - 1, 1 << 30, 0x7ffffffc];
const EDGE_SHAPES = [13, 14, -1, -2, 100, MIN, MAX];
const EDGE_COORDS = [0, 103, 104, -1, 16777215, 16777216, 16777217, -16777216, -16777217, 16777214, MAX, MIN];
const EDGE_HEIGHTS = [0, -1, 1, MIN, MAX, MIN + 1, MAX - 1, -2400, 1 << 30];
const EDGE_TEXTURES = [0, 1, -2, 32767, MAX, MIN];

interface KbArgs {
    shape: number;
    rotation: number;
    texture: number;
    x: number;
    z: number;
    heights: number[];
    under: number[];
    over: number[];
    mmUnder: number;
    mmOver: number;
}

function kbLine(a: KbArgs): string {
    return ['kb', a.shape, a.rotation, a.texture, a.x, a.z, ...a.heights, ...a.under, ...a.over, a.mmUnder, a.mmOver].join(' ');
}

function generateScript(): string[] {
    const rng = new Rng(0x5ce7e530);
    const ops: string[] = ['statics'];

    const colour = (): number => {
        const r = rng.below(10);
        if (r < 5) return rng.below(65536);
        if (r < 7) return rng.pick(EDGE_HSL);
        if (r < 8) return 12345678;
        return rng.i32();
    };
    const coord = (): number => {
        const r = rng.below(10);
        return r < 8 ? rng.below(104) : r < 9 ? rng.pick(EDGE_COORDS) : rng.i32();
    };
    const height = (): number => {
        const r = rng.below(20);
        return r < 14 ? -rng.below(2400) : r < 17 ? rng.pick(EDGE_HEIGHTS) : rng.i32();
    };
    const texture = (): number => {
        const r = rng.below(10);
        return r < 4 ? -1 : r < 8 ? rng.below(256) : r < 9 ? rng.pick(EDGE_TEXTURES) : rng.i32();
    };
    const randomKb = (shape: number, rotation: number): KbArgs => {
        const base = height();
        const flat = rng.chance(0.25);
        const heights = [base, base, base, base];
        if (!flat) for (let i = 1; i < 4; i++) if (!rng.chance(0.3)) heights[i] = height();
        const under = [colour(), colour(), colour(), colour()];
        const over = [colour(), colour(), colour(), colour()];
        if (rng.chance(0.2)) under.fill(under[0]);
        if (rng.chance(0.2)) over.fill(over[0]);
        return { shape, rotation, texture: texture(), x: coord(), z: coord(), heights, under, over, mmUnder: rng.i32(), mmOver: rng.below(4) === 0 ? 0 : rng.i32() };
    };

    // 1. Every shape and rotation with distinct corner values, untextured, texture 0 and a valid texture.
    for (let shape = 0; shape < 13; shape++) {
        for (let rotation = 0; rotation < 4; rotation++) {
            for (const tex of [-1, 0, 7 + shape]) {
                ops.push(
                    kbLine({
                        shape,
                        rotation,
                        texture: tex,
                        x: 10 + shape,
                        z: 20 + rotation,
                        heights: [-100 - shape, -310 - rotation, -520, -730],
                        under: [hsl(5, 2, 10), hsl(10, 3, 40), hsl(20, 4, 70), hsl(30, 5, 100)],
                        over: [hsl(40, 1, 20), hsl(50, 6, 50), hsl(60, 7, 80), hsl(63, 0, 110)],
                        mmUnder: 0x112233 + shape,
                        mmOver: 0x445566 + rotation
                    })
                );
            }
        }
    }

    // 2. Every shape and rotation flat, with edge HSL colours.
    for (let shape = 0; shape < 13; shape++) {
        for (let rotation = 0; rotation < 4; rotation++) {
            const h = -rng.below(2000);
            ops.push(
                kbLine({
                    shape,
                    rotation,
                    texture: rng.chance(0.5) ? -1 : rng.below(100),
                    x: rng.below(104),
                    z: rng.below(104),
                    heights: [h, h, h, h],
                    under: [0, 1, 2, 3].map(() => rng.pick(EDGE_HSL)),
                    over: [0, 1, 2, 3].map(() => rng.pick(EDGE_HSL)),
                    mmUnder: rng.pick(EDGE_HSL),
                    mmOver: rng.pick(EDGE_HSL)
                })
            );
        }
    }

    // 3. Rotations outside 0..3.
    for (let shape = 0; shape < 13; shape++) for (const rotation of EDGE_ROTATIONS) ops.push(kbLine(randomKb(shape, rotation)));

    // 4. Unknown shapes (AIOOBE on kb.t), textured and untextured.
    for (const shape of EDGE_SHAPES) {
        for (const tex of [-1, 3]) {
            const a = randomKb(shape, rng.below(4));
            a.texture = tex;
            ops.push(kbLine(a));
        }
    }

    // 5. Tile coordinates whose * 128 or + 32/64/96/128 overflows, on the shapes with inner points.
    for (const shape of [7, 9, 10, 12]) {
        for (const x of EDGE_COORDS) {
            for (const z of [0, 16777215, 16777216, MAX, MIN]) {
                const a = randomKb(shape, rng.below(4));
                a.x = x;
                a.z = z;
                ops.push(kbLine(a));
            }
        }
    }

    // 6. Heights and colours whose (a + b) >> 1 midpoints overflow.
    const pairs = [
        [MAX, MAX],
        [MIN, MIN],
        [MAX, MIN],
        [MIN, MAX],
        [MAX, 1],
        [MIN, -1],
        [-1, -1],
        [1, 0],
        [-3, 0]
    ];
    for (const shape of [3, 7, 8, 9, 10, 11, 12]) {
        for (const [p, q] of pairs) {
            for (let rotation = 0; rotation < 4; rotation++) {
                ops.push(
                    kbLine({
                        shape,
                        rotation,
                        texture: rotation === 2 ? 5 : -1,
                        x: 1,
                        z: 2,
                        heights: [p, q, p, q],
                        under: [q, p, q, p],
                        over: [p, p, q, q],
                        mmUnder: p,
                        mmOver: q
                    })
                );
            }
        }
    }

    // 7. Flatness: each corner alone differs from var6, by 1 and by a wrap.
    for (let corner = 1; corner < 4; corner++) {
        for (const delta of [1, -1, 0x100000000, MIN]) {
            const heights = [-64, -64, -64, -64];
            heights[corner] = (heights[corner] + delta) | 0;
            const a = randomKb(rng.below(13), rng.below(4));
            a.heights = heights;
            ops.push(kbLine(a));
        }
    }

    // 8. ra and ma directed cases.
    for (let level = 0; level < 4; level++)
        for (const [x, z] of [
            [0, 0],
            [103, 103],
            [52, 7],
            [104, -1]
        ])
            ops.push(`ra ${level} ${x} ${z}`);
    for (const level of [-1, 4, MIN, MAX]) ops.push(`ra ${level} ${MAX} ${MIN}`);
    for (const c of EDGE_HSL) ops.push(`ma ${c} ${c} ${c} ${c} -1 ${c} 1`);
    for (const tex of [-1, 0, 1, 255, ...EDGE_TEXTURES]) ops.push(`ma ${colour()} ${colour()} ${colour()} ${colour()} ${tex} ${rng.i32()} ${rng.below(2)}`);
    ops.push('ma 12345678 12345678 12345678 12345678 -1 0 0', 'ma 0 0 0 0 -1 0 1', `ma ${MIN} ${MAX} ${MIN} ${MAX} ${MIN} ${MAX} 0`);
    for (const cls of Object.keys(NO_ARG)) ops.push(`new ${cls}`);

    // 9. Seeded random, interleaving the other constructors and writes into the draw arrays.
    for (let n = 0; n < RANDOM_KB; n++) {
        const shape = rng.chance(0.04) ? rng.pick(EDGE_SHAPES) : rng.below(13);
        const r = rng.below(10);
        const rotation = r < 7 ? rng.below(4) : r < 8 ? rng.pick(EDGE_ROTATIONS) : r < 9 ? -rng.below(9) : rng.i32();
        ops.push(kbLine(randomKb(shape, rotation)));
        if (n % 10 === 0) {
            const level = rng.chance(0.8) ? rng.below(4) : rng.pick([-1, 4, MIN, MAX, rng.i32()]);
            ops.push(`ra ${level} ${coord()} ${coord()}`);
        }
        if (n % 10 === 5) ops.push(`ma ${colour()} ${colour()} ${colour()} ${colour()} ${texture()} ${rng.chance(0.5) ? rng.below(0x1000000) : rng.i32()} ${rng.below(2)}`);
        if (n % 150 === 7) ops.push(`new ${rng.pick(Object.keys(NO_ARG))}`);
        if (n % 40 === 13) ops.push(`poke ${rng.pick(Object.keys(DRAW_ARRAYS))} ${rng.chance(0.9) ? rng.below(6) : rng.pick([6, 7, -1, MIN, MAX])} ${rng.i32()}`);
    }
    for (let n = 0; n < RANDOM_RA; n++) ops.push(`ra ${rng.chance(0.7) ? rng.below(4) : rng.i32()} ${coord()} ${coord()}`);
    for (let n = 0; n < RANDOM_MA; n++) ops.push(`ma ${colour()} ${colour()} ${colour()} ${colour()} ${texture()} ${rng.i32()} ${rng.below(2)}`);

    // 10. Unload: kb.a()V nulls every static; construction and pokes then NPE, the other classes are unaffected.
    ops.push('statics', 'unload', 'statics');
    ops.push(kbLine(randomKb(3, 1)), kbLine(randomKb(0, 0)), kbLine(randomKb(13, 0)));
    ops.push('poke f 0 1', 'poke v 9 1', 'ra 1 2 3', 'ma 1 2 3 4 5 6 1', 'new ec', 'unload', 'statics');
    return ops;
}

function runOracle(script: string[]): string[] {
    const source = fileURLToPath(new URL('./scene-entities/SceneEntitiesOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'scene-entities-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'SceneEntitiesOracle'], {
            input: script.join('\n') + '\n',
            timeout: 170000,
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

// ---- TS side: the same output format as the oracle ----

const OBF_NAME = new Map<unknown, string>(Object.entries(CLASSES).map(([obf, cls]) => [cls, obf]));

function className(o: object): string {
    return OBF_NAME.get(o.constructor) ?? `?${o.constructor.name}`;
}

function ints(a: Int32Array): string {
    return `[${Array.from(a).join(',')}]`;
}

function value(v: unknown): string {
    if (v === null) return 'null';
    if (typeof v === 'number') return Number.isInteger(v) && (v | 0) === v && !Object.is(v, -0) ? `I:${v}` : `I?:${v}`;
    if (typeof v === 'bigint') return BigInt.asIntN(64, v) === v ? `J:${v}` : `J?:${v}`;
    if (typeof v === 'boolean') return `Z:${v}`;
    if (v instanceof Int32Array) return `[I:${ints(v)}`;
    if (Array.isArray(v)) return `[L:[${v.map(e => (e === null ? 'null' : typeof e === 'object' ? className(e) : `?${String(e)}`)).join(',')}]`;
    if (typeof v === 'object') return className(v);
    return `?${String(v)}`;
}

function fields(cls: string, o: object): string {
    const map = FIELDS[cls];
    const record = o as Record<string, unknown>;
    const keys = Object.keys(map);
    const own = keys.filter(k => !k.includes('.')).sort();
    const inherited = keys.filter(k => k.includes('.')).sort();
    return [...own, ...inherited].map(k => `${k}=${value(record[map[k]])}`).join(' ');
}

class StaticPrinter {
    private readonly ids = new Map<object, number>();

    private id(o: object): number {
        let id = this.ids.get(o);
        if (id === undefined) {
            id = this.ids.size;
            this.ids.set(o, id);
        }
        return id;
    }

    private table(name: string, a: unknown): string {
        if (a === null) return `${name}=null`;
        if (!(a instanceof Int32Array)) return `${name}=?${String(a)}`;
        return `${name}=#${this.id(a)}${value(a)}`;
    }

    private table2(name: string, a: unknown): string {
        if (a === null) return `${name}=null`;
        if (!Array.isArray(a)) return `${name}=?${String(a)}`;
        const outer = this.id(a);
        const inner = a.map((e: unknown) => (e === null ? 'null' : e instanceof Int32Array ? `#${this.id(e)}${ints(e)}` : `?${String(e)}`));
        return `${name}=#${outer}[${inner.join(',')}]`;
    }

    print(): string {
        const g = Ground as unknown as Record<string, unknown>;
        return [
            this.table('f', g.drawVertexY),
            this.table2('i', g.shapeFaces),
            this.table('q', g.drawTextureVertexY),
            this.table('r', g.drawTextureVertexZ),
            this.table2('t', g.shapePoints),
            this.table('u', g.drawTextureVertexX),
            this.table('v', g.drawVertexX)
        ].join(' ');
    }
}

function error(e: unknown): string {
    if (e instanceof RangeError) {
        if (e.message.startsWith('array index')) return 'aioobe';
        if (e.message === '/ by zero') return 'arith';
        if (e.message.startsWith('Invalid typed array length') || e.message.startsWith('length cannot be negative') || e.message.startsWith('Requested length is negative')) return 'nase';
    }
    if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) return 'npe';
    throw e;
}

function attempt(body: () => string): string {
    try {
        return body();
    } catch (e) {
        return error(e);
    }
}

function runTs(script: string[]): string[] {
    const statics = new StaticPrinter();
    return script.map(line => {
        const p = line.split(' ');
        const n = (i: number): number => {
            const v = Number.parseInt(p[i], 10);
            if ((v | 0) !== v) throw new Error(`bad int ${p[i]} in ${line}`);
            return v;
        };
        switch (p[0]) {
            case 'kb': {
                const r = attempt(() => fields('kb', new Ground(n(1), n(2), n(3), n(4), n(5), n(6), n(7), n(8), n(9), n(10), n(11), n(12), n(13), n(14), n(15), n(16), n(17), n(18), n(19))));
                return `${r} | ${statics.print()}`;
            }
            case 'ra':
                return attempt(() => fields('ra', new Square(n(1), n(2), n(3))));
            case 'ma':
                return attempt(() => fields('ma', new QuickGround(n(1), n(2), n(3), n(4), n(5), n(6), p[7] === '1')));
            case 'new':
                return attempt(() => fields(p[1], NO_ARG[p[1]]()));
            case 'poke': {
                const r = attempt(() => {
                    const g = Ground as unknown as Record<string, Int32Array | null>;
                    arrayPut(g[DRAW_ARRAYS[p[1]]], n(2), n(3));
                    return 'ok';
                });
                return `${r} | ${statics.print()}`;
            }
            case 'unload': {
                const r = attempt(() => {
                    Ground.unload();
                    return 'ok';
                });
                return `${r} | ${statics.print()}`;
            }
            case 'statics':
                return statics.print();
            default:
                throw new Error(`unknown op ${line}`);
        }
    });
}

// The first differing token of two result lines, for a readable failure.
function firstDifference(got: string, want: string): string {
    const g = got.split(' ');
    const w = want.split(' ');
    for (let i = 0; i < Math.max(g.length, w.length); i++) {
        if (g[i] !== w[i]) return `token ${i}: java ${w[i] ?? '<none>'} / ts ${g[i] ?? '<none>'}`;
    }
    return 'identical';
}

test('each TS entity class declares exactly the instance fields of its Java class, and Ground exactly the kb statics', () => {
    const instances: Record<string, object> = withClinitStatics([{ target: Ground, clinit: groundClinit() }], () => ({
        kb: new Ground(3, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ra: new Square(0, 0, 0),
        ma: new QuickGround(0, 0, 0, 0, 0, 0, false),
        ...Object.fromEntries(Object.entries(NO_ARG).map(([cls, make]) => [cls, make()]))
    }));
    for (const [cls, o] of Object.entries(instances)) {
        expect({ cls, fields: Object.keys(o).sort() }).toEqual({ cls, fields: Object.values(FIELDS[cls]).sort() });
    }
    // Static data members (Ground.unload is the only static method; nf.a and pk.c are unload artifacts).
    const staticFields = (cls: object): string[] =>
        Object.getOwnPropertyNames(cls)
            .filter(k => !['length', 'name', 'prototype'].includes(k) && typeof (cls as Record<string, unknown>)[k] !== 'function')
            .sort();
    for (const [obf, cls] of Object.entries(CLASSES)) {
        expect({ obf, statics: staticFields(cls) }).toEqual({ obf, statics: obf === 'kb' ? Object.keys(groundClinit()).sort() : [] });
    }
});

test('Ground, Square, QuickGround and the no-argument entities match kb/ra/ma/ec/hk/nf/pk/mh/jg in client.jar', () => {
    const script = generateScript();
    const want = runOracle(script);
    expect(want.length).toBe(script.length);

    const got = withClinitStatics([{ target: Ground, clinit: groundClinit() }], () => runTs(script));

    const mismatches: string[] = [];
    for (let i = 0; i < script.length; i++) {
        if (got[i] !== want[i]) {
            if (mismatches.length < 8) mismatches.push(`#${i} ${script[i]}\n  ${firstDifference(got[i], want[i])}`);
            else {
                mismatches.push('...');
                break;
            }
        }
    }
    expect(mismatches).toEqual([]);
    const count = (op: string): number => script.filter(s => s.startsWith(op + ' ') || s === op).length;
    console.log(`scene-entities: ${script.length} operations (kb ${count('kb')}, ra ${count('ra')}, ma ${count('ma')}, new ${count('new')}, poke ${count('poke')}, unload ${count('unload')}, statics ${count('statics')})`);

    // The script reaches the outcomes it was written for.
    const kbLines = want.filter((_, i) => script[i].startsWith('kb '));
    expect(kbLines.length).toBeGreaterThan(RANDOM_KB);
    expect(kbLines.filter(l => l.startsWith('aioobe ')).length).toBeGreaterThan(50);
    expect(kbLines.filter(l => l.startsWith('npe ')).length).toBe(3);
    expect(kbLines.some(l => l.includes(' h=Z:true ') && l.includes(' k=[I:'))).toBe(true);
    expect(kbLines.some(l => l.includes(' h=Z:false ') && l.includes(' k=null '))).toBe(true);
    expect(want.filter((l, i) => script[i].startsWith('poke ') && l.startsWith('aioobe ')).length).toBeGreaterThan(0);
    expect(want.filter((l, i) => script[i].startsWith('poke ') && l.startsWith('ok ')).length).toBeGreaterThan(30);
    // The shared tables are never replaced: every kb line before the unload reports the same 33 array identities.
    const identities = new Set(kbLines.filter(l => !l.includes('f=null')).map(l => (l.slice(l.indexOf(' | ')).match(/#\d+/g) ?? []).join(',')));
    expect([...identities]).toEqual([Array.from({ length: 33 }, (_, i) => `#${i}`).join(',')]);
    // Every shape (0..12) at every rotation 0..3 was constructed.
    const seen = new Set(script.filter((s, i) => s.startsWith('kb ') && !want[i].startsWith('aioobe') && !want[i].startsWith('npe')).map(s => s.split(' ').slice(1, 3).join(',')));
    for (let shape = 0; shape < 13; shape++) for (let rotation = 0; rotation < 4; rotation++) expect(seen.has(`${shape},${rotation}`)).toBe(true);
}, 180000);
