import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import Client from '../../src/client/Client.js';
import ClientBuild from '../../src/client/ClientBuild.js';
import GameVariant from '../../src/client/GameVariant.js';
import HintArrow from '../../src/client/HintArrow.js';
import BASTypeList from '../../src/config/BASTypeList.js';
import IdkType from '../../src/config/IdkType.js';
import LocType from '../../src/config/LocType.js';
import NpcType from '../../src/config/NpcType.js';
import ObjType from '../../src/config/ObjType.js';
import SeqType from '../../src/config/SeqType.js';
import SpotType from '../../src/config/SpotType.js';
import VarBitType from '../../src/config/VarBitType.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import ActorSlotAnim from '../../src/dash3d/ActorSlotAnim.js';
import AnimFrame from '../../src/dash3d/AnimFrame.js';
import AnimFrameSet from '../../src/dash3d/AnimFrameSet.js';
import ClientLocAnim from '../../src/dash3d/ClientLocAnim.js';
import ClientEntity from '../../src/dash3d/ClientEntity.js';
import ClientNpc from '../../src/dash3d/ClientNpc.js';
import ClientObj from '../../src/dash3d/ClientObj.js';
import ClientPlayer from '../../src/dash3d/ClientPlayer.js';
import ClientProj from '../../src/dash3d/ClientProj.js';
import MapSpotAnim from '../../src/dash3d/MapSpotAnim.js';
import LocEntity from '../../src/dash3d/LocEntity.js';
import ModelLit from '../../src/dash3d/ModelLit.js';
import ModelLitImpl from '../../src/dash3d/ModelLitImpl.js';
import ModelSource from '../../src/dash3d/ModelSource.js';
import ModelUnlit from '../../src/dash3d/ModelUnlit.js';
import ParticleSystem from '../../src/dash3d/ParticleSystem.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import PlayerModel from '../../src/dash3d/PlayerModel.js';
import type TextureProvider from '../../src/dash3d/TextureProvider.js';
import world from '../../src/dash3d/world.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import Crc32 from '../../src/io/Crc32.js';
import Preferences from '../../src/ui/Preferences.js';
import ClientVarCache from '../../src/util/ClientVarCache.js';
import { arrayAt, requireNonNull } from '../../src/util/JavaArray.js';
import WrappedException from '../../src/util/WrappedException.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { PIX2D, type StaticReset, withClinitStatics } from './staticState.js';

// The scene entities against client.jar: ac (MapSpotAnim), hl (ClientProj), ig (ClientObj), pb (ClientPlayer) and
// bk (ClientNpc). Under test are their ModelSource overrides update (a(IIIII)V), getMinY (b()I) and draw
// (a(IIIIIIIIJILue;)V), the private model getters ac.b(B)Lnd; and hl.a(I)Lnd; and pb's private hint-arrow draw
// a(IIIBIIIILue;IIIIILnd;)V. A seeded script runs through test/review/provider-entities/ProviderEntitiesOracle.java
// (javac'd next to client.jar, driving the real gamepack classes) and through the TS port; every result line must match.
//
// Both sides read the real 530 cache: archives 0/1/2/7/18/19/20/21/22 are Js5 instances over the sector files and the
// config loaders are initialised exactly as client.java does (IdkType, NpcType, ObjType, SeqType, BAS, SpotType and
// VarBit), so every spot, obj, npc and player model is decoded, built, lit, animated and drawn by the real code. The
// entities are built through their own constructors and setters (ac/hl constructors, hl.setTarget/advance,
// ac.advance, bk.setType, cl.setAppearance with real kits, worn objs and colours) plus direct field stores for the ob
// animation state (primary seq, walk seq, slot anims, spot anims, attachments, hill/roll state inputs).
//
// After every draw both sides print the result (or the Java exception, unwrapping the obfuscator's g wrapper), the
// hash of the 320x240 framebuffer and the number of pixels the draw changed, the pick count and the hash of the picked
// typecodes, Pix3D.trans, the hill-tilt statics (tj.b, ug.a, ph.l), the debug ballast (vg.Q, oh.g), the shadow and
// player model cache counts, getMinY, and every instance field of the entity (ob first; ci slot anims and the cl
// appearance expanded; doubles as raw bits). The model getters also print a full dump of the returned fc.
//
// Coverage, random scenarios: NPCs of sizes 1..5 (hill-rotating BASes on flat, rolling and steep terrain, with and
// without bridges and on every level), multi NPCs resolved through varps and varbits (including the null variant),
// NPCs without shadows; players with default and explicit kits, worn objs, both recolour tables, out-of-range colours,
// NPC transforms, primary seqs with and without delay, walk seqs equal to the BAS ready anim, held-item replacing seqs,
// slot anims without frames, forced tweening, lowDetail, spot anims (hill-skewed through li.f), ModelLit and
// ClientLocAnim attachments in and out of their cycle window with every target yaw, the debug ballast, the local
// player's hint arrows of types 1, 2 and 10; spot anims and projectiles across their sequences, finished and
// unanimated; objs with stack-count variants; invalid ids, frames, levels and missing maps (the exceptions they
// raise); picking with the mouse on and off the models; character shadows on and off; a particle system argument
// (ignored by all but ig). Fixed cases (edges()) pin the exact edges: the attachment window [y, ib) and the clear at
// ib, an attachment that is not a model (ClassCastException) and a loc whose model is null (NPE), the ballast growing,
// shrinking, overflowing by one and missing, hint-arrow actors on the bounds of uc.l and tf.J, tile arrows and the
// private arrow draw on the squared-distance band edges 16 and 360000, and hill tilt on steep ground. poison(), last,
// shows a slot anim with frames throwing in NpcType/PlayerModel.GetTempModel (no slot matrices in this cache) and
// leaving their static layer arrays set, so the next animated builds throw too, on both sides.
//
// Every static the suite reads or writes starts from its <clinit> value and is put back afterwards (staticState.ts);
// the client's fixed arrays (ve.t, uc.l, tf.J, vj.d) are emptied for the run and refilled.
//
// Sensitivity: 70 of 76 single-statement mutations of the five draws, the model getters and drawHintArrow (swapped
// frame/cycle arguments, a dropped rotation, translate, min-Y store or useAABBMouseCheck, an off-by-one window,
// distance-band or ballast bound, swapped rotations, the store/decrement order of the ballast...) make this test fail.
// The six survivors are equivalent here: ac's particles and level arguments (the SD draw ignores both), bk's
// shadowColour1/2 swap (every NPC in the cache has equal tints), dropping updateRollPitch (no BAS has roll or pitch),
// pb's shadow inner alpha 160 -> 161 (the ring alphas round to the same bytes) and the arrow typecode -1 -> 0 (only
// typecodes above 0 are picked).
//
// PROVIDER_ENTITIES_DUMP=<prefix> writes the script and both outputs; PROVIDER_ENTITIES_TRACE=<line>|all prints the
// TS stack of a failing line (or the throw site of every failing line).

type Statics = Record<string, unknown>;
type Fields = Record<string, string>;

// Obfuscated instance field -> TS member, per class (pinned by the field-set test below).
const OB: Fields = {
    j: 'turnSpeed',
    k: 'attachmentZ',
    n: 'healthUntil',
    o: 'exactEndX',
    p: 'hitUntil',
    r: 'stretches',
    s: 'pitchAngle',
    t: 'spotStart',
    w: 'seqNext',
    y: 'attachmentStart',
    z: 'turnDistance',
    A: 'baseSize',
    D: 'pathSpeed',
    E: 'spotCycle',
    F: 'pathLength',
    G: 'exactStartTick',
    H: 'sceneHeight',
    I: 'rollTarget',
    J: 'walkCycle',
    K: 'exactEndZ',
    L: 'pathX',
    M: 'walkSeq',
    N: 'targetYaw',
    O: 'walkNext',
    P: 'overheadText',
    S: 'z',
    T: 'seqPathLength',
    U: 'bas',
    X: 'rollVelocity',
    Y: 'particles',
    Z: 'x',
    ab: 'exactEndTick',
    bb: 'seq',
    db: 'pitchBrakeAt',
    eb: 'faceZ',
    fb: 'spotanim',
    gb: 'yaw',
    hb: 'seqCycle',
    ib: 'attachmentEnd',
    jb: 'attachmentMinZ',
    lb: 'spotFrame',
    mb: 'chatColour',
    nb: 'attachment',
    pb: 'modelAnims',
    qb: 'turnTarget',
    rb: 'rollAccelerating',
    tb: 'attachmentMaxZ',
    ub: 'chatEffect',
    wb: 'turnVelocity',
    xb: 'movementSpeed',
    yb: 'walkFrame',
    zb: 'rollAngle',
    Ab: 'spotHeight',
    Bb: 'health',
    Cb: 'attachmentHeight',
    Db: 'hitType',
    Eb: 'pitchTarget',
    Fb: 'exactDirection',
    Gb: 'exactStartZ',
    Jb: 'turnBrakeAt',
    Lb: 'attachmentMinX',
    Mb: 'turnAccelerating',
    Nb: 'chatTimer',
    Ob: 'hitDamage',
    Pb: 'pitchVelocity',
    Qb: 'modelMinY',
    Rb: 'fineYaw',
    Sb: 'faceX',
    Tb: 'pitchAccelerating',
    Ub: 'spotNext',
    Vb: 'exactStartX',
    Wb: 'attachmentX',
    Xb: 'seqFrame',
    Yb: 'turnTicks',
    Zb: 'faceEntity',
    ac: 'pathZ',
    bc: 'movementDelay',
    cc: 'rollBrakeAt',
    dc: 'lastUpdate',
    fc: 'seqLoops',
    gc: 'seqDelay',
    hc: 'attachmentMaxX'
};
const CLASS_FIELDS: Record<string, Fields> = {
    ob: OB,
    pb: {
        ic: 'soundRadius',
        jc: 'skullIcon',
        lc: 'lowDetail',
        mc: 'slowSound',
        pc: 'appearance',
        qc: 'combatLevelWithSummoning',
        rc: 'skillLevel',
        uc: 'combatLevel',
        vc: 'runSound',
        zc: 'combatRange',
        Ac: 'headIcon',
        Bc: 'team',
        Ec: 'walkSound',
        Gc: 'username',
        Lc: 'idleSound',
        Mc: 'title'
    },
    bk: { mc: 'npcType' },
    ac: { m: 'plane', n: 'y', p: 'id', q: 'nextFrame', s: 'minY', t: 'frame', u: 'z', v: 'frameCycle', w: 'particles', x: 'finished', y: 'startCycle', z: 'seq', C: 'x' },
    hl: {
        j: 'velocityZ',
        k: 'particles',
        n: 'slope',
        o: 'yaw',
        q: 'sourceX',
        r: 'distance',
        s: 'target',
        t: 'sourceY',
        u: 'endCycle',
        v: 'z',
        y: 'moving',
        D: 'frame',
        F: 'velocityY',
        I: 'id',
        J: 'frameCycle',
        L: 'y',
        M: 'pitch',
        N: 'minY',
        O: 'x',
        P: 'seq',
        R: 'acceleration',
        T: 'endHeight',
        U: 'startCycle',
        V: 'plane',
        Z: 'sourceZ',
        ab: 'nextFrame',
        bb: 'speed',
        cb: 'velocityX'
    },
    ig: { j: 'minY', m: 'id', p: 'count' },
    cl: { b: 'equipment', i: 'basId', k: 'npcId', m: 'female', o: 'modelKey', t: 'cachedModelKey', y: 'basTransforms', z: 'colours' }
};
// hl's double fields (printed as raw bits).
const DOUBLES = new Set(['hl.j', 'hl.v', 'hl.F', 'hl.L', 'hl.O', 'hl.R', 'hl.bb', 'hl.cb']);

// fc's instance fields (as model-lit.test.ts).
const FC_FIELDS: [string, string][] = [
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

const W = 320;
const H = 240;

function hashInts(a: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0;
    return h;
}

function longHash(v: bigint): number {
    const u = BigInt.asUintN(64, v);
    return Number(BigInt.asIntN(32, u ^ (u >> 32n)));
}

function doubleBits(v: number): string {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, Number.isNaN(v) ? Number.NaN : v);
    return 'd' + view.getBigUint64(0).toString(16);
}

function value(v: unknown, key = ''): string {
    if (v === null || v === undefined) return 'null';
    if (DOUBLES.has(key)) return doubleBits(v as number);
    if (v instanceof Int32Array || v instanceof Int16Array || v instanceof Int8Array) return `${v.length}:${hashInts(v)}`;
    if (v instanceof Uint8Array) {
        let h = 1;
        for (let i = 0; i < v.length; i++) h = (Math.imul(h, 31) + ((v[i] << 24) >> 24)) | 0;
        return `${v.length}:${h}`;
    }
    if (Array.isArray(v)) {
        if (v.some(e => e instanceof ActorSlotAnim) || key === 'ob.pb') {
            return '[' + v.map((s: ActorSlotAnim | null) => (s === null ? '-' : `${s.seq},${s.frame},${s.next},${s.cycle},${s.delay},${s.loops}`)).join(';') + ']';
        }
        if (v.length > 0 && typeof v[0] === 'boolean') {
            let h = 1;
            for (const e of v) h = (Math.imul(h, 31) + (e ? 1 : 0)) | 0;
            return `${v.length}:${h}`;
        }
        let h = 1;
        for (const row of v as (Int32Array | null)[]) h = (Math.imul(h, 31) + (row === null ? 0 : (Math.imul(31, row.length) + hashInts(row)) | 0)) | 0;
        return `${v.length}:${h}`;
    }
    if (v instanceof PlayerModel) return `cl{${fields(v, ['cl'])}}`;
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (typeof v === 'number' || typeof v === 'bigint') return String(v);
    return 'obj';
}

function fields(o: object, chain: string[]): string {
    const record = o as unknown as Statics;
    const out: string[] = [];
    for (const cls of chain) {
        const map = CLASS_FIELDS[cls];
        for (const name of Object.keys(map).sort()) out.push(`${cls}.${name}=${value(record[map[name]], `${cls}.${name}`)}`);
    }
    return out.join(' ');
}

function dump(e: ModelSource | null): string {
    if (e === null) return 'empty';
    if (e instanceof ClientPlayer) return 'pb ' + fields(e, ['ob', 'pb']);
    if (e instanceof ClientNpc) return 'bk ' + fields(e, ['ob', 'bk']);
    if (e instanceof MapSpotAnim) return 'ac ' + fields(e, ['ac']);
    if (e instanceof ClientProj) return 'hl ' + fields(e, ['hl']);
    if (e instanceof ClientObj) return 'ig ' + fields(e, ['ig']);
    return 'other';
}

function modelDump(m: ModelLit | null): string {
    if (m === null) return 'nullmodel';
    if (!(m instanceof ModelLitImpl)) return 'other';
    const f = m as unknown as Statics;
    return 'fc' + FC_FIELDS.map(([obf, name]) => ` ${obf}=${value(f[name])}`).join('') + ` j=${m.useAABBMouseCheck ? 1 : 0}`;
}

function code(e: unknown): string {
    while (e instanceof WrappedException && e.cause !== null) e = e.cause;
    if (e instanceof RangeError) {
        if (e.message.startsWith('array index') || e.message.startsWith('byte array index')) return 'aioobe';
        if (e.message === '/ by zero') return 'arith';
        if (/^(Invalid typed array length|Invalid array length|length cannot be negative|Requested length is negative)/.test(e.message)) return 'nase';
    }
    if (e instanceof TypeError) {
        if (e.message.startsWith('ClassCastException') || e.message.startsWith('Expected')) return 'cce';
        if (e.message === 'Null reference' || e.message === 'Null array' || e.message === 'Null byte array') return 'npe';
    }
    return `error:${String(e)}`;
}

// Fake textures, identical to ProviderEntitiesOracle.Textures (and model-lit's).
const texelCache = new Map<number, Int32Array>();
function texels(t: number): Int32Array {
    let p = texelCache.get(t);
    if (p === undefined) {
        p = new Int32Array(t % 3 === 0 ? 16384 : 4096);
        for (let i = 0; i < p.length; i++) {
            let v = Math.imul(i + 1, 0x9e3779b1 | 0) ^ Math.imul(t, 0x85ebca6b | 0);
            v ^= v >>> 13;
            v = Math.imul(v, 0x5bd1e995);
            v ^= v >>> 15;
            p[i] = i % 11 === 0 ? 0 : v & 0xffffff;
        }
        texelCache.set(t, p);
    }
    return p;
}

const textures: TextureProvider = {
    getTextureSmall: id => id % 3 !== 0,
    isAvailable: id => id % 7 !== 3,
    getPixels: id => texels(id),
    isLoaded: () => true,
    getTextureData: id => (id % 5 === 4 ? null : texels(id)),
    getTextureColour: id => (Math.imul(id, 0x1f3d) + 0x123) & 0xffff,
    getTextureSolid: id => (id & 1) === 0
};

// The JS5 container without the two-byte version trailer the sector files keep after it.
function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

// ProviderEntitiesOracle.Provider: one archive served from the sector files.
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

const archive = (id: number): Js5 => new Js5(new SectorProvider(id), false, false);

// ---- static state: the fresh-JVM values of everything the suite reads or writes ----

function rows(count: number, length: number): Int32Array[] {
    return Array.from({ length: count }, () => new Int32Array(length));
}

// fc.<clinit> (as model-lit.test.ts).
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

// dd.r, oc.m, ud.d (JVM defaults) and pf.W (new long[1000]).
function modelLitClinit(): Statics {
    return { pickedCount: 0, checkHover: false, pickedTypecodes: new BigInt64Array(1000), mouseY: 0 };
}

// dc.<clinit>.
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

// cb.<clinit>.
function modelUnlitClinit(pix: Statics): Statics {
    return { shareMap: new Int32Array(10000), shareTic: 0, shareMap2: new Int32Array(10000), cos: pix['cosTable'], sin: pix['sinTable'] };
}

// of.<clinit>.
function animFrameClinit(): Statics {
    return { tempTz: new Int16Array(500), tempTi: new Int16Array(500), tempTx: new Int16Array(500), tempFlags: new Uint8Array(500), tempPrevOrigin: new Int16Array(500), tempTy: new Int16Array(500) };
}

const nulls = <T>(n: number): (T | null)[] => new Array<T | null>(n).fill(null);

function resets(): StaticReset[] {
    const pixClinit = pix3dClinit();
    return [
        { target: ModelLitImpl, clinit: modelLitImplClinit() },
        { target: ModelLit, clinit: modelLitClinit() },
        { target: Pix3D, clinit: pixClinit },
        PIX2D(),
        { target: ModelUnlit, clinit: modelUnlitClinit(pixClinit) },
        { target: AnimFrame, clinit: animFrameClinit() },
        { target: AnimFrameSet, clinit: { basesArchive: null, framesArchive: null, cache: new LRUHashCache(100) } },
        { target: SpotType, clinit: { m_pConfigClient: null, m_pModels: null, m_recentUse: new LRUHashCache(64), m_modelCache: new LRUHashCache(30) } },
        { target: SeqType, clinit: { m_pConfigClient: null, m_recentUse: new LRUHashCache(64), forceTween: false } },
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
        {
            target: ObjType,
            clinit: {
                m_memServer: false,
                m_pConfigClient: null,
                m_pModels: null,
                types: new LRUHashCache(64),
                modelCache: new LRUHashCache(50),
                spriteCache: new LRUHashCache(100),
                m_numDefinitions: 0,
                inventoryOps: null,
                groundOps: null,
                m_countFont: null,
                recolourPalette: new Int16Array(256)
            }
        },
        {
            target: LocType,
            clinit: {
                m_pConfigClient: null,
                m_pModels: null,
                members: false,
                m_lowMem: false,
                m_recentUse: new LRUHashCache(64),
                m_mc1: new LRUHashCache(500),
                m_mc2: new LRUHashCache(30),
                m_mc3: new LRUHashCache(50),
                modelResult: new LocEntity(),
                temp: nulls(4),
                recolPalette: new Int16Array(256)
            }
        },
        { target: IdkType, clinit: { m_recentUse: new LRUHashCache(64), m_numDefinitions: 0, m_pConfigClient: null, m_pModels: null } },
        { target: BASTypeList, clinit: { archive: null, types: new LRUHashCache(64) } },
        { target: VarBitType, clinit: { m_pConfigClient: null, m_recentUse: new LRUHashCache(64) } },
        {
            target: PlayerModel,
            clinit: {
                modelCache: new LRUHashCache(5),
                modelCache2: new LRUHashCache(260),
                layerSeqs: nulls(14),
                slotFramesets: nulls(14),
                layerFrameIds: new Int32Array(14),
                slotNextFramesets: nulls(14),
                slotNextFrames: new Int32Array(14),
                layerFrameDelays: new Int32Array(14),
                layerFrameCycles: new Int32Array(14),
                recolourDestinations: null,
                recolourSources: null,
                recolourSources2: null,
                recolourDestinations2: null
            }
        },
        { target: ClientEntity, clinit: { shadowModelCache: new LRUHashCache(32), tiltPitch: 0, groundTiltRoll: 0, tiltOffsetY: 0 } },
        { target: ClientPlayer, clinit: { debugBallast: null, memoryPaddingCount: 0 } },
        { target: HintArrow, clinit: { modelCache: new LRUHashCache(4) } },
        {
            target: Client,
            clinit: {
                modelsArchive: null,
                playerLevel: 0,
                localPlayer: null,
                loopCycle: 0,
                mapBuildBaseX: 0,
                mapBuildBaseZ: 0,
                modewhat: 0,
                recolourPalette: new Int16Array(256)
            }
        },
        { target: Preferences, clinit: { characterShadows: true, sceneryShadows: 2 } },
        { target: world, clinit: { levelHeightmaps: null, mainGroundh: null } },
        { target: ClientBuild, clinit: { m_mapl: Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104))) } },
        { target: GameVariant, clinit: { id: 0 } }
    ];
}

// The client's fixed-size arrays (ve.t, uc.l, tf.J, vj.d): emptied for the suite and refilled afterwards.
function withClientArrays<T>(run: () => T): T {
    const arrays: (unknown[] | Int32Array)[] = [Client.hintArrows, Client.npcs, Client.players, ClientVarCache.m_var];
    const saved = arrays.map(a => Array.from(a as ArrayLike<unknown>));
    for (const a of arrays) {
        if (a instanceof Int32Array) a.fill(0);
        else a.fill(null);
    }
    try {
        return run();
    } finally {
        arrays.forEach((a, i) => {
            const copy = saved[i];
            for (let j = 0; j < copy.length; j++) (a as unknown[])[j] = copy[j];
        });
    }
}

// dc.a(IIII)V (setBounds), field by field as model-lit.test.ts does.
function setBounds(x0: number, y0: number, x1: number, y1: number): void {
    const pix3d = Pix3D as unknown as Statics;
    pix3d['width'] = (x1 - x0) | 0;
    pix3d['height'] = (y1 - y0) | 0;
    Pix3D.resetOrigin();
    const scanline = requireNonNull(pix3d['scanline'] as Int32Array | null);
    const height = pix3d['height'] as number;
    let offset = (Math.imul(y0, Pix2D.width) + x0) | 0;
    for (let y = 0; y < height; y++) {
        scanline[y] = offset;
        offset = (offset + Pix2D.width) | 0;
    }
}

// ---- terrain ----

function terrains(): Int32Array[][][] {
    return [0, 1, 2].map(k =>
        Array.from({ length: 4 }, (_, p) =>
            Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => (k === 1 ? -((x * 37 + z * 91) % 400) - ((x * z) % 97) * 3 - p * 50 : k === 2 ? Math.imul(p * 131 + x * 7 - z * 11, 41) : 0)))
        )
    );
}

function maplFlags(): Uint8Array[][][] {
    return [0, 1].map(k => Array.from({ length: 4 }, () => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (k === 1 && (x + z) % 3 === 0 ? 2 : 0)))));
}

// ---- oracle ----

function runOracle(script: string[]): string[] {
    const out = resolve(import.meta.dir, '../../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'provider-entities-oracle-'));
    try {
        const source = fileURLToPath(new URL('./provider-entities/ProviderEntitiesOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(build.stderr.toString());
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + scratch, 'ProviderEntitiesOracle', cachePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`ProviderEntitiesOracle exited ${run.exitCode}: ${run.stderr.toString()}`);
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
        return (t ^ (t >>> 14)) | 0;
    };
}

// 1633, 8021 and 8025 have non-default shadow tints and alphas; 2782 has no shadow; 473 .. 152 are multi NPCs.
const NPCS = [0, 1, 2, 3, 9, 41, 50, 53, 58, 81, 86, 105, 1633, 8021, 8025, 2782, 473, 474, 697, 759, 70, 226, 1048, 152, 6000];
const PLAYER_SEQS = [808, 819, 824, 422, 829, 866, 363, 364, 365, 329, 330, 385, 427, 528, 547];
const SPOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 18, 27, 28, 29, 31, 33, 53, 70, 77, 79, 187, 242, 534, 709, 920];
const OBJS = [995, 4151, 1163, 1127, 1079, 1038, 617, 0, 1, 39, 42, 52, 78, 598, 877, 1704, 1052];
const WORN = [1163, 1127, 1079, 4151, 1201, 1038, 1704, 1052, 3105, 1059, 1333, 1305, 1215, 1093];
// Locs for ClientLocAnim attachments: 3 and 14 have no shape-10 model (a null attachment model).
const LOCS = [1276, 1278, 409, 2213, 1, 2, 5, 10, 11, 3194, 884, 1307, 3, 14];

interface Ctx {
    next: () => number;
    below: (n: number) => number;
    pick: <T>(a: readonly T[]) => T;
    ops: string[];
    // Set for about one scenario in eight: only those pick invalid ids, frames, levels and missing maps.
    bad: boolean;
}

function seqInfo(id: number): { frames: number; ok: boolean } {
    try {
        const s = SeqType.List(id);
        return { frames: s.frames === null ? 0 : s.frames.length, ok: s.frames !== null };
    } catch {
        return { frames: 0, ok: false };
    }
}

// Camera arguments that put the entity origin near the screen centre at distance d, plus jitter.
function cam(c: Ctx, typecode: bigint | number, mode = c.below(10)): string {
    const pitch = mode === 0 ? c.below(2048) : 96 + c.below(320);
    const yaw = c.below(8) === 0 ? [0, 512, 1024, 1536][c.below(4)] : c.below(2048);
    const sp = arrayAt(Pix3D.sinTable, pitch);
    const cp = arrayAt(Pix3D.cosTable, pitch);
    const sy = arrayAt(Pix3D.sinTable, yaw);
    const cy = arrayAt(Pix3D.cosTable, yaw);
    // depth is the view-space depth of the entity origin (ModelLit culls below 50 and from 3500 on); d is its
    // forward ground distance at this pitch.
    let depth = 300 + c.below(2000);
    if (mode === 1) depth = 20 + c.below(140);
    if (mode === 2) depth = 3300 + c.below(800);
    const d = cp > 0 ? ((depth * cp) / 65536) | 0 : depth;
    let x = -((Math.imul(d, sy) >> 16) | 0) + c.below(161) - 80;
    let z = (Math.imul(d, cy) >> 16) + c.below(161) - 80;
    let y = cp === 0 ? 300 : ((d * sp) / cp) | 0;
    y = (y + c.below(201) - 100) | 0;
    if (mode === 3) {
        x = (x + c.below(1601) - 800) | 0;
        z = (z - c.below(400)) | 0;
    }
    const entityYaw = c.below(6) === 0 ? [0, 128, 383, 384, 896, 1152, 1408, 1664, 1920, 2047][c.below(10)] : c.below(2048);
    const level = c.below(4);
    const particles = c.below(6) === 0 ? 1 : 0;
    return `${entityYaw} ${sp} ${cp} ${sy} ${cy} ${x} ${y} ${z} ${typecode} ${level} ${particles}`;
}

function pickOp(c: Ctx): string {
    const r = c.below(4);
    if (r === 0) return 'pick 0 0 0 0';
    const [mx, my] = c.below(2) === 0 ? [c.below(41) - 20, c.below(41) - 20] : [140 + c.below(41), 100 + c.below(41)];
    return `pick 1 ${mx} ${my} ${c.below(8) === 0 ? 999 : 0}`;
}

function draws(c: Ctx, slot: number, count: number): void {
    for (let i = 0; i < count; i++) {
        if (c.below(3) === 0) c.ops.push(pickOp(c));
        if (c.below(5) === 0) c.ops.push(`cls ${c.next()}`);
        const typecode = c.below(10) === 0 ? -1 : c.below(10) === 0 ? c.next() : 1000 + slot * 37 + i;
        c.ops.push(`draw ${slot} ${cam(c, typecode)}`);
    }
}

function world_(c: Ctx): void {
    c.bad = c.below(8) === 0;
    const bad = c.bad && c.below(3) === 0;
    c.ops.push(`terrain ${bad && c.below(2) === 0 ? -1 : c.below(3)}`, `mapl ${bad && c.below(2) === 0 ? -1 : c.below(2)}`, `level ${bad ? c.below(6) : c.below(4)}`);
    if (c.below(8) === 0) c.ops.push(`ground ${c.below(3)}`);
    c.ops.push(`shadows ${c.below(5) === 0 ? 0 : 1}`);
}

function position(c: Ctx, slot: number): [number, number] {
    const x = c.bad && c.below(2) === 0 ? c.below(20000) - 3000 : 64 + 128 * (10 + c.below(84)) + c.below(64);
    const z = c.bad && c.below(2) === 0 ? c.below(20000) - 3000 : 64 + 128 * (10 + c.below(84)) + c.below(64);
    c.ops.push(`set ${slot} Z ${x}`, `set ${slot} S ${z}`, `set ${slot} H ${c.below(4) === 0 ? 0 : -c.below(1200)}`);
    if (c.below(3) === 0) c.ops.push(`set ${slot} r ${c.below(2)}`);
    return [x, z];
}

function seqState(c: Ctx, slot: number, seq: number, primary: boolean): void {
    const info = seqInfo(seq);
    const n = Math.max(1, info.frames);
    const frame = c.bad && c.below(3) === 0 ? n + c.below(3) : c.below(n);
    const next = c.below(5) === 0 ? -1 : c.bad && c.below(3) === 0 ? n : (frame + 1) % n;
    const cycle = c.below(6);
    if (primary) {
        c.ops.push(`set ${slot} bb ${seq}`, `set ${slot} Xb ${frame}`, `set ${slot} w ${next}`, `set ${slot} hb ${cycle}`, `set ${slot} gc ${c.below(4) === 0 ? 1 + c.below(3) : 0}`);
    } else {
        c.ops.push(`set ${slot} M ${seq}`, `set ${slot} yb ${frame}`, `set ${slot} O ${next}`, `set ${slot} J ${cycle}`);
    }
}

// Slot anims whose seq has no frames (skipped by the model builders). Neither the cache's NPC types nor its BASes carry
// per-slot matrices, so a slot anim with frames makes NpcType.GetTempModel and PlayerModel.GetTempModel throw on the
// null matrix lookup, leaving their static layer arrays set: every later build then throws too (in Java and TS alike).
// That case runs once, at the end of the script (poison()).
function slotAnims(c: Ctx, slot: number): void {
    const count = 1 + c.below(2);
    for (let i = 0; i < count; i++) {
        const seq = 30000 + c.below(5);
        const n = Math.max(1, seqInfo(seq).frames);
        const frame = c.below(n);
        c.ops.push(`slot ${slot} ${c.below(12)} ${seq} ${frame} ${c.below(4) === 0 ? -1 : (frame + 1) % n} ${c.below(5)} ${c.below(3) === 0 ? 1 : 0} 0`);
    }
    if (c.below(4) === 0) c.ops.push(`slot ${slot} ${c.below(12)} -1`);
}

function spotState(c: Ctx, slot: number): void {
    if (c.below(2) === 0) return;
    const spot = c.pick(SPOTS);
    const st = SpotType.List(spot);
    const n = st.seq === -1 ? 1 : Math.max(1, seqInfo(st.seq).frames);
    const frame = c.below(8) === 0 ? -1 : c.bad && c.below(2) === 0 ? n + c.below(4) : c.below(n);
    c.ops.push(`set ${slot} fb ${spot}`, `set ${slot} lb ${frame}`, `set ${slot} Ub ${c.below(4) === 0 ? -1 : (frame + 1) % n}`, `set ${slot} E ${c.below(5)}`);
    c.ops.push(`set ${slot} Ab ${c.below(8) === 0 ? -2147483648 : c.below(200)}`);
    if (c.below(2) === 0) c.ops.push(`spothill ${spot} ${c.below(3) === 0 ? 0 : 1}`);
}

function basSeqs(bas: number): number[] {
    if (bas === -1) return [];
    const b = BASTypeList.List(bas);
    return [b.ready, b.m_walkForward, b.m_runForward, b.m_walkBackward, b.m_walkLeft, b.m_walkRight, b.m_readyTurnLeft, b.m_readyTurnRight].filter(s => s !== -1);
}

function npcScenario(c: Ctx, slot: number): void {
    world_(c);
    const id = c.pick(NPCS);
    c.ops.push(`npc ${slot}`);
    if (c.below(15) === 0) {
        draws(c, slot, 1);
        return;
    }
    c.ops.push(`npctype ${slot} ${id}`);
    let bas = -1;
    try {
        const t = NpcType.List(id);
        bas = t.m_baseAnimationSet;
        if (t.multiVarp !== -1) c.ops.push(`varp ${t.multiVarp} ${c.below(4)}`);
        if (t.multiVarbit !== -1) {
            const vb = VarBitType.List(t.multiVarbit);
            c.ops.push(`varp ${vb.baseVar} ${c.below(3) === 0 ? 0 : c.next() & 0x7fffffff}`);
        }
    } catch {
        bas = -1;
    }
    if (c.below(10) === 0) bas = c.below(2) === 0 ? -1 : 1426;
    c.ops.push(`set ${slot} U ${bas}`);
    position(c, slot);
    const seqs = basSeqs(bas);
    if (seqs.length > 0) {
        if (c.below(4) !== 0) seqState(c, slot, c.below(3) === 0 ? seqs[0] : c.pick(seqs), false);
        if (c.below(3) === 0) seqState(c, slot, c.pick(seqs), true);
        if (c.below(6) === 0) slotAnims(c, slot);
    }
    if (c.bad && c.below(3) === 0) c.ops.push(`set ${slot} bb ${30000 + c.below(5)}`, `set ${slot} gc 0`);
    spotState(c, slot);
    if (c.below(6) === 0) c.ops.push(`tween ${c.below(2)}`);
    draws(c, slot, 2 + c.below(4));
    c.ops.push(`miny ${slot}`, `update ${slot} ${c.next()} ${c.below(4)} ${c.next()} ${c.next()} ${c.next()}`);
}

let defaultKits: { male: number[]; female: number[] } | null = null;
function kits(female: boolean): number[] {
    if (defaultKits === null) {
        const pick = (parts: Int32Array): number[] => {
            const eq = new Array<number>(12).fill(0);
            for (let part = 0; part < 8; part++) {
                for (let kit = 0; kit < IdkType.m_numDefinitions; kit++) {
                    const type = IdkType.List(kit);
                    if (!type.nonSelectable && type.bodyPart === parts[part]) {
                        eq[PlayerModel.partToSlot[part]] = -2147483648 | kit;
                        break;
                    }
                }
            }
            return eq;
        };
        defaultKits = { male: pick(PlayerModel.maleKitBodyParts), female: pick(PlayerModel.femaleBodyParts) };
    }
    return [...(female ? defaultKits.female : defaultKits.male)];
}

function appearance(c: Ctx, slot: number): number {
    const female = c.below(3) === 0;
    // 17, 77 and 9 are hill-rotating BASes (tilt statics and hill-skewed spot anims on sloped terrain).
    const bas = c.below(5) === 0 ? c.pick([-1, 1427, 1429, 17, 77, 9]) : 1426;
    const npc = c.below(10) === 0 ? c.pick([1, 50, 2782, 81]) : -1;
    const colours = Array.from({ length: 5 }, (_, i) => (c.below(12) === 0 ? 200 : c.below([12, 16, 16, 6, 8][i])));
    let equipment = 'null';
    if (c.below(5) !== 0) {
        const eq = kits(female);
        const worn = c.below(6);
        for (let i = 0; i < worn; i++) eq[c.below(12)] = 0x40000000 | c.pick(WORN);
        if (c.below(6) === 0) eq[c.below(12)] = 0;
        if (c.bad && c.below(2) === 0) eq[c.below(12)] = -2147483648 | (1000 + c.below(50));
        equipment = eq.join(',');
    }
    c.ops.push(`appear ${slot} ${female ? 1 : 0} ${bas} ${npc} ${colours.join(',')} ${equipment}`);
    return bas;
}

function playerScenario(c: Ctx, slot: number): void {
    world_(c);
    c.ops.push(`player ${slot}`);
    if (c.below(15) === 0) {
        draws(c, slot, 1);
        return;
    }
    if (c.below(4) === 0) c.ops.push(`recol ${c.below(2)}`);
    const bas = appearance(c, slot);
    const [px, pz] = position(c, slot);
    if (c.below(6) === 0) c.ops.push(`set ${slot} lc 1`);
    const seqs = basSeqs(bas);
    if (c.below(4) !== 0 && seqs.length > 0) seqState(c, slot, c.below(3) === 0 ? seqs[0] : c.pick(seqs), false);
    if (c.below(2) === 0) seqState(c, slot, c.pick(PLAYER_SEQS), true);
    if (c.below(6) === 0) slotAnims(c, slot);
    spotState(c, slot);
    if (c.below(6) === 0) c.ops.push(`tween ${c.below(2)}`);
    // Attachments: a lit model (or a plain object, or null) inside or outside its loop-cycle window.
    if (c.below(2) === 0) {
        const kind = c.below(8) === 0 ? 1 : c.below(10) === 0 ? 2 : c.below(2) === 0 ? 3 : 0;
        if (kind === 3) c.ops.push(`attach ${slot} 3 ${c.pick(LOCS)} ${c.pick([10, 10, 11, 22, 4])} ${c.below(4)} ${c.below(4)} ${px >> 7} ${pz >> 7}`);
        else c.ops.push(`attach ${slot} ${kind} ${c.pick([1, 100, 1500, 3000, 6000])}`);
        const loop = 100 + c.below(50);
        c.ops.push(`loop ${loop}`);
        // The window [y, ib) around the loop cycle, with its exact edges (y == loop, ib == loop, ib == loop + 1).
        const start = c.pick([loop + 1, loop + 1 + c.below(5), loop, loop, loop - 1, loop - c.below(10)]);
        const end = c.pick([loop, loop, loop - 1 - c.below(3), loop + 1, loop + 1, loop + 2 + c.below(10)]);
        c.ops.push(`set ${slot} y ${start}`, `set ${slot} ib ${end}`);
        c.ops.push(`set ${slot} Wb ${px + c.below(512) - 256}`, `set ${slot} Cb ${-c.below(400)}`, `set ${slot} k ${pz + c.below(512) - 256}`);
        c.ops.push(`set ${slot} N ${c.pick([0, 512, 1024, 1536, 256, 512, 1024, 1536])}`);
    }
    // Debug ballast (modewhat != 0).
    // Grow (vg.Q below 50 minus the hard body-cache count) or shrink (above it) the ballast, overflow a short array
    // (AIOOBE after the stores that fit) or meet a missing one (NPE), or leave it alone (modewhat 0).
    const ballast = c.below(6);
    if (ballast === 1) c.ops.push('modewhat 2', `ballast 64 ${c.below(64)}`);
    else if (ballast === 2) c.ops.push('modewhat 2', `ballast ${40 + c.below(10)} ${c.below(4)}`);
    else if (ballast === 3 && c.bad) c.ops.push('modewhat 2', 'ballast -1 0');
    else c.ops.push('modewhat 0', `ballast 64 ${c.below(64)}`);
    // The local player's hint arrows at npcs (slots 20..23 at uc.l[0..3]), tiles and players (24..27 at tf.J[0..3]).
    if (c.below(2) === 0) {
        const baseX = c.below(40) * 8;
        const baseZ = c.below(40) * 8;
        c.ops.push(`local ${slot}`, `base ${baseX} ${baseZ}`);
        for (let i = 0; i < 4; i++) {
            const spread = c.pick([0, 1, 3, 8, 30, 150, 160]) * 32;
            c.ops.push(`set ${20 + i} Z ${px + c.below(2 * spread + 1) - spread}`, `set ${20 + i} S ${pz + c.below(2 * spread + 1) - spread}`, `npcat ${i} ${20 + i}`);
            c.ops.push(`set ${24 + i} Z ${px + c.below(2 * spread + 1) - spread}`, `set ${24 + i} S ${pz + c.below(2 * spread + 1) - spread}`, `plat ${i} ${24 + i}`);
        }
        for (let i = 0; i < 4; i++) {
            const type = c.pick([1, 2, 10, -1, 3, 1, 2, 10]);
            const model = c.below(8) === 0 ? -1 : c.pick([1, 50, 300, 2000, 4000]);
            // Actor indexes on the bounds of uc.l (32768) and tf.J (2048): 32767 and 2047 are empty slots.
            const actor = c.below(4) === 0 ? c.pick([-1, 4, 32767, 32768, 2047, 2048, 40000]) : c.below(4);
            const d = c.pick([0, 1, 2, 5, 20, 100, 160]);
            const hx = baseX + (px >> 7) + c.below(2 * d + 1) - d;
            const hz = baseZ + (pz >> 7) + c.below(2 * d + 1) - d;
            c.ops.push(`hint ${i} ${type} ${actor} ${hx} ${hz} ${model}`);
        }
    } else c.ops.push('local -1');
    draws(c, slot, 2 + c.below(4));
    c.ops.push(`miny ${slot}`, `update ${slot} ${c.next()} ${c.below(4)} ${c.next()} ${c.next()} ${c.next()}`);
    // The private hint-arrow draw, directly.
    if (c.below(2) === 0) {
        for (let i = 0; i < 3; i++) {
            const offsets = [c.below(801) - 400, c.below(801) - 400];
            // The squared-distance band [16, 360000] and its edges: 13, 16, 360000, 360001.
            if (c.below(2) === 0) {
                const edge = c.pick([
                    [4, 0],
                    [0, -4],
                    [3, 2],
                    [-2, 3],
                    [600, 0],
                    [0, -600],
                    [600, 1],
                    [-1, 600],
                    [0, 0]
                ]);
                offsets[0] = edge[0];
                offsets[1] = edge[1];
            }
            const parts = cam(c, 0).split(' ').map(Number);
            // v1 z offset, v2 = draw var8, v3 = var6, v5 model, v6 = var7, v7 x offset, v8 = var2, v10 = var4, v11 = var3,
            // v12 = var1, v13 = var11, v14 = var5, then the base model id.
            c.ops.push(`arrow ${slot} ${offsets[0]} ${parts[7]} ${parts[5]} ${c.pick([1, 300, 2000])} ${parts[6]} ${offsets[1]} ${parts[1]} ${parts[3]} ${parts[2]} ${parts[0]} ${parts[9]} ${parts[4]} ${c.bad ? -1 : c.pick([100, 1500])}`);
        }
    }
    c.ops.push('local -1', 'modewhat 0');
    for (let i = 0; i < 4; i++) c.ops.push(`hint ${i} -1`);
}

function spotScenario(c: Ctx, slot: number): void {
    c.bad = c.below(8) === 0;
    const id = c.bad && c.below(2) === 0 ? 5000 + c.below(10) : c.pick(SPOTS);
    c.ops.push(`spot ${slot} ${id} ${c.below(4)} ${c.below(13000)} ${c.below(13000)} ${-c.below(800)} ${c.below(10)} ${c.below(1000)}`);
    const spotSeq = id < 5000 ? SpotType.List(id).seq : -1;
    const n = Math.max(1, spotSeq === -1 ? 1 : seqInfo(spotSeq).frames);
    for (let i = 0; i < 2 + c.below(4); i++) {
        if (c.below(2) === 0) c.ops.push(`adv ${slot} ${c.below(3) === 0 ? c.below(40) : c.below(4)}`);
        if (c.below(6) === 0) c.ops.push(`set ${slot} x ${c.below(2)}`);
        if (c.below(6) === 0) c.ops.push(`set ${slot} t ${c.bad ? n + c.below(5) : c.below(n)}`);
        if (c.below(6) === 0) c.ops.push(`set ${slot} q ${c.bad ? n + c.below(5) : c.below(4) === 0 ? -1 : c.below(n)}`);
        if (c.below(6) === 0) c.ops.push(`set ${slot} v ${c.below(8)}`);
        if (c.below(2) === 0) c.ops.push(`model ${slot}`);
        draws(c, slot, 1);
    }
    c.ops.push(`miny ${slot}`, `update ${slot} ${c.next()} ${c.below(4)} ${c.next()} ${c.next()} ${c.next()}`);
}

function projScenario(c: Ctx, slot: number): void {
    c.bad = c.below(8) === 0;
    const id = c.bad && c.below(2) === 0 ? 5000 + c.below(10) : c.pick(SPOTS);
    const sx = c.below(13000);
    const sz = c.below(13000);
    const start = c.below(100);
    const end = start + 1 + c.below(100);
    c.ops.push(`proj ${slot} ${id} ${c.below(4)} ${sx} ${sz} ${-c.below(800)} ${start} ${end} ${c.below(4) === 0 ? -1 : c.below(64)} ${c.below(200)} ${c.below(5) - 2} ${c.below(200)}`);
    for (let i = 0; i < 2 + c.below(4); i++) {
        if (c.below(2) === 0 || i === 0) {
            const tx = c.below(10) === 0 ? sx : sx + c.below(3000) - 1500;
            const tz = c.below(10) === 0 ? sz : sz + c.below(3000) - 1500;
            c.ops.push(`target ${slot} ${tx} ${-c.below(900)} ${tz} ${start + c.below(end - start + 1)}`);
        }
        if (c.below(2) === 0) c.ops.push(`adv ${slot} ${c.below(3) === 0 ? c.below(40) : c.below(4)}`);
        if (c.bad && c.below(2) === 0) c.ops.push(`set ${slot} D ${c.below(60) - 5}`);
        if (c.below(6) === 0) c.ops.push(`set ${slot} M ${c.below(4096) - 1024}`);
        if (c.below(2) === 0) c.ops.push(`model ${slot}`);
        draws(c, slot, 1);
    }
    c.ops.push(`miny ${slot}`, `update ${slot} ${c.next()} ${c.below(4)} ${c.next()} ${c.next()} ${c.next()}`);
}

function objScenario(c: Ctx, slot: number): void {
    const id = c.below(15) === 0 ? c.pick([-1, 30000, 23000]) : c.pick(OBJS);
    const count = c.pick([0, 1, 2, 3, 4, 5, 24, 25, 100, 250, 999, 1000, 10000, 100000, 2147483647, -5]);
    c.ops.push(`obj ${slot} ${id} ${count}`);
    draws(c, slot, 1 + c.below(3));
    c.ops.push(`miny ${slot}`, `update ${slot} ${c.next()} ${c.below(4)} ${c.next()} ${c.next()} ${c.next()}`);
}

// A camera looking 45 degrees down at an entity origin 900 units away, at screen centre (yaw 0, level 0, no particles).
const CENTRE = '46340 46340 0 65536 0 636 636';
// Each fixed draw starts from a fresh framebuffer, so px counts exactly what that draw (and its arrows and shadow) drew.
const centre = (slot: number, yaw: number, typecode: number): string[] => [`cls ${typecode}`, `draw ${slot} ${yaw} ${CENTRE} ${typecode} 0 0`];

// Fixed cases on the exact edges of pb's draw, run before the random scenarios. Slot 0 is a player at tile (50, 50) on
// flat ground, slot 1 an NPC.
function edges(c: Ctx): void {
    const player = (lines: string[]): void => {
        c.ops.push('player 0', 'appear 0 0 1426 -1 3,5,7,2,1 null', 'set 0 Z 6464', 'set 0 S 6464', 'set 0 M 819', 'set 0 yb 2', 'set 0 O 3', ...lines);
    };
    c.ops.push('terrain 0', 'mapl 0', 'level 0', 'shadows 1', 'modewhat 0', 'pick 1 0 0 0', 'cls 99');
    // Attachments: every target yaw inside the window; the window's edges (y == loop drawn, ib == loop cleared and
    // not drawn, ib == loop + 1 drawn, y == loop + 1 kept but not drawn); a plain Object (ClassCastException); a loc
    // without a shape-10 model (its null model is dereferenced); a ClientLocAnim; lowDetail skipping all of it.
    for (const yaw of [0, 256, 512, 1024, 1536]) {
        player(['attach 0 0 1500', 'loop 200', 'set 0 y 195', 'set 0 ib 210', 'set 0 Wb 6600', 'set 0 Cb -40', 'set 0 k 6400', `set 0 N ${yaw}`]);
        c.ops.push(...centre(0, 0, 1), ...centre(0, 700, 2));
    }
    for (const [y, ib] of [
        [200, 210],
        [190, 200],
        [190, 201],
        [201, 210],
        [199, 199]
    ]) {
        player(['attach 0 0 100', 'loop 200', `set 0 y ${y}`, `set 0 ib ${ib}`, 'set 0 Wb 6400', 'set 0 Cb 0', 'set 0 k 6464', 'set 0 N 512']);
        c.ops.push(...centre(0, 0, 3), 'dump 0');
    }
    for (const attach of ['attach 0 1 0', 'attach 0 2 0', 'attach 0 3 3 10 0 0 50 50', 'attach 0 3 1276 10 1 0 50 50', 'attach 0 3 409 10 3 0 50 50']) {
        player([attach, 'loop 200', 'set 0 y 190', 'set 0 ib 210', 'set 0 Wb 6464', 'set 0 Cb 0', 'set 0 k 6464', 'set 0 N 1024']);
        c.ops.push(...centre(0, 0, 4));
    }
    player(['attach 0 0 1500', 'loop 200', 'set 0 y 190', 'set 0 ib 210', 'set 0 lc 1', 'set 0 fb 5', 'set 0 lb 1', 'set 0 Ub 2']);
    c.ops.push(...centre(0, 0, 5), 'set 0 lc 0', ...centre(0, 0, 6));
    // Debug ballast with one hard body model cached (target 50 - 1 = 49): grow from 0, shrink from 63, arrays short of
    // the target by five and by one (AIOOBE after the stores that fit), one of exactly 49, and no array (NPE).
    player(['modewhat 2', 'ballast 64 0']);
    c.ops.push(...centre(0, 0, 7), 'ballast 64 63', ...centre(0, 0, 7), 'ballast 44 0', ...centre(0, 0, 7), 'ballast 48 0', ...centre(0, 0, 7));
    c.ops.push('ballast 49 0', ...centre(0, 0, 7), 'ballast -1 0', ...centre(0, 0, 7), 'modewhat 0');
    // Shadows: an NPC transform without a shadow, one with, and shadows off.
    for (const npc of [2782, 1]) {
        c.ops.push('player 0', `appear 0 0 1426 ${npc} 0,0,0,0,0 null`, 'set 0 Z 6464', 'set 0 S 6464', ...centre(0, 0, 8));
    }
    c.ops.push('shadows 0', ...centre(0, 0, 8), 'shadows 1');
    // NPC shadows: none (2782), default (1) and tinted (1633), each with and without shadows; then the shadow animated
    // by the walk seq while a primary seq also plays, at different walk and primary frames.
    for (const npc of [2782, 1, 1633]) {
        const bas = NpcType.List(npc).m_baseAnimationSet;
        c.ops.push('npc 1', `npctype 1 ${npc}`, `set 1 U ${bas}`, 'set 1 Z 6464', 'set 1 S 6464', ...centre(1, 0, 14), 'shadows 0', ...centre(1, 0, 14), 'shadows 1');
    }
    const [ready, walk] = basSeqs(4);
    const walkFrames = Math.max(1, seqInfo(walk).frames);
    const readyFrames = Math.max(1, seqInfo(ready).frames);
    c.ops.push('npc 1', 'npctype 1 1', 'set 1 U 4', 'set 1 Z 6464', 'set 1 S 6464', `set 1 M ${walk}`, `set 1 bb ${ready}`, 'set 1 gc 0');
    for (const [wf, sf] of [
        [0, readyFrames - 1],
        [walkFrames - 1, 0],
        [walkFrames >> 1, 0],
        [1, readyFrames >> 1]
    ]) {
        c.ops.push(`set 1 yb ${wf}`, `set 1 Xb ${sf}`, ...centre(1, 0, 15), ...centre(1, 900, 15));
    }
    // A primary frame (30 of seq 3's 35) past the end of the walk seq: the shadow must take the walk frame.
    c.ops.push('set 1 bb 3', 'set 1 Xb 30', 'set 1 w 31', 'set 1 yb 1', ...centre(1, 0, 15));
    // Hint arrows. Targets: npcs at uc.l[0..3] (slots 20..23), players at tf.J[0..3] (24..27), at x/z offsets in
    // 1/32-tile units of 0, 4, 600 and 601 (squared 0, 16, 360000, 360001 with the other axis 0 or 1).
    player(['local 0', 'base 0 0']);
    const offsets = [
        [0, 0],
        [4, 0],
        [0, -4],
        [600, 0],
        [0, 600],
        [600, 1],
        [3, 2],
        [-200, 150]
    ];
    for (let i = 0; i < 4; i++) {
        const [nx, nz] = offsets[i];
        const [px, pz] = offsets[i + 4];
        c.ops.push(`npc ${20 + i}`, `set ${20 + i} Z ${6464 + nx * 32}`, `set ${20 + i} S ${6464 + nz * 32}`, `npcat ${i} ${20 + i}`);
        c.ops.push(`player ${24 + i}`, `set ${24 + i} Z ${6464 + px * 32}`, `set ${24 + i} S ${6464 + pz * 32}`, `plat ${i} ${24 + i}`);
    }
    for (let i = 0; i < 4; i++) {
        c.ops.push(`hint 0 1 ${i} 0 0 300`, `hint 1 10 ${i} 0 0 2000`, 'hint 2 -1', 'hint 3 -1', ...centre(0, 0, 9));
    }
    for (const actor of [-1, 32767, 32768, 2047, 2048]) c.ops.push(`hint 0 1 ${actor} 0 0 300`, `hint 1 10 ${actor} 0 0 2000`, ...centre(0, 0, 10));
    // Tile arrows: (x - base) * 4 + 2 - x / 32 from tile 50 at fine 6464 (x / 32 = 202): tiles 50, 51, 99, 200.
    for (const tile of [50, 51, 49, 99, 200]) c.ops.push(`hint 0 2 0 ${tile} 50 300`, 'hint 1 -1', ...centre(0, 0, 11));
    c.ops.push('hint 0 2 0 50 50 -1', ...centre(0, 0, 11), 'hint 0 3 0 50 50 300', ...centre(0, 0, 11));
    for (let i = 0; i < 4; i++) c.ops.push(`hint ${i} -1`);
    c.ops.push('local -1');
    // The private hint-arrow draw on its distance edges, drawn at the centre camera.
    for (const [z, x] of [
        [0, 0],
        [4, 0],
        [0, -4],
        [3, 2],
        [600, 0],
        [0, 600],
        [600, 1],
        [-1, 600],
        [100, -100],
        [-300, 7]
    ]) {
        c.ops.push(`cls ${z}`, `arrow 0 ${z} 636 0 300 636 ${x} 46340 0 46340 0 0 65536 1500`);
    }
    c.ops.push('arrow 0 100 636 0 300 636 0 46340 0 46340 0 0 65536 -1');
    // Hill tilt: a hill-rotating NPC and player on the steep terrain with a hill-skewed spot anim.
    c.ops.push('terrain 2', 'spothill 5 1', 'npc 1', 'npctype 1 58', 'set 1 U 17', 'set 1 Z 6464', 'set 1 S 6464', 'set 1 H -8200', 'set 1 fb 5', 'set 1 lb 1', 'set 1 Ub 2', 'set 1 Ab 40');
    c.ops.push(...centre(1, 300, 12), ...centre(1, 1200, 12));
    player(['set 0 H -8200', 'set 0 U 17', 'set 0 fb 5', 'set 0 lb 1', 'set 0 Ub 2']);
    c.ops.push('appear 0 0 17 -1 0,0,0,0,0 null', ...centre(0, 300, 13), ...centre(0, 1700, 13), 'spothill 5 0', 'terrain 0');
}

// The debug ballast while the hard body-model count climbs past 50, one new appearance per draw: the ballast first
// grows to 50 minus the count, then shrinks one entry per draw (nulling the top entry), and stops at a count of 50.
function ramp(c: Ctx): void {
    c.ops.push('terrain 0', 'mapl 0', 'level 0', 'shadows 1', 'local -1', 'modewhat 2', 'ballast 64 0');
    for (let k = 0; k < 64; k++) {
        const colours = [k % 12, ((k / 12) | 0) % 16, (k * 7) % 16, k % 6, (k * 3) % 8];
        c.ops.push('player 0', `appear 0 ${k & 1} 1426 -1 ${colours.join(',')} null`, 'set 0 Z 6464', 'set 0 S 6464', ...centre(0, 0, 30));
    }
    c.ops.push('modewhat 0');
}

// A slot anim with frames on an NPC and on a player: each build throws on the null slot matrix and leaves the static
// layer arrays (NpcType.layerFramesets, PlayerModel.slotFramesets) set, so the next animated builds without slot anims
// throw too, in Java and TS alike. Run last, since it breaks every later animated build.
function poison(c: Ctx): void {
    c.ops.push('terrain 0', 'mapl 0', 'level 0', 'shadows 1', 'modewhat 0', 'local -1');
    c.ops.push('npc 0', 'npctype 0 1', 'set 0 U 4', 'set 0 Z 6464', 'set 0 S 6464', 'set 0 M 819', 'set 0 yb 1', 'set 0 O 2');
    c.ops.push(...centre(0, 0, 20), 'slot 0 3 808 2 3 1 0 0', ...centre(0, 0, 21), 'slot 0 3 -1', ...centre(0, 0, 22));
    c.ops.push('player 1', 'appear 1 0 1426 -1 0,0,0,0,0 null', 'set 1 Z 6464', 'set 1 S 6464', 'set 1 M 819', 'set 1 yb 1', 'set 1 O 2');
    c.ops.push(...centre(1, 0, 23), 'slot 1 5 819 1 2 0 0 0', ...centre(1, 0, 24), 'slot 1 5 -1', ...centre(1, 0, 25));
    c.ops.push('npc 2', 'npctype 2 2', 'set 2 U 4', 'set 2 M 819', ...centre(2, 0, 26), 'set 2 M -1', ...centre(2, 0, 27));
}

function generateScript(): string[] {
    const next = rng(530530);
    const below = (n: number): number => (next() >>> 0) % n;
    const c: Ctx = { next, below, pick: <T>(a: readonly T[]): T => a[below(a.length)], ops: ['init', 'cls 7'], bad: false };
    // Hint-arrow targets: npcs in slots 20..23, players in 24..27 (each player scenario moves them around its player).
    for (let i = 0; i < 4; i++) c.ops.push(`npc ${20 + i}`, `player ${24 + i}`);
    edges(c);
    for (let round = 0; round < 160; round++) {
        c.bad = false;
        const slot = below(16);
        switch (below(6)) {
            case 0:
            case 1:
                npcScenario(c, slot);
                break;
            case 2:
                playerScenario(c, slot);
                break;
            case 3:
                spotScenario(c, slot);
                break;
            case 4:
                projScenario(c, slot);
                break;
            default:
                objScenario(c, slot);
        }
    }
    ramp(c);
    poison(c);
    return c.ops;
}

// ---- the TS side ----

function runTs(script: string[]): string[] {
    const frames = archive(0);
    const bases = archive(1);
    const config = archive(2);
    const models = archive(7);
    const npcs = archive(18);
    const objs = archive(19);
    const seqs = archive(20);
    const spots = archive(21);
    const varbits = archive(22);
    const locs = archive(16);
    const E: (ModelSource | null)[] = new Array<ModelSource | null>(32).fill(null);
    const ts = terrains();
    const flags = maplFlags();
    const lit = new Map<number, ModelLit>();
    const litModel = (id: number): ModelLit | null => {
        if (id < 0) return null;
        let m = lit.get(id);
        if (m === undefined) {
            m = requireNonNull(ModelUnlit.Load(Client.modelsArchive, id, 0)).Light(64, 768, -50, -10, -50);
            lit.set(id, m);
        }
        return m;
    };
    const px = new Int32Array(W * H);
    let bg = new Int32Array(W * H);
    const fill = (seed: number): void => {
        for (let i = 0; i < px.length; i++) px[i] = Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
        bg = px.slice();
    };
    const entity = (s: number): ModelSource => requireNonNull(E[s]);
    const actor = (s: number): ClientEntity => {
        const e = entity(s);
        if (!(e instanceof ClientEntity)) throw new TypeError('ClassCastException: not an ob');
        return e;
    };
    const drawState = (e: ModelSource): string => {
        let changed = 0;
        for (let i = 0; i < px.length; i++) if (px[i] !== bg[i]) changed++;
        let s = ` fb=${hashInts(px)} px=${changed} picked=${ModelLit.pickedCount}`;
        const w = ModelLit.pickedTypecodes;
        if (w === null) s += ':null';
        else {
            let h = 1;
            for (let i = 0; i < ModelLit.pickedCount && i < w.length; i++) h = (Math.imul(h, 31) + longHash(w[i])) | 0;
            s += `:${h}`;
        }
        s += ` trans=${Pix3D.trans} tilt=${ClientEntity.tiltPitch},${ClientEntity.groundTiltRoll},${ClientEntity.tiltOffsetY}`;
        const ballast = ClientPlayer.debugBallast;
        s += ` pad=${ClientPlayer.memoryPaddingCount},${ballast === null ? -1 : ballast.filter(b => b !== null).length}`;
        s += ` sh=${ClientEntity.shadowModelCache.countHard()} pm=${PlayerModel.modelCacheCount()} ha=${HintArrow.modelCache.countHard()}`;
        return s + ` miny=${e.getMinY()}`;
    };
    const init = (): string => {
        let s = `Q=${Preferences.characterShadows ? 1 : 0} jl.c=${GameVariant.id} ah.f=${Client.playerLevel} hh.kb=${Client.loopCycle}`;
        s += ` oi.e=${Client.modewhat} vg.Q=${ClientPlayer.memoryPaddingCount} oh.g=${ClientPlayer.debugBallast === null ? 'null' : ClientPlayer.debugBallast.length}`;
        s += ` hk.e=${Client.mapBuildBaseX} vj.t=${Client.mapBuildBaseZ} te.g=${Client.localPlayer === null ? 'null' : 'obj'}`;
        s += ` ve.t=${Client.hintArrows.length} uc.l=${Client.npcs.length} tf.J=${Client.players.length}`;
        s += ` vj.d=${ClientVarCache.m_var.length} tilt=${ClientEntity.tiltPitch},${ClientEntity.groundTiltRoll},${ClientEntity.tiltOffsetY}`;
        s += ` ve.q=${world.levelHeightmaps === null ? 'null' : 'obj'} tb.t=${ClientBuild.m_mapl === null ? 'null' : ClientBuild.m_mapl.length}`;
        s += ` dc.a=${Pix3D.lowDetail ? 1 : 0} rf.x=${Preferences.sceneryShadows} lf.g=${world.mainGroundh === null ? 'null' : 'obj'}`;
        return s;
    };
    const ints = (s: string): Int32Array | null => (s === 'null' ? null : Int32Array.from(s.split(',').map(Number)));

    const run = (t: string[], n: number[]): string => {
        switch (t[0]) {
            case 'init':
                return init();
            case 'cls':
                fill(n[1]);
                return '';
            case 'pick':
                ModelLit.checkHover = n[1] !== 0;
                ModelLitImpl.mouseX = n[2];
                ModelLit.mouseY = n[3];
                ModelLit.pickedCount = n[4];
                return '';
            case 'shadows':
                Preferences.characterShadows = n[1] !== 0;
                return '';
            case 'level':
                Client.playerLevel = n[1];
                return '';
            case 'terrain':
                world.levelHeightmaps = world.mainGroundh = n[1] < 0 ? null : ts[n[1]];
                return '';
            case 'ground':
                world.mainGroundh = n[1] < 0 ? null : ts[n[1]];
                return '';
            case 'mapl':
                ClientBuild.m_mapl = n[1] < 0 ? null : flags[n[1]];
                return '';
            case 'loop':
                Client.loopCycle = n[1];
                return '';
            case 'modewhat':
                Client.modewhat = n[1];
                return '';
            case 'ballast':
                ClientPlayer.debugBallast = n[1] < 0 ? null : new Array<Uint8Array | null>(n[1]).fill(null);
                ClientPlayer.memoryPaddingCount = n[2];
                return '';
            case 'base':
                Client.mapBuildBaseX = n[1];
                Client.mapBuildBaseZ = n[2];
                return '';
            case 'varp':
                ClientVarCache.m_var[n[1]] = n[2];
                return '';
            case 'tween':
                SeqType.forceTween = n[1] !== 0;
                return '';
            case 'recol':
                if (n[1] === 0) {
                    PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Rs;
                    PlayerModel.recolourSources = PlayerModel.recolourSourcesRs;
                    PlayerModel.recolourSources2 = PlayerModel.recolourSources2Rs;
                    PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
                } else {
                    PlayerModel.recolourSources2 = PlayerModel.recolourSources2Alt;
                    PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Alt;
                    PlayerModel.recolourSources = PlayerModel.recolourSourcesAlt;
                    PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsAlt;
                }
                return '';
            case 'local': {
                const e = n[1] < 0 ? null : E[n[1]];
                if (e !== null && !(e instanceof ClientPlayer)) throw new TypeError('ClassCastException: not a pb');
                Client.localPlayer = e;
                return '';
            }
            case 'hint': {
                if (n[2] < 0) {
                    Client.hintArrows[n[1]] = null;
                    return '';
                }
                const h = new HintArrow();
                h.type = n[2];
                h.actor = n[3];
                h.x = n[4];
                h.z = n[5];
                h.model = n[6];
                Client.hintArrows[n[1]] = h;
                return '';
            }
            case 'npcat': {
                const e = n[2] < 0 ? null : E[n[2]];
                if (e !== null && !(e instanceof ClientNpc)) throw new TypeError('ClassCastException: not a bk');
                Client.npcs[n[1]] = e;
                return '';
            }
            case 'plat': {
                const e = n[2] < 0 ? null : E[n[2]];
                if (e !== null && !(e instanceof ClientPlayer)) throw new TypeError('ClassCastException: not a pb');
                Client.players[n[1]] = e;
                return '';
            }
            case 'spothill':
                SpotType.List(n[1]).hillSkew = n[2] !== 0;
                return '';
            case 'spot':
                E[n[1]] = new MapSpotAnim(n[2], n[3], n[4], n[5], n[6], n[7], n[8]);
                return ' | ' + dump(E[n[1]]);
            case 'proj':
                E[n[1]] = new ClientProj(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], n[10], n[11], n[12]);
                return ' | ' + dump(E[n[1]]);
            case 'obj': {
                const o = new ClientObj();
                o.id = n[2];
                o.count = n[3];
                E[n[1]] = o;
                return ' | ' + dump(o);
            }
            case 'player':
                E[n[1]] = new ClientPlayer();
                return ' | ' + dump(E[n[1]]);
            case 'npc':
                E[n[1]] = new ClientNpc();
                return ' | ' + dump(E[n[1]]);
            case 'appear': {
                const p = entity(n[1]);
                if (!(p instanceof ClientPlayer)) throw new TypeError('ClassCastException: not a pb');
                if (p.appearance === null) p.appearance = new PlayerModel();
                p.bas = n[3];
                p.appearance.setAppearance(n[2] !== 0, requireNonNull(ints(t[5])), n[3], ints(t[6]), n[4]);
                return ' | ' + dump(p);
            }
            case 'npctype': {
                const b = entity(n[1]);
                if (!(b instanceof ClientNpc)) throw new TypeError('ClassCastException: not a bk');
                b.setType(n[2] < 0 ? null : NpcType.List(n[2]));
                return ' | ' + dump(b);
            }
            case 'set': {
                const e = entity(n[1]);
                const chain = e instanceof ClientPlayer ? ['pb', 'ob'] : e instanceof ClientNpc ? ['bk', 'ob'] : [dump(e).split(' ')[0]];
                const cls = chain.find(k => t[2] in CLASS_FIELDS[k]);
                if (cls === undefined) throw new Error(`unknown op field ${t[2]}`);
                const record = e as unknown as Statics;
                const name = CLASS_FIELDS[cls][t[2]];
                record[name] = typeof record[name] === 'boolean' ? n[3] !== 0 : n[3];
                return ' | ' + dump(e);
            }
            case 'slot': {
                const a = actor(n[1]);
                if (n[3] < 0) a.modelAnims[n[2]] = null;
                else {
                    const s = new ActorSlotAnim();
                    s.seq = n[3];
                    s.frame = n[4];
                    s.next = n[5];
                    s.cycle = n[6];
                    s.delay = n[7];
                    s.loops = n[8];
                    a.modelAnims[n[2]] = s;
                }
                return ' | ' + dump(a);
            }
            case 'attach': {
                const a = actor(n[1]);
                a.attachment = n[2] === 0 ? litModel(n[3]) : n[2] === 1 ? {} : n[2] === 3 ? new ClientLocAnim(n[3], n[4], n[5], n[6], n[7], n[8], -1, false, null) : null;
                return ' | ' + dump(a);
            }
            case 'adv': {
                const e = entity(n[1]);
                if (e instanceof MapSpotAnim) e.advance(n[2]);
                else if (e instanceof ClientProj) e.advance(n[2]);
                else throw new TypeError('ClassCastException: not an hl');
                return ' | ' + dump(e);
            }
            case 'target': {
                const e = entity(n[1]);
                if (!(e instanceof ClientProj)) throw new TypeError('ClassCastException: not an hl');
                e.setTarget(n[2], n[3], n[4], n[5]);
                return ' | ' + dump(e);
            }
            case 'draw': {
                const e = entity(n[1]);
                bg = px.slice();
                e.draw(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], BigInt(t[10]), n[11], n[12] !== 0 ? new ParticleSystem() : null);
                return drawState(e) + ' | ' + dump(e);
            }
            case 'update':
                entity(n[1]).update(n[2], n[3], n[4], n[5], n[6]);
                return ' | ' + dump(E[n[1]]);
            case 'miny':
                return ` ${entity(n[1]).getMinY()}`;
            case 'model': {
                const e = entity(n[1]);
                if (!(e instanceof MapSpotAnim) && !(e instanceof ClientProj)) throw new TypeError('ClassCastException: not an hl');
                const m = (e as unknown as { GetTempModel(): ModelLit | null }).GetTempModel();
                return ` ${modelDump(m)} | ${dump(e)}`;
            }
            case 'arrow': {
                const p = entity(n[1]);
                if (!(p instanceof ClientPlayer)) throw new TypeError('ClassCastException: not a pb');
                bg = px.slice();
                const base = litModel(n[14]);
                type Arrow = (a1: number, a2: number, a3: number, a5: number, a6: number, a7: number, a8: number, a9: ParticleSystem | null, a10: number, a11: number, a12: number, a13: number, a14: number, a15: ModelLit | null) => void;
                const arrow = (p as unknown as { drawHintArrow: Arrow }).drawHintArrow;
                arrow.call(p, n[2], n[3], n[4], n[5], n[6], n[7], n[8], null, n[9], n[10], n[11], n[12], n[13], base);
                return drawState(p) + ' | ' + dump(p);
            }
            case 'dump':
                return ' | ' + dump(E[n[1]]);
            default:
                throw new Error(`unknown op ${t[0]}`);
        }
    };

    const entityOps = new Set(['spot', 'proj', 'obj', 'player', 'npc', 'appear', 'npctype', 'set', 'slot', 'attach', 'adv', 'target', 'draw', 'update', 'model', 'arrow']);
    const got: string[] = [];
    let setup = false;
    for (const line of script) {
        if (!setup && line !== 'init') {
            // What the oracle does after "init": the client's config-loader initialisation, the RS recolour tables, the
            // 320x240 framebuffer, brightness 0.8 without dc.a(F)'s jitter and the fake textures.
            Client.modelsArchive = models;
            IdkType.Init(config, models);
            NpcType.Init(npcs, models);
            ObjType.Init(objs, true, null, models);
            SeqType.Init(seqs, bases, frames);
            LocType.Init(models, locs, true);
            BASTypeList.init(config);
            SpotType.Init(models, spots);
            VarBitType.Init(varbits);
            Client.recolourPalette = LocType.recolPalette = NpcType.clientPalette = ObjType.recolourPalette = new Int16Array(256);
            PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Rs;
            PlayerModel.recolourSources = PlayerModel.recolourSourcesRs;
            PlayerModel.recolourSources2 = PlayerModel.recolourSources2Rs;
            PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
            Pix2D.setPixels(px, W, H);
            setBounds(Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY);
            const pix3d = Pix3D as unknown as Statics;
            pix3d['brightness'] = Math.fround(0.8);
            (pix3d['initColourTable'] as (a: number, b: number) => void).call(Pix3D, 0, 512);
            Pix3D.textureProvider = textures;
            fill(0);
            setup = true;
        }
        const t = line.split(' ');
        const n = t.map((s, i) => (i === 0 ? 0 : /^-?\d+$/.test(s) && Number(s) >= -2147483648 && Number(s) <= 2147483647 ? Number(s) : 0));
        let result = 'ok';
        let extra = '';
        try {
            extra = run(t, n);
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('unknown op')) throw e;
            result = code(e);
            // PROVIDER_ENTITIES_TRACE=<line> prints the stack of the exception that line raised (=all: every throw site).
            const trace = process.env.PROVIDER_ENTITIES_TRACE;
            if (trace === String(got.length)) console.log(line, e instanceof Error ? e.stack : e);
            if (trace === 'all') {
                const heading = `#${got.length} ${t[0]} ${String(e)} @ `;
                let frames = '';
                if (e instanceof Error) {
                    frames = (e.stack ?? '')
                        .split('\n')
                        .slice(2, 4)
                        .map(s => s.trim())
                        .join(' < ');
                }
                console.log(heading + frames);
            }
            if (entityOps.has(t[0]) && n[1] >= 0 && n[1] < E.length) {
                const e2 = E[n[1]];
                extra = (t[0] === 'draw' || t[0] === 'arrow') && e2 !== null ? drawState(e2) : '';
                extra += ' | ' + dump(e2);
            }
        }
        got.push(result + extra);
    }
    return got;
}

test('each entity class declares exactly the instance fields of its Java class', () => {
    const own = (o: object): string[] => Object.keys(o).sort();
    const ob = Object.values(OB);
    const cases: [object, string[]][] = [
        [new ClientNpc(), [...ob, ...Object.values(CLASS_FIELDS['bk'])]],
        [new ClientPlayer(), [...ob, ...Object.values(CLASS_FIELDS['pb'])]],
        [new ClientObj(), Object.values(CLASS_FIELDS['ig'])],
        [new PlayerModel(), Object.values(CLASS_FIELDS['cl'])]
    ];
    for (const [o, want] of cases) expect(own(o)).toEqual([...want].sort());
});

test('MapSpotAnim, ClientProj, ClientObj, ClientPlayer and ClientNpc match ac, hl, ig, pb and bk in client.jar: update, getMinY, the model getters and the draws', () => {
    const { script, want, got } = withClinitStatics(resets(), () =>
        withClientArrays(() => {
            // Generating the script reads the configs, so the loaders are initialised for it and reset before the run.
            const frames = archive(0);
            const bases = archive(1);
            SeqType.Init(archive(20), bases, frames);
            BASTypeList.init(archive(2));
            NpcType.Init(archive(18), null);
            SpotType.Init(null, archive(21));
            VarBitType.Init(archive(22));
            IdkType.Init(archive(2), null);
            const script = generateScript();
            for (const [target, clinit] of resets().map(r => [r.target, r.clinit] as const)) Object.assign(target, clinit);
            const want = runOracle(script);
            return { script, want, got: runTs(script) };
        })
    );

    if (process.env.PROVIDER_ENTITIES_DUMP) {
        writeFileSync(`${process.env.PROVIDER_ENTITIES_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.PROVIDER_ENTITIES_DUMP}.java`, want.join('\n') + '\n');
        writeFileSync(`${process.env.PROVIDER_ENTITIES_DUMP}.ts`, got.join('\n') + '\n');
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

    // The script reaches what it claims.
    const lines = (op: string): string[] => want.filter((_, i) => script[i].startsWith(op + ' '));
    const drawn = (cls: string): string[] => lines('draw').filter(l => l.includes(` | ${cls} `) && / px=[1-9]/.test(l));
    for (const cls of ['ac', 'hl', 'ig', 'pb', 'bk']) expect(drawn(cls).length, `${cls} draws that changed pixels`).toBeGreaterThan(5);
    expect(lines('draw').filter(l => / picked=[1-9]/.test(l)).length).toBeGreaterThan(10);
    expect(lines('draw').some(l => / tilt=(?!0,0,0)/.test(l))).toBe(true);
    expect(lines('arrow').filter(l => / px=[1-9]/.test(l)).length).toBeGreaterThan(2);
    expect(lines('model').filter(l => l.startsWith('ok fc')).length).toBeGreaterThan(10);
    const codes = new Set(want.map(l => l.split(' ')[0].split('|')[0]));
    for (const c of ['ok', 'npe', 'aioobe', 'cce']) expect(codes.has(c), c).toBe(true);

    // The fixed edge cases land where edges() and poison() say they do (on the Java side).
    const fixed = (typecode: number): string[] => want.filter((_, i) => script[i].startsWith('draw ') && script[i].includes(` ${CENTRE} ${typecode} 0 0`));
    const result = (l: string): string => l.split(' ')[0];
    const px = (l: string): number => Number(/ px=(\d+)/.exec(l)?.[1] ?? -1);
    expect(
        fixed(1)
            .concat(fixed(2))
            .every(l => result(l) === 'ok' && px(l) > 0)
    ).toBe(true);
    const window = fixed(3).map(px);
    expect(window[0]).toBe(window[2]);
    expect([window[1], window[3], window[4]].every(p => p === window[1] && p < window[0])).toBe(true);
    expect(fixed(4).map(result)).toEqual(['cce', 'ok', 'npe', 'ok', 'ok']);
    expect(fixed(7).map(result)).toEqual(['ok', 'ok', 'aioobe', 'aioobe', 'ok', 'npe']);
    expect(fixed(7).map(l => / pad=([-\d,]+)/.exec(l)?.[1])).toEqual(['49,49', '49,0', '44,44', '48,48', '49,49', '0,-1']);
    const noArrows = fixed(10).map(px);
    expect(noArrows.every(p => p === noArrows[0])).toBe(true);
    expect(fixed(9).every(l => px(l) > noArrows[0])).toBe(true);
    const edgeArrows = want.filter((_, i) => script[i].startsWith('arrow 0 ') && script[i].includes(' 636 0 300 636 ')).map(l => (result(l) === 'ok' ? px(l) > 0 : result(l)));
    expect(edgeArrows).toEqual([false, true, true, false, true, true, false, false, true, true, 'npe']);
    expect(
        fixed(12)
            .concat(fixed(13))
            .every(l => / tilt=(?!0,0,0)/.test(l) && px(l) > 0)
    ).toBe(true);
    expect([20, 21, 22, 23, 24, 25, 26, 27].map(t => result(fixed(t)[0]))).toEqual(['ok', 'npe', 'npe', 'ok', 'npe', 'npe', 'npe', 'ok']);
    // The ramp shrinks a full ballast (vg.Q entries, all set) one draw at a time and reaches a body count of exactly 50.
    const ramp = fixed(30).map(l => / pad=(\d+),(\d+) sh=\d+ pm=(\d+)/.exec(l)?.slice(1).map(Number) ?? []);
    expect(ramp.every(([q, set]) => q === set)).toBe(true);
    expect(ramp.some(([q, , pm]) => pm < 49 && q === 50 - pm)).toBe(true);
    expect(ramp.some(([, , pm]) => pm === 50)).toBe(true);
}, 600000);
