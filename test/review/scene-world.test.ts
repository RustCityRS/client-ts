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
import QuickGround from '../../src/dash3d/QuickGround.js';
import Sprite from '../../src/dash3d/Sprite.js';
import type Square from '../../src/dash3d/Square.js';
import Wall from '../../src/dash3d/Wall.js';
import world from '../../src/dash3d/world.js';
import { arrayAt, arrayPut } from '../../src/util/JavaArray.js';
import { gamepackPath } from '../reference.js';
import { withClinitStatics, type StaticReset } from './staticState.js';

// The STATE half of the scene graph (src/dash3d/world.ts plus its entities Square/Sprite/Occlude/Wall/Decor/
// GroundDecor/GroundObject/Ground/QuickGround) against the real statics of client.jar. A seeded script initialises
// worlds through the real init (mc.a) and runs SetGround/SetWall/SetDecor/SetGroundDecor/SetObj/AddScenery/SetSprite/
// AddDynamic/AddDynamic2/the Del* routines/DelSprite/MoveDecor/PushDown/FillBaseLevel/SetOcclude/RemoveSprites/ResetMap/
// setUnderwater/ShareLight and the Get*/typecode/hasTypecode lookups on it.
// test/review/scene-world/SceneWorldOracle.java runs the same script on the jar. After every operation both sides
// print the result (an entity in full, or the Java exception), the ordered log of calls into the test models, and the
// change in the canonical state: every square of both layers with every field, entity and sprite (the linked square
// nested), every occluder/active-occluder/dynamic-sprite slot and a line of the remaining statics, with identity ids
// for objects and arrays (so aliasing, the same Sprite on each tile it spans and a Del* returning the very entity it
// unlinked are compared too). Equal lines therefore mean the whole state matched after every operation, including the
// partial state an exception leaves behind.
//
// Random part: six worlds (1 to 5 levels, with and without the underwater layer) each get a long weighted random
// sequence of every operation, mostly in range with a few out-of-range levels/tiles, typecodes with the loc kind
// (bits 29-30) and the obj-raising bit 22 set at random, null models, shapes 13/-1, the 5-sprite limit, PushDown with
// loc sprites, light sharing and water sprite keys. Directed part: every routine on the <clinit> state (before init),
// init with negative sizes (the partial assignments before the NegativeArraySizeException), a zero-size world,
// setUnderwater without an underwater layer, water sprite key propagation, the occluder array overflow (501st
// SetOcclude) and ResetMap leaving occluders behind, the dynamic sprite overflow (5001st temporary sprite) followed by
// RemoveSprites and ResetMap throwing on it, PushDown with 1..5 levels, SetSprite with empty/overflowing spans,
// AddDynamic around every yaw boundary and tile edge, AddScenery sizes, SetGround flatness per corner, ShareLightGd's
// z bound on non-square maps, SetObj stack heights, MoveDecor overflow, hasTypecode layering, and DelSprite of sprites
// left over from a larger world.
// Sensitivity: each of 21 single-statement mutations of world.ts (a >= turned >, a dropped store, a reordered
// increment or store before a throw, a swapped bound...) makes this test fail; the one survivor tried (always running
// SetSprite's water-key spread loop) is equivalent, since it then writes the key 0 only over zeros.
// SW_STATS=1 prints how often each operation returned what.

const log: string[] = [];
const call = (token: string): void => {
    log.push(token);
};

// The test model, mirroring SceneWorldOracle.TM.
class TM extends ModelSource {
    constructor(readonly id: number) {
        super();
    }

    draw(_yaw: number, _sinPitch: number, _cosPitch: number, _sinYaw: number, _cosYaw: number, _x: number, _y: number, _z: number, _typecode: bigint, _level: number, _particles: ParticleSystem | null): void {
        call(`D${this.id}`);
    }

    getMinY(): number {
        call(`B${this.id}`);
        if (this.id % 7 === 0) return -32768;
        if (this.id % 11 === 0) return 50 + (this.id % 13);
        return -((Math.imul(this.id, 37) % 400) | 0);
    }

    update(_arg0: number, _arg1: number, _arg2: number, _arg3: number, _arg4: number): void {
        call(`U${this.id}`);
    }

    override isUnlit(): boolean {
        call(`A${this.id}`);
        return this.id < 1000 && this.id % 3 === 0;
    }

    override light(x: number, y: number, z: number): ModelSource {
        call(`L${this.id},${x},${y},${z}`);
        return new TM(this.id + 1000);
    }

    override mergeNormals(other: ModelSource, x: number, y: number, z: number, hide: boolean): void {
        call(`M${this.id},${(other as TM).id},${x},${y},${z},${hide ? 1 : 0}`);
    }
}

const model = (id: number): ModelSource | null => (id < 0 ? null : new TM(id));
const mid = (m: ModelSource | null): string => (m === null ? '-' : `m${(m as TM).id}`);

// ---- identity ----

const ids = new Map<object, number>();
const seenSprites: Sprite[] = [];

function id(o: object): number {
    let i = ids.get(o);
    if (i === undefined) {
        i = ids.size;
        ids.set(o, i);
        if (o instanceof Sprite) seenSprites.push(o);
    }
    return i;
}

const ref = (o: object | null): string => (o === null ? '-' : `#${id(o)}`);

// ---- canonical descriptions (SceneWorldOracle's, character for character) ----

function hash(a: Int32Array | null): string {
    if (a === null) return 'n';
    let h = 0;
    for (let i = 0; i < a.length; i++) h = (Math.imul(31, h) + a[i]) | 0;
    return `${a.length}~${h}`;
}

function hash2(a: Int32Array[] | null): number {
    if (a === null) return -1;
    let h = 0;
    for (const row of a) {
        let r = 0;
        for (let i = 0; i < row.length; i++) r = (Math.imul(31, r) + row[i]) | 0;
        h = (Math.imul(31, h) + r) | 0;
    }
    return h;
}

function hash3(a: Int32Array[][] | null): number {
    if (a === null) return -1;
    let h = 0;
    for (const plane of a) h = (Math.imul(31, h) + hash2(plane)) | 0;
    return h;
}

function hashBytes3(a: Uint8Array[][] | null): number {
    if (a === null) return -1;
    let h = 0;
    for (const plane of a) for (const row of plane) for (let i = 0; i < row.length; i++) h = (Math.imul(31, h) + ((row[i] << 24) >> 24)) | 0;
    return h;
}

function hashBool2(a: boolean[][] | null): number {
    if (a === null) return -1;
    let h = 0;
    for (const row of a) for (const v of row) h = (Math.imul(31, h) + (v ? 1 : 0)) | 0;
    return h;
}

function dims(a: ArrayLike<unknown> | null): string {
    if (a === null) return '';
    let s = `[${a.length}`;
    let inner: unknown = a.length > 0 ? a[0] : null;
    while (inner !== null && inner !== undefined) {
        if (Array.isArray(inner)) {
            s += `x${inner.length}`;
            inner = inner.length > 0 ? inner[0] : null;
        } else {
            if (ArrayBuffer.isView(inner)) s += `x${(inner as Int32Array).length}`;
            break;
        }
    }
    return `${s}]`;
}

function desc(o: object | null): string {
    if (o === null) return '-';
    if (o instanceof Wall) return `W#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${mid(o.model1)},${mid(o.model2)},${o.angle1},${o.angle2}`;
    if (o instanceof Decor) return `N#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${mid(o.model)},${mid(o.model2)},${o.wshape},${o.angle},${o.offsetX},${o.offsetZ}`;
    if (o instanceof GroundDecor) return `G#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${mid(o.model)}`;
    if (o instanceof GroundObject) return `O#${id(o)}:${o.typecode},${o.x},${o.y},${o.z},${o.height},${mid(o.topObj)},${mid(o.middleObj)},${mid(o.bottomObj)}`;
    if (o instanceof Sprite) {
        return `S#${id(o)}:${o.typecode},${o.level},${o.x},${o.y},${o.z},${o.yaw},${o.minTileX},${o.minTileZ},${o.maxTileX},${o.maxTileZ},${o.cycle},${o.distance},${mid(o.model)}`;
    }
    if (o instanceof Occlude) {
        return `C#${id(o)}:${o.type},${o.mode},${o.minTileX},${o.maxTileX},${o.minTileZ},${o.maxTileZ},${o.minX},${o.maxX},${o.minZ},${o.maxZ},${o.minY},${o.maxY},${o.minDeltaZ},${o.maxDeltaZ},${o.minDeltaY},${o.maxDeltaY},${o.minDeltaX},${o.maxDeltaX}`;
    }
    if (o instanceof Ground) {
        return (
            `K#${id(o)}:${o.shape}/${o.rotation}/${o.flat ? 1 : 0}/${o.minimapOverlay}/${o.minimapUnderlay}/${hash(o.vertexX)}/${hash(o.vertexY)}/${hash(o.vertexZ)}` +
            `/${hash(o.faceVertexA)}/${hash(o.faceVertexB)}/${hash(o.faceVertexC)}/${hash(o.faceColourA)}/${hash(o.faceColourB)}/${hash(o.faceColourC)}/${hash(o.faceTexture)}`
        );
    }
    if (o instanceof QuickGround) return `Q#${id(o)}:${o.colourSW},${o.colourSE},${o.colourNE},${o.colourNW},${o.texture},${o.minimapRgb},${o.flat ? 1 : 0}`;
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

function statics(): string {
    const w = world;
    let s = `${w.maxTileX},${w.maxTileZ},${w.viewRadius},${w.maxLevel},${w.minLevel}`;
    s += ` sq${ref(w.squares)} G${ref(w.mainLevelTiles)}${dims(w.mainLevelTiles)} V${ref(w.underwaterSquares)}${dims(w.underwaterSquares)}`;
    s += ` hm${ref(w.levelHeightmaps)} g${ref(w.mainGroundh)}${dims(w.mainGroundh)}:${hash3(w.mainGroundh)}`;
    s += ` S${ref(w.underwaterHeightmap)}${dims(w.underwaterHeightmap)}:${hash3(w.underwaterHeightmap)}`;
    s += ` o${ref(w.waterSpriteKeys)}${dims(w.waterSpriteKeys)}:${hash2(w.waterSpriteKeys)}`;
    s += ` P${ref(w.levelTileOcclusionCycles)}${dims(w.levelTileOcclusionCycles)}:${hash3(w.levelTileOcclusionCycles)}`;
    s += ` c${ref(w.tileCameraClearance)}${dims(w.tileCameraClearance)}:${hashBytes3(w.tileCameraClearance)}`;
    s += ` j${ref(w.visibilityMap)}${dims(w.visibilityMap)}:${hashBool2(w.visibilityMap)}`;
    s += ` hb${ref(w.cornerVisibility)}${dims(w.cornerVisibility)}:${hashBool2(w.cornerVisibility)}`;
    s += ` occ${ref(w.occluders)}${w.occluders === null ? '' : `[${w.occluders.length}]`} n${w.numOccluders}`;
    s += ` act${ref(w.activeOccluders)}${w.activeOccluders === null ? '' : `[${w.activeOccluders.length}]`} n${w.numActiveOccluders}`;
    s += ` dyn${ref(w.dynamicSprites)}${w.dynamicSprites === null ? '' : `[${w.dynamicSprites.length}]`} n${w.dynamicCount}`;
    s += ` sb${ref(w.spriteBuffer)}`;
    if (w.spriteBuffer !== null) s += `[${w.spriteBuffer.length}]${w.spriteBuffer.filter(v => v !== null).length}`;
    s += ` f${w.fillLeft},${w.cycleNo},${w.takingInput ? 1 : 0},${w.clickLevel},${w.clickX},${w.clickY},${w.groundX},${w.groundZ}`;
    return s;
}

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

function state(): Map<string, string> {
    const cur = new Map<string, string>();
    layer(cur, 'M', world.mainLevelTiles);
    layer(cur, 'U', world.underwaterSquares);
    const slots = (tag: string, array: (object | null)[] | null): void => {
        if (array !== null) for (let i = 0; i < array.length; i++) if (array[i] !== null) cur.set(`${tag}${i}`, desc(array[i]));
    };
    slots('C', world.occluders);
    slots('A', world.activeOccluders);
    slots('D', world.dynamicSprites);
    cur.set('T', statics());
    return cur;
}

let previous = new Map<string, string>();

function diff(): string {
    const cur = state();
    let s = '';
    for (const [key, value] of cur) if (previous.get(key) !== value) s += ` ${key}=${value}`;
    for (const key of previous.keys()) if (!cur.has(key)) s += ` ${key}=gone`;
    previous = cur;
    return s;
}

function runOp(op: string, n: number[], a: bigint[]): string {
    switch (op) {
        case 'init':
            world.init(n[0], n[1], n[2], n[3], n[4] !== 0);
            return 'ok';
        case 'hm': {
            const seed = n[0];
            const main = world.mainGroundh;
            if (main !== null) for (let level = 0; level < main.length; level++) for (let x = 0; x < main[level].length; x++) for (let z = 0; z < main[level][x].length; z++) main[level][x][z] = -(((x * 13 + z * 7 + seed) % 5) * 40) - level * 240;
            const under = world.underwaterHeightmap;
            if (under !== null) for (let x = 0; x < under[0].length; x++) for (let z = 0; z < under[0][x].length; z++) under[0][x][z] = -(((x * 11 + z * 5 + seed) % 4) * 30) + 100;
            return 'ok';
        }
        case 'wsk':
            arrayPut(arrayAt(world.waterSpriteKeys, n[0]), n[1], n[2]);
            return 'ok';
        case 'under':
            world.setUnderwater(n[0] !== 0);
            return 'ok';
        case 'reset':
            world.ResetMap();
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
            world.SetGroundDecor(n[0], n[1], n[2], n[3], model(n[4]), a[5], n[6] !== 0);
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
            return String(world.AddDynamic(n[0], n[1], n[2], n[3], n[4], model(n[5]), n[6], a[7], n[8] !== 0));
        case 'dyn2':
            return String(world.AddDynamic2(n[0], n[1], n[2], n[3], model(n[4]), n[5], a[6], n[7], n[8], n[9], n[10]));
        case 'spr':
            return String(world.SetSprite(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], model(n[8]), n[9], n[10] !== 0, a[11]));
        case 'fillspr': {
            let trues = 0;
            for (let i = 0; i < n[0]; i++) {
                const x = i % world.maxTileX;
                const z = ((i / world.maxTileX) | 0) % world.maxTileZ;
                if (world.SetSprite(n[1], x, z, 1, 1, x * 128 + 64, z * 128 + 64, -i | 0, model(i + 100000), i & 2047, true, (BigInt(i) << 32n) | 0x40000000n)) trues++;
            }
            return String(trues);
        }
        case 'rmspr':
            world.RemoveSprites();
            return 'ok';
        case 'delspr': {
            if (seenSprites.length === 0) return 'nosprite';
            const index = n[0] < 0 ? seenSprites.length + n[0] : n[0] % seenSprites.length;
            if (index < 0) return 'nosprite';
            world.DelSprite(seenSprites[index]);
            return 'ok';
        }
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
        default:
            throw new Error(`unknown op ${op}`);
    }
}

function error(e: unknown): string {
    if (e instanceof RangeError && e.message.startsWith('array index')) return 'aioobe';
    if (e instanceof RangeError && e.message.startsWith('NegativeArraySizeException')) return 'nase';
    if (e instanceof RangeError && e.message === '/ by zero') return 'arith';
    if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) return 'npe';
    // Anything else (a raw JS TypeError from a missed null check included) cannot match the jar's line.
    return `ex:${String(e)}`;
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
        result = error(e);
    }
    return `${result}|${log.map(t => ` ${t}`).join('')}|${diff()}`;
}

// mulberry32: only drives script generation; the script itself is what both sides consume.
function rng(seed: number): () => number {
    let s = seed | 0;
    return () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return (t ^ (t >>> 14)) | 0;
    };
}

const MIN = -2147483648;
const MAX = 2147483647;

// The lookups and Del* routines that hit what a placement put on its tile.
const GET_OPS: Record<string, string[]> = {
    wall: ['getwall', 'walltype'],
    decor: ['getdecor', 'decortype'],
    gd: ['getgd', 'gdtype'],
    loc: ['getscene', 'scenetype']
};
const DEL_OPS: Record<string, string[]> = { wall: ['delwall'], decor: ['deldecor'], gd: ['delgd'], obj: ['delobj'], loc: ['delloc'] };

function generateScript(): string[] {
    const next = rng(530530);
    const below = (bound: number): number => (next() >>> 0) % bound;
    const range = (lo: number, hi: number): number => lo + below(hi - lo + 1);
    const pick = <T>(values: T[]): T => values[below(values.length)];
    const chance = (percent: number): boolean => below(100) < percent;
    const ops: string[] = [];
    let modelId = 1;
    const newModel = (): number => modelId++;
    const optModel = (nullPercent = 8): number => (chance(nullPercent) ? -1 : newModel());
    const used: string[] = [];

    // A random long; kind forces the loc kind bits 29-30, bit22 forces bit 22 (SetObj raises the stack over such sprites).
    const typecode = (kind: number | null, bit22?: boolean): string => {
        if (chance(2)) return '0';
        let low = next() >>> 0;
        if (kind !== null) low = ((low & ~0x60000000) | (kind << 29)) >>> 0;
        if (bit22 !== undefined) low = bit22 ? (low | 0x400000) >>> 0 : (low & ~0x400000) >>> 0;
        const high = below(3) === 0 ? next() : below(4) === 0 ? -1 : below(1000);
        const value = BigInt.asIntN(64, (BigInt(high) << 32n) | BigInt(low)).toString();
        used.push(value);
        return value;
    };
    const anyTypecode = (): string => (used.length > 0 && chance(70) ? used[used.length - 1 - below(Math.min(used.length, 40))] : typecode(below(4)));

    const groundOp = (level: number, x: number, z: number): string => {
        const r = below(100);
        const shape = r < 40 ? 0 : r < 60 ? 1 : r < 98 ? range(2, 12) : pick([13, -1]);
        const rotation = chance(3) ? pick([4, -1, 7]) : below(4);
        const texture = chance(70) ? -1 : range(0, 20);
        const h = range(-300, 0);
        const heights = chance(30) ? [h, h, h, h] : [h, range(-300, 0), range(-300, 0), range(-300, 0)];
        const colours = Array.from({ length: 12 }, () => (chance(3) ? pick([12345678, -1, 0, 65535, MAX, MIN]) : range(0, 65535)));
        const minimap = [chance(25) ? 0 : next(), chance(25) ? 0 : next()];
        return `ground ${level} ${x} ${z} ${shape} ${rotation} ${texture} ${heights.join(' ')} ${colours.join(' ')} ${minimap.join(' ')}`;
    };

    interface Scene {
        levels: number;
        sizeX: number;
        sizeZ: number;
        radius: number;
        under: boolean;
        count: number;
    }

    const randomScene = (scene: Scene, seed: number): void => {
        const { levels, sizeX, sizeZ, radius, under, count } = scene;
        ops.push(`init ${levels} ${sizeX} ${sizeZ} ${radius} ${under ? 1 : 0}`, `hm ${seed}`);
        let underwater = false;
        // The selected layer's level count (the underwater layer has one), with a few out-of-range levels and tiles.
        const lvl = (): number => {
            const depth = underwater ? 1 : levels;
            return chance(3) ? pick([-1, depth]) : chance(45) ? 0 : below(depth);
        };
        const tx = (): number => (chance(3) ? pick([-1, sizeX]) : below(sizeX));
        const tz = (): number => (chance(3) ? pick([-1, sizeZ]) : below(sizeZ));
        // Where (and with which typecode) things were placed, so the lookups, Del* and hasTypecode often hit.
        const placed: [number, number, number, string, string][] = [];
        const place = (l: number, x: number, z: number, tc: string, kind: string): string => {
            placed.push([l, x, z, tc, kind]);
            return tc;
        };
        const spot = (): [number, number, number, string, string] => (placed.length > 0 && chance(75) ? placed[placed.length - 1 - below(Math.min(placed.length, 60))] : [lvl(), tx(), tz(), anyTypecode(), 'any']);
        const weights: [string, number][] = [
            ['ground', 10],
            ['wall', 8],
            ['decor', 7],
            ['gd', 6],
            ['obj', 6],
            ['scen', 10],
            ['dyn', 6],
            ['dyn2', 4],
            ['spr', 5],
            ['rmspr', 2],
            ['delspr', 3],
            ['movedecor', 3],
            ['del', 10],
            ['get', 12],
            ['hastc', 5],
            ['push', levels >= 4 ? 3 : 1],
            ['fbl', 2],
            ['occ', 3],
            ['under', under ? 2 : 1],
            ['sharelight', 1],
            ['reset', 1],
            ['wsk', under ? 2 : 0]
        ];
        const total = weights.reduce((sum, [, w]) => sum + w, 0);
        for (let i = 0; i < count; i++) {
            let roll = below(total);
            let kind = weights[0][0];
            for (const [name, w] of weights) {
                if (roll < w) {
                    kind = name;
                    break;
                }
                roll -= w;
            }
            switch (kind) {
                case 'ground':
                    ops.push(groundOp(lvl(), tx(), tz()));
                    break;
                case 'wall': {
                    // A first model nearly always (ShareLight dereferences model1), a second model sometimes.
                    const [l, x, z] = [lvl(), tx(), tz()];
                    const m1 = chance(4) ? -1 : newModel();
                    const m2 = chance(35) ? newModel() : -1;
                    ops.push(`wall ${l} ${x} ${z} ${range(-300, 0)} ${m1} ${m2} ${pick([1, 2, 4, 8, 16, 32, 64, 128])} ${m2 < 0 ? 0 : pick([1, 2, 4, 8])} ${place(l, x, z, typecode(0), 'wall')}`);
                    break;
                }
                case 'decor': {
                    const [l, x, z] = [lvl(), tx(), tz()];
                    ops.push(`decor ${l} ${x} ${z} ${range(-300, 0)} ${optModel()} ${chance(40) ? newModel() : -1} ${pick([1, 2, 4, 8, 16, 32, 64, 128, 256])} ${below(4)} ${range(-64, 64)} ${range(-64, 64)} ${place(l, x, z, typecode(1), 'decor')}`);
                    break;
                }
                case 'gd': {
                    const [l, x, z] = [lvl(), tx(), tz()];
                    ops.push(`gd ${l} ${x} ${z} ${range(-300, 0)} ${optModel()} ${place(l, x, z, typecode(3), 'gd')} ${below(2)}`);
                    break;
                }
                case 'obj': {
                    // Often on a tile that already holds something (sprites raise the stack).
                    const [l, x, z] = placed.length > 0 && chance(40) ? spot() : [lvl(), tx(), tz()];
                    ops.push(`obj ${l} ${x} ${z} ${range(-300, 0)} ${optModel(15)} ${place(l, x, z, typecode(0), 'obj')} ${optModel(40)} ${optModel(40)}`);
                    break;
                }
                case 'scen': {
                    const l = lvl();
                    const x = chance(5) ? -1 : below(sizeX);
                    const z = chance(5) ? -1 : below(sizeZ);
                    const w = chance(5) ? pick([0, -1]) : chance(20) ? 3 : range(1, 2);
                    const h = chance(5) ? pick([0, -1]) : chance(20) ? 3 : range(1, 2);
                    ops.push(`scen ${l} ${x} ${z} ${range(-300, 0)} ${w} ${h} ${optModel(5)} ${below(2048)} ${place(l, x, z, typecode(chance(80) ? 2 : below(4), chance(30)), 'loc')}`);
                    break;
                }
                case 'dyn':
                    ops.push(
                        `dyn ${lvl()} ${range(-64, sizeX * 128 + 64)} ${range(-64, sizeZ * 128 + 64)} ${range(-300, 0)} ${pick([0, 1, 60, 64, 127, 128, 192])} ${optModel(5)} ${chance(10) ? pick([-1, 2048, 4000]) : below(2048)} ${typecode(below(4), chance(20))} ${below(2)}`
                    );
                    break;
                case 'dyn2': {
                    const x0 = range(-1, sizeX - 1);
                    const z0 = range(-1, sizeZ - 1);
                    ops.push(`dyn2 ${lvl()} ${range(0, sizeX * 128)} ${range(0, sizeZ * 128)} ${range(-300, 0)} ${optModel(5)} ${below(2048)} ${typecode(below(4), chance(20))} ${x0} ${z0} ${x0 + range(-1, 2)} ${z0 + range(-1, 2)}`);
                    break;
                }
                case 'spr': {
                    const l = lvl();
                    const x = range(-1, sizeX - 1);
                    const z = range(-1, sizeZ - 1);
                    ops.push(`spr ${l} ${x} ${z} ${range(-1, 3)} ${range(-1, 3)} ${x * 128 + 64} ${z * 128 + 64} ${range(-300, 0)} ${optModel(5)} ${below(2048)} ${below(2)} ${place(l, x, z, typecode(below(4), chance(30)), 'loc')}`);
                    break;
                }
                case 'rmspr':
                    ops.push('rmspr');
                    break;
                case 'delspr':
                    // Mostly a recently seen sprite (likely still in this world), sometimes any sprite seen so far.
                    ops.push(`delspr ${chance(75) ? -1 - below(40) : below(100000)}`);
                    break;
                case 'movedecor': {
                    const [l, x, z] = spot();
                    ops.push(`movedecor ${l} ${x} ${z} ${range(-40, 40)}`);
                    break;
                }
                case 'del': {
                    // Usually the Del* of what was placed there.
                    const [l, x, z, , what] = spot();
                    const matching = DEL_OPS[what];
                    ops.push(`${matching !== undefined && chance(70) ? pick(matching) : pick(['delwall', 'deldecor', 'delloc', 'delgd', 'delobj'])} ${l} ${x} ${z}`);
                    break;
                }
                case 'get': {
                    const [l, x, z, , what] = spot();
                    const matching = GET_OPS[what];
                    ops.push(`${matching !== undefined && chance(70) ? pick(matching) : pick(['getwall', 'getdecor', 'getgd', 'getscene', 'walltype', 'decortype', 'scenetype', 'gdtype'])} ${l} ${x} ${z}`);
                    break;
                }
                case 'hastc': {
                    const [l, x, z, tc] = spot();
                    ops.push(`hastc ${l} ${x} ${z} ${chance(70) ? tc : anyTypecode()}`);
                    break;
                }
                case 'push':
                    ops.push(`push ${tx()} ${tz()}`);
                    break;
                case 'fbl':
                    ops.push(`fbl ${chance(5) ? levels : below(underwater ? 1 : levels)}`);
                    break;
                case 'occ': {
                    const x0 = range(-300, sizeX * 128);
                    const z0 = range(-300, sizeZ * 128);
                    ops.push(`occ ${pick([1, 2, 4])} ${x0} ${x0 + range(0, 384)} ${z0} ${z0 + range(0, 384)} ${range(-600, 0)} ${range(-300, 0)}`);
                    break;
                }
                case 'under':
                    if (under) {
                        underwater = !underwater;
                        ops.push(`under ${underwater ? 1 : 0}`);
                    } else {
                        // No underwater layer: setUnderwater(true) selects null and throws; a lookup, then back.
                        ops.push('under 1', `getwall 0 ${below(sizeX)} ${below(sizeZ)}`, 'under 0');
                    }
                    break;
                case 'sharelight':
                    ops.push(`sharelight ${range(-60, -10)} ${range(-80, -10)} ${range(-60, -10)}`);
                    break;
                case 'reset':
                    // Rarely: it empties the world.
                    ops.push(chance(40) ? 'reset' : `walltype ${lvl()} ${tx()} ${tz()}`);
                    break;
                case 'wsk':
                    ops.push(`wsk ${below(sizeX)} ${below(sizeZ)} ${chance(30) ? 0 : range(-5, 50)}`);
                    break;
            }
        }
        if (underwater) ops.push('under 0');
        ops.push('rmspr', 'sharelight -50 -60 -40', 'reset');
        for (let i = 0; i < 6; i++) ops.push(`getwall 0 ${below(sizeX)} ${below(sizeZ)}`, `delspr ${below(1000)}`);
    };

    // ---- directed: every routine on the <clinit> state ----
    ops.push('getwall 0 0 0', 'walltype 0 0 0', 'hastc 0 0 0 0', 'getscene 0 0 0', 'delloc 0 0 0', 'reset', 'rmspr', 'fbl 0', 'fbl 3', 'under 0', 'under 1');
    ops.push('occ 1 0 0 0 0 0 0', 'spr 0 0 0 1 1 64 64 0 5 0 1 7', 'spr 0 0 0 0 1 64 64 0 5 0 1 7', 'spr 0 0 0 0 1 64 64 0 5 0 0 7');
    ops.push('dyn 0 64 64 0 0 -1 0 0 0', 'dyn 0 64 64 0 0 5 0 0 0', 'dyn2 0 64 64 0 5 0 0 0 0 -1 0', 'scen 0 0 0 0 0 1 5 0 1073741824', 'rmspr', 'delspr 0', 'reset');
    ops.push('push 0 0', 'movedecor 0 0 0 1', 'sharelight 1 1 1', 'ground 0 0 0 0 0 -1 0 0 0 0 1 2 3 4 5 6 7 8 9 10 11 12 0 0', 'wall 0 0 0 0 1 -1 1 0 5', 'wall 0 0 0 0 -1 -1 1 0 5');
    ops.push('gd 0 0 0 0 1 2 0', 'gd 0 0 0 0 -1 2 0', 'obj 0 0 0 0 1 2 3 4', 'decor 0 0 0 0 1 2 1 0 0 0 5', 'decor 0 0 0 0 -1 2 1 0 0 0 5');

    // ---- directed: init with negative sizes and a zero-size world ----
    ops.push('init -1 4 4 2 0', 'init 2 -1 4 2 0', 'init 2 4 -1 2 1', 'init 2 0 0 0 0', 'hm 1', 'getwall 0 0 0', 'fbl 0', 'fbl 2', 'spr 0 0 0 1 1 64 64 0 5 0 1 7');
    ops.push('spr 0 0 0 0 0 64 64 0 5 0 1 7', 'push 0 0', 'reset', 'rmspr', 'sharelight 1 1 1', 'under 0');
    ops.push('init 1 3 3 1 1', 'init 2 4 4 -1 1', 'hm 2', 'wall 1 1 1 0 3 6 1 2 9', 'scen 1 2 2 0 2 2 9 0 1073741829', 'under 1', 'scen 0 1 1 0 1 1 12 0 1073741830', 'sharelight -9 -9 -9');
    ops.push('under 0', 'sharelight -9 -9 -9', 'push 1 1', 'reset', 'init 1 3 3 0 1', 'init 3 2 5 2 1');

    // ---- directed: setUnderwater without an underwater layer ----
    ops.push('init 2 4 4 1 0', 'hm 3', 'wall 0 1 1 0 4 -1 1 0 11', 'under 1', 'getwall 0 1 1', 'spr 0 0 0 1 1 64 64 0 5 0 1 7', 'fbl 0', 'reset', 'push 1 1', 'under 0', 'getwall 0 1 1');

    // ---- directed: water sprite keys ----
    ops.push('init 4 8 8 3 1', 'hm 7', 'under 1', 'wsk 2 2 5', 'wsk 3 3 9', 'scen 0 1 1 0 3 3 20 0 1073741825', 'scen 0 5 5 0 2 2 21 0 1073741826');
    ops.push('wsk 6 6 -3', 'spr 0 5 6 2 2 704 832 0 22 0 1 1073741827', 'wsk 0 0 4', 'dyn 0 64 64 0 64 23 300 1073741828 1', 'fbl 0', 'sharelight -30 -40 -50');
    ops.push('under 0', 'scen 0 1 1 0 2 2 24 0 1073741829', 'wsk 7 7 1', 'wsk 8 0 1', 'wsk 0 -1 1', 'under 1', 'push 2 2', 'delloc 0 1 1', 'rmspr', 'reset', 'under 0');

    // ---- directed: occluder overflow, then ResetMap (which leaves the occluders in place) ----
    ops.push('init 1 2 2 1 0');
    for (let i = 0; i < 501; i++) {
        const x0 = range(-1000, 1000);
        const z0 = range(-1000, 1000);
        ops.push(`occ ${pick([1, 2, 4])} ${x0} ${x0 + range(-200, 400)} ${z0} ${z0 + range(-200, 400)} ${range(-600, 0)} ${range(-300, 0)}`);
    }
    ops.push('reset', 'occ 2 -129 -128 127 128 -5 -6', 'occ 4 -1 1 -255 255 0 0', 'reset', 'init 1 2 2 1 0');

    // ---- directed: dynamic sprite overflow ----
    ops.push('init 1 40 40 2 0', 'fillspr 5001 0', 'rmspr', 'reset', 'init 1 4 4 1 0', 'fillspr 30 0', 'rmspr', 'fillspr 7 0', 'reset');

    // ---- directed: PushDown with 1..5 levels ----
    for (const levels of [1, 2, 3, 4, 5]) {
        ops.push(`init ${levels} 4 4 2 0`, `hm ${levels}`);
        for (let level = 0; level < levels; level++) {
            ops.push(`wall ${level} 1 1 ${-level * 100} ${newModel()} -1 1 0 ${100 + level}`);
            ops.push(`scen ${level} 1 1 ${-level * 100} 2 2 ${newModel()} 0 ${BigInt(0x40000000 + level) | (BigInt(level) << 32n)}`);
            ops.push(`scen ${level} 0 0 0 1 1 ${newModel()} 0 ${0x20000000 + level}`);
            ops.push(`ground ${level} 2 2 1 0 7 -5 -5 -5 -5 1 2 3 4 5 6 7 8 9 10 11 12 13 14`);
        }
        ops.push('push 1 1', 'push 2 2', 'push 0 0', 'push 3 3', 'push 1 1', 'getscene 0 1 1', 'getscene 1 1 1', 'delloc 0 1 1', 'delloc 1 1 1', 'push 4 0', 'push 0 -1');
        ops.push('sharelight -20 -20 -20', 'reset');
    }

    // ---- directed: SetSprite spans ----
    ops.push('init 2 6 6 2 0', 'hm 4');
    ops.push('spr 0 0 0 0 0 0 0 0 30 0 1 1', 'spr 0 -100 0 5 0 0 0 0 31 0 1 2', `spr 0 ${MAX} 0 2 1 0 0 0 32 0 1 3`, `spr 0 ${MIN} 0 -1 1 0 0 0 33 0 1 4`);
    ops.push('spr 0 0 0 7 1 0 0 0 34 0 1 5', 'spr 0 5 5 2 1 0 0 0 35 0 1 6', 'spr 0 0 5 1 2 0 0 0 36 0 1 7', 'spr 0 1 1 1 1 0 0 0 -1 0 1 4194304');
    ops.push('obj 0 1 1 0 37 8 -1 -1', 'sharelight -9 -9 -9');
    for (let i = 0; i < 6; i++) ops.push(`spr 0 3 3 1 1 448 448 0 ${newModel()} ${i * 300} ${i % 2} ${0x40000000 + i}`);
    ops.push('spr 0 2 2 2 2 384 384 0 40 0 1 9', 'spr 1 4 4 2 2 640 640 0 41 0 0 1073741834', 'spr 2 0 0 1 1 64 64 0 42 0 1 11', 'spr -1 0 0 1 1 64 64 0 43 0 1 12');
    ops.push('spr 1 4 4 1 1 576 576 0 44 0 1 13', 'delloc 1 4 4', 'getscene 1 4 4', 'getscene 1 5 5', 'delloc 1 5 5', 'hastc 1 5 5 1073741834', 'rmspr', 'delspr -1', 'delspr -2', 'delspr 0', 'reset');

    // ---- directed: AddDynamic around every yaw boundary and tile edge (each removed again, so no tile fills up) ----
    ops.push('init 1 8 8 2 0', 'hm 5');
    for (const yaw of [0, 127, 128, 129, 383, 384, 385, 639, 640, 641, 895, 896, 897, 1151, 1152, 1153, 1407, 1408, 1409, 1663, 1664, 1665, 1919, 1920, 1921, 2047, -1, 2048, 5000]) {
        ops.push(`dyn 0 512 512 0 64 ${newModel()} ${yaw} ${yaw} 1`, `dyn 0 448 448 0 0 ${newModel()} ${yaw} ${yaw} 1`, 'rmspr');
    }
    for (const [x, radius] of [
        [-1, 0],
        [-127, 0],
        [-128, 0],
        [-129, 0],
        [0, 0],
        [1023, 0],
        [1024, 0],
        [1023, 1],
        [64, 64],
        [64, 65],
        [127, 127],
        [128, 128],
        [960, 63],
        [960, 64]
    ]) {
        ops.push(`dyn 0 ${x} 512 0 ${radius} ${newModel()} 0 ${x} 0`, `dyn 0 512 ${x} 0 ${radius} ${newModel()} 1000 ${x} 1`, 'rmspr');
    }
    ops.push(`dyn 0 ${MIN} 512 0 1 50 0 1 0`, `dyn 0 512 ${MAX} 0 1 51 0 1 0`, `dyn 0 0 0 0 ${MAX} 52 0 1 0`, 'dyn 0 100 100 0 -200 53 0 1 0');
    ops.push('dyn2 0 64 64 0 54 0 0 3 3 2 2', 'dyn2 0 64 64 0 55 0 0 3 3 3 3', 'dyn2 0 64 64 0 56 0 0 7 7 8 7', 'dyn2 0 64 64 0 57 0 0 -1 0 0 0', 'rmspr', 'reset');

    // ---- directed: AddScenery sizes ----
    ops.push('init 2 6 6 2 0', 'hm 6');
    for (const [x, z, w, h] of [
        [0, 0, 0, 0],
        [0, 0, -1, 2],
        [0, 0, 1, 1],
        [5, 5, 1, 1],
        [5, 5, 2, 1],
        [4, 4, 2, 2],
        [0, 0, 6, 6],
        [0, 0, 7, 1],
        [16777216, 0, 1, 1],
        [0, 0, 100, 0]
    ]) {
        ops.push(`scen 0 ${x} ${z} -7 ${w} ${h} ${newModel()} 77 ${0x40000000 + w}`);
    }
    ops.push('scen 1 0 0 0 1 1 -1 0 0', 'scen 2 0 0 0 1 1 60 0 0', 'getscene 0 4 4', 'getscene 0 5 5', 'delloc 0 5 5', 'delloc 0 4 4', 'scenetype 0 0 0', 'reset');

    // ---- directed: SetGround flatness (each corner alone breaking it) and the three arms ----
    ops.push('init 2 4 4 1 0');
    for (const [i, heights] of [
        [-9, -9, -9, -9],
        [-9, -9, -9, -8],
        [-9, -9, -8, -9],
        [-9, -8, -9, -9],
        [-8, -9, -9, -9],
        [0, 0, 0, 0]
    ].entries()) {
        for (const shape of [0, 1, 2, 7]) ops.push(`ground ${i % 2} ${i % 4} ${shape % 4} ${shape} ${i % 4} ${i - 1} ${heights.join(' ')} 1 2 3 4 5 6 7 8 9 10 11 12 ${i * 7} ${i * 9}`);
    }
    ops.push('reset');

    // ---- directed: ShareLightGd's z bound (maxTileX in the jar) on maps longer and wider than they are deep ----
    for (const [sizeX, sizeZ] of [
        [4, 8],
        [8, 4]
    ]) {
        ops.push(`init 1 ${sizeX} ${sizeZ} 1 0`, 'hm 9');
        for (let z = 0; z < sizeZ; z++) ops.push(`gd 0 1 ${z} 0 ${300 + z * 3} ${z} 0`, `gd 0 2 ${z} 0 ${600 + z * 3} ${z} 0`);
        ops.push('sharelight -10 -20 -30', 'sharelight -10 -20 -30', 'reset');
    }

    // ---- directed: SetObj stack heights ----
    ops.push('init 1 4 4 1 0', 'hm 8');
    for (const [m, bit] of [
        [14, true],
        [22, true],
        [33, true],
        [10, false],
        [5, true]
    ]) {
        ops.push(`spr 0 1 1 1 1 192 192 0 ${m} 0 0 ${bit ? 4194304 : 0}`);
        ops.push(`obj 0 1 1 -3 ${newModel()} 77 ${newModel()} -1`);
    }
    ops.push('obj 0 2 2 0 -1 0 -1 -1', 'obj 0 4 0 0 1 0 2 3', 'obj 1 0 0 0 1 0 2 3', 'delobj 0 1 1', 'delobj 0 1 1', 'delobj 0 3 3', 'reset');

    // ---- directed: MoveDecor arithmetic ----
    ops.push('init 1 4 4 1 0');
    ops.push('decor 0 1 1 0 70 -1 1 0 1048576 -17 99', 'movedecor 0 1 1 4096', 'movedecor 0 1 1 3', 'movedecor 0 1 1 -1', 'movedecor 0 1 1 0', 'getdecor 0 1 1');
    ops.push(`decor 0 2 2 0 71 72 256 3 ${MAX} ${MIN} 98`, 'movedecor 0 2 2 2', 'movedecor 0 2 2 -16', 'movedecor 0 3 3 5', 'movedecor 0 0 4 5', 'deldecor 0 2 2', 'movedecor 0 2 2 5', 'reset');

    // ---- directed: typecode layering ----
    ops.push('init 1 4 4 1 0', 'wall 0 1 1 0 80 -1 1 0 5', 'decor 0 1 1 0 81 -1 1 0 0 0 5', 'gd 0 1 1 0 82 5 1', 'spr 0 1 1 1 1 0 0 0 83 0 0 5');
    ops.push('hastc 0 1 1 5', 'delwall 0 1 1', 'hastc 0 1 1 5', 'deldecor 0 1 1', 'hastc 0 1 1 5', 'delgd 0 1 1', 'hastc 0 1 1 5', 'delspr -1', 'hastc 0 1 1 5', 'hastc 0 1 1 0');
    ops.push('hastc 0 2 2 0', 'spr 0 2 2 1 1 0 0 0 84 0 0 0', 'hastc 0 2 2 0', 'walltype 0 2 2', 'decortype 0 2 2', 'gdtype 0 2 2', 'scenetype 0 2 2', 'getgd 0 2 2');
    ops.push('gd 0 3 3 0 85 -9223372036854775808 0', 'gdtype 0 3 3', 'hastc 0 3 3 -9223372036854775808', 'wall 0 3 3 0 86 -1 1 0 9223372036854775807', 'walltype 0 3 3');
    ops.push('spr 0 0 0 2 2 0 0 0 87 0 0 1610612736', 'getscene 0 0 0', 'spr 0 0 2 2 2 0 0 0 88 0 0 1073741824', 'getscene 0 0 2', 'getscene 0 1 3', 'scenetype 0 0 2', 'delloc 0 1 3', 'delloc 0 0 2', 'reset');

    // ---- directed: DelSprite of sprites left over from a larger world ----
    ops.push('init 2 8 8 2 0', 'scen 0 2 2 0 4 4 90 0 1073741824', 'scen 1 6 6 0 2 2 91 0 1073741825');
    ops.push('init 1 4 4 1 0', 'ground 0 2 2 0 0 -1 0 0 0 0 1 2 3 4 5 6 7 8 9 10 11 12 0 0', 'scen 0 3 3 0 1 1 92 0 5', 'delspr -2', 'delspr -3', 'delspr -1', 'delspr -1');
    ops.push('init 1 8 8 2 0', 'delspr -3', 'reset');

    // ---- random scenes ----
    const scenes: Scene[] = [
        { levels: 4, sizeX: 8, sizeZ: 8, radius: 4, under: true, count: 1800 },
        { levels: 4, sizeX: 10, sizeZ: 6, radius: 3, under: false, count: 1500 },
        { levels: 2, sizeX: 5, sizeZ: 9, radius: 2, under: true, count: 900 },
        { levels: 1, sizeX: 4, sizeZ: 4, radius: 1, under: false, count: 600 },
        { levels: 5, sizeX: 7, sizeZ: 7, radius: 5, under: true, count: 1300 },
        { levels: 3, sizeX: 6, sizeZ: 6, radius: 2, under: false, count: 900 }
    ];
    scenes.forEach((scene, i) => randomScene(scene, i + 1));
    return ops;
}

function runOracle(script: string[]): string[] {
    const source = fileURLToPath(new URL('./scene-world/SceneWorldOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'scene-world-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'SceneWorldOracle'], {
            input: script.join('\n') + '\n',
            timeout: 170000,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 1024
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

// kb's statics as kb.<clinit> stores them (the Ground constructor reads shapePoints/shapeFaces; entities.test.ts ends
// with Ground.unload(), which nulls them all).
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

test('world state routines match client.jar on a seeded script of scene builds, edits and lookups', () => {
    const script = generateScript();
    const want = runOracle(script);

    const resets: StaticReset[] = [
        { target: world, clinit: worldClinit() },
        { target: Ground, clinit: groundClinit() }
    ];
    // The draw queue is the one world static with no <clinit> reset value to assign (a fresh list); none of these
    // routines touch it, so it only has to be empty while the script runs.
    world.drawTileQueue.clear();
    const got = withClinitStatics(resets, () => {
        ids.clear();
        seenSprites.length = 0;
        previous = new Map();
        try {
            return script.map(line => runTs(line));
        } finally {
            world.drawTileQueue.clear();
        }
    });

    expect(want.length).toBe(script.length);
    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 6; i++) {
        if (got[i] !== want[i]) mismatches.push(`#${i} ${script[i]}\n  java: ${want[i].slice(0, 2500)}\n  ts:   ${got[i].slice(0, 2500)}`);
    }
    expect(mismatches).toEqual([]);

    // The script must reach what it claims to.
    const results = want.map(line => line.slice(0, line.indexOf('|')));
    const count = (op: string, pred: (result: string, line: string) => boolean): number => script.filter((s, i) => s.split(' ')[0] === op && pred(results[i], want[i])).length;
    if (process.env.SW_STATS) {
        const stats = new Map<string, number>();
        script.forEach((s, i) => {
            const r = results[i];
            const key = `${s.split(' ')[0]}:${/^[A-Z]#/.test(r) ? r.slice(0, 1) : r.length > 12 ? 'num' : r}`;
            stats.set(key, (stats.get(key) ?? 0) + 1);
        });
        console.log(
            [...stats]
                .sort()
                .map(([k, v]) => `${k}=${v}`)
                .join('\n')
        );
        console.log(
            'lines',
            want.length,
            'bytes',
            want.reduce((sum, l) => sum + l.length, 0)
        );
        console.log(
            'push-ok',
            count('push', r => r === 'ok'),
            'sharelight-M',
            count('sharelight', (_, l) => l.includes(' M')),
            'obj-B',
            count('obj', (_, l) => / B\d+/.test(l)),
            'delspr-change',
            count('delspr', (_, l) => !l.endsWith('|'))
        );
    }
    for (const kind of ['aioobe', 'npe', 'nase']) expect(results.includes(kind), kind).toBe(true);
    expect(count('scen', r => r === 'true')).toBeGreaterThan(300);
    expect(count('scen', r => r === 'false')).toBeGreaterThan(60);
    expect(count('spr', r => r === 'false')).toBeGreaterThan(30);
    expect(count('dyn', r => r === 'true')).toBeGreaterThan(150);
    expect(count('dyn2', r => r === 'true')).toBeGreaterThan(100);
    expect(count('getscene', r => r.startsWith('S#'))).toBeGreaterThan(20);
    expect(count('delloc', r => r.startsWith('S#'))).toBeGreaterThan(25);
    expect(count('hastc', r => r === 'true')).toBeGreaterThan(30);
    expect(count('getwall', r => r.startsWith('W#'))).toBeGreaterThan(15);
    expect(count('delobj', r => r.startsWith('O#'))).toBeGreaterThan(20);
    expect(count('push', r => r === 'ok')).toBeGreaterThan(60);
    expect(count('push', r => r === 'aioobe')).toBeGreaterThan(20);
    expect(count('sharelight', (_, l) => l.includes(' M'))).toBeGreaterThan(8);
    expect(count('sharelight', r => r === 'npe')).toBeGreaterThan(0);
    expect(count('obj', (_, l) => / B\d+/.test(l))).toBeGreaterThan(25);
    expect(count('delspr', (_, l) => !l.endsWith('|'))).toBeGreaterThan(20);
    // The overflows: the 501st occluder, the 5001st temporary sprite, then RemoveSprites and ResetMap on 5001 slots.
    expect(count('occ', r => r === 'aioobe')).toBe(1);
    const fill = script.indexOf('fillspr 5001 0');
    expect(results.slice(fill, fill + 3)).toEqual(['aioobe', 'aioobe', 'aioobe']);
    // A pushed-down square keeps the old one (nested), the underwater layer holds sprites, and water sprite keys spread.
    expect(want.some(l => / [MU]\d+,\d+,\d+=#\d+:[^ ]*,L\(/.test(l))).toBe(true);
    expect(want.some(l => / U0,\d+,\d+=[^ ]*,t[1-5],/.test(l))).toBe(true);
    expect(want.some(l => / T=[^|]* o#\d+\[\d+x\d+\]:[1-9-]/.test(l))).toBe(true);
}, 240000);
