import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '../../src/cache/Js5.js';
import Js5Compression from '../../src/cache/Js5Compression.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import FaceNormal from '../../src/dash3d/FaceNormal.js';
import ModelLitImpl from '../../src/dash3d/ModelLitImpl.js';
import type ModelSource from '../../src/dash3d/ModelSource.js';
import ModelUnlit from '../../src/dash3d/ModelUnlit.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import PointNormal from '../../src/dash3d/PointNormal.js';
import type TextureProvider from '../../src/dash3d/TextureProvider.js';
import Crc32 from '../../src/io/Crc32.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { withClinitStatics } from './staticState.js';

// The mesh unit (cb ModelUnlit, fa PointNormal, ha FaceNormal, with cb's statics: the G/Y share maps, the V share tic,
// the cb/D sin and cos tables, Load, interpolateHeight and unload) against client.jar, including the three cb -> fc
// lighting entry points (cb.c(IIIII)Lfc; LightImpl, cb.b(IIIII)Lnd; Light and cb.a(III)Lug; light). A seeded script
// runs through test/review/model-mesh/ModelMeshOracle.java (javac'd next to client.jar, driving the real cb/fa/ha/fc
// classes) and through the TS port; every result line must match: the result (ok or the Java exception), any return
// value, and a dump of every instance field of each touched cb (and fc). Every array in a dump carries an identity tag
// numbered in first-dump order, so the sharing between models (copy flags, CopyForShareLight, HillSkewCopy, the arrays
// fc borrows from cb) is compared as well as the contents; arrays are length:hash over every element, and the "full"
// ops print every element. The TS dump also checks each field's runtime type against the Java descriptor ([S is an
// Int16Array, B a value in byte range, ...).
//
// (A) Every one of the 45468 models of archive 7 through ModelUnlit.Load (cb.a(Lal;II)Lcb;) on a real Js5 / al over
// the cache's sector files (the gamepack's own JS5 decompression on the Java side), both decoders and all 353 format,
// flag and texture-type combinations the cache holds; the first two of every combination and every 211th model also
// element by element; Load with a null archive, missing groups and files. (B) Mutated models: footer counts and flags
// (particle/billboard flag, all-255 priorities, texture types 1..3 out of order), body bytes, truncation and a toggled
// 0xFFFF marker, each followed by bounds, normals, lighting and transforms when it decodes. (C) Seeded op sequences on
// 140 models: the copy constructor with all 16 share-flag combinations, Resize/Translate/rotate/Rotate90/180/270/Mirror
// and the three single-axis rotations (in range and out of range), Recolour/Retexture, CalculateNormals,
// CopyForShareLight, mergeNormals (ShareLight) both ways with and without face marking, null/non-cb partners,
// LightImpl/Light/light with seeded ambient, contrast and light vectors (zero contrast, zero and overflowing vectors)
// before and after light sharing, the fc arrays seen through a later cb transform, HillSkewCopy types 0..6 and
// tiltToGround, PrepareAnim/DiscardAnimLabels, bounds and getMinY. (D) The merge constructor over 1..20 models (part
// masks past bit 15, nulls, a null list, a count past the list) followed by lighting; cb(III) with AddPoint/AddFace/
// AddPointFromModel including overflow. (F) Crafted models from a small encoder of both formats: every per-face
// section with values across the byte range (negative priorities, alphas -1/-2, render types 0..3 and -1, labels up to
// 255), materials and texture axes (unavailable textures, axes equal to the face's own vertices past 32767, scaled
// texture types in and out of range of their per-type arrays), every face-index code, smart deltas on the one/two-byte
// bounds, particle trailers, empty models; each lit through the three entry points, light-shared, merged and fitted
// to the small heightmaps; plus mergeNormals with exactly two and three matched vertex pairs. (E) Edges:
// interpolateHeight around every bound of five heightmaps (a null row, a ragged map) and at the int extremes,
// update/draw (empty in cb), unload() and the operations that then fail.
// Sensitivity: each of 30 single-statement mutations of ModelUnlit.ts/PointNormal.ts (bound truncation, aliasing,
// signs, offsets, stream choice, off-by-one) fails this test except normals-zero-length (var15 <= 0 -> < 0), which is
// equivalent: the length is 0 only for a zero vector, whose scaled components are 0 either way.

// [cb field, ModelUnlit property, JVM descriptor] in cb's declaration order (ModelMeshOracle.CB_FIELDS).
const CB_FIELDS: [string, string, string][] = [
    ['j', 'pointPartMask', '[S'],
    ['k', 'maxX', 'S'],
    ['l', 'pointY', '[I'],
    ['m', 'pointX', '[I'],
    ['n', 'textureRotation', '[B'],
    ['o', 'vertexLabel', '[I'],
    ['p', 'faceColour', '[S'],
    ['q', 'contrast', 'S'],
    ['r', 'faceTextureP', '[S'],
    ['s', 'numPoints', 'I'],
    ['t', 'ambient', 'S'],
    ['u', 'faceNormal', '[Lha;'],
    ['v', 'faceAlpha', '[B'],
    ['w', 'maxZ', 'S'],
    ['x', 'facePartMask', '[S'],
    ['y', 'numFaces', 'I'],
    ['z', 'minZ', 'S'],
    ['A', 'textureScaleZ', '[S'],
    ['B', 'faceTextureN', '[S'],
    ['C', 'faceVertexA', '[I'],
    ['E', 'textureType', '[B'],
    ['F', 'faceTextureM', '[S'],
    ['H', 'faceMaterial', '[S'],
    ['I', 'faceVertexC', '[I'],
    ['J', 'pointNormal', '[Lfa;'],
    ['K', 'faceLabel', '[I'],
    ['L', 'faceTextureAxis', '[B'],
    ['M', 'labelVertices', '[[I'],
    ['N', 'faceVertexB', '[I'],
    ['O', 'minX', 'S'],
    ['P', 'textureTransV', '[B'],
    ['Q', 'boundsCalculated', 'Z'],
    ['R', 'numT', 'I'],
    ['S', 'textureScaleY', '[S'],
    ['T', 'pointZ', '[I'],
    ['U', 'faceRenderType', '[B'],
    ['W', 'maxY', 'S'],
    ['X', 'minY', 'S'],
    ['Z', 'textureTransU', '[B'],
    ['ab', 'textureSpeed', '[B'],
    ['bb', 'textureDirection', '[B'],
    ['db', 'facePriority', '[B'],
    ['eb', 'textureScaleX', '[S'],
    ['fb', 'priority', 'B'],
    ['gb', 'labelFaces', '[[I'],
    ['hb', 'sharedPointNormal', '[Lfa;']
];

// [fc field, ModelLitImpl property, JVM descriptor] in fc's declaration order, then nd.j (ModelMeshOracle.FC_FIELDS).
const FC_FIELDS: [string, string, string][] = [
    ['l', 'faceColourA', '[I'],
    ['m', 'relightPending', 'Z'],
    ['n', 'faceTextureM', '[I'],
    ['o', 'maxZ', 'S'],
    ['p', 'minY', 'S'],
    ['q', 'pointY', '[I'],
    ['r', 'faceVertexA', '[I'],
    ['s', 'radiusSphere', 'S'],
    ['t', 'faceColour', '[S'],
    ['u', 'facePartMask', '[S'],
    ['v', 'pointZ', '[I'],
    ['w', 'maxY', 'S'],
    ['x', 'faceTextureAxis', '[B'],
    ['y', 'numFaces', 'I'],
    ['z', 'faceTextureP', '[I'],
    ['A', 'priority', 'B'],
    ['B', 'maxX', 'S'],
    ['C', 'radiusCylinder', 'S'],
    ['D', 'numPoints', 'I'],
    ['E', 'faceMaterial', '[S'],
    ['F', 'numT', 'I'],
    ['G', 'pointPartMask', '[S'],
    ['H', 'faceTextureN', '[I'],
    ['I', 'facePriority', '[B'],
    ['J', 'faceVertexC', '[I'],
    ['K', 'boundsCalculated', 'Z'],
    ['L', 'faceColourC', '[I'],
    ['M', 'faceColourB', '[I'],
    ['N', 'faceVertexB', '[I'],
    ['Q', 'minX', 'S'],
    ['R', 'faceAlpha', '[B'],
    ['S', 'minZ', 'S'],
    ['U', 'pointX', '[I'],
    ['Y', 'labelVertices', '[[I'],
    ['Z', 'labelFaces', '[[I']
];

type Statics = Record<string, unknown>;

// ---- dumps (ModelMeshOracle.value/dump/dumpLit) ----

let ids = new Map<object, number>();

function tag(v: object): string {
    let id = ids.get(v);
    if (id === undefined) {
        id = ids.size;
        ids.set(v, id);
    }
    return `#${id}:`;
}

function hashInts(values: ArrayLike<number>, signedBytes: boolean): number {
    let h = 1;
    for (let i = 0; i < values.length; i++) h = (Math.imul(h, 31) + (signedBytes ? (values[i] << 24) >> 24 : values[i])) | 0;
    return h;
}

function listInts(values: ArrayLike<number>, signedBytes: boolean): string {
    const out: number[] = [];
    for (let i = 0; i < values.length; i++) out.push(signedBytes ? (values[i] << 24) >> 24 : values[i]);
    return `[${out.join(',')}]`;
}

function pointNormalHash(e: PointNormal): number {
    let h = 1;
    h = (Math.imul(h, 31) + e.x) | 0;
    h = (Math.imul(h, 31) + e.y) | 0;
    h = (Math.imul(h, 31) + e.z) | 0;
    return (Math.imul(h, 31) + e.w) | 0;
}

function faceNormalHash(e: FaceNormal): number {
    let h = 1;
    h = (Math.imul(h, 31) + e.x) | 0;
    h = (Math.imul(h, 31) + e.y) | 0;
    return (Math.imul(h, 31) + e.z) | 0;
}

function isInt(v: unknown, lo: number, hi: number): v is number {
    return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi && !Object.is(v, -0);
}

// A field value as the oracle prints it, or a TYPE! marker when the TS value cannot be the Java field's type.
function value(v: unknown, desc: string, full: boolean): string {
    switch (desc) {
        case 'Z':
            return typeof v === 'boolean' ? (v ? '1' : '0') : `TYPE!${String(v)}`;
        case 'I':
            return isInt(v, -0x80000000, 0x7fffffff) ? String(v) : `TYPE!${String(v)}`;
        case 'S':
            return isInt(v, -32768, 32767) ? String(v) : `TYPE!${String(v)}`;
        case 'B':
            return isInt(v, -128, 127) ? String(v) : `TYPE!${String(v)}`;
    }
    if (v === null) return 'null';
    if (desc === '[I' || desc === '[S' || desc === '[B') {
        const ok = desc === '[I' ? v instanceof Int32Array : desc === '[S' ? v instanceof Int16Array : v instanceof Uint8Array;
        if (!ok) return `TYPE!${Object.prototype.toString.call(v)}`;
        const a = v as Int32Array;
        const signed = desc === '[B';
        return tag(a) + (full ? listInts(a, signed) : `${a.length}:${hashInts(a, signed)}`);
    }
    if (!Array.isArray(v)) return `TYPE!${Object.prototype.toString.call(v)}`;
    const t = tag(v);
    if (desc === '[[I') {
        if (!v.every(row => row === null || row instanceof Int32Array)) return 'TYPE![[I';
        const rows = v as (Int32Array | null)[];
        if (full) return `${t}[${rows.map(row => (row === null ? 'null' : listInts(row, false))).join(';')}]`;
        let h = 1;
        for (const row of rows) h = (Math.imul(h, 31) + (row === null ? 0 : (Math.imul(31, row.length) + hashInts(row, false)) | 0)) | 0;
        return `${t}${rows.length}:${h}`;
    }
    if (desc === '[Lfa;') {
        if (!v.every(e => e === null || e instanceof PointNormal)) return 'TYPE![Lfa;';
        const list = v as (PointNormal | null)[];
        if (full) return `${t}[${list.map(e => (e === null ? 'null' : `${e.x},${e.y},${e.z},${e.w}`)).join(';')}]`;
        let h = 1;
        for (const e of list) h = (Math.imul(h, 31) + (e === null ? 0 : pointNormalHash(e))) | 0;
        return `${t}${list.length}:${h}`;
    }
    if (desc === '[Lha;') {
        if (!v.every(e => e === null || e instanceof FaceNormal)) return 'TYPE![Lha;';
        const list = v as (FaceNormal | null)[];
        if (full) return `${t}[${list.map(e => (e === null ? 'null' : `${e.x},${e.y},${e.z}`)).join(';')}]`;
        let h = 1;
        for (const e of list) h = (Math.imul(h, 31) + (e === null ? 0 : faceNormalHash(e))) | 0;
        return `${t}${list.length}:${h}`;
    }
    throw new Error(`descriptor ${desc}`);
}

function dump(model: ModelUnlit | null, full: boolean): string {
    if (model === null) return 'nullmodel';
    const f = model as unknown as Statics;
    return `cb ${CB_FIELDS.map(([obf, name, desc]) => `${obf}=${value(f[name], desc, full)}`).join(' ')}`;
}

function dumpLit(model: ModelSource | null, full: boolean): string {
    if (model === null) return 'nulllit';
    if (!(model instanceof ModelLitImpl)) return `TYPE!${model.constructor.name}`;
    const f = model as unknown as Statics;
    return `fc ${FC_FIELDS.map(([obf, name, desc]) => `${obf}=${value(f[name], desc, full)}`).join(' ')} j=${value(f['useAABBMouseCheck'], 'Z', full)}`;
}

function code(e: unknown): string {
    if (e instanceof RangeError) {
        if (e.message.startsWith('array index') || e.message.startsWith('byte array index')) return 'aioobe';
        if (e.message === '/ by zero') return 'arith';
        if (e.message.startsWith('Invalid typed array length') || e.message.startsWith('Invalid array length') || e.message.startsWith('length cannot be negative') || e.message.startsWith('Requested length is negative')) return 'nase';
    }
    if (e instanceof TypeError) {
        if (e.message.startsWith('ClassCastException')) return 'cce';
        if (e.message === 'Null reference' || e.message === 'Null array' || e.message === 'Null byte array') return 'npe';
    }
    return `error:${String(e)}`;
}

// ---- fixtures shared with the oracle ----

// The oracle's pc: only isAvailable (pc.b(II)Z) is reached by the lighting constructor.
const textures: TextureProvider = {
    getTextureSmall: () => true,
    isAvailable: id => id % 7 !== 3,
    getPixels: () => null,
    isLoaded: () => true,
    getTextureData: () => null,
    getTextureColour: id => (Math.imul(id, 0x1f3d) + 0x123) & 0xffff,
    getTextureSolid: id => (id & 1) === 0
};

// ModelMeshOracle.makeMaps.
function makeMaps(): (Int32Array | null)[][] {
    const map0: Int32Array[] = [];
    const map1: Int32Array[] = [];
    for (let x = 0; x < 104; x++) {
        const row0 = new Int32Array(104);
        const row1 = new Int32Array(104);
        for (let z = 0; z < 104; z++) {
            row0[z] = -((x * 37 + z * 91) % 400) - ((x * z) % 97) * 3;
            row1[z] = -((x * 53 + z * 17) % 700) - 200;
        }
        map0.push(row0);
        map1.push(row1);
    }
    const map2: Int32Array[] = [];
    for (let x = 0; x < 3; x++) map2.push(Int32Array.from({ length: 3 }, (_, z) => -x * 40 - z * 7));
    const map3: (Int32Array | null)[] = [];
    for (let x = 0; x < 8; x++) map3.push(x === 5 ? null : Int32Array.from({ length: 8 }, (_, z) => -x * 9 - z));
    const map4: Int32Array[] = [];
    for (let x = 0; x < 6; x++) map4.push(Int32Array.from({ length: x < 3 ? 6 : 2 }, (_, z) => -x * 31 - z * 5));
    return [map0, map1, map2, map3, map4];
}

// The JS5 container without the two-byte version trailer that the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

// ModelMeshOracle.Provider: archive 7 served from the sector files.
class SectorProvider extends Js5ResourceProvider {
    private readonly table: Js5Index;

    constructor(private readonly archive: number) {
        super();
        const src = container(readGroup(cachePath, 255, archive));
        this.table = new Js5Index(src, Crc32.prefix(src, src.length));
    }

    index(): Js5Index | null {
        return this.table;
    }

    group(_mode: number, group: number): Uint8Array | null {
        return container(readGroup(cachePath, this.archive, group));
    }

    prefetchGroup(_group: number): void {}

    GetGroupLoadPercentage(_group: number): number {
        return 100;
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

// ---- model classification (an independent footer parse; it only steers the script) ----

interface ModelInfo {
    id: number;
    bytes: Uint8Array;
    key: string;
    points: number;
    faces: number;
}

function classify(id: number, b: Uint8Array): ModelInfo {
    const n = b.length;
    const g2 = (p: number): number => (b[p] << 8) | b[p + 1];
    if (b[n - 1] === 255 && b[n - 2] === 255) {
        const p = n - 23;
        const nt = b[p + 4];
        const types = new Set<number>();
        for (let i = 0; i < nt; i++) types.add(b[i]);
        const key = `new f${b[p + 5]} p${b[p + 6] === 255 ? 255 : 'm'} a${b[p + 7]} l${b[p + 8]} t${b[p + 9]} v${b[p + 10]} tt${[...types].sort().join('')}`;
        return { id, bytes: b, key, points: g2(p), faces: g2(p + 2) };
    }
    const p = n - 18;
    const key = `old t${b[p + 4] > 0 ? 1 : 0} x${b[p + 5]} p${b[p + 6] === 255 ? 255 : 'm'} a${b[p + 7]} l${b[p + 8]} v${b[p + 9]}`;
    return { id, bytes: b, key, points: g2(p), faces: g2(p + 2) };
}

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

// ---- crafted models (a model encoder written from the two decoders' layouts; it only builds inputs) ----

class ModelWriter {
    readonly out: number[] = [];

    p1(v: number): void {
        this.out.push(v & 255);
    }

    p2(v: number): void {
        this.p1(v >> 8);
        this.p1(v);
    }

    // gd's signed smart: one byte for -64..63, two for -16384..16383.
    smart(v: number): void {
        if (v >= -64 && v < 64) this.p1(v + 64);
        else this.p2(v + 49152);
    }
}

interface CraftFace {
    a: number;
    b: number;
    c: number;
    colour: number;
    info?: number; // old format: bit 0 flat, bit 1 textured (axis = info >> 2)
    render?: number; // new format render type byte
    priority?: number;
    alpha?: number;
    label?: number;
    material?: number; // new format: stored + 1 (0 = untextured)
    axis?: number; // new format: stored + 1
}

interface CraftTexture {
    type: number;
    p: number;
    m: number;
    n: number;
    sx?: number;
    sy?: number;
    sz?: number;
    rot?: number;
    dir?: number;
    speed?: number;
    u?: number;
    v?: number;
}

interface CraftModel {
    extended: boolean;
    vertices: [number, number, number, number?][];
    faces: CraftFace[];
    textures: CraftTexture[];
    info?: boolean; // old: per-face info byte; new: per-face render types (flags bit 0)
    priority: number; // 255 = per face
    alpha?: boolean;
    faceLabels?: boolean;
    vertexLabels?: boolean;
    textured?: boolean; // new: materials and axes
    particles?: [number, number] | null; // new: the two trailing counts (flags bit 1), each followed by 4 bytes per entry
    codes?: [number, number[]][]; // raw face-index codes instead of type 1 per face
    rawFlags?: number; // new: OR'd into the flags byte
}

function encodeModel(model: CraftModel): Uint8Array {
    const nv = model.vertices.length;
    const nf = model.faces.length;
    const nt = model.textures.length;
    const flagsW = new ModelWriter();
    const xs = new ModelWriter();
    const ys = new ModelWriter();
    const zs = new ModelWriter();
    let px = 0;
    let py = 0;
    let pz = 0;
    for (const [x, y, z] of model.vertices) {
        flagsW.p1((x !== px ? 1 : 0) | (y !== py ? 2 : 0) | (z !== pz ? 4 : 0));
        if (x !== px) xs.smart(x - px);
        if (y !== py) ys.smart(y - py);
        if (z !== pz) zs.smart(z - pz);
        px = x;
        py = y;
        pz = z;
    }
    const types = new ModelWriter();
    const indices = new ModelWriter();
    if (model.codes) {
        for (const [type, deltas] of model.codes) {
            types.p1(type);
            for (const d of deltas) indices.smart(d);
        }
    } else {
        let acc = 0;
        for (const f of model.faces) {
            types.p1(1);
            indices.smart(f.a - acc);
            indices.smart(f.b - f.a);
            indices.smart(f.c - f.b);
            acc = f.c;
        }
    }
    const perFace = (pick: (f: CraftFace) => number): ModelWriter => {
        const w = new ModelWriter();
        for (const f of model.faces) w.p1(pick(f));
        return w;
    };
    const colours = new ModelWriter();
    for (const f of model.faces) colours.p2(f.colour);
    const vlabels = new ModelWriter();
    for (const v of model.vertices) vlabels.p1(v[3] ?? 0);
    const sections: number[][] = [];
    const out = new ModelWriter();
    if (!model.extended) {
        const textures = new ModelWriter();
        for (const t of model.textures) {
            textures.p2(t.p);
            textures.p2(t.m);
            textures.p2(t.n);
        }
        sections.push(flagsW.out, types.out);
        if (model.priority === 255) sections.push(perFace(f => f.priority ?? 0).out);
        if (model.faceLabels) sections.push(perFace(f => f.label ?? 0).out);
        if (model.info) sections.push(perFace(f => f.info ?? 0).out);
        if (model.vertexLabels) sections.push(vlabels.out);
        if (model.alpha) sections.push(perFace(f => f.alpha ?? 0).out);
        sections.push(indices.out, colours.out, textures.out, xs.out, ys.out, zs.out);
        for (const s of sections) out.out.push(...s);
        out.p2(nv);
        out.p2(nf);
        out.p1(nt);
        out.p1(model.info ? 1 : 0);
        out.p1(model.priority);
        out.p1(model.alpha ? 1 : 0);
        out.p1(model.faceLabels ? 1 : 0);
        out.p1(model.vertexLabels ? 1 : 0);
        out.p2(xs.out.length);
        out.p2(ys.out.length);
        out.p2(zs.out.length);
        out.p2(indices.out.length);
        return Uint8Array.from(out.out);
    }
    const typeBytes = new ModelWriter();
    for (const t of model.textures) typeBytes.p1(t.type);
    const materials = new ModelWriter();
    const axes = new ModelWriter();
    for (const f of model.faces) {
        materials.p2(f.material ?? 0);
        if ((f.material ?? 0) !== 0 && nt > 0) axes.p1(f.axis ?? 0);
    }
    const plain = new ModelWriter();
    const scaled = new ModelWriter();
    const scales = new ModelWriter();
    const rot = new ModelWriter();
    const dir = new ModelWriter();
    const speed = new ModelWriter();
    for (const t of model.textures) {
        if (t.type === 0) {
            plain.p2(t.p);
            plain.p2(t.m);
            plain.p2(t.n);
        } else if (t.type >= 1 && t.type <= 3) {
            scaled.p2(t.p);
            scaled.p2(t.m);
            scaled.p2(t.n);
            scales.p2(t.sx ?? 0);
            scales.p2(t.sy ?? 0);
            scales.p2(t.sz ?? 0);
            rot.p1(t.rot ?? 0);
            dir.p1(t.dir ?? 0);
            speed.p1(t.speed ?? 0);
            if (t.type === 2) {
                speed.p1(t.u ?? 0);
                speed.p1(t.v ?? 0);
            }
        }
    }
    const particles = new ModelWriter();
    if (model.particles) {
        for (const count of model.particles) {
            particles.p1(count);
            for (let i = 0; i < count * 4; i++) particles.p1(i * 37 + count);
        }
    }
    sections.push(typeBytes.out, flagsW.out);
    if (model.info) sections.push(perFace(f => f.render ?? 0).out);
    sections.push(types.out);
    if (model.priority === 255) sections.push(perFace(f => f.priority ?? 0).out);
    if (model.faceLabels) sections.push(perFace(f => f.label ?? 0).out);
    if (model.vertexLabels) sections.push(vlabels.out);
    if (model.alpha) sections.push(perFace(f => f.alpha ?? 0).out);
    sections.push(indices.out);
    if (model.textured) sections.push(materials.out);
    sections.push(model.textured ? axes.out : [], colours.out, xs.out, ys.out, zs.out, plain.out, scaled.out, scales.out, rot.out, dir.out, speed.out, particles.out);
    for (const s of sections) out.out.push(...s);
    out.p2(nv);
    out.p2(nf);
    out.p1(nt);
    out.p1((model.info ? 1 : 0) | (model.particles ? 2 : 0) | (model.rawFlags ?? 0));
    out.p1(model.priority);
    out.p1(model.alpha ? 1 : 0);
    out.p1(model.faceLabels ? 1 : 0);
    out.p1(model.textured ? 1 : 0);
    out.p1(model.vertexLabels ? 1 : 0);
    out.p2(xs.out.length);
    out.p2(ys.out.length);
    out.p2(zs.out.length);
    out.p2(indices.out.length);
    out.p2(model.textured ? axes.out.length : 0);
    out.p1(255);
    out.p1(255);
    return Uint8Array.from(out.out);
}

// A closed 12-vertex, 20-face shape (an icosahedron-ish ring) whose faces the crafted models decorate.
function craftedBase(): { vertices: [number, number, number, number?][]; faces: [number, number, number][] } {
    const vertices: [number, number, number, number?][] = [[0, -120, 0, 0]];
    for (let i = 0; i < 5; i++) vertices.push([Math.round(100 * Math.cos((i * 2 * Math.PI) / 5)), -50, Math.round(100 * Math.sin((i * 2 * Math.PI) / 5)), 1 + i]);
    for (let i = 0; i < 5; i++) vertices.push([Math.round(100 * Math.cos(((i + 0.5) * 2 * Math.PI) / 5)), 50, Math.round(100 * Math.sin(((i + 0.5) * 2 * Math.PI) / 5)), 6 + (i % 3)]);
    vertices.push([0, 120, 0, 255]);
    const faces: [number, number, number][] = [];
    for (let i = 0; i < 5; i++) faces.push([0, 1 + ((i + 1) % 5), 1 + i]);
    for (let i = 0; i < 5; i++) {
        faces.push([1 + i, 1 + ((i + 1) % 5), 6 + i]);
        faces.push([1 + ((i + 1) % 5), 6 + ((i + 1) % 5), 6 + i]);
    }
    for (let i = 0; i < 5; i++) faces.push([11, 6 + i, 6 + ((i + 1) % 5)]);
    return { vertices, faces };
}

function craftedModels(): { name: string; bytes: Uint8Array }[] {
    const base = craftedBase();
    const out: { name: string; bytes: Uint8Array }[] = [];
    const faces = (decorate: (i: number) => Partial<CraftFace>): CraftFace[] => base.faces.map(([a, b, c], i) => ({ a, b, c, colour: (i * 3001 + 977) & 0xffff, ...decorate(i) }));

    // Old format, every per-face section: flat, textured (axes 0..2 and an out-of-range one), material ids from the
    // colour (65535 = -1, >= 32768 negative, id % 7 == 3 unavailable to the lighting), per-face priorities and alphas
    // across the byte range (-1 and -2 select lighting types 2 and 3), labels up to 255.
    out.push({
        name: 'old-all',
        bytes: encodeModel({
            extended: false,
            vertices: base.vertices,
            faces: faces(i => ({
                info: [0, 1, 2, 3, 6, 7, 10, 0, 2, 4, 1, 0, 3, 2, 0, 6, 2, 0, 1, 2][i],
                colour: [9, 65535, 40000, 3, 10, 17, 65535, 1, 24, 2, 5, 31, 1000, 31, 8, 3, 0, 4, 9, 65535][i],
                priority: [0, 1, 2, 10, 11, 127, 128, 200, 255, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1][i],
                alpha: [0, 255, 254, 128, 1, 0, 0, 255, 254, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 254][i],
                label: (i * 13) & 255
            })),
            textures: [
                { type: 0, p: 0, m: 1, n: 2 },
                { type: 0, p: 1, m: 6, n: 7 },
                { type: 0, p: 11, m: 6, n: 7 }
            ],
            info: true,
            priority: 255,
            alpha: true,
            faceLabels: true,
            vertexLabels: true
        })
    });
    // Old format, model-wide priority 200 (a negative byte), textured faces whose texture axis is the face's own
    // vertices (dropped to -1, then the whole axis array nulled) and whose materials are all -1 (faceMaterial nulled).
    out.push({
        name: 'old-own-axes',
        bytes: encodeModel({
            extended: false,
            vertices: base.vertices,
            faces: faces(i => (i === 0 ? { info: 2, colour: 65535 } : {})),
            textures: [{ type: 0, p: base.faces[0][0], m: base.faces[0][1], n: base.faces[0][2] }],
            info: true,
            priority: 200
        })
    });
    // Old format, texture axes and face vertices past 32767 (the & 0xffff of the axis test): face 1 is textured with
    // axis 0 = its own vertices 40000..40002, face 2 with axis 1 = vertices it does not use.
    for (const [name, second] of [
        ['old-high-axes', [40000, 40001, 40002]],
        ['old-high-axes-differ', [40000, 40001, 40003]]
    ] as [string, number[]][]) {
        out.push({
            name,
            bytes: encodeModel({
                extended: false,
                vertices: [
                    [0, 0, 0],
                    [10, 0, 0],
                    [0, 0, 10]
                ],
                faces: [
                    { a: 16000, b: 32000, c: 40000, colour: 5 },
                    { a: 40000, b: 40001, c: 40002, colour: 300, info: 2 },
                    { a: 40000, b: 40001, c: 40002, colour: 301, info: 6 }
                ],
                textures: [
                    { type: 0, p: 40000, m: 40001, n: 40002 },
                    { type: 0, p: second[0], m: second[1], n: second[2] }
                ],
                info: true,
                priority: 3
            })
        });
    }
    // Old format, face-index codes 1..4, an unknown code (0 and 7 leave the face's indices at 0) and smart deltas
    // at the one/two-byte boundaries.
    out.push({
        name: 'old-codes',
        bytes: encodeModel({
            extended: false,
            vertices: [
                [-64, 63, -16384],
                [16383, -16384, 64],
                [0, 0, 0],
                [-65, 64, 1],
                [1, 2, 3],
                [4, 5, 6]
            ],
            faces: Array.from({ length: 8 }, (_, i) => ({ a: 0, b: 0, c: 0, colour: i * 11 })),
            textures: [],
            priority: 0,
            codes: [
                [1, [0, 1, 1]],
                [2, [1]],
                [3, [1]],
                [4, [1]],
                [0, []],
                [7, []],
                [4, [-3]],
                [1, [63, -64, 16383]]
            ]
        })
    });

    // New format, every section: render types 0..3 and 255 (-1), per-face priorities, alphas, labels, materials (0 =
    // untextured, id % 7 == 3 unavailable to the lighting), texture axes 0 (= none), type-0 and scaled axes, vertex
    // labels up to 255. The scaled-type arrays are sized by the count of types 1..3 and the trans arrays by the count of
    // type 2 but indexed by the texture index, so the type order decides whether the jar decodes the model: type 2
    // first decodes, a type 0 or 1 before a scaled type overruns them.
    const texturedFaces = faces(i => ({
        render: [0, 1, 2, 3, 255, 0, 1, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 1, 0][i],
        priority: [0, 1, 2, 10, 11, 127, 128, 200, 255, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1][i],
        alpha: [0, 255, 254, 128, 1, 0, 0, 255, 254, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 254][i],
        label: (i * 29) & 255,
        material: [0, 5, 4, 11, 0, 18, 25, 1, 2, 0, 3, 46, 0, 8, 9, 0, 32, 0, 15, 22][i],
        axis: [0, 1, 2, 3, 4, 0, 1, 1, 2, 0, 3, 4, 0, 1, 0, 0, 2, 0, 1, 4][i]
    }));
    const scaledTextures = (types: number[]): CraftTexture[] =>
        types.map((type, i) => ({ type, p: (i * 3) % 12, m: (i * 3 + 1) % 12, n: (i * 3 + 2) % 12, sx: 100 + i, sy: 200 + i, sz: 65535 - i, rot: 250 - i, dir: 128 + i, speed: 3 + i, u: 255 - i, v: 64 + i }));
    for (const [name, types] of [
        ['new-2130', [2, 1, 3, 0]],
        ['new-22130', [2, 2, 1, 3, 0]],
        ['new-2000', [2, 0, 0, 0]],
        ['new-0000', [0, 0, 0, 0]],
        ['new-7000', [7, 0, 0, 0]],
        ['new-0123', [0, 1, 2, 3]],
        ['new-1230', [1, 2, 3, 0]],
        ['new-01', [0, 1]],
        ['new-12', [1, 2]]
    ] as [string, number[]][]) {
        out.push({
            name,
            bytes: encodeModel({
                extended: true,
                vertices: base.vertices,
                faces: texturedFaces,
                textures: scaledTextures(types),
                info: true,
                priority: 255,
                alpha: true,
                faceLabels: true,
                vertexLabels: true,
                textured: true
            })
        });
    }
    // New format: materials without texture axes (no axes section when there are no textures), a model-wide priority
    // past 127, and the particle/billboard trailer (counts 2 and 1 present, zero counts, and the flag without a trailer:
    // the counts are then read from the footer and the skips land past the data without reading it).
    out.push({
        name: 'new-materials-no-axes',
        bytes: encodeModel({ extended: true, vertices: base.vertices, faces: texturedFaces, textures: [], info: true, priority: 130, textured: true })
    });
    for (const [name, particles] of [
        ['new-particles', [2, 1]],
        ['new-particles-zero', [0, 0]],
        ['new-particles-short', null]
    ] as [string, [number, number] | null][]) {
        out.push({
            name,
            bytes: encodeModel({ extended: true, vertices: base.vertices, faces: faces(() => ({})), textures: [], priority: 4, particles, rawFlags: particles === null ? 2 : 0 })
        });
    }
    // New format face-index codes and an empty model of each format.
    out.push({
        name: 'new-codes',
        bytes: encodeModel({
            extended: true,
            vertices: base.vertices,
            faces: Array.from({ length: 6 }, (_, i) => ({ a: 0, b: 0, c: 0, colour: i })),
            textures: [],
            priority: 0,
            codes: [
                [1, [11, -5, 3]],
                [2, [2]],
                [3, [-1]],
                [4, [4]],
                [9, []],
                [2, [1]]
            ]
        })
    });
    out.push({ name: 'old-empty', bytes: encodeModel({ extended: false, vertices: [], faces: [], textures: [], priority: 0 }) });
    out.push({ name: 'new-empty', bytes: encodeModel({ extended: true, vertices: [], faces: [], textures: [], priority: 0 }) });
    return out;
}

// ---- the script ----

function generate(infos: ModelInfo[]): string[] {
    const next = rng(0x6d657368);
    const below = (n: number): number => (next() >>> 0) % n;
    const between = (lo: number, hi: number): number => lo + below(hi - lo + 1);
    const pick = <T>(list: T[]): T => list[below(list.length)];
    const s: string[] = [];

    s.push('tables');

    // (A) Load every model; element-wise dumps for the first two of each combination and every 211th.
    const seen = new Map<string, number>();
    for (let i = 0; i < infos.length; i++) {
        const info = infos[i];
        if (i % 64 === 0) s.push('ids');
        s.push(`load 0 0 ${info.id} 0`);
        const count = seen.get(info.key) ?? 0;
        seen.set(info.key, count + 1);
        if ((count < 2 || i % 211 === 0) && info.bytes.length < 40000) s.push('full 0');
    }
    s.push('ids', 'load 0 -9 0 0', 'load 0 0 45468 0', 'load 0 0 65535 0', 'load 0 0 -1 0', 'load 0 0 0 1', 'load 0 0 7 -1', 'load 0 0 100 0', 'full 0');

    // Small models of every combination for the mutation and merge sections.
    const byKey = new Map<string, ModelInfo[]>();
    for (const info of infos) {
        if (info.faces === 0 || info.bytes.length > 2500) continue;
        const list = byKey.get(info.key) ?? [];
        list.push(info);
        byKey.set(info.key, list);
    }
    const small: ModelInfo[] = [];
    for (const list of byKey.values()) small.push(list[0]);
    for (let i = 0; i < 120; i++) small.push(pick(pick([...byKey.values()])));

    // (B) Mutated models.
    const light = (lit: number, slot: number): string => `lit ${lit} ${slot} ${between(-40, 140)} ${between(200, 1600)} ${between(-200, 200)} ${between(-200, 200)} ${between(-200, 200)}`;
    for (const info of small) {
        const b = info.bytes;
        const n = b.length;
        const extended = b[n - 1] === 255 && b[n - 2] === 255;
        const footer = extended ? n - 23 : n - 18;
        const mutants: Uint8Array[] = [];
        for (let k = 0; k < 7; k++) {
            let m = Uint8Array.from(b);
            switch (k) {
                case 0:
                case 1: {
                    // A count or flag byte of the footer.
                    const off = footer + between(4, extended ? 12 : 10);
                    m[off] = pick([0, 1, 2, 3, 255, below(256), m[off] ^ 1, m[off] ^ 2]);
                    break;
                }
                case 2: {
                    // A vertex or face count.
                    const off = footer + pick([1, 3]);
                    m[off] = (m[off] + pick([1, -1, 2, -2])) & 255;
                    break;
                }
                case 3:
                case 4:
                    // A body byte.
                    m[below(footer)] = below(256);
                    break;
                case 5:
                    if (extended) {
                        // Every texture type set to 1..3 (or to 0), out of order with the counts.
                        for (let t = 0; t < m[footer + 4]; t++) m[t] = pick([0, 1, 2, 3]);
                        m[footer + 5] |= below(2) === 0 ? 2 : 0;
                    } else {
                        m[n - 1] = 255;
                        m[n - 2] = 255;
                    }
                    break;
                default:
                    // Truncated or with the particle flag on.
                    if (extended && below(2) === 0) m[footer + 5] |= 2;
                    else m = m.subarray(between(1, 4));
                    break;
            }
            mutants.push(m);
        }
        for (const m of mutants) {
            s.push('ids', `dec 1 ${hex(m)}`);
            let model: ModelUnlit | null = null;
            try {
                model = new ModelUnlit(m);
            } catch {
                // The oracle reports the same exception.
            }
            if (model === null || model.numPoints > 4000 || model.numFaces > 4000) continue;
            s.push('bounds 1', 'miny 1', 'copy 2 1 0 0 0 0', `rotate 2 ${below(2048)} ${below(2048)} ${below(2048)}`, 'normals 2', 'share-normals 1 2 0 0 0 1');
            s.push(light(0, 1), 'setamb 2 64 768', 'litsrc 1 2 -50 -10 -50', 'prepare 1', 'discard 2', 'merge 3 0 2 1 2', 'normals 3', light(2, 3));
            if (below(4) === 0) s.push('full 1', 'fulllit 0');
        }
    }

    // (C) Op sequences on decoded models.
    const seqModels = infos.filter(info => info.faces > 0 && info.faces <= 2500);
    const chosen: ModelInfo[] = [];
    const keys = [...new Set(seqModels.map(info => info.key))];
    for (let i = 0; i < 140; i++) {
        const key = keys[i % keys.length];
        const candidates = seqModels.filter(info => info.key === key);
        chosen.push(i < keys.length ? candidates[0] : pick(i % 3 === 0 ? candidates : seqModels));
    }
    let ring = 0;
    chosen.forEach((info, k) => {
        const model = new ModelUnlit(info.bytes);
        const colour = model.faceColour !== null && model.faceColour.length > 0 ? model.faceColour[below(model.faceColour.length)] : 100;
        const material = model.faceMaterial !== null && model.faceMaterial.length > 0 ? model.faceMaterial[below(model.faceMaterial.length)] : 1;
        const flags = (k % 16).toString(2).padStart(4, '0').split('').join(' ');
        const angle = (): number => (below(25) === 0 ? pick([-1, 2048, 4096, -2048]) : below(2048));
        s.push('ids', `load 0 0 ${info.id} 0`, 'unlit 0', 'miny 0', 'copy 4 0 1 1 1 1', 'discard 4', 'dump 0', `copy 1 0 ${flags}`);
        s.push(`resize 1 ${pick([96 + below(64), 128, 0, -128, 65536 * 3 + below(1000)])} ${100 + below(100)} ${64 + below(128)}`, 'dump 0');
        s.push(`recolour 1 ${colour} ${below(65536) - 32768}`, 'dump 0', `retexture 1 ${material} ${below(200) - 1}`, `retexture 1 -1 ${below(100)}`, 'dump 0');
        s.push(`rotate 1 ${angle()} ${angle()} ${angle()}`, `rotate 1 0 ${angle()} 0`, 'rotate 1 0 0 0', `roty 1 ${angle()}`, `rotx 1 ${angle()}`, `rotz 1 ${angle()}`);
        s.push('rot90 1', 'rot180 1', 'rot270 1', 'mirror 1', `translate 1 ${below(512) - 256} ${below(512) - 256} ${below(512) - 256}`, 'dump 0');
        s.push('share-normals 1 0 0 0 0 1', 'normals 1', 'normals 1', 'share 2 1', 'share-normals 1 2 0 0 0 1', 'share-normals 2 1 128 0 0 0', 'share-normals 2 0 0 0 0 1');
        // Lighting: LightImpl (cb.c), Light (cb.b) and light (cb.a(III), with the ambient/contrast LocType stores).
        const amb = between(-60, 160);
        const con = below(20) === 0 ? 0 : between(100, 2400);
        const vec = (): string => {
            const r = below(20);
            if (r === 0) return '0 0 0';
            if (r === 1) return `${between(40000, 60000)} ${between(40000, 60000)} ${between(-60000, -40000)}`;
            return `${between(-300, 300)} ${between(-300, 300)} ${between(-300, 300)}`;
        };
        s.push(`lit 0 1 ${amb} ${con} ${vec()}`, `litnd 1 2 ${amb} ${between(100, 2400)} ${vec()}`, `setamb 1 ${between(-60, 160)} ${pick([0, 768, between(100, 2400)])}`, `litsrc 2 1 ${vec()}`);
        s.push(`translate 1 ${below(64)} 0 ${below(64)}`, 'dumplit 0', 'dumplit 2', 'recolour 1 0 0', 'dumplit 1');
        s.push('copy 3 0 1 1 1 1', 'translate 3 128 0 0', 'normals 3', 'normals 0', 'share-normals 0 3 -128 0 0 1', 'share-normals 3 0 128 0 0 1');
        s.push(`lit 3 0 ${amb} ${between(100, 2400)} -50 -10 -50`, `lit 4 3 ${amb} ${between(100, 2400)} 30 -40 20`, 'share-normals 0 -1 0 0 0 1', 'share-normals 0 -5 0 0 0 1');
        if (k % 9 === 0) s.push('full 3', 'fulllit 3');
        // HillSkewCopy: type, param, maps, position, copy, drop.
        const x = 1024 + below(10000);
        const z = 1024 + below(10000);
        for (const [type, param, a, b] of [
            [0, 0, 0, 1],
            [1, 0, 0, 1],
            [2, 340, 0, 1],
            [2, 0, 0, 1],
            [3, below(65536), 0, 1],
            [4, 0, 0, 1],
            [4, 0, 0, -1],
            [5, 0, 0, 1],
            [5, 0, 0, -1],
            [6, 0, 0, 1],
            [1, 0, 2, 2],
            [5, 0, 2, 1],
            [1, 0, 3, 3],
            [4, 0, 0, 4]
        ]) {
            s.push('copy 5 0 1 1 1 1', `hill 6 5 ${type} ${param} ${a} ${b} ${x} ${below(400) - 200} ${z} ${below(2)} ${below(2)}`);
        }
        s.push('copy 5 0 1 1 1 1', 'hill 6 5 1 0 0 1 64 0 64 1 1', 'hill 6 5 1 0 0 1 -200 0 300 1 1', 'hill 6 5 1 0 0 1 13300 0 6000 0 0', 'hill 6 5 1 0 1 0 13000 0 13000 1 0');
        s.push('copy 7 0 0 1 1 1', `tilt 7 0 ${x} ${below(100)} ${z} ${below(1024)} ${below(1024)}`, 'tilt 7 2 300 0 300 64 64', 'bounds 7', 'miny 7', `lit 5 7 ${amb} 900 -50 -10 -50`);
        s.push('prepare 0', 'prepare 0', 'discard 0', 'bounds 0', 'miny 0', 'update 0 1 2 3 4 5', 'draw 0 1 2 3 4 5 6 7 8 9 10');

        s.push(`load ${10 + ring} 0 ${info.id} 0`);
        ring = (ring + 1) % 3;
        if (k >= 3) {
            s.push('merge 8 0 3 10 11 12', 'merge 8 0 4 10 -1 11 12', 'merge 8 0 2 12 10', 'merge 8 0 4 10 11', 'merge 8 0 0');
            s.push('normals 8', 'prepare 8', 'miny 8', `lit 6 8 ${amb} 1100 -30 -50 -30`, 'sizes 9 64 32 4', `addfrom 9 10 0 ${below(65536) - 32768}`, 'addfrom 9 11 1 1', 'addfrom 9 11 1 1');
        }
    });

    // (D) Merges of 1..20 small models (part masks past bit 15), then lighting.
    s.push('ids');
    for (let i = 0; i < 20; i++) s.push(`load ${10 + i} 0 ${pick(small).id} 0`);
    for (let count = 1; count <= 20; count++) {
        const members = Array.from({ length: count }, () => (below(12) === 0 ? -1 : 10 + below(20)));
        s.push('ids', `merge 8 0 ${count} ${members.join(' ')}`, 'normals 8', 'lit 0 8 64 768 -50 -10 -50', 'full 8', 'fulllit 0');
    }
    s.push('merge 8 0 3 10 11', 'merge 8 -9 0', 'merge 8 -9 1', 'merge 8 0 1 -1', 'full 8', 'lit 0 8 64 768 -50 -10 -50', 'merge 8 0 2 10 9', 'full 8');
    // cb(III), AddPoint/AddFace/AddPointFromModel (with overflow) and lighting of the result.
    s.push('ids', 'sizes 9 4 3 2', 'addpoint 9 1 2 3', 'addpoint 9 1 2 3', 'addpoint 9 -5 0 9', 'addface 9 0 1 0 1 -3 200', 'addface 9 1 0 1 0 32767 -1');
    s.push('addpoint 9 7 7 7', 'addpoint 9 8 8 8', 'addpoint 9 9 9 9', 'addface 9 0 1 2 0 5 5', 'addface 9 0 1 2 0 5 5', 'normals 9', 'prepare 9', 'full 9');
    s.push('lit 0 9 64 768 -50 -10 -50', 'fulllit 0', 'merge 8 0 3 9 10 9', 'full 8', 'lit 1 8 64 768 -50 -10 -50', 'fulllit 1');
    s.push('sizes 9 -1 2 0', 'sizes 9 2 -1 0', 'sizes 9 0 0 3', 'bounds 9', 'miny 9', 'lit 0 9 64 768 1 2 3', 'sizes 9 0 0 -1', 'full 9');
    s.push('sizes 9 3 1 0', 'addpoint 9 0 0 0', 'addpoint 9 100 0 0', 'addpoint 9 0 0 100', 'addface 9 0 1 2 1 1000 0', 'normals 9', 'lit 0 9 64 768 -50 -10 -50', 'fulllit 0', 'full 9');
    s.push('nullbytes 9', 'dec 9 00', 'dec 9 ffff', 'dec 9 ffffff', 'dec 9', 'copy 9 -1 0 0 0 0', 'empty 9', 'miny 9', 'unlit 9', 'normals 9', 'prepare 9', 'lit 0 9 64 768 -50 -10 -50', 'full 9', 'fulllit 0');
    s.push('empty 9', 'addpoint 9 1 1 1', 'addface 9 0 0 0 0 0 0', 'addfrom 9 10 0 1', 'addfrom 10 9 0 1', 'share 9 9', 'copy 9 9 0 0 0 0', 'hill 6 9 1 0 0 1 64 0 64 1 1');

    // (F) Crafted models (both formats, every per-face section, texture axes past 32767, texture types in and out of
    // the per-type arrays, face-index codes, particle trailers), each decoded, normalled, copied, light-shared, merged,
    // lit through all three entry points and fitted to the small heightmaps.
    for (const { bytes } of craftedModels()) {
        s.push('ids', `dec 1 ${hex(bytes)}`, 'full 1', 'copy 7 1 1 1 1 1', 'discard 7', 'prepare 7', 'full 7', 'bounds 1', 'miny 1', 'normals 1', 'full 1', 'copy 2 1 0 0 0 0', 'lit 0 1 64 768 -50 -10 -50', 'full 1', 'fulllit 0');
        s.push('litnd 1 2 30 900 40 -60 20', 'fulllit 1', 'full 2', 'share 3 2', 'share-normals 2 3 0 0 0 1', 'lit 2 3 64 768 -50 -10 -50', 'fulllit 2', 'full 3');
        s.push('merge 4 0 3 1 2 1', 'full 4', 'setamb 4 -20 1200', 'litsrc 3 4 10 -90 30', 'fulllit 3', `rotate 1 ${below(2048)} ${below(2048)} ${below(2048)}`, 'mirror 1', 'full 1');
        for (const [type, mapA, mapB, x, z] of [
            [1, 2, 2, 130, 130],
            [2, 2, 2, 140, 120],
            [4, 2, 4, 130, 130],
            [5, 2, 4, 128, 128],
            [1, 3, 3, 300, 300],
            [1, 3, 3, 500, 300],
            [5, 4, 4, 300, 130],
            [3, 2, 2, 150, 150]
        ]) {
            s.push('copy 5 1 1 1 1 1', `hill 6 5 ${type} ${type === 3 ? 0x2020 : 60} ${mapA} ${mapB} ${x} ${below(40) - 20} ${z} ${below(2)} 1`, 'full 6');
        }
    }
    // mergeNormals marks shared faces only from three matched vertex pairs: two (and then three) vertices collapsed
    // onto one point by Resize, with a degenerate face over them.
    for (const points of [4, 5]) {
        s.push('ids', `sizes 12 ${points} 3 0`, 'addpoint 12 0 0 0', 'addpoint 12 1 0 0', 'addpoint 12 0 0 100', 'addpoint 12 0 100 0');
        if (points === 5) s.push('addpoint 12 2 0 0');
        s.push('addface 12 0 2 3 0 100 0', 'addface 12 1 3 2 0 100 0', `addface 12 0 1 ${points === 5 ? 4 : 0} 0 100 0`, 'resize 12 0 128 128', 'normals 12', 'copy 14 12 0 0 0 0', 'normals 14');
        s.push('sizes 13 3 1 0', 'addpoint 13 0 0 0', 'addpoint 13 0 50 0', 'addpoint 13 0 0 50', 'addface 13 0 1 2 0 5 0', 'copy 15 13 0 0 0 0');
        s.push('share-normals 12 13 0 0 0 1', 'full 12', 'full 13', 'share-normals 14 15 0 0 0 0', 'full 14', 'full 15', 'lit 0 12 64 768 -50 -10 -50', 'fulllit 0');
    }

    // (E) interpolateHeight on and off every heightmap (each bound and its neighbours), the cb no-op overrides, and
    // unload().
    const mapSizes = [
        [104, 104],
        [104, 104],
        [3, 3],
        [8, 8],
        [6, 6]
    ];
    for (const map of [0, 1, 2, 3, 4, -1]) {
        const [w, h] = map < 0 ? [2, 2] : mapSizes[map];
        const edges = (size: number): number[] => [-129, -128, -1, 0, 1, 127, 128, 129, size * 64, (size - 1) * 128 - 1, (size - 1) * 128, (size - 1) * 128 + 1, size * 128 - 1, size * 128, size * 128 + 1];
        for (const px of edges(w)) for (const pz of edges(h)) s.push(`interp ${map} ${px} ${pz}`);
        for (const [px, pz] of [
            [6000, 6000],
            [383, 300],
            [640, 640],
            [700, 100],
            [100, 700],
            [400, 200],
            [-0x80000000, 0],
            [0x7fffffff, 0x7fffffff]
        ])
            s.push(`interp ${map} ${px} ${pz}`);
    }
    s.push('ids', `load 0 0 ${chosen[0].id} 0`, 'copy 1 0 0 0 0 0', 'normals 1', 'share-normals 1 0 0 0 0 1', 'share-normals 0 -1 0 0 0 1', 'unload', 'tables');
    s.push('roty 0 5', 'rotx 0 5', 'rotz 0 5', 'rotate 0 1 1 1', 'rotate 0 0 0 0', 'normals 1', 'share-normals 1 1 0 0 0 1', 'share-normals 1 0 0 0 0 1', 'tilt 0 0 600 0 600 64 64', 'unload');
    return s;
}

// ---- the TS side ----

function runTs(script: string[], models: Js5): string[] {
    const statics = ModelUnlit as unknown as Statics;
    const maps = makeMaps();
    const map = (i: number): (Int32Array | null)[] | null => (i < 0 ? null : maps[i]);
    const slots: (ModelUnlit | null)[] = new Array<ModelUnlit | null>(32).fill(null);
    const lit: (ModelSource | null)[] = new Array<ModelSource | null>(8).fill(null);
    const at = (i: number): ModelUnlit => requireNonNull(slots[i]);
    const priv = (i: number): Record<string, (...args: unknown[]) => unknown> => at(i) as unknown as Record<string, (...args: unknown[]) => unknown>;
    const shareStatics = (): string => ` G=${value(statics['shareMap'], '[I', false)} V=${String(statics['shareTic'])} Y=${value(statics['shareMap2'], '[I', false)}`;
    const short = (v: number): number => (v << 16) >> 16;
    const byte = (v: number): number => (v << 24) >> 24;
    const out: string[] = [];
    ids = new Map();
    for (const line of script) {
        const a = line.split(' ');
        const op = a[0];
        const n = a.map((t, i) => (i === 0 || (op === 'dec' && i === 2) ? 0 : Number(t)));
        let result = 'ok';
        let extra = '';
        let show: number[] = [];
        let showLit: number[] = [];
        let full = false;
        try {
            switch (op) {
                case 'ids':
                    ids = new Map();
                    break;
                case 'tables': {
                    const sin = requireNonNull(statics['sin'] as Int32Array | null);
                    const cos = requireNonNull(statics['cos'] as Int32Array | null);
                    extra = ` ${sin.length}:${hashInts(sin, false)} ${cos.length}:${hashInts(cos, false)}`;
                    break;
                }
                case 'load':
                    show = [n[1]];
                    slots[n[1]] = null;
                    slots[n[1]] = ModelUnlit.Load(n[2] === -9 ? null : models, n[3], n[4]);
                    break;
                case 'dec':
                    show = [n[1]];
                    slots[n[1]] = null;
                    slots[n[1]] = new ModelUnlit(a.length < 3 ? new Uint8Array(0) : Uint8Array.from(Buffer.from(a[2], 'hex')));
                    break;
                case 'nullbytes':
                    show = [n[1]];
                    slots[n[1]] = null;
                    slots[n[1]] = new ModelUnlit(null);
                    break;
                case 'empty':
                    show = [n[1]];
                    slots[n[1]] = new ModelUnlit();
                    break;
                case 'sizes':
                    show = [n[1]];
                    slots[n[1]] = null;
                    slots[n[1]] = new ModelUnlit(n[2], n[3], n[4]);
                    break;
                case 'copy':
                    show = [n[1], n[2]];
                    slots[n[1]] = new ModelUnlit(n[2] < 0 ? null : slots[n[2]], n[3] !== 0, n[4] !== 0, n[5] !== 0, n[6] !== 0);
                    break;
                case 'merge': {
                    show = [n[1]];
                    const list = n[2] === -9 ? null : n.slice(4).map(v => (v < 0 ? null : slots[v]));
                    slots[n[1]] = null;
                    slots[n[1]] = new ModelUnlit(list, n[3]);
                    break;
                }
                case 'share':
                    show = [n[1], n[2]];
                    slots[n[1]] = at(n[2]).CopyForShareLight();
                    break;
                case 'resize':
                    show = [n[1]];
                    at(n[1]).Resize(n[2], n[3], n[4]);
                    break;
                case 'translate':
                    show = [n[1]];
                    at(n[1]).Translate(n[2], n[3], n[4]);
                    break;
                case 'rotate':
                    show = [n[1]];
                    at(n[1]).rotate(n[2], n[3], n[4]);
                    break;
                case 'rot90':
                    show = [n[1]];
                    at(n[1]).Rotate90();
                    break;
                case 'rot180':
                    show = [n[1]];
                    at(n[1]).Rotate180();
                    break;
                case 'rot270':
                    show = [n[1]];
                    at(n[1]).Rotate270();
                    break;
                case 'mirror':
                    show = [n[1]];
                    at(n[1]).Mirror();
                    break;
                case 'roty':
                    show = [n[1]];
                    at(n[1]).RotateYAxis(n[2]);
                    break;
                case 'rotx':
                    show = [n[1]];
                    priv(n[1])['RotateXAxis'].call(at(n[1]), n[2]);
                    break;
                case 'rotz':
                    show = [n[1]];
                    priv(n[1])['rotateZAxis'].call(at(n[1]), n[2]);
                    break;
                case 'recolour':
                    show = [n[1]];
                    at(n[1]).Recolour(short(n[2]), short(n[3]));
                    break;
                case 'retexture':
                    show = [n[1]];
                    at(n[1]).Retexture(short(n[2]), short(n[3]));
                    break;
                case 'normals':
                    show = [n[1]];
                    at(n[1]).CalculateNormals();
                    break;
                case 'prepare':
                    show = [n[1]];
                    at(n[1]).PrepareAnim();
                    break;
                case 'discard':
                    show = [n[1]];
                    at(n[1]).DiscardAnimLabels();
                    break;
                case 'bounds':
                    show = [n[1]];
                    priv(n[1])['CalcBoundingCube'].call(at(n[1]));
                    break;
                case 'miny':
                    show = [n[1]];
                    extra = ` ${at(n[1]).getMinY()}`;
                    break;
                case 'unlit':
                    extra = ` ${at(n[1]).isUnlit()}`;
                    break;
                case 'update':
                    show = [n[1]];
                    at(n[1]).update(n[2], n[3], n[4], n[5], n[6]);
                    break;
                case 'draw':
                    show = [n[1]];
                    at(n[1]).draw(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], BigInt(n[10]), n[11], null);
                    break;
                case 'addpoint':
                    show = [n[1]];
                    extra = ` ${at(n[1]).AddPoint(n[2], n[3], n[4])}`;
                    break;
                case 'addface':
                    show = [n[1]];
                    extra = ` ${at(n[1]).AddFace(n[2], n[3], n[4], byte(n[5]), short(n[6]), byte(n[7]))}`;
                    break;
                case 'addfrom':
                    show = [n[1]];
                    extra = ` ${String(priv(n[1])['AddPointFromModel'].call(at(n[1]), n[2] < 0 ? null : slots[n[2]], n[3], short(n[4])))}`;
                    break;
                case 'hill': {
                    show = [n[1], n[2]];
                    const r = at(n[2]).HillSkewCopy(n[3], n[4], map(n[5]), map(n[6]), n[7], n[8], n[9], n[10] !== 0, n[11] !== 0);
                    extra = r === slots[n[2]] ? ' same' : ' new';
                    slots[n[1]] = r;
                    break;
                }
                case 'tilt':
                    show = [n[1]];
                    priv(n[1])['tiltToGround'].call(at(n[1]), map(n[2]), n[3], n[4], n[5], n[6], n[7]);
                    break;
                case 'interp':
                    extra = ` ${String((statics['interpolateHeight'] as (m: (Int32Array | null)[] | null, x: number, z: number) => number).call(ModelUnlit, map(n[1]), n[2], n[3]))}`;
                    break;
                case 'share-normals': {
                    show = n[2] >= 0 ? [n[1], n[2]] : [n[1]];
                    const other = n[2] >= 0 ? slots[n[2]] : n[2] === -1 ? null : lit[-2 - n[2]];
                    at(n[1]).mergeNormals(other as ModelSource, n[3], n[4], n[5], n[6] !== 0);
                    extra = shareStatics();
                    break;
                }
                case 'setamb':
                    show = [n[1]];
                    at(n[1]).ambient = short(n[2]);
                    at(n[1]).contrast = short(n[3]);
                    break;
                case 'lit':
                    show = [n[2]];
                    showLit = [n[1]];
                    lit[n[1]] = null;
                    lit[n[1]] = at(n[2]).LightImpl(n[3], n[4], n[5], n[6], n[7]);
                    break;
                case 'litnd':
                    show = [n[2]];
                    showLit = [n[1]];
                    lit[n[1]] = null;
                    lit[n[1]] = at(n[2]).Light(n[3], n[4], n[5], n[6], n[7]);
                    break;
                case 'litsrc':
                    show = [n[2]];
                    showLit = [n[1]];
                    lit[n[1]] = null;
                    lit[n[1]] = at(n[2]).light(n[3], n[4], n[5]);
                    break;
                case 'dump':
                    show = [n[1]];
                    break;
                case 'dumplit':
                    showLit = [n[1]];
                    break;
                case 'full':
                    show = [n[1]];
                    full = true;
                    break;
                case 'fulllit':
                    showLit = [n[1]];
                    full = true;
                    break;
                case 'unload':
                    ModelUnlit.unload();
                    extra = ` ${value(statics['sin'], '[I', false)} ${value(statics['cos'], '[I', false)}${shareStatics()}`;
                    break;
                default:
                    throw new Error(`unknown op ${line}`);
            }
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('unknown op')) throw e;
            result = code(e);
        }
        const parts = [result + extra];
        for (const i of show) parts.push(i < 0 ? 'nullmodel' : dump(slots[i], full));
        for (const i of showLit) parts.push(dumpLit(lit[i], full));
        out.push(parts.join(' | '));
    }
    return out;
}

function runOracle(script: string[]): string[] {
    const outDir = resolve(import.meta.dir, '../../out');
    mkdirSync(outDir, { recursive: true });
    const scratch = mkdtempSync(join(outDir, 'model-mesh-oracle-'));
    try {
        const source = fileURLToPath(new URL('./model-mesh/ModelMeshOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(`javac failed: ${build.stderr.toString()}`);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Xmx2g', '-cp', gamepackPath + delimiter + scratch, 'ModelMeshOracle', cachePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`ModelMeshOracle exited ${run.exitCode}: ${run.stderr.toString().slice(0, 4000)}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

// Names the fields of two dump lines that differ (and the first differing element of a "full" dump).
function explain(ts: string, java: string): string {
    const tsParts = ts.split(' | ');
    const javaParts = java.split(' | ');
    const notes: string[] = [];
    if (tsParts[0] !== javaParts[0]) notes.push(`result ts=${tsParts[0]} java=${javaParts[0]}`);
    for (let p = 1; p < Math.max(tsParts.length, javaParts.length); p++) {
        const t = (tsParts[p] ?? '').split(' ');
        const j = (javaParts[p] ?? '').split(' ');
        for (let f = 0; f < Math.max(t.length, j.length); f++) {
            if (t[f] === j[f]) continue;
            const tv = t[f] ?? '';
            const jv = j[f] ?? '';
            const name = (tv || jv).split('=')[0];
            const te = tv.slice(tv.indexOf('[') + 1).split(/[,;]/);
            const je = jv.slice(jv.indexOf('[') + 1).split(/[,;]/);
            let first = 0;
            while (first < te.length && te[first] === je[first]) first++;
            notes.push(`dump ${p} ${name}: ts=${tv.slice(0, 120)} java=${jv.slice(0, 120)}${tv.includes('[') ? ` (first difference at token ${first}: ts=${te[first]} java=${je[first]})` : ''}`);
            if (notes.length > 8) return notes.join('\n    ');
        }
    }
    return notes.join('\n    ');
}

test('ModelUnlit/PointNormal/FaceNormal declare exactly the instance fields of cb/fa/ha, and fc lighting fields of fc+nd', () => {
    expect(Object.keys(new ModelUnlit()).sort()).toEqual(CB_FIELDS.map(([, name]) => name).sort());
    expect(Object.keys(new PointNormal()).sort()).toEqual(['w', 'x', 'y', 'z']);
    expect(Object.keys(new FaceNormal()).sort()).toEqual(['x', 'y', 'z']);
    expect(Object.keys(new ModelLitImpl()).sort()).toEqual([...FC_FIELDS.map(([, name]) => name), 'useAABBMouseCheck'].sort());
});

test('ModelUnlit, PointNormal and FaceNormal match cb, fa and ha of client.jar: Load over archive 7, mutated models, transforms, light sharing, merges and cb -> fc lighting', () => {
    const indexSource = container(readGroup(cachePath, 255, 7));
    const index = new Js5Index(indexSource, Crc32.prefix(indexSource, indexSource.length));
    const groups = requireNonNull(index.groupIds);
    const infos: ModelInfo[] = [];
    for (const id of groups) infos.push(classify(id, Js5Compression.Decompress(readGroup(cachePath, 7, id))));
    expect(infos.length).toBe(45468);
    const combos = new Set(infos.map(info => info.key));
    expect(combos.size).toBeGreaterThan(300);
    // Both decoders, every texture-axis type, the per-face priority/alpha/label/material sections and the flat-shading flag.
    for (const part of [/^old /, /^new /, /tt\d*1/, /tt\d*2/, /tt\d*3/, /tt0/, / p255 /, / a1 /, / l1 /, / v1 /, / t1 /, / f1 /, /^old t1 x1/]) {
        expect([...combos].some(key => part.test(key))).toBe(true);
    }

    const script = generate(infos);
    const java = runOracle(script);
    expect(java.length).toBe(script.length);

    // A fresh JVM: cb.<clinit> (new 10000-entry share maps, tic 0, sin/cos aliasing dc's fresh tables) and the oracle's
    // texture provider in dc.r. Other suites in this process may have unloaded cb or replaced Pix3D's tables.
    const sin = new Int32Array(2048);
    const cos = new Int32Array(2048);
    for (let i = 0; i < 2048; i++) {
        sin[i] = (65536.0 * Math.sin(i * 0.0030679615)) | 0;
        cos[i] = (65536.0 * Math.cos(i * 0.0030679615)) | 0;
    }
    const models = new Js5(new SectorProvider(7), false, true);
    const ts = withClinitStatics(
        [
            { target: ModelUnlit, clinit: { shareMap: new Int32Array(10000), shareMap2: new Int32Array(10000), shareTic: 0, sin, cos } },
            { target: Pix3D, clinit: { textureProvider: textures } }
        ],
        () => runTs(script, models)
    );
    expect(ts.length).toBe(script.length);

    // The script reaches every outcome: success, null loads, every exception cb and the lighting can raise, both
    // HillSkewCopy results, and element-wise dumps.
    const codes = new Set(java.map(line => line.split(/[ |]/)[0]));
    for (const c of ['ok', 'aioobe', 'npe', 'arith', 'nase', 'cce']) expect(codes.has(c)).toBe(true);
    expect(java.some(line => line.startsWith('ok | nullmodel'))).toBe(true);
    expect(java.some(line => line.startsWith('ok new'))).toBe(true);
    expect(java.some(line => line.startsWith('ok same'))).toBe(true);
    expect(java.filter((line, i) => script[i].startsWith('lit') && line.startsWith('ok')).length).toBeGreaterThan(500);
    expect(java.filter((line, i) => script[i].startsWith('dec') && line.startsWith('ok')).length).toBeGreaterThan(300);
    expect(java.filter((line, i) => script[i].startsWith('dec') && !line.startsWith('ok')).length).toBeGreaterThan(300);
    expect(java.filter((_line, i) => script[i].startsWith('full')).length).toBeGreaterThan(800);
    // Mutated models that decode with the particle/billboard flag (the skipped trailing section) and with the scaled
    // texture types 1..3 placed where the per-type arrays are too short.
    const decoded = script.flatMap((line, i) => (line.startsWith('dec ') && line.split(' ').length > 2 ? [{ b: Buffer.from(line.split(' ')[2], 'hex'), ok: java[i].startsWith('ok') }] : []));
    const extendedFooter = (b: Buffer): number => (b.length >= 23 && b[b.length - 1] === 255 && b[b.length - 2] === 255 ? b.length - 23 : -1);
    const particle = decoded.filter(({ b }) => extendedFooter(b) >= 0 && (b[extendedFooter(b) + 5] & 2) !== 0);
    expect(particle.filter(({ ok }) => ok).length).toBeGreaterThan(10);
    expect(particle.filter(({ ok }) => !ok).length).toBeGreaterThan(10);
    // The crafted models reach what they were built for (read from the jar's output).
    // Each crafted model's decode line and the element-wise dump that follows it.
    const craftedResult = (name: string): [string, string, string] => {
        const model = requireNonNull(craftedModels().find(m => m.name === name));
        const i = script.indexOf(`dec 1 ${hex(model.bytes)}`);
        expect(i).toBeGreaterThanOrEqual(0);
        return [java[i], java[i + 1], java[script.indexOf('lit 0 1 64 768 -50 -10 -50', i)]];
    };
    // Textured crafted models light (alpha -1/-2 faces, render types 2/3, unavailable textures, type-0 and scaled axes).
    for (const name of ['old-all', 'old-own-axes', 'new-2130', 'new-22130', 'new-0000', 'new-materials-no-axes', 'new-particles']) {
        expect(`${name} ${craftedResult(name)[2].slice(0, 4)}`).toBe(`${name} ok |`);
    }
    for (const name of [
        'old-all',
        'old-own-axes',
        'old-high-axes',
        'old-high-axes-differ',
        'old-codes',
        'new-2130',
        'new-22130',
        'new-2000',
        'new-0000',
        'new-7000',
        'new-materials-no-axes',
        'new-particles',
        'new-particles-zero',
        'new-particles-short',
        'old-empty',
        'new-empty'
    ]) {
        expect(`${name} ${craftedResult(name)[0].slice(0, 9)}`).toBe(`${name} ok | cb j`);
    }
    for (const name of ['new-0123', 'new-1230', 'new-01', 'new-12']) expect(`${name} ${craftedResult(name)[0].slice(0, 6)}`).toBe(`${name} aioobe`);
    expect(craftedResult('old-high-axes')[1]).toContain(' L=null ');
    expect(craftedResult('old-high-axes-differ')[1]).toContain(' L=#');
    expect(craftedResult('old-own-axes')[1]).toMatch(/ H=null .* L=null .* fb=-56 /);
    expect(craftedResult('new-2130')[1]).toMatch(/ Z=#\d+:\[-1\] /);
    expect(craftedResult('new-22130')[1]).toMatch(/ Z=#\d+:\[-1,-2\] /);

    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 6; i++) {
        if (ts[i] !== java[i]) mismatches.push(`#${i} ${script[i].slice(0, 100)}\n    ${explain(ts[i], java[i])}`);
    }
    expect(mismatches).toEqual([]);
    if (process.env.MESH_STATS) {
        const ops = new Map<string, number>();
        script.forEach(line => ops.set(line.split(' ')[0], (ops.get(line.split(' ')[0]) ?? 0) + 1));
        const results = new Map<string, number>();
        java.forEach(line => results.set(line.split(/[ |]/)[0], (results.get(line.split(/[ |]/)[0]) ?? 0) + 1));
        console.log({ lines: script.length, bytes: java.reduce((n, line) => n + line.length, 0), ops: Object.fromEntries(ops), results: Object.fromEntries(results) });
    }
}, 600000);
