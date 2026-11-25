import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ByteArrayCopier from '../../src/cache/ByteArrayCopier.js';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import BASType from '../../src/config/BASType.js';
import BASTypeList from '../../src/config/BASTypeList.js';
import IdkType from '../../src/config/IdkType.js';
import NpcType from '../../src/config/NpcType.js';
import ObjType from '../../src/config/ObjType.js';
import SeqType from '../../src/config/SeqType.js';
import ActorSlotAnim from '../../src/dash3d/ActorSlotAnim.js';
import AnimFrame from '../../src/dash3d/AnimFrame.js';
import AnimFrameSet from '../../src/dash3d/AnimFrameSet.js';
import ModelLit from '../../src/dash3d/ModelLit.js';
import ModelLitImpl from '../../src/dash3d/ModelLitImpl.js';
import ModelUnlit from '../../src/dash3d/ModelUnlit.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import PlayerModel from '../../src/dash3d/PlayerModel.js';
import type TextureProvider from '../../src/dash3d/TextureProvider.js';
import HardReferenceNode from '../../src/datastruct/HardReferenceNode.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import type SecondaryNode from '../../src/datastruct/SecondaryNode.js';
import Crc32 from '../../src/io/Crc32.js';
import { arrayPut, requireNonNull } from '../../src/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { type StaticReset, withClinitStatics } from './staticState.js';

// Unit seqplayer against client.jar: SeqType's three animate methods (ek.a(IILnd;IIZ)Lnd; AnimateModel90,
// ek.a(IILnd;II)Lnd; AnimateModelWithExtra, ek.b(IILnd;II)Lnd; AnimateModel) and PlayerModel's three model builders
// (cl.a(IILek;IZ[Lci;IIZLek;I)Lnd; GetTempModel, cl.a(Lek;IIIIIBI)Lnd; getKitHeadModel, cl.a(IILek;II)Lnd;
// GetHeadModel), with the obj wear/head meshes (ObjType.GetWearModelNoCheck/GetHeadModelNoCheck), the IdkType meshes,
// BAS transforms, NpcType transforms and the model caches they use. A seeded script runs through
// test/review/provider-seqplayer/ProviderSeqPlayerOracle.java (javac'd next to client.jar, driving the real gamepack
// classes over the real sector cache) and through the TS port over the same archives; every result line must match.
//
// Each line holds the result (ok or the Java exception), the returned model's identity tag (and whether it is one of the
// three CopyForAnim scratch models) with a dump of every fc field, and the state after the call: the input model of an
// animate op (so an in-place change of a cached model shows), the player's fields (model key, cached key, BAS id, npc
// id, gender, BAS matrices, parts, colours), the LRU state of ten caches (key, value identity and age of every entry, in
// queue order: the PlayerModel body/chathead caches, the NpcType model caches and the seq, frame set, kit, obj, BAS and
// npc type caches, so the order of every config lookup is compared), the per-slot scratch of cl and ja, the CopyForAnim
// scratch lengths and the animation origin. "cdump" lines dump every cached model in full.
//
// Data: every seq of archive 20 is classified (chat frames, walk-merge masks, tween, special, held-item overrides
// including 65535) and swept frame by frame through the three animate methods on lit cache models and on player bodies
// and chatheads, with tweening forced on and off, next frames in and out of range, every rotation, cycles around the
// frame delay, bad frames, null models and undefined seqs. Players: both genders, default kits (null equipment), kit and
// wearable parts in random slots (including undefined kits/objs and both flag bits), both palette sets with colours in
// and out of range, real BAS ids (none of the cache's 1431 BAS types has part transforms, opcode 27) and synthetic BAS
// types with transforms put in the BAS cache on both sides (identity, rotated and offset parts, null rows, 6 and 14 rows,
// rotations outside the sin/cos tables, short rows), npc transforms, slot animations (null entries, more slots than the
// BAS has, more than 14, undefined seqs), seq + walk SplitAnimate with masks, held-item overrides, cache off, check off,
// setColour / setKit / setFemale key changes, withheld model groups (the loading paths and the cachedModelKey fallback),
// kit chatheads and cache clears. Synthetic seqs over real frames (op seqdef, put in the seq cache on both sides) reach
// what no seq of the cache has: chat frames of 65535, chat frames at the index the tween remapping leaves in var2, and
// tweened frames from two frame sets (the next set is fetched as group 0, as in the bytecode). Withheld frame groups
// make frame sets fail to load in every animate path.
//
// Sensitivity: 53 of 60 single-statement mutations of the six methods make this test fail. The survivors are
// unobservable in the SD client or with this cache: the seq "special" flag (ek.L) in the CopyForAnim calls and in
// Animate/SplitAnimate (fc ignores it; it only matters to the HD renderer), the chat tween target's colour flag (no frame
// of the cache animates colours), & 65535 -> & 32767 on frame file ids and the sign of kit2 << 16 in the kit chathead key
// (all ids are below 32768), and a +16384 -> +16383 rounding in the BAS matrix (differs only on products = 16384 mod
// 32768).
//
// PROVIDER_SEQPLAYER_STATS=1 prints per-operation result counts and the paths reached; PROVIDER_SEQPLAYER_DUMP=<prefix>
// writes the script and both outputs; PROVIDER_SEQPLAYER_TRACE=<line> prints the stack of the TS exception on that script
// line.

type Statics = Record<string, unknown>;

const FIELDS: [string, string][] = [
    ['l', 'faceColourA'],
    ['m', 'relightPending'],
    ['n', 'faceTextureM'],
    ['o', 'maxZ'],
    ['p', 'minY'],
    ['q', 'pointY'],
    ['r', 'faceVertexA'],
    ['s', 'radiusSphere'],
    ['t', 'faceColour'],
    ['u', 'facePartMask'],
    ['v', 'pointZ'],
    ['w', 'maxY'],
    ['x', 'faceTextureAxis'],
    ['y', 'numFaces'],
    ['z', 'faceTextureP'],
    ['A', 'priority'],
    ['B', 'maxX'],
    ['C', 'radiusCylinder'],
    ['D', 'numPoints'],
    ['E', 'faceMaterial'],
    ['F', 'numT'],
    ['G', 'pointPartMask'],
    ['H', 'faceTextureN'],
    ['I', 'facePriority'],
    ['J', 'faceVertexC'],
    ['K', 'boundsCalculated'],
    ['L', 'faceColourC'],
    ['M', 'faceColourB'],
    ['N', 'faceVertexB'],
    ['Q', 'minX'],
    ['R', 'faceAlpha'],
    ['S', 'minZ'],
    ['U', 'pointX'],
    ['Y', 'labelVertices'],
    ['Z', 'labelFaces']
];

const TEMPS: [string, string][] = [
    ['T', 'tempActorFaceAlpha'],
    ['P', 'tempActorFaceColour'],
    ['O', 'tempActorFaceColourA'],
    ['X', 'tempActorFaceColourB'],
    ['W', 'tempActorFaceColourC'],
    ['db', 'tempSpotFaceAlpha'],
    ['eb', 'tempSpotFaceColour'],
    ['bb', 'tempSpotFaceColourA'],
    ['ab', 'tempSpotFaceColourB'],
    ['fb', 'tempSpotFaceColourC'],
    ['hb', 'tempLocFaceAlpha'],
    ['Lb', 'tempLocFaceColour'],
    ['Nb', 'tempLocFaceColourA'],
    ['jb', 'tempLocFaceColourB'],
    ['zb', 'tempLocFaceColourC']
];

const impl = ModelLitImpl as unknown as Statics;

function hashInts(a: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0;
    return h;
}

function longHash(v: bigint): number {
    const u = BigInt.asUintN(64, v);
    return Number(BigInt.asIntN(32, u ^ (u >> 32n)));
}

// ---- identity tags (ProviderSeqPlayerOracle.tag) ----

const tags = new Map<object, number>();

function tag(o: object | null): number {
    if (o === null) return 0;
    let t = tags.get(o);
    if (t === undefined) {
        t = tags.size + 1;
        tags.set(o, t);
    }
    return t;
}

function value(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (v instanceof Int32Array || v instanceof Int16Array) return `${v.length}:${hashInts(v)}`;
    if (v instanceof Uint8Array) {
        let h = 1;
        for (let i = 0; i < v.length; i++) h = (Math.imul(h, 31) + ((v[i] << 24) >> 24)) | 0;
        return `${v.length}:${h}`;
    }
    if (v instanceof BigInt64Array) {
        let h = 1;
        for (let i = 0; i < v.length; i++) h = (Math.imul(h, 31) + longHash(v[i])) | 0;
        return `${v.length}:${h}`;
    }
    if (Array.isArray(v)) {
        let h = 1;
        if (v.some(e => typeof e === 'boolean')) {
            for (const e of v) h = (Math.imul(h, 31) + (e ? 1 : 0)) | 0;
        } else if (v.some(e => e instanceof Int32Array || e instanceof Int16Array)) {
            // int[][] / short[][]: a null row adds 0, like a null element of an Object[] (tag 0).
            for (const row of v as (Int32Array | Int16Array | null)[]) h = (Math.imul(h, 31) + (row === null ? 0 : (Math.imul(31, row.length) + hashInts(row)) | 0)) | 0;
        } else {
            for (const e of v as (object | null)[]) h = (Math.imul(h, 31) + tag(e)) | 0;
        }
        return `${v.length}:${h}`;
    }
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v instanceof ModelLitImpl) return 'fc';
    return String(v);
}

function dump(model: object | null): string {
    if (model === null) return 'nullmodel';
    if (!(model instanceof ModelLitImpl)) return `class:${model.constructor.name}`;
    const f = model as unknown as Statics;
    return FIELDS.map(([obf, name]) => `${obf}=${value(f[name])} `).join('') + `j=${value(model.useAABBMouseCheck)}`;
}

function ident(r: ModelLit | null): string {
    if (r === null) return 'null';
    const which = r === impl['tempActorModel'] ? 'k' : r === impl['tempSpotModel'] ? 'V' : r === impl['tempLocModel'] ? 'cb' : '';
    return `#${tag(r)}${which}`;
}

function origin(): string {
    return ` o=${impl['originX']},${impl['originY']},${impl['originZ']},${impl['originTransformPending'] ? 1 : 0}`;
}

function tempLengths(): string {
    return (
        ' temps' +
        TEMPS.map(([obf, name]) => {
            const t = impl[name] as ArrayLike<number> | null;
            return ` ${obf}=${t === null ? 'null' : t.length}`;
        }).join('')
    );
}

interface CacheShape {
    m_cacheSize: number;
    remaining: number;
    queue: { sentinel: SecondaryNode };
}

// ProviderSeqPlayerOracle.cache: capacity:remaining:count:hash over the LRU queue from the eldest entry.
function cache(c: LRUHashCache<object>): string {
    const shape = c as unknown as CacheShape;
    const sentinel = shape.queue.sentinel;
    let count = 0;
    let h = 1;
    for (let node = requireNonNull(sentinel.secondaryNext); node !== sentinel; node = requireNonNull(node.secondaryNext)) {
        h = (Math.imul(h, 31) + longHash(node.key)) | 0;
        h = (Math.imul(h, 31) + (node instanceof HardReferenceNode ? tag((node as HardReferenceNode<object>).get()) : -1)) | 0;
        h = (Math.imul(h, 31) + longHash(node.secondaryKey)) | 0;
        count++;
    }
    return `${shape.m_cacheSize}:${shape.remaining}:${count}:${h}`;
}

function caches(): string {
    return (
        ` S=${cache(PlayerModel.modelCache2)} U=${cache(PlayerModel.modelCache)} Nk=${cache(NpcType.m_modelCache)} Nh=${cache(NpcType.headModelCache)}` +
        ` seq=${cache(SeqType.m_recentUse)} anim=${cache(AnimFrameSet.cache)} idk=${cache(IdkType.m_recentUse)} obj=${cache(ObjType.types)}` +
        ` bas=${cache(BASTypeList.types)} npc=${cache(NpcType.m_recentUse)}`
    );
}

function scratch(): string {
    return (
        ` cf.j=${value(PlayerModel.layerSeqs)} wk.b=${value(PlayerModel.slotFramesets)} ec.x=${value(PlayerModel.layerFrameIds)}` +
        ` kj.Y=${value(PlayerModel.slotNextFramesets)} ob.Hb=${value(PlayerModel.slotNextFrames)} jk.r=${value(PlayerModel.layerFrameDelays)}` +
        ` qj.r=${value(PlayerModel.layerFrameCycles)} sb.b=${value(NpcType.slotSeqs)} qh.f=${value(NpcType.layerFramesets)}` +
        ` jl.j=${value(NpcType.layerFrameIds)} pj.A=${value(NpcType.slotNextFramesets)} ge.R=${value(NpcType.layerNextFrames)}` +
        ` pg.P=${value(NpcType.slotFrameCycles)} tb.y=${value(NpcType.slotFrameDelays)}`
    );
}

interface PlayerShape {
    modelKey: bigint;
    cachedModelKey: bigint;
    basId: number;
    npcId: number;
    female: boolean;
    basTransforms: (Int32Array | null)[] | null;
    equipment: Int32Array | null;
    colours: Int32Array | null;
}

function player(p: PlayerModel | null): string {
    if (p === null) return 'nullplayer';
    const s = p as unknown as PlayerShape;
    return `o=${s.modelKey} t=${s.cachedModelKey} i=${s.basId} k=${s.npcId} m=${s.female ? 1 : 0} y=${value(s.basTransforms)} b=${value(s.equipment)} z=${value(s.colours)}`;
}

function initial(): string {
    return (
        ` pk.c=${value(PlayerModel.recolourDestinationsRs)} gk.b=${value(PlayerModel.recolourDestinationsAlt)} gk.o=${value(PlayerModel.recolourDestinations2Alt)}` +
        ` ik.Z=${value(PlayerModel.recolourSourcesRs)} uh.Y=${value(PlayerModel.recolourSourcesAlt)} lh.e=${value(PlayerModel.recolourSources2Rs)}` +
        ` gj.U=${value(PlayerModel.recolourSources2Alt)} ie.J=${value(PlayerModel.recolourDestinations2Rs)} m.C=${value(PlayerModel.recolourDestinations)}` +
        ` sa.u=${value(PlayerModel.recolourSources)} wg.b=${value(PlayerModel.recolourSources2)} ij.j=${value(PlayerModel.recolourDestinations2)}` +
        ` ja.g=${value(PlayerModel.crc64Table)} kf.p=${value(PlayerModel.femaleBodyParts)} ph.k=${value(PlayerModel.maleKitBodyParts)}` +
        ` rb.g=${value(PlayerModel.partToSlot)} qf.b=${SeqType.forceTween ? 1 : 0}` +
        caches() +
        scratch() +
        tempLengths() +
        origin()
    );
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

// ProviderSeqPlayerOracle.Textures: the lighting reaches only isAvailable.
const textures: TextureProvider = {
    getTextureSmall: id => id % 3 !== 0,
    isAvailable: id => id % 7 !== 3,
    getPixels: () => null,
    isLoaded: () => true,
    getTextureData: () => null,
    getTextureColour: id => (Math.imul(id, 0x1f3d) + 0x123) & 0xffff,
    getTextureSolid: id => (id & 1) === 0
};

// ---- archives (ProviderSeqPlayerOracle.Provider) ----

const groupCache = new Map<string, Uint8Array | null>();

// The JS5 container without the two-byte version trailer; null when the sector files do not hold the group.
function fetchGroup(archive: number, group: number): Uint8Array | null {
    const key = `${archive}/${group}`;
    if (!groupCache.has(key)) {
        let bytes: Uint8Array | null = null;
        try {
            const raw = readGroup(cachePath, archive, group);
            if (raw.length >= 5) {
                const length = (raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4];
                const total = (raw[0] === 0 ? 5 : 9) + length;
                if (length >= 0 && total <= raw.length) bytes = raw.slice(0, total);
            }
        } catch {
            bytes = null;
        }
        groupCache.set(key, bytes);
    }
    const bytes = groupCache.get(key) ?? null;
    return bytes === null ? null : bytes.slice();
}

class SectorProvider extends Js5ResourceProvider {
    readonly table: Js5Index;
    readonly withheld = new Set<number>();
    // Every group divisible by mod is withheld too (0: none).
    mod = 0;
    // Requests for a withheld group (not in the oracle: the test's evidence that a loading path ran).
    withheldHits = 0;

    constructor(readonly archive: number) {
        super();
        const ref = requireNonNull(fetchGroup(255, archive));
        this.table = new Js5Index(ref, Crc32.prefix(ref, ref.length));
    }

    index(): Js5Index | null {
        return this.table;
    }

    group(_mode: number, group: number): Uint8Array | null {
        if (this.withheld.has(group) || (this.mod > 0 && group % this.mod === 0)) {
            this.withheldHits++;
            return null;
        }
        return fetchGroup(this.archive, group);
    }

    prefetchGroup(_group: number): void {}

    GetGroupLoadPercentage(_group: number): number {
        return 100;
    }
}

interface Archives {
    frames: Js5;
    bases: Js5;
    config: Js5;
    framesProvider: SectorProvider;
    models: Js5;
    modelsProvider: SectorProvider;
    npcs: Js5;
    objs: Js5;
    seqs: Js5;
}

// The oracle's archives and config Init calls. cached = false gives the oracle's flags (config archives keep their
// unpacked files; frames, bases and models discard both copies); the fixture scan keeps everything.
function openArchives(cached: boolean): Archives {
    const modelsProvider = new SectorProvider(7);
    const framesProvider = new SectorProvider(0);
    const a: Archives = {
        frames: new Js5(framesProvider, !cached, !cached),
        framesProvider,
        bases: new Js5(new SectorProvider(1), !cached, !cached),
        config: new Js5(new SectorProvider(2), false, false),
        models: new Js5(modelsProvider, !cached, !cached),
        modelsProvider,
        npcs: new Js5(new SectorProvider(18), false, false),
        objs: new Js5(new SectorProvider(19), false, false),
        seqs: new Js5(new SectorProvider(20), false, false)
    };
    SeqType.Init(a.seqs, a.bases, a.frames);
    IdkType.Init(a.config, a.models);
    ObjType.Init(a.objs, true, null, a.models);
    NpcType.Init(a.npcs, a.models);
    BASTypeList.init(a.config);
    Pix3D.textureProvider = textures;
    return a;
}

// ---- static state: the fresh-JVM values of everything the script reads or writes ----

function rows(count: number, length: number): Int32Array[] {
    return Array.from({ length: count }, () => new Int32Array(length));
}

function nulls<T>(n: number): (T | null)[] {
    return new Array<T | null>(n).fill(null);
}

// fc.<clinit> (as in model-lit.test.ts).
function modelLitImplClinit(): Statics {
    return {
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
        faceClippedX: new Array<boolean>(4096).fill(false),
        tmpPriority10FaceDepth: new Int32Array(4096),
        extendedDepthBucketCount: 0,
        faceNearClipped: new Array<boolean>(4096).fill(false),
        vertexViewSpaceY: new Int32Array(4096),
        vertexScreenZ: new Int32Array(4096),
        tmpPriority11FaceDepth: new Int32Array(4096),
        tmpPriorityFaces: rows(12, 4096),
        deferredParticleIndices: new Int32Array(8192),
        vertexViewSpaceX: new Int32Array(4096),
        useQuickSort: false,
        tmpPriorityDepthSum: new Int32Array(12),
        originTransformPending: false,
        tempLocFaceColour: new Int16Array(1),
        tempLocFaceColourC: new Int32Array(1),
        clippedX: new Int32Array(10),
        sortFaceDepths: null,
        sortFaceIndices: null,
        tmpDepthFaceCount: new Int32Array(1600),
        tmpDepthFaces: rows(1600, 64),
        tmpExtendedDepthFaceCount: new Int32Array(32),
        tmpExtendedDepthFaces: rows(32, 512),
        tmpPriorityFaceCount: new Int32Array(12),
        clippedColour: new Int32Array(10),
        clippedY: new Int32Array(10),
        vertexViewSpaceZ: new Int32Array(4096),
        vertexScreenX: new Int32Array(4096),
        vertexScreenY: new Int32Array(4096),
        tempLocFaceColourA: new Int32Array(1),
        originX: 0,
        originY: 0,
        originZ: 0,
        mouseX: 0
    };
}

// dc.<clinit> (as in model-lit.test.ts).
function pix3dClinit(): Statics {
    const sin = new Int32Array(2048);
    const cos = new Int32Array(2048);
    for (let i = 0; i < 2048; i++) {
        sin[i] = (65536.0 * Math.sin(i * 0.0030679615)) | 0;
        cos[i] = (65536.0 * Math.cos(i * 0.0030679615)) | 0;
    }
    const div = new Int32Array(512);
    for (let i = 1; i < 512; i++) div[i] = (32768 / i) | 0;
    const div2 = new Int32Array(2048);
    for (let i = 1; i < 2048; i++) div2[i] = (65536 / i) | 0;
    return {
        divTable: div,
        lowDetail: true,
        textureFallback: false,
        cosTable: cos,
        divTable2: div2,
        lowMemTexture: false,
        opaque: false,
        sinTable: sin,
        scanline: new Int32Array(1024),
        trans: 0,
        colourTable: new Int32Array(65536),
        brightness: 1.0,
        hclip: false,
        originY: 0,
        originX: 0,
        width: 0,
        height: 0,
        textureProvider: null,
        clipMinX: 0,
        clipMaxX: 0,
        clipMinY: 0,
        clipMaxY: 0
    };
}

function resets(): StaticReset[] {
    const pix = pix3dClinit();
    return [
        {
            // gl.u = new ve(5), vk.S = new ve(260), the seven 14-entry scratch arrays and the palettes the client
            // selects at startup (null until then).
            target: PlayerModel,
            clinit: {
                modelCache: new LRUHashCache<ModelLit>(5),
                modelCache2: new LRUHashCache<ModelLit>(260),
                layerSeqs: nulls<SeqType>(14),
                slotFramesets: nulls<AnimFrameSet>(14),
                layerFrameIds: new Int32Array(14),
                slotNextFramesets: nulls<AnimFrameSet>(14),
                slotNextFrames: new Int32Array(14),
                layerFrameDelays: new Int32Array(14),
                layerFrameCycles: new Int32Array(14),
                recolourDestinations: null,
                recolourSources: null,
                recolourSources2: null,
                recolourDestinations2: null
            }
        },
        { target: SeqType, clinit: { m_pConfigClient: null, m_recentUse: new LRUHashCache<SeqType>(64), forceTween: false } },
        { target: AnimFrameSet, clinit: { basesArchive: null, framesArchive: null, cache: new LRUHashCache<AnimFrameSet>(100) } },
        {
            target: AnimFrame,
            clinit: { tempTz: new Int16Array(500), tempTi: new Int16Array(500), tempTx: new Int16Array(500), tempFlags: new Uint8Array(500), tempPrevOrigin: new Int16Array(500), tempTy: new Int16Array(500) }
        },
        { target: IdkType, clinit: { m_recentUse: new LRUHashCache<IdkType>(64), m_numDefinitions: 0, m_pConfigClient: null, m_pModels: null } },
        {
            target: ObjType,
            clinit: {
                m_memServer: false,
                m_pConfigClient: null,
                m_pModels: null,
                types: new LRUHashCache<ObjType>(64),
                modelCache: new LRUHashCache<object>(50),
                spriteCache: new LRUHashCache<object>(100),
                m_numDefinitions: 0,
                wearables: null,
                inventoryOps: null,
                groundOps: null,
                m_countFont: null
            }
        },
        {
            target: NpcType,
            clinit: {
                m_pConfigClient: null,
                m_pModels: null,
                m_recentUse: new LRUHashCache<NpcType>(64),
                m_modelCache: new LRUHashCache<object>(50),
                headModelCache: new LRUHashCache<object>(5),
                clientPalette: new Int16Array(256),
                slotSeqs: nulls<SeqType>(14),
                layerFramesets: nulls<AnimFrameSet>(14),
                layerFrameIds: new Int32Array(14),
                slotNextFramesets: nulls<AnimFrameSet>(14),
                layerNextFrames: new Int32Array(14),
                slotFrameCycles: new Int32Array(14),
                slotFrameDelays: new Int32Array(14)
            }
        },
        { target: BASTypeList, clinit: { archive: null, types: new LRUHashCache<object>(64) } },
        { target: ModelLitImpl, clinit: modelLitImplClinit() },
        { target: ModelLit, clinit: { pickedCount: 0, checkHover: false, pickedTypecodes: new BigInt64Array(1000), mouseY: 0 } },
        { target: Pix3D, clinit: pix },
        { target: ModelUnlit, clinit: { shareMap: new Int32Array(10000), shareTic: 0, shareMap2: new Int32Array(10000), cos: pix['cosTable'], sin: pix['sinTable'] } },
        { target: Js5, clinit: { maxContainerSize: 0, strictValidation: false } },
        { target: ByteArrayCopier, clinit: { directBufferUnavailable: false } }
    ];
}

// ---- oracle ----

function runOracle(script: string[]): string[] {
    const out = resolve(import.meta.dir, '../../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'provider-seqplayer-oracle-'));
    try {
        const source = fileURLToPath(new URL('./provider-seqplayer/ProviderSeqPlayerOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(build.stderr.toString());
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Xss8m', '-cp', gamepackPath + delimiter + scratch, 'ProviderSeqPlayerOracle', cachePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`ProviderSeqPlayerOracle exited ${run.exitCode}: ${run.stderr.toString()}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

// ---- fixture: the real data the script draws from ----

interface SeqInfo {
    id: number;
    delays: number[];
    chat: boolean;
    mask: boolean;
    tween: boolean;
    special: boolean;
    held: boolean;
}

interface KitInfo {
    id: number;
    bodyPart: number;
    models: number[];
    heads: number[];
}

interface ObjInfo {
    id: number;
    wear: boolean;
    head: boolean;
    models: number[];
}

interface Info {
    seqs: SeqInfo[];
    seqLimit: number;
    kits: KitInfo[];
    kitCount: number;
    objs: ObjInfo[];
    objCount: number;
    basCount: number;
    npcs: number[];
    modelIds: number[];
    // Frame sets the seqs use: their frame files, and those that animate colours or transparencies.
    frameSets: { group: number; files: number[]; flagged: number[] }[];
}

function fixture(): Info {
    const a = openArchives(true);
    const groupIds = (archive: number): Int32Array => requireNonNull(new SectorProvider(archive).table.groupIds);

    const seqs: SeqInfo[] = [];
    let seqLimit = 0;
    for (const group of groupIds(20)) {
        for (const file of requireNonNull(a.seqs.GetFileList(group))) {
            const id = (group << 7) | file;
            seqLimit = Math.max(seqLimit, id + 1);
            const s = SeqType.List(id);
            if (s.frames === null || s.delays === null || s.frames.length === 0) continue;
            seqs.push({
                id,
                delays: Array.from(s.delays),
                chat: s.chatFrames !== null,
                mask: s.mask !== null,
                tween: s.tween,
                special: s.special,
                held: s.m_replaceHeldLeft >= 0 || s.m_replaceHeldRight >= 0
            });
        }
    }

    const kits: KitInfo[] = [];
    for (let id = 0; id < IdkType.m_numDefinitions; id++) {
        const k = IdkType.List(id);
        kits.push({ id, bodyPart: k.bodyPart, models: k.models === null ? [] : Array.from(k.models), heads: Array.from(k.headModels).filter(m => m !== -1) });
    }

    const objs: ObjInfo[] = [];
    for (let id = 0; id < ObjType.m_numDefinitions; id++) {
        const o = ObjType.List(id);
        const wear = o.maleWear >= 0 || o.femaleWear >= 0;
        const head = o.maleHead >= 0 || o.femaleHead >= 0;
        if (!wear && !head) continue;
        const models = [o.maleWear, o.maleWear2, o.maleWear3, o.femaleWear, o.femaleWear2, o.femaleWear3, o.maleHead, o.maleHead2, o.femaleHead, o.femaleHead2].filter(m => m >= 0);
        objs.push({ id, wear, head, models });
    }

    const basFiles = requireNonNull(a.config.GetFileList(32));

    const npcs: number[] = [];
    for (const group of groupIds(18)) {
        for (const file of requireNonNull(a.npcs.GetFileList(group))) {
            const id = (group << 7) | file;
            const n = NpcType.List(id);
            if (n.multi === null && n.m_bodyList !== null && id % 7 === 0) npcs.push(id);
        }
    }

    // Lit-model sources for the animate sweep: kit and wear models (labelled for the player animations), npc body
    // models and a spread of other model groups.
    const modelIds = new Set<number>();
    for (const k of kits) for (const m of k.models) modelIds.add(m);
    for (const o of objs.slice(0, 400)) for (const m of o.models) modelIds.add(m);
    const groups = groupIds(7);
    for (let i = 0; i < groups.length; i += 997) modelIds.add(groups[i]);

    const frameSets: Info['frameSets'] = [];
    const seen = new Set<number>();
    for (const s of seqs) {
        for (const frame of requireNonNull(SeqType.List(s.id).frames)) {
            const group = frame >>> 16;
            if (seen.has(group) || seen.size >= 1500) continue;
            seen.add(group);
            const set = AnimFrameSet.get(group);
            if (set === null) continue;
            const files: number[] = [];
            const flagged: number[] = [];
            set.frames.forEach((f, file) => {
                if (f === null) return;
                files.push(file);
                if (f.animateColours || f.animateTransparencies) flagged.push(file);
            });
            if (files.length > 0 && (flagged.length > 0 || frameSets.length < 60)) frameSets.push({ group, files, flagged });
        }
    }

    return {
        seqs,
        seqLimit,
        kits,
        kitCount: IdkType.m_numDefinitions,
        objs,
        objCount: ObjType.m_numDefinitions,
        basCount: basFiles.length,
        npcs,
        modelIds: [...modelIds],
        frameSets
    };
}

// ---- script ----

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

const MALE_PARTS = [0, 1, 2, 3, 4, 5, 6, 14];
const FEMALE_PARTS = [7, 8, 9, 10, 11, 12, 13, 15];
// rb.g: the equipment slot of each of the eight kit parts.
const PART_SLOT = [8, 11, 4, 6, 9, 7, 10, 0];

function generateScript(info: Info): string[] {
    const random = rng(0x530cafe);
    const int = (n: number): number => (random() >>> 0) % n;
    const chance = (p: number): boolean => (random() >>> 0) / 4294967296 < p;
    const pick = <T>(a: T[]): T => {
        if (a.length === 0) throw new Error('empty fixture list');
        return a[int(a.length)];
    };

    const kitsByPart = new Map<number, KitInfo[]>();
    for (const k of info.kits) {
        if (k.models.length === 0) continue;
        const list = kitsByPart.get(k.bodyPart) ?? [];
        list.push(k);
        kitsByPart.set(k.bodyPart, list);
    }
    const headKits = info.kits.filter(k => k.heads.length > 0);
    const wearObjs = info.objs.filter(o => o.wear);
    const headObjs = info.objs.filter(o => o.head);
    const chatSeqs = info.seqs.filter(s => s.chat);
    const maskSeqs = info.seqs.filter(s => s.mask);
    const heldSeqs = info.seqs.filter(s => s.held);
    const tweenSeqs = info.seqs.filter(s => s.tween);
    const specialSeqs = info.seqs.filter(s => s.special);
    const kitById = new Map(info.kits.map(k => [k.id, k]));
    const objById = new Map(info.objs.map(o => [o.id, o]));

    const anySeq = (): SeqInfo => {
        const r = int(100);
        if (r < 12) return pick(chatSeqs);
        if (r < 24) return pick(maskSeqs);
        if (r < 34) return pick(heldSeqs);
        if (r < 42 && tweenSeqs.length > 0) return pick(tweenSeqs);
        if (r < 48 && specialSeqs.length > 0) return pick(specialSeqs);
        return pick(info.seqs);
    };
    // Mostly a frame of the seq; now and then one past the end or -1.
    const frameOf = (s: SeqInfo): number => {
        const r = int(100);
        if (r < 2) return s.delays.length;
        if (r < 3) return -1;
        return int(s.delays.length);
    };
    // The tween target: mostly the following frame (wrapping), else none, the end, out of range or any frame.
    const nextOf = (s: SeqInfo, f: number): number => {
        const len = s.delays.length;
        const r = int(100);
        if (r < 60) return f + 1 < len ? f + 1 : 0;
        if (r < 70) return -1;
        if (r < 78) return f + 1;
        if (r < 84) return len + int(3);
        return int(len);
    };
    // Around the frame delay (the tween ratio), with zero, past-the-end and negative cycles.
    const cycleOf = (s: SeqInfo, f: number): number => {
        const d = f >= 0 && f < s.delays.length ? s.delays[f] : 4;
        const r = int(100);
        if (r < 5) return 0;
        if (r < 12) return d + 1 + int(3);
        if (r < 14) return -int(3);
        return 1 + int(Math.max(1, d));
    };
    const undefinedSeq = (): number => info.seqLimit + int(200);

    // Synthetic seqs over real frames (op seqdef), for what no seq of the cache has: chat frames of 65535 and chat frames
    // (at the index the tween remapping leaves in var2) that animate colours or transparencies when the main frame does
    // not ('chat'), and tweened frames from two frame sets, the next frame's set fetched as group 0 ('split').
    const flaggedSets = info.frameSets.filter(f => f.flagged.length > 0);
    let synthetic = 0;
    const syntheticSeq = (kind: 'chat' | 'split'): SeqInfo => {
        const id = 30000 + (synthetic++ % 64);
        const n = 2 + int(8);
        const frameIn = (set: Info['frameSets'][number], flaggedBias: number): number => (set.group << 16) | (set.flagged.length > 0 && chance(flaggedBias) ? pick(set.flagged) : pick(set.files));
        const frames: number[] = [];
        let chat: number[] | null = null;
        let mask: number[] | null = null;
        if (kind === 'chat') {
            const set = pick(info.frameSets);
            for (let i = 0; i < n; i++) frames.push(frameIn(set, 0.2));
            chat = [];
            const len = 64 + int(40);
            for (let i = 0; i < len; i++) chat.push(chance(0.2) ? 65535 : frameIn(pick(flaggedSets), 0.7));
        } else {
            const a = pick(info.frameSets);
            const b = pick(info.frameSets);
            for (let i = 0; i < n; i++) frames.push(frameIn(i % 2 === 0 ? a : b, 0.3));
            if (chance(0.6)) mask = Array.from({ length: 1 + int(12) }, () => int(256));
        }
        const delays = frames.map(() => 1 + int(6));
        const tween = chance(0.8);
        const special = chance(0.2);
        const held = (): number => (chance(0.85) ? -1 : chance(0.3) ? 65535 : pick(wearObjs).id);
        const heldLeft = held();
        const heldRight = held();
        out.push(`seqdef ${id} ${frames.join(',')} ${delays.join(',')} ${chat === null ? 'null' : chat.join(',')} ${mask === null ? 'null' : mask.join(',')} ${tween ? 1 : 0} ${special ? 1 : 0} ${heldLeft} ${heldRight}`);
        return { id, delays, chat: chat !== null, mask: mask !== null, tween, special, held: heldLeft >= 0 || heldRight >= 0 };
    };

    // Synthetic BAS types with part transforms (no BAS type of the cache has opcode 27): 12 rows mostly, null rows,
    // offsets only, rotations (zero, in the 2048-entry tables, past them, negative), short rows, 6 and 14 rows.
    const SYNTHETIC_BAS = 9000;
    const basSpecs: string[] = [];
    for (let b = 0; b < 10; b++) {
        const len = b < 8 ? 12 : b === 8 ? 6 : 14;
        const rows: string[] = [];
        for (let i = 0; i < len; i++) {
            if (chance(0.25)) {
                rows.push('n');
                continue;
            }
            const offset = (): number => (chance(0.3) ? 0 : int(200) - 100);
            const r = int(100);
            let rot: number[];
            if (r < 30) rot = [0, 0, 0];
            else if (r < 85 || b !== 7) rot = [chance(0.2) ? 0 : int(2048), chance(0.2) ? 0 : int(2048), chance(0.2) ? 0 : int(2048)];
            else if (r < 93) rot = [int(2048), 2048 + int(100), int(2048)];
            else rot = [-1 - int(10), int(2048), int(2048)];
            // The bad type also has short rows (mg.B[i][3] throws).
            rows.push((b === 7 && chance(0.08) ? [offset(), offset(), offset()] : [offset(), offset(), offset(), ...rot]).join(','));
        }
        basSpecs.push(rows.join(';'));
    }

    const out: string[] = ['init', 'pal 0', 'tw 0'];
    let palette = 0;

    const colours = (): string => {
        const dest = palette === 0 ? PlayerModel.recolourDestinationsRs : PlayerModel.recolourDestinationsAlt;
        const dest2 = palette === 0 ? PlayerModel.recolourDestinations2Rs : PlayerModel.recolourDestinations2Alt;
        const c: number[] = [];
        for (let i = 0; i < 5; i++) {
            const len = Math.max(dest[i].length, dest2[i].length);
            const r = int(1000);
            if (r < 80) c.push(len + int(3));
            else if (r < 160) c.push(Math.min(dest[i].length, dest2[i].length) + int(Math.max(1, Math.abs(dest[i].length - dest2[i].length))));
            else c.push(int(Math.max(1, len)));
        }
        // Now and then a negative colour (dest[i][colour] throws once colour < length passes).
        if (chance(0.03)) c[int(5)] = -1 - int(3);
        return c.join(',');
    };

    // One new appearance; returns the model groups its parts load (for the withheld-group ops).
    // Whether the current player's BAS has part transforms (slot animations need cl.y).
    let transformed = false;
    const appearance = (p: number): number[] => {
        const female = chance(0.5);
        const parts = female ? FEMALE_PARTS : MALE_PARTS;
        let equip = 'null';
        const groups: number[] = [];
        if (!chance(0.12)) {
            const eq = new Array<number>(12).fill(0);
            for (let i = 0; i < 8; i++) {
                const list = kitsByPart.get(parts[i]);
                if (list !== undefined && chance(0.85)) eq[PART_SLOT[i]] = 0x80000000 | pick(list).id | 0;
            }
            const worn = int(7);
            for (let j = 0; j < worn; j++) eq[int(12)] = 0x40000000 | pick(wearObjs).id | 0;
            if (chance(0.15)) eq[int(12)] = 0x40000000 | pick(headObjs).id | 0;
            if (chance(0.06)) eq[int(12)] = 0x80000000 | (info.kitCount + int(40)) | 0;
            if (chance(0.05)) eq[int(12)] = 0x40000000 | (info.objCount + int(40)) | 0;
            if (chance(0.04)) eq[int(12)] = 0xc0000000 | pick(wearObjs).id | 0;
            if (chance(0.06)) eq[int(12)] = 0x80000000 | pick(info.kits).id | 0;
            if (chance(0.03)) eq[int(12)] = 1 + int(1000);
            for (const v of eq) {
                if ((v & 0x40000000) !== 0) groups.push(...(objById.get(v & 0x3fffffff)?.models ?? []));
                else if ((v & 0x80000000) !== 0) {
                    const k = kitById.get(v & 0x3fffffff);
                    if (k !== undefined) groups.push(...k.models, ...k.heads);
                }
            }
            equip = eq.join(',');
        } else {
            for (const part of parts) for (const k of (kitsByPart.get(part) ?? []).slice(0, 1)) groups.push(...k.models, ...k.heads);
        }
        const r = int(100);
        let bas: number;
        transformed = r < 50;
        if (r < 50) {
            // The type with rotations outside the tables and the 6- and 14-row types (the last three) one time in ten.
            const b = chance(0.1) ? basSpecs.length - 1 - int(3) : int(basSpecs.length - 3);
            bas = SYNTHETIC_BAS + b;
            out.push(`bas ${bas} ${basSpecs[b]}`);
        } else if (r < 65) bas = int(info.basCount);
        else if (r < 85) bas = -1;
        else bas = int(info.basCount + 5);
        const npc = chance(0.08) ? pick(info.npcs) : -1;
        out.push(`new ${p} ${female ? 1 : 0} ${bas} ${npc} ${colours()} ${equip}`);
        return groups;
    };

    const slotSpec = (): string => {
        const r = int(100);
        if (r < 3) return 'null';
        if (r < 6) return '-';
        const count = chance(0.05) ? 15 + int(3) : 1 + int(12);
        const entries: string[] = [];
        for (let i = 0; i < count; i++) {
            if (chance(0.3)) {
                entries.push('n');
                continue;
            }
            if (chance(0.04)) {
                entries.push(`${undefinedSeq()}:0:-1:0`);
                continue;
            }
            const s = anySeq();
            const f = frameOf(s);
            entries.push(`${s.id}:${f}:${nextOf(s, f)}:${cycleOf(s, f)}`);
        }
        return entries.join(',');
    };

    // body p m walkFrame seqNext seq seqFrame check slots walkCycle seqCycle cache walkSeq walkNext
    const body = (p: number, m: number, opts: { seq?: SeqInfo | number; walk?: SeqInfo; slots?: string; check?: number; cache?: number }): void => {
        let seqId = -1;
        let seqFrame = 0;
        let seqNext = -1;
        let seqCycle = 0;
        if (typeof opts.seq === 'number') {
            seqId = opts.seq;
        } else if (opts.seq !== undefined) {
            seqId = opts.seq.id;
            seqFrame = frameOf(opts.seq);
            seqNext = nextOf(opts.seq, seqFrame);
            seqCycle = cycleOf(opts.seq, seqFrame);
        }
        let walkId = -1;
        let walkFrame = 0;
        let walkNext = -1;
        let walkCycle = 0;
        if (opts.walk !== undefined) {
            walkId = opts.walk.id;
            walkFrame = frameOf(opts.walk);
            walkNext = nextOf(opts.walk, walkFrame);
            walkCycle = cycleOf(opts.walk, walkFrame);
        }
        out.push(`body ${p} ${m} ${walkFrame} ${seqNext} ${seqId} ${seqFrame} ${opts.check ?? 1} ${opts.slots ?? 'null'} ${walkCycle} ${seqCycle} ${opts.cache ?? 1} ${walkId} ${walkNext}`);
    };
    // head p m seqNext seqCycle seq seqFrame
    const head = (p: number, m: number): void => {
        if (chance(0.4)) {
            out.push(`head ${p} ${m} -1 0 -1 0`);
            return;
        }
        const s = chance(0.15) ? syntheticSeq('chat') : chance(0.7) ? pick(chatSeqs) : anySeq();
        const f = frameOf(s);
        out.push(`head ${p} ${m} ${nextOf(s, f)} ${cycleOf(s, f)} ${s.id} ${f}`);
    };
    // khead p m seq seqCycle kit3 seqFrame kit2 kit1 seqNext
    const kitHead = (p: number, m: number): void => {
        const kit = (): number => {
            const r = int(100);
            if (r < 85) return pick(headKits).id;
            if (r < 95) return pick(info.kits).id;
            return info.kitCount + int(20);
        };
        const k1 = kit();
        const k2 = chance(0.9) ? kit() : k1;
        const k3 = kit();
        if (chance(0.4)) {
            out.push(`khead ${p} ${m} -1 0 ${k3} 0 ${k2} ${k1} -1`);
            return;
        }
        const s = chance(0.7) ? pick(chatSeqs) : anySeq();
        const f = frameOf(s);
        out.push(`khead ${p} ${m} ${s.id} ${cycleOf(s, f)} ${k3} ${f} ${k2} ${k1} ${nextOf(s, f)}`);
    };

    // ---- players ----
    let bodySlot = 0;
    const nextBodySlot = (): number => {
        const m = bodySlot;
        bodySlot = (bodySlot + 1) % 32;
        return m;
    };
    const PLAYERS = 200;
    for (let i = 0; i < PLAYERS; i++) {
        const p = i % 48;
        if (i === 90) {
            out.push('pal 1');
            palette = 1;
        } else if (i === 140) {
            out.push('pal 0');
            palette = 0;
        }
        if (i === 50 || i === 160) out.push('tw 1');
        if (i === 80 || i === 180) out.push('tw 0');
        if (i > 0 && i % 37 === 0) out.push('cc');
        // Frame sets not yet cached fail to load (null framesets in every animate path).
        if (i === 100) out.push('holdf 3');
        if (i === 125) out.push('holdf 0');
        const groups = appearance(p);
        body(p, nextBodySlot(), {});
        const ops = 5 + int(9);
        for (let k = 0; k < ops; k++) {
            const r = int(100);
            if (r < 4) body(p, -1, { seq: syntheticSeq('split'), walk: chance(0.6) ? syntheticSeq('split') : anySeq() });
            else if (r < 6) body(p, -1, { walk: syntheticSeq('split') });
            else if (r < 14) body(p, -1, { seq: anySeq() });
            else if (r < 22) body(p, -1, { walk: anySeq() });
            else if (r < 34) body(p, -1, { seq: chance(0.7) ? pick(maskSeqs) : anySeq(), walk: anySeq() });
            else if (r < 56 && (transformed || chance(0.2))) body(p, -1, { slots: slotSpec(), seq: chance(0.4) ? anySeq() : undefined, walk: chance(0.3) ? anySeq() : undefined });
            else if (r < 56) body(p, -1, { seq: anySeq(), walk: chance(0.5) ? anySeq() : undefined });
            else if (r < 60) body(p, chance(0.5) ? nextBodySlot() : -1, { cache: 0, seq: chance(0.5) ? anySeq() : undefined });
            else if (r < 62) body(p, -1, { check: 0, seq: chance(0.5) ? anySeq() : undefined });
            else if (r < 64) body(p, -1, { seq: undefinedSeq() });
            else if (r < 74) head(p, chance(0.5) ? nextBodySlot() : -1);
            else if (r < 80) kitHead(p, chance(0.3) ? nextBodySlot() : -1);
            else if (r < 89) {
                const which = int(3);
                if (which === 0) out.push(`col ${p} ${chance(0.97) ? int(5) : 5} ${int(30)}`);
                else if (which === 1) {
                    const part = chance(0.97) ? int(8) : 8;
                    const list = kitsByPart.get(part < 8 ? MALE_PARTS[part] : 0) ?? info.kits;
                    out.push(`kit ${p} ${part} ${chance(0.9) ? pick(list).id : info.kitCount + int(10)}`);
                } else out.push(`fem ${p} ${int(2)}`);
                body(p, -1, chance(0.5) ? {} : { seq: anySeq() });
            } else {
                // A part's model group withheld: the base model is cached, so a held-item seq (another key) falls back
                // to cachedModelKey; after a cache clear the body and chathead return null.
                const g = groups.length > 0 ? pick(groups) : pick(info.modelIds);
                out.push(`hold ${g} 1`);
                body(p, -1, { seq: pick(heldSeqs) });
                body(p, -1, {});
                if (chance(0.4)) {
                    out.push('cc');
                    body(p, -1, { seq: anySeq() });
                    head(p, -1);
                    kitHead(p, -1);
                }
                out.push(`hold ${g} 0`);
                body(p, -1, {});
            }
        }
        if (i % 25 === 24) out.push('cdump');
    }
    out.push('cdump');

    // ---- the three animate methods over every frame of a seq ----
    for (let m = 32; m < 64; m++) {
        const light = chance(0.85) ? '-30 -50 -30' : `${int(200) - 100} ${int(200) - 100} ${int(200) - 100}`;
        out.push(`load ${m} ${pick(info.modelIds)} ${64 + int(40) - 20} ${850 + int(200) - 100} ${light}`);
    }
    const sweep: SeqInfo[] = [];
    for (let i = 0; i < 40; i++) sweep.push(pick(chatSeqs));
    for (let i = 0; i < 30; i++) sweep.push(pick(maskSeqs));
    for (let i = 0; i < 20 && tweenSeqs.length > 0; i++) sweep.push(pick(tweenSeqs));
    for (let i = 0; i < 20 && specialSeqs.length > 0; i++) sweep.push(pick(specialSeqs));
    for (let i = 0; i < 20; i++) sweep.push(pick(heldSeqs));
    for (let i = 0; i < 90; i++) sweep.push(pick(info.seqs));
    // Synthetic chat seqs (defined just before their sweep) and, part of the way, withheld frame sets.
    for (let i = 0; i < 40; i++) sweep.splice(int(sweep.length + 1), 0, { id: -1, delays: [], chat: true, mask: false, tween: true, special: false, held: false });
    sweep.forEach((entry, i) => {
        if (i % 30 === 0) out.push(`tw ${(i / 30) % 2}`);
        if (i === 120) out.push('holdf 4');
        if (i === 150) out.push('holdf 0');
        const s = entry.id === -1 ? syntheticSeq('chat') : entry;
        const m = int(10) === 0 ? int(32) : 32 + int(32);
        const len = s.delays.length;
        const frames = len <= 40 ? Array.from({ length: len }, (_, f) => f) : Array.from({ length: 40 }, () => int(len));
        for (const f of frames) {
            const op = s.chat && chance(0.5) ? 'sb' : pick(['sa', 'sb', 'sc']);
            const next = nextOf(s, f);
            const cycle = cycleOf(s, f);
            if (op === 'sa') out.push(`sa ${m} ${s.id} ${f} ${int(8)} ${cycle} ${next}`);
            else if (op === 'sb') out.push(`sb ${m} ${s.id} ${f} ${next} ${cycle}`);
            else out.push(`sc ${m} ${s.id} ${cycle} ${f} ${next}`);
        }
    });
    out.push('tw 0');
    // Edges: frames out of range, a null model, undefined seqs.
    for (let i = 0; i < 30; i++) {
        const s = anySeq();
        const m = chance(0.2) ? -1 : int(64);
        const f = chance(0.5) ? frameOf(s) : pick([-1, s.delays.length, s.delays.length + 5]);
        const id = chance(0.15) ? undefinedSeq() : s.id;
        const op = int(3);
        if (op === 0) out.push(`sa ${m} ${id} ${f} ${int(8)} ${cycleOf(s, 0)} ${nextOf(s, 0)}`);
        else if (op === 1) out.push(`sb ${m} ${id} ${f} ${nextOf(s, 0)} ${cycleOf(s, 0)}`);
        else out.push(`sc ${m} ${id} ${cycleOf(s, 0)} ${f} ${nextOf(s, 0)}`);
    }
    out.push('cdump');
    return out;
}

// ---- the TS side ----

interface Reached {
    // Animate ops whose frame set (or tween / chat frame set) failed to load.
    missingSets: number;
    fallback: number;
    loadingNull: number;
    npcBodies: number;
    split: number;
    slotAnimated: number;
}

function runTs(script: string[], reached: Reached): string[] {
    tags.clear();
    let archives: Archives | null = null;
    const slots = nulls<ModelLit>(64);
    const players = nulls<PlayerModel>(64);
    const seq = (id: number): SeqType | null => (id < 0 ? null : SeqType.List(id));
    const model = (slot: number): ModelLit | null => (slot < 0 ? null : slots[slot]);
    const ints = (s: string): Int32Array | null => (s === 'null' ? null : s === '-' ? new Int32Array(0) : Int32Array.from(s.split(',').map(Number)));
    const slotAnims = (s: string): (ActorSlotAnim | null)[] | null => {
        if (s === 'null') return null;
        if (s === '-') return [];
        return s.split(',').map(e => {
            if (e === 'n') return null;
            const [id, frame, next, cycle] = e.split(':').map(Number);
            const c = new ActorSlotAnim();
            c.seq = id;
            c.frame = frame;
            c.next = next;
            c.cycle = cycle;
            return c;
        });
    };
    const palette = (which: number): void => {
        if (which === 0) {
            PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
            PlayerModel.recolourSources = PlayerModel.recolourSourcesRs;
            PlayerModel.recolourSources2 = PlayerModel.recolourSources2Rs;
            PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Rs;
        } else {
            PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsAlt;
            PlayerModel.recolourSources = PlayerModel.recolourSourcesAlt;
            PlayerModel.recolourSources2 = PlayerModel.recolourSources2Alt;
            PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Alt;
        }
    };
    const transforms = (s: string): (Int32Array | null)[] | null => (s === 'null' ? null : s.split(';').map(row => (row === 'n' ? null : ints(row))));
    const at = (p: number): PlayerModel => requireNonNull(players[p]);
    const shown = (r: ModelLit | null): string => ` ${ident(r)} | ${dump(r)}`;

    const run = (line: string, t: string[], n: number[]): string => {
        const a = archives;
        switch (t[0]) {
            case 'init':
                return initial();
            case 'tw':
                SeqType.forceTween = n[1] !== 0;
                return '';
            case 'pal':
                palette(n[1]);
                return '';
            case 'hold':
                if (n[2] !== 0) requireNonNull(a).modelsProvider.withheld.add(n[1]);
                else requireNonNull(a).modelsProvider.withheld.delete(n[1]);
                return '';
            case 'cc':
                PlayerModel.clearCaches();
                return '';
            case 'holdf':
                requireNonNull(a).framesProvider.mod = n[1];
                return '';
            case 'seqdef': {
                const def = new SeqType();
                def.id = n[1];
                def.frames = ints(t[2]);
                def.delays = ints(t[3]);
                def.chatFrames = ints(t[4]);
                const mask = ints(t[5]);
                if (mask !== null) {
                    const parts = (def.mask = new Array<boolean>(256).fill(false));
                    for (const part of mask) arrayPut(parts, part, true);
                }
                def.tween = n[6] !== 0;
                def.special = n[7] !== 0;
                def.m_replaceHeldLeft = n[8];
                def.m_replaceHeldRight = n[9];
                def.PostDecode();
                SeqType.m_recentUse.Put(BigInt(n[1]), def);
                return '';
            }
            case 'bas': {
                const bas = new BASType();
                bas.transforms = transforms(t[2]);
                BASTypeList.types.Put(BigInt(n[1]), bas);
                return '';
            }
            case 'load': {
                slots[n[1]] = null;
                const unlit = ModelUnlit.Load(requireNonNull(a).models, n[2], 0);
                slots[n[1]] = unlit === null ? null : unlit.Light(n[3], n[4], n[5], n[6], n[7]);
                return unlit === null ? ' null' : '';
            }
            case 'sa':
            case 'sb':
            case 'sc': {
                const hits = requireNonNull(a).framesProvider.withheldHits;
                const s = requireNonNull(seq(n[2]));
                let r: ModelLit;
                if (t[0] === 'sa') r = s.AnimateModel90(n[3], n[4], model(n[1]), n[5], n[6]);
                else if (t[0] === 'sb') r = s.AnimateModelWithExtra(n[3], n[4], model(n[1]), n[5]);
                else r = s.AnimateModel(n[3], model(n[1]), n[4], n[5]);
                if (requireNonNull(a).framesProvider.withheldHits !== hits) reached.missingSets++;
                return shown(r);
            }
            case 'new': {
                const p = new PlayerModel();
                players[n[1]] = p;
                p.setAppearance(n[2] !== 0, requireNonNull(ints(t[5])), n[3], ints(t[6]), n[4]);
                return '';
            }
            case 'col':
                at(n[1]).setColour(n[2], n[3]);
                return '';
            case 'kit':
                at(n[1]).setKit(n[2], n[3]);
                return '';
            case 'fem':
                at(n[1]).setFemale(n[2] !== 0);
                return '';
            case 'body': {
                const p = at(n[1]);
                const hits = requireNonNull(a).modelsProvider.withheldHits;
                const s = seq(n[5]);
                const anims = slotAnims(t[8]);
                const w = seq(n[12]);
                const r = p.GetTempModel(n[3], n[4], s, n[6], n[7] !== 0, anims, n[9], n[10], n[11] !== 0, w, n[13]);
                if (n[2] >= 0) slots[n[2]] = r;
                const loading = requireNonNull(a).modelsProvider.withheldHits !== hits;
                if (loading && r !== null && p.npcId === -1) reached.fallback++;
                if (loading && r === null) reached.loadingNull++;
                if (p.npcId !== -1 && r !== null) reached.npcBodies++;
                if (s !== null && w !== null && s.frames !== null && w.frames !== null && r !== null) reached.split++;
                if (anims !== null && anims.some(e => e !== null) && r !== null) reached.slotAnimated++;
                return shown(r);
            }
            case 'head': {
                const p = at(n[1]);
                const hits = requireNonNull(a).modelsProvider.withheldHits;
                const r = p.GetHeadModel(n[3], n[4], seq(n[5]), n[6]);
                if (n[2] >= 0) slots[n[2]] = r;
                if (requireNonNull(a).modelsProvider.withheldHits !== hits && r === null) reached.loadingNull++;
                return shown(r);
            }
            case 'khead': {
                const p = at(n[1]);
                const r = p.getKitHeadModel(seq(n[3]), n[4], n[5], n[6], n[7], n[8], n[9]);
                if (n[2] >= 0) slots[n[2]] = r;
                return shown(r);
            }
            case 'cdump': {
                let s = '';
                for (const c of [PlayerModel.modelCache2, PlayerModel.modelCache, NpcType.m_modelCache, NpcType.headModelCache] as LRUHashCache<object>[]) {
                    const sentinel = (c as unknown as CacheShape).queue.sentinel;
                    s += ' |';
                    for (let node = requireNonNull(sentinel.secondaryNext); node !== sentinel; node = requireNonNull(node.secondaryNext)) {
                        const v = node instanceof HardReferenceNode ? (node as HardReferenceNode<object>).get() : null;
                        s += ` ${node.key}=${tag(v)}:${dump(v)};`;
                    }
                }
                return s;
            }
            default:
                throw new Error(`unknown op ${line}`);
        }
    };

    const post = (op: string, n: number[]): string => {
        switch (op) {
            case 'sa':
            case 'sb':
            case 'sc':
                return ` | in=${dump(model(n[1]))}${tempLengths()}${origin()}${caches()}`;
            case 'new':
            case 'col':
            case 'kit':
            case 'fem':
                return ` | ${player(players[n[1]])}${caches()}`;
            case 'body':
            case 'head':
            case 'khead':
                return ` | ${player(players[n[1]])}${caches()}${scratch()}${tempLengths()}${origin()}`;
            default:
                return '';
        }
    };

    const got: string[] = [];
    let setup = false;
    for (const line of script) {
        if (!setup && line !== 'init') {
            archives = openArchives(false);
            setup = true;
        }
        const t = line.split(' ');
        // Integer.parseInt, 0 when the token is not an int.
        const n = t.map((s, i) => {
            if (i === 0 || !/^-?\d+$/.test(s)) return 0;
            const v = Number(s);
            return v >= -2147483648 && v <= 2147483647 ? v : 0;
        });
        let result = 'ok';
        let extra = '';
        try {
            extra = run(line, t, n);
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('unknown op')) throw e;
            result = code(e);
            if (process.env.PROVIDER_SEQPLAYER_TRACE === String(got.length)) console.log(line, e instanceof Error ? e.stack : e);
        }
        got.push(result + extra + post(t[0], n));
    }
    return got;
}

test('SeqType animate methods and PlayerModel model builders match ek and cl in client.jar', () => {
    const info = withClinitStatics(resets(), () => fixture());
    expect(info.seqs.length).toBeGreaterThan(2000);
    expect(info.seqs.filter(s => s.chat).length).toBeGreaterThan(20);
    expect(info.seqs.filter(s => s.mask).length).toBeGreaterThan(20);
    expect(info.seqs.filter(s => s.held).length).toBeGreaterThan(20);
    expect(info.kits.filter(k => k.heads.length > 0).length).toBeGreaterThan(20);
    expect(info.objs.filter(o => o.wear).length).toBeGreaterThan(1000);
    expect(info.objs.filter(o => o.head).length).toBeGreaterThan(100);
    expect(info.basCount).toBeGreaterThan(1000);
    expect(info.npcs.length).toBeGreaterThan(50);

    const script = generateScript(info);
    const want = runOracle(script);
    const reached: Reached = { missingSets: 0, fallback: 0, loadingNull: 0, npcBodies: 0, split: 0, slotAnimated: 0 };
    const got = withClinitStatics(resets(), () => runTs(script, reached));

    if (process.env.PROVIDER_SEQPLAYER_DUMP) {
        writeFileSync(`${process.env.PROVIDER_SEQPLAYER_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.PROVIDER_SEQPLAYER_DUMP}.java`, want.join('\n') + '\n');
        writeFileSync(`${process.env.PROVIDER_SEQPLAYER_DUMP}.ts`, got.join('\n') + '\n');
    }

    if (process.env.PROVIDER_SEQPLAYER_STATS) {
        const byOp = new Map<string, Map<string, number>>();
        want.forEach((line, i) => {
            const op = script[i].split(' ')[0];
            const result = line.split(' ').slice(0, 2).join(' ').replace(/#\d+/, '#');
            const counts = byOp.get(op) ?? new Map<string, number>();
            counts.set(result, (counts.get(result) ?? 0) + 1);
            byOp.set(op, counts);
        });
        console.log([...byOp].map(([op, counts]) => `${op}: ${[...counts].map(([r, c]) => `${r}=${c}`).join(', ')}`).join('\n'));
        console.log({ lines: want.length, reached });
    }

    expect(want.length).toBe(script.length);
    expect(got.length).toBe(want.length);
    const mismatches: string[] = [];
    for (let i = 0; i < want.length && mismatches.length < 5; i++) {
        if (got[i] !== want[i]) {
            const w = want[i];
            const g = got[i];
            let at = 0;
            while (at < w.length && w[at] === g[at]) at++;
            const from = Math.max(0, at - 200);
            mismatches.push(`#${i} ${script[i].slice(0, 300)}\n  first difference at ${at}\n  java: ...${w.slice(from, at + 300)}\n  ts:   ...${g.slice(from, at + 300)}`);
        }
    }
    expect(mismatches).toEqual([]);

    // The script reaches the success path of every operation and the exceptions these methods raise.
    const results = (op: string): string[] => want.filter((_, i) => script[i].startsWith(op + ' '));
    for (const op of ['sa', 'sb', 'sc', 'body', 'head', 'khead']) {
        expect(results(op).filter(l => /^ok #\d+/.test(l)).length, op).toBeGreaterThan(20);
    }
    const codes = new Set(want.map(l => l.split(' ')[0]));
    for (const c of ['ok', 'aioobe', 'npe']) expect(codes.has(c), c).toBe(true);
    // Animated copies in all three scratch models, and un-animated cache hits.
    expect(results('sa').some(l => / #\d+cb \|/.test(l))).toBe(true);
    expect(results('sb').some(l => / #\d+k \|/.test(l))).toBe(true);
    expect(results('sc').some(l => / #\d+V \|/.test(l))).toBe(true);
    expect(results('body').some(l => /^ok #\d+ \|/.test(l))).toBe(true);
    // Loading paths (withheld groups): frame sets that fail to load, null returns and the cachedModelKey fallback; npc
    // transforms; SplitAnimate; slot animations.
    expect(reached.missingSets).toBeGreaterThan(20);
    expect(reached.loadingNull).toBeGreaterThan(3);
    expect(reached.fallback).toBeGreaterThan(3);
    expect(reached.npcBodies).toBeGreaterThan(5);
    expect(reached.split).toBeGreaterThan(50);
    expect(reached.slotAnimated).toBeGreaterThan(50);
}, 600000);
