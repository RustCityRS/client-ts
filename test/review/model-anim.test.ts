import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import AnimBase from '../../src/dash3d/AnimBase.js';
import AnimFrame from '../../src/dash3d/AnimFrame.js';
import AnimFrameSet from '../../src/dash3d/AnimFrameSet.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import Linkable from '../../src/datastruct/Linkable.js';
import SecondaryNode from '../../src/datastruct/SecondaryNode.js';
import Crc32 from '../../src/io/Crc32.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { withClinitStatics, type StaticReset } from './staticState.js';

// Unit anim against client.jar: hf (AnimFrameSet), of (AnimFrame), ok (AnimBase) and every static API.md assigns to
// them: gb.a (AnimFrameSet.get), bh.a (AnimFrameSet.Load), gl.x (cache), uk.d / ef.K (basesArchive / framesArchive),
// the of temp tables (tempTz/Ti/Tx/PrevOrigin/Flags/Ty), of.a() (AnimFrame.unload) and ok.a(II)I (AnimBase.or, inlined
// in the port as a | b). A seeded script runs through test/review/model-anim/ModelAnimOracle.java (real gamepack
// classes over real al archives) and through the TS port over Js5 archives with the same bytes; every output line
// must match: the result (or the root Java exception under the g wrappers), set contents, cache state, temp tables
// (after every set op too: a set that fails part way has already decoded into them) and the provider call log.
//
// Archives (fixture, identical on both sides): 0 = the real bases archive (cache archive 1), 1 = the real frames
// archive (cache archive 0), 2 = a synthetic bases archive in the flagged layout (group 0, file = base id, real base
// bytes), 3 = synthetic frame groups for the edge cases, 4 = their bases (normal layout: group = base id, file 0).
//
// 1. Every group of the real frames archive through gb.a/get, with per-field hashes over every element of every frame
//    (size, flags, ti/tx/ty/tz, prevOrigin, tween flags, both hf accessors, the base each frame shares) and every
//    distinct base (id, size, types, shadow, part masks, labels). Seeded re-gets of recent and old groups pin the
//    100-entry LRU (same object vs reload), with the cache's remaining/hard counts; a few real bases are withheld by
//    the provider during the sweep (null set, not cached) and released afterwards. Missing group ids, reset.
// 2. Full element-wise dumps (every array element of every frame and base) through bh.a/Load and the hf constructor
//    for the largest set, every sparse set and a seeded sample, with hf accessor probes (null frame, out of range).
// 3. The boolean base-lookup switch: Load/ctor with true against the real bases (group 0, file = id), against the
//    flagged archive (complete and with omitted bases), and false against the flagged archive; get always passes false.
// 4. Synthetic groups: base dedupe across interleaved bases, sparse file ids, a missing base, a truncated/empty/size-0
//    base, a multi-file base group, a group without file 0, trailing/missing frame bytes, a frame count above the base
//    size, 0/1-byte frame files (AIOOBE outside Load's catch), a partial set, provider-withheld groups that come back,
//    null archives, an id gap and out-of-range ids. Each through get, Load (both flags) and the constructor.
//    Throughout, the provider calls each archive received (index, group data, prefetch, percentage) are logged: Load
//    asks for a withheld frames group once per file and for each base before it decodes anything.
// 5. Seeded direct ok/of constructions (real bases with compatible frames, random bases over types 0..10 and 255,
//    smart boundaries and non-canonical encodings, noise, truncations, null bytes, no base) with the six temp tables
//    hashed after every case (partial scratch writes before an exception included).
// 6. ok.a(II)I against a | b. 7. of.a() (unload), then frames, Load (caught NPE -> null), get and the constructor.

// ---- shared formatting, identical to ModelAnimOracle.java ----

let h = 0;
const mix = (v: number): void => {
    h = (Math.imul(h, 31) + v) | 0;
};
const mixShorts = (a: Int16Array): void => {
    mix(a.length);
    for (let i = 0; i < a.length; i++) mix(a[i]);
};
const mixBytes = (a: Uint8Array): void => {
    mix(a.length);
    for (let i = 0; i < a.length; i++) mix((a[i] << 24) >> 24);
};
const mixInts = (a: Int32Array | null): void => {
    if (a === null) {
        mix(-1);
        return;
    }
    mix(a.length);
    for (let i = 0; i < a.length; i++) mix(a[i]);
};
const mixBools = (a: boolean[]): void => {
    mix(a.length);
    for (const v of a) mix(v ? 1 : 0);
};

const list = (a: ArrayLike<number> | null): string => (a === null ? 'null' : `[${Array.from(a).join(',')}]`);
const listBytes = (a: Uint8Array): string => `[${Array.from(a, v => (v << 24) >> 24).join(',')}]`;
const listBools = (a: boolean[]): string => `[${a.map(v => (v ? 1 : 0)).join(',')}]`;

function ex(e: unknown): string {
    if (e instanceof TypeError && e.message.startsWith('Null')) return 'npe';
    if (e instanceof RangeError && e.message.includes('array index')) return 'aioobe';
    if (e instanceof Error && e.constructor === Error && e.message === '') return 'runtime';
    // Anything else (a native JS TypeError from an unchecked null, a typed-array length error...) never matches Java.
    return `ts:${e instanceof Error ? `${e.constructor.name}:${e.message}` : String(e)}`;
}

function base(b: AnimBase): string {
    return `id=${b.id} y=${b.size} E=${list(b.type)} H=${listBools(b.shadow)} w=${list(b.partMasks)} v=[${b.labels.map(l => list(l)).join(',')}]`;
}

function frame(f: AnimFrame): string {
    const b = (v: boolean): number => (v ? 1 : 0);
    return `b=${f.size} f=${b(f.animateTransparencies)} m=${b(f.animateColours)} i=${list(f.ti)} h=${list(f.tx)} j=${list(f.ty)} p=${list(f.tz)} e=${list(f.prevOrigin)} n=${listBytes(f.flags)}`;
}

function accessor(set: AnimFrameSet, i: number): string {
    let c: string;
    let t: string;
    try {
        c = set.getAnimateColours(i) ? '1' : '0';
    } catch (e) {
        c = ex(e);
    }
    try {
        t = set.GetAnimateTransparencies(i) ? '1' : '0';
    } catch (e) {
        t = ex(e);
    }
    return c + t;
}

function describe(set: AnimFrameSet | null, full: boolean): string {
    if (set === null) return 'null';
    const frames = set.frames;
    const firstUse = new Map<AnimBase, number>();
    const distinct: AnimBase[] = [];
    let nonNull = 0;
    for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        if (f === null) continue;
        nonNull++;
        if (f.base !== null && !firstUse.has(f.base)) {
            firstUse.set(f.base, i);
            distinct.push(f.base);
        }
    }
    const share = (f: AnimFrame): number => (f.base === null ? -1 : requireNonNull(firstUse.get(f.base)));
    let out = `set ${frames.length} ${nonNull} ${distinct.length}`;
    if (full) {
        for (let i = 0; i < frames.length; i++) {
            const f = frames[i];
            out += ` | ${i}:`;
            if (f === null) {
                out += 'null';
                continue;
            }
            out += `${frame(f)} acc=${accessor(set, i)} l=${share(f)}`;
        }
        out += ' ||';
        for (let k = 0; k < distinct.length; k++) out += ` | b${k}:${base(distinct[k])}`;
        return out;
    }
    const names = ['sz', 'fl', 'ti', 'tx', 'ty', 'tz', 'po', 'fg', 'acc', 'share'];
    for (let field = 0; field < names.length; field++) {
        h = 0;
        for (let i = 0; i < frames.length; i++) {
            const f = frames[i];
            if (f === null) {
                if (field === 0) mix(-7);
                continue;
            }
            switch (field) {
                case 0:
                    mix(f.size);
                    break;
                case 1:
                    mix((f.animateTransparencies ? 1 : 0) | (f.animateColours ? 2 : 0));
                    break;
                case 2:
                    mixShorts(f.ti);
                    break;
                case 3:
                    mixShorts(f.tx);
                    break;
                case 4:
                    mixShorts(f.ty);
                    break;
                case 5:
                    mixShorts(f.tz);
                    break;
                case 6:
                    mixShorts(f.prevOrigin);
                    break;
                case 7:
                    mixBytes(f.flags);
                    break;
                case 8:
                    mix(set.getAnimateColours(i) ? 1 : 0);
                    mix(set.GetAnimateTransparencies(i) ? 1 : 0);
                    break;
                default:
                    mix(share(f));
            }
        }
        out += ` ${names[field]}=${h}`;
    }
    h = 0;
    for (const b of distinct) {
        mix(b.id);
        mix(b.size);
        mixInts(b.type);
        mixBools(b.shadow);
        mixInts(b.partMasks);
        mix(b.labels.length);
        for (const row of b.labels) mixInts(row);
    }
    return `${out} base=${h}`;
}

// of.a/c/d/g/k/o in Java name order.
const TEMPS: [string, string][] = [
    ['a', 'tempTz'],
    ['c', 'tempTi'],
    ['d', 'tempTx'],
    ['g', 'tempPrevOrigin'],
    ['k', 'tempFlags'],
    ['o', 'tempTy']
];

function temps(): string {
    const statics = AnimFrame as unknown as Record<string, Int16Array | Uint8Array | null>;
    let out = 'tmp';
    for (const [java, ts] of TEMPS) {
        const v = statics[ts];
        out += ` ${java}=`;
        if (v === null) {
            out += 'null';
            continue;
        }
        h = 0;
        if (v instanceof Int16Array) mixShorts(v);
        else mixBytes(v);
        out += h;
    }
    return out;
}

// ---- archives ----

// The JS5 container without the two-byte version trailer that the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

function stored(payload: number[] | Uint8Array): Uint8Array {
    const out = new Uint8Array(5 + payload.length);
    new DataView(out.buffer).setInt32(1, payload.length);
    out.set(payload, 5);
    return out;
}

interface ArchiveData {
    ref: Uint8Array;
    groups: Map<number, Uint8Array>;
}

// A protocol 5 reference table (no names) and the stored (uncompressed) group containers, one stripe per group.
function buildArchive(groups: Map<number, Map<number, Uint8Array>>): ArchiveData {
    const ids = [...groups.keys()].sort((a, b) => a - b);
    const t: number[] = [5, 0];
    const p2 = (v: number): void => void t.push((v >> 8) & 255, v & 255);
    const p4 = (v: number): void => void t.push((v >>> 24) & 255, (v >> 16) & 255, (v >> 8) & 255, v & 255);
    p2(ids.length);
    ids.forEach((id, i) => p2(id - (i === 0 ? 0 : ids[i - 1])));
    for (const _ of ids) p4(0);
    for (const _ of ids) p4(0);
    for (const id of ids) p2(requireNonNull(groups.get(id)).size);
    for (const id of ids) {
        const files = [...requireNonNull(groups.get(id)).keys()].sort((a, b) => a - b);
        files.forEach((f, i) => p2(f - (i === 0 ? 0 : files[i - 1])));
    }
    const out = new Map<number, Uint8Array>();
    for (const id of ids) {
        const files = requireNonNull(groups.get(id));
        const order = [...files.keys()].sort((a, b) => a - b);
        if (order.length === 0) continue;
        if (order.length === 1) {
            out.set(id, stored(requireNonNull(files.get(order[0]))));
            continue;
        }
        const payload: number[] = [];
        for (const f of order) payload.push(...requireNonNull(files.get(f)));
        let previous = 0;
        for (const f of order) {
            const size = requireNonNull(files.get(f)).length;
            const delta = size - previous;
            payload.push((delta >>> 24) & 255, (delta >> 16) & 255, (delta >> 8) & 255, delta & 255);
            previous = size;
        }
        payload.push(1);
        out.set(id, stored(payload));
    }
    return { ref: stored(t), groups: out };
}

function realArchive(archive: number): ArchiveData {
    const ref = container(readGroup(cachePath, 255, archive));
    const index = new Js5Index(ref, Crc32.prefix(ref, ref.length));
    const groups = new Map<number, Uint8Array>();
    for (const group of requireNonNull(index.groupIds)) groups.set(group, container(readGroup(cachePath, archive, group)));
    return { ref, groups };
}

class FixtureProvider extends Js5ResourceProvider {
    readonly table: Js5Index;
    readonly withheld = new Set<number>();
    readonly calls: string[] = [];

    constructor(readonly data: ArchiveData) {
        super();
        this.table = new Js5Index(data.ref, Crc32.prefix(data.ref, data.ref.length));
    }

    index(): Js5Index | null {
        this.calls.push('i');
        return this.table;
    }

    group(mode: number, group: number): Uint8Array | null {
        this.calls.push(`g${mode}:${group}`);
        if (this.withheld.has(group)) return null;
        return this.data.groups.get(group) ?? null;
    }

    prefetchGroup(_group: number): void {
        this.calls.push('p');
    }

    GetGroupLoadPercentage(_group: number): number {
        this.calls.push('c');
        return 100;
    }
}

function writeFixture(archives: ArchiveData[]): Buffer {
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
    int(archives.length);
    for (const a of archives) {
        bytes(a.ref);
        int(a.groups.size);
        for (const [group, data] of a.groups) {
            int(group);
            bytes(data);
        }
    }
    return Buffer.concat(chunks);
}

// ---- TS executor (mirrors ModelAnimOracle.run) ----

class Runner {
    readonly providers: FixtureProvider[];
    readonly archives: Js5[];
    readonly lastByGroup = new Map<number, AnimFrameSet>();
    current: AnimFrameSet | null = null;

    constructor(data: ArchiveData[]) {
        this.providers = data.map(d => new FixtureProvider(d));
        this.archives = this.providers.map(p => new Js5(p, false, false));
    }

    archive(s: string): Js5 | null {
        const a = Number(s);
        return a < 0 ? null : this.archives[a];
    }

    produced(set: AnimFrameSet | null, full: boolean): string {
        if (set !== null) this.current = set;
        return describe(set, full);
    }

    run(t: string[]): string {
        switch (t[0]) {
            case 'bases':
                AnimFrameSet.basesArchive = this.archive(t[1]);
                return 'ok';
            case 'frames':
                AnimFrameSet.framesArchive = this.archive(t[1]);
                return 'ok';
            case 'avail': {
                const p = this.providers[Number(t[1])];
                if (t[3] === '1') p.withheld.delete(Number(t[2]));
                else p.withheld.add(Number(t[2]));
                return 'ok';
            }
            case 'get': {
                const group = Number(t[1]);
                const set = AnimFrameSet.get(group);
                if (set === null) return 'null';
                const before = this.lastByGroup.get(group);
                this.lastByGroup.set(group, set);
                this.current = set;
                if (before === set) return 'same';
                return `new ${describe(set, t[2] === '1')}`;
            }
            case 'load':
                return this.produced(AnimFrameSet.Load(this.archive(t[1]), t[2] === '1', this.archive(t[3]), Number(t[4])), t[5] === '1');
            case 'ctor':
                return this.produced(new AnimFrameSet(this.archive(t[1]), this.archive(t[2]), Number(t[3]), t[4] === '1'), t[5] === '1');
            case 'acc':
                return this.current === null ? 'noset' : accessor(this.current, Number(t[1]));
            case 'cache': {
                const remaining = (AnimFrameSet.cache as unknown as { remaining: number }).remaining;
                return `p=${remaining} hard=${AnimFrameSet.cache.countHard()}`;
            }
            case 'reset':
                AnimFrameSet.cache.Reset();
                return 'ok';
            case 'log': {
                let out = 'log';
                this.providers.forEach((p, a) => {
                    out += ` ${a}=`;
                    if (p.calls.length <= 24) {
                        out += p.calls.join(',');
                    } else {
                        h = 0;
                        for (const call of p.calls) mix(javaStringHash(call));
                        out += `${p.calls.length}:${h}`;
                    }
                    p.calls.length = 0;
                });
                return out;
            }
            case 'frame': {
                let b: AnimBase | null = null;
                let baseOut: string;
                if (t[1] === '-') {
                    baseOut = 'nobase';
                } else {
                    try {
                        b = new AnimBase(Number(t[2]), bytesOf(t[1]));
                        baseOut = base(b);
                    } catch (e) {
                        baseOut = ex(e);
                    }
                }
                let frameOut: string;
                try {
                    const f = new AnimFrame(bytesOf(t[3]), b);
                    frameOut = `${frame(f)} l=${f.base === null ? 'null' : f.base === b ? 'arg' : 'other'}`;
                } catch (e) {
                    frameOut = ex(e);
                }
                return `${baseOut} | ${frameOut} | ${temps()}`;
            }
            case 'unload':
                AnimFrame.unload();
                return 'ok';
            case 'or':
                // ok.a(II)I is inlined in the port at each call site as a | b.
                return String(Number(t[1]) | Number(t[2]));
            default:
                throw new Error(`unknown op ${t[0]}`);
        }
    }
}

// java.lang.String.hashCode for ASCII.
function javaStringHash(s: string): number {
    let v = 0;
    for (let i = 0; i < s.length; i++) v = (Math.imul(v, 31) + s.charCodeAt(i)) | 0;
    return v;
}

function bytesOf(s: string): Uint8Array | null {
    if (s === 'N') return null;
    return Uint8Array.from(Buffer.from(s.slice(1), 'hex'));
}

const hex = (bytes: ArrayLike<number> | null): string => (bytes === null ? 'N' : `x${Buffer.from(Uint8Array.from(bytes)).toString('hex')}`);

// ---- script generation ----

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

interface Generator {
    below(n: number): number;
    pick<T>(items: readonly T[]): T;
}

function generator(seed: number): Generator {
    const next = rng(seed);
    const below = (n: number): number => (next() >>> 0) % n;
    return { below, pick: items => items[below(items.length)] };
}

const TYPES = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 5, 5, 7, 7, 4, 6, 8, 9, 10, 255];

function randomBase(g: Generator, size: number): number[] {
    const out = [size];
    for (let i = 0; i < size; i++) out.push(g.pick(TYPES));
    for (let i = 0; i < size; i++) out.push(g.below(3) === 0 ? g.below(256) : g.below(2));
    for (let i = 0; i < size; i++) {
        const m = g.below(4) === 0 ? 65535 : g.below(65536);
        out.push(m >> 8, m & 255);
    }
    const counts = Array.from({ length: size }, () => (g.below(5) === 0 ? 0 : g.below(8)));
    out.push(...counts);
    for (const c of counts) for (let i = 0; i < c; i++) out.push(g.below(256));
    return out;
}

function baseTypes(bytes: ArrayLike<number>): number[] {
    return Array.from({ length: bytes[0] }, (_, i) => bytes[1 + i]);
}

function smart(g: Generator, out: number[]): void {
    const r = g.below(12);
    if (r === 0) {
        out.push(g.pick([0, 1, 63, 64, 126, 127])); // one-byte boundaries: -64, -63, -1, 0, 62, 63
    } else if (r === 1) {
        const raw = g.pick([0x8000, 0x8001, 0xbfbf, 0xbfc0, 0xc000, 0xc03f, 0xc040, 0xffff, 0xfffe, 0xc0ff, 0xc100]);
        out.push(raw >> 8, raw & 255);
    } else if (r < 7) {
        out.push(g.below(128));
    } else {
        const raw = 0x8000 + g.below(0x8000);
        out.push(raw >> 8, raw & 255);
    }
}

function frameFor(g: Generator, baseId: number, count: number): number[] {
    const head = [(baseId >> 8) & 255, baseId & 255, count];
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
        const r = g.below(10);
        const flag = r < 3 ? 0 : r < 8 ? 1 + g.below(31) : g.below(256);
        head.push(flag);
        for (const bit of [1, 2, 4]) if ((flag & bit) !== 0) smart(g, values);
    }
    return [...head, ...values];
}

interface Real {
    groups: number[];
    limits: Map<number, number>;
    fileIds: Map<number, Int32Array>;
    baseIds: Map<number, number[]>;
    baseBytes: (id: number) => Uint8Array | null;
}

function realInfo(bases: ArchiveData, frames: ArchiveData, sample: number): Real {
    const b = new Js5(new FixtureProvider(bases), false, false);
    const f = new Js5(new FixtureProvider(frames), false, false);
    const index = new Js5Index(frames.ref, Crc32.prefix(frames.ref, frames.ref.length));
    const groups = Array.from(requireNonNull(index.groupIds));
    const limits = new Map<number, number>();
    const fileIds = new Map<number, Int32Array>();
    for (const group of groups) {
        limits.set(group, f.GetFileIdLimit(group));
        fileIds.set(group, requireNonNull(f.GetFileList(group)));
    }
    const baseIds = new Map<number, number[]>();
    for (const group of groups.slice(0, sample)) {
        const ids = new Set<number>();
        for (const file of requireNonNull(fileIds.get(group))) {
            const data = requireNonNull(f.PeekFile(group, file));
            ids.add((data[0] << 8) | data[1]);
        }
        baseIds.set(group, [...ids]);
    }
    return { groups, limits, fileIds, baseIds, baseBytes: id => b.PeekFile(id, 0) };
}

function accProbe(g: Generator, ops: string[], length: number, nullIds: number[]): void {
    const r = g.below(6);
    let idx: number;
    if (r === 0) idx = -1;
    else if (r === 1) idx = length;
    else if (r === 2 && nullIds.length > 0) idx = g.pick(nullIds);
    else idx = length === 0 ? 0 : g.below(length);
    ops.push(`acc ${idx}`);
}

function nullIdsOf(real: Real, group: number): number[] {
    const present = new Set(requireNonNull(real.fileIds.get(group)));
    const out: number[] = [];
    for (let i = 0; i < requireNonNull(real.limits.get(group)); i++) if (!present.has(i)) out.push(i);
    return out;
}

// Synthetic edge archives (3 = frames, 4 = bases). Returns the archives and the frame group ids.
function syntheticArchives(g: Generator, realBase: Uint8Array): { frames: ArchiveData; bases: ArchiveData; groups: number[]; heldBase: number; heldFrames: number } {
    const baseA = randomBase(g, 12);
    const baseB = randomBase(g, 20);
    const baseC = randomBase(g, 7);
    const baseD = randomBase(g, 9);
    const single = (bytes: ArrayLike<number>): Map<number, Uint8Array> => new Map([[0, Uint8Array.from(bytes)]]);
    const bases = new Map<number, Map<number, Uint8Array>>([
        [10, single(baseA)],
        [11, single(baseB)],
        [12, single(realBase)],
        [14, single(baseA.slice(0, baseA.length - 3))], // truncated: AIOOBE in ok
        [
            15,
            new Map([
                [0, Uint8Array.from(baseC)],
                [1, Uint8Array.of(9, 9, 9)]
            ])
        ], // multi-file group, file 0 = base
        [16, new Map([[1, Uint8Array.from(baseC)]])], // no file 0
        [17, single([])], // empty: AIOOBE on the size byte
        [18, single([0])], // size 0
        [19, single(baseD)], // withheld / released by the script
        [40, single(randomBase(g, 3))], // leaves an id gap below it
        [41, single(randomBase(g, 5))] // only frames group 23 uses it; withheld / released by the script
    ]);
    const types = (id: number): number[] => baseTypes(requireNonNull(requireNonNull(bases.get(id)).get(0)));
    const frameOf = (id: number, count = types(id).length): Uint8Array => Uint8Array.from(frameFor(g, id, count));
    const files = (...list: Uint8Array[]): Map<number, Uint8Array> => new Map(list.map((f, i) => [i, f]));
    const frames = new Map<number, Map<number, Uint8Array>>();
    frames.set(0, files(frameOf(10), frameOf(10), frameOf(10), frameOf(10), frameOf(10)));
    frames.set(1, files(frameOf(10), frameOf(11), frameOf(12), frameOf(10), frameOf(11), frameOf(12, 0)));
    frames.set(
        2,
        new Map([
            [0, frameOf(10)],
            [3, frameOf(10)],
            [7, frameOf(11)]
        ])
    ); // sparse
    frames.set(3, files(frameOf(10), Uint8Array.from(frameFor(g, 13, 2)))); // base 13 is not in the archive
    frames.set(4, files(Uint8Array.from(frameFor(g, 14, 4)))); // truncated base
    frames.set(5, files(frameOf(10), Uint8Array.from([...frameFor(g, 10, 12), 7]))); // trailing byte: RuntimeException
    frames.set(6, files(frameOf(11), Uint8Array.from(frameFor(g, 10, 13)))); // count above the base size: AIOOBE
    frames.set(7, files(frameOf(10), Uint8Array.of(0))); // one byte: AIOOBE reading the base id
    frames.set(8, files(Uint8Array.of())); // empty file
    frames.set(9, files(frameOf(15), frameOf(15))); // multi-file base group
    frames.set(10, files(Uint8Array.from(frameFor(g, 16, 1)))); // base group without file 0
    frames.set(11, files(Uint8Array.from(frameFor(g, 17, 0)))); // empty base
    frames.set(12, files(Uint8Array.from(frameFor(g, 18, 0)), Uint8Array.from(frameFor(g, 18, 0)))); // size-0 base
    frames.set(13, files(Uint8Array.from(frameFor(g, 18, 1)))); // size-0 base, one transform: AIOOBE
    frames.set(14, new Map()); // no files: capacity 0, an invalid group
    frames.set(15, files(frameOf(19), frameOf(19), frameOf(19)));
    frames.set(16, files(frameOf(10), Uint8Array.from(frameFor(g, 13, 1)), frameOf(10))); // partial: one base missing
    frames.set(17, files(...Array.from({ length: 30 }, () => frameOf(12))));
    const big: Uint8Array[] = [];
    for (let i = 0; i < 300; i++) big.push(frameOf(g.pick([10, 11, 12, 15, 19]), g.below(8) === 0 ? 0 : undefined));
    frames.set(18, files(...big));
    frames.set(19, files(Uint8Array.from([0, 10, 3, 8, 16, 24]), Uint8Array.from([0, 10, 2, 32, 0]))); // tween bits only / ignored bits
    frames.set(20, files(Uint8Array.from(frameFor(g, 0, 0)))); // base id 0 (absent)
    frames.set(23, files(frameOf(10), frameOf(41))); // withheld frames group with a withheld base, kept out of the loop
    frames.set(30, files(frameOf(40))); // after the gap 24..29
    const groups = [...frames.keys(), 21, 24, 29, 31, 1000].filter(group => group !== 23);
    return { frames: buildArchive(frames), bases: buildArchive(bases), groups, heldBase: 41, heldFrames: 23 };
}

interface Plan {
    archives: ArchiveData[];
    script: string[];
}

function plan(): Plan {
    const g = generator(0x530a);
    const realBases = realArchive(1);
    const realFrames = realArchive(0);
    const real = realInfo(realBases, realFrames, 400);
    const ops: string[] = [];

    // Bases withheld during the sweep (rarely shared ones) and the sets that need them.
    const sampled = [...real.baseIds.keys()];
    const usage = new Map<number, number>();
    for (const group of sampled) for (const id of requireNonNull(real.baseIds.get(group))) usage.set(id, (usage.get(id) ?? 0) + 1);
    const rare = [...usage.keys()].filter(id => requireNonNull(usage.get(id)) <= 2).sort((a, b) => a - b);
    const withheldBases = [rare[3], rare[Math.floor(rare.length / 3)], rare[Math.floor((2 * rare.length) / 3)], rare[rare.length - 2]];
    const blocked = sampled.filter(group => requireNonNull(real.baseIds.get(group)).some(id => withheldBases.includes(id)));
    expect(new Set(withheldBases).size).toBe(4);
    expect(blocked.length).toBeGreaterThan(3);

    // The flagged-layout archive: group 0 holds every base of the chosen sets, except those of the omitted sets.
    const flaggedSets = sampled.filter((_, i) => i % 9 === 0).slice(0, 40);
    const omitted = flaggedSets.filter((_, i) => i % 7 === 3);
    const keep = new Set<number>();
    for (const group of flaggedSets) for (const id of requireNonNull(real.baseIds.get(group))) keep.add(id);
    for (const group of omitted) for (const id of requireNonNull(real.baseIds.get(group))) keep.delete(id);
    const flaggedFiles = new Map<number, Uint8Array>();
    for (const id of keep) flaggedFiles.set(id, requireNonNull(real.baseBytes(id)));
    const flagged = buildArchive(new Map([[0, flaggedFiles]]));

    const realBasePool = sampled.slice(0, 200).flatMap(group => requireNonNull(real.baseIds.get(group)));
    const synth = syntheticArchives(g, requireNonNull(real.baseBytes(realBasePool[0])));
    const archives = [realBases, realFrames, flagged, synth.frames, synth.bases];

    // 1. The sweep.
    ops.push('cache', 'bases 0', 'frames 1', 'acc 0');
    for (const id of withheldBases) ops.push(`avail 0 ${id} 0`);
    real.groups.forEach((group, i) => {
        ops.push(`get ${group} 0`);
        const r = g.below(16);
        if (r === 0) ops.push(`get ${real.groups[Math.max(0, i - g.below(110))]} 0`);
        else if (r === 1) ops.push(`get ${real.groups[g.below(i + 1)]} 0`);
        else if (r === 2) accProbe(g, ops, requireNonNull(real.limits.get(group)), nullIdsOf(real, group));
        if (i % 128 === 0) ops.push('cache');
    });
    ops.push('cache');
    for (const id of withheldBases) ops.push(`avail 0 ${id} 1`);
    for (const group of blocked) ops.push(`get ${group} 0`, `get ${group} 0`);
    ops.push('cache');
    for (const group of [2724, 65535, 70000, -1, 2147483647, -2147483648]) ops.push(`get ${group} 0`);
    ops.push('cache', 'reset', 'cache');
    for (let i = 0; i < 12; i++) ops.push(`get ${g.pick(real.groups)} 0`);
    ops.push('cache');

    // 2. Full dumps through Load and the constructor.
    const largest = real.groups.reduce((a, b) => (requireNonNull(real.limits.get(b)) > requireNonNull(real.limits.get(a)) ? b : a));
    const sparse = real.groups.filter(group => nullIdsOf(real, group).length > 0);
    expect(sparse.length).toBeGreaterThan(3);
    const fullSample = [largest, ...sparse.slice(0, 12)];
    for (let i = 0; i < 40; i++) fullSample.push(g.pick(real.groups));
    for (const group of fullSample) {
        ops.push(`load 0 0 1 ${group} 1`);
        for (let k = 0; k < 3; k++) accProbe(g, ops, requireNonNull(real.limits.get(group)), nullIdsOf(real, group));
    }
    for (let i = 0; i < 8; i++) ops.push(`ctor 1 0 ${g.pick(real.groups)} 0 1`);

    // 3. The base-lookup switch.
    for (let i = 0; i < 150; i++) ops.push(`load 0 1 1 ${g.pick(real.groups)} 0`);
    for (const group of flaggedSets) {
        ops.push(`load 2 1 1 ${group} 0`, `load 2 0 1 ${group} 0`, `ctor 1 2 ${group} 1 0`, `ctor 1 2 ${group} 0 0`, `load 0 0 1 ${group} 0`, 'log');
    }
    for (const group of flaggedSets.slice(1, 4)) ops.push(`load 2 1 1 ${group} 1`);
    ops.push('reset', 'bases 2', `get ${flaggedSets[1]} 0`, 'cache', 'bases 0', `get ${flaggedSets[1]} 0`, `get ${flaggedSets[1]} 0`, 'cache');

    // 4. Synthetic groups.
    ops.push('reset', 'bases 4', 'frames 3');
    for (const group of synth.groups) {
        ops.push(`get ${group} 0`, `get ${group} 0`, `load 4 0 3 ${group} 1`);
        for (let k = 0; k < 3; k++) ops.push(`acc ${g.below(12) - 2}`);
        ops.push(`ctor 3 4 ${group} 0 1`, `load 4 1 3 ${group} 0`, `ctor 3 4 ${group} 1 0`, `load 2 1 3 ${group} 0`, 'log');
    }
    // Group 23 and its base 41 were never read: withheld frames, then a withheld base, give null (not cached); once
    // both are served the set loads and is cached. Withholding again after the al unpacked them changes nothing.
    const held = synth.heldFrames;
    ops.push('cache', `avail 4 ${synth.heldBase} 0`, `avail 3 ${held} 0`, `get ${held} 0`, `load 4 0 3 ${held} 0`, `ctor 3 4 ${held} 0 0`, 'cache');
    ops.push(`avail 3 ${held} 1`, `get ${held} 0`, 'cache', `avail 4 ${synth.heldBase} 1`, `get ${held} 0`, `get ${held} 0`, 'cache');
    ops.push(`avail 4 ${synth.heldBase} 0`, `avail 3 ${held} 0`, 'reset', `get ${held} 0`, `get ${held} 0`, 'cache');
    ops.push('reset', 'bases -1', 'get 0 0', 'get 14 0', 'cache', 'frames -1', 'get 1 0', 'get 0 0', 'cache');
    ops.push('load -1 0 3 14 1', 'load -1 0 3 0 0', 'ctor -1 4 0 0 0', 'ctor 3 -1 0 0 0', 'ctor 3 -1 14 0 1', 'load 4 0 -1 0 0');
    ops.push('bases 4', 'frames 3', 'get 0 0', 'get 1 0', 'cache');

    // 5. Direct constructions.
    const realBaseBytes = [...new Set(realBasePool)].map(id => requireNonNull(real.baseBytes(id)));
    for (let n = 0; n < 1500; n++) {
        const r = g.below(20);
        const id = g.below(4000);
        let baseBytes: number[];
        if (r < 7) baseBytes = Array.from(g.pick(realBaseBytes));
        else baseBytes = randomBase(g, g.below(6) === 0 ? g.below(80) : 1 + g.below(25));
        const size = baseBytes[0];
        let frameBytes: number[] | null = frameFor(g, id, size);
        let baseSpec = hex(baseBytes);
        const kind = g.below(24);
        if (kind === 0) frameBytes = frameFor(g, id, size + 1 + g.below(3));
        else if (kind === 1) frameBytes = frameFor(g, id, g.below(size + 1));
        else if (kind === 2) frameBytes = [...frameBytes, g.below(256)];
        else if (kind === 3 && frameBytes.length > 3) frameBytes = frameBytes.slice(0, frameBytes.length - 1 - g.below(2));
        else if (kind === 4) frameBytes = Array.from({ length: g.below(40) }, () => g.below(256));
        else if (kind === 5) frameBytes = frameBytes.slice(0, g.below(3));
        else if (kind === 6) frameBytes = null;
        else if (kind === 7) baseSpec = '-';
        else if (kind === 8) baseSpec = 'N';
        else if (kind === 9 && baseBytes.length > 1) baseSpec = hex(baseBytes.slice(0, 1 + g.below(baseBytes.length - 1)));
        else if (kind === 10) baseSpec = 'x';
        else if (kind === 11) frameBytes = frameFor(g, id, 0);
        ops.push(`frame ${baseSpec} ${id} ${hex(frameBytes)}`);
    }
    // 255 transforms, all used (the temp tables are 500 long), and every one-byte flag on one transform per type.
    const wide = [255, ...Array.from({ length: 255 }, (_, i) => [1, 2, 3, 0, 5, 7][i % 6]), ...new Array(255).fill(0), ...new Array(510).fill(255), ...new Array(255).fill(1), ...new Array(255).fill(9)];
    ops.push(`frame ${hex(wide)} 77 ${hex([0, 77, 255, ...new Array(255).fill(31), ...Array.from({ length: 255 * 3 }, (_, i) => (i * 37) & 127)])}`);
    for (const type of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 255]) {
        for (let flag = 0; flag < 256; flag += 1 + g.below(9)) {
            const values: number[] = [];
            for (const bit of [1, 2, 4]) if ((flag & bit) !== 0) smart(g, values);
            ops.push(`frame ${hex([1, type, 0, 0, 0, 0])} 3 ${hex([0, 3, 1, flag, ...values])}`);
        }
    }

    // 6. ok.a(II)I.
    const edgeInts = [0, -1, 1, 0x7fffffff, -0x80000000, 0x8000, 0xffff, -65536];
    for (let i = 0; i < 300; i++) {
        const a = g.below(4) === 0 ? g.pick(edgeInts) : (g.below(0x10000) << 16) | g.below(0x10000);
        const b = g.below(4) === 0 ? g.pick(edgeInts) : (g.below(0x10000) << 16) | g.below(0x10000);
        ops.push(`or ${a} ${b}`);
    }

    // 7. Unload.
    ops.push('unload', 'reset');
    ops.push(`frame ${hex([2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0])} 5 ${hex([0, 5, 2, 0, 0])}`);
    ops.push(`frame ${hex([2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0])} 5 ${hex([0, 5, 2, 0, 1, 64])}`);
    ops.push(`frame - 5 ${hex([0, 5, 0])}`);
    ops.push(`get ${real.groups[3]} 0`, 'cache', `load 0 0 1 ${real.groups[4]} 0`, `ctor 1 0 ${real.groups[5]} 0 0`, 'load 4 0 3 12 1', 'get 12 0', 'cache');
    // Every cache report is followed by the provider calls since the previous log.
    return { archives, script: ops.flatMap(op => (op === 'cache' ? ['cache', 'log'] : [op])) };
}

// ---- oracle ----

function runOracle(fixture: Buffer, script: string[]): string[] {
    const out = resolve(import.meta.dir, '../../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'model-anim-oracle-'));
    try {
        const source = fileURLToPath(new URL('./model-anim/ModelAnimOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(build.stderr.toString());
        const fixturePath = join(scratch, 'fixture.bin');
        writeFileSync(fixturePath, fixture);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', scratch + delimiter + gamepackPath, 'ModelAnimOracle', fixturePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`ModelAnimOracle exited ${run.exitCode}: ${run.stderr.toString()}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

// <clinit> values of every static the script touches: gl.x = new ve(100), uk.d / ef.K null, of's six 500-entry temp
// tables, and the Js5 knobs the archives read (ce.K = 0, vc.J = false).
function resets(): StaticReset[] {
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
        },
        { target: Js5, clinit: { maxContainerSize: 0, strictValidation: false } }
    ];
}

const JAVA_TO_TS: Record<string, Record<string, [string, string]>> = {
    hf: { E: ['frames', '[Lof;'] },
    of: {
        b: ['size', 'I'],
        e: ['prevOrigin', '[S'],
        f: ['animateTransparencies', 'Z'],
        h: ['tx', '[S'],
        i: ['ti', '[S'],
        j: ['ty', '[S'],
        l: ['base', 'Lok;'],
        m: ['animateColours', 'Z'],
        n: ['flags', '[B'],
        p: ['tz', '[S'],
        's.a': ['tempTz', '[S'],
        's.c': ['tempTi', '[S'],
        's.d': ['tempTx', '[S'],
        's.g': ['tempPrevOrigin', '[S'],
        's.k': ['tempFlags', '[B'],
        's.o': ['tempTy', '[S']
    },
    ok: { v: ['labels', '[[I'], w: ['partMasks', '[I'], y: ['size', 'I'], B: ['id', 'I'], E: ['type', '[I'], H: ['shadow', '[Z'] }
};

function typeOf(v: unknown): string {
    if (typeof v === 'number') return 'I';
    if (typeof v === 'boolean') return 'Z';
    if (v instanceof Int16Array) return '[S';
    if (v instanceof Uint8Array) return '[B';
    if (v instanceof Int32Array) return '[I';
    if (v instanceof AnimBase) return 'Lok;';
    if (Array.isArray(v)) {
        if (v.every(e => e instanceof AnimFrame || e === null) && v.some(e => e instanceof AnimFrame)) return '[Lof;';
        if (v.every(e => typeof e === 'boolean')) return '[Z';
        if (v.every(e => e instanceof Int32Array || e === null)) return '[[I';
    }
    return `?${Object.prototype.toString.call(v)}`;
}

test('AnimFrameSet, AnimFrame and AnimBase match hf, of and ok of client.jar (cache sweep, Load switch, edges, scratch)', () => {
    const { archives, script } = plan();
    const java = runOracle(writeFixture(archives), ['fields', ...script]);

    const ts = withClinitStatics(resets(), () => {
        const runner = new Runner(archives);
        const out: string[] = [];
        for (const line of script) {
            const t = line.split(' ');
            let result: string;
            try {
                result = runner.run(t);
            } catch (e) {
                result = ex(e);
            }
            if (t[0] === 'get' || t[0] === 'load' || t[0] === 'ctor') result += ` # ${temps()}`;
            out.push(result);
        }
        return out;
    });

    // The Java field list: every instance field of hf/of/ok and the of statics map onto a TS member of the same type.
    const declared = requireNonNull(java[0]).split(' # ');
    const tsSet = withClinitStatics(resets(), () => {
        const runner = new Runner(archives);
        return requireNonNull(new AnimFrameSet(runner.archive('1'), runner.archive('0'), 0, false));
    });
    const sampleFrame = requireNonNull(tsSet.frames.find(f => f !== null) ?? null);
    const sampleBase = requireNonNull(sampleFrame.base);
    const inherited = (o: object): Set<string> => new Set(Object.keys(o));
    const objects: Record<string, [object, Set<string>]> = {
        hf: [tsSet, inherited(new SecondaryNode())],
        of: [sampleFrame, new Set()],
        ok: [sampleBase, inherited(new Linkable())]
    };
    for (const entry of declared) {
        const [cls, ...members] = entry.split(/:? /);
        const map = requireNonNull(JAVA_TO_TS[cls]);
        const [instance, skip] = requireNonNull(objects[cls]);
        const javaInstance: string[] = [];
        for (const member of members) {
            const colon = member.indexOf(':');
            const name = member.slice(0, colon);
            const descriptor = member.slice(colon + 1);
            if (name.startsWith('s.') && map[name] === undefined) continue; // statics homed in other classes
            const target = map[name];
            expect(target, `${cls}.${name}`).toBeDefined();
            expect(target[1], `${cls}.${name} descriptor`).toBe(descriptor);
            if (name.startsWith('s.')) {
                // Null once of.a() ran (another suite may have called AnimFrame.unload in this process).
                expect(Object.hasOwn(AnimFrame, target[0]), `${cls}.${name} -> AnimFrame.${target[0]}`).toBe(true);
                const value = (AnimFrame as unknown as Record<string, unknown>)[target[0]];
                if (value !== null) expect(typeOf(value), `${cls}.${name} -> AnimFrame.${target[0]}`).toBe(descriptor);
            } else {
                javaInstance.push(target[0]);
                expect(typeOf((instance as Record<string, unknown>)[target[0]]), `${cls}.${name} -> ${target[0]}`).toBe(descriptor);
            }
        }
        const tsInstance = Object.keys(instance).filter(k => !skip.has(k));
        expect(tsInstance.sort(), `${cls} instance fields`).toEqual(javaInstance.sort());
    }
    // AnimFrame holds exactly the six of statics; the frameset cache and archives sit on AnimFrameSet; AnimBase none.
    const ownStatics = (c: object): string[] => Object.getOwnPropertyNames(c).filter(k => !['length', 'name', 'prototype'].includes(k) && typeof (c as Record<string, unknown>)[k] !== 'function');
    expect(ownStatics(AnimFrame).sort()).toEqual(TEMPS.map(([, ts]) => ts).sort());
    expect(ownStatics(AnimFrameSet).sort()).toEqual(['basesArchive', 'cache', 'framesArchive']);
    expect(ownStatics(AnimBase)).toEqual([]);

    const javaOps = java.slice(1);
    const dump = process.env.MODEL_ANIM_DUMP;
    if (dump) {
        mkdirSync(dump, { recursive: true });
        writeFileSync(join(dump, 'script.txt'), script.join('\n'));
        writeFileSync(join(dump, 'java.txt'), java.join('\n'));
        writeFileSync(join(dump, 'ts.txt'), ts.join('\n'));
    }
    expect(javaOps.length).toBe(script.length);
    expect(ts.length).toBe(script.length);
    const mismatches: string[] = [];
    for (let i = 0; i < script.length; i++) {
        if (ts[i] === javaOps[i]) continue;
        const clip = (s: string): string => (s.length > 600 ? `${s.slice(0, 600)}...(${s.length})` : s);
        if (mismatches.length < 12) mismatches.push(`#${i} ${clip(script[i])}\n  java: ${clip(javaOps[i])}\n  ts:   ${clip(ts[i])}`);
        else mismatches.push(`#${i}`);
    }
    expect(mismatches.length === 0 ? '' : `${mismatches.length} mismatches\n${mismatches.slice(0, 13).join('\n')}`).toBe('');

    // Coverage of the outcomes the script is meant to reach (set lines without their temp-table suffix).
    const bare = javaOps.map(l => l.replace(/ # tmp .*$/, ''));
    const count = (re: RegExp): number => bare.filter(l => re.test(l)).length;
    const sets = bare.filter((l, i) => script[i].startsWith('get ') && l.startsWith('new set'));
    expect(sets.length).toBeGreaterThan(2650);
    expect(count(/^same$/)).toBeGreaterThan(40);
    expect(bare.filter((l, i) => script[i].startsWith('get ') && l === 'null').length).toBeGreaterThan(3);
    const flaggedLoads = bare.filter((l, i) => /^load 2 1 1 /.test(script[i]) && l.startsWith('set ')).length;
    expect(flaggedLoads).toBeGreaterThan(20);
    expect(bare.filter((l, i) => /^load 2 1 1 /.test(script[i]) && l === 'null').length).toBeGreaterThan(2);
    for (const outcome of ['npe', 'aioobe', 'runtime']) {
        expect(bare.filter((l, i) => script[i].startsWith('frame ') && l.includes(`| ${outcome} |`)).length).toBeGreaterThan(5);
        expect(bare.filter((l, i) => /^(get|load|ctor) /.test(script[i]) && l === outcome).length).toBeGreaterThan(0);
    }
    const acc = bare.filter((_, i) => script[i].startsWith('acc '));
    for (const outcome of ['noset', '00', 'npenpe', 'aioobeaioobe']) expect(acc).toContain(outcome);
    expect(acc.filter(l => l === '01' || l === '10' || l === '11').length).toBeGreaterThan(0);
    expect(count(/tmp a=null/)).toBeGreaterThan(0);
    if (process.env.MODEL_ANIM_STATS) {
        console.log({ ops: script.length, sets: sets.length, same: count(/^same$/), flaggedLoads, frameOps: script.filter(s => s.startsWith('frame ')).length });
    }
}, 600000);
