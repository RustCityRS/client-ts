import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import BASType from '../../src/config/BASType.js';
import BASTypeList from '../../src/config/BASTypeList.js';
import LocType from '../../src/config/LocType.js';
import NpcType from '../../src/config/NpcType.js';
import ObjType from '../../src/config/ObjType.js';
import SeqType from '../../src/config/SeqType.js';
import SpotType from '../../src/config/SpotType.js';
import VarBitType from '../../src/config/VarBitType.js';
import ActorSlotAnim from '../../src/dash3d/ActorSlotAnim.js';
import AnimFrame from '../../src/dash3d/AnimFrame.js';
import AnimFrameSet from '../../src/dash3d/AnimFrameSet.js';
import FaceNormal from '../../src/dash3d/FaceNormal.js';
import LocEntity from '../../src/dash3d/LocEntity.js';
import ModelLitImpl from '../../src/dash3d/ModelLitImpl.js';
import ModelUnlit from '../../src/dash3d/ModelUnlit.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import PointNormal from '../../src/dash3d/PointNormal.js';
import type TextureProvider from '../../src/dash3d/TextureProvider.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import Crc32 from '../../src/io/Crc32.js';
import PacketT from '../../src/io/PacketT.js';
import ClientVarCache from '../../src/util/ClientVarCache.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { type StaticReset, withClinitStatics } from './staticState.js';

// The config model providers (batch 5) against client.jar: kl (ObjType) GetWearModelNoCheck a(ZZ)Lcb;,
// GetHeadModelNoCheck a(ZI)Lcb;, GetModelUnlitLit a(B)Lfc; and GetModelLit a(Lek;IIIII)Lnd;; ja (NpcType) GetTempModel
// a([Lci;ILek;IIIBIILek;)Lnd; and GetHeadModel a(Lek;IIII)Lnd;; jb (LocType) GetModel a([[IIIIZB[[ILch;IIZ)Lwj;,
// GetTempModel a(IIIIII[[IIZIBLch;[[ILek;)Lwj; and the private BuildModel a(III)Lcb; they share; li (SpotType)
// GetTempModel a(IBII)Lnd;; and wj (LocEntity) with its member-map statics g.j (LocType.modelResult) and ll.j
// (LocType.temp). test/review/provider-config/ProviderConfigOracle.java (javac'd next to client.jar) runs the same
// script on the real gamepack classes, over a real al/Js5 per archive that serves the cache's sector files (frames,
// bases, config, models, locs, npcs, objs, seqs, spots, varbits), so the definitions come from the jar's decoders on
// one side and Codex's native decoders on the other. One result line per operation: ok or the Java exception, the
// returned model or LocEntity (every instance field of the cb or fc, arrays as length:hash), the most recently used
// entries of the family's model caches (full dumps, so a cached model a later copy or skew mutated shows up), and the
// state every op can touch: each cache's size, remaining slots, capacity, key order and value identities (obj, npc,
// loc, spot, seq, frameset, BAS and varbit caches and the obj/npc/head/mc1/mc2/mc3/spot model caches), the three
// CopyForAnim scratch models (fc.k/fc.V/fc.cb), g.j and the model it holds, ll.j, ja's 14-slot animation scratch
// (sb.b, qh.f, jl.j, pj.A, ge.R, pg.P, tb.y), the tween flag, the three static recolour palettes and the var table.
// Every array and model carries an identity tag numbered in first-dump order within the line, so the sharing between
// the returned model, the cache entries, the scratch models and g.j is compared, not just contents. The first line
// prints the <clinit> state (capacities included) both sides start from.
//
// Inputs (about 11,500 ops): real definitions chosen from the cache by feature. Objs: wear models of one, two and
// three parts, offsets per gender (including z-only), head models of one and two parts, count variants, certs and lent
// items, retextures, resizes, models with vertex labels. Npcs: missing body parts, model offsets, one to four head
// models, multinpcs by varbit and by varp with every selector, resizes. Locs: every hill-skew type with and without a
// hill parameter (also with shared light), shared light, mirrored shape-2 walls, shape-less multi-model merges, shapes
// 0..22 (the shape-2 mirror toggle and the shape-4 and shape-10 diagonal turns), offsets (including z-only), resizes.
// Spots: rotations 90/180/270, resizes, recolours. Each goes through its model methods. Objs: wear and head meshes for
// both genders (file 0 and file 1), the inventory model with both call-site constants, and the lit model over count
// sweeps around every threshold, animated by real seqs (tweened too, on labelled models). Npcs: temp models with no
// animation, primary only, secondary only, and both (walk-merge masks on and off, the same masked seq as both halves,
// special secondaries); slot animations, using synthetic BAS transforms so the slot matrices are built and used
// (zero-rotation, z-only and missing transforms, slots past the body or the BAS, a slot array longer than the
// scratch, stale scratch replayed after an exception); the tween flag on and off, with next frames in another frameset
// (the jar's masked-id frameset lookup); head models with and without a seq. Locs: every shape at angle 0, and each
// loc's shapes at angles 0..7 with shared light on and off, over the heightmaps (rough, smooth, 3x3, bumpy-flat, flat
// at the base height, null), on and off the map; temp loc models with and without seqs, tweened too. Spots: with and
// without frames. Synthetic type palettes and static palettes (byte entries past 127) reach the palette recolour
// branch, which the cache never uses. Edges: no texture provider (lighting a textured model throws), out-of-range
// frames, ids past the archives, and the dummy arguments at every call-site constant.
//
// Sensitivity: 70 of 75 single-statement mutations of the batch-5 methods make this test fail. They cover each
// argument order, cache key and Put, copy flag, offset, palette index and bound, matrix term, slot scratch store,
// rotation and skew argument, holder write, and the jar's masked-id frameset quirks. The five survivors are
// equivalent or unreachable with this cache:
//  - a two-part wear model built as three parts (the missing third part merges away);
//  - resize/count edges the cache has no definition for (an obj scaled along z alone, a count threshold of 1, a count
//    variant with variants of its own);
//  - the walk-merge special flag (SD's Animate2/animate2Masked ignore it).
//
// PC_DUMP=<prefix> writes the script and both outputs; PC_STATS=1 prints per-op result counts.

type Statics = Record<string, unknown>;

// [cb field, ModelUnlit property, JVM descriptor] in cb's declaration order (ProviderConfigOracle.CB_FIELDS).
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

// [fc field, ModelLitImpl property, JVM descriptor] in fc's declaration order, then nd.j (ProviderConfigOracle.FC_FIELDS).
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

// ---- dumps (ProviderConfigOracle.value/model/cache/tail/state) ----

let ids = new Map<object, number>();

function tagId(v: object): number {
    let id = ids.get(v);
    if (id === undefined) {
        id = ids.size;
        ids.set(v, id);
    }
    return id;
}

function tag(v: object): string {
    return `#${tagId(v)}:`;
}

function hashInts(values: ArrayLike<number>, signedBytes: boolean): number {
    let h = 1;
    for (let i = 0; i < values.length; i++) h = (Math.imul(h, 31) + (signedBytes ? (values[i] << 24) >> 24 : values[i])) | 0;
    return h;
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
function value(v: unknown, desc: string): string {
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
        const ok = desc === '[I' ? v instanceof Int32Array : desc === '[S' ? v instanceof Int16Array : v instanceof Uint8Array || v instanceof Int8Array;
        if (!ok) return `TYPE!${Object.prototype.toString.call(v)}`;
        const a = v as Int32Array;
        return tag(a) + `${a.length}:${hashInts(a, desc === '[B')}`;
    }
    if (!Array.isArray(v)) return `TYPE!${Object.prototype.toString.call(v)}`;
    const t = tag(v);
    if (desc === '[[I') {
        if (!v.every(row => row === null || row instanceof Int32Array)) return 'TYPE![[I';
        let h = 1;
        for (const row of v as (Int32Array | null)[]) h = (Math.imul(h, 31) + (row === null ? 0 : (Math.imul(31, row.length) + hashInts(row, false)) | 0)) | 0;
        return `${t}${v.length}:${h}`;
    }
    if (desc === '[Lfa;') {
        if (!v.every(e => e === null || e instanceof PointNormal)) return 'TYPE![Lfa;';
        let h = 1;
        for (const e of v as (PointNormal | null)[]) h = (Math.imul(h, 31) + (e === null ? 0 : pointNormalHash(e))) | 0;
        return `${t}${v.length}:${h}`;
    }
    if (desc === '[Lha;') {
        if (!v.every(e => e === null || e instanceof FaceNormal)) return 'TYPE![Lha;';
        let h = 1;
        for (const e of v as (FaceNormal | null)[]) h = (Math.imul(h, 31) + (e === null ? 0 : faceNormalHash(e))) | 0;
        return `${t}${v.length}:${h}`;
    }
    throw new Error(`descriptor ${desc}`);
}

// ProviderConfigOracle.model: "null", or the class, identity tag and every instance field.
function model(m: unknown): string {
    if (m === null) return 'null';
    if (m instanceof ModelUnlit) {
        const f = m as unknown as Statics;
        return `cb${tag(m)}` + CB_FIELDS.map(([obf, name, desc]) => ` ${obf}=${value(f[name], desc)}`).join('');
    }
    if (m instanceof ModelLitImpl) {
        const f = m as unknown as Statics;
        return `fc${tag(m)}` + FC_FIELDS.map(([obf, name, desc]) => ` ${obf}=${value(f[name], desc)}`).join('') + ` j=${value(m.useAABBMouseCheck, 'Z')}`;
    }
    return `other:${(m as object).constructor.name}`;
}

function ref(v: object | null | undefined): string {
    return v === null || v === undefined ? 'null' : `#${tagId(v)}`;
}

interface QueueNode {
    key: bigint;
    secondaryNext: QueueNode;
    isSoft(): boolean;
    get(): object | null;
}

function nodes(c: LRUHashCache<object>): QueueNode[] {
    const queue = (c as unknown as Statics)['queue'] as Statics;
    const sentinel = queue['sentinel'] as QueueNode;
    const out: QueueNode[] = [];
    for (let n = sentinel.secondaryNext; n !== sentinel; n = n.secondaryNext) out.push(n);
    return out;
}

function nodeValue(n: QueueNode): object | null {
    if (n.isSoft()) throw new Error('soft node');
    return n.get();
}

function longHash(v: bigint): number {
    const u = BigInt.asUintN(64, v);
    return Number(BigInt.asIntN(32, u ^ (u >> 32n)));
}

function cache(name: string, c: LRUHashCache<object>): string {
    const list = nodes(c);
    let kh = 1;
    let vh = 1;
    for (const n of list) {
        kh = (Math.imul(31, kh) + longHash(n.key)) | 0;
        const v = nodeValue(n);
        vh = (Math.imul(31, vh) + (v === null ? -1 : tagId(v))) | 0;
    }
    const f = c as unknown as Statics;
    return ` ${name}=${list.length}/${f['remaining']}/${f['m_cacheSize']}:${kh}:${vh}`;
}

function tail(name: string, c: LRUHashCache<object>, count: number): string {
    const list = nodes(c);
    let out = '';
    for (let i = Math.max(0, list.length - count); i < list.length; i++) out += ` | ${name}[${list[i].key}] ${model(nodeValue(list[i]))}`;
    return out;
}

function ints(a: Int32Array): string {
    return Array.from(a).join(',');
}

function refs(a: (object | null)[]): string {
    return a.map(v => ref(v)).join(',');
}

const lru = (c: unknown): LRUHashCache<object> => c as LRUHashCache<object>;
const impl = ModelLitImpl as unknown as Statics;

function state(): string {
    let o = ' | state';
    o += cache('objs', lru(ObjType.types)) + cache('objModels', lru(ObjType.modelCache)) + cache('objSprites', lru(ObjType.spriteCache));
    o += cache('npcs', lru(NpcType.m_recentUse)) + cache('npcModels', lru(NpcType.m_modelCache)) + cache('npcHeads', lru(NpcType.headModelCache));
    o += cache('locs', lru(LocType.m_recentUse)) + cache('mc1', lru(LocType.m_mc1)) + cache('mc2', lru(LocType.m_mc2)) + cache('mc3', lru(LocType.m_mc3));
    o += cache('spots', lru(SpotType.m_recentUse)) + cache('spotModels', lru(SpotType.m_modelCache));
    o += cache('seqs', lru(SeqType.m_recentUse)) + cache('framesets', lru(AnimFrameSet.cache)) + cache('bas', lru(BASTypeList.types)) + cache('varbits', lru(VarBitType.m_recentUse));
    o += ` temps=${ref(impl['tempActorModel'] as object | null)},${ref(impl['tempSpotModel'] as object | null)},${ref(impl['tempLocModel'] as object | null)}`;
    const holder = LocType.modelResult as LocEntity | null;
    o += ` gj=${ref(holder)}:${ref(holder === null ? null : holder.model)}`;
    o += ` llj=${refs(LocType.temp)}`;
    o += ` sbb=${refs(NpcType.slotSeqs)} qhf=${refs(NpcType.layerFramesets)} pja=${refs(NpcType.slotNextFramesets)}`;
    o += ` jlj=${ints(NpcType.layerFrameIds)} geR=${ints(NpcType.layerNextFrames)} pgP=${ints(NpcType.slotFrameCycles)} tby=${ints(NpcType.slotFrameDelays)}`;
    o += ` tween=${SeqType.forceTween ? 1 : 0}`;
    o += ` pal=${value(ObjType.recolourPalette, '[S')},${value(NpcType.clientPalette, '[S')},${value(LocType.recolPalette, '[S')}`;
    o += ` var=${hashInts(ClientVarCache.m_var, false)}`;
    return o;
}

function code(e: unknown): string {
    if (e instanceof RangeError) {
        if (e.message.startsWith('array index') || e.message.startsWith('byte array index')) return 'aioobe';
        if (e.message === '/ by zero') return 'arith';
        if (/^(Invalid typed array length|Invalid array length|length cannot be negative|Requested length is negative)/.test(e.message)) return 'nase';
    }
    if (e instanceof TypeError) {
        if (e.message.startsWith('ClassCastException')) return 'cce';
        if (e.message === 'Null reference' || e.message === 'Null array' || e.message === 'Null byte array') return 'npe';
    }
    return `error:${String(e)}`;
}

// ---- inputs ----

// The JS5 container without the two-byte version trailer the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

// ProviderConfigOracle.Provider: one archive served from the sector files.
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

const js5 = (archive: number): Js5 => new Js5(new SectorProvider(archive), false, true);

// Fake textures, identical to ProviderConfigOracle.Textures: only isAvailable is reached by the lighting.
const textures: TextureProvider = {
    getTextureSmall: () => true,
    isAvailable: id => id % 7 !== 3,
    getPixels: () => null,
    isLoaded: () => true,
    getTextureData: () => null,
    getTextureColour: id => (Math.imul(id, 0x1f3d) + 0x123) & 0xffff,
    getTextureSolid: id => (id & 1) === 0
};

// ProviderConfigOracle.makeMaps.
function makeMaps(): Int32Array[][] {
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
    const map3: Int32Array[] = [];
    for (let x = 0; x < 104; x++) map3.push(Int32Array.from({ length: 104 }, (_, z) => ((x & 1) === 0 && (z & 1) === 1 ? -230 : -200)));
    const map4: Int32Array[] = [];
    for (let x = 0; x < 104; x++) map4.push(new Int32Array(104).fill(-200));
    return [map0, map1, map2, map3, map4];
}

const maps = makeMaps();
const map = (i: number): Int32Array[] | null => (i < 0 ? null : maps[i]);
const seq = (id: number): SeqType | null => (id < 0 ? null : SeqType.List(id));

// ProviderConfigOracle.palEntry / typePalEntry.
function palEntry(seed: number, i: number): number {
    // (short) ((long) (i * seed) * 2654435761L >>> 13): the int product wraps before the long multiply.
    return Number(BigInt.asIntN(16, BigInt.asUintN(64, BigInt(Math.imul(i, seed)) * 2654435761n) >> 13n));
}

function typePalEntry(seed: number, i: number): number {
    return ((i * 97 + seed * 31) << 24) >> 24;
}

// ---- the TS side of each op (ProviderConfigOracle.run) ----

function open(): void {
    const models = js5(7);
    ObjType.m_pConfigClient = js5(19);
    ObjType.m_pModels = models;
    ObjType.m_memServer = true;
    LocType.m_pConfigClient = js5(16);
    LocType.m_pModels = models;
    LocType.members = true;
    NpcType.m_pConfigClient = js5(18);
    NpcType.m_pModels = models;
    SpotType.m_pConfigClient = js5(21);
    SpotType.m_pModels = models;
    SeqType.m_pConfigClient = js5(20);
    AnimFrameSet.basesArchive = js5(1);
    AnimFrameSet.framesArchive = js5(0);
    BASTypeList.archive = js5(2);
    VarBitType.m_pConfigClient = js5(22);
    Pix3D.textureProvider = textures;
}

function entity(w: LocEntity | null): string {
    if (w === null) return 'nullentity | -';
    return `${w === LocType.modelResult ? 'shared' : 'other'} | ${model(w.model)}`;
}

function runOp(op: string, n: number[]): string {
    switch (op) {
        case 'init':
            return '';
        case 'open':
            open();
            return '';
        case 'tex':
            Pix3D.textureProvider = n[1] !== 0 ? textures : null;
            return '';
        case 'tween':
            SeqType.forceTween = n[1] !== 0;
            return '';
        case 'var':
            ClientVarCache.m_var[n[1]] = n[2];
            return '';
        case 'pal': {
            const p = n[1] === 0 ? ObjType.recolourPalette : n[1] === 1 ? NpcType.clientPalette : LocType.recolPalette;
            for (let i = 0; i < 256; i++) p[i] = n[2] === 0 ? 0 : palEntry(n[2], i);
            return '';
        }
        case 'tpal': {
            let p: Int8Array | null = null;
            if (n[3] >= 0) {
                p = new Int8Array(n[3]);
                for (let i = 0; i < p.length; i++) p[i] = typePalEntry(n[4], i);
            }
            if (n[1] === 0) ObjType.List(n[2]).recolourPalette = p;
            else if (n[1] === 1) NpcType.List(n[2]).recolourPalette = p;
            else LocType.List(n[2]).recolourPalette = p;
            return '';
        }
        case 'bas': {
            const b = new BASType();
            b.transforms = new Array<Int32Array | null>(n[2]).fill(null);
            for (let i = 3; i + 6 < n.length; i += 7) b.transforms[n[i]] = Int32Array.of(n[i + 1], n[i + 2], n[i + 3], n[i + 4], n[i + 5], n[i + 6]);
            BASTypeList.types.Put(BigInt(n[1]), b);
            return '';
        }
        case 'nbas':
            NpcType.List(n[1]).m_baseAnimationSet = n[2];
            return '';
        case 'entity': {
            const w = new LocEntity();
            return ` ${model(w.model)} ${w === LocType.modelResult ? 'shared' : 'new'}`;
        }
        case 'ow': {
            const t = ObjType.List(n[1]);
            return ` | ${model(t.GetWearModelNoCheck(n[2] !== 0))}` + tail('objModels', lru(ObjType.modelCache), 1);
        }
        case 'oh': {
            const t = ObjType.List(n[1]);
            return ` | ${model(t.GetHeadModelNoCheck(n[2] !== 0, n[3]))}` + tail('objModels', lru(ObjType.modelCache), 1);
        }
        case 'oi': {
            const t = ObjType.List(n[1]);
            return ` | ${model(t.GetModelUnlitLit())}` + tail('objModels', lru(ObjType.modelCache), 1);
        }
        case 'ol': {
            const t = ObjType.List(n[1]);
            const s = seq(n[2]);
            return ` | ${model(t.GetModelLit(s, n[3], n[4], n[5], n[6]))}` + tail('objModels', lru(ObjType.modelCache), 2);
        }
        case 'n': {
            const t = NpcType.List(n[1]);
            let slots: (ActorSlotAnim | null)[] | null = null;
            if (n[11] >= 0) {
                slots = new Array<ActorSlotAnim | null>(n[11]).fill(null);
                for (let i = 12; i + 4 < n.length; i += 5) {
                    const c = new ActorSlotAnim();
                    c.seq = n[i + 1];
                    c.frame = n[i + 2];
                    c.next = n[i + 3];
                    c.cycle = n[i + 4];
                    slots[n[i]] = c;
                }
            }
            const primary = seq(n[2]);
            const secondary = seq(n[6]);
            const r = t.GetTempModel(slots, n[3], primary, n[9], n[4], n[5], n[8], n[7], secondary);
            return ` | ${model(r)} | ib=${value(t.slotMatrices, '[[I')}` + tail('npcModels', lru(NpcType.m_modelCache), 2);
        }
        case 'nh': {
            const t = NpcType.List(n[1]);
            const s = seq(n[2]);
            return ` | ${model(t.GetHeadModel(s, n[4], n[3], n[5]))}` + tail('npcHeads', lru(NpcType.headModelCache), 2);
        }
        case 'l': {
            const t = LocType.List(n[1]);
            const w = t.GetModel(map(n[8]), n[2], n[3], n[6], n[4] !== 0, map(n[9]), null, n[7], n[5], false);
            return ` ${entity(w)}` + tail('mc1', lru(LocType.m_mc1), 4) + tail('mc2', lru(LocType.m_mc2), 1);
        }
        case 'lt': {
            const t = LocType.List(n[1]);
            const ground = map(n[11]);
            const second = map(n[12]);
            const s = seq(n[4]);
            const w = t.GetTempModel(n[9], n[2], n[6], n[7], n[10], n[8], ground, n[3], false, n[5], null, second, s);
            return ` ${entity(w)}` + tail('mc1', lru(LocType.m_mc1), 4) + tail('mc3', lru(LocType.m_mc3), 1);
        }
        case 'sp': {
            const t = SpotType.List(n[1]);
            return ` | ${model(t.GetTempModel(n[3], n[4], n[2]))}` + tail('spotModels', lru(SpotType.m_modelCache), 1);
        }
        default:
            throw new Error(`bad op ${op}`);
    }
}

function runTs(script: string[]): string[] {
    const out: string[] = [];
    for (const line of script) {
        ids = new Map();
        const t = line.split(' ');
        const n = t.map((s, i) => (i === 0 ? 0 : Number.parseInt(s, 10)));
        let result: string;
        try {
            result = 'ok' + runOp(t[0], n);
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('bad op')) throw e;
            result = code(e);
        }
        out.push(result + state());
    }
    return out;
}

// ---- static state: the fresh-JVM values of everything the script touches ----

function sinCos(): { sin: Int32Array; cos: Int32Array } {
    const sin = new Int32Array(2048);
    const cos = new Int32Array(2048);
    for (let i = 0; i < 2048; i++) {
        sin[i] = (65536.0 * Math.sin(i * 0.0030679615)) | 0;
        cos[i] = (65536.0 * Math.cos(i * 0.0030679615)) | 0;
    }
    return { sin, cos };
}

function resets(): StaticReset[] {
    const { sin, cos } = sinCos();
    const nulls = <T>(n: number): (T | null)[] => new Array<T | null>(n).fill(null);
    return [
        // kl's providers: bb.b, wd.i, nf.c, fa.b, ra.M, gb.r and al.q.
        {
            target: ObjType,
            clinit: { m_memServer: false, m_pConfigClient: null, m_pModels: null, types: new LRUHashCache(64), modelCache: new LRUHashCache(50), spriteCache: new LRUHashCache(100), recolourPalette: new Int16Array(256) }
        },
        // ja's: mf.k, nl.Y, gf.Z, uk.k, pb.xc, la.Z and the seven 14-slot scratch arrays.
        {
            target: NpcType,
            clinit: {
                m_pConfigClient: null,
                m_pModels: null,
                m_recentUse: new LRUHashCache(64),
                m_modelCache: new LRUHashCache(50),
                headModelCache: new LRUHashCache(5),
                clientPalette: new Int16Array(256),
                slotSeqs: nulls(14),
                layerFramesets: nulls(14),
                layerFrameIds: new Int32Array(14),
                slotNextFramesets: nulls(14),
                layerNextFrames: new Int32Array(14),
                slotFrameCycles: new Int32Array(14),
                slotFrameDelays: new Int32Array(14)
            }
        },
        // jb's: gd.U, ik.Y, ok.z, he.w, lj.c, vf.T, uj.f, de.v, g.j (new wj()) and ll.j (new cb[4]).
        {
            target: LocType,
            clinit: {
                m_pConfigClient: null,
                m_pModels: null,
                members: false,
                m_recentUse: new LRUHashCache(64),
                m_mc1: new LRUHashCache(500),
                m_mc2: new LRUHashCache(30),
                m_mc3: new LRUHashCache(50),
                recolPalette: new Int16Array(256),
                modelResult: new LocEntity(),
                temp: nulls(4)
            }
        },
        // li's: ig.s, ec.j, r.V, m.O.
        { target: SpotType, clinit: { m_pConfigClient: null, m_pModels: null, m_recentUse: new LRUHashCache(64), m_modelCache: new LRUHashCache(30) } },
        // ek's: ag.i, ga.B, qf.b; hf's: uk.d, ef.K, gl.x; mg's: s.S, ig.n; og's: ma.g, cd.d; vj.d.
        { target: SeqType, clinit: { m_pConfigClient: null, m_recentUse: new LRUHashCache(64), forceTween: false } },
        { target: AnimFrameSet, clinit: { basesArchive: null, framesArchive: null, cache: new LRUHashCache(100) } },
        { target: BASTypeList, clinit: { archive: null, types: new LRUHashCache(64) } },
        { target: VarBitType, clinit: { m_pConfigClient: null, m_recentUse: new LRUHashCache(64) } },
        { target: ClientVarCache, clinit: { m_var: new Int32Array(2500) } },
        // vc.J and ce.K (the JS5 validation switch and container size limit some suites set).
        { target: Js5, clinit: { strictValidation: false, maxContainerSize: 0 } },
        // dc.<clinit>'s tables and no texture provider; cb.<clinit> (the share maps and tic, cb.D/cb.cb aliasing dc.g/dc.l).
        { target: Pix3D, clinit: { sinTable: sin, cosTable: cos, textureProvider: null } },
        { target: ModelUnlit, clinit: { shareMap: new Int32Array(10000), shareMap2: new Int32Array(10000), shareTic: 0, sin, cos } },
        // fc.<clinit>: the three CopyForAnim scratch models with their one-entry arrays, and the animation origin.
        {
            target: ModelLitImpl,
            clinit: {
                tempActorModel: new ModelLitImpl(),
                tempActorFaceColour: new Int16Array(1),
                tempActorFaceColourA: new Int32Array(1),
                tempActorFaceColourC: new Int32Array(1),
                tempActorFaceColourB: new Int32Array(1),
                tempActorFaceAlpha: new Uint8Array(1),
                tempSpotModel: new ModelLitImpl(),
                tempSpotFaceColourB: new Int32Array(1),
                tempSpotFaceColourA: new Int32Array(1),
                tempSpotFaceColour: new Int16Array(1),
                tempSpotFaceAlpha: new Uint8Array(1),
                tempSpotFaceColourC: new Int32Array(1),
                tempLocModel: new ModelLitImpl(),
                tempLocFaceAlpha: new Uint8Array(1),
                tempLocFaceColourB: new Int32Array(1),
                tempLocFaceColour: new Int16Array(1),
                tempLocFaceColourC: new Int32Array(1),
                tempLocFaceColourA: new Int32Array(1),
                originTransformPending: false,
                originX: 0,
                originY: 0,
                originZ: 0
            }
        },
        // of.<clinit>: the frame decoder's scratch.
        {
            target: AnimFrame,
            clinit: { tempTz: new Int16Array(500), tempTi: new Int16Array(500), tempTx: new Int16Array(500), tempFlags: new Uint8Array(500), tempPrevOrigin: new Int16Array(500), tempTy: new Int16Array(500) }
        }
    ];
}

// ---- oracle ----

function runOracle(script: string[]): string[] {
    const outDir = resolve(import.meta.dir, '../../out');
    mkdirSync(outDir, { recursive: true });
    const scratch = mkdtempSync(join(outDir, 'provider-config-oracle-'));
    try {
        const source = fileURLToPath(new URL('./provider-config/ProviderConfigOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(`javac failed: ${build.stderr.toString()}`);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Xmx2g', '-cp', gamepackPath + delimiter + scratch, 'ProviderConfigOracle', cachePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`ProviderConfigOracle exited ${run.exitCode}: ${run.stderr.toString().slice(0, 4000)}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

// ---- script ----

// mulberry32
function rng(seed: number): () => number {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return (t ^ (t >>> 14)) >>> 0;
    };
}

interface SeqInfo {
    id: number;
    length: number;
    delays: Int32Array;
    masked: boolean;
    special: boolean;
}

// The definition counts as the Init methods compute them (last group's file limit after the full groups).
function count(archive: Js5, perGroup: number): number {
    const group = (archive.GetGroupIdLimit() - 1) | 0;
    return group * perGroup + archive.GetFileIdLimit(group);
}

interface Decoded<T> {
    id: number;
    type: T;
}

function decodeAll<T>(archive: Js5, perGroup: number, make: () => T & { Decode(p: PacketT): void }): Decoded<T>[] {
    const out: Decoded<T>[] = [];
    const total = count(archive, perGroup);
    for (let id = 0; id < total; id++) {
        const bytes = archive.GetFile(id % perGroup, (id / perGroup) | 0);
        if (bytes === null) continue;
        const type = make();
        type.Decode(new PacketT(bytes));
        out.push({ id, type });
    }
    return out;
}

// Up to max items of list matching accept, spread over the list.
function some<T>(list: T[], accept: (t: T) => boolean, max: number): T[] {
    const all = list.filter(accept);
    if (all.length <= max) return all;
    const out: T[] = [];
    for (let i = 0; i < max; i++) out.push(all[Math.floor((i * all.length) / max)]);
    return out;
}

const OI_DUMMIES = [-72, -69];
const NPC_DUMMIES = [-105, -101, -90, -86];
const HEAD_DUMMIES = [107, 82, 123];
const LOC_DUMMIES = [-46, -103, -98, -112, -100, -47, -56, -89, -43, -93, -87, -78, -94, -110, -73];
const SPOT_DUMMIES = [-50, -67, -71, -44, -47];

function generate(): { script: string[]; counts: Record<string, number> } {
    const r = rng(0x530c0f);
    const int = (bound: number): number => r() % bound;
    const pick = <T>(a: T[]): T => a[int(a.length)];
    const ops: string[] = ['init', 'open'];

    const objs = decodeAll(js5(19), 256, () => new ObjType());
    const npcs = decodeAll(js5(18), 128, () => new NpcType());
    const locs = decodeAll(js5(16), 256, () => new LocType());
    const spots = decodeAll(js5(21), 256, () => new SpotType());
    const seqDefs = decodeAll(js5(20), 128, () => new SeqType());
    const varbitArchive = js5(22);
    const counts = { objs: count(js5(19), 256), npcs: count(js5(18), 128), locs: count(js5(16), 256), spots: count(js5(21), 256), seqs: count(js5(20), 128) };

    // Seqs with frames and delays: a spread, the masked ones (walk-merge) and the special ones.
    const usable = seqDefs.filter(({ type }) => type.frames !== null && type.delays !== null && type.frames.length > 0);
    const seqInfo = ({ id, type }: Decoded<SeqType>): SeqInfo => ({ id, length: requireNonNull(type.frames).length, delays: requireNonNull(type.delays), masked: type.mask !== null, special: type.special });
    // The four framesets whose frames carry tween flags (some parts are not interpolated).
    const flagged = ({ type }: Decoded<SeqType>): boolean => Array.from(requireNonNull(type.frames)).some(f => [256, 2370, 2690, 2691].includes(f >>> 16));
    const pool = [...some(usable, () => true, 60), ...some(usable, ({ type }) => type.mask !== null, 20), ...some(usable, ({ type }) => type.special, 4), ...some(usable, flagged, 6)].map(seqInfo);
    const masked = pool.filter(s => s.masked);
    // Seqs whose next frame lies in another frameset (the first such frame of each).
    const crossings = some(usable, ({ type }) => Array.from(requireNonNull(type.frames)).some((f, i, a) => i + 1 < a.length && f >>> 16 !== a[i + 1] >>> 16), 10).map(({ id, type }) => {
        const f = requireNonNull(type.frames);
        let at = 0;
        while (f[at] >>> 16 === f[at + 1] >>> 16) at++;
        return { id, at };
    });
    // [frame, next, cycle] for a seq: in range, the last frame, no next frame, next past the end, next = frame; with
    // edges, also a frame past the end or -1 (one in eight).
    const frameArgs = (s: SeqInfo, edges = true): [number, number, number] => {
        const k = int(edges ? 16 : 14);
        const frame = k === 0 ? s.length - 1 : k === 14 ? s.length : k === 15 ? -1 : int(s.length);
        const next = k === 3 ? -1 : k === 4 ? s.length : k === 5 ? frame : k === 6 ? -1 : (frame + 1) % s.length;
        const delay = frame >= 0 && frame < s.length ? s.delays[frame] : 3;
        const cycle = k === 7 ? 0 : k === 8 ? delay + 1 : int(Math.max(1, delay + 1));
        return [frame, next, cycle];
    };
    const seqArgs = (edges = true): string => {
        const s = pick(pool);
        const [frame, next, cycle] = frameArgs(s, edges);
        return `${s.id} ${frame} ${next} ${cycle}`;
    };

    // ---- objs ----
    const objPick = new Map<number, ObjType>();
    const addObjs = (list: Decoded<ObjType>[]): void => list.forEach(({ id, type }) => objPick.set(id, type));
    addObjs(some(objs, () => true, 130));
    addObjs(some(objs, ({ type }) => type.maleWear3 !== -1 || type.femaleWear3 !== -1, 8));
    addObjs(some(objs, ({ type }) => type.maleWear2 !== -1 && type.maleWear3 === -1, 6));
    addObjs(some(objs, ({ type }) => type.maleOffsetX !== 0 || type.maleOffsetY !== 0 || type.maleOffsetZ !== 0, 6));
    addObjs(some(objs, ({ type }) => type.femaleOffsetX !== 0 || type.femaleOffsetY !== 0 || type.femaleOffsetZ !== 0, 6));
    addObjs(some(objs, ({ type }) => type.femaleOffsetZ !== 0 && type.femaleOffsetX === 0 && type.femaleOffsetY === 0, 4));
    addObjs(some(objs, ({ type }) => type.maleOffsetZ !== 0 && type.maleOffsetX === 0 && type.maleOffsetY === 0, 4));
    addObjs(some(objs, ({ type }) => type.maleHead2 !== -1 || type.femaleHead2 !== -1, 6));
    addObjs(some(objs, ({ type }) => type.maleHead !== -1 && type.femaleHead === -1, 3));
    addObjs(some(objs, ({ type }) => type.maleHead !== -1 && type.femaleHead !== -1, 20));
    addObjs(some(objs, ({ type }) => type.countObj !== null, 14));
    addObjs(some(objs, ({ type }) => type.retextureSource !== null, 6));
    addObjs(some(objs, ({ type }) => type.resizeX !== 128 || type.resizeY !== 128 || type.resizeZ !== 128, 8));
    addObjs(some(objs, ({ type }) => type.certTemplate !== -1, 4));
    addObjs(some(objs, ({ type }) => type.lentTemplate !== -1, 4));
    addObjs(some(objs, ({ type }) => type.ambient !== 0 || type.contrast !== 0, 6));
    let k = 0;
    for (const [id, type] of objPick) {
        k++;
        ops.push(`ow ${id} 0`, `ow ${id} 1`, `oh ${id} 0 0`, `oh ${id} 1 0`);
        if (k % 9 === 0) ops.push(`oh ${id} ${k & 1} 1`);
        ops.push(`oi ${id} ${OI_DUMMIES[k & 1]}`, `ol ${id} -1 0 1 0 -1`);
        if (type.countObj !== null && type.countThreshold !== null) {
            const sweep = new Set<number>([0, 1, 2, 0x7fffffff, -1]);
            for (const t of type.countThreshold) if (t !== 0) [t - 1, t, t + 1].forEach(v => sweep.add(v | 0));
            for (const c of sweep) ops.push(`ol ${id} -1 0 ${c} 0 -1`);
        }
        if (k % 4 === 0) {
            for (let i = 0; i < 3; i++) {
                const s = pick(pool);
                const [frame, next, cycle] = frameArgs(s);
                ops.push(`ol ${id} ${s.id} ${frame} ${i === 0 ? 1 : int(4)} ${cycle} ${next}`);
            }
        }
        if (k % 7 === 0) ops.push(`ol ${id} -1 0 1 0 -1`, `oi ${id} -72`);
        // Tweened: the next frame and the cycle reach the animation.
        if (k % 5 === 0) {
            const s = pick(pool);
            const [frame, next, cycle] = frameArgs(s, false);
            ops.push('tween 1', `ol ${id} ${s.id} ${frame} 1 ${cycle + 1} ${next}`, 'tween 0');
        }
    }
    // Objs whose models carry vertex labels, so the seq animation moves them: plain and tweened frames.
    const models = js5(7);
    const labelled: number[] = [];
    for (const { id, type } of objs) {
        if (labelled.length >= 12) break;
        if (type.certTemplate !== -1 || type.lentTemplate !== -1) continue;
        const m = ModelUnlit.Load(models, type.model, 0);
        if (m !== null && (m as unknown as Statics)['vertexLabel'] !== null) labelled.push(id);
    }
    for (const id of labelled) {
        for (let i = 0; i < 2; i++) {
            const s = pick(pool);
            const [frame, next, cycle] = frameArgs(s, false);
            ops.push(`ol ${id} ${s.id} ${frame} 1 ${cycle} ${next}`, 'tween 1', `ol ${id} ${s.id} ${frame} 1 ${cycle + 1} ${next}`, 'tween 0');
        }
    }
    // Static and type palettes (the cache sets none): palette entries past the type's palette length, bytes past 127.
    const palObjs = some(objs, ({ id, type }) => type.recolourSource !== null && type.recolourSource.length >= 2 && !objPick.has(id), 6);
    ops.push('pal 0 7919');
    palObjs.forEach(({ id, type }, i) => {
        ops.push(`tpal 0 ${id} ${i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : requireNonNull(type.recolourSource).length} ${i * 13 + 5}`);
        ops.push(`oi ${id} -72`, `ol ${id} -1 0 1 0 -1`, `ow ${id} ${i & 1}`, `oh ${id} ${i & 1} 0`);
    });
    ops.push('pal 0 0');
    // No texture provider: lighting a textured model throws inside the fc constructor, after the cache lookups.
    const texturedObjs = some(objs, ({ type }) => type.retextureSource !== null, 3);
    ops.push('tex 0');
    for (const { id } of [...texturedObjs, ...some(objs, () => true, 4)]) ops.push(`oi ${id} -72`, `ol ${id} -1 0 1 0 -1`);
    ops.push('tex 1');
    // Ids past the archive.
    ops.push(`ow ${counts.objs + 300} 0`, `ol ${counts.objs + 300} -1 0 1 0 -1`, 'ol -1 -1 0 1 0 -1');

    // ---- npcs ----
    const npcPick = new Map<number, NpcType>();
    const addNpcs = (list: Decoded<NpcType>[]): void => list.forEach(({ id, type }) => npcPick.set(id, type));
    addNpcs(some(npcs, ({ type }) => type.multi === null, 110));
    addNpcs(some(npcs, ({ type }) => type.headModels !== null && type.headModels.length >= 3, 6));
    addNpcs(some(npcs, ({ type }) => type.modelOffsets !== null, 6));
    addNpcs(some(npcs, ({ type }) => type.m_bodyList !== null && type.m_bodyList.includes(-1), 6));
    addNpcs(some(npcs, ({ type }) => type.m_bodyList !== null && type.m_bodyList.length === 1, 4));
    addNpcs(some(npcs, ({ type }) => type.m_bodyList === null && type.multi === null, 3));
    addNpcs(some(npcs, ({ type }) => type.retextureSource !== null, 6));
    addNpcs(some(npcs, ({ type }) => type.resizeH !== 128 || type.resizeV !== 128, 6));
    addNpcs(some(npcs, ({ type }) => type.headModels === null && type.multi === null, 4));
    const npcDummy = (): number => pick(NPC_DUMMIES);
    const noAnim = '-1 0 -1 0 -1 0 -1 0';
    // A slot array of length len with up to entries slot animations in slots below maxSlot (valid frames unless edges).
    const slotsArg = (len: number, entries: number, maxSlot = len, edges = false): string => {
        const parts: string[] = [`${len}`];
        const used = new Set<number>();
        for (let i = 0; i < entries; i++) {
            const slot = int(Math.max(1, Math.min(len, maxSlot)));
            if (used.has(slot) || slot >= len) continue;
            used.add(slot);
            parts.push(`${slot} ${seqArgs(edges)}`);
        }
        return parts.join(' ');
    };
    // Synthetic BAS transforms (the cache has none): the slot matrices (identity for the slots without a rotation,
    // rotated otherwise, none for the slots without a transform) are derived on the first build and used by the slot
    // animations; then the same type through the cached model (matrices kept). These run before any op that throws
    // mid-slot-loop, since such an op leaves its scratch entries set and every later call with slots replays them.
    const basNpcs = some(npcs, ({ id, type }) => type.multi === null && type.m_bodyList !== null && type.m_bodyList.length >= 2 && !npcPick.has(id), 14);
    const basSlots = basNpcs.map(({ id, type }, i) => {
        const parts = requireNonNull(type.m_bodyList).length;
        const len = Math.min(12, parts + (i % 3));
        const key = 7000 + i;
        const transforms: string[] = [];
        for (let slot = 0; slot < len; slot++) {
            if (slot % 4 === 3) continue;
            const rot = (): number => (slot % 3 === 0 ? 0 : int(2048));
            const shift = (): number => (slot % 2 === 0 ? 0 : int(80) - 40);
            // Slot 5: a translation along z alone.
            const move = slot === 5 ? `0 0 ${int(40) + 1}` : `${shift()} ${shift()} ${shift()}`;
            transforms.push(`${slot} ${move} ${rot()} ${rot()} ${rot()}`);
        }
        ops.push(`bas ${key} ${len} ${transforms.join(' ')}`, `nbas ${id} ${key}`);
        const inside = Math.min(parts, len);
        ops.push(`n ${id} -1 0 -1 0 -1 0 -1 0 ${npcDummy()} ${slotsArg(12, 4, inside)}`);
        ops.push(`n ${id} ${seqArgs(false)} ${seqArgs(false)} ${npcDummy()} ${slotsArg(12, 3, inside)}`);
        ops.push(`n ${id} ${seqArgs(false)} -1 0 -1 0 ${npcDummy()} ${slotsArg(i % 2 === 0 ? 14 : 3, 3, inside)}`);
        ops.push(`n ${id} -1 0 -1 0 ${seqArgs(false)} ${npcDummy()} ${slotsArg(12, 6, inside)}`);
        if (i % 4 === 0) ops.push('tween 1', `n ${id} ${seqArgs(false)} ${seqArgs(false)} ${npcDummy()} ${slotsArg(12, 4, inside)}`, 'tween 0');
        return { id, inside };
    });
    // Then slots past the body and past the BAS (aioobe on the matrices), and frames out of range.
    for (const { id } of basSlots) ops.push(`n ${id} -1 0 -1 0 -1 0 -1 0 ${npcDummy()} ${slotsArg(12, 3, 12, true)}`);
    // A slot array longer than the 14-entry scratch; a slot whose frame throws after an earlier slot was set up, then
    // calls that replay that stale entry (a short slot array with a primary seq, and no slot array at all).
    if (basSlots.length > 0) {
        const { id } = basSlots[0];
        const s = pool[0];
        ops.push(`n ${id} -1 0 -1 0 -1 0 -1 0 -90 15 14 ${s.id} 0 -1 0`);
        ops.push(`n ${id} -1 0 -1 0 -1 0 -1 0 -90 4 0 ${s.id} 0 -1 0 2 ${s.id} ${s.length} -1 0`);
        ops.push(`n ${id} ${s.id} 0 -1 0 -1 0 -1 0 -90 1`);
        ops.push(`n ${id} -1 0 -1 0 -1 0 -1 0 -90 -1`);
        ops.push(`n ${id} ${s.id} 0 -1 0 -1 0 -1 0 -90 2 1 ${s.id} 0 -1 0`);
    }
    k = 0;
    for (const [id] of npcPick) {
        k++;
        ops.push(`n ${id} ${noAnim} ${npcDummy()} -1`);
        ops.push(`n ${id} ${seqArgs()} -1 0 -1 0 ${npcDummy()} -1`);
        ops.push(`n ${id} -1 0 -1 0 ${seqArgs()} ${npcDummy()} -1`);
        const merge = k % 2 === 0 && masked.length > 0 ? pick(masked) : pick(pool);
        const [f, nx, c] = frameArgs(merge);
        ops.push(`n ${id} ${merge.id} ${f} ${nx} ${c} ${seqArgs()} ${npcDummy()} -1`);
        // Slot animations without BAS transforms: no slot matrices (the masked animate reads a null ib).
        if (k % 3 === 0) ops.push(`n ${id} ${noAnim} ${npcDummy()} 12`, `n ${id} ${seqArgs()} -1 0 -1 0 ${npcDummy()} ${slotsArg(12, 2, 12, true)}`);
        ops.push(`nh ${id} -1 0 -1 0 ${pick(HEAD_DUMMIES)}`, `nh ${id} ${seqArgs()} ${pick(HEAD_DUMMIES)}`);
    }
    // Tween on: next frames load and walk-merges tween both halves.
    ops.push('tween 1');
    for (const { id } of some(
        [...npcPick.entries()].map(([id, type]) => ({ id, type })),
        () => true,
        20
    )) {
        const merge = masked.length > 0 ? pick(masked) : pick(pool);
        const [f, nx, c] = frameArgs(merge);
        ops.push(`n ${id} ${merge.id} ${f} ${nx} ${c} ${seqArgs()} ${npcDummy()} -1`, `n ${id} ${seqArgs()} -1 0 -1 0 ${npcDummy()} -1`, `nh ${id} ${seqArgs()} 107`);
        // The same masked seq as both halves: both next frames share the primary's base, so each half tweens by its
        // own cycle (they differ).
        if (masked.length > 0) {
            const m = pick(masked);
            const [f1, n1] = frameArgs(m, false);
            const [f2, n2] = frameArgs(m, false);
            ops.push(`n ${id} ${m.id} ${f1} ${n1} ${1 + int(3)} ${m.id} ${f2} ${n2} ${4 + int(3)} ${npcDummy()} -1`);
        }
    }
    // Frames whose next frame is in another frameset, as the primary and as the secondary seq.
    for (const [i, { id }] of some(
        [...npcPick.entries()].map(([id, type]) => ({ id, type })),
        () => true,
        crossings.length
    ).entries()) {
        const c = crossings[i];
        ops.push(`n ${id} ${c.id} ${c.at} ${c.at + 1} 1 -1 0 -1 0 ${npcDummy()} -1`, `n ${id} -1 0 -1 0 ${c.id} ${c.at} ${c.at + 1} 1 ${npcDummy()} -1`);
        if (masked.length > 0) {
            const m = pick(masked);
            const [f1, n1, c1] = frameArgs(m, false);
            ops.push(`n ${id} ${m.id} ${f1} ${n1} ${c1 + 1} ${c.id} ${c.at} ${c.at + 1} 2 ${npcDummy()} -1`);
        }
        ops.push(`nh ${id} ${c.id} ${c.at} ${c.at + 1} 1 107`);
    }
    ops.push('tween 0');
    // Walk-merges whose secondary seq is special and primary is not (the special flag of the split animation).
    const specials = pool.filter(s => s.special && !s.masked);
    for (const { id } of some(
        [...npcPick.entries()].map(([id, type]) => ({ id, type })),
        () => true,
        8
    )) {
        if (masked.length === 0 || specials.length === 0) break;
        const m = pick(masked.filter(s => !s.special));
        const sp = pick(specials);
        const [f1, n1, c1] = frameArgs(m, false);
        const [f2, n2, c2] = frameArgs(sp, false);
        ops.push(`n ${id} ${m.id} ${f1} ${n1} ${c1} ${sp.id} ${f2} ${n2} ${c2} ${npcDummy()} -1`);
    }
    // Multinpcs: every selector value of their varp or varbit, including out-of-range ones (the last entry).
    const multis = [...some(npcs, ({ type }) => type.multi !== null && type.multiVarbit !== -1, 10), ...some(npcs, ({ type }) => type.multi !== null && type.multiVarp !== -1, 8)];
    for (const { id, type } of multis) {
        const multi = requireNonNull(type.multi);
        const values = [0, 1, multi.length - 2, multi.length - 1, multi.length, -1].filter((v, i, a) => a.indexOf(v) === i);
        for (const v of values) {
            if (type.multiVarbit !== -1) {
                const bytes = varbitArchive.GetFile(type.multiVarbit & 1023, type.multiVarbit >>> 10);
                const bit = new VarBitType();
                if (bytes !== null) bit.Decode(new PacketT(bytes));
                ops.push(`var ${bit.baseVar} ${(v & ((1 << (bit.endBit - bit.startBit + 1)) - 1)) << bit.startBit}`);
            } else {
                ops.push(`var ${type.multiVarp} ${v}`);
            }
            ops.push(`n ${id} ${seqArgs()} -1 0 -1 0 ${npcDummy()} -1`, `nh ${id} -1 0 -1 0 107`);
        }
    }
    // Palettes.
    const palNpcs = some(npcs, ({ id, type }) => type.multi === null && type.recolourSource !== null && type.recolourSource.length >= 2 && !npcPick.has(id), 6);
    ops.push('pal 1 104729');
    palNpcs.forEach(({ id, type }, i) => {
        ops.push(`tpal 1 ${id} ${i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : requireNonNull(type.recolourSource).length} ${i * 7 + 3}`);
        ops.push(`n ${id} ${noAnim} -90 -1`, `nh ${id} -1 0 -1 0 82`);
    });
    ops.push('pal 1 0', 'tex 0');
    for (const { id } of some(npcs, ({ type }) => type.retextureSource !== null, 3)) ops.push(`n ${id} ${noAnim} -90 -1`, `nh ${id} -1 0 -1 0 82`);
    ops.push('tex 1', `n ${counts.npcs + 200} ${noAnim} -90 -1`, `nh ${counts.npcs + 200} -1 0 -1 0 107`);

    // ---- locs ----
    const locPick = new Map<number, LocType>();
    const addLocs = (list: Decoded<LocType>[]): void => list.forEach(({ id, type }) => locPick.set(id, type));
    const modelled = locs.filter(({ type }) => type.modelIds !== null);
    addLocs(some(modelled, () => true, 70));
    for (let h = 1; h <= 5; h++) addLocs(some(modelled, ({ type }) => type.hillSkew === h, 6));
    addLocs(some(modelled, ({ type }) => type.hillParam !== -1, 5));
    addLocs(some(modelled, ({ type }) => type.hillParam !== -1 && type.shareLight, 3));
    addLocs(some(modelled, ({ type }) => type.hillParam !== -1 && type.hillSkew === 3, 3));
    addLocs(some(modelled, ({ type }) => type.shareLight && type.hillSkew !== 0, 5));
    addLocs(some(modelled, ({ type }) => type.mirror, 5));
    addLocs(some(modelled, ({ type }) => type.modelShapes === null && requireNonNull(type.modelIds).length >= 2, 8));
    addLocs(some(modelled, ({ type }) => type.modelShapes !== null && type.modelShapes.length >= 4, 5));
    addLocs(some(modelled, ({ type }) => type.offsetX !== 0 || type.offsetY !== 0 || type.offsetZ !== 0, 5));
    addLocs(some(modelled, ({ type }) => type.offsetZ !== 0 && type.offsetX === 0 && type.offsetY === 0, 3));
    addLocs(some(modelled, ({ type }) => type.mirror && type.modelShapes !== null && type.modelShapes.includes(2), 3));
    addLocs(some(modelled, ({ type }) => type.resizeX !== 128 || type.resizeY !== 128 || type.resizeZ !== 128, 5));
    addLocs(some(modelled, ({ type }) => type.retextureSource !== null, 4));
    for (const s of [2, 4, 10, 11]) addLocs(some(modelled, ({ type }) => type.modelShapes !== null && type.modelShapes.includes(s), 4));
    // Ground positions: on the map (fine units), its edges and off it; heightmap pairs (ground, second).
    const position = (hill: number): string => {
        const kind = int(8);
        if (hill === 0 && kind > 1) return `${64 + 128 * int(100)} ${-int(400)} ${64 + 128 * int(100)}`;
        const x = kind === 0 ? -64 : kind === 1 ? 103 * 128 + 64 : kind === 2 ? 64 : 64 + 128 * int(100);
        const z = kind === 3 ? -200 : kind === 4 ? 102 * 128 + 64 : 64 + 128 * int(100);
        const y = kind === 5 ? -200 : -int(600);
        return `${x} ${y} ${z}`;
    };
    const heightmaps = (): string => {
        const k2 = int(12);
        const ground = k2 === 0 ? -1 : k2 === 1 ? 2 : k2 === 2 ? 4 : k2 === 3 ? 3 : int(2);
        const second = k2 === 4 ? -1 : k2 === 5 ? 2 : k2 === 6 ? 4 : int(2);
        return `${second} ${ground}`;
    };
    const locDummy = (): number => pick(LOC_DUMMIES);
    k = 0;
    for (const [id, type] of locPick) {
        k++;
        const shapes = type.modelShapes !== null ? [...new Set(type.modelShapes)] : [10];
        if (k % 3 === 0) for (let shape = 0; shape <= 22; shape++) ops.push(`l ${id} ${shape} 0 ${shape & 1} ${position(type.hillSkew)} ${heightmaps()} ${locDummy()}`);
        for (const shape of shapes.slice(0, 4)) {
            for (let angle = 0; angle < 8; angle++) {
                for (let share = 0; share < 2; share++) ops.push(`l ${id} ${shape} ${angle} ${share} ${position(type.hillSkew)} ${heightmaps()} ${locDummy()}`);
            }
            for (let angle = 0; angle < 8; angle += k % 2 === 0 ? 1 : 3) ops.push(`lt ${id} ${shape} ${angle} -1 0 -1 0 ${position(type.hillSkew)} ${heightmaps().split(' ').reverse().join(' ')} 9`);
            const anim = type.animation !== -1 && pool.some(s => s.id === type.animation) ? requireNonNull(pool.find(s => s.id === type.animation)) : pick(pool);
            for (let i = 0; i < 3; i++) {
                const [f, nx, c] = frameArgs(anim);
                ops.push(`lt ${id} ${shape} ${int(8)} ${anim.id} ${f} ${nx} ${c} ${position(type.hillSkew)} ${heightmaps().split(' ').reverse().join(' ')} 9`);
            }
            // Tweened: the next frame and the cycle reach the animation.
            if (k % 4 === 0) {
                const [f, nx, c] = frameArgs(anim, false);
                ops.push('tween 1', `lt ${id} ${shape} ${int(8)} ${anim.id} ${f} ${nx} ${c + 1} ${position(type.hillSkew)} ${heightmaps().split(' ').reverse().join(' ')} 9`, 'tween 0');
            }
        }
        // The same key again: the cached model (and its now-computed bounds) is reused.
        ops.push(`l ${id} ${shapes[0]} 0 0 ${position(type.hillSkew)} ${heightmaps()} ${locDummy()}`, `lt ${id} ${shapes[0]} 1 -1 0 -1 0 ${position(type.hillSkew)} 0 1 9`);
    }
    // Hill-skewed locs over flat ground at their base height (returned unchanged) and with a null second map.
    for (const { id, type } of some(modelled, ({ type }) => type.hillSkew !== 0, 12)) {
        const shape = type.modelShapes !== null ? type.modelShapes[0] : 10;
        ops.push(`l ${id} ${shape} 0 0 1600 -200 1600 4 4 -46`, `l ${id} ${shape} 1 1 1600 -200 1600 -1 4 -46`, `lt ${id} ${shape} 2 -1 0 -1 0 1600 -200 1600 4 -1 9`);
        ops.push(`l ${id} ${shape} 0 0 1600 -200 1600 4 3 -46`, `lt ${id} ${shape} 0 -1 0 -1 0 1600 -100 1600 4 4 9`);
    }
    // Palettes.
    const palLocs = some(modelled, ({ id, type }) => type.recolourSource !== null && type.recolourSource.length >= 2 && !locPick.has(id), 6);
    ops.push('pal 2 15485863');
    palLocs.forEach(({ id, type }, i) => {
        const shape = type.modelShapes !== null ? type.modelShapes[0] : 10;
        ops.push(`tpal 2 ${id} ${i % 3 === 0 ? -1 : i % 3 === 1 ? 1 : requireNonNull(type.recolourSource).length} ${i * 11 + 1}`);
        ops.push(`l ${id} ${shape} 0 0 1600 -200 1600 0 1 -46`, `lt ${id} ${shape} 1 -1 0 -1 0 1600 -200 1600 0 1 9`);
    });
    ops.push('pal 2 0', 'tex 0');
    for (const { id, type } of some(modelled, ({ type }) => type.retextureSource !== null, 3)) {
        const shape = type.modelShapes !== null ? type.modelShapes[0] : 10;
        ops.push(`l ${id} ${shape} 0 0 1600 -200 1600 0 1 -46`, `l ${id} ${shape} 0 1 1600 -200 1600 0 1 -46`, `lt ${id} ${shape} 3 -1 0 -1 0 1600 -200 1600 0 1 9`);
    }
    ops.push('tex 1', 'entity', `l ${counts.locs + 500} 10 0 0 1600 -200 1600 0 1 -46`, `lt ${counts.locs + 500} 10 0 -1 0 -1 0 1600 -200 1600 0 1 9`);

    // ---- spots ----
    const spotPick = new Map<number, SpotType>();
    const addSpots = (list: Decoded<SpotType>[]): void => list.forEach(({ id, type }) => spotPick.set(id, type));
    addSpots(some(spots, () => true, 110));
    addSpots(some(spots, ({ type }) => type.rotation !== 0, 30));
    addSpots(some(spots, ({ type }) => type.resizeXZ !== 128 || type.resizeY !== 128, 10));
    addSpots(some(spots, ({ type }) => type.recolourSrc !== null, 8));
    addSpots(some(spots, ({ type }) => type.seq === -1, 5));
    k = 0;
    const seqById = new Map(usable.map(d => [d.id, seqInfo(d)]));
    for (const [id, type] of spotPick) {
        k++;
        ops.push(`sp ${id} -1 -1 0 ${pick(SPOT_DUMMIES)}`);
        const own = seqById.get(type.seq);
        for (let i = 0; i < 3; i++) {
            const [f, nx, c] = frameArgs(own ?? pick(pool));
            ops.push(`sp ${id} ${f} ${nx} ${c} ${pick(SPOT_DUMMIES)}`);
        }
        if (k % 5 === 0) ops.push('tween 1', `sp ${id} 0 1 1 -50`, 'tween 0');
    }
    ops.push('tex 0');
    for (const { id } of some(spots, () => true, 5)) ops.push(`sp ${id} 0 -1 0 -50`);
    ops.push('tex 1', `sp ${counts.spots + 300} -1 -1 0 -50`, 'entity');
    return { script: ops, counts };
}

test('LocEntity declares exactly wj.e, and the model holders start empty', () => {
    expect(Object.keys(new LocEntity())).toEqual(['model']);
    expect(new LocEntity().model).toBeNull();
});

test('config model providers (kl, ja, jb, li, wj) match client.jar over real cache definitions', () => {
    // The selection reads the archives through its own Js5 instances, with the JS5 statics at their <clinit> values.
    const { script, counts } = withClinitStatics([{ target: Js5, clinit: { strictValidation: false, maxContainerSize: 0 } }], generate);
    expect(counts.objs).toBeGreaterThan(14000);
    expect(counts.npcs).toBeGreaterThan(8000);
    expect(counts.locs).toBeGreaterThan(40000);
    const java = runOracle(script);
    expect(java.length).toBe(script.length);
    const ts = withClinitStatics(resets(), () => runTs(script));
    expect(ts.length).toBe(script.length);

    if (process.env.PC_DUMP) {
        writeFileSync(`${process.env.PC_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.PC_DUMP}.java`, java.join('\n') + '\n');
        writeFileSync(`${process.env.PC_DUMP}.ts`, ts.join('\n') + '\n');
    }
    const stats = new Map<string, number>();
    script.forEach((line, i) => {
        const key = `${line.split(' ')[0]}:${java[i].split(/[ |]/)[0]}${java[i].startsWith('ok | null') || java[i].startsWith('ok nullentity') || java[i].startsWith('ok shared | null') ? '-null' : ''}`;
        stats.set(key, (stats.get(key) ?? 0) + 1);
    });
    if (process.env.PC_STATS) console.log(script.length, Object.fromEntries([...stats.entries()].sort()));

    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 6; i++) {
        if (ts[i] === java[i]) continue;
        const a = java[i].split(' ');
        const b = ts[i].split(' ');
        let at = 0;
        while (at < a.length && a[at] === b[at]) at++;
        mismatches.push(`#${i} ${script[i]}\n  java: ${a.slice(Math.max(0, at - 3), at + 4).join(' ')}\n  ts:   ${b.slice(Math.max(0, at - 3), at + 4).join(' ')}`);
    }
    expect(mismatches).toEqual([]);

    // The script reaches what it claims to (read from the jar's output).
    const ok = (op: string, pattern: RegExp): number => script.filter((line, i) => line.startsWith(`${op} `) && pattern.test(java[i])).length;
    expect(ok('ow', /^ok \| cb#/)).toBeGreaterThan(100);
    expect(ok('ow', /^ok \| null/)).toBeGreaterThan(50);
    expect(ok('oh', /^ok \| cb#/)).toBeGreaterThan(50);
    expect(ok('oi', /^ok \| fc#/)).toBeGreaterThan(100);
    expect(ok('ol', /^ok \| fc#/)).toBeGreaterThan(200);
    expect(ok('n', /^ok \| fc#/)).toBeGreaterThan(400);
    expect(ok('n', / ib=#\d+:/)).toBeGreaterThan(20);
    expect(ok('nh', /^ok \| fc#/)).toBeGreaterThan(100);
    expect(ok('l', /^ok shared \| fc#/)).toBeGreaterThan(500);
    expect(ok('l', /^ok shared \| cb#/)).toBeGreaterThan(100);
    expect(ok('l', /^ok shared \| null/)).toBeGreaterThan(100);
    expect(ok('lt', /^ok shared \| fc#/)).toBeGreaterThan(300);
    expect(ok('lt', /^ok nullentity/)).toBeGreaterThan(0);
    expect(ok('sp', /^ok \| fc#/)).toBeGreaterThan(300);
    for (const c of ['aioobe', 'npe']) expect(java.some(line => line.startsWith(c))).toBe(true);
}, 600000);
