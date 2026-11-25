import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ground from '../../src/dash3d/Ground.js';
import ModelSource from '../../src/dash3d/ModelSource.js';
import type Occlude from '../../src/dash3d/Occlude.js';
import type ParticleSystem from '../../src/dash3d/ParticleSystem.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import type Sprite from '../../src/dash3d/Sprite.js';
import type Square from '../../src/dash3d/Square.js';
import type TextureProvider from '../../src/dash3d/TextureProvider.js';
import world from '../../src/dash3d/world.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import Preferences from '../../src/ui/Preferences.js';
import { arrayAt, arrayPut, requireNonNull } from '../../src/util/JavaArray.js';
import { gamepackPath } from '../reference.js';

// The RENDER half of the scene graph (src/dash3d/world.ts: draw -> CalcOcclude -> Render -> Fill ->
// renderQuickGround/drawTileOverlay/model draws, updateMousePicking, testColumn, InsideTriangle, TextureLightCol and the
// occlusion tests Occluded/GroundoOcluded/WallOccluded/SpriteOccluded/SpriteOccluded2, with the entities they read) against
// client.jar. test/review/scene-render/SceneRenderOracle.java runs the same seeded script on the real gamepack
// classes (qc.a, ke.a, ad.a, p.a, ug.a, sb.a, sc.a, ...). After every operation both sides print the result (or the
// Java exception), the ordered log of every call into the test models and the texture provider (each model draw with
// all eleven arguments AND the hash of the framebuffer at that moment, so the painter's order of ground triangles and
// model draws is compared, not just the final image), and after a draw, a ground sweep or "state" the whole render
// state: the framebuffer hash, eye/bounds/camera statics, the pick result, cycle and fillLeft, every active occluder
// with its mode and slopes, the visibility and corner-visibility maps bit for bit, a hash of every square's render
// fields (drawFront/drawBack/drawSprites/cornerSides/sidesBefore/AfterCorner/backWallTypes) in both layers, a hash of
// every sprite's cycle/distance, the tile occlusion cycles, kb's draw scratch arrays, dc.e/dc.j and the hide areas.
// Each test model draw also leaves a transparency in Pix3D.trans, as a real model's last face does.
//
// Scenes (530 always draws four levels: world.draw reads level 3 of the heightmap, so every world has four):
// (1) a 20x20x4 world (and an 18x18 one on rough terrain) with every ground shape 0..12 in every rotation, textured (64/128 texels, solid and
// transparent, missing texels) and flat-coloured, flat and sloped, fully hidden layers, bridges (PushDown), walls of
// every type mask including the four corner types, decor of every wall shape including the diagonal (256) with and
// without a second model, ground decor drawn before/after walls (typecode bit 31), obj stacks raised by bit-22 sprites,
// multi-tile scenery, light sharing, occluders, dynamic sprites every frame and RemoveSprites; drawn from many eyes
// (high, low near the ground, outside the map, under the ground), pitches and yaws, with and without roofs, roof
// levels and bytes, hidden-roof areas, both texture detail levels and both raster detail levels, mouse picking before
// draws, direct ground sweeps (every tile through renderQuickGround/drawTileOverlay, visible or not, picking on and
// off, occluded flag on and off) and occlusion queries. (2) A world with the underwater layer (the two-pass draw).
// (3) One occluder of each mode (1..5), and several at once, selected by the eye with walls, decor, scenery and objs
// around and behind them; world.Occluded swept one unit at a time across each projected bound, every wall mask of
// WallOccluded and SpriteOccluded/SpriteOccluded2 swept over one heightmap corner one unit at a time, the type-4 selection
// threshold (eye exactly 128 above) and hidden-roof areas exactly on an occluder's bounds. (3b) Exact boundaries with
// pitch 0 / yaw 0 (and pitch 1024): corner columns on the clip edge, testColumn on its near/far/clip bounds, ground
// vertices on the screen edges and the near plane, edge-on (zero-area) ground, diagonal decor seen from its diagonals.
// (4) A view radius larger than the map, a clipped framebuffer window and a moved origin; (4b) the client's 512x334
// viewport with view radius 25. (5) Fields of textured shaped/plain tiles on flat and on cliff terrain in every
// texture/raster detail combination. (6) Edges: drawing before init, pitch and yaw outside the tables, roofs smaller
// than the map, hide areas of mismatched lengths, no texture provider, a wall without its first model, out-of-range
// ground colours, a three-level world, a zero view radius.
// Sensitivity: 53 of 54 single-statement mutations of the render half of world.ts (a bound off by one, a swapped
// comparison, a dropped store or cache write, swapped texture-basis arguments, a reversed sort tie-break...) make this
// test fail; the survivor (Fill drawing a linked square's ground with var5 instead of 0) is equivalent, since only
// level-0 squares carry a linked square.
// SR_STATS=1 prints the per-operation result counts; SR_DUMP=<path prefix> writes the script and both outputs.

const W = 256;
const H = 170;

const log: string[] = [];
const call = (token: string): void => {
    log.push(token);
};

function fbHash(): number {
    const p = Pix2D.pixels;
    if (p === null) return -1;
    let h = 0;
    for (let i = 0; i < p.length; i++) h = (Math.imul(31, h) + p[i]) | 0;
    return h;
}

function minY(id: number): number {
    if (id % 7 === 0) return -32768;
    if (id % 11 === 0) return 50 + (id % 13);
    return -((Math.imul(id, 37) % 400) | 0);
}

// The test model, mirroring SceneRenderOracle.TM.
class TM extends ModelSource {
    constructor(readonly id: number) {
        super();
    }

    draw(yaw: number, sinPitch: number, cosPitch: number, sinYaw: number, cosYaw: number, x: number, y: number, z: number, typecode: bigint, level: number, particles: ParticleSystem | null): void {
        call(`D${this.id},${yaw},${sinPitch},${cosPitch},${sinYaw},${cosYaw},${x},${y},${z},${typecode},${level},${particles === null ? 0 : 1}@${fbHash()},${Pix3D.trans}`);
        // A real model leaves the transparency of its last face in Pix3D.trans; the ground renderers must reset it.
        Pix3D.trans = Math.imul(this.id, 37) & 0xff;
    }

    getMinY(): number {
        call(`B${this.id}`);
        return minY(this.id);
    }

    update(arg0: number, arg1: number, arg2: number, arg3: number, arg4: number): void {
        call(`U${this.id},${arg0},${arg1},${arg2},${arg3},${arg4}`);
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

function texel(id: number, i: number): number {
    if ((i * 7 + id) % 13 === 0) return 0;
    let v = Math.imul(i + 1, 0x9e3779b1 | 0) ^ Math.imul(id, 0x85ebca6b | 0);
    v ^= v >>> 13;
    v = Math.imul(v, 0x5bd1e995);
    v ^= v >>> 15;
    return v & 0xffffff;
}

const texels: (Int32Array | null)[] = new Array<Int32Array | null>(16).fill(null);

function pixels(id: number): Int32Array | null {
    if (id < 0 || id >= texels.length || id % 5 === 4) return null;
    let t = texels[id];
    if (t === null) {
        t = Int32Array.from({ length: id % 2 === 0 ? 4096 : 16384 }, (_, i) => texel(id, i));
        texels[id] = t;
    }
    return t;
}

function floatBits(value: number): number {
    const view = new DataView(new ArrayBuffer(4));
    view.setFloat32(0, value);
    return view.getInt32(0);
}

// The texture provider, mirroring SceneRenderOracle.TP (the Java side flags any dummy argument other than the documented
// constant with '!', which the TS side never prints).
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
        return pixels(id);
    },
    isLoaded(id: number): boolean {
        call(`Ld${id}`);
        return true;
    },
    getTextureData(id: number, brightness: number): Int32Array | null {
        call(`P${id},${floatBits(brightness)}`);
        return pixels(id);
    },
    getTextureColour(id: number): number {
        call(`V${id}`);
        return (Math.imul(id, 911) + 300) & 0xffff;
    },
    getTextureSolid(id: number): boolean {
        call(`O${id}`);
        return id % 3 !== 0;
    }
};

const model = (id: number): ModelSource | null => (id < 0 ? null : new TM(id));

// ---- state ----

function hash(values: ArrayLike<number> | null): number {
    if (values === null) return -1;
    let h = 0;
    for (let i = 0; i < values.length; i++) h = (Math.imul(31, h) + values[i]) | 0;
    return h;
}

function hash3(values: ArrayLike<number>[][] | null): number {
    if (values === null) return -1;
    let h = 0;
    for (const plane of values) for (const row of plane) h = (Math.imul(31, h) + hash(row)) | 0;
    return h;
}

// java.lang.String.hashCode
function stringHash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return h;
}

function bits(values: boolean[][] | null): string {
    if (values === null) return 'n';
    let sb = '';
    let acc = 0;
    let n = 0;
    for (const row of values) {
        for (const v of row) {
            acc = (acc << 1) | (v ? 1 : 0);
            if (++n === 4) {
                sb += acc.toString(16);
                acc = 0;
                n = 0;
            }
        }
    }
    if (n > 0) sb += `${acc.toString(16)}/${n}`;
    return `${values.length}x${values.length === 0 ? 0 : values[0].length}:${sb}`;
}

function occluder(c: Occlude | null): string {
    if (c === null) return 'null';
    return `${c.type},${c.mode},${c.minTileX},${c.maxTileX},${c.minTileZ},${c.maxTileZ},${c.minX},${c.maxX},${c.minZ},${c.maxZ},${c.minY},${c.maxY},${c.minDeltaZ},${c.maxDeltaZ},${c.minDeltaY},${c.maxDeltaY},${c.minDeltaX},${c.maxDeltaX}`;
}

function layer(squares: (Square | null)[][][] | null): string {
    if (squares === null) return 'n';
    const seen = new Set<Sprite>();
    const flags: string[] = [];
    const sprites: string[] = [];
    for (const plane of squares) {
        for (const row of plane) {
            for (const r of row) {
                if (r === null) {
                    flags.push('n');
                    continue;
                }
                flags.push(`${r.level}${r.drawFront ? 'F' : 'f'}${r.drawBack ? 'B' : 'b'}${r.drawSprites ? 'S' : 's'}${r.cornerSides},${r.sidesBeforeCorner},${r.sidesAfterCorner},${r.backWallTypes};`);
                for (let i = 0; i < 5; i++) {
                    const s = r.sprites[i];
                    if (s !== null && !seen.has(s)) {
                        seen.add(s);
                        sprites.push(`${s.cycle},${s.distance};`);
                    }
                }
            }
        }
    }
    return `${stringHash(flags.join(''))}/${stringHash(sprites.join(''))}`;
}

function state(): string {
    const w = world;
    let s = `fb=${fbHash()}`;
    s += ` c${w.cycleNo},${w.fillLeft},${w.dynamicCount}`;
    s += ` e${w.cx},${w.cy},${w.cz},${w.gx},${w.eyeTileZ}`;
    s += ` b${w.minX},${w.maxX},${w.minZ},${w.maxZ}`;
    s += ` a${w.cameraSinX},${w.cameraCosX},${w.cameraSinY},${w.cameraCosY}`;
    s += ` p${w.takingInput ? 1 : 0},${w.clickLevel},${w.clickX},${w.clickY},${w.groundX},${w.groundZ}`;
    s += ` l${w.maxLevel},${w.minLevel},${w.squares === null ? 'n' : w.squares === w.mainLevelTiles ? 'm' : w.squares === w.underwaterSquares ? 'u' : '?'}`;
    s += `,${w.levelHeightmaps === null ? 'n' : w.levelHeightmaps === w.mainGroundh ? 'm' : w.levelHeightmaps === w.underwaterHeightmap ? 'u' : '?'}`;
    s += ` r${w.viewRadius},${w.maxTileX},${w.maxTileZ}`;
    s += ` o${w.numOccluders},${w.numActiveOccluders}`;
    for (let i = 0; i < w.numActiveOccluders; i++) {
        const c = arrayAt(w.activeOccluders, i);
        let index = -1;
        for (let j = 0; j < w.numOccluders; j++) if (arrayAt(w.occluders, j) === c) index = j;
        s += ` [${index}:${occluder(c)}]`;
    }
    s += ` v${bits(w.visibilityMap)} cv${bits(w.cornerVisibility)}`;
    s += ` sq${layer(w.mainLevelTiles)} uw${layer(w.underwaterSquares)}`;
    s += ' dyn';
    const dyn = w.dynamicSprites;
    if (dyn !== null) {
        for (let i = 0; i < w.dynamicCount && i < dyn.length; i++) {
            const d = dyn[i];
            s += `${d === null ? '-' : `${d.cycle}/${d.distance}`};`;
        }
    }
    s += ` t${hash3(w.levelTileOcclusionCycles)}`;
    s += ` g${hash(Ground.drawVertexX)},${hash(Ground.drawVertexY)},${hash(Ground.drawTextureVertexX)},${hash(Ground.drawTextureVertexY)},${hash(Ground.drawTextureVertexZ)}`;
    s += ` x${Pix3D.trans},${Pix3D.hclip ? 1 : 0}`;
    s += ` h${hash(w.hiddenRoofY)},${hash(w.roofMinX)},${hash(w.hideAreaMaxX)},${hash(w.roofHideMaxZ)},${hash(w.roofHideMinZ)}`;
    s += ` q${w.drawTileQueue.sentinel.next === w.drawTileQueue.sentinel ? 'empty' : 'busy'}`;
    return s;
}

// ---- inputs shared with the Java side ----

function fill(px: Int32Array | null, seed: number): void {
    const p = requireNonNull(px);
    for (let i = 0; i < p.length; i++) {
        let v = Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
        v ^= v >>> 15;
        p[i] = seed === 0 ? 0 : v;
    }
}

function height(mode: number, seed: number, x: number, z: number): number {
    switch (mode) {
        case 0:
            return -(((x * 13 + z * 7 + seed) % 5) * 24) - 40;
        case 1:
            return -(((x * 31 + z * 17 + seed * 3) % 11) * 70) + 60;
        case 2:
            return -96;
        default:
            return ((((x + seed) / 3) | 0) + ((z / 4) | 0)) % 2 === 0 ? -40 : -520;
    }
}

let roofs: Uint8Array[][] | null = null;
let smallRoofs: Uint8Array[][] | null = null;

function hideAreas(variant: number): (Int32Array | null)[] {
    switch (variant) {
        case 0:
            return [null, null, null, null, null];
        case 1:
            return [Int32Array.of(-1000000, -200, -1000000), Int32Array.of(0, 256, 0), Int32Array.of(0, 900, 0), Int32Array.of(0, 1200, 0), Int32Array.of(0, 128, 0)];
        case 2:
            return [Int32Array.of(-100, 50), Int32Array.of(640, -5000), Int32Array.of(1600, 5000), Int32Array.of(1800, 5000), Int32Array.of(256, -5000)];
        case 3:
            return [Int32Array.of(100000), Int32Array.of(-100000), Int32Array.of(100000), Int32Array.of(100000), Int32Array.of(-100000)];
        case 4:
            return [Int32Array.of(-1000000, -1000000, -50), Int32Array.of(0, 0), Int32Array.of(5000, 5000), Int32Array.of(5000, 5000), Int32Array.of(0, 0)];
        case 5:
            return [Int32Array.of(-400), Int32Array.of(1024), Int32Array.of(1024), Int32Array.of(512), Int32Array.of(512)];
        case 6:
            return [Int32Array.of(-401), Int32Array.of(1024), Int32Array.of(1024), Int32Array.of(512), Int32Array.of(512)];
        case 7:
            return [Int32Array.of(-400), Int32Array.of(1024), Int32Array.of(1023), Int32Array.of(512), Int32Array.of(512)];
        default:
            return [Int32Array.of(-400), Int32Array.of(1024), Int32Array.of(1024), Int32Array.of(512), Int32Array.of(1537)];
    }
}

function runOp(op: string, n: number[], a: bigint[]): string {
    const b = (i: number): boolean => n[i] !== 0;
    switch (op) {
        case 'fb':
            Pix2D.pixels = new Int32Array(Math.imul(n[0], n[1]));
            Pix2D.width = n[0];
            Pix2D.height = n[1];
            Pix2D.clipMinX = n[2];
            Pix2D.clipMinY = n[3];
            Pix2D.clipMaxX = n[4];
            Pix2D.clipMaxY = n[5];
            Pix3D.setRenderClipping();
            return 'ok';
        case 'origin':
            Pix3D.setOrigin(n[0], n[1]);
            return `${Pix3D.originX},${Pix3D.originY}`;
        case 'pal': {
            const colours = new Int32Array(65536);
            for (let i = 0; i < colours.length; i++) colours[i] = (Math.imul(i, 0x9e3779b1 | 0) ^ (i << 7) ^ n[0]) & 0xffffff;
            Pix3D.colourTable = colours;
            return 'ok';
        }
        case 'tp':
            Pix3D.setTextures(b(0) ? provider : null);
            return 'ok';
        case 'tex':
            Preferences.highDetailTextures2 = b(0);
            return 'ok';
        case 'ld':
            Pix3D.lowDetail = b(0);
            return 'ok';
        case 'init':
            world.init(n[0], n[1], n[2], n[3], b(4));
            return 'ok';
        case 'hm': {
            const main = requireNonNull(world.mainGroundh);
            for (let level = 0; level < main.length; level++) for (let x = 0; x < main[level].length; x++) for (let z = 0; z < main[level][x].length; z++) main[level][x][z] = (height(n[0], n[1], x, z) - level * 240) | 0;
            const under = world.underwaterHeightmap;
            if (under !== null) for (let x = 0; x < under[0].length; x++) for (let z = 0; z < under[0][x].length; z++) under[0][x][z] = (height(n[0], n[1] + 7, x, z) + 200) | 0;
            return 'ok';
        }
        case 'seth':
            arrayPut(arrayAt(arrayAt(world.levelHeightmaps, n[0]), n[1]), n[2], n[3]);
            return 'ok';
        case 'roofs':
            roofs = Array.from({ length: n[0] }, (_, level) => Array.from({ length: n[1] }, (_, x) => Uint8Array.from({ length: n[2] }, (_, z) => ((x * 7 + z * 3 + level * 5 + n[3]) % 6) - 1)));
            smallRoofs = Array.from({ length: n[0] }, () => Array.from({ length: (n[1] / 2) | 0 }, () => new Uint8Array(n[2])));
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
        case 'rmspr':
            world.RemoveSprites();
            return 'ok';
        case 'sharelight':
            world.ShareLight(n[0], n[1], n[2]);
            return 'ok';
        case 'pick':
            world.updateMousePicking(n[0], n[1], n[2]);
            return 'ok';
        case 'draw': {
            fill(Pix2D.pixels, n[11]);
            const hide = hideAreas(n[10]);
            const r = n[5] === 0 ? null : n[5] === 1 ? roofs : smallRoofs;
            world.draw(n[0], n[1], n[2], n[3], n[4], r, hide[0], hide[1], hide[2], hide[3], hide[4], n[6], (n[7] << 24) >> 24, n[8], n[9]);
            return 'ok';
        }
        case 'gsweep': {
            fill(Pix2D.pixels, n[5]);
            if (n[2] !== 0) {
                world.takingInput = true;
                world.clickX = n[3];
                world.clickY = n[4];
                world.groundX = -1;
                world.groundZ = -1;
            }
            const plane = arrayAt(world.squares, n[0]);
            for (let x = 0; x < plane.length; x++) {
                for (let z = 0; z < plane[x].length; z++) {
                    const r = plane[x][z];
                    if (r === null) continue;
                    if (r.quickGround !== null) world.renderQuickGround(r.quickGround, n[0], world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, x, z, b(1));
                    else if (r.ground !== null) world.drawTileOverlay(r.ground, world.cameraSinX, world.cameraCosX, world.cameraSinY, world.cameraCosY, x, z, b(1));
                    else continue;
                    call(`t${x},${z}=${fbHash()},${world.groundX},${world.groundZ},${Pix3D.hclip}`);
                }
            }
            world.takingInput = false;
            return 'ok';
        }
        case 'state':
            return 'ok';
        case 'calc':
            world.CalcOcclude();
            return 'ok';
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
        case 'tri':
            return String(world.InsideTriangle(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7]));
        case 'tlc':
            return String(world.TextureLightCol(n[0], n[1]));
        default:
            throw new Error(`unknown op ${op}`);
    }
}

function runTs(line: string): string {
    const f = line.split(' ');
    const op = f[0];
    const a = f.slice(1).map(v => BigInt(v));
    const n = a.map(v => Number(BigInt.asIntN(32, v)));
    log.length = 0;
    let result: string;
    try {
        result = runOp(op, n, a);
    } catch (e) {
        if (e instanceof RangeError && e.message.startsWith('array index')) result = 'aioobe';
        else if (e instanceof RangeError && e.message.startsWith('NegativeArraySizeException')) result = 'nase';
        else if (e instanceof RangeError && e.message === '/ by zero') result = 'arith';
        else if (e instanceof TypeError && (e.message === 'Null reference' || e.message === 'Null array')) result = 'npe';
        else result = `error:${String(e)}`;
    }
    const post = op === 'draw' || op === 'gsweep' || op === 'state' ? state() : '';
    return `${result}|${log.map(t => ' ' + t).join('')}|${post}`;
}

// ---- script ----

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

const HIDDEN = 12345678;
const TEXTURES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function generateScript(): string[] {
    const next = rng(0x530d3d);
    const below = (bound: number): number => (next() >>> 0) % bound;
    const range = (lo: number, hi: number): number => lo + below(hi - lo + 1);
    const pick = <T>(values: readonly T[]): T => values[below(values.length)];
    const chance = (p: number): boolean => (next() >>> 0) / 4294967296 < p;
    const ops: string[] = [];
    let modelId = 1;
    const newModel = (): number => modelId++;
    const optModel = (p = 0.15): number => (chance(p) ? -1 : newModel());

    // A random long; the loc kind in bits 29-30 forced when asked. Bit 22 (SetObj raises obj stacks over such sprites)
    // and bit 31 (Fill draws such ground decor before the walls) are random.
    const typecode = (kind: number | null): string => {
        let low = next() >>> 0;
        if (kind !== null) low = ((low & ~0x60000000) | (kind << 29)) >>> 0;
        const high = below(3) === 0 ? next() : below(4) === 0 ? -1 : below(1000);
        return BigInt.asIntN(64, (BigInt(high) << 32n) | BigInt(low)).toString();
    };

    // The scene being built: its size and heightmap, so ground heights match the heightmap like the map loader's do.
    let size = 0;
    let levels = 0;
    let hmMode = 0;
    let hmSeed = 0;
    let underwater = false;
    const heightAt = (level: number, x: number, z: number): number => (underwater ? height(hmMode, hmSeed + 7, x, z) + 200 : height(hmMode, hmSeed, x, z) - level * 240);

    interface GroundOpts {
        shape?: number;
        rotation?: number;
        texture?: number;
        flat?: boolean;
        hideUnder?: boolean;
        hideOver?: boolean;
    }
    const groundAt = (level: number, x: number, z: number, o: GroundOpts = {}): void => {
        const r = below(20);
        const shape = o.shape ?? (r < 7 ? 0 : r < 10 ? 1 : range(2, 12));
        const rotation = o.rotation ?? below(4);
        const texture = o.texture ?? (below(3) === 0 ? pick(TEXTURES) : -1);
        let hs = [heightAt(level, x, z), heightAt(level, x + 1, z), heightAt(level, x + 1, z + 1), heightAt(level, x, z + 1)];
        if (o.flat ?? chance(0.12)) hs = [hs[0], hs[0], hs[0], hs[0]];
        // Corner colours of one layer share hue and saturation, like real HSL ground, so the gouraud steps stay
        // inside the colour table; a hidden layer (12345678) has all four corners hidden, as the map loader writes it.
        const hideUnder = o.hideUnder ?? ((shape === 0 || shape >= 2) && chance(1 / 14));
        const hideOver = o.hideOver ?? (shape >= 1 && texture === -1 && chance(1 / 14));
        const hsU = range(2, 509) << 7;
        const under = [0, 1, 2, 3].map(() => (hideUnder ? HIDDEN : hsU + range(4, 123)));
        const hsO = range(2, 509) << 7;
        const over = [0, 1, 2, 3].map(() => (hideOver ? HIDDEN : texture >= 0 ? (chance(0.08) ? range(0, 65535) : range(0, 127)) : hsO + range(4, 123)));
        ops.push(`ground ${level} ${x} ${z} ${shape} ${rotation} ${texture} ${hs.join(' ')} ${under.join(' ')} ${over.join(' ')} ${next()} ${next()}`);
    };

    const groundY = (level: number, x: number, z: number): number => heightAt(level, Math.min(x, size), Math.min(z, size));

    const populate = (density: number): void => {
        const lvl = (): number => (below(5) === 0 ? range(1, levels - 1) : 0);
        for (let i = 0; i < Math.round(100 * density); i++) {
            const level = lvl();
            const x = below(size);
            const z = below(size);
            const model2 = chance(0.35) ? newModel() : -1;
            const angle1 = pick([1, 2, 4, 8, 16, 32, 64, 128, 16, 32, 64, 128]);
            ops.push(`wall ${level} ${x} ${z} ${groundY(level, x, z)} ${newModel()} ${model2} ${angle1} ${model2 < 0 ? 0 : pick([1, 2, 4, 8])} ${typecode(0)}`);
        }
        for (let i = 0; i < Math.round(70 * density); i++) {
            const level = lvl();
            const x = below(size);
            const z = below(size);
            const wshape = pick([1, 2, 4, 8, 16, 32, 64, 128, 256, 256, 256, 0, 3]);
            ops.push(`decor ${level} ${x} ${z} ${groundY(level, x, z)} ${optModel(0.05)} ${chance(0.5) ? newModel() : -1} ${wshape} ${below(4)} ${range(-48, 48)} ${range(-48, 48)} ${typecode(1)}`);
        }
        for (let i = 0; i < Math.round(60 * density); i++) {
            const level = lvl();
            const x = below(size);
            const z = below(size);
            ops.push(`gd ${level} ${x} ${z} ${groundY(level, x, z)} ${optModel()} ${typecode(3)} ${below(2)}`);
        }
        for (let i = 0; i < Math.round(60 * density); i++) {
            const level = lvl();
            const x = range(-1, size);
            const z = range(-1, size);
            ops.push(`scen ${level} ${x} ${z} ${groundY(level, Math.max(0, x), Math.max(0, z))} ${pick([1, 1, 1, 2, 2, 3])} ${pick([1, 1, 1, 2, 2, 3])} ${optModel(0.05)} ${below(2048)} ${typecode(2)}`);
        }
        for (let i = 0; i < Math.round(50 * density); i++) {
            const level = lvl();
            const x = below(size);
            const z = below(size);
            ops.push(`obj ${level} ${x} ${z} ${groundY(level, x, z)} ${optModel(0.3)} ${typecode(0)} ${optModel(0.3)} ${optModel(0.3)}`);
        }
    };

    // Occluders: wall planes (types 1 and 2) from storey height down to the ground, and roof planes (type 4) either
    // high above every eye or low enough to hide what is under them.
    const occluders = (count: number): void => {
        for (let i = 0; i < count; i++) {
            const type = pick([1, 2, 4]);
            const tx = below(size) * 128;
            const tz = below(size) * 128;
            const span = range(1, 3) * 128;
            const y0 = range(-460, -250);
            const y1 = range(-150, 20);
            if (type === 1) ops.push(`occ 1 ${tx} ${tx} ${tz} ${tz + span} ${y0} ${y1}`);
            else if (type === 2) ops.push(`occ 2 ${tx} ${tx + span} ${tz} ${tz} ${y0} ${y1}`);
            else {
                const y = chance(0.4) ? -1300 : y0;
                ops.push(`occ 4 ${tx} ${tx + span} ${tz} ${tz + span} ${y} ${y}`);
            }
        }
    };

    const queries = (count: number): void => {
        for (let i = 0; i < count; i++) {
            const level = below(levels);
            const x = below(size);
            const z = below(size);
            switch (below(7)) {
                case 0:
                    ops.push(`gocc ${level} ${x} ${z}`);
                    break;
                case 1:
                    ops.push(`wocc ${level} ${x} ${z} ${pick([1, 2, 4, 8, 16, 32, 64, 128, 0, 3])}`);
                    break;
                case 2:
                    ops.push(`socc ${level} ${x} ${z} ${range(-300, 60)}`);
                    break;
                case 3:
                    ops.push(`lvis ${level} ${x} ${Math.min(size - 1, x + below(3))} ${z} ${Math.min(size - 1, z + below(3))} ${range(-300, 60)}`);
                    break;
                case 4:
                    ops.push(`occluded ${range(0, size * 128)} ${range(-800, 50)} ${range(0, size * 128)}`);
                    break;
                case 5:
                    ops.push(`col ${range(-1500, 1500)} ${range(-1500, 0)} ${range(-500, 400)} ${range(-1500, 1500)} ${pick([3500, 3500, 100, 0])}`);
                    break;
                default:
                    ops.push(`tri ${[0, 1, 2, 3, 4, 5, 6, 7].map(() => range(-60, 60)).join(' ')}`);
            }
        }
    };

    // An eye: mostly over the map looking down; some low over the ground (near-plane clipping of the nearest tiles),
    // outside the map (clamped), under the ground, or with pitches outside the client's 128..383.
    const eye = (): string => {
        const r = below(20);
        let x = range(256, size * 128 - 256);
        let z = range(256, size * 128 - 256);
        let y: number;
        let pitch = range(128, 383);
        if (r < 11) {
            y = groundY(0, x >> 7, z >> 7) - range(350, 1100);
        } else if (r < 14) {
            y = groundY(0, x >> 7, z >> 7) - range(40, 160);
            pitch = range(128, 240);
        } else if (r < 16) {
            x = range(-600, size * 128 + 600);
            z = range(-600, size * 128 + 600);
            y = range(-1400, -500);
        } else if (r < 17) {
            y = range(100, 600);
            pitch = pick([range(1700, 2047), range(0, 128)]);
        } else if (r < 19) {
            y = groundY(0, x >> 7, z >> 7) - range(300, 900);
            pitch = pick([range(0, 127), range(384, 520), 512, 0]);
        } else {
            y = groundY(0, x >> 7, z >> 7) - range(500, 900);
            pitch = 383;
        }
        return `${x} ${y} ${z} ${pitch} ${below(2048)}`;
    };

    const draw = (opts: { roofs?: number; hide?: number; eye?: string } = {}): void => {
        const roofMode = opts.roofs ?? (chance(0.3) ? 1 : 0);
        const hide = opts.hide ?? pick([0, 0, 0, 0, 1, 2, 3]);
        ops.push(`draw ${opts.eye ?? eye()} ${roofMode} ${below(levels + 1)} ${pick([-1, 0, 1, 2, 3, 4])} ${below(size)} ${below(size)} ${hide} ${chance(0.8) ? range(1, 1 << 30) : 0}`);
    };

    const frames = (count: number, dynamics: boolean): void => {
        for (let frame = 0; frame < count; frame++) {
            if (chance(0.5)) ops.push(`pick ${below(levels)} ${range(-(W >> 1) - 4, (W >> 1) + 4)} ${range(-(H >> 1) - 4, (H >> 1) + 4)}`);
            if (dynamics) {
                for (let i = 0; i < 3; i++) {
                    ops.push(`dyn ${below(levels)} ${range(0, size * 128)} ${range(0, size * 128)} ${range(-300, 0)} ${pick([60, 64, 128, 192])} ${optModel(0.1)} ${below(2048)} ${typecode(below(4))} ${below(2)}`);
                }
                if (chance(0.3)) {
                    const x0 = below(size);
                    const z0 = below(size);
                    ops.push(
                        `dyn2 ${below(levels)} ${range(0, size * 128)} ${range(0, size * 128)} ${range(-300, 0)} ${optModel(0.1)} ${below(2048)} ${typecode(0)} ${x0} ${z0} ${Math.min(size - 1, x0 + below(3))} ${Math.min(size - 1, z0 + below(3))}`
                    );
                }
            }
            if (frame % 7 === 3) ops.push(`tex ${below(2)}`);
            if (frame % 11 === 5) ops.push(`ld ${below(2)}`);
            if (frame % 13 === 12) ops.push(`fbl ${below(2)}`);
            if (frame % 13 === 0) ops.push('fbl 0');
            draw();
            if (frame % 4 === 1) ops.push(`gsweep ${below(levels)} ${chance(0.25) ? 1 : 0} ${below(2)} ${range(-(W >> 1), W >> 1)} ${range(-(H >> 1), H >> 1)} ${range(1, 1 << 30)}`);
            queries(6);
            if (dynamics && chance(0.5)) ops.push('rmspr');
        }
    };

    const scene = (opts: { levels: number; size: number; radius: number; underwater: boolean; hm: number; seed: number; density: number; holes: number }): void => {
        levels = opts.levels;
        size = opts.size;
        hmMode = opts.hm;
        hmSeed = opts.seed;
        underwater = false;
        ops.push('reset', `init ${levels} ${size} ${size} ${opts.radius} ${opts.underwater ? 1 : 0}`, `hm ${hmMode} ${hmSeed}`, `roofs ${levels} ${size} ${size} ${below(6)}`);
        // Level 0: every shape in every rotation in turn, the texture/flatness/hidden layers random.
        let k = 0;
        for (let x = 0; x < size; x++) {
            for (let z = 0; z < size; z++) {
                if (chance(opts.holes)) continue;
                groundAt(0, x, z, { shape: k % 13, rotation: ((k / 13) | 0) % 4 });
                k++;
            }
        }
        for (let level = 1; level < levels; level++) for (let i = 0; i < Math.round((40 / level) * opts.density); i++) groundAt(level, below(size), below(size));
        if (opts.underwater) {
            ops.push('under 1');
            underwater = true;
            for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) if (below(4) !== 0) groundAt(0, x, z);
            for (let i = 0; i < 12; i++) ops.push(`scen 0 ${below(size)} ${below(size)} ${height(hmMode, hmSeed + 7, 1, 1) + 200} ${range(1, 2)} ${range(1, 2)} ${newModel()} ${below(2048)} ${typecode(2)}`);
            for (let i = 0; i < 10; i++) ops.push(`wall 0 ${below(size)} ${below(size)} 200 ${newModel()} -1 ${pick([1, 2, 4, 8, 16, 32, 64, 128])} 0 ${typecode(0)}`);
            ops.push('fbl 0', 'under 0');
            underwater = false;
        }
        populate(opts.density);
        occluders(Math.round(10 * opts.density));
        // Bridges: the column moves down one level, level 0 keeping the old ground square as its linked square.
        for (let i = 0; i < 4; i++) {
            const x = below(size);
            const z = below(size);
            groundAt(1, x, z);
            ops.push(`push ${x} ${z}`);
        }
        ops.push('fbl 0', 'state', `sharelight ${range(-60, -10)} ${range(-80, -10)} ${range(-60, -10)}`);
    };

    // ---- the script ----

    ops.push(`fb ${W} ${H} 0 0 ${W} ${H}`, 'pal 0', 'tp 1', 'tex 1', 'ld 1');
    // (6) before init: every routine on the <clinit> statics.
    ops.push('state', 'draw 500 -800 500 300 0 0 0 0 0 0 0 0', 'state', 'calc', 'gocc 0 0 0', 'occluded 0 0 0', 'pick 0 0 0', 'gsweep 0 0 0 0 0 1');

    // (1) the main scene.
    scene({ levels: 4, size: 20, radius: 9, underwater: false, hm: 0, seed: 3, density: 1, holes: 0.06 });
    frames(70, true);
    ops.push('state', 'reset', 'state');

    // (1b) the same kind of scene on rough terrain with a different palette.
    ops.push('pal 77');
    scene({ levels: 4, size: 18, radius: 8, underwater: false, hm: 1, seed: 5, density: 0.8, holes: 0.03 });
    frames(40, true);

    // (2) the underwater layer: both passes of world.draw.
    ops.push('pal 0');
    scene({ levels: 4, size: 16, radius: 8, underwater: true, hm: 0, seed: 9, density: 0.7, holes: 0.3 });
    frames(40, true);

    // (3) one occluder of each mode selected by the eye, with locs around and behind it; flat ground. After each draw:
    // ground sweeps, the occlusion tests on the tiles, world.Occluded swept one unit at a time across the occluder's
    // projected bounds just behind its plane, and (after the first eye) one heightmap corner of a tile behind the plane
    // swept one unit at a time under WallOccluded for every wall mask, so each projected bound is hit exactly.
    interface OcclusionCase {
        occ: string[];
        eyes: string[];
        sweeps: [(v: number) => string, number, number][];
        walls: [number, number, number][];
        hides?: number[];
    }
    const occlusionCase = (c: OcclusionCase): void => {
        levels = 2;
        size = 16;
        hmMode = 2;
        hmSeed = 1;
        underwater = false;
        ops.push('reset', 'init 4 16 16 8 0', 'hm 2 1', 'roofs 4 16 16 1');
        for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) groundAt(0, x, z, { shape: (x * 5 + z) % 13, texture: (x + z) % 4 === 0 ? pick(TEXTURES) : -1, hideUnder: false, hideOver: false });
        populate(0.5);
        ops.push(...c.occ, 'fbl 0');
        c.eyes.forEach((e, index) => {
            ops.push(`pick 0 ${range(-30, 30)} ${range(-20, 20)}`);
            draw({ eye: e, roofs: 0, hide: 0 });
            ops.push(`gsweep 0 0 1 ${range(-30, 30)} ${range(-20, 20)} 5`, `gsweep 0 1 1 ${range(-30, 30)} ${range(-20, 20)} 6`, `gsweep 1 0 1 ${range(-30, 30)} ${range(-20, 20)} 6`);
            for (let x = 0; x < 16; x++) {
                for (let z = 0; z < 16; z++) {
                    for (const level of [0, 1]) ops.push(`wocc ${level} ${x} ${z} ${pick([1, 2, 4, 8, 16, 32, 64, 128])}`);
                    if (z % 3 === 0) {
                        ops.push(`gocc 0 ${x} ${z}`, `socc 0 ${x} ${z} ${range(-300, 0)}`, `socc 1 ${x} ${z} ${range(-300, 0)}`);
                        if (x < 15 && z < 15) ops.push(`lvis 0 ${x} ${x + 1} ${z} ${z + 1} ${range(-300, 0)}`, `lvis 1 ${x} ${Math.min(15, x + 2)} ${z} ${z + 1} ${range(-300, 0)}`);
                    }
                }
            }
            for (const [point, from, to] of c.sweeps) for (let v = from; v <= to; v++) ops.push(`occluded ${point(v)}`);
            if (index === 0) {
                for (const [level, x, z] of c.walls) {
                    const h = heightAt(level, x, z);
                    ops.push(`wocc ${level} ${x} ${z} 1`);
                    for (let v = -420; v <= 420; v++) {
                        ops.push(`seth ${level} ${x} ${z} ${v}`);
                        for (const mask of [1, 2, 4, 8, 16, 32, 64, 128]) ops.push(`wocc ${level} ${x} ${z} ${mask}`);
                        ops.push(`socc ${level} ${x} ${z} -60`, `lvis ${level} ${x} ${x} ${z} ${z} -60`, `lvis ${level} ${x} ${x + 1} ${z} ${z} -60`);
                    }
                    ops.push(`seth ${level} ${x} ${z} ${h}`);
                }
                for (const hide of c.hides ?? []) draw({ eye: e, roofs: 0, hide });
            }
        });
    };
    // mode 1: x plane, eye on its +x side; mode 2: eye on its -x side.
    occlusionCase({
        occ: ['occ 1 1024 1024 512 1536 -400 -40'],
        eyes: ['1424 -600 1024 220 512', '1800 -500 1024 260 512', '1424 -600 900 200 400'],
        sweeps: [
            [v => `1016 -220 ${v}`, 470, 1580],
            [v => `1016 ${v} 1024`, -450, 10],
            [v => `1016 ${v} 520`, -450, 10]
        ],
        walls: [
            [1, 7, 8],
            [0, 7, 8],
            [0, 7, 12]
        ],
        hides: [5, 6, 7, 8, 1]
    });
    occlusionCase({
        occ: ['occ 1 1024 1024 512 1536 -400 -40'],
        eyes: ['624 -600 1024 220 1536', '300 -700 1100 240 1536'],
        sweeps: [
            [v => `1032 -220 ${v}`, 470, 1580],
            [v => `1032 ${v} 1024`, -450, 10]
        ],
        walls: [
            [1, 8, 8],
            [0, 8, 9]
        ]
    });
    // modes 3 and 4: z plane, eye on its +z and -z side (the first eye of mode 3 is level with a tile edge in x).
    occlusionCase({
        occ: ['occ 2 512 1536 1024 1024 -400 -40'],
        eyes: ['1024 -600 1424 220 1024', '1100 -500 1800 250 1024'],
        sweeps: [
            [v => `${v} -220 1016`, 470, 1580],
            [v => `1024 ${v} 1016`, -450, 10]
        ],
        walls: [
            [0, 8, 6],
            [1, 8, 6],
            [1, 6, 7]
        ]
    });
    occlusionCase({
        occ: ['occ 2 512 1536 1024 1024 -400 -40'],
        eyes: ['1024 -600 624 220 0', '900 -650 300 230 0'],
        sweeps: [
            [v => `${v} -220 1032`, 470, 1580],
            [v => `1024 ${v} 1032`, -450, 10]
        ],
        walls: [
            [0, 8, 8],
            [1, 7, 8]
        ]
    });
    // mode 5: a horizontal plane under the eye, including the eye exactly 128 above it (not selected) and 129 above.
    occlusionCase({
        occ: ['occ 4 512 1536 512 1536 -300 -300'],
        eyes: ['1024 -900 1024 383 0', '1024 -900 1024 383 1024', '800 -1000 900 330 300', '1024 -428 1024 383 0', '1024 -429 1024 383 0'],
        sweeps: [
            [v => `${v} -292 1024`, 470, 1580],
            [v => `1024 -292 ${v}`, 470, 1580]
        ],
        walls: [
            [0, 8, 8],
            [1, 8, 9]
        ]
    });
    // Several occluders at once and eyes that select several of them.
    occlusionCase({
        occ: ['occ 4 256 768 256 768 -260 -260', 'occ 1 1280 1280 256 1280 -420 0', 'occ 2 256 1280 1408 1408 -420 0', 'occ 4 1024 1536 1024 1536 -1300 -1300'],
        eyes: ['512 -1000 512 383 0', '400 -900 1200 300 1024', '1500 -700 700 260 1536', '700 -700 1800 240 1024'],
        sweeps: [
            [v => `${v} -250 512`, 200, 820],
            [v => `1272 -200 ${v}`, 200, 1340]
        ],
        walls: [
            [0, 4, 4],
            [1, 9, 5]
        ]
    });

    // (3b) exact boundaries of the visibility test and the ground renderers. With pitch 0 and yaw 0 camera space is the
    // eye-relative world space, so chosen eyes put corner columns, ground vertices and testColumn inputs exactly on the
    // near plane, the far limit and each clip edge (the 256x170 viewport's clip box is x -128..128, y -85..85).
    levels = 2;
    size = 16;
    hmMode = 2;
    hmSeed = 1;
    underwater = false;
    ops.push('reset', 'init 4 16 16 6 0', 'hm 2 1', 'roofs 4 16 16 0');
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) groundAt(0, x, z, { shape: (x + z) % 2 === 0 ? 0 : 2 + ((x * 3 + z) % 11), texture: -1, hideUnder: false, hideOver: false, flat: true });
    ops.push('fbl 0');
    // Level 3 lies at -816, so a corner column's top (-816 - cy - 1000) projects exactly onto the bottom clip edge at
    // depth 512 when cy = -1901; the column four tiles ahead of the eye is at depth 512.
    for (const cy of [-1900, -1901, -1902]) for (const cx of [1024, 1088]) ops.push(`draw ${cx} ${cy} 512 0 0 0 0 0 8 8 0 1`);
    // testColumn on each bound, with the pitch 0 / yaw 0 camera of the last draw.
    for (const z of [48, 49, 50, 51, 52]) ops.push(`col 0 0 0 ${z} 3500`, `col 0 0 0 ${z} 0`, `col 0 0 ${z} 0 3500`);
    for (const v of [84, 85, 86]) ops.push(`col 0 ${v} ${v} 512 3500`, `col 0 ${-v} ${-v} 512 3500`, `col 0 ${v} 0 512 3500`, `col 0 0 ${-v} 512 3500`);
    for (const v of [127, 128, 129]) ops.push(`col ${v} 0 0 512 3500`, `col ${-v} 0 0 512 3500`);
    for (const z of [3499, 3500, 3501]) ops.push(`col 0 0 0 ${z} 3500`);
    // Ground vertices exactly on the screen's left and right edges (x 0 and 256 at depth 512), on the near plane (depth
    // 50) and just in front of it (49); each sweep logs every tile's hclip and pick result.
    for (const e of ['896 -146 512', '896 -146 974', '896 -146 975', '1024 -181 462', '832 -146 512', '960 -146 512']) {
        ops.push(`draw ${e} 0 0 0 0 0 8 8 0 2`, 'gsweep 0 0 1 128 50 3', 'gsweep 0 0 1 -128 -85 3', 'gsweep 0 1 0 0 0 3');
    }
    // Pitch 1024 turns the camera upside down looking backwards (still exact: sin 0, cos -65536), which makes a tile's
    // north-east corner its rightmost vertex: here exactly on the right edge (x 256) of plain tile (8,8) and shaped tile
    // (7,8), with the tile's other vertices inside the viewport.
    // Then again with the plain tile's south-west corner lowered, which folds its second triangle (SW, SE, NW) away from
    // the eye, so the hclip of the first triangle is the one left behind.
    for (const e of ['1024 -146 1664', '896 -146 1664', '1088 -146 1664']) ops.push(`draw ${e} 1024 0 0 0 0 8 8 0 2`, 'gsweep 0 0 1 127 -50 3', 'gsweep 0 1 0 0 0 3');
    ops.push('seth 0 8 8 0', 'draw 1024 -146 1664 1024 0 0 0 0 8 8 0 2', 'gsweep 0 0 1 127 -50 3', 'seth 0 8 8 -96');
    // Diagonal wall decor (wall shape 256) seen from exactly on its diagonal and anti-diagonal (the front and back passes
    // pick model or model2 by comparing the rotated offsets, so a tie matters), with and without a second model.
    for (const angle of [0, 1, 2, 3]) {
        for (const model2 of [newModel(), -1]) {
            ops.push(`decor 0 5 5 -96 ${newModel()} ${model2} 256 ${angle} ${range(-20, 20)} ${range(-20, 20)} ${typecode(1)}`);
            for (const e of ['1024 -700 1024 300 768', '384 -700 1024 300 1280', '384 -700 384 300 1792', '1024 -700 384 300 256', '1088 -650 1088 280 768']) ops.push(`draw ${e} 0 0 0 5 5 0 2`);
        }
    }
    // Edge-on: the eye at ground height looking level, so every ground triangle has zero area.
    ops.push('draw 1024 -96 300 0 0 0 0 0 8 8 0 2', 'gsweep 0 0 1 0 0 4', 'draw 1024 -96 300 0 512 0 0 0 8 8 0 2', 'gsweep 0 0 1 0 0 4');

    // (4) a view radius larger than the map, a clipped framebuffer window and a moved origin.
    ops.push(`fb ${W} ${H} 9 7 ${W - 11} ${H - 5}`);
    scene({ levels: 4, size: 12, radius: 25, underwater: false, hm: 0, seed: 11, density: 0.6, holes: 0.05 });
    frames(12, false);
    ops.push(`origin ${(W >> 1) - 20} ${(H >> 1) + 10}`);
    frames(12, false);
    ops.push(`fb ${W} ${H} 0 0 ${W} ${H}`, `origin 3 ${H - 4}`);
    frames(8, false);
    ops.push(`fb ${W} ${H} 0 0 ${W} ${H}`);

    // (4b) the client's own viewport and view radius: 512x334, radius 25, over a 32x32 world.
    ops.push('fb 512 334 0 0 512 334');
    scene({ levels: 4, size: 32, radius: 25, underwater: false, hm: 0, seed: 13, density: 2.5, holes: 0.02 });
    frames(10, true);
    ops.push(`fb ${W} ${H} 0 0 ${W} ${H}`);

    // (5) textured fields of shaped and plain tiles, flat then cliffs, in every texture/raster detail combination.
    for (const mode of [2, 3]) {
        levels = 1;
        size = 14;
        hmMode = mode;
        hmSeed = 2;
        underwater = false;
        ops.push('reset', 'init 4 14 14 8 0', `hm ${mode} 2`, 'roofs 4 14 14 0');
        let k = 0;
        for (let x = 0; x < 14; x++) {
            for (let z = 0; z < 14; z++) {
                groundAt(0, x, z, { shape: k % 13, rotation: (k >> 2) % 4, texture: pick(TEXTURES), hideUnder: false, hideOver: false, flat: mode === 2 ? true : undefined });
                k++;
            }
        }
        ops.push('fbl 0');
        for (const tex of [1, 0]) {
            for (const ld of [0, 1]) {
                ops.push(`tex ${tex}`, `ld ${ld}`);
                for (const e of ['896 -700 896 383 0', '896 -500 300 300 0', '1400 -450 896 280 512', '896 -600 1500 260 1024', '300 -400 896 330 1536', '500 -300 500 200 1800', '896 -180 896 128 256']) {
                    if (chance(0.5)) ops.push(`pick 0 ${range(-40, 40)} ${range(-30, 30)}`);
                    draw({ eye: e, roofs: 0, hide: 0 });
                }
                ops.push(`gsweep 0 0 1 ${range(-40, 40)} ${range(-30, 30)} 9`);
            }
        }
    }
    ops.push('tex 1', 'ld 1');

    // (6) edges.
    levels = 2;
    size = 8;
    hmMode = 0;
    hmSeed = 4;
    ops.push('reset', 'init 4 8 8 4 0', 'hm 0 4', 'roofs 4 8 8 2');
    for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) groundAt(0, x, z, { hideUnder: false, hideOver: false });
    populate(0.2);
    ops.push('fbl 0');
    // Pitch and yaw outside the sin/cos tables.
    ops.push('draw 500 -800 500 2048 0 0 0 0 2 2 0 1', 'draw 500 -800 500 300 -1 0 0 0 2 2 0 1', 'draw 500 -800 500 300 2048 0 0 0 2 2 0 1');
    // Roofs smaller than the map, roofs from every first level and byte.
    for (let level = 0; level < 3; level++) for (const byte of [-1, 0, 1, 2, 3, 4]) ops.push(`draw 512 -900 512 383 ${below(2048)} 1 ${level} ${byte} 3 3 0 2`);
    ops.push('draw 512 -900 512 383 0 2 0 0 3 3 0 2', 'draw 512 -900 512 383 0 2 1 -1 3 3 0 2');
    // No texture provider: a textured plain tile, then a textured shaped tile, each in both texture detail levels
    // (terrainTextureTriangle and the average-colour lookup both dereference it).
    const ahead = 'draw 576 -600 200 320 0 0 0 0 3 3 0 4';
    ops.push('tex 1', 'ground 0 4 4 1 0 5 -40 -40 -40 -40 1000 1000 1000 1000 60 60 60 60 0 0', 'tp 0', ahead, 'tex 0', ahead, 'tp 1', 'tex 1', ahead);
    ops.push('ground 0 4 4 7 2 6 -40 -60 -40 -60 1000 1000 1000 1000 60 70 80 90 0 0', 'tp 0', ahead, 'tex 0', ahead, 'tp 1', 'tex 1', ahead);
    // Out-of-range ground colours: the gouraud colour-table lookup throws mid-frame.
    ops.push('ground 0 4 4 0 0 -1 -40 -40 -40 -40 70000 70000 70000 70000 0 0 0 0 0 0', ahead, 'state');
    ops.push('ground 0 4 4 0 0 -1 -40 -40 -40 -40 1000 1000 1000 1000 0 0 0 0 0 0', ahead);
    // A wall without its first model: its draw (and the animation update of hidden squares) dereferences it.
    ops.push('wall 0 4 4 -40 -1 77 1 2 99', ahead, 'draw 512 -900 512 383 0 0 0 0 3 3 0 5', 'state', 'wall 0 4 4 -40 5 -1 1 0 99', ahead);
    // Hide areas of mismatched lengths with and without occluders in view, then occluders hiding the whole map.
    ops.push('draw 512 -900 512 383 0 0 0 0 3 3 4 3', 'occ 1 512 512 0 1024 -400 0', 'occ 4 0 1024 0 1024 -350 -350', 'draw 512 -900 512 383 0 0 0 0 3 3 4 3', 'draw 512 -900 512 383 0 0 0 0 3 3 3 3', 'draw 512 -900 512 383 0 0 0 0 3 3 1 3');
    ops.push('pick 0 0 0', ahead, 'pick 0 0 30', 'draw 512 -900 512 383 0 0 0 0 3 3 0 5', 'gsweep 0 0 1 0 20 3', 'gsweep 0 1 1 0 20 3');
    // Direct checks of the helpers over edge values.
    for (const c of [0, 1, 127, 128, 65535, 65408, -1, HIDDEN]) for (const s of [0, 1, 2, 127, 128, 255, 256, 1000, -5]) ops.push(`tlc ${c} ${s}`);
    ops.push('tri 0 0 -5 5 5 -5 5 0', 'tri 2147483647 -2147483648 0 0 0 0 0 0', 'tri 0 0 0 0 0 0 0 0', 'col 0 -100 100 0 3500', 'col 0 0 0 0 0');
    // world.draw reads level 3 of the heightmap: a world of fewer levels cannot be drawn (and a zero-radius one can).
    ops.push('reset', 'init 3 8 8 4 0', 'hm 0 4', 'draw 512 -900 512 383 0 0 0 0 3 3 0 7', 'state');
    ops.push('reset', 'init 4 8 8 0 0', 'hm 0 4', 'ground 0 4 4 0 0 -1 -40 -40 -40 -40 1000 1000 1000 1000 0 0 0 0 0 0', 'fbl 0', 'draw 576 -300 576 383 0 0 0 0 3 3 0 8', 'state');
    return ops;
}

// ---- oracle ----

function runOracle(script: string[]): string[] {
    const source = fileURLToPath(new URL('./scene-render/SceneRenderOracle.java', import.meta.url));
    const dir = mkdtempSync(join(tmpdir(), 'scene-render-oracle-'));
    try {
        const javac = spawnSync('javac', ['-nowarn', '-cp', gamepackPath, '-d', dir, source], { timeout: 60000, encoding: 'utf8' });
        if (javac.status !== 0) throw new Error(`javac failed: ${javac.stderr}`);
        const java = spawnSync('java', ['-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + dir, 'SceneRenderOracle'], {
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

// ---- static state: the fresh-JVM values of everything the script touches ----

// The world statics as world.<clinit> leaves them (all unset; groundX/groundZ -1).
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

// kb's statics as kb.<clinit> stores them: the shape tables the Ground constructor reads and the draw scratch arrays
// drawTileOverlay writes. entities.test.ts ends with Ground.unload(), which nulls them all, so they are put back here
// (any slip in these tables would show as a mismatch against the jar).
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

// dc.<clinit>: the tables, the 1024-entry scanline offsets and colour table, brightness 1.0, no provider.
function pix3dClinit(): Record<string, unknown> {
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

function pix2dClinit(): Record<string, unknown> {
    return { pixels: null, width: 0, height: 0, clipMinX: 0, clipMinY: 0, clipMaxX: 0, clipMaxY: 0 };
}

test('world render matches client.jar: draws, fills, ground rasterization, picking and occlusion on seeded scenes', () => {
    const script = generateScript();
    const want = runOracle(script);

    const targets: [Record<string, unknown>, Record<string, unknown>][] = [
        [world as unknown as Record<string, unknown>, worldClinit()],
        [Ground as unknown as Record<string, unknown>, groundClinit()],
        [Pix3D as unknown as Record<string, unknown>, pix3dClinit()],
        [Pix2D as unknown as Record<string, unknown>, pix2dClinit()],
        [Preferences as unknown as Record<string, unknown>, { highDetailTextures2: Preferences.highDetailTextures2 }]
    ];
    const saved = targets.map(([target, clinit]) => Object.keys(clinit).map(key => [target, key, target[key]] as const));
    for (const [target, clinit] of targets) Object.assign(target, clinit);
    world.drawTileQueue.clear();

    const got: string[] = [];
    try {
        for (const line of script) got.push(runTs(line));
    } finally {
        for (const entries of saved) for (const [target, key, value] of entries) target[key] = value;
        world.drawTileQueue.clear();
        roofs = null;
        smallRoofs = null;
    }

    if (process.env.SR_DUMP) {
        writeFileSync(`${process.env.SR_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.SR_DUMP}.java`, want.join('\n') + '\n');
        writeFileSync(`${process.env.SR_DUMP}.ts`, got.join('\n') + '\n');
    }

    expect(want.length).toBe(script.length);
    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 6; i++) {
        if (got[i] !== want[i]) {
            const w = want[i];
            const g = got[i];
            let at = 0;
            while (at < w.length && w[at] === g[at]) at++;
            const from = Math.max(0, at - 300);
            mismatches.push(`#${i} ${script[i]}\n  first difference at ${at}\n  java: ...${w.slice(from, at + 400)}\n  ts:   ...${g.slice(from, at + 400)}`);
        }
    }
    expect(mismatches).toEqual([]);

    if (process.env.SR_STATS) {
        const counts = new Map<string, number>();
        script.forEach((line, i) => {
            const key = `${line.split(' ')[0]}:${want[i].slice(0, want[i].indexOf('|'))}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });
        console.log(
            [...counts.entries()]
                .sort()
                .map(([k, v]) => `${k}=${v}`)
                .join(' ')
        );
    }

    // The script reaches what it claims to.
    const draws = want.filter((_, i) => script[i].startsWith('draw '));
    const okDraws = draws.filter(l => l.startsWith('ok|'));
    expect(okDraws.length).toBeGreaterThan(250);
    expect(okDraws.filter(l => l.includes(' D')).length).toBeGreaterThan(200);
    const joined = want.join('\n');
    expect(joined.split(' D').length).toBeGreaterThan(8000);
    expect(joined.split(' U').length).toBeGreaterThan(1000);
    expect(joined.split(' B').length).toBeGreaterThan(1000);
    // textured ground in high detail (texel fetch) and in low detail (average colour), and the missing-texel fallback
    expect(joined.includes(' P')).toBe(true);
    expect(joined.includes(' V')).toBe(true);
    // picking hit ground in draws and in sweeps
    expect(okDraws.some(l => / p0,\d+,-?\d+,-?\d+,\d+,\d+ /.test(l))).toBe(true);
    expect(want.some((l, i) => script[i].startsWith('gsweep ') && / p0,\d+,-?\d+,-?\d+,\d+,\d+ /.test(l))).toBe(true);
    // every occluder mode selected in a draw
    for (let mode = 1; mode <= 5; mode++)
        expect(
            okDraws.some(l => new RegExp(` \\[\\d+:${mode === 5 ? 4 : mode <= 2 ? 1 : 2},${mode},`).test(l)),
            `occluder mode ${mode}`
        ).toBe(true);
    // the underwater pass ran (its layer exists) and drew models
    expect(want.some((l, i) => script[i].startsWith('draw ') && l.startsWith('ok|') && l.includes(' D') && !l.includes(' uwn '))).toBe(true);
    // every exception kind the edges set up
    for (const kind of ['aioobe', 'npe'])
        expect(
            draws.some(l => l.startsWith(`${kind}|`)),
            kind
        ).toBe(true);
    expect(want.filter(l => l.startsWith('true|')).length).toBeGreaterThan(50);
}, 240000);
