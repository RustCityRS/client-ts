import { expect, test } from 'bun:test';
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
import { gamepackPath } from '../reference.js';

// The scene-graph entity classes against client.jar: kb (Ground), ra (Square), ma (QuickGround) and the no-argument
// entities ec/hk/nf/pk/mh/jg. A seeded script runs through test/review/entities/EntitiesOracle.java (reflection on
// the real classes) and through the TS port; every result line must match exactly. Each line lists all instance fields
// the Java class declares, by obfuscated name, so the test also pins the obfuscated-to-TS field mapping below and
// checks that each TS class has exactly the Java field set (no missing or invented fields).
//
// Coverage: every one of the 13 kb shapes at every rotation, rotations outside 0..3 (negative and large), textured and
// untextured tiles, flat and sloped corners, int-overflowing tile coordinates (imul by 128 plus the 64/32/96 offsets)
// and corner heights/colours (the >> 1 midpoints), the AIOOBE of an unknown shape (13, -1), ra and ma constructor
// stores, no-argument defaults (including the lconst_0 typecodes), and kb.a()V (unload) followed by the NPE it causes.

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
        U: 'sidesAfterCorner'
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

const NO_ARG: Record<string, () => object> = {
    ec: () => new Sprite(),
    hk: () => new Wall(),
    nf: () => new Decor(),
    pk: () => new GroundDecor(),
    mh: () => new GroundObject(),
    jg: () => new Occlude()
};

function value(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (v instanceof Int32Array) return `[${Array.from(v).join(',')}]`;
    if (Array.isArray(v)) return `[${v.map(e => (e instanceof Int32Array ? value(e) : e === null ? 'null' : 'obj')).join(',')}]`;
    if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') return String(v);
    return 'obj';
}

function fields(cls: string, o: object): string {
    const map = FIELDS[cls];
    const record = o as Record<string, unknown>;
    return Object.keys(map)
        .sort()
        .map(name => `${name}=${value(record[map[name]])}`)
        .join(' ');
}

function groundStatics(): string {
    const g = Ground as unknown as Record<string, unknown>;
    const names: Record<string, string> = {
        f: 'drawVertexY',
        i: 'shapeFaces',
        q: 'drawTextureVertexY',
        r: 'drawTextureVertexZ',
        t: 'shapePoints',
        u: 'drawTextureVertexX',
        v: 'drawVertexX'
    };
    return Object.keys(names)
        .map(name => `${name}=${value(g[names[name]])}`)
        .join(' ');
}

function run(body: () => string): string {
    try {
        return body();
    } catch (e) {
        if (e instanceof RangeError && e.message.startsWith('array index')) return 'aioobe';
        if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) return 'npe';
        return `error:${String(e)}`;
    }
}

// mulberry32
function rng(seed: number): () => number {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return (t ^ (t >>> 14)) | 0;
    };
}

function generateScript(): string[] {
    const next = rng(530);
    const below = (n: number): number => (next() >>> 0) % n;
    const ops: string[] = [];

    const height = (): number => (below(8) === 0 ? next() : -below(2400));
    const colour = (): number => {
        const r = below(10);
        return r === 0 ? next() : r === 1 ? 12345678 : below(65536);
    };
    const coord = (): number => (below(10) === 0 ? next() : below(104));

    const kb = (shape: number, rotation: number): void => {
        const texture = below(2) === 0 ? -1 : below(5) === 0 ? next() : below(100);
        const h0 = height();
        const flat = below(4) === 0;
        const hs = flat ? [h0, h0, h0, h0] : [h0, height(), height(), height()];
        if (!flat && below(6) === 0) hs[below(3) + 1] = h0;
        const args = [shape, rotation, texture, coord(), coord(), ...hs];
        for (let i = 0; i < 8; i++) args.push(colour());
        args.push(next(), next());
        ops.push(`kb ${args.join(' ')}`);
    };

    for (let shape = 0; shape < 13; shape++) {
        for (let rotation = 0; rotation < 4; rotation++) {
            for (let n = 0; n < 6; n++) kb(shape, rotation);
        }
    }
    for (let n = 0; n < 1500; n++) {
        const shape = below(20) === 0 ? [13, -1, 14, 100, -2147483648][below(5)] : below(13);
        const rotation = below(8) === 0 ? next() : below(10) === 0 ? -below(9) : below(4);
        kb(shape, rotation);
    }

    for (let n = 0; n < 60; n++) {
        ops.push(`ra ${below(4) === 0 ? next() : below(4)} ${coord()} ${coord()}`);
        ops.push(`ma ${colour()} ${colour()} ${colour()} ${colour()} ${below(2) === 0 ? -1 : next()} ${next()} ${below(2)}`);
    }
    for (const cls of Object.keys(NO_ARG)) ops.push(`new ${cls}`);

    ops.push('statics', 'unload');
    kb(3, 1);
    ops.push('statics');
    return ops;
}

function runOracle(script: string[]): string[] {
    const source = fileURLToPath(new URL('./entities/EntitiesOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], {
        stdin: Buffer.from(script.join('\n') + '\n'),
        timeout: 170000
    });
    if (java.exitCode !== 0) throw new Error(`EntitiesOracle exited ${java.exitCode}: ${java.stderr.toString()}`);
    const lines = java.stdout.toString().split(/\r?\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
}

function runTs(op: string): string {
    const p = op.split(' ');
    const n = (i: number): number => Number.parseInt(p[i], 10);
    switch (p[0]) {
        case 'kb':
            return run(() => fields('kb', new Ground(n(1), n(2), n(3), n(4), n(5), n(6), n(7), n(8), n(9), n(10), n(11), n(12), n(13), n(14), n(15), n(16), n(17), n(18), n(19))));
        case 'ra':
            return run(() => fields('ra', new Square(n(1), n(2), n(3))));
        case 'ma':
            return run(() => fields('ma', new QuickGround(n(1), n(2), n(3), n(4), n(5), n(6), p[7] === '1')));
        case 'new':
            return run(() => fields(p[1], NO_ARG[p[1]]()));
        case 'unload':
            Ground.unload();
            return groundStatics();
        case 'statics':
            return groundStatics();
        default:
            return 'error:unknown op';
    }
}

test('each TS entity class declares exactly the instance fields of its Java class', () => {
    const linkable = new Set(['next', 'key', 'prev']);
    const instances: Record<string, object> = {
        kb: new Ground(3, 0, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        ra: new Square(0, 0, 0),
        ma: new QuickGround(0, 0, 0, 0, 0, 0, false),
        ...Object.fromEntries(Object.entries(NO_ARG).map(([cls, make]) => [cls, make()]))
    };
    for (const [cls, o] of Object.entries(instances)) {
        const own = Object.keys(o)
            .filter(k => !linkable.has(k))
            .sort();
        expect({ cls, fields: own }).toEqual({ cls, fields: Object.values(FIELDS[cls]).sort() });
    }
});

test('Ground, Square, QuickGround and the no-argument entities match kb/ra/ma/ec/hk/nf/pk/mh/jg in client.jar', () => {
    const script = generateScript();
    const want = runOracle(script);
    expect(want.length).toBe(script.length);
    const got = script.map(runTs);
    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 10; i++) {
        if (got[i] !== want[i]) mismatches.push(`#${i} ${script[i]}\n  java: ${want[i]}\n  ts:   ${got[i]}`);
    }
    expect(mismatches).toEqual([]);
    // The script must actually reach the interesting outcomes.
    expect(want.filter(l => l === 'aioobe').length).toBeGreaterThan(10);
    expect(want.filter(l => l === 'npe').length).toBe(1);
    expect(want.some(l => l.includes(' k=null '))).toBe(true);
    expect(want.some(l => l.includes(' h=true '))).toBe(true);
}, 180000);
