import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import AnimBase from '../../src/dash3d/AnimBase.js';
import AnimFrame from '../../src/dash3d/AnimFrame.js';
import AnimFrameSet from '../../src/dash3d/AnimFrameSet.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import { localAssets, readGroup } from '../cachefile.js';
import { withClinitStatics, type StaticReset } from './staticState.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import { cachePath, gamepackPath } from '../reference.js';

// The animation classes against client.jar: hf (AnimFrameSet), of (AnimFrame), ok (AnimBase) and the statics the member
// map places on them. test/review/anim/AnimOracle.java gets the same input stream and prints one line per step.
//
// 1. Every group of the frames archive (archive 0, bases from archive 1) of the 530 cache goes through gb.a / get twice
//    (load, then the cache hit) and through bh.a / Load with the boolean set (bases read as group 0, file = base id).
//    Each set is hashed over every frame field, both flag getters, and each distinct base the first time a frame uses
//    it; later frames mix the index of the first frame with the same base object, which pins the base dedupe. Two
//    group ids outside the archive check the null file list.
// 2. Seeded edge cases construct ok and of directly: random bases and frames over the transform types 0..9, smart
//    boundaries (one/two-byte, -16384..16383) through the type-2 rotation repack, trailing and missing bytes
//    (RuntimeException / AIOOBE), a frame count above the base size, null and missing bases, null and short frame
//    bytes, truncated bases, 255 used transforms. Each line has the full field dump of both objects or the exception.
// 3. of.a() (AnimFrame.unload) runs, then a frame with a used transform must NPE and one without must still decode.

const FIELDS: Record<string, Record<string, string>> = {
    ok: { B: 'id', E: 'type', H: 'shadow', v: 'labels', w: 'partMasks', y: 'size' },
    of: {
        b: 'size',
        e: 'prevOrigin',
        f: 'animateTransparencies',
        h: 'tx',
        i: 'ti',
        j: 'ty',
        l: 'base',
        m: 'animateColours',
        n: 'flags',
        p: 'tz'
    }
};

let h = 0;
const mix = (v: number): void => {
    h = (Math.imul(h, 31) + v) | 0;
};
const mixInts = (a: ArrayLike<number> | null): void => {
    if (a === null) {
        mix(-1);
        return;
    }
    mix(a.length);
    for (let i = 0; i < a.length; i++) mix(a[i]);
};
const mixBytes = (a: Uint8Array): void => {
    mix(a.length);
    for (let i = 0; i < a.length; i++) mix((a[i] << 24) >> 24);
};
const mixBools = (a: boolean[]): void => {
    mix(a.length);
    for (const v of a) mix(v ? 1 : 0);
};

function setHash(set: AnimFrameSet | null): string {
    if (set === null) return 'null';
    h = 0;
    let frames = 0;
    let bases = 0;
    const seen = new Map<AnimBase, number>();
    mix(set.frames.length);
    for (let i = 0; i < set.frames.length; i++) {
        const f = set.frames[i];
        if (f === null) {
            mix(-7);
            continue;
        }
        frames++;
        mix(f.size);
        mix(f.animateTransparencies ? 1 : 0);
        mix(f.animateColours ? 1 : 0);
        mixInts(f.ti);
        mixInts(f.tx);
        mixInts(f.ty);
        mixInts(f.tz);
        mixInts(f.prevOrigin);
        mixBytes(f.flags);
        mix(set.GetAnimateTransparencies(i) ? 1 : 0);
        mix(set.getAnimateColours(i) ? 1 : 0);
        const b = requireNonNull(f.base);
        const first = seen.get(b);
        if (first !== undefined) {
            mix(first);
            continue;
        }
        seen.set(b, i);
        bases++;
        mix(-1);
        mix(b.id);
        mix(b.size);
        mixInts(b.type);
        mixBools(b.shadow);
        mixInts(b.partMasks);
        mix(b.labels.length);
        for (const labels of b.labels) mixInts(labels);
    }
    return `${set.frames.length} ${frames} ${bases} ${h}`;
}

function ex(e: unknown): string {
    if (e instanceof TypeError && e.message.startsWith('Null')) return 'npe';
    if (e instanceof RangeError && e.message.includes('array index')) return 'aioobe';
    if (e instanceof RangeError && e.message === 'Invalid array length') return 'negsize';
    if (e instanceof Error && e.constructor === Error && e.message === '') return 'runtime';
    return `error:${String(e)}`;
}

function value(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (v instanceof AnimBase) return 'base';
    if (v instanceof Uint8Array) return `[${Array.from(v, b => (b << 24) >> 24).join(',')}]`;
    if (v instanceof Int16Array || v instanceof Int32Array) return `[${Array.from(v).join(',')}]`;
    if (Array.isArray(v)) return `[${v.map(e => value(e)).join(',')}]`;
    return String(v);
}

function fields(cls: string, o: object): string {
    const map = FIELDS[cls];
    const record = o as Record<string, unknown>;
    return Object.keys(map)
        .sort()
        .map(name => `${name}=${value(record[map[name]])}`)
        .join(' ');
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

type Edge = { baseLen: number; base: number[]; baseId: number; frameLen: number; frame: number[] };

function smart(out: number[], v: number): void {
    if (v >= -64 && v < 64) out.push(v + 64);
    else {
        const u = v + 49152;
        out.push(u >> 8, u & 255);
    }
}

function generateEdges(next: () => number, count: number): Edge[] {
    const below = (n: number): number => (next() >>> 0) % n;
    const edges: Edge[] = [];
    const smartValue = (): number => {
        const r = below(10);
        if (r === 0) return [-64, 63, -65, 64, -16384, 16383, 0, -1, 255, 256, 2047, -2048][below(12)];
        if (r < 6) return below(128) - 64;
        return below(32768) - 16384;
    };
    const makeBase = (types: number[]): number[] => {
        const b = [types.length, ...types];
        for (let i = 0; i < types.length; i++) b.push(below(3) === 0 ? below(256) : below(2));
        for (let i = 0; i < types.length; i++) {
            const m = below(4) === 0 ? 65535 : below(65536);
            b.push(m >> 8, m & 255);
        }
        const counts = types.map(() => below(6));
        b.push(...counts);
        for (const c of counts) for (let i = 0; i < c; i++) b.push(below(256));
        return b;
    };
    const makeFrame = (_types: number[], used: number, baseId: number): number[] => {
        const head = [baseId >> 8, baseId & 255, used];
        const values: number[] = [];
        for (let i = 0; i < used; i++) {
            const flag = below(5) < 2 ? 0 : below(256);
            head.push(flag);
            if (flag > 0) for (const bit of [1, 2, 4]) if ((flag & bit) !== 0) smart(values, smartValue());
        }
        return [...head, ...values];
    };
    const randomTypes = (n: number): number[] => Array.from({ length: n }, () => (below(4) === 0 ? 0 : [1, 2, 3, 5, 7, 4, 6, 9, 1, 2, 3][below(11)]));

    for (let n = 0; n < count; n++) {
        const types = randomTypes(below(5) === 0 ? below(60) : 1 + below(20));
        const base = makeBase(types);
        const baseId = below(3000);
        const kind = below(30);
        let used = types.length;
        if (kind === 0) used = types.length + 1 + below(3); // count above the base size
        let frame = makeFrame(types, used, baseId);
        let baseLen = base.length;
        let frameLen = frame.length;
        let baseBytes = base;
        if (kind === 1) frame = [...frame, below(256)]; // trailing byte
        if (kind === 2 && frame.length > 3) frame = frame.slice(0, frame.length - 1); // missing byte
        if (kind === 3) baseLen = -1; // no base object
        if (kind === 4) baseLen = -2; // ok(id, null)
        if (kind === 5) frameLen = -1; // null frame bytes
        if (kind === 6) frame = frame.slice(0, below(3)); // shorter than the header
        if (kind === 7 && base.length > 1) baseBytes = base.slice(0, 1 + below(base.length - 1)); // truncated base
        if (kind !== 3 && kind !== 4) baseLen = baseBytes.length;
        if (kind !== 5) frameLen = frame.length;
        edges.push({ baseLen, base: baseLen >= 0 ? baseBytes : [], baseId, frameLen, frame: frameLen >= 0 ? frame : [] });
    }
    return edges;
}

function fixedEdges(): Edge[] {
    const edges: Edge[] = [];
    const add = (base: number[] | null, baseLen: number, frame: number[] | null): void => {
        edges.push({ baseLen: base === null ? baseLen : base.length, base: base ?? [], baseId: 77, frameLen: frame === null ? -1 : frame.length, frame: frame ?? [] });
    };
    // Rotation repack of the smart boundaries: type 2 with all three axes set.
    const rot = [1, 2, 0, 0, 0, 0];
    for (const v of [-64, 63, -65, 64, -16384, 16383, -1, 2048, -2049]) {
        const values: number[] = [];
        smart(values, v);
        smart(values, -v - 1);
        smart(values, v >> 1);
        add(rot, 0, [0, 77, 1, 7, ...values]);
    }
    // Origins before translate/rotate/scale: the prior origin is recorded once per new origin.
    const chain = [0, 1, 2, 0, 3, 1, 0, 0, 5, 7];
    const chainBase = [chain.length, ...chain, ...new Array(10).fill(0), ...new Array(20).fill(0), ...new Array(10).fill(0)];
    add(chainBase, 0, [0, 77, 10, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, ...new Array(8).fill(64)]);
    add(chainBase, 0, [0, 77, 10, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, ...new Array(7).fill(64)]);
    add([1, 7, 0, 0, 0, 0], 0, [0, 77, 1, 7, 69, 64, 63]);
    // 255 transforms, all used with flag 8 (tween bit, no values): within the 500-entry scratch arrays.
    const wide = [255, ...new Array(255).fill(1), ...new Array(255).fill(0), ...new Array(510).fill(0), ...new Array(255).fill(0)];
    add(wide, 0, [0, 77, 255, ...new Array(255).fill(8)]);
    // No base object: a frame with no transforms still decodes; one transform NPEs on the base.
    add(null, -1, [0, 0, 0]);
    add(null, -1, [0, 0, 1, 0]);
    add(null, -1, [0, 0]);
    add([0], 0, []);
    add([0], 0, null);
    add([1, 5, 1, 0, 3, 3, 1, 2, 3], 0, [0, 77, 1, 1, 64]);
    add([1, 5, 1, 0, 3, 3, 1, 2], 0, [0, 77, 1, 1, 64]);
    return edges;
}

function writeEdges(chunks: Buffer[], edges: Edge[]): void {
    const int = (n: number): void => {
        const b = Buffer.alloc(4);
        b.writeInt32BE(n);
        chunks.push(b);
    };
    int(edges.length);
    for (const e of edges) {
        int(e.baseLen);
        if (e.baseLen >= 0) chunks.push(Buffer.from(e.base));
        int(e.baseId);
        int(e.frameLen);
        if (e.frameLen >= 0) chunks.push(Buffer.from(e.frame));
    }
}

function runEdge(e: Edge): string {
    let base: AnimBase | null = null;
    let baseOut: string;
    if (e.baseLen === -1) {
        baseOut = 'null';
    } else {
        try {
            base = new AnimBase(e.baseId, e.baseLen === -2 ? null : Uint8Array.from(e.base));
            baseOut = fields('ok', base);
        } catch (error) {
            baseOut = ex(error);
        }
    }
    let frameOut: string;
    try {
        frameOut = fields('of', new AnimFrame(e.frameLen === -1 ? null : Uint8Array.from(e.frame), base));
    } catch (error) {
        frameOut = ex(error);
    }
    return `${baseOut} | ${frameOut}`;
}

function runOracle(input: Buffer): string[] {
    const out = resolve(import.meta.dir, '../../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'anim-oracle-'));
    try {
        const source = fileURLToPath(new URL('./anim/AnimOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(build.stderr.toString());
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', scratch + delimiter + gamepackPath, 'AnimOracle'], {
            stdin: input,
            timeout: 170000
        });
        if (run.exitCode !== 0) throw new Error(`AnimOracle exited ${run.exitCode}: ${run.stderr.toString()}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

function animResets(): StaticReset[] {
    return [
        { target: AnimFrameSet, clinit: { basesArchive: null, framesArchive: null, cache: new LRUHashCache<AnimFrameSet>(100) } },
        {
            target: AnimFrame,
            clinit: {
                tempTz: new Int16Array(500),
                tempTi: new Int16Array(500),
                tempTx: new Int16Array(500),
                tempFlags: new Uint8Array(500),
                tempPrevOrigin: new Int16Array(500),
                tempTy: new Int16Array(500)
            }
        }
    ];
}

test('each TS anim class declares exactly the instance fields of its Java class', () => {
    const base = new AnimBase(1, Uint8Array.of(1, 0, 0, 0, 0, 0));
    const frame = new AnimFrame(Uint8Array.of(0, 1, 1, 0), base);
    const linkable = new Set(['next', 'key', 'prev', 'secondaryNext', 'secondaryKey', 'secondaryPrev']);
    expect(
        Object.keys(base)
            .filter(k => !linkable.has(k))
            .sort()
    ).toEqual(Object.values(FIELDS.ok).sort());
    expect(Object.keys(frame).sort()).toEqual(Object.values(FIELDS.of).sort());
    // hf declares only E; the constructor needs an archive, so a set from the cache is checked in the oracle test.
});

test('AnimFrameSet, AnimFrame and AnimBase match hf, of and ok of client.jar', () => {
    const assets = localAssets(cachePath, [0, 1]);
    const chunks: Buffer[] = [];
    const int = (n: number): void => {
        const b = Buffer.alloc(4);
        b.writeInt32BE(n);
        chunks.push(b);
    };
    const bytes = (data: Uint8Array): void => {
        int(data.length);
        chunks.push(Buffer.from(data));
    };
    for (const archive of [1, 0]) {
        bytes(readGroup(cachePath, 255, archive));
        for (const group of requireNonNull(requireNonNull(assets.index(archive)).groupIds)) bytes(readGroup(cachePath, archive, group));
    }

    const groups = [...requireNonNull(requireNonNull(assets.index(0)).groupIds), 65535, -1];
    for (let i = 0; i < 5; i++) groups.push(groups[i]);
    int(groups.length);
    for (const group of groups) int(group);

    const next = rng(530);
    const before = [...fixedEdges(), ...generateEdges(next, 600)];
    const after = [
        { baseLen: 7, base: [1, 1, 0, 0, 0, 0, 0], baseId: 5, frameLen: 5, frame: [0, 5, 1, 1, 64] },
        { baseLen: 7, base: [1, 1, 0, 0, 0, 0, 0], baseId: 5, frameLen: 4, frame: [0, 5, 1, 0] },
        { baseLen: -1, base: [], baseId: 0, frameLen: 3, frame: [0, 0, 0] }
    ];
    writeEdges(chunks, before);
    writeEdges(chunks, after);
    const java = runOracle(Buffer.concat(chunks));

    // The frame/base archives, the frameset cache and the six AnimFrame decoder arrays are process-wide; unload()
    // below nulls the arrays on purpose, so run the TS side from their <clinit> values and restore them afterwards.
    const { ts, sample } = withClinitStatics(animResets(), () => {
        AnimFrameSet.basesArchive = assets.archive(1);
        AnimFrameSet.framesArchive = assets.archive(0);
        AnimFrameSet.cache.Reset();
        const ts: string[] = [];
        for (const group of groups) {
            let first: string;
            let again: string;
            let flagged: string;
            let loaded: AnimFrameSet | null = null;
            try {
                loaded = AnimFrameSet.get(group);
                first = setHash(loaded);
            } catch (error) {
                first = ex(error);
            }
            try {
                const second = AnimFrameSet.get(group);
                again = second === null ? 'null' : String(second === loaded);
            } catch (error) {
                again = ex(error);
            }
            try {
                flagged = setHash(AnimFrameSet.Load(AnimFrameSet.basesArchive, true, AnimFrameSet.framesArchive, group));
            } catch (error) {
                flagged = ex(error);
            }
            ts.push(`g ${group} ${first} | ${again} | ${flagged}`);
        }
        for (const e of before) ts.push(runEdge(e));
        AnimFrame.unload();
        for (const e of after) ts.push(runEdge(e));

        const sample = requireNonNull(AnimFrameSet.get(groups[0]));
        return { ts, sample };
    });
    const node = new Set(['next', 'key', 'prev', 'secondaryNext', 'secondaryKey', 'secondaryPrev']);
    expect(Object.keys(sample).filter(k => !node.has(k))).toEqual(['frames']);

    expect(ts.length).toBe(java.length);
    const loadedSets = ts.filter(line => /^g \d+ \d+ /.test(line)).length;
    expect(loadedSets).toBeGreaterThan(2000);
    for (let i = 0; i < ts.length; i++) expect(ts[i]).toBe(java[i]);
    const outcomes = new Set(ts.slice(groups.length).map(line => line.split(' | ')[1].split(' ')[0].replace(/=.*/, '')));
    expect([...outcomes].sort()).toEqual(['aioobe', 'b', 'npe', 'runtime']);
    if (process.env.ANIM_STATS) {
        const flagged = ts.slice(0, groups.length).filter(line => !line.endsWith('| null')).length;
        console.log({ loadedSets, flagged, edges: ts.length - groups.length });
    }
}, 300000);
