import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '../../src/client/Client.js';
import GameVariant from '../../src/client/GameVariant.js';
import BASTypeList from '../../src/config/BASTypeList.js';
import IdkType from '../../src/config/IdkType.js';
import LocType from '../../src/config/LocType.js';
import NpcType from '../../src/config/NpcType.js';
import ObjType from '../../src/config/ObjType.js';
import SeqType from '../../src/config/SeqType.js';
import VarBitType from '../../src/config/VarBitType.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import AnimFrame from '../../src/dash3d/AnimFrame.js';
import AnimFrameSet from '../../src/dash3d/AnimFrameSet.js';
import ClientLocAnim from '../../src/dash3d/ClientLocAnim.js';
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
import type AbstractSprite from '../../src/graphics/AbstractSprite.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import Pix32 from '../../src/graphics/Pix32.js';
import SoftwareAlphaSprite from '../../src/graphics/SoftwareAlphaSprite.js';
import IfType from '../../src/ui/IfType.js';
import Preferences from '../../src/ui/Preferences.js';
import ClientVarCache from '../../src/util/ClientVarCache.js';
import { arrayAt, requireNonNull } from '../../src/util/JavaArray.js';
import { mathRandom } from '../../src/util/JavaRandom.js';
import { localAssets } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { PIX2D, SPRITE_LOADER, type StaticReset, withClinitStatics } from './staticState.js';

// Unit locanim against client.jar: ml (src/dash3d/ClientLocAnim.ts: the constructor, update a(IIIII)V, getMinY
// b()I, draw a(IIIIIIIIJILue;)V, GetTempModel b(B)Lug;, the private model build a(ZI)Lug; and the private frame
// advance a(BII)V with its Client.TriggerSeqSound call at javap offset 0x116) and the four aj renderer methods
// (src/ui/IfType.ts: GetMask a(I)Z, GetTempModel a(Lcl;IIZIZLek;)Lnd;, GetInvBackground b(ZI)Lvc; and GetGraphic
// c(ZI)Lvc;, with IfType.m_spriteCache/m_modelCache and IfType.resourceMissing).
//
// A seeded script runs through provider-locanim/ProviderLocAnimOracle.java (javac'd next to client.jar, driving the
// real gamepack classes over the real cache: the client's own config-loader initialisation, real locs, seqs, frames,
// models, NPCs, objs, kits, interfaces and sprites) and through the TS port. Every result line must match: the result
// (ok or the Java exception), any return value, every Client.TriggerSeqSound call the operation made (the oracle
// rewrites ml's sf.a call to a recorder; here Client.TriggerSeqSound is replaced by the same recorder) and a dump of the
// state it touched: every ml field; every fc field of a returned model (arrays as length:hash) with an identity tag
// (numbered on first sight on both sides, so cache hits, the animation scratch copies and LRU evictions are compared);
// a returned sprite's class, size, offsets, crop and pixels with its identity tag; the component's model/sprite/mask
// fields; resourceMissing and the free slots of IfType.m_modelCache and m_spriteCache; after a draw the framebuffer
// hash, the changed pixel count and Pix3D.trans.
//
// ClientLocAnim: animated locs from the cache (every shape their models list, angles 0..7, all four levels, sizes up to
// the largest, near the map edge so the footprint reads past the heightmap) with their own sequences and with
// sequences that carry frame sounds, through hundreds of cycles of small steps and jumps past 100 cycles (the
// whole-loop skip and its modulo), exact advance boundaries (99/100/101 cycles, a skip ending exactly on a frame's
// delay and one past it), non-looping sequences that run out, one-frame sequences, randomised starts (Math.random
// seeded identically on both sides), a previous entity with the same sequence (duplicate behaviour 0 and not), a
// previous entity of another class, missing sequences and loc ids, multilocs (variant 0 and not, varp and varbit
// selectors switching the variant's animation, the variant's random start), hill skew types 4 and 5 (the second
// heightmap: next level, none on level 3, the main layer while underwater), the underwater and missing heightmaps,
// scenery shadows 0..3 with force-tween on and off (seen through the model build's var1 = true early return; loc -1 is
// the one id that reaches the test's second operand), getMinY, and draws on a 320x240 framebuffer.
//
// IfType: real components of every interface group that carries a model, a graphic or inventory slot sprites, read
// as decoded and then with their model type set to 0..7 (model files; NPC chatheads and bodies; player chatheads of
// male/female, default/explicit/obj-head equipment and an NPC-transformed player; objs with count variants; an obj
// whose model file is missing; three-kit heads; missing files and ids), active and inactive, without and with a
// sequence (chat-frame sequences included), resourceMissing preset both ways; graphics with all 96 flip/outline/
// alpha/shadow combinations of two sprites twice (each its own m_spriteCache entry, then all hits), random
// combinations and the active sprite, past the 200-entry sprite cache and the 50-entry model cache and back; inventory
// slots inside and outside the table; masks before and after the spans exist.
//
// Sensitivity (run in a private copy of the tree): 113 of 117 single-statement mutations of ClientLocAnim.ts and the
// four IfType methods make this test fail. The four survivors are equivalent on the 530 data: advanceFrame's
// `m_loops > 0` -> `>= 0` (no cached sequence has m_loops 0; all are -1 or 1..frames), the shadow test's
// `(flag16 || forceTween)` -> `flag16` and `frame != nextFrame` -> `frame != lastFrame` (both sit behind
// `frame != lastFrame`, and lastFrame is always -1 while frame never goes negative), and draw passing its own
// particle argument instead of this.particles (the SD ModelLitImpl.Render2 ignores the particle system).
//
// LOCANIM_DUMP=<prefix> writes the script and both outputs; LOCANIM_STATS=1 prints per-operation result counts.

type Statics = Record<string, unknown>;

// ---- static state: the fresh-JVM values of everything the script touches ----

// Every LRU cache a class owns, replaced by a fresh one of the same size (a fresh JVM's <clinit> state).
function freshCaches(target: object): Statics {
    const out: Statics = {};
    for (const [key, v] of Object.entries(target)) {
        if (v instanceof LRUHashCache) out[key] = new LRUHashCache((v as unknown as { m_cacheSize: number }).m_cacheSize);
    }
    return out;
}

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

// dd.r, oc.m and ud.d (JVM defaults) and pf.W.
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

// cb.<clinit>: the share maps and tic, and cb.D/cb.cb aliasing dc.g/dc.l.
function modelUnlitClinit(pix: Statics): Statics {
    return { shareMap: new Int32Array(10000), shareTic: 0, shareMap2: new Int32Array(10000), cos: pix['cosTable'], sin: pix['sinTable'] };
}

// of.<clinit>: the frame decoder's scratch.
function animFrameClinit(): Statics {
    return { tempTz: new Int16Array(500), tempTi: new Int16Array(500), tempTx: new Int16Array(500), tempFlags: new Uint8Array(500), tempPrevOrigin: new Int16Array(500), tempTy: new Int16Array(500) };
}

const pix3d = Pix3D as unknown as Statics;

// dc.a(IIII)V for the td clip (what dc.d() runs), assigned field by field as model-lit.test.ts does.
function setBounds(x0: number, y0: number, x1: number, y1: number): void {
    pix3d['width'] = (x1 - x0) | 0;
    pix3d['height'] = (y1 - y0) | 0;
    Pix3D.resetOrigin();
    const scanline = requireNonNull(pix3d['scanline'] as Int32Array | null);
    const height = pix3d['height'] as number;
    if (scanline.length < height) throw new Error('setBounds: the suite never needs a scanline reallocation');
    let offset = (Math.imul(y0, Pix2D.width) + x0) | 0;
    for (let y = 0; y < height; y++) {
        scanline[y] = offset;
        offset = (offset + Pix2D.width) | 0;
    }
}

// ---- dumps (the oracle's formats) ----

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

// ml's fields by obfuscated name, sorted as the oracle prints them.
const ML_FIELDS: [string, string][] = [
    ['A', 'x'],
    ['B', 'nextFrame'],
    ['D', 'minY'],
    ['F', 'seq'],
    ['G', 'cycle'],
    ['I', 'frame'],
    ['K', 'particles'],
    ['L', 'index'],
    ['M', 'shadow'],
    ['O', 'lastFrame'],
    ['P', 'hasMulti'],
    ['R', 'frameCycle'],
    ['j', 'level'],
    ['o', 'shape'],
    ['q', 'lastLocId'],
    ['s', 'angle'],
    ['y', 'z']
];

// aj fields the script may set (obfuscated name -> IfType field).
const AJ_FIELDS: Record<string, string> = {
    md: 'modelType',
    w: 'modelId',
    zb: 'activeModelType',
    O: 'activeModel',
    kc: 'modelThirdKit',
    mb: 'spriteId',
    lc: 'activeSprite',
    Kb: 'vFlip',
    fb: 'hFlip',
    tc: 'outline',
    Dc: 'spriteShadow',
    Xb: 'spriteAlpha',
    lb: 'invSlotSprite',
    s: 'maskStarts',
    ud: 'maskWidths'
};
const AJ_BOOLEANS = new Set(['Kb', 'fb', 'Xb']);
const AJ_ARRAYS = new Set(['lb', 's', 'ud']);

function hashInts(a: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0;
    return h;
}

function value(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (v instanceof Int32Array || v instanceof Int16Array || v instanceof Int8Array) return `${v.length}:${hashInts(v)}`;
    if (v instanceof Uint8Array) {
        let h = 1;
        for (let i = 0; i < v.length; i++) h = (Math.imul(h, 31) + ((v[i] << 24) >> 24)) | 0;
        return `${v.length}:${h}`;
    }
    if (Array.isArray(v)) {
        let h = 1;
        if (v.length > 0 && typeof v[0] === 'boolean') {
            for (const e of v) h = (Math.imul(h, 31) + (e ? 1 : 0)) | 0;
        } else {
            for (const row of v as (Int32Array | null)[]) h = (Math.imul(h, 31) + (row === null ? 0 : (Math.imul(31, row.length) + hashInts(row)) | 0)) | 0;
        }
        return `${v.length}:${h}`;
    }
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (typeof v === 'number') return String(v);
    return 'obj';
}

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

function model(m: object | null): string {
    if (m === null) return 'nullmodel';
    if (!(m instanceof ModelLitImpl)) return `${m instanceof ModelUnlit ? 'cb' : 'other'}#${tag(m)}`;
    const f = m as unknown as Statics;
    return `fc#${tag(m)}` + FC_FIELDS.map(([obf, name]) => ` ${obf}=${value(f[name])}`).join('') + ` j=${m.useAABBMouseCheck ? 1 : 0}`;
}

function sprite(s: AbstractSprite | null): string {
    if (s === null) return 'nullsprite';
    const name = s instanceof SoftwareAlphaSprite ? 'vh' : s instanceof Pix32 ? 'rh' : 'other';
    let out = `${name}#${tag(s)} ${s.width}x${s.height} off=${s.xOffset},${s.yOffset} crop=${s.cropW},${s.cropH}`;
    if (s instanceof Pix32) out += ` px=${value(s.pixels)}`;
    return out;
}

function entity(e: ClientLocAnim | null): string {
    if (e === null) return 'empty';
    const f = e as unknown as Statics;
    return (
        'ml' +
        ML_FIELDS.map(([obf, name]) => {
            const v = f[name];
            return ` ${obf}=${v instanceof SeqType ? `seq${v.id}` : value(v)}`;
        }).join('')
    );
}

function component(c: IfType | null): string {
    if (c === null) return 'nullcomponent';
    return (
        `aj ${c.id} t=${c.type} md=${c.modelType} w=${c.modelId} zb=${c.activeModelType} O=${c.activeModel} kc=${c.modelThirdKit} mb=${c.spriteId} lc=${c.activeSprite}` +
        ` Kb=${value(c.vFlip)} fb=${value(c.hFlip)} tc=${c.outline} Dc=${c.spriteShadow} Xb=${value(c.spriteAlpha)} lb=${value(c.invSlotSprite)} s=${value(c.maskStarts)} ud=${value(c.maskWidths)}`
    );
}

function remaining(cache: LRUHashCache<object>): number {
    return (cache as unknown as { remaining: number }).remaining;
}

function ifState(): string {
    return ` rk=${IfType.resourceMissing ? 1 : 0} ms=${remaining(IfType.m_modelCache)} ss=${remaining(IfType.m_spriteCache)}`;
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

function ints(s: string): Int32Array | null {
    if (s === 'null') return null;
    if (s === 'empty') return new Int32Array(0);
    return Int32Array.from(s.split(',').map(x => Number(x) | 0));
}

// Fake textures, identical to ProviderLocAnimOracle.Textures.
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

// The terrains of the oracle: 0 flat at 0, 1 rolling hills, 2 steep slopes.
function terrains(): Int32Array[][][] {
    const out: Int32Array[][][] = [];
    for (let k = 0; k < 3; k++) {
        const levels: Int32Array[][] = [];
        for (let p = 0; p < 4; p++) {
            const level: Int32Array[] = [];
            for (let x = 0; x < 105; x++) {
                const row = new Int32Array(105);
                for (let z = 0; z < 105; z++) {
                    if (k === 1) row[z] = -((x * 37 + z * 91) % 400) - ((x * z) % 97) * 3 - p * 50;
                    if (k === 2) row[z] = Math.imul((p * 131 + x * 7 - z * 11) | 0, 41);
                }
                level.push(row);
            }
            levels.push(level);
        }
        out.push(levels);
    }
    return out;
}

// An entity that is not a ClientLocAnim (ProviderLocAnimOracle.Foreign).
class Foreign extends ModelSource {
    draw(): void {}
    getMinY(): number {
        return 0;
    }
    update(): void {}
}

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

// ---- oracle ----

function runOracle(script: string[]): string[] {
    const scratch = mkdtempSync(join(tmpdir(), '530-locanim-'));
    try {
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const source = fileURLToPath(new URL('./provider-locanim/ProviderLocAnimOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', asm, '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(build.stderr.toString());
        const classpath = scratch + delimiter + gamepackPath;
        const patch = Bun.spawnSync(['java', asm, '-cp', classpath, 'ProviderLocAnimOracle', gamepackPath, scratch]);
        if (patch.exitCode !== 0) throw new Error(`ml patch failed: ${patch.stderr.toString()}`);
        const run = Bun.spawnSync(['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', classpath, 'ProviderLocAnimOracle', cachePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`ProviderLocAnimOracle exited ${run.exitCode}: ${run.stderr.toString()}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

// ---- fixture: what the cache holds ----

interface LocInfo {
    id: number;
    animation: number;
    shapes: number[];
    width: number;
    length: number;
    multi: Int32Array | null;
    // The varp the multiloc selector reads (multiVarp, or the varbit's base varp), -1 for none.
    selector: number;
}

interface SeqInfo {
    id: number;
    frames: number;
    loops: number;
    duplicate: number;
    delays: number[];
    sounds: boolean;
    chat: boolean;
}

interface Fixture {
    animated: LocInfo[];
    // Locs hill-skewed with types 4 and 5, the only ones whose model build reads the second heightmap (var18).
    skewed: LocInfo[];
    multis: LocInfo[];
    seqs: SeqInfo[];
    modelComponents: number[];
    spriteComponents: number[];
    effectComponents: number[];
    invComponents: { id: number; slots: number; filled: number[] }[];
    plainComponent: number;
    npcHeads: number[];
    npcs: number[];
    objHeads: number[];
    objs: number[];
    // Objs with count variants (ObjType.GetModelLit picks the variant for IfType's count of 10).
    objCounts: number[];
    kits: number[];
    spriteIds: number[];
}

function ids(archive: { GetGroupIdLimit(): number; GetFileIdLimit(group: number): number }, shift: number): number[] {
    const out: number[] = [];
    for (let g = 0; g < archive.GetGroupIdLimit(); g++) {
        const files = archive.GetFileIdLimit(g);
        for (let f = 0; f < files; f++) out.push((g << shift) | f);
    }
    return out;
}

function scan(): Fixture {
    const locs = requireNonNull(LocType.m_pConfigClient);
    const animated: LocInfo[] = [];
    const skewed: LocInfo[] = [];
    const multis: LocInfo[] = [];
    const animations = new Set<number>();
    for (const id of ids(locs, 8)) {
        const t = LocType.List(id);
        const info: LocInfo = {
            id,
            animation: t.animation,
            shapes: t.modelShapes === null ? (t.modelIds === null ? [] : [10]) : [...new Set(Array.from(t.modelShapes))],
            width: t.width,
            length: t.length,
            multi: t.multi,
            selector: t.multiVarbit !== -1 ? VarBitType.List(t.multiVarbit).baseVar : t.multiVarp
        };
        if (t.animation !== -1 && t.modelIds !== null && t.multi === null) {
            animated.push(info);
            animations.add(t.animation);
        }
        if (t.multi !== null) multis.push(info);
        if (t.hillSkew >= 4 && t.modelIds !== null && t.multi === null) skewed.push(info);
    }

    const seqs: SeqInfo[] = [];
    for (const id of ids(requireNonNull(SeqType.m_pConfigClient), 7)) {
        const s = SeqType.List(id);
        if (s.frames === null || s.delays === null) continue;
        seqs.push({
            id,
            frames: s.frames.length,
            loops: s.m_loops,
            duplicate: s.m_duplicateBehaviour,
            delays: Array.from(s.delays),
            sounds: s.sounds !== null && s.sounds.some(x => x !== null),
            chat: s.chatFrames !== null
        });
    }

    const interfaces = requireNonNull(IfType.m_pInterfaces);
    const modelComponents: number[] = [];
    const spriteComponents: number[] = [];
    const effectComponents: number[] = [];
    const invComponents: { id: number; slots: number; filled: number[] }[] = [];
    let plainComponent = -1;
    const spriteIds = new Set<number>();
    for (let g = 0; g < interfaces.GetGroupIdLimit(); g++) {
        if (!IfType.OpenInterface(g)) continue;
        const group = arrayAt(IfType.m_list, g);
        if (group === null) continue;
        for (const c of group) {
            if (c === null) continue;
            if (plainComponent === -1 && c.modelType === 1 && c.modelId === -1 && c.spriteId === -1) plainComponent = c.id;
            if (c.modelType !== 0 && !(c.modelType === 1 && c.modelId === -1)) modelComponents.push(c.id);
            if (c.spriteId !== -1 || c.activeSprite !== -1) {
                spriteComponents.push(c.id);
                if (c.spriteId !== -1) spriteIds.add(c.spriteId);
                if (c.activeSprite !== -1) spriteIds.add(c.activeSprite);
                if (c.vFlip || c.hFlip || c.outline !== 0 || c.spriteShadow !== 0 || c.spriteAlpha) effectComponents.push(c.id);
            }
            if (c.invSlotSprite !== null) {
                const filled = Array.from(c.invSlotSprite.keys()).filter(slot => arrayAt(c.invSlotSprite, slot) !== -1);
                invComponents.push({ id: c.id, slots: c.invSlotSprite.length, filled });
                for (const s of c.invSlotSprite) if (s !== -1) spriteIds.add(s);
            }
        }
    }

    const npcHeads: number[] = [];
    const npcs: number[] = [];
    for (const id of ids(requireNonNull(NpcType.m_pConfigClient), 7)) {
        if (id % 7 !== 0) continue;
        const t = NpcType.List(id);
        if (t.multi !== null) continue;
        npcs.push(id);
        if (t.headModels !== null && t.headModels.length > 0) npcHeads.push(id);
    }
    const objHeads: number[] = [];
    const objs: number[] = [];
    const objCounts: number[] = [];
    for (const id of ids(requireNonNull(ObjType.m_pConfigClient), 8)) {
        const t = ObjType.List(id);
        if (t.countObj !== null) objCounts.push(id);
        if (id % 5 !== 0) continue;
        objs.push(id);
        if (t.maleHead !== -1 && t.femaleHead !== -1) objHeads.push(id);
    }
    const kits: number[] = [];
    for (let id = 0; id < IdkType.m_numDefinitions; id++) if (IdkType.List(id).headModels[0] !== -1) kits.push(id);

    return {
        animated,
        skewed,
        multis,
        seqs,
        modelComponents,
        spriteComponents,
        effectComponents,
        invComponents,
        plainComponent,
        npcHeads,
        npcs,
        objHeads,
        objs,
        objCounts,
        kits,
        spriteIds: [...spriteIds].sort((a, b) => a - b)
    };
}

// ---- script ----

function generate(fx: Fixture): string[] {
    const r = rng(0x10ca41);
    const rand = (n: number): number => r() % n;
    const pick = <T>(a: T[]): T => a[rand(a.length)];
    const sin = (a: number): number => (65536.0 * Math.sin((a & 2047) * 0.0030679615)) | 0;
    const cos = (a: number): number => (65536.0 * Math.cos((a & 2047) * 0.0030679615)) | 0;
    const script: string[] = ['init', 'seed 530530', 'cycle 1000', 'hm 1 1', 'cls 1'];
    let cycle = 1000;
    const step = (n: number): void => {
        cycle = (cycle + n) | 0;
        script.push(`cycle ${cycle}`);
    };
    // A camera (pitch, yaw) and the model's camera-relative position, chosen so the model lands in view: depth 500..2900
    // and screen offsets within the 320x240 window, inverted through fc.a's yaw and pitch rotations.
    const drawOp = (slot: number): string => {
        const pitch = rand(400);
        const yaw = rand(4) === 0 ? 0 : rand(2048);
        const [sp, cp, sy, cy] = [sin(pitch) / 65536, cos(pitch) / 65536, sin(yaw) / 65536, cos(yaw) / 65536];
        const depth = 500 + rand(2400);
        const u = ((rand(240) - 120) * depth) / 512;
        const v = ((rand(160) - 80) * depth) / 512;
        const y = depth * sp + v * cp;
        const w = depth * cp - v * sp;
        const z = w * cy + u * sy;
        const x = u * cy - w * sy;
        return `draw ${slot} ${rand(2048)} ${sin(pitch)} ${cos(pitch)} ${sin(yaw)} ${cos(yaw)} ${Math.round(x)} ${Math.round(y)} ${Math.round(z)} ${rand(1 << 30)} ${rand(4)} ${rand(2)}`;
    };
    const seqOf = (id: number): SeqInfo | undefined => fx.seqs.find(s => s.id === id);
    const soundSeqs = fx.seqs.filter(s => s.sounds);
    const looping = fx.seqs.filter(s => s.loops > 0 && s.frames > 3);
    const oneShot = fx.seqs.filter(s => s.loops === -1 && s.frames > 2);
    const single = fx.seqs.filter(s => s.frames === 1);
    const chatSeqs = fx.seqs.filter(s => s.chat);

    // A loc and a run of cycles: ticks, model builds (both var1 values), getMinY and some draws.
    const life = (slot: number, loc: LocInfo, seq: number, random: number, prev: number, ops: number, xz?: [number, number], level?: number): void => {
        const shape = loc.shapes.length === 0 ? 10 : pick(loc.shapes);
        const angle = shape === 10 && rand(3) === 0 ? 4 + rand(4) : rand(4);
        const size = Math.max(loc.width, loc.length);
        const [x, z] = xz ?? [1 + rand(Math.max(1, 100 - size)), 1 + rand(Math.max(1, 100 - size))];
        script.push(`loc ${slot} ${loc.id} ${shape} ${angle} ${level ?? rand(4)} ${x} ${z} ${seq} ${random} ${prev}`);
        for (let i = 0; i < ops; i++) {
            const k = rand(20);
            if (k < 7) step(1 + rand(6));
            else if (k < 8) step(101 + rand(3000));
            else if (k < 9) step(rand(40));
            const op = rand(16);
            if (op < 6) script.push(`tick ${slot} ${rand(1000)} ${rand(1000)} ${rand(1000)} ${(x << 7) + rand(256)} ${(z << 7) + rand(256)}`);
            else if (op < 11) script.push(`model ${slot}`);
            else if (op < 13) script.push(`build ${slot} ${rand(2)}`);
            else if (op < 14) script.push(`miny ${slot}`);
            else if (op < 15) script.push(`cls ${rand(1000)}`, drawOp(slot));
            else script.push(`dump ${slot}`);
        }
    };

    // Animated locs with their own sequences, across terrains, shadows and force-tween.
    const locs = fx.animated.filter((_, i) => i % Math.max(1, Math.floor(fx.animated.length / 70)) === 0);
    locs.forEach((loc, i) => {
        if (i % 9 === 0) {
            const terrain = rand(3);
            script.push(`hm ${terrain} ${rand(4) === 0 ? rand(3) : terrain}`);
        }
        if (i % 7 === 0) script.push(`shadows ${rand(4)}`, `tween ${rand(2)}`);
        if (i % 11 === 0) script.push(`cls ${i}`);
        life(i % 48, loc, loc.animation, rand(2), -1, 6 + rand(10));
    });
    script.push('hm 1 1', 'shadows 2', 'tween 0');

    // Sequences with frame sounds (the TriggerSeqSound hook), looping, one-shot and single-frame sequences.
    const carrier = fx.animated.filter(l => l.shapes.includes(10));
    for (let i = 0; i < 40; i++) {
        const seq = pick(i % 4 === 0 ? looping : i % 4 === 1 ? oneShot : i % 4 === 2 ? single : soundSeqs.length > 0 ? soundSeqs : looping);
        life(48 + (i % 8), pick(carrier), seq.id, rand(2), -1, 20 + rand(20));
    }
    for (const seq of soundSeqs.slice(0, 25)) life(56, pick(carrier), seq.id, 0, -1, 30);

    // Exact boundaries of the frame advance. A fresh entity without a random start has cycle = loopCycle - 1 and frame
    // 0, so moving loopCycle to (creation - 1 + d) advances it by exactly d cycles: 99, 100 and 101 (the whole-loop
    // skip starts above 100; looping sequences with frame sounds show which path stepped the frames) and, for loops
    // that start after frame 0, skips that end exactly on a frame's delay and one cycle past it.
    const looped = fx.seqs.filter(s => s.loops > 0 && s.loops < s.frames && s.frames > 3);
    const boundarySeqs = [...looping.filter(s => s.sounds).slice(0, 12), ...looped.slice(0, 12)];
    const fixedLoc = carrier[0];
    for (const s of boundarySeqs) {
        const ds = [99, 100, 101];
        let sum = 0;
        for (let k = 0; k < s.frames - s.loops && ds.length < 11; k++) {
            const exact = sum + s.delays[k];
            if (exact > 100) ds.push(exact, exact + 1);
            sum += s.delays[k];
        }
        for (const d of ds) {
            script.push(`loc 59 ${fixedLoc.id} 10 0 0 20 20 ${s.id} 0 -1`, `cycle ${cycle - 1 + d}`, 'tick 59 0 0 0 2600 2650', 'model 59', `cycle ${cycle}`);
        }
    }

    // Previous entities: the same sequence (duplicate behaviour 0 copies the frame state), another sequence, a foreign
    // entity and a missing previous slot.
    for (let i = 0; i < 25; i++) {
        const loc = pick(carrier);
        const seq = seqOf(loc.animation) ?? pick(looping);
        life(60, loc, seq.id, rand(2), -1, 4);
        const prev = rand(5);
        life(61, loc, prev === 0 ? pick(looping).id : seq.id, rand(2), prev === 1 ? 999 : prev === 2 ? 63 : 60, 6);
    }
    const dup = fx.seqs.filter(s => s.duplicate === 0 && s.frames > 2);
    const nodup = fx.seqs.filter(s => s.duplicate !== 0 && s.frames > 2);
    for (let i = 0; i < 10; i++) {
        const seq = pick(i % 2 === 0 ? dup : nodup);
        const loc = pick(carrier);
        life(60, loc, seq.id, 1, -1, 3);
        step(3);
        life(61, loc, seq.id, 1, 60, 5);
    }

    // Hill skew types 4 and 5 (the second heightmap: the next level's, none on level 3, the main layer's level 0 while
    // underwater), static and animated, on both sloped terrains.
    for (let i = 0; i < Math.min(60, fx.skewed.length * 4); i++) {
        if (i % 10 === 0) {
            const terrain = 1 + rand(2);
            script.push(`hm ${terrain} ${rand(3) === 0 ? 3 - terrain : terrain}`);
        }
        const loc = fx.skewed[i % fx.skewed.length];
        life(55, loc, loc.animation !== -1 && rand(3) !== 0 ? loc.animation : rand(2) === 0 ? -1 : pick(looping).id, rand(2), -1, 4, undefined, i % 4);
    }
    script.push('hm 1 1');

    // The shadow-rebuild test past its first operand: only a loc whose id equals lastLocId (-1, the one value the
    // constructor writes) reaches `(frame != lastFrame || ...) && sceneryShadows >= 2`. Loc -1 decodes as a default
    // loc; off the heightmap a rebuild (var13 true) throws on the height read and a skipped build (var1 set, var13
    // false) returns null.
    script.push('hm 1 1');
    for (let shadows = 0; shadows < 4; shadows++) {
        for (let tween = 0; tween < 2; tween++) {
            script.push(`shadows ${shadows}`, `tween ${tween}`);
            for (const seq of [-1, pick(looping).id]) script.push(`loc 63 -1 10 0 0 150 150 ${seq} 0 -1`, 'build 63 1', 'build 63 0', 'model 63');
        }
    }
    script.push('shadows 2', 'tween 0');

    // Missing and invalid sequence ids, invalid loc ids.
    life(62, pick(carrier), 30000, 0, -1, 2);
    life(62, pick(carrier), -2, 0, -1, 2);
    script.push(`loc 62 ${0x7fffff} 10 0 0 10 10 -1 0 -1`, 'model 62');

    // The map edge (footprint past the 105-corner heightmap), every level, the missing heightmap and the underwater
    // layer (mainGroundh != levelHeightmaps).
    const big = fx.animated.filter(l => Math.max(l.width, l.length) > 1);
    for (let i = 0; i < 12; i++) life(57, pick(big.length > 0 ? big : carrier), -1, 0, -1, 2, [104 - rand(3), 50], i % 4);
    for (let i = 0; i < 6; i++) life(57, pick(carrier), pick(looping).id, 0, -1, 3, [103, 104], 3);
    script.push('hm -1 -1');
    life(58, pick(carrier), pick(looping).id, 0, -1, 3);
    script.push('hm 1 2');
    for (let i = 0; i < 8; i++) life(58, pick(carrier), pick(looping).id, rand(2), -1, 5);
    script.push('hm 2 -1');
    life(58, pick(carrier), pick(looping).id, 0, -1, 3);
    script.push('hm 1 1');

    // Multilocs: variant 0 and not, the selector (varp or varbit) switching between variants with different animations.
    // A small value selects a variant through a varp; random bits move a varbit's field too.
    const varpOf = (l: LocInfo): string[] => {
        if (l.selector < 0 || l.selector >= 2500) return [];
        const small = rand(Math.max(2, requireNonNull(l.multi).length + 1)) - (rand(5) === 0 ? 1 : 0);
        return [`varp ${l.selector} ${rand(2) === 0 ? small : r() | 0}`];
    };
    const multis = fx.multis.filter(l => {
        const m = requireNonNull(l.multi);
        return m.some(v => v !== -1);
    });
    const animatedMultis = multis.filter(l => requireNonNull(l.multi).some(v => v !== -1 && fx.animated.some(a => a.id === v)));
    const multiSet = [...animatedMultis.filter((_, i) => i % Math.max(1, Math.floor(animatedMultis.length / 90)) === 0), ...multis.filter((_, i) => i % 97 === 0).slice(0, 20)];
    for (let i = 0; i < multiSet.length; i++) {
        const l = multiSet[i];
        script.push(`variant ${i % 3 === 0 ? 0 : 1}`);
        script.push(...varpOf(l));
        const first = requireNonNull(l.multi).find(v => v !== -1) ?? -1;
        const variant = fx.animated.find(a => a.id === first);
        // The model shapes are the variant's (the multiloc itself usually lists none).
        const carrierLoc: LocInfo = { ...l, shapes: variant?.shapes ?? l.shapes };
        life(40 + (i % 8), carrierLoc, rand(3) === 0 ? -1 : (variant?.animation ?? l.animation), rand(2), rand(4) === 0 ? 999 : -1, 3);
        for (let k = 0; k < 8; k++) {
            script.push(...varpOf(l));
            step(1 + rand(30));
            script.push(rand(3) === 0 ? `build ${40 + (i % 8)} ${rand(2)}` : `model ${40 + (i % 8)}`);
        }
    }
    script.push('variant 0');

    // ---- IfType ----

    // Players (cl): default male/female kits, explicit kits and obj heads, an NPC-transformed player.
    const colours = (): string => Array.from({ length: 5 }, () => (rand(4) === 0 ? rand(300) : rand(25))).join(',');
    const kit = (): number => pick(fx.kits) | -2147483648 | 0;
    const equipment = (heads: boolean): string => {
        const e = new Array<number>(12).fill(0);
        for (const slot of [0, 1, 4, 6, 7, 8, 9, 10, 11]) e[slot] = rand(3) === 0 ? 0 : kit();
        if (heads && fx.objHeads.length > 0) e[0] = pick(fx.objHeads) | 0x40000000 | 0;
        return e.join(',');
    };
    script.push(`player 0 0 ${rand(50)} ${colours()} null -1`);
    script.push(`player 1 1 ${rand(50)} ${colours()} null -1`);
    script.push(`player 2 0 ${rand(50)} ${colours()} ${equipment(false)} -1`);
    script.push(`player 3 1 ${rand(50)} ${colours()} ${equipment(true)} -1`);
    script.push(`player 4 0 ${rand(50)} ${colours()} ${equipment(true)} -1`);
    script.push(`player 5 0 ${rand(50)} ${colours()} null ${pick(fx.npcHeads)}`);

    const gmSeq = (): string => {
        if (rand(3) === 0) return '0 0 -1';
        const s = rand(3) === 0 && chatSeqs.length > 0 ? pick(chatSeqs) : pick(looping);
        const frame = rand(4) === 0 ? rand(s.frames + 2) : rand(s.frames);
        const next = rand(3) === 0 ? -1 : (frame + 1) % s.frames;
        return `${next} ${frame} ${s.id} ${arrayAt(Int32Array.from(s.delays), Math.min(frame, s.frames - 1)) + 1}`;
    };
    const gm = (player: number, active: number): string => {
        const [next, frame, seq, delay] = gmSeq().split(' ').map(Number);
        return `gm ${player} ${next} ${frame} ${active} ${rand(delay === undefined ? 5 : Math.max(1, delay))} ${rand(2)} ${rand(2)} ${seq}`;
    };

    // Real model components as decoded, active and inactive.
    for (const id of fx.modelComponents.filter((_, i) => i % Math.max(1, Math.floor(fx.modelComponents.length / 80)) === 0)) {
        script.push(`if ${id}`, gm(-1, 0), gm(rand(6), 1), gm(-1, 0));
    }
    // Every model type through overrides, on one plain component.
    const plain = fx.plainComponent !== -1 ? fx.plainComponent : fx.modelComponents[0];
    script.push(`if ${plain}`);
    const setModel = (type: number, id: number, active: boolean): void => {
        script.push(`set ${active ? 'zb' : 'md'} ${type}`, `set ${active ? 'O' : 'w'} ${id}`);
    };
    for (let i = 0; i < 160; i++) {
        const type = i % 8;
        const active = rand(2) === 1;
        let id: number;
        switch (type) {
            case 1:
                id = rand(10) === 0 ? 65000 + rand(500) : rand(10) === 0 ? -1 : rand(30000);
                break;
            case 2:
                id = pick(fx.npcHeads);
                break;
            case 4:
                id = rand(3) === 0 ? pick(fx.objCounts) : pick(fx.objs);
                break;
            case 6:
                id = pick(fx.npcs);
                break;
            case 7:
                id = (pick(fx.kits) << 16) | pick(fx.kits) | 0;
                break;
            default:
                id = rand(100);
        }
        setModel(type, id, active);
        if (type === 7) script.push(`set kc ${rand(8) === 0 ? 9999 : pick(fx.kits)}`);
        script.push(gm(rand(7) === 6 ? -1 : rand(6), active ? 1 : 0), gm(rand(6), active ? 1 : 0));
    }
    // An obj whose model file is missing (its definition's model id pointed past the archive): GetModelLit returns null.
    for (const obj of fx.objs.slice(-4)) script.push(`objmodel ${obj} ${65400 + rand(100)}`, 'set md 4', `set w ${obj}`, gm(-1, 0), gm(-1, 0));
    // Past the 50-entry model cache, then back to the first ids.
    script.push('set md 1');
    const firstModels: number[] = [];
    for (let i = 0; i < 70; i++) {
        const id = 1 + i * 37;
        if (i < 6) firstModels.push(id);
        script.push(`set w ${id}`, 'gm -1 0 0 0 0 0 0 -1');
    }
    for (const id of firstModels) script.push(`set w ${id}`, 'gm -1 0 0 0 0 0 0 -1');

    // Real graphic components as decoded: inactive and active, twice (cache hits).
    for (const id of fx.spriteComponents.filter((_, i) => i % Math.max(1, Math.floor(fx.spriteComponents.length / 120)) === 0)) {
        script.push(`if ${id}`, `gfx 0 ${rand(2)} -72`, `gfx 1 ${rand(2)} -62`, `gfx 0 ${rand(2)} -62`);
    }
    for (const id of fx.effectComponents.slice(0, 40)) script.push(`if ${id}`, 'gfx 0 1 -72', 'gfx 1 0 -62');
    // Every flip/outline/shadow/alpha combination on real sprites, and the cache key's sign extension.
    script.push(`if ${pick(fx.spriteComponents)}`);
    for (let i = 0; i < 120; i++) {
        script.push(`set mb ${rand(12) === 0 ? 30000 + rand(100) : pick(fx.spriteIds)}`, `set lc ${rand(4) === 0 ? -1 : pick(fx.spriteIds)}`);
        script.push(`set Kb ${rand(2)}`, `set fb ${rand(2)}`, `set tc ${rand(4)}`, `set Xb ${rand(2)}`);
        script.push(`set Dc ${rand(3) === 0 ? 0 : rand(4) === 0 ? -1 - rand(1 << 24) : rand(1 << 24)}`);
        script.push(`gfx ${rand(2)} ${rand(2)} -72`);
        if (rand(3) === 0) script.push(`gfx ${rand(2)} 0 -62`);
    }
    // Every flip/outline/alpha/shadow combination of two sprites, twice: each combination must be its own cache entry
    // (the second pass hits every one of them).
    const pair = [fx.spriteIds[3], fx.spriteIds[Math.floor(fx.spriteIds.length / 2)]];
    for (let pass = 0; pass < 2; pass++) {
        for (const mb of pass === 0 ? pair : [...pair].reverse()) {
            script.push(`set mb ${mb}`);
            for (let combo = 0; combo < 96; combo++) {
                const c = pass === 0 ? combo : 95 - combo;
                script.push(`set Kb ${c & 1}`, `set fb ${(c >> 1) & 1}`, `set tc ${(c >> 2) & 3}`, `set Xb ${(c >> 4) & 1}`, `set Dc ${[0, 5, -5][(c >> 5) % 3]}`, 'gfx 0 0 -72');
            }
        }
    }
    // Past the 200-entry sprite cache, then back.
    script.push('set Kb 0', 'set fb 0', 'set tc 0', 'set Dc 0', 'set Xb 0');
    for (let i = 0; i < 230; i++) script.push(`set mb ${fx.spriteIds[i % fx.spriteIds.length]}`, 'gfx 0 0 -72', `set Dc ${(i % 3) + 1}`, 'gfx 0 0 -72', 'set Dc 0');
    for (let i = 0; i < 10; i++) script.push(`set mb ${fx.spriteIds[i]}`, 'gfx 0 0 -72');

    // Inventory slot backgrounds inside and outside the table, and a component without one.
    for (const { id, slots, filled } of fx.invComponents) {
        script.push(`if ${id}`);
        for (const slot of [-1, 0, 1, rand(slots), slots - 1, slots, rand(slots), ...filled, ...filled]) script.push(`inv ${slot} ${rand(2)}`);
    }
    script.push(`if ${plain}`, 'inv 0 1', 'set lb empty', 'inv 0 0', `set lb -1,${pick(fx.spriteIds)},30500`, 'inv 0 1', 'inv 1 1', 'inv 2 0', 'inv 1 0');
    // Only one of the cache's inventory components lists a slot sprite, so real sprite tables also go in through the
    // field: valid, missing and -1 entries, fetched repeatedly (cache hits) and past the sprite cache.
    for (let i = 0; i < 40; i++) {
        const table = Array.from({ length: 1 + rand(8) }, () => (rand(6) === 0 ? -1 : rand(8) === 0 ? 30000 + rand(100) : pick(fx.spriteIds)));
        script.push(`set lb ${table.join(',')}`);
        for (let k = 0; k < 6; k++) script.push(`inv ${rand(table.length + 2) - 1} ${rand(2)}`);
    }

    // Masks: real graphic components, missing sprites, and again once the spans exist (and after clearing them).
    for (const id of fx.spriteComponents.filter((_, i) => i % Math.max(1, Math.floor(fx.spriteComponents.length / 50)) === 0)) {
        script.push(`if ${id}`, 'mask', 'mask');
    }
    script.push(`if ${plain}`);
    for (let i = 0; i < 30; i++) {
        script.push(`set mb ${rand(6) === 0 ? 30000 + rand(100) : pick(fx.spriteIds)}`, 'set s null', 'mask', 'mask');
        if (rand(4) === 0) script.push('set s empty', 'mask');
    }
    return script;
}

// ---- the TS side ----

function runTs(script: string[]): string[] {
    const E: (ClientLocAnim | null)[] = new Array<ClientLocAnim | null>(64).fill(null);
    const P: (PlayerModel | null)[] = new Array<PlayerModel | null>(8).fill(null);
    let C: IfType | null = null;
    const maps = terrains();
    const px = new Int32Array(320 * 240);
    let bg = px.slice();
    const fill = (seed: number): void => {
        for (let i = 0; i < px.length; i++) px[i] = Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
        bg = px.slice();
    };
    const drawState = (): string => {
        let changed = 0;
        for (let i = 0; i < px.length; i++) if (px[i] !== bg[i]) changed++;
        return ` fb=${hashInts(px)} px=${changed} trans=${Pix3D.trans}`;
    };
    const slot = (i: number): ClientLocAnim => requireNonNull(arrayAt(E, i));
    const seq = (id: number): SeqType | null => (id < 0 ? null : SeqType.List(id));
    const init = (): string =>
        `kb=${Client.loopCycle} jl.c=${GameVariant.id} rf.x=${Preferences.sceneryShadows} qf.b=${SeqType.forceTween ? 1 : 0} ve.q=${world.levelHeightmaps === null ? 'null' : 'obj'}` +
        ` lf.g=${world.mainGroundh === null ? 'null' : 'obj'} al.R=${ClientLocAnim.defaultShadow === null ? 'null' : 'obj'} vj.d=${ClientVarCache.m_var.length}:${hashInts(ClientVarCache.m_var)}` +
        ` ms=${remaining(IfType.m_modelCache)} ss=${remaining(IfType.m_spriteCache)} rk=${IfType.resourceMissing ? 1 : 0}` +
        ` pal=${PlayerModel.recolourDestinations === null ? 'null' : 'obj'},${PlayerModel.recolourSources === null ? 'null' : 'obj'},${PlayerModel.recolourSources2 === null ? 'null' : 'obj'},${PlayerModel.recolourDestinations2 === null ? 'null' : 'obj'}`;

    const run = (t: string[], n: number[]): string => {
        switch (t[0]) {
            case 'init':
                return ` ${init()}`;
            case 'cls':
                fill(n[1]);
                return '';
            case 'seed':
                mathRandom.setSeed(BigInt(t[1]));
                return '';
            case 'cycle':
                Client.loopCycle = n[1];
                return '';
            case 'variant':
                GameVariant.id = n[1];
                return '';
            case 'shadows':
                Preferences.sceneryShadows = n[1];
                return '';
            case 'tween':
                SeqType.forceTween = n[1] !== 0;
                return '';
            case 'varp':
                ClientVarCache.m_var[n[1]] = n[2];
                return '';
            case 'hm':
                world.levelHeightmaps = n[1] < 0 ? null : maps[n[1]];
                world.mainGroundh = n[2] < 0 ? null : maps[n[2]];
                return '';
            case 'loc': {
                const prev = n[10] === 999 ? new Foreign() : n[10] < 0 ? null : arrayAt(E, n[10]);
                E[n[1]] = null;
                E[n[1]] = new ClientLocAnim(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9] !== 0, prev);
                return ` | ${entity(E[n[1]])}`;
            }
            case 'tick':
                slot(n[1]).update(n[2], n[3], n[4], n[5], n[6]);
                return ` | ${entity(E[n[1]])}`;
            case 'model': {
                const m = slot(n[1]).GetTempModel();
                return ` ${model(m)} | ${entity(E[n[1]])}`;
            }
            case 'build': {
                const m = (slot(n[1]) as unknown as { GetTempModel2(flag: boolean): ModelSource | null }).GetTempModel2(n[2] !== 0);
                return ` ${model(m)} | ${entity(E[n[1]])}`;
            }
            case 'miny':
                return ` ${slot(n[1]).getMinY()} | ${entity(E[n[1]])}`;
            case 'draw': {
                const e = slot(n[1]);
                e.draw(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], BigInt(t[10]), n[11], n[12] !== 0 ? new ParticleSystem() : null);
                return `${drawState()} | ${entity(e)}`;
            }
            case 'dump':
                return ` | ${entity(E[n[1]])}`;
            case 'objmodel':
                ObjType.List(n[1]).model = n[2];
                return '';
            case 'player': {
                const p = new PlayerModel();
                p.setAppearance(n[2] !== 0, requireNonNull(ints(t[4])), n[3], ints(t[5]), n[6]);
                P[n[1]] = p;
                return '';
            }
            case 'if': {
                C = null;
                const open = IfType.OpenInterface(n[1] >>> 16, false);
                const group = arrayAt(IfType.m_list, n[1] >>> 16);
                C = group === null ? null : arrayAt(group, n[1] & 65535);
                return ` ${open ? 1 : 0} ${component(C)}`;
            }
            case 'set': {
                const f = t[1];
                const name = AJ_FIELDS[f];
                if (name === undefined) throw new Error(`unknown op field ${f}`);
                const c = requireNonNull(C) as unknown as Statics;
                if (AJ_ARRAYS.has(f)) c[name] = ints(t[2]);
                else if (AJ_BOOLEANS.has(f)) c[name] = n[2] !== 0;
                else c[name] = n[2];
                return ` ${component(C)}`;
            }
            case 'mask': {
                const r = requireNonNull(C).GetMask();
                const c = requireNonNull(C);
                return ` ${r ? 1 : 0} s=${value(c.maskStarts)} ud=${value(c.maskWidths)}${ifState()}`;
            }
            case 'gm': {
                IfType.resourceMissing = n[7] !== 0;
                const player = n[1] < 0 ? null : arrayAt(P, n[1]);
                const s = seq(n[8]);
                const m = requireNonNull(C).GetTempModel(player, n[2], n[3], n[4] !== 0, n[5], n[6] !== 0, s);
                return ` ${model(m)}${ifState()}`;
            }
            case 'inv': {
                IfType.resourceMissing = n[2] !== 0;
                const s = requireNonNull(C).GetInvBackground(n[1]);
                return ` ${sprite(s)}${ifState()}`;
            }
            case 'gfx': {
                IfType.resourceMissing = n[2] !== 0;
                const s = requireNonNull(C).GetGraphic(n[1] !== 0);
                return ` ${sprite(s)}${ifState()}`;
            }
            default:
                throw new Error(`unknown op ${t[0]}`);
        }
    };

    const got: string[] = [];
    let setup = false;
    for (const line of script) {
        if (!setup && line !== 'init') {
            // The oracle's setup: the recolour tables, the framebuffer, brightness 0.8 without the jitter and the
            // fake textures (the archives and config loaders are already initialised by the fixture).
            PlayerModel.recolourDestinations2 = PlayerModel.recolourDestinations2Rs;
            PlayerModel.recolourSources = PlayerModel.recolourSourcesRs;
            PlayerModel.recolourSources2 = PlayerModel.recolourSources2Rs;
            PlayerModel.recolourDestinations = PlayerModel.recolourDestinationsRs;
            Pix2D.setPixels(px, 320, 240);
            setBounds(Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY);
            pix3d['brightness'] = Math.fround(0.8);
            (pix3d['initColourTable'] as (a: number, b: number) => void).call(Pix3D, 0, 512);
            Pix3D.textureProvider = textures;
            fill(0);
            setup = true;
        }
        const t = line.split(' ');
        const n = t.map((s, i) => (i === 0 ? 0 : Number.isInteger(Number(s)) ? Number(s) | 0 : 0));
        sounds.length = 0;
        let result = 'ok';
        let extra = '';
        try {
            extra = run(t, n);
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('unknown op')) throw e;
            result = code(e);
            if (process.env.LOCANIM_TRACE === String(got.length)) console.log(line, e instanceof Error ? e.stack : e);
            if (['loc', 'tick', 'model', 'build', 'draw', 'miny'].includes(t[0])) extra = ` | ${entity(arrayAt(E, n[1]))}`;
            else if (['mask', 'gm', 'inv', 'gfx'].includes(t[0])) extra = ` ${component(C)}${ifState()}`;
        }
        got.push(`${result}${extra} snd=${sounds.join(';')}`);
    }
    return got;
}

// The recorder that replaces Client.TriggerSeqSound (ProviderLocAnimOracle.sound).
const sounds: string[] = [];
function recordSound(seq: SeqType | null, z: number, x: number, local: boolean, frame: number): void {
    sounds.push(`${seq === null ? 'null' : seq.id},${z},${x},${local ? 1 : 0},${frame}`);
}

test('ClientLocAnim and the IfType model/sprite getters match ml and aj in client.jar over the real cache', () => {
    const pixClinit = pix3dClinit();
    const resets: StaticReset[] = [
        { target: ModelLitImpl, clinit: modelLitImplClinit() },
        { target: ModelLit, clinit: modelLitClinit() },
        { target: Pix3D, clinit: pixClinit },
        PIX2D(),
        SPRITE_LOADER(),
        { target: ModelUnlit, clinit: modelUnlitClinit(pixClinit) },
        { target: AnimFrame, clinit: animFrameClinit() },
        { target: LocType, clinit: { ...freshCaches(LocType), modelResult: new LocEntity(), temp: new Array<ModelUnlit | null>(4).fill(null), m_pConfigClient: null, m_pModels: null, members: false } },
        { target: SeqType, clinit: { ...freshCaches(SeqType), forceTween: false, m_pConfigClient: null } },
        { target: AnimFrameSet, clinit: { ...freshCaches(AnimFrameSet), basesArchive: null, framesArchive: null } },
        { target: NpcType, clinit: { ...freshCaches(NpcType), m_pConfigClient: null, m_pModels: null } },
        { target: ObjType, clinit: { ...freshCaches(ObjType), m_pConfigClient: null, m_pModels: null } },
        { target: IdkType, clinit: { ...freshCaches(IdkType), m_pConfigClient: null, m_pModels: null, m_numDefinitions: 0 } },
        { target: BASTypeList, clinit: { ...freshCaches(BASTypeList), archive: null } },
        { target: VarBitType, clinit: { ...freshCaches(VarBitType), m_pConfigClient: null } },
        {
            target: PlayerModel,
            clinit: { ...freshCaches(PlayerModel), recolourDestinations: null, recolourSources: null, recolourSources2: null, recolourDestinations2: null }
        },
        {
            target: IfType,
            clinit: { ...freshCaches(IfType), resourceMissing: false, m_list: null, m_open: null, m_pSprites: null, m_pModels: null, m_pFontMetrics: null, m_pInterfaces: null }
        },
        { target: Client, clinit: { loopCycle: 0, TriggerSeqSound: recordSound } },
        { target: GameVariant, clinit: { id: 0 } },
        { target: Preferences, clinit: { sceneryShadows: 2 } },
        { target: world, clinit: { levelHeightmaps: null, mainGroundh: null } },
        { target: ClientLocAnim, clinit: { defaultShadow: null } },
        { target: ClientVarCache, clinit: { m_var: new Int32Array(2500) } }
    ];
    const savedSeed = (mathRandom as unknown as { seed: bigint }).seed;
    let script: string[] = [];
    let want: string[] = [];
    let got: string[] = [];
    let fx: Fixture | null = null;
    try {
        withClinitStatics(resets, () => {
            localAssets(cachePath, [0, 1, 2, 3, 7, 8, 13, 16, 18, 19, 20, 21, 22]);
            const scanned = scan();
            fx = scanned;
            // The scan filled the definition caches and opened every interface group: back to the fresh state.
            for (const target of [LocType, SeqType, AnimFrameSet, NpcType, ObjType, IdkType, BASTypeList, VarBitType, PlayerModel, IfType]) Object.assign(target, freshCaches(target));
            IfType.Init(IfType.m_pFontMetrics, IfType.m_pSprites, IfType.m_pModels, IfType.m_pInterfaces);
            tags.clear();
            script = generate(scanned);
            want = runOracle(script);
            got = runTs(script);
        });
    } finally {
        mathRandom.setSeed(savedSeed ^ 0x5deece66dn);
        tags.clear();
    }

    if (process.env.LOCANIM_DUMP) {
        writeFileSync(`${process.env.LOCANIM_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.LOCANIM_DUMP}.java`, want.join('\n') + '\n');
        writeFileSync(`${process.env.LOCANIM_DUMP}.ts`, got.join('\n') + '\n');
    }
    if (process.env.LOCANIM_STATS) {
        const byOp = new Map<string, Map<string, number>>();
        want.forEach((line, i) => {
            const op = script[i].split(' ')[0];
            const result = line.split(' ')[0];
            const counts = byOp.get(op) ?? new Map<string, number>();
            counts.set(result, (counts.get(result) ?? 0) + 1);
            byOp.set(op, counts);
        });
        console.log([...byOp].map(([op, counts]) => `${op}: ${[...counts].map(([r, c]) => `${r}=${c}`).join(' ')}`).join('\n'));
        console.log(fx);
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

    // The script reaches what it claims to (so a cache or generator change cannot quietly empty it).
    const ok = (op: string): string[] => want.filter((line, i) => script[i].split(' ')[0] === op && line.startsWith('ok'));
    // Frame sounds from many sequences, sequences that ran out and last frames without a next frame.
    expect(want.filter(line => !line.endsWith('snd=')).length).toBeGreaterThan(300);
    expect(
        new Set(
            want.flatMap(line =>
                (/ snd=(\S+)$/.exec(line)?.[1] ?? '')
                    .split(';')
                    .filter(s => s !== '')
                    .map(s => s.split(',')[0])
            )
        ).size
    ).toBeGreaterThan(20);
    expect(ok('model').filter(line => / F=null /.test(line)).length).toBeGreaterThan(20);
    expect(ok('tick').filter(line => / B=-1 /.test(line)).length).toBeGreaterThan(20);
    // Built models (animated and static), the model build's early null (var1 set, no shadow rebuild) and real draws.
    expect(ok('model').filter(line => line.startsWith('ok fc#')).length).toBeGreaterThan(800);
    expect(ok('build').filter(line => line.startsWith('ok nullmodel')).length).toBeGreaterThan(20);
    expect(ok('build').filter(line => line.startsWith('ok fc#')).length).toBeGreaterThan(100);
    expect(
        new Set(
            ok('draw')
                .filter(line => !/ px=0 /.test(line))
                .map(line => / fb=(-?\d+)/.exec(line)?.[1])
        ).size
    ).toBeGreaterThan(150);
    // Multilocs whose variant changed the sequence (GetTempModel2's re-pick), under a non-zero GameVariant.
    const lastSeq = new Map<string, string>();
    let repicks = 0;
    want.forEach((line, i) => {
        const m = / F=(\S+) .* P=1 /.exec(line);
        const slot = script[i].split(' ')[1];
        if (m === null) return;
        if (!script[i].startsWith('loc ') && lastSeq.has(slot) && lastSeq.get(slot) !== m[1]) repicks++;
        lastSeq.set(slot, m[1]);
    });
    expect(repicks).toBeGreaterThan(10);
    // Every component model type returns models, and every exception kind the unit raises is reached.
    const kinds = new Map<string, number>();
    let md = -1;
    let zb = -1;
    want.forEach((line, i) => {
        const fields = / md=(-?\d+) w=-?\d+ zb=(-?\d+)/.exec(line);
        if ((script[i].startsWith('if ') || script[i].startsWith('set ')) && fields !== null) {
            md = Number(fields[1]);
            zb = Number(fields[2]);
        }
        if (script[i].startsWith('gm ') && line.startsWith('ok fc#')) {
            const type = script[i].split(' ')[4] === '1' ? zb : md;
            kinds.set(String(type), (kinds.get(String(type)) ?? 0) + 1);
        }
    });
    for (const type of ['1', '2', '3', '4', '6', '7']) expect(kinds.get(type) ?? 0, `model type ${type}`).toBeGreaterThan(10);
    expect(ok('gfx').filter(line => line.startsWith('ok rh#')).length).toBeGreaterThan(500);
    expect(ok('gfx').some(line => line.startsWith('ok vh#'))).toBe(true);
    expect(ok('inv').filter(line => line.startsWith('ok rh#')).length).toBeGreaterThan(50);
    expect(ok('mask').filter(line => line.startsWith('ok 1 s=') && !line.startsWith('ok 1 s=null')).length).toBeGreaterThan(40);
    expect(ok('mask').some(line => line.startsWith('ok 0 '))).toBe(true);
    for (const c of ['aioobe', 'npe'])
        expect(
            want.some(line => line.startsWith(c)),
            c
        ).toBe(true);
}, 600000);
