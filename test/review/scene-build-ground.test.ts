import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import BZip2Decompressor from '../../src/cache/BZip2Decompressor.js';
import BZip2State from '../../src/cache/BZip2State.js';
import ByteArrayCopier from '../../src/cache/ByteArrayCopier.js';
import Js5 from '../../src/cache/Js5.js';
import Js5Index from '../../src/cache/Js5Index.js';
import Js5ResourceProvider from '../../src/cache/Js5ResourceProvider.js';
import Client from '../../src/client/Client.js';
import ClientBuild from '../../src/client/ClientBuild.js';
import GameVariant from '../../src/client/GameVariant.js';
import FloType from '../../src/config/FloType.js';
import FluType from '../../src/config/FluType.js';
import LocType from '../../src/config/LocType.js';
import SeqType from '../../src/config/SeqType.js';
import VarBitType from '../../src/config/VarBitType.js';
import AnimFrame from '../../src/dash3d/AnimFrame.js';
import AnimFrameSet from '../../src/dash3d/AnimFrameSet.js';
import ClientLocAnim from '../../src/dash3d/ClientLocAnim.js';
import CollisionMap from '../../src/dash3d/CollisionMap.js';
import ColourImageCache from '../../src/dash3d/ColourImageCache.js';
import ColourImageCacheEntry from '../../src/dash3d/ColourImageCacheEntry.js';
import Decor from '../../src/dash3d/Decor.js';
import FaceNormal from '../../src/dash3d/FaceNormal.js';
import Ground from '../../src/dash3d/Ground.js';
import GroundDecor from '../../src/dash3d/GroundDecor.js';
import GroundObject from '../../src/dash3d/GroundObject.js';
import LocEntity from '../../src/dash3d/LocEntity.js';
import ModelLit from '../../src/dash3d/ModelLit.js';
import ModelLitImpl from '../../src/dash3d/ModelLitImpl.js';
import type ModelSource from '../../src/dash3d/ModelSource.js';
import ModelUnlit from '../../src/dash3d/ModelUnlit.js';
import MonochromeImageCache from '../../src/dash3d/MonochromeImageCache.js';
import MonochromeImageCacheEntry from '../../src/dash3d/MonochromeImageCacheEntry.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import PointNormal from '../../src/dash3d/PointNormal.js';
import ProceduralTexture from '../../src/dash3d/ProceduralTexture.js';
import QuickGround from '../../src/dash3d/QuickGround.js';
import Sprite from '../../src/dash3d/Sprite.js';
import type Square from '../../src/dash3d/Square.js';
import Texture from '../../src/dash3d/Texture.js';
import TextureCache from '../../src/dash3d/TextureCache.js';
import TextureOp from '../../src/dash3d/TextureOp.js';
import TextureOpKaleidoscope from '../../src/dash3d/TextureOpKaleidoscope.js';
import TextureOpSprite from '../../src/dash3d/TextureOpSprite.js';
import TextureOpVoronoiNoise from '../../src/dash3d/TextureOpVoronoiNoise.js';
import TextureShapeRaster from '../../src/dash3d/TextureShapeRaster.js';
import Wall from '../../src/dash3d/Wall.js';
import world from '../../src/dash3d/world.js';
import LRUHashCache from '../../src/datastruct/LRUHashCache.js';
import LruHashTable from '../../src/datastruct/LruHashTable.js';
import SharedPtrList from '../../src/datastruct/SharedPtrList.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import Crc32 from '../../src/io/Crc32.js';
import AreaSoundManager from '../../src/sound/AreaSoundManager.js';
import Preferences from '../../src/ui/Preferences.js';
import ClientVarCache from '../../src/util/ClientVarCache.js';
import { arrayAt, requireNonNull } from '../../src/util/JavaArray.js';
import { mathRandom } from '../../src/util/JavaRandom.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { PIX2D, SPRITE_LOADER, type StaticReset, withClinitStatics } from './staticState.js';

// The native scene build against client.jar: ClientBuild.FinishBuild (al.a(I[Lke;Z)V) at the end of the whole map
// build, with ClientBuild.AddLoc (nc.a) placing every loc of the real map squares, and the scene drawn from it.
// test/review/scene-build-ground/SceneBuildGroundOracle.java runs the same script on the real gamepack classes: both
// sides read the cache's sector files through a real al/Js5 per archive (land squares through al.a(III)[B, loc squares
// through their XTEA keys and al.a(BI[II)[B), build the scene through the original loaders (nk.a/LoadGround,
// hi.a/LoadLocations, lk.a/LoadGroundRegion, ck.a/LoadLocationsRegion, bk.a/clearMapArea; ClientBuild.placeLocation is
// pointed at AddLoc as the jar's hi.a/ck.a call nc.a), run al.a/FinishBuild with Math.random seeded identically, then
// cf.a/FillBaseLevel(minusedlevel) and qc.a/world.draw over a real kg/TextureCache (procedural textures included).
// The oracle rewrites uk.a (world.SetGround) to report its twenty arguments on entry; here world.SetGround is wrapped
// the same way for the duration of the finish op.
//
// Compared, line for line: the input bytes (land and decrypted loc squares) and the brightness/colour table; every
// SetGround call FinishBuild makes, in order (level, tile, shape, rotation, texture, the four heights, the four
// underlay and four overlay colours, both minimap colours); then the whole result: minusedlevel, the jittered
// m_hueOff/m_ligOff, the floor grids FinishBuild nulls level by level, m_mapo after the occluder searches cleared their
// bits, m_mapl and the camera-clearance grid, which heightmap and square layer are active, every heightmap row after
// PushDown, every collision row (the m_mapl flag-1 ground blocks), every occluder with all 18 jg fields, every non-null
// square of both layers with every field (the kb/ma ground with all its arrays, walls, decor, ground decor, sprites,
// the PushDown linked square), every model the squares reference (cb/fc: every instance field, arrays as
// identity:length:hash, so ShareLight's lit copies and their face colours; ml: every field), and the unlit models the
// squares held before FinishBuild after it ran (ShareLight's mergeNormals writes into their vertex normals). After each
// draw: the framebuffer hash, its lit pixel count, Client.soundEffectCount and the hash of every row.
//
// Scenes: (A) Lumbridge, the four real map squares 49..50 x 49..50 (12,031 SetGround calls, 71 occluders, bridges,
// shared-light walls and roofs, animated locs), drawn from eight eyes and three of them again with highDetailTextures2
// off (textured ground as average colours); (B) the same with allLevelsVisible off at buildLevel 0 and 1 (the low-detail
// skip in AddLoc and FinishBuild), the hue/lightness offsets jittered past both clamps; (C) an instanced region: 13 x 13
// chunks per level from seeded templates over the four squares (every rotation, source levels other than the target
// level, missing chunks through clearMapArea); (D) the underwater build (world.init/Init/LoadGround/LoadLocations/
// FinishBuild with the underwater flag); (E) the Lumbridge ground with no locs (FinishBuild is the first to lower
// minusedlevel); (F) the ground of four land-only squares with the floors Lumbridge lacks (dark underlays and overlays at
// the lower lightness clamp, secondary minimap colours); (G) an instanced tower: Lumbridge castle's level-0 chunks
// stacked on all four levels, plain and rotated, so the wall occluder searches run through every level. Each build's
// finish seed puts Math.random's two jitter draws on a different value, so every jitter and clamp is reached.
//
// Sensitivity: 58 of 67 single-statement mutations of FinishBuild (run in a private copy of the tree) make this test
// fail: the collision pass, both jitter draws and all four clamps, the HSL offsets, the light vector and magnitude, the
// shadow blur, the underlay blend window and totals, packHsl's arguments, the low-detail skip and VisLevel, minusedlevel,
// the m_mapo floor flag and its occlusion tests, every overlay field (shape, rotation, texture availability, missing and
// secondary colours), the SetGround arguments, the level nulling, ShareLight, PushDown, and the thresholds, heights,
// extents, level searches and bit clears of the three occluder kinds. The nine survivors are equivalent or unreachable on
// the 530 cache: the two `> 127` lightness clamps (no underlay is lighter than 232, no overlay colour lighter than 74, so
// the clamped value stays below 125); the three `< 0` clamps set to 1 instead of 0 (the clamped lightness only reaches
// the minimap colour through underlayBrightness/overlayBrightness at light 96, which give the same colour for 0..3; the
// same statements set to 4 are caught); three scans and loop bounds past tile 102 (no build sets an m_mapo bit there:
// the loaders drop locs outside 1..102); and the z-wall downward level search, whose x-wall twin is caught but whose
// shape (a run that only reaches 8 tile-levels when counted down from a shorter upper part) no z wall here has.
//
// SBG_DUMP=<prefix> writes the script and both outputs.

type Statics = Record<string, unknown>;

// ---- cache access (SceneBuildLocsOracle.Provider) ----

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

// [cb field, ModelUnlit property, JVM descriptor] in cb's declaration order (SceneBuildLocsOracle.CB_FIELDS).
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

// [fc field, ModelLitImpl property, JVM descriptor] in fc's declaration order (SceneBuildLocsOracle.FC_FIELDS), then nd.j.
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
            if (desc === 'L') return ` ${obf}=${v === null ? 'null' : 'TYPE!object'}`;
            return ` ${obf}=${value(v, desc)}`;
        }).join('');
    }
    return '';
}

// ---- squares (scene-build-locs.test.ts's desc/square, with every field of the ground) ----

const b = (v: boolean): number => (v ? 1 : 0);

function desc(o: object | null): string {
    if (o === null) return '-';
    if (o instanceof Wall) return `W#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${mref(o.model1)},${mref(o.model2)},${o.angle1},${o.angle2}`;
    if (o instanceof Decor) return `N#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${mref(o.model)},${mref(o.model2)},${o.wshape},${o.angle},${o.offsetX},${o.offsetZ}`;
    if (o instanceof GroundDecor) return `G#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${mref(o.model)}`;
    if (o instanceof GroundObject) return `O#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${o.height},${mref(o.topObj)},${mref(o.middleObj)},${mref(o.bottomObj)}`;
    if (o instanceof Sprite) {
        return `S#${id(o)}:${o.typecode},${o.level},${o.x},${o.y},${o.z},${o.yaw},${o.minTileX},${o.minTileZ},${o.maxTileX},${o.maxTileZ},${o.cycle},${o.distance},${mref(o.model)}`;
    }
    if (o instanceof Ground) {
        // kb's fields in declaration order: a b c d e g h j k l m n o p s.
        return (
            `kb#${id(o)}:${value(o.rotation, 'I')},${value(o.faceVertexB, '[I')},${value(o.vertexY, '[I')},${value(o.vertexX, '[I')},` +
            `${value(o.faceColourA, '[I')},${value(o.faceColourB, '[I')},${value(o.flat, 'Z')},${value(o.faceVertexC, '[I')},` +
            `${value(o.faceTexture, '[I')},${value(o.minimapOverlay, 'I')},${value(o.shape, 'I')},${value(o.minimapUnderlay, 'I')},` +
            `${value(o.faceVertexA, '[I')},${value(o.faceColourC, '[I')},${value(o.vertexZ, '[I')}`
        );
    }
    if (o instanceof QuickGround) {
        // ma's fields in declaration order: c d f h i l m.
        return `ma#${id(o)}:${value(o.colourSE, 'I')},${value(o.flat, 'Z')},${value(o.colourSW, 'I')},${value(o.colourNW, 'I')},` + `${value(o.colourNE, 'I')},${value(o.texture, 'I')},${value(o.minimapRgb, 'I')}`;
    }
    throw new Error(`desc ${o.constructor.name}`);
}

function square(r: Square | null, nested: boolean): string {
    if (r === null) return 'n';
    let s = `#${id(r)}:${r.level},${r.originalLevel},${r.x},${r.z}`;
    s += `,t${r.spriteCount},P${r.spriteSpans},A`;
    for (let i = 0; i < r.spriteSpan.length; i++) s += `${i === 0 ? '' : '/'}${r.spriteSpan[i]}`;
    s += `,${b(r.drawFront)}${b(r.drawBack)}${b(r.drawSprites)}`;
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

// ---- grids (the oracle's rows/hash3/levels) ----

type Grid = ArrayLike<number>[];

function rows(a: Grid): string {
    let s = String(a.length);
    for (const row of a) s += `,${row.length}:${hashInts(row, false)}`;
    return s;
}

function hash3(a: Grid[], signedBytes: boolean): number {
    let h = 1;
    for (const plane of a) {
        for (const row of plane) {
            if (signedBytes) for (let i = 0; i < row.length; i++) h = (Math.imul(31, h) + ((row[i] << 24) >> 24)) | 0;
            else h = (Math.imul(31, h) + hashInts(row, false)) | 0;
        }
    }
    return h;
}

function levels(a: (Grid | null)[] | null, signedBytes: boolean): string {
    if (a === null) return 'N';
    let s = String(a.length);
    for (const plane of a) s += plane === null ? ',n' : `,${hash3([plane], signedBytes)}`;
    return s;
}

// ---- the build state (SceneBuildGroundOracle) ----

const LAND = [254, 256, 380, 382];
// Land-only squares (no loc keys needed) with the floors Lumbridge lacks: m42_68 (dark underlays), m46_79 (dark
// overlays), m34_66 (overlays with a secondary minimap colour) and m51_150 (the one floor whose secondary colour is 0).
const EXTRA = [3587, 1218, 1898, 1212];
const KEYS = [
    [-1653558720, 2119901478, -1449369788, -1829505468],
    [1150282919, 572626783, -257791473, 2031745700],
    [183396243, -461663209, -212681663, -266126212],
    [0, 0, 0, 0]
];

let out: string[] = [];
let clip: CollisionMap[] = [];
let land: (Uint8Array | null)[] = [];
let locs: (Uint8Array | null)[] = [];
let preModels: object[] = [];
const printedModels = new Map<number, string>();
const frame = new Int32Array(512 * 334);

const seed = (n: number): void => mathRandom.setSeed(BigInt(n));
const squareX = (i: number): number => (49 + ((i >> 1) & 1)) * 64 - 3160;
const squareZ = (i: number): number => (49 + (i & 1)) * 64 - 3160;
const newBytes3 = (levelCount: number, size: number): Uint8Array[][] => Array.from({ length: levelCount }, () => Array.from({ length: size }, () => new Uint8Array(size)));

function floatBits(v: number): number {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, v);
    return view.getInt32(0);
}

function setup(): void {
    const models = js5(7);
    LocType.m_pConfigClient = js5(16);
    LocType.m_pModels = models;
    LocType.members = true;
    SeqType.m_pConfigClient = js5(20);
    VarBitType.m_pConfigClient = js5(22);
    FluType.m_pConfigClient = js5(2);
    FloType.m_pConfigClient = js5(2);
    AnimFrameSet.framesArchive = js5(0);
    AnimFrameSet.basesArchive = js5(1);
    Pix3D.textureProvider = new TextureCache(js5(9), js5(26), js5(8), 20, false);
    const maps = js5(5);
    let s = 'I';
    for (let i = 0; i < 4; i++) {
        const l = requireNonNull(maps.GetFile(0, LAND[i]));
        const c = requireNonNull(maps.FetchFile(0, Int32Array.from(KEYS[i]), LAND[i] + 1));
        land[i] = l;
        locs[i] = c;
        s += ` ${l.length}:${hashInts(l, true)},${c.length}:${hashInts(c, true)}`;
    }
    for (let i = 0; i < 4; i++) {
        const l = requireNonNull(maps.GetFile(0, EXTRA[i]));
        land[4 + i] = l;
        s += ` ${l.length}:${hashInts(l, true)}`;
    }
    out.push(s);
    seed(53002);
    Pix3D.setBrightness(Math.fround(0.8));
    out.push(`B ${floatBits((Pix3D as unknown as Statics)['brightness'] as number)} ${hashInts(requireNonNull(Pix3D.colourTable), false)}`);
    // hi.a and ck.a call nc.a directly; the TS loaders call through placeLocation.
    ClientBuild.placeLocation = ClientBuild.AddLoc;
}

function newWorld(under: boolean): void {
    world.init(4, 104, 104, 25, under);
    ClientBuild.Init(under);
    ClientBuild.m_mapl = newBytes3(4, 104);
    clip = [0, 1, 2, 3].map(() => new CollisionMap(104, 104));
    ids = new Map();
    printedModels.clear();
    preModels = [];
}

function sceneModels(): object[] {
    referenced.length = 0;
    for (const layer of [world.mainLevelTiles, world.underwaterSquares]) {
        if (layer === null) continue;
        for (const plane of layer) for (const row of plane) for (const r of row) if (r !== null) square(r, true);
    }
    const models = referenced.slice();
    referenced.length = 0;
    return models;
}

function printModels(tag: string, models: object[]): void {
    const seen = new Set<object>();
    for (const m of models) {
        if (seen.has(m)) continue;
        seen.add(m);
        const i = id(m);
        const dump = model(m);
        if (dump !== printedModels.get(i)) {
            out.push(`${tag}${cls(m)}#${i}=${dump}`);
            printedModels.set(i, dump);
        }
    }
}

function dump(): void {
    out.push(
        `Z ${ClientBuild.minusedlevel} ${ClientBuild.m_hueOff} ${ClientBuild.m_ligOff} ${world.numOccluders} ${Client.soundEffectCount}` +
            ` ${hashInts(Client.soundEffectIds, false)} ${hashInts(Client.soundEffectPositions, false)} ${ClientBuild.buildLevel} ${b(Preferences.allLevelsVisible)}`
    );
    out.push(
        `F ${levels(ClientBuild.m_floort1, true)} ${levels(ClientBuild.m_floort2, true)} ${levels(ClientBuild.m_floors, true)} ${levels(ClientBuild.m_floorr, true)}` + ` ${levels(ClientBuild.m_shadow, true)} ${levels(ClientBuild.m_mapo, false)}`
    );
    const heightmap = world.levelHeightmaps === world.mainGroundh ? 'M' : world.levelHeightmaps === world.underwaterHeightmap ? 'U' : '?';
    const layer = world.squares === world.mainLevelTiles ? 'M' : world.squares === world.underwaterSquares ? 'U' : '?';
    out.push(`L ${hash3(requireNonNull(ClientBuild.m_mapl), true)} ${hash3(requireNonNull(world.tileCameraClearance), true)} ${heightmap} ${layer}`);
    const main = requireNonNull(world.mainGroundh);
    for (let l = 0; l < main.length; l++) out.push(`H${l} ${rows(main[l])}`);
    if (world.underwaterHeightmap !== null) out.push(`W0 ${rows(world.underwaterHeightmap[0])}`);
    for (let l = 0; l < 4; l++) out.push(`C${l} ${rows(clip[l].flags)}`);
    for (let i = 0; i < world.numOccluders; i++) {
        const o = requireNonNull(arrayAt(world.occluders, i));
        // jg's fields in declaration order: a b c d e f g h i j m n o r s u y A.
        out.push(
            `Q${i} ${o.minY},${o.maxDeltaY},${o.minX},${o.type},${o.minDeltaZ},${o.minDeltaY},${o.maxX},${o.maxTileX},${o.minZ},${o.minDeltaX},${o.minTileX},` + `${o.maxTileZ},${o.maxZ},${o.mode},${o.maxDeltaZ},${o.maxY},${o.maxDeltaX},${o.minTileZ}`
        );
    }
    referenced.length = 0;
    const layers: [string, (Square | null)[][][] | null][] = [
        ['M', world.mainLevelTiles],
        ['U', world.underwaterSquares]
    ];
    for (const [tag, squares] of layers) {
        if (squares === null) continue;
        for (let l = 0; l < squares.length; l++) {
            for (let x = 0; x < squares[l].length; x++) {
                for (let z = 0; z < squares[l][x].length; z++) {
                    const r = squares[l][x][z];
                    if (r !== null) out.push(`S${tag}${l},${x},${z}=${square(r, true)}`);
                }
            }
        }
    }
    const models = referenced.slice();
    referenced.length = 0;
    printModels('X', models);
    printModels('V', preModels);
}

function draw(n: number[]): void {
    frame.fill(0);
    Pix2D.setPixels(frame, 512, 334);
    Pix3D.setRenderClipping();
    seed(n[6]);
    world.draw(n[1], n[2], n[3], n[4], n[5], null, null, null, null, null, null, 0, 0, n[1] >> 7, n[3] >> 7);
    let lit = 0;
    for (let i = 0; i < frame.length; i++) if (frame[i] !== 0) lit++;
    out.push(`P ${hashInts(frame, false)} ${lit} ${Client.soundEffectCount}`);
    let s = 'R';
    for (let y = 0; y < 334; y++) s += ` ${hashInts(frame.subarray(y * 512, y * 512 + 512), false)}`;
    out.push(s);
}

function run(t: string[], n: number[]): void {
    switch (t[0]) {
        case 'setup':
            return setup();
        case 'seed':
            return seed(n[1]);
        case 'offs':
            ClientBuild.m_hueOff = n[1];
            ClientBuild.m_ligOff = n[2];
            return;
        case 'world':
            return newWorld(n[1] !== 0);
        case 'land':
            return ClientBuild.LoadGround(squareZ(n[1]), n[2] !== 0, 3160, squareX(n[1]), land[n[1]], 3160, clip);
        case 'locs':
            return ClientBuild.LoadLocations(squareX(n[1]), clip, locs[n[1]], squareZ(n[1]), n[2] !== 0);
        case 'rland':
            // rland/rlocs level cx cz square scx scz sourceLevel rotation underwater.
            return ClientBuild.LoadGroundRegion(n[2] * 8, n[6] * 8, n[3] * 8, n[1], land[n[4]], n[8], clip, n[7], n[9] !== 0, n[5] * 8);
        case 'rlocs':
            return ClientBuild.LoadLocationsRegion(n[2] * 8, n[5] * 8, clip, n[8], n[7], locs[n[4]], n[3] * 8, n[9] !== 0, n[1], n[6] * 8);
        case 'clear':
            return ClientBuild.clearMapArea(n[1] * 8, 8, n[2] * 8, 8, n[3]);
        case 'vis':
            Preferences.allLevelsVisible = n[1] !== 0;
            return;
        case 'bl':
            ClientBuild.buildLevel = n[1];
            return;
        case 'hdt':
            Preferences.highDetailTextures2 = n[1] !== 0;
            return;
        case 'pre':
            preModels = sceneModels();
            return printModels('X', preModels);
        case 'finish': {
            const original = world.SetGround;
            world.SetGround = (...args: Parameters<typeof world.SetGround>): void => {
                out.push(`G ${args.join(' ')}`);
                original(...args);
            };
            try {
                ClientBuild.FinishBuild(clip, n[1] !== 0);
            } finally {
                world.SetGround = original;
            }
            return;
        }
        case 'dump':
            return dump();
        case 'fillbase':
            return world.FillBaseLevel(ClientBuild.minusedlevel);
        case 'draw':
            return draw(n);
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
    out = [];
    script.forEach((line, index) => {
        const t = line.split(' ');
        const n = t.map((s, i) => (i === 0 ? 0 : Number(s) | 0));
        out.push(`@${index} ${line}`);
        let result = 'ok';
        try {
            run(t, n);
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('bad op')) throw e;
            result = code(e);
            if (process.env.SBG_TRACE === String(index)) console.log(line, e instanceof Error ? e.stack : e);
        }
        out.push(`= ${result}`);
    });
    return out;
}

// ---- oracle ----

function runOracle(script: string[]): string[] {
    const scratch = mkdtempSync(join(tmpdir(), '530-scene-build-ground-'));
    try {
        const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
        const source = fileURLToPath(new URL('./scene-build-ground/SceneBuildGroundOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', ...exports, '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(`javac failed: ${build.stderr.toString()}`);
        const java = ['java', ...exports, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Xmx2g'];
        // A copy of uk.class whose SetGround reports its arguments, ahead of the jar on the run's class path.
        const patch = Bun.spawnSync([...java, '-cp', gamepackPath + delimiter + scratch, 'SceneBuildGroundOracle', 'patch', scratch]);
        if (patch.exitCode !== 0) throw new Error(`patch failed: ${patch.stderr.toString()}`);
        const run = Bun.spawnSync([...java, '-cp', scratch + delimiter + gamepackPath, 'SceneBuildGroundOracle', cachePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            maxBuffer: 1024 * 1024 * 1024,
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`SceneBuildGroundOracle exited ${run.exitCode}: ${run.stderr.toString().slice(0, 4000)}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

// ---- script ----

// [x, y, z, pitch, yaw] eyes over Lumbridge (scene tile 0 is world tile 3160).
const EYES: number[][] = [
    [6500, -1080, 5700, 256, 0],
    [3904, -900, 3250, 256, 0],
    [7936, -1400, 7424, 300, 512],
    [8000, -900, 6000, 220, 1024],
    [5000, -1500, 9000, 380, 1536],
    [9500, -1200, 4000, 160, 1800],
    [7000, -700, 7000, 128, 300],
    [6600, -2400, 8200, 450, 900]
];

interface Chunk {
    square: number;
    sx: number;
    sz: number;
    sourceLevel: number;
    rotation: number;
}

function generate(): string[] {
    const ops: string[] = ['setup'];
    let drawSeed = 53004;
    const draws = (eyes: number[][]): void => {
        for (const [x, y, z, pitch, yaw] of eyes) ops.push(`draw ${x} ${y} ${z} ${pitch} ${yaw} ${drawSeed++}`);
    };
    // finishSeed: Math.random's first two draws in FinishBuild are the hue and lightness jitter.
    const lumbridge = (under: number, offs: string, finishSeed: number): void => {
        ops.push(`offs ${offs}`, `world ${under}`);
        for (let i = 0; i < 4; i++) ops.push(`land ${i} ${under}`);
        ops.push('seed 53001');
        for (let i = 0; i < 4; i++) ops.push(`locs ${i} ${under}`);
        ops.push('pre', `seed ${finishSeed}`, `finish ${under}`, 'dump', 'fillbase');
    };

    // (A) Lumbridge from every eye, then two of them with low-detail textures.
    // Jitter +2/-2 (draws 0.862, 0.134).
    lumbridge(0, '3 -7', 1152901);
    draws(EYES);
    ops.push('hdt 0');
    draws([EYES[1], EYES[3], EYES[5]]);
    ops.push('hdt 1');

    // (B) allLevelsVisible off: buildLevel 0 with the offsets jittered past their upper clamps (+2/+2, draws 0.876,
    // 0.908), buildLevel 1 past the lower (-2/-2, draws 0.182, 0.033).
    ops.push('vis 0', 'bl 0');
    lumbridge(0, '8 16', 352973);
    draws([EYES[0], EYES[3]]);
    ops.push('bl 1');
    lumbridge(0, '-8 -16', 7852298);
    draws([EYES[2], EYES[6]]);
    ops.push('vis 1', 'bl 0');

    // (C) An instanced region: seeded templates over the four squares (wj.a's ground loop, then jh.a's loc loop).
    let s = 530;
    const rnd = (n: number): number => {
        s = (Math.imul(s, 1103515245) + 12345) | 0;
        return ((s >>> 16) & 0x7fff) % n;
    };
    const chunks: (Chunk | null)[][][] = [];
    for (let level = 0; level < 4; level++) {
        chunks.push([]);
        for (let cx = 0; cx < 13; cx++) {
            chunks[level].push([]);
            for (let cz = 0; cz < 13; cz++) {
                const present = rnd(10) < (level === 0 ? 8 : 3);
                const square = rnd(4);
                const sx = rnd(8);
                const sz = rnd(8);
                const sourceLevel = level === 0 ? (rnd(4) === 0 ? 1 : 0) : rnd(3) === 0 ? rnd(4) : level;
                const rotation = rnd(4);
                chunks[level][cx].push(present ? { square, sx, sz, sourceLevel, rotation } : null);
            }
        }
    }
    ops.push('offs 0 0', 'world 0');
    for (let level = 0; level < 4; level++) {
        for (let cx = 0; cx < 13; cx++) {
            for (let cz = 0; cz < 13; cz++) {
                const c = chunks[level][cx][cz];
                if (c === null) ops.push(`clear ${cx} ${cz} ${level}`);
                else ops.push(`rland ${level} ${cx} ${cz} ${c.square} ${c.sx} ${c.sz} ${c.sourceLevel} ${c.rotation} 0`);
            }
        }
    }
    ops.push('seed 53011');
    for (let level = 0; level < 4; level++) {
        for (let cx = 0; cx < 13; cx++) {
            for (let cz = 0; cz < 13; cz++) {
                const c = chunks[level][cx][cz];
                if (c !== null) ops.push(`rlocs ${level} ${cx} ${cz} ${c.square} ${c.sx} ${c.sz} ${c.sourceLevel} ${c.rotation} 0`);
            }
        }
    }
    // Jitter +1/-1 (draws 0.689, 0.332).
    ops.push('pre', 'seed 1252892', 'finish 0', 'dump', 'fillbase');
    draws([
        [6600, -1600, 6600, 320, 0],
        [4000, -1300, 9000, 260, 1300],
        [9000, -1100, 3000, 200, 600]
    ]);

    // (D) The underwater build.
    // FinishBuild draws no jitter underwater (the seed would give 0/+2).
    lumbridge(1, '-5 9', 2852748);
    draws([EYES[0], EYES[3]]);

    // (E) Lumbridge ground without its locs: minusedlevel is still 99 when FinishBuild runs, no shadows, walls or
    // shared light.
    ops.push('offs 0 0', 'world 0');
    for (let i = 0; i < 4; i++) ops.push(`land ${i} 0`);
    ops.push('seed 53003', 'finish 0', 'dump', 'fillbase');
    draws([EYES[2]]);

    // (F) The land-only squares in the same 2 x 2 layout, the offsets jittered to their lower clamps (-2/-2): the dark
    // underlay and overlay colours clamp at lightness 0 and the secondary colours replace the overlay minimap colour.
    ops.push('offs -8 -16', 'world 0');
    for (let i = 4; i < 8; i++) ops.push(`land ${i} 0`);
    ops.push('seed 7852298', 'finish 0', 'dump', 'fillbase');
    draws([
        [3300, -1400, 3300, 300, 0],
        [9800, -1400, 3300, 300, 600],
        [3300, -1400, 9800, 300, 1200],
        [9800, -1400, 9800, 300, 1800]
    ]);

    // (G) An instanced tower: the castle chunks of m50_50 (chunks 0..3 x 0..3, source level 0) stacked on all four
    // levels, unrotated at chunks 2..5 and turned once at 7..10, so wall and floor runs reach from level 0 to level 3;
    // and the castle on its own levels, turned once, at chunks 7..10 x 1..4.
    ops.push('offs 2 -3', 'world 0');
    const tower = (level: number, cx: number, cz: number): string | null => {
        if (cx >= 2 && cx < 6 && cz >= 2 && cz < 6) return `${level} ${cx} ${cz} 3 ${cx - 2} ${cz - 2} 0 0 0`;
        if (cx >= 7 && cx < 11 && cz >= 7 && cz < 11) return `${level} ${cx} ${cz} 3 ${10 - cz} ${cx - 7} 0 1 0`;
        // The castle on its own levels (shorter walls upstairs), turned once: its x walls become z walls.
        if (cx >= 7 && cx < 11 && cz >= 1 && cz < 5) return `${level} ${cx} ${cz} 3 ${cz - 1} ${10 - cx} ${level} 1 0`;
        return null;
    };
    for (let level = 0; level < 4; level++) {
        for (let cx = 0; cx < 13; cx++) {
            for (let cz = 0; cz < 13; cz++) {
                const t = tower(level, cx, cz);
                ops.push(t === null ? `clear ${cx} ${cz} ${level}` : `rland ${t}`);
            }
        }
    }
    ops.push('seed 53021');
    for (let level = 0; level < 4; level++) {
        for (let cx = 0; cx < 13; cx++) {
            for (let cz = 0; cz < 13; cz++) {
                const t = tower(level, cx, cz);
                if (t !== null) ops.push(`rlocs ${t}`);
            }
        }
    }
    ops.push('pre', 'seed 1252892', 'finish 0', 'dump', 'fillbase');
    draws([
        [2000, -2600, 2000, 300, 1800],
        [5800, -2600, 5800, 300, 768],
        [8500, -3000, 8500, 380, 200]
    ]);
    return ops;
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

// dc.<clinit> (scene-render.test.ts's pix3dClinit).
function pix3dClinit(sin: Int32Array, cos: Int32Array): Statics {
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

// kb.<clinit> (scene-render.test.ts's groundClinit).
function groundClinit(): Statics {
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

const rows2 = (count: number, length: number): Int32Array[] => Array.from({ length: count }, () => new Int32Array(length));

// fc.<clinit> (provider-locanim.test.ts's modelLitImplClinit): the CopyForAnim scratch models and the draw scratch.
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
        tmpPriorityFaces: rows2(12, 4096),
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
        tmpDepthFaces: rows2(1600, 64),
        tmpExtendedDepthFaceCount: new Int32Array(32),
        tmpExtendedDepthFaces: rows2(32, 512),
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

function resets(): StaticReset[] {
    const { sin, cos } = sinCos();
    const nulls = <T>(n: number): (T | null)[] => new Array<T | null>(n).fill(null);
    return [
        { target: world, clinit: worldClinit() },
        // aj/tb/sb/je/qe/ka/ib/lg/ti/ke/t/tf/vk/li/lc <clinit>: tb.t allocated, the rest unset; buildLevel 0, minusedlevel 99.
        // ki.X/si.u draw Math.random in <clinit>; the script sets both before every build. placeLocation is the TS hook.
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
                m_tot: null,
                m_hueOff: 0,
                m_ligOff: 0,
                placeLocation: null
            }
        },
        // rj.l, lf.i, lf.j, rf.x, dd.u.
        { target: Preferences, clinit: { allLevelsVisible: true, showGroundDecorations: true, highDetailTextures2: true, sceneryShadows: 2, areaSoundVolume: 127 } },
        // hh.kb; ag.l, ff.J, uh.Q, u.r, gk.e, pi.o.
        {
            target: Client,
            clinit: {
                loopCycle: 0,
                soundEffectCount: 0,
                soundEffectIds: new Int32Array(50),
                soundEffectLoops: new Int32Array(50),
                soundEffectDelays: new Int32Array(50),
                soundEffectPositions: new Int32Array(50),
                soundEffects: nulls(50)
            }
        },
        { target: GameVariant, clinit: { id: 0 } },
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
        { target: SeqType, clinit: { m_pConfigClient: null, m_recentUse: new LRUHashCache(64), forceTween: false } },
        { target: VarBitType, clinit: { m_pConfigClient: null, m_recentUse: new LRUHashCache(64) } },
        // uk.d, ef.K, gl.x; of's frame decoder scratch.
        { target: AnimFrameSet, clinit: { cache: new LRUHashCache(100), basesArchive: null, framesArchive: null } },
        {
            target: AnimFrame,
            clinit: { tempTz: new Int16Array(500), tempTi: new Int16Array(500), tempTx: new Int16Array(500), tempFlags: new Uint8Array(500), tempPrevOrigin: new Int16Array(500), tempTy: new Int16Array(500) }
        },
        // ik.V, b.J, vk.gb, ik.U; aj.ec, vj.h.
        { target: FloType, clinit: { m_pConfigClient: null, count: 0, m_defaultWater: 0, m_list: new LRUHashCache(64) } },
        { target: FluType, clinit: { m_pConfigClient: null, m_list: new LRUHashCache(64) } },
        { target: ClientVarCache, clinit: { m_var: new Int32Array(2500) } },
        { target: AreaSoundManager, clinit: { locs: new SharedPtrList() } },
        { target: ClientLocAnim, clinit: { defaultShadow: null } },
        // vc.J and ce.K; pj.P, rd.a, ij.d.
        { target: Js5, clinit: { strictValidation: false, maxContainerSize: 0 } },
        { target: ByteArrayCopier, clinit: { directBufferUnavailable: false } },
        { target: BZip2Decompressor, clinit: { state: new BZip2State(), block: null } },
        // dc, td, kb, cb (the share maps and tic, cb.D/cb.cb aliasing dc.g/dc.l), fc and nd's statics.
        { target: Pix3D, clinit: pix3dClinit(sin, cos) },
        PIX2D(),
        { target: Ground, clinit: groundClinit() },
        { target: ModelUnlit, clinit: { shareMap: new Int32Array(10000), shareMap2: new Int32Array(10000), shareTic: 0, sin, cos } },
        { target: ModelLitImpl, clinit: modelLitImplClinit() },
        { target: ModelLit, clinit: { pickedCount: 0, checkHover: false, pickedTypecodes: new BigInt64Array(1000), mouseY: 0 } },
        // The texture cache's statics (texture-cache.test.ts's resets).
        { target: Texture, clinit: { animBuffer: null } },
        { target: ProceduralTexture, clinit: { gammaTable: new Int32Array(256), tableBrightness: -1.0 } },
        {
            target: TextureOp,
            clinit: {
                width: 0,
                height: 0,
                widthMask: 0,
                heightMask: 0,
                sizeScale: 0,
                normalisedX: null,
                normalisedY: null,
                sinTable: null,
                cosine: null,
                permutationCache: new LruHashTable(16),
                textureProvider: null
            }
        },
        { target: TextureOpSprite, clinit: { spriteGroupId: -1, spriteArchive: null } },
        { target: TextureOpKaleidoscope, clinit: { sampleX: 0, sourceRow: 0 } },
        { target: TextureOpVoronoiNoise, clinit: { nearestDistance: 0, secondDistance: 0, thirdDistance: 0, fourthNearest: 0 } },
        { target: TextureShapeRaster, clinit: { raster: null, clipMinX: 0, clipMaxX: 100, clipTop: 0, clipMaxY: 100, circleWidths: null } },
        { target: ColourImageCache, clinit: { residentSentinel: new ColourImageCacheEntry(0, 0) } },
        { target: MonochromeImageCache, clinit: { dummy: new MonochromeImageCacheEntry(0, 0) } },
        SPRITE_LOADER()
    ];
}

// Splits an output into its per-operation blocks.
function blocks(lines: string[]): string[][] {
    const out: string[][] = [];
    for (const line of lines) {
        if (line.startsWith('@')) out.push([]);
        if (out.length === 0) throw new Error(`output before the first header: ${line.slice(0, 200)}`);
        out[out.length - 1].push(line);
    }
    return out;
}

test('ClientBuild.FinishBuild and the native scene build match al.a in client.jar on real Lumbridge and instanced map squares', () => {
    const script = generate();
    const java = runOracle(script);
    const savedSeed = (mathRandom as unknown as { seed: bigint }).seed;
    let ts: string[] = [];
    try {
        ts = withClinitStatics(resets(), () => {
            world.drawTileQueue.clear();
            try {
                return runTs(script);
            } finally {
                world.drawTileQueue.clear();
                ids = new Map();
                printedModels.clear();
                preModels = [];
                referenced.length = 0;
                clip = [];
                land = [];
                locs = [];
                out = [];
            }
        });
    } finally {
        mathRandom.setSeed(savedSeed ^ 0x5deece66dn);
    }

    if (process.env.SBG_DUMP) {
        writeFileSync(`${process.env.SBG_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.SBG_DUMP}.java`, java.join('\n') + '\n');
        writeFileSync(`${process.env.SBG_DUMP}.ts`, ts.join('\n') + '\n');
    }

    const want = blocks(java);
    const got = blocks(ts);
    expect(want.length).toBe(script.length);
    expect(got.length).toBe(script.length);
    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 6; i++) {
        const w = want[i];
        const g = got[i];
        for (let k = 0; k < Math.max(w.length, g.length) && mismatches.length < 6; k++) {
            const a = w[k] ?? '<missing>';
            const c = g[k] ?? '<missing>';
            if (a === c) continue;
            let at = 0;
            while (at < a.length && a[at] === c[at]) at++;
            const from = Math.max(0, at - 160);
            mismatches.push(`#${i} ${script[i]} line ${k}/${w.length} (ts ${g.length})\n  java: ...${a.slice(from, at + 240)}\n  ts:   ...${c.slice(from, at + 240)}`);
            break;
        }
    }
    expect(mismatches).toEqual([]);

    // The script reaches what it claims to (read from the jar's output).
    const ops = (name: string): number[] => script.flatMap((line, i) => (line.split(' ')[0] === name ? [i] : []));
    const results = ops('finish').map(i => want[i]);
    for (const block of results) expect(block[block.length - 1]).toBe('= ok');
    const grounds = results.map(block => block.filter(line => line.startsWith('G ')).length);
    // A: every visible Lumbridge tile; B: fewer at buildLevel 0 and far fewer at 1 (the low-detail skip); C: the
    // instanced chunks; D: the one underwater level; E: A's tiles again without locs; F: the four land-only squares.
    expect(grounds[0]).toBeGreaterThan(10000);
    expect(grounds[1]).toBeLessThan(grounds[0]);
    expect(grounds[2]).toBeLessThan(grounds[1] / 4);
    expect(grounds[2]).toBeGreaterThan(500);
    expect(grounds[3]).toBeGreaterThan(5000);
    expect(grounds[4]).toBeGreaterThan(5000);
    expect(grounds[5]).toBe(grounds[0]);
    expect(grounds[6]).toBeGreaterThan(10000);
    expect(grounds[7]).toBeGreaterThan(3000);
    // Shaped (textured and coloured) overlays, plain underlays, and overlay-only tiles.
    const lumbridge = results[0].filter(line => line.startsWith('G ')).map(line => line.split(' ').slice(1).map(Number));
    expect(lumbridge.filter(g => g[3] > 1 && g[5] >= 0).length).toBeGreaterThan(50);
    expect(lumbridge.filter(g => g[3] > 1 && g[5] < 0).length).toBeGreaterThan(50);
    expect(lumbridge.filter(g => g[3] === 0).length).toBeGreaterThan(5000);
    const dumps = ops('dump').map(i => want[i]);
    // The jittered m_hueOff/m_ligOff: every jitter value of both draws and all four clamps (D, underwater, has none).
    const offsets = dumps.map(d => (d.find(line => line.startsWith('Z ')) ?? '').split(' ').slice(1, 4).join(' '));
    expect(offsets).toEqual(['0 5 -9', '0 8 16', '1 -8 -16', '0 1 -1', '0 -5 9', '0 -1 1', '0 -8 -16', '0 3 -4']);
    // Occluders of all three types, ShareLight's lit copies and merged normals, PushDown links, collision rows.
    const occluderTypes = new Set(dumps[0].filter(line => line.startsWith('Q')).map(line => line.split(',')[3]));
    expect([...occluderTypes].sort()).toEqual(['1', '2', '4']);
    expect(dumps[0].filter(line => line.startsWith('V')).length).toBeGreaterThan(200);
    expect(dumps[0].filter(line => line.startsWith('Xfc')).length).toBeGreaterThan(200);
    expect(dumps[0].filter(line => line.startsWith('SM') && line.includes(',L(')).length).toBeGreaterThan(10);
    expect(dumps[3].filter(line => line.startsWith('Q')).length).toBeGreaterThan(5);
    // Most frames show the scene.
    const frames = ops('draw').map(i => want[i].find(line => line.startsWith('P ')) ?? 'P 0 0');
    expect(frames.filter(line => Number(line.split(' ')[2]) > 100000).length).toBeGreaterThan(frames.length / 2);
    // highDetailTextures2 off redraws three eyes that see textured ground (the river, paths) with average colours.
    expect(frames[8]).not.toBe(frames[1]);
    expect(frames[9]).not.toBe(frames[3]);
    expect(frames[10]).not.toBe(frames[5]);
}, 600000);
