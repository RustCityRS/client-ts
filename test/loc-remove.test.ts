import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import LocType from '#/config/LocType.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Decor from '#/dash3d/Decor.js';
import GroundDecor from '#/dash3d/GroundDecor.js';
import LocChange from '#/dash3d/LocChange.js';
import Sprite from '#/dash3d/Sprite.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import world from '#/dash3d/world.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import bgsound from '#/sound/bgsound.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

interface Case {
    layer: number;
    shape: number;
    angle: number;
    plane: number;
    x: number;
    z: number;
    width: number;
    length: number;
    block: number;
    id: number;
    sound: number;
    mode: number;
    fail: number;
    range: number;
    heightLevel: number;
}
const common: Case = { layer: 2, shape: 10, angle: 0, plane: 1, x: 24, z: 31, width: 2, length: 3, block: 1, id: 101, sound: 1, mode: 0, fail: 0, range: 1, heightLevel: 2 };
function wire(c: Case): string {
    return [c.layer, c.shape, c.angle, c.plane, c.x, c.z, c.width, c.length, c.block, c.id, c.sound, c.mode, c.fail, c.range, c.heightLevel].join(' ');
}
function cases(): Case[] {
    const rows: Case[] = [];
    for (const shape of [0, 1, 2, 3, 4, 9, 21, 31, 32, 35, 63])
        for (const angle of [0, 1, 2, 3]) {
            for (const range of [0, 1]) rows.push({ ...common, layer: 0, shape, angle, range });
        }
    for (const layer of [-2, 0, 1, 2, 3, 4])
        for (const block of [0, 1, 2, -1])
            for (const sound of [0, 1, 2, 3]) {
                rows.push({ ...common, layer, block, sound, heightLevel: -99 });
            }
    for (const layer of [-1, 0, 1, 2, 3, 4]) {
        for (const mode of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14]) rows.push({ ...common, layer, mode });
        for (let fail = 1; fail <= 7; fail++) rows.push({ ...common, layer, fail });
    }
    for (const [x, z] of [
        [0, 0],
        [102, 31],
        [31, 102],
        [101, 101],
        [103, 103],
        [-1, 72],
        [30, 104]
    ]) {
        for (const [width, length] of [
            [1, 1],
            [1, 2],
            [2, 1],
            [3, 5],
            [5, 3],
            [-10, -3],
            [2147483647, -1]
        ]) {
            rows.push({ ...common, x, z, width, length, angle: 1 });
        }
    }
    for (const angle of [0, 1, 2, 3])
        for (const plane of [0, 2, 3, 4])
            for (const id of [0, 2147483646]) {
                rows.push({ ...common, angle, plane, id });
            }
    return rows;
}

function digest(flags: Int32Array[] | null): string {
    if (flags === null) return '-';
    const hash = createHash('sha256');
    for (const row of flags) {
        const bytes = Buffer.alloc(row.length * 4);
        row.forEach((v, i) => bytes.writeInt32BE(v, i * 4));
        hash.update(bytes);
    }
    return hash.digest('hex');
}
function cell(s: Square | null, sprite: Sprite): string {
    if (s === null) return '-';
    const refs = s.sprites.map(item => (item === null ? 0 : item === sprite ? 1 : 2)).join(',');
    return [Number(s.wall !== null), Number(s.decor !== null), Number(s.groundDecor !== null)].join('') + ':' + s.spriteCount + ':' + s.spriteSpans + ':[' + s.spriteSpan.join(', ') + ']:' + refs;
}

function run(c: Case): string {
    const type = new LocType();
    type.id = c.id;
    type.width = c.width;
    type.length = c.length;
    type.blockwalk = c.block;
    type.blockrange = c.range !== 0;
    type.ambientSound = c.sound === 1 ? 29 : -1;
    if (c.sound === 2) type.randomSounds = new Int32Array(0);
    if (c.sound === 3) type.multi = Int32Array.of(-1, 10101);
    const child = new LocType();
    child.id = 10101;
    child.randomSounds = new Int32Array(0);
    const zero = c.id === 0 ? type : new LocType();
    zero.id = 0;
    zero.ambientSound = c.sound === 0 ? -1 : 800;
    const types = new LRUHashCache<LocType>(64);
    types.Put(0n, zero);
    types.Put(BigInt(c.id), type);
    types.Put(10101n, child);
    Reflect.set(LocType, 'm_recentUse', c.mode === 8 ? null : types);
    world.squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array<Square | null>(104).fill(null)));
    const sprite = new Sprite();
    let square: Square | null = null,
        neighbor: Square | null = null;
    if (c.plane >= 0 && c.plane < 4 && c.x >= 0 && c.x < 104 && c.z >= 0 && c.z < 104 && c.mode !== 1) {
        square = world.squares[c.plane][c.x][c.z] = new Square(c.plane, c.x, c.z);
        const key = c.mode === 2 ? 0n : BigInt.asIntN(64, (1n << 63n) | (BigInt(c.id) << 32n) | 0x40000000n | (BigInt(c.angle & 3) << 20n) | (BigInt(c.shape & 63) << 14n) | 0x39n);
        square.wall = new Wall();
        square.wall.typecode = key;
        square.decor = new Decor();
        square.decor.typecode = key;
        square.groundDecor = new GroundDecor();
        square.groundDecor.typecode = key;
        sprite.level = c.plane;
        sprite.minTileX = c.x;
        sprite.maxTileX = c.mode === 12 ? 104 : Math.min(c.x + 1, 103);
        sprite.minTileZ = sprite.maxTileZ = c.z;
        sprite.typecode = key;
        const other = new Sprite();
        square.sprites[0] = other;
        square.sprites[1] = sprite;
        square.sprites[2] = other;
        square.spriteCount = 3;
        square.spriteSpan.set([1, 4, 8]);
        square.spriteSpans = 13;
        if (c.x + 1 < 104) {
            neighbor = world.squares[c.plane][c.x + 1][c.z] = new Square(c.plane, c.x + 1, c.z);
            neighbor.sprites[0] = sprite;
            neighbor.spriteCount = 1;
            neighbor.spriteSpan[0] = 9;
            neighbor.spriteSpans = 9;
        }
        if (c.mode === 9) square.sprites[0] = null;
        if (c.mode === 10) square.spriteSpan = new Int32Array(1);
    }
    const collision = new CollisionMap(104, 104);
    for (const row of collision.flags) row.fill(-1);
    if (c.mode === 4) Reflect.set(collision, 'flags', null);
    if (c.mode === 5 && c.x >= 0 && c.x < 104) collision.flags[c.x] = new Int32Array(Math.max(0, c.z));
    if (c.mode === 7) world.squares = null;
    AreaSoundManager.locs.clear();
    const sounds = Array.from({ length: 3 }, (_, i) => {
        const s = new bgsound();
        s.plane = c.plane;
        s.minX = (c.x + (i === 0 ? 1 : 0)) * 128;
        s.minZ = c.z * 128;
        s.loc = c.mode === 1 || c.mode === 2 || c.layer < 0 || c.layer > 3 ? zero : type;
        AreaSoundManager.locs.push_back(s);
        return s;
    });
    if (c.mode === 6) sounds[1].loc = null;
    const trace: string[] = [];
    const fault = new Error('observation');
    const restore: (() => void)[] = [];
    function observe(target: object, method: string, name: string): void {
        const native = Reflect.get(target, method);
        if (typeof native !== 'function') throw new Error(method);
        Reflect.set(target, method, function (this: unknown, ...args: unknown[]) {
            trace.push(name === 'type' ? 'type=' + args[0] : name);
            if (trace.length === c.fail) throw fault;
            if (name === 'type' && c.mode === 13 && square) square.wall = null;
            if (name === 'scene-' && c.mode === 14) {
                type.width = 4;
                type.length = 2;
            }
            return Reflect.apply(native, this, args);
        });
        restore.push(() => Reflect.set(target, method, native));
    }
    for (const [method, name] of [
        ['WallType', 'wall'],
        ['DecorType', 'decor'],
        ['SceneType', 'scene'],
        ['GdType', 'ground'],
        ['DelWall', 'wall-'],
        ['DelDecor', 'decor-'],
        ['DelLoc', 'scene-'],
        ['DelGroundDecor', 'ground-']
    ])
        observe(world, method, name);
    observe(LocType, 'List', 'type');
    observe(LocType.prototype, 'HasBgSound', 'sound?');
    observe(AreaSoundManager, 'removeLoc', 'sound-');
    observe(CollisionMap.prototype, 'delWall', 'cw');
    observe(CollisionMap.prototype, 'delLoc', 'cl');
    observe(CollisionMap.prototype, 'unblockGroundDecor', 'cg');
    let result = 'ok';
    try {
        LocChange.removeUnchecked(c.mode === 3 ? null : collision, c.x, c.heightLevel, c.plane, c.z, c.layer);
    } catch (e) {
        if (e === fault) result = 'injected';
        else if (e instanceof TypeError && /null/i.test(e.message)) result = 'null';
        else if (e instanceof RangeError && /^array index -?\d+$/.test(e.message)) result = e.message.substring(6);
        else throw e;
    } finally {
        for (const revert of restore) revert();
    }
    return [result, trace.join(','), sounds.map(s => Number(s.IsLinked())).join(''), cell(square, sprite), cell(neighbor, sprite), digest(collision.flags)].join('|');
}

loginFixture(
    import.meta.url,
    'location removal matches native scene, config, area sound and collision mutation order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-remove-loc-'));
        const opens = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        try {
            const compile = Bun.spawnSync(['javac', ...opens, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'LocRemoveOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', ...opens, '-Djava.awt.headless=true', '-XX:-OmitStackTraceInFastThrow', '-cp', dir + delimiter + gamepackPath, 'LocRemoveOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const rows = cases();
            const original = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(wire).join('\n') + '\n') });
            expect(original.exitCode, original.stderr.toString()).toBe(0);
            const lines = original.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            for (const [i, c] of rows.entries()) expect(run(c), wire(c)).toBe(lines[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
