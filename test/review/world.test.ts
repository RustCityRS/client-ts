import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Decor from '../../src/dash3d/Decor.js';
import Ground from '../../src/dash3d/Ground.js';
import GroundDecor from '../../src/dash3d/GroundDecor.js';
import GroundObject from '../../src/dash3d/GroundObject.js';
import ModelSource from '../../src/dash3d/ModelSource.js';
import Occlude from '../../src/dash3d/Occlude.js';
import type ParticleSystem from '../../src/dash3d/ParticleSystem.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import Sprite from '../../src/dash3d/Sprite.js';
import type Square from '../../src/dash3d/Square.js';
import type TextureProvider from '../../src/dash3d/TextureProvider.js';
import Wall from '../../src/dash3d/Wall.js';
import world from '../../src/dash3d/world.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import Preferences from '../../src/ui/Preferences.js';
import { gamepackPath } from '../reference.js';

// The scene graph (src/dash3d/world.ts) against the real statics of client.jar. A seeded script builds scenes
// (both with and without the underwater layer) through every Set*/Add* routine, then interleaves full scene draws
// (world.draw -> CalcOcclude -> Render -> Fill -> renderQuickGround/drawTileOverlay/model draws) from many eye
// positions with mouse picking, roof hiding and hidden-roof areas, the occlusion and visibility queries, Get*/Del*/
// typecode lookups, dynamic sprites, light sharing, PushDown, the minimap block renderer and edge cases that throw.
// Directed parts add a field of textured plain/shaped tiles drawn in both texture detail levels, and one occluder of
// each mode (1..5) selected by the eye, with world.Occluded swept one unit at a time across every projected bound
// and the ground/wall/sprite occlusion tests run on every tile. (Mutating a >= to > in Occluded, or swapping two
// texture-basis arguments in renderQuickGround, makes this test fail.)
// test/review/world/WorldOracle.java runs the same script on the jar, compiled into its unnamed package so it can
// subclass ug: after every operation both sides print the result (or the Java exception) and the ordered log of every
// call made into the test models (draw/update/getMinY/isUnlit/light/mergeNormals, with all arguments) and into the
// texture provider. A draw also logs the hash of the framebuffer; a dump hashes every square of both layers (all
// fields, entities and sprites) and lists the scene statics, occluders and the visibility/occlusion caches.

const W = 128;
const H = 96;

const log: string[] = [];
const call = (token: string): void => {
    log.push(token);
};

class TM extends ModelSource {
    readonly unlit: boolean;
    readonly minY: number;

    constructor(readonly id: number) {
        super();
        this.unlit = id < 1000 && id % 3 === 0;
        this.minY = id % 7 === 0 ? -32768 : -((id * 37) % 400);
    }

    draw(yaw: number, sinPitch: number, cosPitch: number, sinYaw: number, cosYaw: number, x: number, y: number, z: number, typecode: bigint, level: number, particles: ParticleSystem | null): void {
        call(`D${this.id},${yaw},${sinPitch},${cosPitch},${sinYaw},${cosYaw},${x},${y},${z},${typecode},${level},${particles === null ? 0 : 1}`);
    }

    getMinY(): number {
        call(`B${this.id}`);
        return this.minY;
    }

    update(arg0: number, arg1: number, arg2: number, arg3: number, arg4: number): void {
        call(`U${this.id},${arg0},${arg1},${arg2},${arg3},${arg4}`);
    }

    override isUnlit(): boolean {
        call(`A${this.id}`);
        return this.unlit;
    }

    override light(x: number, y: number, z: number): ModelSource {
        call(`L${this.id},${x},${y},${z}`);
        return new TM(this.id + 1000);
    }

    override mergeNormals(other: ModelSource, x: number, y: number, z: number, hide: boolean): void {
        call(`M${this.id},${(other as TM).id},${x},${y},${z},${hide ? 1 : 0}`);
    }
}

function texel(id: number, index: number): number {
    return (Math.imul(id, 0x45d9f3b) + Math.imul(index, 0x119de1f3)) ^ (index >>> 3);
}

function texturePixels(id: number): Int32Array | null {
    if (id % 5 === 4) return null;
    return Int32Array.from({ length: id % 2 === 0 ? 4096 : 16384 }, (_, i) => texel(id, i));
}

const provider: TextureProvider = {
    getTextureSmall(id: number): boolean {
        call(`Ls${id}`);
        return id % 2 === 0;
    },
    isAvailable(id: number): boolean {
        call(`Av${id}`);
        return true;
    },
    getPixels(id: number): Int32Array | null {
        call(`Gp${id}`);
        return texturePixels(id);
    },
    isLoaded(id: number): boolean {
        call(`Ld${id}`);
        return true;
    },
    getTextureData(id: number): Int32Array | null {
        call(`P${id}`);
        return texturePixels(id);
    },
    getTextureColour(id: number): number {
        call(`V${id}`);
        return (id * 911) & 0xffff;
    },
    getTextureSolid(id: number): boolean {
        call(`O${id}`);
        return id % 3 !== 0;
    }
};

const model = (id: number): ModelSource | null => (id < 0 ? null : new TM(id));
const mid = (m: ModelSource | null): string => (m === null ? '-' : String((m as TM).id));

function desc(o: unknown): string {
    if (o === null || o === undefined) return 'null';
    if (o instanceof Wall) return `W${o.typecode},${o.x},${o.y},${o.z},${mid(o.model1)},${mid(o.model2)},${o.angle1},${o.angle2}`;
    if (o instanceof Decor) return `N${o.typecode},${o.x},${o.y},${o.z},${mid(o.model)},${mid(o.model2)},${o.wshape},${o.angle},${o.offsetX},${o.offsetZ}`;
    if (o instanceof GroundDecor) return `G${o.typecode},${o.x},${o.y},${o.z},${mid(o.model)}`;
    if (o instanceof GroundObject) return `O${o.typecode},${o.x},${o.y},${o.z},${o.height},${mid(o.topObj)},${mid(o.middleObj)},${mid(o.bottomObj)}`;
    if (o instanceof Sprite) {
        return `S${o.typecode},${o.level},${o.x},${o.y},${o.z},${o.yaw},${o.minTileX},${o.minTileZ},${o.maxTileX},${o.maxTileZ},${o.cycle},${o.distance},${mid(o.model)}`;
    }
    if (o instanceof Occlude) {
        return `C${o.type},${o.mode},${o.minTileX},${o.maxTileX},${o.minTileZ},${o.maxTileZ},${o.minX},${o.maxX},${o.minZ},${o.maxZ},${o.minY},${o.maxY},${o.minDeltaZ},${o.maxDeltaZ},${o.minDeltaY},${o.maxDeltaY},${o.minDeltaX},${o.maxDeltaX}`;
    }
    throw new Error('desc');
}

function square(r: Square | null): string {
    if (r === null) return 'n';
    let s = `${r.level},${r.originalLevel},${r.x},${r.z},${r.spriteCount},${r.spriteSpans}`;
    for (let i = 0; i < 5; i++) s += `,${r.spriteSpan[i]}`;
    s += `,${r.drawFront ? 1 : 0}${r.drawBack ? 1 : 0}${r.drawSprites ? 1 : 0}`;
    s += `,${r.cornerSides},${r.sidesBeforeCorner},${r.sidesAfterCorner},${r.backWallTypes}`;
    s += `,g${r.ground === null ? '-' : `${r.ground.shape}/${r.ground.rotation}`}`;
    const q = r.quickGround;
    s += `,q${q === null ? '-' : `${q.colourSW}/${q.colourSE}/${q.colourNE}/${q.colourNW}/${q.texture}/${q.minimapRgb}/${q.flat ? 1 : 0}`}`;
    s += `,${desc(r.wall)},${desc(r.decor)},${desc(r.groundDecor)},${desc(r.groundObject)}`;
    s += ',H[';
    for (let i = 0; i < 5; i++) s += `${desc(r.sprites[i])};`;
    s += ']';
    const l = r.linkedSquare;
    s += `,L${l === null ? '-' : `${l.level}/${l.x}/${l.z}${l.quickGround !== null ? 'q' : ''}${l.ground !== null ? 'k' : ''}`}`;
    return s;
}

// java.lang.String.hashCode
function stringHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
}

function squaresHash(squares: (Square | null)[][][] | null): number {
    if (squares === null) return -1;
    const parts: string[] = [];
    for (const plane of squares) for (const row of plane) for (const r of row) parts.push(square(r), '\n');
    return stringHash(parts.join(''));
}

function hash(values: ArrayLike<number> | null): number {
    if (values === null) return -1;
    let h = 0;
    for (let i = 0; i < values.length; i++) h = (Math.imul(31, h) + values[i]) | 0;
    return h;
}

function hash2(values: ArrayLike<number>[] | null): number {
    if (values === null) return -1;
    let h = 0;
    for (const row of values) h = (Math.imul(31, h) + hash(row)) | 0;
    return h;
}

function hash3(values: ArrayLike<number>[][] | null): number {
    if (values === null) return -1;
    let h = 0;
    for (const plane of values) h = (Math.imul(31, h) + hash2(plane)) | 0;
    return h;
}

function hashBool(values: boolean[][] | null): number {
    if (values === null) return -1;
    let h = 0;
    for (const row of values) for (const v of row) h = (Math.imul(31, h) + (v ? 1 : 0)) | 0;
    return h;
}

function statics(): string {
    const w = world;
    let s = `${w.fillLeft} ${w.dynamicCount} ${w.cycleNo}`;
    s += ` e${w.cx},${w.cy},${w.cz},${w.gx},${w.eyeTileZ}`;
    s += ` b${w.minX},${w.maxX},${w.minZ},${w.maxZ}`;
    s += ` c${w.cameraSinX},${w.cameraCosX},${w.cameraSinY},${w.cameraCosY}`;
    s += ` p${w.takingInput ? 1 : 0},${w.clickLevel},${w.clickX},${w.clickY},${w.groundX},${w.groundZ}`;
    s += ` l${w.maxLevel},${w.minLevel},${w.squares === null ? 'n' : w.squares === w.mainLevelTiles ? 'm' : w.squares === w.underwaterSquares ? 'u' : '?'}`;
    s += `,${w.levelHeightmaps === null ? 'n' : w.levelHeightmaps === w.mainGroundh ? 'm' : w.levelHeightmaps === w.underwaterHeightmap ? 'u' : '?'}`;
    s += ` s${w.viewRadius},${w.maxTileX},${w.maxTileZ}`;
    s += ` o${w.numOccluders},${w.numActiveOccluders}`;
    const occluders = w.occluders;
    for (let i = 0; i < w.numOccluders && occluders !== null && i < occluders.length; i++) s += ` ${desc(occluders[i])}`;
    s += ' a';
    for (let i = 0; i < w.numActiveOccluders; i++) {
        let index = -1;
        for (let j = 0; j < w.numOccluders; j++) if (occluders !== null && w.activeOccluders !== null && occluders[j] === w.activeOccluders[i]) index = j;
        s += `,${index}`;
    }
    s += ` h${hashBool(w.visibilityMap)},${hashBool(w.cornerVisibility)},${hash3(w.levelTileOcclusionCycles)},${hash2(w.waterSpriteKeys)}`;
    s += `,${hash3(w.mainGroundh)},${hash3(w.underwaterHeightmap)}`;
    s += ' d';
    const dynamic = w.dynamicSprites;
    if (dynamic !== null) for (let i = 0; i <= w.dynamicCount && i < dynamic.length; i++) s += `${desc(dynamic[i])};`;
    s += ' v';
    const buffer = w.spriteBuffer;
    if (buffer !== null) for (const sprite of buffer) s += sprite === null ? '-' : `s${sprite.distance}`;
    s += ` x${Pix3D.trans},${Pix3D.hclip ? 1 : 0}`;
    s += ` q${w.drawTileQueue.sentinel.next === w.drawTileQueue.sentinel ? 'empty' : 'busy'}`;
    return s;
}

let roofs: Uint8Array[][] | null = null;
const r2d = new Int32Array(64 * 64);

function hideAreas(variant: number): (Int32Array | null)[] {
    if (variant === 0) return [null, null, null, null, null];
    if (variant === 1) {
        return [Int32Array.of(-1000000, -200, -1000000), Int32Array.of(0, 256, 0), Int32Array.of(0, 900, 0), Int32Array.of(0, 1200, 0), Int32Array.of(0, 128, 0)];
    }
    return [Int32Array.of(-100, 50), Int32Array.of(640, -5000), Int32Array.of(1600, 5000), Int32Array.of(1800, 5000), Int32Array.of(256, -5000)];
}

function runOp(op: string, n: number[], a: bigint[]): string {
    const b = (i: number): boolean => n[i] !== 0;
    switch (op) {
        case 'fb': {
            Pix2D.pixels = new Int32Array(n[0] * n[1]);
            Pix2D.width = n[0];
            Pix2D.height = n[1];
            Pix2D.clipMinX = 0;
            Pix2D.clipMinY = 0;
            Pix2D.clipMaxX = n[0];
            Pix2D.clipMaxY = n[1];
            Pix3D.setRenderClipping();
            const colours = new Int32Array(65536);
            for (let i = 0; i < colours.length; i++) colours[i] = Math.imul(i, 0x9e3779b1 | 0) ^ (i << 7);
            Pix3D.colourTable = colours;
            Pix3D.textureProvider = provider;
            return 'ok';
        }
        case 'tex':
            Preferences.highDetailTextures2 = b(0);
            return 'ok';
        case 'init':
            world.init(n[0], n[1], n[2], n[3], b(4));
            return 'ok';
        case 'hm': {
            const seed = n[0];
            const main = world.mainGroundh;
            if (main === null) throw new TypeError('Null reference');
            for (let level = 0; level < main.length; level++) for (let x = 0; x < main[level].length; x++) for (let z = 0; z < main[level][x].length; z++) main[level][x][z] = -(((x * 13 + z * 7 + seed) % 5) * 40) - level * 240;
            const under = world.underwaterHeightmap;
            if (under !== null) for (let x = 0; x < under[0].length; x++) for (let z = 0; z < under[0][x].length; z++) under[0][x][z] = -(((x * 11 + z * 5 + seed) % 4) * 30) + 100;
            return 'ok';
        }
        case 'roofs':
            roofs = Array.from({ length: n[0] }, (_, level) => Array.from({ length: n[1] }, (_, x) => Uint8Array.from({ length: n[2] }, (_, z) => ((x * 7 + z * 3 + level) % 5) - 1)));
            return 'ok';
        case 'reset':
            world.ResetMap();
            return 'ok';
        case 'under':
            world.setUnderwater(b(0));
            return 'ok';
        case 'fbl':
            world.FillBaseLevel(n[0]);
            return 'ok';
        case 'push':
            world.PushDown(n[0], n[1]);
            return 'ok';
        case 'occ':
            world.SetOcclude(n[0], n[1], n[2], n[3], n[4], n[5], n[6]);
            return 'ok';
        case 'ground':
            world.SetGround(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], n[10], n[11], n[12], n[13], n[14], n[15], n[16], n[17], n[18], n[19]);
            return 'ok';
        case 'gd':
            world.SetGroundDecor(n[0], n[1], n[2], n[3], model(n[4]), a[5], b(6));
            return 'ok';
        case 'obj':
            world.SetObj(n[0], n[1], n[2], n[3], model(n[4]), a[5], model(n[6]), model(n[7]));
            return 'ok';
        case 'wall':
            world.SetWall(n[0], n[1], n[2], n[3], model(n[4]), model(n[5]), n[6], n[7], a[8]);
            return 'ok';
        case 'decor':
            world.SetDecor(n[0], n[1], n[2], n[3], model(n[4]), model(n[5]), n[6], n[7], n[8], n[9], a[10]);
            return 'ok';
        case 'scen':
            return String(world.AddScenery(n[0], n[1], n[2], n[3], n[4], n[5], model(n[6]), n[7], a[8]));
        case 'dyn':
            return String(world.AddDynamic(n[0], n[1], n[2], n[3], n[4], model(n[5]), n[6], a[7], b(8)));
        case 'dyn2':
            return String(world.AddDynamic2(n[0], n[1], n[2], n[3], model(n[4]), n[5], a[6], n[7], n[8], n[9], n[10]));
        case 'spr':
            return String(world.SetSprite(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], model(n[8]), n[9], b(10), a[11]));
        case 'rmspr':
            world.RemoveSprites();
            return 'ok';
        case 'movedecor':
            world.MoveDecor(n[0], n[1], n[2], n[3]);
            return 'ok';
        case 'delwall':
            return desc(world.DelWall(n[0], n[1], n[2]));
        case 'deldecor':
            return desc(world.DelDecor(n[0], n[1], n[2]));
        case 'delloc':
            return desc(world.DelLoc(n[0], n[1], n[2]));
        case 'delgd':
            return desc(world.DelGroundDecor(n[0], n[1], n[2]));
        case 'delobj':
            return desc(world.DelObj(n[0], n[1], n[2]));
        case 'getwall':
            return desc(world.GetWall(n[0], n[1], n[2]));
        case 'getdecor':
            return desc(world.GetDecor(n[0], n[1], n[2]));
        case 'getgd':
            return desc(world.GetGroundDecor(n[0], n[1], n[2]));
        case 'getscene':
            return desc(world.GetScene(n[0], n[1], n[2]));
        case 'walltype':
            return String(world.WallType(n[0], n[1], n[2]));
        case 'decortype':
            return String(world.DecorType(n[0], n[1], n[2]));
        case 'scenetype':
            return String(world.SceneType(n[0], n[1], n[2]));
        case 'gdtype':
            return String(world.GdType(n[0], n[1], n[2]));
        case 'hastc':
            return String(world.hasTypecode(n[0], n[1], n[2], a[3]));
        case 'sharelight':
            world.ShareLight(n[0], n[1], n[2]);
            return 'ok';
        case 'wtm':
            return String(world.wallTypeMask(n[0]));
        case 'tlc':
            return String(world.TextureLightCol(n[0], n[1]));
        case 'tri':
            return String(world.InsideTriangle(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7]));
        case 'r2d':
            r2d.fill(5);
            try {
                world.Render2DGround(r2d, n[3], n[4], n[0], n[1], n[2]);
            } finally {
                call(`r${hash(r2d)}`);
            }
            return 'ok';
        case 'r2dnull':
            world.Render2DGround(null, n[3], n[4], n[0], n[1], n[2]);
            return 'ok';
        case 'pick':
            world.updateMousePicking(n[0], n[1], n[2]);
            return 'ok';
        case 'draw': {
            const pixels = Pix2D.pixels;
            if (pixels === null) throw new TypeError('Null reference');
            pixels.fill(0);
            const hide = hideAreas(n[10]);
            try {
                world.draw(n[0], n[1], n[2], n[3], n[4], b(5) ? roofs : null, hide[0], hide[1], hide[2], hide[3], hide[4], n[6], (n[7] << 24) >> 24, n[8], n[9]);
            } finally {
                call(`fb${hash(Pix2D.pixels)}`);
            }
            return 'ok';
        }
        case 'col':
            return String(world.testColumn(n[0], n[1], n[2], n[3], n[4]));
        case 'occluded':
            return String(world.Occluded(n[0], n[1], n[2]));
        case 'gocc':
            return String(world.GroundoOcluded(n[0], n[1], n[2]));
        case 'wocc':
            return String(world.WallOccluded(n[0], n[1], n[2], n[3]));
        case 'socc':
            return String(world.SpriteOccluded(n[0], n[1], n[2], n[3]));
        case 'lvis':
            return String(world.SpriteOccluded2(n[0], n[1], n[2], n[3], n[4], n[5]));
        case 'calc':
            world.CalcOcclude();
            return 'ok';
        case 'dump':
            return `sq=${squaresHash(world.mainLevelTiles)} uw=${squaresHash(world.underwaterSquares)} ${statics()}`;
        default:
            throw new Error(`unknown op ${op}`);
    }
}

function runTs(line: string): string {
    const f = line.split(' ');
    const a = f.slice(1).map(v => BigInt(v));
    const n = a.map(v => Number(BigInt.asIntN(32, v)));
    log.length = 0;
    let result: string;
    try {
        result = runOp(f[0], n, a);
    } catch (e) {
        if (e instanceof RangeError && e.message.startsWith('array index')) result = 'aioobe';
        else if (e instanceof RangeError && e.message.startsWith('NegativeArraySizeException')) result = 'nase';
        else if (e instanceof RangeError && e.message === '/ by zero') result = 'arith';
        else if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) result = 'npe';
        else result = `error:${String(e)}`;
    }
    return `${result}|${log.map(t => ' ' + t).join('')}`;
}

// mulberry32
function rng(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return (t ^ (t >>> 14)) | 0;
    };
}

function generateScript(): string[] {
    const next = rng(5300);
    const below = (bound: number): number => (next() >>> 0) % bound;
    const range = (lo: number, hi: number): number => lo + below(hi - lo + 1);
    const pick = <T>(values: T[]): T => values[below(values.length)];
    const ops: string[] = [];
    let modelId = 1;
    const newModel = (): number => modelId++;
    const optModel = (): number => (below(6) === 0 ? -1 : newModel());

    // Typecodes: a random long, with the loc kind in bits 29-30 forced when asked; bit 22 (world.SetObj raises the obj
    // stack over such sprites) and bit 31 (Fill draws such ground decor before the walls) are left random.
    const typecode = (kind: number | null): string => {
        let low = next() >>> 0;
        if (kind !== null) low = ((low & ~0x60000000) | (kind << 29)) >>> 0;
        const high = below(3) === 0 ? next() : below(4) === 0 ? -1 : below(1000);
        return BigInt.asIntN(64, (BigInt(high) << 32n) | BigInt(low)).toString();
    };
    const SIZE = 16;
    const LEVELS = 4;

    const scene = (underwater: boolean, seed: number): void => {
        ops.push(`init ${LEVELS} ${SIZE} ${SIZE} 8 ${underwater ? 1 : 0}`);
        ops.push(`hm ${seed}`);
        ops.push('dump');
        const groundAt = (level: number, x: number, z: number): void => {
            const r = below(10);
            const shape = r < 5 ? 0 : r < 7 ? 1 : range(2, 12);
            const texture = below(3) === 0 ? range(0, 9) : -1;
            const h = range(-200, 0);
            const flat = below(3) === 0;
            const hs = flat ? [h, h, h, h] : [h, range(-200, 0), range(-200, 0), range(-200, 0)];
            const args = [level, x, z, shape, below(4), texture, ...hs];
            // 12345678 (hidden) is all four corners of the underlay or of an untextured overlay of a plain tile; a
            // single hidden corner, a hidden textured overlay (its colours are scaled by the texture average) or a
            // hidden layer of a shaped tile (whose midpoints mix the layers) would index past the colour table.
            // Corner colours of one layer stay close together, like real HSL ground; wildly different corners can
            // make the fixed-point gouraud steps overshoot the colour table on thin, steep triangles.
            for (let layer = 0; layer < 3; layer++) {
                const hidden = layer < 2 && texture === -1 && shape < 2 && below(12) === 0;
                const base = range(2000, 63000);
                for (let i = 0; i < 4; i++) args.push(hidden ? 12345678 : base + range(-40, 40));
            }
            args.push(below(4) === 0 ? 0 : next(), below(4) === 0 ? 0 : next());
            ops.push(`ground ${args.join(' ')}`);
        };
        for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) if (below(12) !== 0) groundAt(0, x, z);
        for (let level = 1; level < LEVELS; level++) for (let n = 0; n < 24; n++) groundAt(level, below(SIZE), below(SIZE));
        if (underwater) {
            ops.push('under 1');
            for (let n = 0; n < 60; n++) groundAt(0, below(SIZE), below(SIZE));
            for (let n = 0; n < 12; n++) ops.push(`scen 0 ${below(SIZE)} ${below(SIZE)} ${range(-100, 0)} ${range(1, 2)} ${range(1, 2)} ${newModel()} ${below(2048)} ${typecode(2)}`);
            ops.push('dump', 'under 0');
        }
        // Every wall has a first model here, and a second wall-type mask only with a second model (Fill and ShareLight
        // dereference them); the edge cases below cover a wall with only a second model.
        for (let n = 0; n < 120; n++) {
            const level = below(5) === 0 ? range(1, 3) : 0;
            const model2 = below(3) === 0 ? newModel() : -1;
            ops.push(`wall ${level} ${below(SIZE)} ${below(SIZE)} ${range(-200, 0)} ${newModel()} ${model2} ${pick([1, 2, 4, 8, 16, 32, 64, 128])} ${model2 < 0 ? 0 : pick([1, 2, 4, 8])} ${typecode(0)}`);
        }
        for (let n = 0; n < 90; n++) {
            ops.push(
                `decor ${below(4) === 0 ? range(1, 3) : 0} ${below(SIZE)} ${below(SIZE)} ${range(-200, 0)} ${below(12) === 0 ? -1 : newModel()} ${below(2) === 0 ? newModel() : -1} ${pick([1, 2, 4, 8, 16, 32, 64, 128, 256, 256, 256])} ${below(4)} ${range(-40, 40)} ${range(-40, 40)} ${typecode(1)}`
            );
        }
        for (let n = 0; n < 90; n++) ops.push(`gd ${below(4) === 0 ? range(1, 3) : 0} ${below(SIZE)} ${below(SIZE)} ${range(-200, 0)} ${optModel()} ${typecode(3)} ${below(2)}`);
        for (let n = 0; n < 80; n++) {
            ops.push(`scen ${below(4) === 0 ? range(1, 3) : 0} ${range(-1, SIZE)} ${range(-1, SIZE)} ${range(-200, 0)} ${range(1, 3)} ${range(1, 3)} ${optModel()} ${below(2048)} ${typecode(2)}`);
        }
        for (let n = 0; n < 60; n++) {
            ops.push(`obj ${below(4) === 0 ? range(1, 3) : 0} ${below(SIZE)} ${below(SIZE)} ${range(-200, 0)} ${optModel()} ${typecode(0)} ${optModel()} ${optModel()}`);
        }
        // Occluders: wall planes (types 1 and 2) from about storey height down to the ground, and roof planes (type 4)
        // that are either high above every eye (never selected) or low enough to hide what is under them.
        for (let n = 0; n < 10; n++) {
            const type = pick([1, 2, 4]);
            const tx = below(SIZE) * 128;
            const tz = below(SIZE) * 128;
            const span = range(1, 2) * 128;
            const y0 = range(-420, -250);
            const y1 = range(-150, 0);
            if (type === 1) ops.push(`occ 1 ${tx} ${tx} ${tz} ${tz + span} ${y0} ${y1}`);
            else if (type === 2) ops.push(`occ 2 ${tx} ${tx + span} ${tz} ${tz} ${y0} ${y1}`);
            else {
                const y = below(2) === 0 ? -1300 : y0;
                ops.push(`occ 4 ${tx} ${tx + 128} ${tz} ${tz + 128} ${y} ${y}`);
            }
        }
        for (let n = 0; n < 4; n++) ops.push(`push ${below(SIZE)} ${below(SIZE)}`);
        ops.push('fbl 0', 'dump', `sharelight ${range(-60, -10)} ${range(-80, -10)} ${range(-60, -10)}`, 'dump');
        for (let n = 0; n < 20; n++) ops.push(`r2d ${below(LEVELS)} ${below(SIZE)} ${below(SIZE)} ${below(60) * 64 + below(60)} 64`);
        ops.push('r2d 0 3 3 4093 64', 'r2d 0 3 3 -1 64', 'r2dnull 0 3 3 0 64');

        for (let frame = 0; frame < 60; frame++) {
            if (below(2) === 0) ops.push(`pick ${below(LEVELS)} ${range(-W / 2, W / 2)} ${range(-H / 2, H / 2)}`);
            for (let n = 0; n < 3; n++) {
                ops.push(`dyn ${below(LEVELS)} ${range(0, SIZE * 128)} ${range(0, SIZE * 128)} ${range(-300, 0)} ${pick([60, 64, 128, 192])} ${optModel()} ${below(2048)} ${typecode(below(4))} ${below(2)}`);
            }
            if (below(3) === 0) ops.push(`dyn2 ${below(LEVELS)} ${range(0, SIZE * 128)} ${range(0, SIZE * 128)} ${range(-300, 0)} ${optModel()} ${below(2048)} ${typecode(0)} ${below(SIZE)} ${below(SIZE)} ${below(SIZE)} ${below(SIZE)}`);
            const fbl = frame % 9 === 8 ? 1 : 0;
            if (frame % 9 === 8 || frame % 9 === 0) ops.push(`fbl ${fbl}`);
            // Mostly eyes over the map looking down at 33-67 degrees (they draw most); some outside it or shallower.
            const outside = below(6) === 0;
            const eyeX = outside ? range(-200, SIZE * 128 + 200) : range(384, SIZE * 128 - 384);
            const eyeZ = outside ? range(-200, SIZE * 128 + 200) : range(384, SIZE * 128 - 384);
            const pitch = below(5) === 0 ? range(128, 383) : range(190, 383);
            const roof = below(3) === 0 ? 1 : 0;
            const hide = below(3);
            if (frame % 5 === 0) ops.push(`tex ${below(2)}`);
            ops.push(`draw ${eyeX} ${range(-1000, -450)} ${eyeZ} ${pitch} ${below(2048)} ${roof} ${below(4)} ${pick([-1, 0, 1, 2, 3])} ${below(SIZE)} ${below(SIZE)} ${hide}`);
            ops.push('dump');
            for (let n = 0; n < 6; n++) {
                const level = below(LEVELS);
                const x = below(SIZE);
                const z = below(SIZE);
                switch (below(7)) {
                    case 0:
                        ops.push(`gocc ${level} ${x} ${z}`);
                        break;
                    case 1:
                        ops.push(`wocc ${level} ${x} ${z} ${pick([1, 2, 4, 8, 16, 32, 64, 128, 0, 3])}`);
                        break;
                    case 2:
                        ops.push(`socc ${level} ${x} ${z} ${range(-300, 0)}`);
                        break;
                    case 3: {
                        const x1 = Math.min(SIZE - 1, x + below(3));
                        const z1 = Math.min(SIZE - 1, z + below(3));
                        ops.push(`lvis ${level} ${x} ${x1} ${z} ${z1} ${range(-300, 0)}`);
                        break;
                    }
                    case 4:
                        ops.push(`occluded ${range(0, SIZE * 128)} ${range(-800, 0)} ${range(0, SIZE * 128)}`);
                        break;
                    case 5:
                        ops.push(`col ${range(-1200, 1200)} ${range(-1500, 0)} ${range(-500, 300)} ${range(-1200, 1200)} ${pick([3500, 100, 0])}`);
                        break;
                    default:
                        ops.push(`tri ${range(-50, 50)} ${range(-50, 50)} ${range(-50, 50)} ${range(-50, 50)} ${range(-50, 50)} ${range(-50, 50)} ${range(-50, 50)} ${range(-50, 50)}`);
                }
            }
            for (let n = 0; n < 6; n++) {
                const level = below(5) === 0 ? range(1, 3) : 0;
                const x = below(SIZE);
                const z = below(SIZE);
                const which = pick(['getwall', 'getdecor', 'getgd', 'getscene', 'walltype', 'decortype', 'scenetype', 'gdtype', 'movedecor', 'delwall', 'deldecor', 'delloc', 'delgd', 'delobj', 'hastc']);
                if (which === 'movedecor') ops.push(`movedecor ${level} ${x} ${z} ${range(-32, 32)}`);
                else if (which === 'hastc') ops.push(`hastc ${level} ${x} ${z} ${typecode(below(4))}`);
                else ops.push(`${which} ${level} ${x} ${z}`);
            }
            ops.push('dump');
            if (below(2) === 0) ops.push('rmspr');
        }
        ops.push('calc', 'dump', 'reset', 'dump');
    };

    ops.push(`fb ${W} ${H}`, 'tex 1', `roofs ${LEVELS} ${SIZE} ${SIZE}`);
    scene(true, 3);
    scene(false, 4);

    // Directed: a field of textured plain tiles (half of them flat), drawn in high detail, so both texture bases of
    // renderQuickGround reach the rasterizer, then in low detail (the texture-average path).
    ops.push(`init ${LEVELS} ${SIZE} ${SIZE} 8 0`, 'hm 5');
    for (let x = 0; x < SIZE; x++) {
        for (let z = 0; z < SIZE; z++) {
            const flat = (x + z) % 2 === 0;
            const h = range(-120, -40);
            const hs = flat ? [h, h, h, h] : [h, h - 20, h + 10, h - 5];
            const texture = pick([0, 1, 2, 3, 5, 6, 7, 8]);
            const base = range(2000, 63000);
            const colours = Array.from({ length: 12 }, () => base + range(-30, 30));
            ops.push(`ground 0 ${x} ${z} ${(x * z) % 3 === 0 ? 1 : range(2, 12)} ${below(4)} ${texture} ${hs.join(' ')} ${colours.join(' ')} 0 0`);
        }
    }
    ops.push('fbl 0');
    for (const textures of [1, 0]) {
        ops.push(`tex ${textures}`);
        for (const [x, z, pitch, yaw] of [
            [1024, 1024, 383, 0],
            [1024, 400, 300, 0],
            [1600, 1024, 280, 512],
            [1024, 1700, 260, 1024],
            [400, 1024, 330, 1536],
            [700, 700, 240, 1800]
        ]) {
            ops.push(`draw ${x} -700 ${z} ${pitch} ${yaw} 0 0 0 8 8 0`, 'dump');
        }
    }
    ops.push('tex 1');

    // Directed: one occluder of each mode with the eye placed to select it, then sweeps of world.Occluded across every
    // projected bound (just past the plane, so the bounds are within a few units of the occluder's own) and the
    // ground/wall/sprite occlusion tests on every tile.
    const sweep = (fixed: (v: number) => string, from: number, to: number): void => {
        for (let v = from; v <= to; v++) ops.push(`occluded ${fixed(v)}`);
    };
    const occlusionCase = (occ: string, eye: string, sweeps: () => void): void => {
        ops.push('reset', `init ${LEVELS} ${SIZE} ${SIZE} 8 0`, 'hm 2');
        for (let x = 0; x < SIZE; x++) for (let z = 0; z < SIZE; z++) ops.push(`ground 0 ${x} ${z} 0 0 -1 0 0 0 0 30000 30010 30020 30030 0 0 0 0 0 0`);
        ops.push('fbl 0', occ, `draw ${eye} 0 0 0 8 8 0`, 'dump');
        sweeps();
        for (let x = 0; x < SIZE; x++) {
            for (let z = 0; z < SIZE; z++) {
                ops.push(`gocc 0 ${x} ${z}`, `wocc 0 ${x} ${z} ${pick([1, 2, 4, 8, 16, 32, 64, 128])}`, `socc 0 ${x} ${z} ${range(-300, 0)}`);
                if (x < SIZE - 1 && z < SIZE - 1) ops.push(`lvis 0 ${x} ${x + 1} ${z} ${z + 1} ${range(-300, 0)}`);
            }
        }
    };
    // mode 1: x plane, eye on its +x side (looking toward -x); mode 2: eye on its -x side.
    occlusionCase('occ 1 1024 1024 512 1536 -400 -40', '1424 -600 1024 220 512', () => {
        sweep(v => `1016 -220 ${v}`, 470, 1580);
        sweep(v => `1016 ${v} 1024`, -450, 10);
    });
    occlusionCase('occ 1 1024 1024 512 1536 -400 -40', '624 -600 1024 220 1536', () => {
        sweep(v => `1032 -220 ${v}`, 470, 1580);
        sweep(v => `1032 ${v} 1024`, -450, 10);
    });
    // modes 3 and 4: z plane, eye on its +z and -z side.
    occlusionCase('occ 2 512 1536 1024 1024 -400 -40', '1024 -600 1424 220 1024', () => {
        sweep(v => `${v} -220 1016`, 470, 1580);
        sweep(v => `1024 ${v} 1016`, -450, 10);
    });
    occlusionCase('occ 2 512 1536 1024 1024 -400 -40', '1024 -600 624 220 0', () => {
        sweep(v => `${v} -220 1032`, 470, 1580);
        sweep(v => `1024 ${v} 1032`, -450, 10);
    });
    // mode 5: a horizontal plane under the eye.
    occlusionCase('occ 4 512 1536 512 1536 -300 -300', '1024 -900 1024 383 0', () => {
        sweep(v => `${v} -292 1024`, 470, 1580);
        sweep(v => `1024 -292 ${v}`, 470, 1580);
    });

    // Directed checks: the wall-type masks, the lightness scaling and the triangle test over their whole domains.
    for (let v = 0; v < 256; v++) ops.push(`wtm ${v}`);
    ops.push('wtm -1', 'wtm 2147483647', 'wtm -2147483648');
    for (const c of [0, 1, 127, 128, 65535, 65408, -1, 12345678]) for (const s of [0, 1, 2, 127, 128, 255, 256, 1000, -5]) ops.push(`tlc ${c} ${s}`);
    ops.push('tri 0 0 -5 5 5 -5 5 0', 'tri 2147483647 -2147483648 0 0 0 0 0 0');

    // Edge cases that throw: out-of-range levels and tiles, a wall with only a second model (Fill dereferences
    // model1), a null dynamic slot, negative sizes in init.
    ops.push(`init ${LEVELS} 8 8 4 0`, 'hm 1');
    ops.push('getwall 4 0 0', 'getwall 0 8 0', 'getwall 0 -1 0', 'walltype 0 0 8', 'hastc -1 0 0 0', 'delloc 0 0 99');
    ops.push('ground 0 2 2 0 0 -1 0 0 0 0 1 2 3 4 5 6 7 8 9 10 11 12 0 0', 'wall 0 2 2 0 -1 7 1 2 99', 'fbl 0');
    ops.push('draw 300 -900 300 200 0 0 0 0 2 2 0', 'dump');
    ops.push('sharelight -50 -50 -50', 'dump');
    ops.push('spr 0 0 0 1 1 64 64 0 5 0 1 1', 'spr 0 0 0 1 1 64 64 0 5 0 1 2', 'spr 0 0 0 1 1 64 64 0 5 0 1 3', 'spr 0 0 0 1 1 64 64 0 5 0 1 4');
    ops.push('spr 0 0 0 1 1 64 64 0 5 0 1 5', 'spr 0 0 0 1 1 64 64 0 5 0 1 6', 'spr 0 0 0 9 1 64 64 0 5 0 1 7', 'dump', 'rmspr', 'dump');
    // Typecode lookups that hit: the wall (99) and sprites (1..6) above, plus a decor, ground decor and scenery loc.
    ops.push('decor 0 3 3 0 5 -1 1 0 0 0 77', 'gd 0 3 3 0 6 88 0', 'scen 0 4 4 0 1 1 9 0 1073741829');
    ops.push('hastc 0 2 2 99', 'hastc 0 0 0 3', 'hastc 0 3 3 77', 'hastc 0 3 3 88', 'hastc 0 4 4 1073741829', 'hastc 0 4 4 1073741830');
    ops.push('walltype 0 2 2', 'decortype 0 3 3', 'gdtype 0 3 3', 'scenetype 0 4 4', 'getscene 0 4 4', 'delloc 0 4 4', 'scenetype 0 4 4');
    ops.push('push 0 0', 'push 8 0', 'fbl 4', 'occ 1 0 0 0 0 0 0', 'dump');
    ops.push('init 1 -1 4 2 0', 'init 1 4 4 -2 0', 'init -1 4 4 2 1', 'dump');
    return ops;
}

function runOracle(script: string[]): string[] {
    const source = fileURLToPath(new URL('./world/WorldOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'world-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'WorldOracle'], {
            input: script.join('\n') + '\n',
            timeout: 170000,
            encoding: 'utf8',
            maxBuffer: 512 * 1024 * 1024
        });
        if (java.status !== 0) throw new Error(`oracle failed (${java.status} ${java.signal}): ${java.stderr}`);
        const lines = java.stdout.split('\n').map(line => line.replace(/\r$/, ''));
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

// The world statics as a fresh JVM has them (the gamepack's <clinit> values), so this suite does not depend on what
// other suites in the same process left behind.
function worldClinit(): Record<string, unknown> {
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

// kb's statics as kb.<clinit> stores them. entities.test.ts ends with Ground.unload(), which nulls them all, so this
// suite puts them back for its own run (any mistake here would show as a mismatch against the jar's tables).
function groundClinit(): Record<string, unknown> {
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

test('world matches the scene-graph statics of client.jar on a seeded script of scene builds, draws and queries', () => {
    const script = generateScript();
    const want = runOracle(script);

    const w = world as unknown as Record<string, unknown>;
    const p3 = Pix3D as unknown as Record<string, unknown>;
    const p2 = Pix2D as unknown as Record<string, unknown>;
    const kb = Ground as unknown as Record<string, unknown>;
    const groundKeys = Object.keys(groundClinit());
    const worldKeys = Object.keys(worldClinit());
    const pix3dKeys = ['lowDetail', 'textureFallback', 'trans', 'hclip', 'originX', 'originY', 'width', 'height', 'textureProvider', 'clipMinX', 'clipMaxX', 'clipMinY', 'clipMaxY', 'colourTable', 'scanline', 'brightness', 'lowMemTexture', 'opaque'];
    const pix2dKeys = ['pixels', 'width', 'height', 'clipMinX', 'clipMinY', 'clipMaxX', 'clipMaxY'];
    const saved = {
        world: worldKeys.map(k => [k, w[k]] as const),
        pix3d: pix3dKeys.map(k => [k, p3[k]] as const),
        pix2d: pix2dKeys.map(k => [k, p2[k]] as const),
        ground: groundKeys.map(k => [k, kb[k]] as const),
        textures: Preferences.highDetailTextures2
    };
    Object.assign(w, worldClinit());
    Object.assign(kb, groundClinit());
    Object.assign(p3, {
        lowDetail: true,
        textureFallback: false,
        trans: 0,
        hclip: false,
        originX: 0,
        originY: 0,
        width: 0,
        height: 0,
        textureProvider: null,
        clipMinX: 0,
        clipMaxX: 0,
        clipMinY: 0,
        clipMaxY: 0,
        colourTable: new Int32Array(65536),
        scanline: new Int32Array(1024),
        brightness: 1.0,
        lowMemTexture: false,
        opaque: false
    });
    world.drawTileQueue.clear();

    const got: string[] = [];
    try {
        for (const line of script) got.push(runTs(line));
    } finally {
        for (const [k, v] of saved.world) w[k] = v;
        for (const [k, v] of saved.pix3d) p3[k] = v;
        for (const [k, v] of saved.pix2d) p2[k] = v;
        for (const [k, v] of saved.ground) kb[k] = v;
        Preferences.highDetailTextures2 = saved.textures;
        world.drawTileQueue.clear();
    }

    expect(want.length).toBe(script.length);
    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 8; i++) {
        if (got[i] !== want[i]) mismatches.push(`#${i} ${script[i]}\n  java: ${want[i].slice(0, 1500)}\n  ts:   ${got[i].slice(0, 1500)}`);
    }
    expect(mismatches).toEqual([]);

    // The script must reach what it claims to: drawn models and ground (the random scenes complete every draw; only
    // the edge-case wall without a first model throws), textured ground in both detail levels, light sharing, picked
    // ground, each occluder mode selected, and every exception kind it sets up.
    const joined = want.join('\n');
    const draws = want.filter((_, i) => script[i].startsWith('draw '));
    expect(draws.filter(l => l.startsWith('ok|') && !l.endsWith(' fb0')).length).toBeGreaterThan(80);
    expect(draws.filter(l => l.includes(' D')).length).toBeGreaterThan(80);
    expect(joined.split(' D').length).toBeGreaterThan(3000);
    expect(draws.filter(l => l.startsWith('npe|')).length).toBe(1);
    expect(joined.includes(' V')).toBe(true);
    expect(joined.includes(' P')).toBe(true);
    expect(joined.includes(' M')).toBe(true);
    expect(joined.includes(' L')).toBe(true);
    expect(want.some(l => l.startsWith('aioobe'))).toBe(true);
    expect(want.some(l => l.startsWith('npe'))).toBe(true);
    expect(want.some(l => l.startsWith('nase'))).toBe(true);
    expect(want.some((l, i) => script[i] === 'dump' && !/ p[01],-?\d+,-?\d+,-?\d+,-1,-1 /.test(l))).toBe(true);
    expect(want.some((l, i) => script[i] === 'dump' && !/ o\d+,0 /.test(l))).toBe(true);
    for (let mode = 1; mode <= 5; mode++)
        expect(
            want.some((l, i) => script[i] === 'dump' && l.includes(` C${mode === 5 ? 4 : mode <= 2 ? 1 : 2},${mode},`) && / o1,1 /.test(l)),
            `occluder mode ${mode}`
        ).toBe(true);
}, 180000);
