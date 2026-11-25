import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import Client from '../../src/client/Client.js';
import ClientBuild from '../../src/client/ClientBuild.js';
import LocType from '../../src/config/LocType.js';
import SeqType from '../../src/config/SeqType.js';
import VarBitType from '../../src/config/VarBitType.js';
import ClientLocAnim from '../../src/dash3d/ClientLocAnim.js';
import CollisionMap from '../../src/dash3d/CollisionMap.js';
import Decor from '../../src/dash3d/Decor.js';
import FaceNormal from '../../src/dash3d/FaceNormal.js';
import Ground from '../../src/dash3d/Ground.js';
import GroundDecor from '../../src/dash3d/GroundDecor.js';
import GroundObject from '../../src/dash3d/GroundObject.js';
import LocEntity from '../../src/dash3d/LocEntity.js';
import ModelLitImpl from '../../src/dash3d/ModelLitImpl.js';
import type ModelSource from '../../src/dash3d/ModelSource.js';
import ModelUnlit from '../../src/dash3d/ModelUnlit.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import PointNormal from '../../src/dash3d/PointNormal.js';
import QuickGround from '../../src/dash3d/QuickGround.js';
import Sprite from '../../src/dash3d/Sprite.js';
import type Square from '../../src/dash3d/Square.js';
import type TextureProvider from '../../src/dash3d/TextureProvider.js';
import Wall from '../../src/dash3d/Wall.js';
import world from '../../src/dash3d/world.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import SharedPtrList from '../../src/datastruct/SharedPtrList.js';
import Crc32 from '../../src/io/Crc32.js';
import AreaSoundManager from '../../src/sound/AreaSoundManager.js';
import type bgsound from '../../src/sound/bgsound.js';
import Preferences from '../../src/ui/Preferences.js';
import ClientVarCache from '../../src/util/ClientVarCache.js';
import { arrayAt, arrayPut, requireNonNull } from '../../src/util/JavaArray.js';
import { mathRandom } from '../../src/util/JavaRandom.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { type StaticReset, withClinitStatics } from './staticState.js';

// The native loc placement nc.a(ZIIIIIIIZLke;I)V (ClientBuild.AddLoc) against client.jar.
// test/review/scene-build-locs/SceneBuildLocsOracle.java runs the same script on the real gamepack classes over a
// real al/Js5 per archive that serves the cache's sector files (maps, models, locs, seqs, varbits): the loc definitions,
// model builds, lighting, hill skew, ClientLocAnim and area-sound emitters come from the jar on one side and the TS port
// on the other. Both sides start from FinishBuildOracle's Lumbridge: a 4 x 104 x 104 world whose real heightmaps and
// m_mapl flags come from the four land squares through the original LoadGround (nk.a), then reset to a fresh world on
// those heightmaps before each block of placements.
// After every operation both sides print the change in the canonical state: je.Z (minusedlevel); every non-null square
// of both layers with every field, entity and sprite (typecodes included, the linked square nested), entities and models
// as identity refs; the full dump of each model a changed square (or the LocType.modelResult holder) references when it
// is new or its fields changed (ModelUnlit/ModelLitImpl: every instance field, arrays as identity:length:hash; a
// ClientLocAnim: every field); every changed cell of m_shadow, m_mapo, m_mapl and the four collision maps; each new
// AreaSoundManager emitter; the loc, mc1, mc2, mc3, seq and varbit caches with their key order and value identities,
// the modelResult holder and LocType.temp. Identity ids are numbered in first-dump order and restart at each world
// reset, so sharing (one Sprite on every tile it spans, a cached model reused, CopyForShareLight sharing arrays with the
// cached unlit model) is compared as well as contents. The jar's od.a wrapper (g) is unwrapped to its cause.
//
// Inputs: about 40 real loc types picked by feature from the whole loc archive (straight, corner and diagonal walls
// with and without shadow/occlusion, wide walls (wallWidth != 16), wall decor, diagonal walls, scenery of every
// footprint (rotated non-square ones; no loc lists shape 11, which turns the shape-10 model), shadow casters, roofs
// 12..21, ground decor (blocking, inactive, forced), animated locs with and without a random start, multilocs by varp
// and varbit (one with a sounding variant), ambient and random sounds, hill skew of every kind (4/5 read the second
// heightmap), raiseObject, flag96, flag88, shared light, shape-less model lists, model-less locs, non-blocking and
// flag90 locs; no loc in this cache has particles). Each goes through every shape 0..22 at all four angles on its own
// tiles of a fresh world, mixing the building flag (var8), the underwater flag (var0), level 0..3, a heightmap level
// above the loc's (o.a's call), and a collision map or null. Directed blocks: the low-detail build gate
// (allLevelsVisible off, every buildLevel against every level with no flags, the plane-0 bridge flag 2, the hidden flag
// 16, the VisLevel flags 8 and plane-1 2, all bits) with building on and off; ground decor with showGroundDecorations
// off; wall decor on tiles with no wall, a 16-wide wall and a wide wall (the WallType width lookup), and walls and
// diagonal walls placed over existing decor (MoveDecor); six shadow-casting scenery on one tile (the sixth AddScenery
// fails, so no shadow); footprints at the map edge (the x + width > 104 and z + length > 104 centre arms, AddScenery
// refusing, shadow loops past 104) and level 3 (no second heightmap); and the underwater layer
// (world.setUnderwater(true), Init(true)); footprints ending exactly on the edge; and a heightmap level other than the
// loc's at every shape (the ClientLocAnim level and the var18/var22 heightmaps).
//
// Sensitivity: 79 of 81 single-statement mutations of AddLoc make this test fail. They cover each gate condition, the
// footprint swap and both edge arms, the centre and corner terms, the second heightmap choice, every typecode bit, the
// area-sound coordinates, the ground-decor gate and collision, both shape-11 turns, the shadow radius, cap, default,
// loop bounds and store, every m_shadow/m_mapo cell of the walls and roofs, each collision call, each MoveDecor, the
// wall masks, the decor widths, halvings, offsets and turns, and one argument of each of the 15 ClientLocAnim sites.
// The two survivors are equivalent: flag88 && !underwater only reaches LocType.GetModel's last argument, and flag90 only
// reaches world.SetGroundDecor's last argument; the SD client reads neither (jb.a, vf.a).
//
// SBL_DUMP=<prefix> writes the script and both outputs; SBL_STATS=1 prints result counts.

type Statics = Record<string, unknown>;

// ---- cache access (ProviderConfigOracle.Provider) ----

function container(raw: Uint8Array): Uint8Array {
    const length = ((raw[1] << 24) | (raw[2] << 16) | (raw[3] << 8) | raw[4]) >>> 0;
    return raw.subarray(0, (raw[0] === 0 ? 5 : 9) + length);
}

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

// ProviderConfigOracle.Textures.
const textures: TextureProvider = {
    getTextureSmall: () => true,
    isAvailable: id => id % 7 !== 3,
    getPixels: () => null,
    isLoaded: () => true,
    getTextureData: () => null,
    getTextureColour: id => (Math.imul(id, 0x1f3d) + 0x123) & 0xffff,
    getTextureSolid: id => (id & 1) === 0
};

// ---- identity and values (the oracle's) ----

let ids = new Map<object, number>();

function id(v: object): number {
    let i = ids.get(v);
    if (i === undefined) {
        i = ids.size;
        ids.set(v, i);
    }
    return i;
}

const ref = (v: object | null | undefined): string => (v === null || v === undefined ? '-' : `#${id(v)}`);

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
    if (desc === 'L') return `TYPE!object ${Object.prototype.toString.call(v)}`;
    if (desc === '[I' || desc === '[S' || desc === '[B') {
        const ok = desc === '[I' ? v instanceof Int32Array : desc === '[S' ? v instanceof Int16Array : v instanceof Uint8Array || v instanceof Int8Array;
        if (!ok) return `TYPE!${Object.prototype.toString.call(v)}`;
        const a = v as Int32Array;
        return `#${id(a)}:${a.length}:${hashInts(a, desc === '[B')}`;
    }
    if (!Array.isArray(v)) return `TYPE!${Object.prototype.toString.call(v)}`;
    const t = `#${id(v)}:`;
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

// [fc field, ModelLitImpl property, JVM descriptor] in fc's declaration order (ProviderConfigOracle.FC_FIELDS), then nd.j.
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

// [ml field, ClientLocAnim property, descriptor] in SceneBuildLocsOracle.ML_FIELDS order ('L' = an object other than a seq).
const ML_FIELDS: [string, string, string][] = [
    ['A', 'x', 'I'],
    ['B', 'nextFrame', 'I'],
    ['D', 'minY', 'I'],
    ['F', 'seq', 'seq'],
    ['G', 'cycle', 'I'],
    ['I', 'frame', 'I'],
    ['K', 'particles', 'L'],
    ['L', 'index', 'I'],
    ['M', 'shadow', 'L'],
    ['O', 'lastFrame', 'I'],
    ['P', 'hasMulti', 'Z'],
    ['R', 'frameCycle', 'I'],
    ['j', 'level', 'I'],
    ['o', 'shape', 'I'],
    ['q', 'lastLocId', 'I'],
    ['s', 'angle', 'I'],
    ['y', 'z', 'I']
];

function cls(m: object): string {
    if (m instanceof ModelUnlit) return 'cb';
    if (m instanceof ModelLitImpl) return 'fc';
    if (m instanceof ClientLocAnim) return 'ml';
    return `other:${m.constructor.name}`;
}

const referenced: object[] = [];

function mref(m: ModelSource | null): string {
    if (m === null) return '-';
    referenced.push(m);
    return `${cls(m)}#${id(m)}`;
}

function model(m: object): string {
    const f = m as unknown as Statics;
    if (m instanceof ModelUnlit) return CB_FIELDS.map(([obf, name, desc]) => ` ${obf}=${value(f[name], desc)}`).join('');
    if (m instanceof ModelLitImpl) return FC_FIELDS.map(([obf, name, desc]) => ` ${obf}=${value(f[name], desc)}`).join('') + ` j=${value(m.useAABBMouseCheck, 'Z')}`;
    if (m instanceof ClientLocAnim) {
        return ML_FIELDS.map(([obf, name, desc]) => {
            const v = f[name];
            if (desc === 'seq') return ` ${obf}=${v === null ? 'null' : v instanceof SeqType ? `seq${v.id}` : `TYPE!${String(v)}`}`;
            return ` ${obf}=${value(v, desc)}`;
        }).join('');
    }
    return '';
}

// ---- squares (scene-world.test.ts's desc/square with model refs) ----

function desc(o: object | null): string {
    if (o === null) return '-';
    if (o instanceof Wall) return `W#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${mref(o.model1)},${mref(o.model2)},${o.angle1},${o.angle2}`;
    if (o instanceof Decor) return `N#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${mref(o.model)},${mref(o.model2)},${o.wshape},${o.angle},${o.offsetX},${o.offsetZ}`;
    if (o instanceof GroundDecor) return `G#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${mref(o.model)}`;
    if (o instanceof GroundObject) return `O#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${o.height},${mref(o.topObj)},${mref(o.middleObj)},${mref(o.bottomObj)}`;
    if (o instanceof Sprite) {
        return `S#${id(o)}:${o.typecode},${o.level},${o.x},${o.y},${o.z},${o.yaw},${o.minTileX},${o.minTileZ},${o.maxTileX},${o.maxTileZ},${o.cycle},${o.distance},${mref(o.model)}`;
    }
    if (o instanceof Ground) return `ground:kb#${id(o)}`;
    if (o instanceof QuickGround) return `ground:ma#${id(o)}`;
    throw new Error(`desc ${o.constructor.name}`);
}

function square(r: Square | null, nested: boolean): string {
    if (r === null) return 'n';
    let s = `#${id(r)}:${r.level},${r.originalLevel},${r.x},${r.z}`;
    s += `,t${r.spriteCount},P${r.spriteSpans},A`;
    for (let i = 0; i < r.spriteSpan.length; i++) s += `${i === 0 ? '' : '/'}${r.spriteSpan[i]}`;
    s += `,${r.drawFront ? 1 : 0}${r.drawBack ? 1 : 0}${r.drawSprites ? 1 : 0}`;
    s += `,${r.cornerSides},${r.sidesBeforeCorner},${r.sidesAfterCorner},${r.backWallTypes}`;
    s += `,${desc(r.ground)},${desc(r.quickGround)}`;
    s += `,${desc(r.wall)},${desc(r.decor)},${desc(r.groundDecor)},${desc(r.groundObject)}`;
    s += `,H${r.sprites.length}[`;
    for (let i = 0; i < r.sprites.length; i++) s += `${desc(r.sprites[i])};`;
    s += '],L';
    const l = r.linkedSquare;
    if (l === null) s += '-';
    else if (nested) s += `(${square(l, false)})`;
    else s += `#${id(l)}`;
    s += `,k${r.key}${r.next === null ? '' : 'g'}${r.prev === null ? '' : 'p'}`;
    return s;
}

// ---- caches (ProviderConfigOracle.cache) ----

interface QueueNode {
    key: bigint;
    secondaryNext: QueueNode;
    isSoft(): boolean;
    get(): object | null;
}

function longHash(v: bigint): number {
    const u = BigInt.asUintN(64, v);
    return Number(BigInt.asIntN(32, u ^ (u >> 32n)));
}

function cache(name: string, c: unknown): string {
    const f = c as Statics;
    const sentinel = (f['queue'] as Statics)['sentinel'] as QueueNode;
    let count = 0;
    let kh = 1;
    let vh = 1;
    for (let n = sentinel.secondaryNext; n !== sentinel; n = n.secondaryNext) {
        if (n.isSoft()) throw new Error('soft node');
        count++;
        kh = (Math.imul(31, kh) + longHash(n.key)) | 0;
        const v = n.get();
        vh = (Math.imul(31, vh) + (v === null ? -1 : id(v))) | 0;
    }
    return ` ${name}=${count}/${f['remaining']}/${f['m_cacheSize']}:${kh}:${vh}`;
}

// ---- the diffed state (SceneBuildLocsOracle.diff) ----

type Grid = ArrayLike<number>[][];

let clip: CollisionMap[] = [];
let savedHeights: Int32Array[][] = [];
let savedMapl: Uint8Array[][] = [];
let prevSquares = new Map<string, string>();
const printedModels = new Map<number, string>();
let prevShadow: Int32Array[][] | null = null;
let prevMapo: Int32Array[][] | null = null;
let prevMapl: Int32Array[][] | null = null;
let prevClip: Int32Array[][] | null = null;
let prevMinused = -0x80000000;
let prevSounds = 0;
let prevCaches = '';

function layer(cur: Map<string, string>, tag: string, squares: (Square | null)[][][] | null): void {
    if (squares === null) return;
    for (let level = 0; level < squares.length; level++) {
        for (let x = 0; x < squares[level].length; x++) {
            for (let z = 0; z < squares[level][x].length; z++) {
                const r = squares[level][x][z];
                if (r !== null) cur.set(`${tag}${level},${x},${z}`, square(r, true));
            }
        }
    }
}

// A grid as signed values (bytes sign-extended like the jar's byte[][][]).
function copy(grid: Grid | null, signedBytes: boolean): Int32Array[][] | null {
    if (grid === null) return null;
    return grid.map(plane => plane.map(row => Int32Array.from(row, v => (signedBytes ? (v << 24) >> 24 : v))));
}

// The cells of grid that differ from the snapshot prev (0 where there is none), then prev updated to grid in place (a new
// snapshot when the shapes differ), so a diff allocates nothing in the common case.
function gridDiff(tag: string, prev: Int32Array[][] | null, grid: Grid | null, signedBytes: boolean): [string, Int32Array[][] | null] {
    if (grid === null) return ['', null];
    const same = prev !== null && prev.length === grid.length && prev.every((plane, l) => plane.length === grid[l].length && plane.every((row, x) => row.length === grid[l][x].length));
    const next = same ? prev : grid.map(plane => plane.map(row => new Int32Array(row.length)));
    let s = '';
    for (let l = 0; l < grid.length; l++) {
        for (let x = 0; x < grid[l].length; x++) {
            const row = grid[l][x];
            const was = prev === null || l >= prev.length ? null : prev[l][x];
            const out = next[l][x];
            for (let z = 0; z < row.length; z++) {
                const v = signedBytes ? (row[z] << 24) >> 24 : row[z];
                const old = was === null ? 0 : was[z];
                if (v !== old) s += ` ${tag}${l},${x},${z}=${v}`;
                out[z] = v;
            }
        }
    }
    return [s, next];
}

function clipFlags(): Grid {
    return [0, 1, 2, 3].map(i => (clip[i] === undefined ? [] : clip[i].flags));
}

function hashGrid(grid: Int32Array[][]): number {
    let h = 1;
    for (const plane of grid) for (const row of plane) h = (Math.imul(31, h) + hashInts(row, false)) | 0;
    return h;
}

// hash3(byte[][][]): every byte folded in, one level deeper than the int version.
function hashBytes(grid: Grid): number {
    let h = 1;
    for (const plane of grid) for (const row of plane) for (let i = 0; i < row.length; i++) h = (Math.imul(31, h) + ((row[i] << 24) >> 24)) | 0;
    return h;
}

function sound(s: bgsound): string {
    return (
        `ik#${id(s)}:${s.randomIds === null ? 'null' : `${s.randomIds.length}:${hashInts(s.randomIds, false)}`},${s.delay},${s.minDelay},${s.maxDelay},${s.loc === null ? '-' : `loc${s.loc.id}`}` +
        `,${s.multi ? 1 : 0},${ref(s.loop)},${s.radius},${s.maxX},${s.minX},${s.maxZ},${ref(s.npc)},${ref(s.random)},${s.movement},${s.plane},${s.minZ},${s.sound},${ref(s.player)}`
    );
}

function diff(all: boolean): string {
    let sb = '';
    if (ClientBuild.minusedlevel !== prevMinused) sb += ` Z=${ClientBuild.minusedlevel}`;
    prevMinused = ClientBuild.minusedlevel;

    referenced.length = 0;
    const cur = new Map<string, string>();
    layer(cur, 'M', world.mainLevelTiles);
    layer(cur, 'U', world.underwaterSquares);
    const allModels = all ? referenced.slice() : [];
    referenced.length = 0;
    for (const [key, line] of cur) {
        if (prevSquares.get(key) !== line) {
            const [l, x, z] = key.slice(1).split(',').map(Number);
            const squares = requireNonNull(key[0] === 'M' ? world.mainLevelTiles : world.underwaterSquares);
            square(squares[l][x][z], true);
            sb += ` ${key}=${line}`;
        }
    }
    for (const key of prevSquares.keys()) if (!cur.has(key)) sb += ` ${key}=gone`;
    prevSquares = cur;

    const models = referenced.slice();
    if (all) models.push(...allModels);
    const held = LocType.modelResult.model;
    if (held !== null) models.push(held);
    for (const m of models) {
        const i = id(m);
        const dump = model(m);
        if (dump !== printedModels.get(i)) {
            sb += ` X${cls(m)}#${i}=${dump}`;
            printedModels.set(i, dump);
        }
    }

    let cells: string;
    [cells, prevShadow] = gridDiff('s', prevShadow, ClientBuild.m_shadow, true);
    sb += cells;
    [cells, prevMapo] = gridDiff('o', prevMapo, ClientBuild.m_mapo, false);
    sb += cells;
    [cells, prevMapl] = gridDiff('l', prevMapl, ClientBuild.m_mapl, true);
    sb += cells;
    [cells, prevClip] = gridDiff('c', prevClip, clipFlags(), false);
    sb += cells;

    let count = 0;
    const sentinel = AreaSoundManager.locs.sentinel;
    for (let n = sentinel.next; n !== sentinel; n = requireNonNull(n).next) {
        if (count >= prevSounds) sb += ` B${count}=${sound(requireNonNull(n) as bgsound)}`;
        count++;
    }
    if (count !== prevSounds) sb += ` Bn=${count}`;
    prevSounds = count;

    const caches =
        cache('locs', LocType.m_recentUse) +
        cache('mc1', LocType.m_mc1) +
        cache('mc2', LocType.m_mc2) +
        cache('mc3', LocType.m_mc3) +
        cache('seqs', SeqType.m_recentUse) +
        cache('varbits', VarBitType.m_recentUse) +
        ` gj=${ref(LocType.modelResult)}:${ref(LocType.modelResult.model)} llj=${LocType.temp.map(v => ref(v)).join(',')}`;
    if (caches !== prevCaches) sb += ` |${caches}`;
    prevCaches = caches;
    return sb;
}

// ---- operations (SceneBuildLocsOracle.setup/reset/run) ----

const LAND = [254, 256, 380, 382];

function newBytes3(levels: number, size: number): Uint8Array[][] {
    return Array.from({ length: levels }, () => Array.from({ length: size }, () => new Uint8Array(size)));
}

function setup(): string {
    const models = js5(7);
    LocType.m_pConfigClient = js5(16);
    LocType.m_pModels = models;
    LocType.members = true;
    SeqType.m_pConfigClient = js5(20);
    VarBitType.m_pConfigClient = js5(22);
    Pix3D.textureProvider = textures;
    const maps = js5(5);
    world.init(4, 104, 104, 25, false);
    ClientBuild.Init(false);
    ClientBuild.m_mapl = newBytes3(4, 104);
    clip = [0, 1, 2, 3].map(() => new CollisionMap(104, 104));
    for (let i = 0; i < 4; i++) {
        const x = (49 + (i >> 1)) * 64 - 3160;
        const z = (49 + (i & 1)) * 64 - 3160;
        ClientBuild.LoadGround(z, false, 3160, x, maps.GetFile(0, LAND[i]), 3160, clip);
    }
    savedHeights = requireNonNull(world.mainGroundh).map(plane => plane.map(row => row.slice()));
    savedMapl = requireNonNull(ClientBuild.m_mapl).map(plane => plane.map(row => row.slice()));
    return ` heights=${hashGrid(requireNonNull(world.mainGroundh))} mapl=${hashBytes(requireNonNull(ClientBuild.m_mapl))}`;
}

function reset(under: boolean): string {
    world.init(4, 104, 104, 25, under);
    const main = requireNonNull(world.mainGroundh);
    for (let l = 0; l < 4; l++) for (let x = 0; x < 105; x++) main[l][x].set(savedHeights[l][x]);
    if (under) {
        const heights = requireNonNull(world.underwaterHeightmap)[0];
        for (let x = 0; x < 105; x++) for (let z = 0; z < 105; z++) heights[x][z] = -(((x * 11 + z * 5) % 4) * 30) + 100 - x * 3;
        world.setUnderwater(true);
    }
    ClientBuild.Init(under);
    const mapl = requireNonNull(ClientBuild.m_mapl);
    for (let l = 0; l < 4; l++) for (let x = 0; x < 104; x++) mapl[l][x].set(savedMapl[l][x]);
    clip = [0, 1, 2, 3].map(() => new CollisionMap(104, 104));
    ids = new Map();
    printedModels.clear();
    prevSquares = new Map();
    prevCaches = '';
    prevShadow = copy(ClientBuild.m_shadow, true);
    prevMapo = copy(ClientBuild.m_mapo, false);
    prevMapl = copy(ClientBuild.m_mapl, true);
    prevClip = copy(clipFlags(), false);
    const shadow = requireNonNull(ClientBuild.m_shadow);
    const mapo = requireNonNull(ClientBuild.m_mapo);
    const squares = world.squares;
    return (
        ` base=${shadow.length}:${hashBytes(shadow)},${mapo.length}:${hashGrid(mapo)},${hashBytes(mapl)},${hashGrid(requireNonNull(copy(clipFlags(), false)))}` +
        `,${hashGrid(requireNonNull(world.levelHeightmaps))},${hashGrid(main)},${world.underwaterHeightmap === null ? '-' : String(hashGrid(world.underwaterHeightmap))}` +
        `,${squares === world.underwaterSquares ? 'U' : squares === world.mainLevelTiles ? 'M' : '?'}`
    );
}

function run(t: string[], n: number[]): string {
    switch (t[0]) {
        case 'reset':
            return reset(n[1] !== 0);
        case 'vis':
            Preferences.allLevelsVisible = n[1] !== 0;
            return '';
        case 'gdec':
            Preferences.showGroundDecorations = n[1] !== 0;
            return '';
        case 'bl':
            ClientBuild.buildLevel = n[1];
            return '';
        case 'mapl':
            arrayPut(arrayAt(arrayAt(ClientBuild.m_mapl, n[1]), n[2]), n[3], n[4]);
            return '';
        case 'loop':
            Client.loopCycle = n[1];
            return '';
        case 'var':
            arrayPut(ClientVarCache.m_var, n[1], n[2]);
            return '';
        case 'check':
            return '';
        case 'add':
            // add seed underwater level loc heightLevel angle shape x z building collision(-1 = null)
            mathRandom.setSeed(BigInt(n[1]));
            ClientBuild.AddLoc(n[2] !== 0, n[3], n[4], n[5], n[6], n[7], n[8], n[9], n[10] !== 0, n[11] < 0 ? null : clip[n[11]]);
            return '';
        default:
            throw new Error(`bad op ${t[0]}`);
    }
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

function runTs(script: string[]): string[] {
    const out: string[] = [];
    for (const line of script) {
        const t = line.split(' ');
        const n = t.map((s, i) => (i === 0 ? 0 : Number(s) | 0));
        let result: string;
        if (t[0] === 'setup') {
            result = `ok${setup()}`;
        } else {
            try {
                result = `ok${run(t, n)}`;
            } catch (e) {
                if (e instanceof Error && e.message.startsWith('bad op')) throw e;
                result = code(e);
                if (process.env.SBL_TRACE === String(out.length)) console.log(line, e instanceof Error ? e.stack : e);
            }
        }
        out.push(`${result}|${diff(t[0] === 'check')}`);
    }
    return out;
}

// ---- oracle ----

function runOracle(script: string[]): string[] {
    const scratch = mkdtempSync(join(tmpdir(), '530-scene-build-locs-'));
    try {
        const source = fileURLToPath(new URL('./scene-build-locs/SceneBuildLocsOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(`javac failed: ${build.stderr.toString()}`);
        const run = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Xmx2g', '-cp', gamepackPath + delimiter + scratch, 'SceneBuildLocsOracle', cachePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`SceneBuildLocsOracle exited ${run.exitCode}: ${run.stderr.toString().slice(0, 4000)}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

// ---- script ----

interface Info {
    id: number;
    shapes: number[] | null;
    models: boolean;
    width: number;
    length: number;
    shadow: boolean;
    occludes: boolean;
    blockwalk: number;
    blockrange: boolean;
    wallWidth: number;
    animation: number;
    randomAnim: boolean;
    multi: number[] | null;
    multiVarp: number;
    particles: boolean;
    ambient: number;
    randomSounds: boolean;
    hillSkew: number;
    raise: number;
    flag96: boolean;
    active: number;
    flag88: boolean;
    share: boolean;
    flag90: boolean;
    forceDecor: boolean;
}

// Every loc definition as LocType.List leaves it (members on), read through a fresh loc archive.
function scan(): Info[] {
    const out: Info[] = [];
    withClinitStatics([{ target: LocType, clinit: { m_pConfigClient: js5(16), members: true, m_recentUse: new LRUHashCache(64) } }], () => {
        const archive = requireNonNull(LocType.m_pConfigClient);
        const total = ((archive.GetGroupIdLimit() - 1) * 256 + archive.GetFileIdLimit(archive.GetGroupIdLimit() - 1)) | 0;
        for (let i = 0; i < total; i++) {
            const t = LocType.List(i);
            out.push({
                id: i,
                shapes: t.modelShapes === null ? null : Array.from(t.modelShapes),
                models: t.modelIds !== null,
                width: t.width,
                length: t.length,
                shadow: t.shadow,
                occludes: t.occludes,
                blockwalk: t.blockwalk,
                blockrange: t.blockrange,
                wallWidth: t.wallWidth,
                animation: t.animation,
                randomAnim: t.randomAnimFrame,
                multi: t.multi === null ? null : Array.from(t.multi),
                multiVarp: t.multiVarp,
                particles: t.hasParticles,
                ambient: t.ambientSound,
                randomSounds: t.randomSounds !== null,
                hillSkew: t.hillSkew,
                raise: t.raiseObject,
                flag96: t.flag96,
                active: t.active,
                flag88: t.flag88,
                share: t.shareLight,
                flag90: t.flag90,
                forceDecor: t.forceDecor
            });
        }
    });
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

const has = (t: Info, shape: number): boolean => t.shapes !== null && t.shapes.includes(shape);

interface Picked {
    types: Info[];
    categories: Record<string, number>;
}

function pick(all: Info[]): Picked {
    const modelled = all.filter(t => t.models);
    const categories: [string, (t: Info) => boolean, number][] = [
        ['wall0-shadow-occludes', t => has(t, 0) && t.shadow && t.occludes && t.wallWidth === 16, 2],
        ['wall0-wide', t => has(t, 0) && t.wallWidth !== 16, 2],
        ['wall2', t => has(t, 2) && t.occludes, 2],
        ['wall1-shadow', t => has(t, 1) && t.shadow, 1],
        ['wall3', t => has(t, 3), 1],
        ['decor4', t => has(t, 4), 2],
        ['diag9', t => has(t, 9), 1],
        ['scen10-rotated', t => has(t, 10) && t.width !== t.length && t.width > 1, 2],
        ['scen10-shadow', t => has(t, 10) && t.shadow && t.blockwalk !== 0 && t.width === 1 && t.length === 1, 2],
        ['scen10-big-shadow', t => has(t, 10) && t.shadow && t.width >= 3 && t.length >= 3, 1],
        ['roof', t => t.shapes !== null && t.shapes.some(s => s >= 12 && s <= 21), 2],
        ['gd22-blocking', t => has(t, 22) && t.blockwalk === 1, 1],
        ['gd22-inactive', t => has(t, 22) && t.active === 0 && t.blockwalk !== 1 && !t.forceDecor, 1],
        ['gd22-forced', t => has(t, 22) && t.forceDecor, 1],
        ['animated-random', t => t.animation !== -1 && t.randomAnim, 2],
        ['animated', t => t.animation !== -1 && !t.randomAnim, 1],
        ['multi-varp', t => t.multi !== null && t.multiVarp !== -1, 1],
        ['multi-varbit', t => t.multi !== null && t.multiVarp === -1, 1],
        ['particles', t => t.particles, 1],
        ['ambient-sound', t => t.ambient !== -1 && t.multi === null, 1],
        ['random-sounds', t => t.randomSounds && t.multi === null, 1],
        ['multi-sound', t => t.multi !== null && t.multi.some(m => m !== -1 && all[m] !== undefined && (all[m].ambient !== -1 || all[m].randomSounds)), 1],
        ['hillskew', t => t.hillSkew !== 0 && t.hillSkew < 4, 1],
        ['hillskew-45', t => t.hillSkew >= 4, 2],
        ['raise', t => t.raise === 1, 1],
        ['flag96', t => t.flag96, 1],
        ['flag88', t => t.flag88, 1],
        ['sharelight', t => t.share, 2],
        ['shapeless', t => t.shapes === null, 2],
        ['unblocked-range', t => !t.blockrange && t.blockwalk !== 0, 1],
        ['flag90', t => t.flag90, 1]
    ];
    // Multilocs list no models of their own (their variants do); particles are rare: those come from every loc.
    const fromAll = new Set(['multi-varp', 'multi-varbit', 'multi-sound', 'particles']);
    const chosen = new Map<number, Info>();
    const counts: Record<string, number> = {};
    for (const [name, accept, max] of categories) {
        const found = some(fromAll.has(name) ? all : modelled, t => accept(t) && !chosen.has(t.id), max);
        counts[name] = found.length;
        for (const t of found) chosen.set(t.id, t);
    }
    // A loc with no models at all.
    const empty = some(all, t => !t.models, 1);
    counts['no-models'] = empty.length;
    for (const t of empty) chosen.set(t.id, t);
    return { types: [...chosen.values()], categories: counts };
}

interface Generated {
    script: string[];
    picked: Picked;
}

function generate(all: Info[]): Generated {
    const picked = pick(all);
    const types = picked.types;
    const ops: string[] = ['setup', 'loop 4321'];
    let seed = 1000;
    const add = (under: number, level: number, loc: number, heightLevel: number, angle: number, shape: number, x: number, z: number, building: number, col: number): void => {
        ops.push(`add ${seed++} ${under} ${level} ${loc} ${heightLevel} ${angle} ${shape} ${x} ${z} ${building} ${col}`);
    };
    // Multiloc varps: a few variants selected.
    for (const t of types) if (t.multi !== null && t.multiVarp !== -1) ops.push(`var ${t.multiVarp} 1`);

    // ---- every shape at every angle, per type, on a fresh world ----
    types.forEach((t, ti) => {
        ops.push('reset 0');
        for (let k = 0; k < 92; k++) {
            const shape = k >> 2;
            const angle = k & 3;
            const level = (angle + ti) & 3;
            const building = (shape + angle + ti) % 3 !== 0 ? 1 : 0;
            const under = ti % 7 === 3 && k % 5 === 0 ? 1 : 0;
            const heightLevel = building === 0 && k % 9 === 4 && level < 3 ? level + 1 : level;
            const col = k % 6 === 5 ? -1 : level;
            add(under, level, t.id, heightLevel, angle, shape, 4 + (k % 10) * 10, 4 + Math.floor(k / 10) * 10, building, col);
        }
        ops.push('check');
    });

    const of = (name: (t: Info) => boolean, fallback: Info): Info => types.find(name) ?? fallback;
    const wall16 = of(t => has(t, 0) && t.shadow && t.occludes && t.wallWidth === 16, types[0]);
    const wallWide = of(t => has(t, 0) && t.wallWidth !== 16, types[0]);
    const decor = of(t => has(t, 4), types[0]);
    const diag = of(t => has(t, 9), types[0]);
    const scen = of(t => has(t, 10) && t.shadow && t.width === 1 && t.length === 1, types[0]);
    const big = of(t => has(t, 10) && t.shadow && t.width >= 3 && t.length >= 3, types[0]);
    const rotated = of(t => has(t, 10) && t.width !== t.length && t.width > 1, types[0]);
    const gds = types.filter(t => has(t, 22));
    const skew = of(t => t.hillSkew >= 4, types[0]);
    const roof = of(t => t.shapes !== null && t.shapes.some(s => s >= 12 && s <= 17 && s !== 13), types[0]);
    const roofShape = roof.shapes === null ? 12 : (roof.shapes.find(s => s >= 12 && s <= 17 && s !== 13) ?? 12);

    // ---- the low-detail build gate ----
    let tile = 0;
    const nextTile = (): [number, number] => {
        const x = 3 + (tile % 24) * 4;
        const z = 3 + (Math.floor(tile / 24) % 24) * 4;
        tile++;
        return [x, z];
    };
    for (const [gateType, shape] of [
        [wall16, 0],
        [scen, 10],
        [roof, roofShape],
        [gds[0] ?? scen, 22]
    ] as [Info, number][]) {
        ops.push('reset 0', 'vis 0');
        tile = 0;
        for (let level = 0; level < 4; level++) {
            for (let buildLevel = 0; buildLevel < 4; buildLevel++) {
                for (let flags = 0; flags < 6; flags++) {
                    const [x, z] = nextTile();
                    for (let l = 0; l < 4; l++) ops.push(`mapl ${l} ${x} ${z} 0`);
                    if (flags === 1) ops.push(`mapl 0 ${x} ${z} 2`);
                    if (flags === 2) ops.push(`mapl ${level} ${x} ${z} 16`);
                    if (flags === 3) ops.push(`mapl ${level} ${x} ${z} 8`);
                    if (flags === 4) ops.push(`mapl 1 ${x} ${z} 2`);
                    if (flags === 5) ops.push(`mapl ${level} ${x} ${z} -1`);
                    ops.push(`bl ${buildLevel}`);
                    add(0, level, gateType.id, level, (level + flags) & 3, shape, x, z, (flags + buildLevel) % 4 === 3 ? 0 : 1, level);
                }
            }
        }
        // All levels visible: no gate.
        ops.push('vis 1');
        for (let level = 0; level < 4; level++) {
            const [x, z] = nextTile();
            ops.push(`mapl ${level} ${x} ${z} 16`, `bl ${(level + 1) & 3}`);
            add(0, level, gateType.id, level, level, shape, x, z, 1, level);
        }
        ops.push('bl 0', 'check');
    }

    // ---- ground decor with showGroundDecorations off ----
    ops.push('reset 0', 'gdec 0');
    tile = 0;
    for (const t of gds) {
        for (let angle = 0; angle < 4; angle++) {
            const [x, z] = nextTile();
            add(0, 0, t.id, 0, angle, 22, x, z, angle & 1, angle === 3 ? -1 : 0);
        }
    }
    ops.push('gdec 1', 'check');

    // ---- wall decor against the wall under it, and walls over existing decor ----
    ops.push('reset 0');
    tile = 0;
    for (let angle = 0; angle < 4; angle++) {
        for (const shape of [4, 5, 6, 7, 8]) {
            for (const wall of [null, wall16, wallWide]) {
                const [x, z] = nextTile();
                if (wall !== null) add(0, 0, wall.id, 0, angle, (angle + shape) % 3 === 0 ? 2 : 0, x, z, 1, 0);
                add(0, 0, decor.id, 0, angle, shape, x, z, shape & 1, 0);
            }
            // Decor first, then a wide wall, a 16-wide wall and a diagonal wall on top (MoveDecor when the width is not 16).
            for (const [wall, wallShape] of [
                [wallWide, 0],
                [wallWide, 2],
                [wall16, 0],
                [diag, 9],
                [wallWide, 9]
            ] as [Info, number][]) {
                const [x, z] = nextTile();
                add(0, 1, decor.id, 1, angle, shape, x, z, 1, 1);
                add(0, 1, wall.id, 1, angle, wallShape, x, z, 1, 1);
            }
        }
    }
    ops.push('check');

    // ---- six shadow casters on one tile (the sixth AddScenery fails) and overlapping footprints ----
    ops.push('reset 0');
    for (let i = 0; i < 7; i++) add(0, 0, scen.id, 0, i & 3, 10 + (i & 1), 50, 50, 1, 0);
    for (let i = 0; i < 6; i++) add(0, 1, big.id, 1, i & 3, 10, 60 + i, 40 + (i >> 1), 1, 1);
    for (let i = 0; i < 6; i++) add(0, 2, rotated.id, 2, i & 3, 11, 30, 70 + i, i & 1, 2);
    ops.push('check');

    // ---- the map edge and level 3 ----
    ops.push('reset 0');
    const edgeTypes = [big, rotated, wall16, decor, scen, skew, gds[0] ?? scen];
    const edges: [number, number][] = [
        [1, 1],
        [101, 50],
        [102, 50],
        [103, 50],
        [50, 101],
        [50, 102],
        [50, 103],
        [102, 102],
        [103, 103],
        [103, 1],
        [1, 103]
    ];
    for (const t of edgeTypes) {
        for (const [x, z] of edges) {
            for (let angle = 0; angle < 4; angle++) {
                const shape = [10, 11, 0, 22, 4, 2, 9, 12][(x + z + angle + t.id) & 7];
                add(0, 0, t.id, 0, angle, shape, x, z, 1, 0);
            }
        }
        // Level 3: no second heightmap for the hill skew; heightmap level 3 under a level-0 loc (o.a).
        for (let angle = 0; angle < 4; angle++) {
            add(0, 3, t.id, 3, angle, 10, 20 + angle * 6, 20, 1, 3);
            add(0, 0, t.id, 3, angle, 10, 20 + angle * 6, 30, 0, 0);
            add(0, 2, t.id, 3, angle, 22, 20 + angle * 6, 40, 0, -1);
        }
        ops.push('check');
    }
    // Footprints ending exactly on the edge (x + width == 104, z + length == 104: the centre arms, not the edge ones), for
    // every multi-tile type, at several rows of the real heightmap.
    ops.push('reset 0');
    for (const t of types.filter(type => Math.max(type.width, type.length) >= 2)) {
        const shape = t.shapes === null ? 10 : t.shapes.includes(10) ? 10 : t.shapes[0];
        for (let angle = 0; angle < 4; angle++) {
            const sizeX = (angle & 1) === 0 ? t.width : t.length;
            const sizeZ = (angle & 1) === 0 ? t.length : t.width;
            for (const row of [12, 37, 64, 88]) {
                add(0, 0, t.id, 0, angle, shape, 104 - sizeX, row + angle, angle & 1, 0);
                add(0, 0, t.id, 0, angle, shape, row + angle, 104 - sizeZ, (angle + 1) & 1, 0);
            }
        }
    }
    ops.push('check');

    // ---- a heightmap level other than the loc's (o.a's call) at every shape, animated locs included ----
    const heightTypes = new Set([...types.filter(t => t.animation !== -1 || t.multi !== null), wall16, wallWide, decor, diag, scen, rotated, roof, skew, ...gds]);
    for (const t of heightTypes) {
        ops.push('reset 0');
        for (let shape = 0; shape < 23; shape++) {
            add(0, 0, t.id, 1, shape & 3, shape, 4 + (shape % 10) * 10, 4 + Math.floor(shape / 10) * 10, 0, 0);
            add(0, 1, t.id, 2, (shape + 1) & 3, shape, 4 + (shape % 10) * 10, 44 + Math.floor(shape / 10) * 10, 0, 1);
            add(0, 2, t.id, 3, (shape + 2) & 3, shape, 4 + (shape % 10) * 10, 74 + Math.floor(shape / 10) * 10, shape & 1, -1);
        }
        ops.push('check');
    }

    // ---- the underwater layer ----
    for (const t of [scen, wall16, decor, skew, rotated, gds[0] ?? scen]) {
        ops.push('reset 1');
        for (let k = 0; k < 92; k++) {
            const shape = k >> 2;
            const angle = k & 3;
            add(1, 0, t.id, 0, angle, shape, 4 + (k % 10) * 10, 4 + Math.floor(k / 10) * 10, k % 3 === 0 ? 1 : 0, k % 4 === 0 ? 0 : -1);
        }
        ops.push('check');
    }
    return { script: ops, picked };
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

// scene-world.test.ts's worldClinit.
function worldClinit(): Statics {
    return {
        fillLeft: 0,
        dynamicCount: 0,
        roofHideMaxZ: null,
        clickLevel: 0,
        viewRadius: 0,
        cornerVisibility: null,
        hiddenRoofY: null,
        spriteBuffer: null,
        cy: 0,
        hideAreaMaxX: null,
        eyeTileZ: 0,
        roofMinX: null,
        gx: 0,
        groundZ: -1,
        minX: 0,
        levelTileOcclusionCycles: null,
        maxZ: 0,
        waterSpriteKeys: null,
        maxLevel: 0,
        squares: null,
        minLevel: 0,
        cycleNo: 0,
        mainGroundh: null,
        maxX: 0,
        cx: 0,
        occluders: null,
        numOccluders: 0,
        mainLevelTiles: null,
        underwaterHeightmap: null,
        takingInput: false,
        clickX: 0,
        dynamicSprites: null,
        minZ: 0,
        cameraCosY: 0,
        cameraCosX: 0,
        maxTileZ: 0,
        clickY: 0,
        cz: 0,
        roofHideMinZ: null,
        numActiveOccluders: 0,
        groundX: -1,
        cameraSinX: 0,
        maxTileX: 0,
        visibilityMap: null,
        activeOccluders: null,
        tileCameraClearance: null,
        levelHeightmaps: null,
        underwaterSquares: null,
        cameraSinY: 0
    };
}

function resets(): StaticReset[] {
    const { sin, cos } = sinCos();
    const nulls = <T>(n: number): (T | null)[] => new Array<T | null>(n).fill(null);
    return [
        { target: world, clinit: worldClinit() },
        // aj/tb/sb/je/qe/ka/ib/lg/ti/ke/t/tf/vk/li/lc <clinit>: tb.t allocated, the rest unset; buildLevel 0, minusedlevel 99.
        {
            target: ClientBuild,
            clinit: {
                m_mapl: newBytes3(4, 104),
                buildLevel: 0,
                minusedlevel: 99,
                m_floort1: null,
                m_floort2: null,
                m_floors: null,
                m_floorr: null,
                m_mapo: null,
                m_shadow: null,
                m_huetot: null,
                m_sattot: null,
                m_ligtot: null,
                m_comtot: null,
                m_tot: null
            }
        },
        // rj.l and lf.i.
        { target: Preferences, clinit: { allLevelsVisible: true, showGroundDecorations: true } },
        // hh.kb.
        { target: Client, clinit: { loopCycle: 0 } },
        // jb's: gd.U, ik.Y, ok.z, the low-memory flag, he.w, lj.c, vf.T, uj.f, de.v, g.j (new wj()) and ll.j (new cb[4]).
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
                recolPalette: new Int16Array(256),
                modelResult: new LocEntity(),
                temp: nulls(4)
            }
        },
        // ek's ag.i, ga.B, qf.b; og's ma.g, cd.d; vj.d; nc.j.
        { target: SeqType, clinit: { m_pConfigClient: null, m_recentUse: new LRUHashCache(64), forceTween: false } },
        { target: VarBitType, clinit: { m_pConfigClient: null, m_recentUse: new LRUHashCache(64) } },
        { target: ClientVarCache, clinit: { m_var: new Int32Array(2500) } },
        { target: AreaSoundManager, clinit: { locs: new SharedPtrList() } },
        // vc.J and ce.K.
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
        }
    ];
}

test('ClientBuild.AddLoc matches nc.a in client.jar over every loc shape and angle of real loc types on a real heightmap', () => {
    const all = withClinitStatics([{ target: Js5, clinit: { strictValidation: false, maxContainerSize: 0 } }], scan);
    expect(all.length).toBeGreaterThan(40000);
    const { script, picked } = generate(all);
    const java = runOracle(script);
    expect(java.length).toBe(script.length);
    const savedSeed = (mathRandom as unknown as { seed: bigint }).seed;
    let ts: string[] = [];
    try {
        ts = withClinitStatics(resets(), () => {
            try {
                return runTs(script);
            } finally {
                ids = new Map();
                printedModels.clear();
                prevSquares = new Map();
                clip = [];
            }
        });
    } finally {
        mathRandom.setSeed(savedSeed ^ 0x5deece66dn);
    }
    expect(ts.length).toBe(script.length);

    if (process.env.SBL_DUMP) {
        writeFileSync(`${process.env.SBL_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.SBL_DUMP}.java`, java.join('\n') + '\n');
        writeFileSync(`${process.env.SBL_DUMP}.ts`, ts.join('\n') + '\n');
    }
    const adds = script.filter(line => line.startsWith('add '));
    const results = (pattern: RegExp): number => script.filter((line, i) => line.startsWith('add ') && pattern.test(java[i])).length;
    if (process.env.SBL_STATS) {
        const counts = new Map<string, number>();
        script.forEach((line, i) => {
            if (!line.startsWith('add ')) return;
            const key = java[i].slice(0, java[i].indexOf('|'));
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });
        console.log(`${script.length} ops, ${adds.length} adds, ${picked.types.length} types`, picked.categories, Object.fromEntries(counts));
        console.log(
            'bytes',
            java.reduce((sum, l) => sum + l.length, 0)
        );
    }

    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 6; i++) {
        if (ts[i] === java[i]) continue;
        const a = java[i].split(' ');
        const b = ts[i].split(' ');
        let at = 0;
        while (at < a.length && a[at] === b[at]) at++;
        mismatches.push(
            `#${i} ${script[i]}\n  java: ${a
                .slice(Math.max(0, at - 2), at + 3)
                .join(' ')
                .slice(0, 3000)}\n  ts:   ${b
                .slice(Math.max(0, at - 2), at + 3)
                .join(' ')
                .slice(0, 3000)}`
        );
    }
    expect(mismatches).toEqual([]);

    // The script reaches what it claims to (read from the jar's output).
    expect(adds.length).toBeGreaterThan(5000);
    expect(picked.types.length).toBeGreaterThan(40);
    expect(results(/^ok\|.* M\d/)).toBeGreaterThan(1500);
    expect(results(/^ok\|.* U0,/)).toBeGreaterThan(150);
    // Walls, wall decor, ground decor and scenery sprites placed; ClientLocAnim, unlit share-light and lit models.
    for (const entity of ['W', 'N', 'G', 'S']) expect(results(new RegExp(`[,;[]${entity}#\\d+:`)), entity).toBeGreaterThan(150);
    expect(results(/ Xml#/)).toBeGreaterThan(300);
    expect(results(/ Xcb#/)).toBeGreaterThan(100);
    expect(results(/ Xfc#/)).toBeGreaterThan(300);
    // m_shadow, m_mapo and collision writes, area sounds, minusedlevel changes and the edge exceptions.
    expect(results(/ s\d/)).toBeGreaterThan(300);
    expect(results(/ o\d/)).toBeGreaterThan(300);
    expect(results(/ c\d/)).toBeGreaterThan(1500);
    expect(results(/ B\d+=/)).toBeGreaterThan(100);
    expect(results(/^ok\| Z=/)).toBeGreaterThan(40);
    expect(results(/^aioobe\|/)).toBeGreaterThan(0);
    // The low-detail gate (adds right after a bl op) both refuses (no state change at all) and places.
    const gated = script.map((line, i) => (line.startsWith('add ') && script[i - 1].startsWith('bl ') ? java[i] : null)).filter(line => line !== null);
    expect(gated.filter(line => line === 'ok|').length).toBeGreaterThan(80);
    expect(gated.filter(line => line !== 'ok|').length).toBeGreaterThan(150);
}, 600000);
