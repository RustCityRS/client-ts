import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Decor from '#/dash3d/Decor.js';
import GroundDecor from '#/dash3d/GroundDecor.js';
import LocChange from '#/dash3d/LocChange.js';
import Sprite from '#/dash3d/Sprite.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import world from '#/dash3d/world.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import SceneCutover from '#/scene/SceneCutover.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

type Row = [number, number, bigint, number, number];
const lookups = { WallType: world.WallType, DecorType: world.DecorType, SceneType: world.SceneType, GdType: world.GdType };
const names = { WallType: 'ke', DecorType: 'gk', SceneType: 'j', GdType: 'dd' } as const;
function tile(p: number, x: number, z: number, key: bigint) {
    const t = new Square(p, x, z);
    t.wall = new Wall();
    t.wall.typecode = key;
    t.decor = new Decor();
    t.decor.typecode = key;
    t.groundDecor = new GroundDecor();
    t.groundDecor.typecode = key;
    const sprite = new Sprite();
    sprite.typecode = key;
    sprite.minTileX = x;
    sprite.minTileZ = z;
    t.sprites[0] = sprite;
    t.spriteCount = 1;
    return t;
}
function run([layer, mode, key, initialAngle, fail]: Row, observed: boolean, throughQueue: boolean) {
    const change = new LocChange();
    change.layer = layer;
    change.x = 1;
    change.z = 1;
    change.oldAngle = -67;
    change.oldShape = 63;
    change.oldId = 13579;
    const squares = Array.from({ length: 2 }, () => Array.from({ length: 3 }, () => new Array<Square | null>(3).fill(null)));
    world.squares = squares;
    const square = (squares[0][1][1] = tile(0, 1, 1, key));
    squares[1][2][2] = tile(1, 2, 2, BigInt.asIntN(64, key ^ 0x811111110031c000n));
    if (mode >= 20) {
        requireNonNull(square.decor).typecode = key ^ 0x300000001n;
        requireNonNull(square.groundDecor).typecode = key ^ 0x7fffffff0017c000n;
    }
    switch (mode) {
        case 1:
            squares[0][1][1] = null;
            break;
        case 2:
            square.wall = null;
            square.decor = null;
            square.groundDecor = null;
            square.spriteCount = 0;
            break;
        case 3:
            world.squares = null;
            break;
        case 4:
            world.squares = [];
            break;
        case 5:
            Reflect.set(squares, 0, null);
            break;
        case 6:
            squares[0] = [[]];
            break;
        case 7:
            Reflect.set(squares[0], 1, null);
            break;
        case 8:
            squares[0][1] = [];
            break;
        case 9:
            square.sprites[0] = null;
            break;
        case 10:
            Reflect.set(square, 'sprites', null);
            break;
        case 11:
            square.sprites = [];
            break;
        case 12:
            square.spriteCount = -2;
            break;
        case 13:
            square.spriteCount = 2147483647;
            break;
        case 14:
            square.sprites[1] = square.sprites[0];
            square.sprites[0] = new Sprite();
            square.sprites[0].typecode = 0x20000000n;
            square.spriteCount = 2;
            break;
        case 15:
            requireNonNull(square.sprites[0]).minTileX = 2;
            square.sprites[1] = null;
            square.spriteCount = 2;
            break;
        case 16:
            requireNonNull(square.sprites[0]).minTileZ = 2;
            break;
        case 17:
            change.plane = 2;
            break;
        case 18:
            change.z = -1;
            break;
    }
    const data = { layer: change.layer, plane: change.plane, x: change.x, z: change.z, oldAngle: change.oldAngle, oldShape: change.oldShape, oldId: change.oldId };
    const trace: string[] = [],
        failure = new Error('watchpoint');
    let step = 0,
        reads = 0;
    function watch(text: string) {
        trace.push(text);
        if (++step === fail) throw failure;
    }
    if (observed) {
        const input = { layer: 'z', plane: 't', x: 'w', z: 'N' } as const,
            output = { oldAngle: 'B', oldShape: 'D', oldId: 'K' } as const;
        for (const field of Object.keys(input) as (keyof typeof input)[]) {
            Object.defineProperty(change, field, {
                get() {
                    const v = mode === 23 && field === 'layer' ? reads++ : data[field];
                    watch(input[field] + '=' + v);
                    return v;
                }
            });
        }
        for (const field of Object.keys(output) as (keyof typeof output)[]) {
            Object.defineProperty(change, field, {
                get: () => data[field],
                set(value: number) {
                    watch(output[field] + '<-' + value);
                    data[field] = value;
                }
            });
        }
    }
    for (const method of Object.keys(lookups) as (keyof typeof lookups)[]) {
        if (observed) {
            world[method] = (p, x, z) => {
                watch(names[method] + '(' + [p, x, z].join(',') + ')');
                const result = lookups[method](p, x, z);
                if (mode >= 20 && mode <= 22) {
                    data.layer++;
                    if (mode === 21) {
                        data.plane = 1;
                        data.x = 2;
                        data.z = 2;
                    }
                    if (mode === 22) world.squares = null;
                }
                return result;
            };
        } else {
            world[method] = lookups[method];
        }
    }
    let status = 'ok';
    try {
        if (throughQueue) {
            Client.locChanges = new SharedPtrList<LocChange>();
            Client.locChanges.push_back(change);
            Client.LocChangePostBuildCorrect();
        } else if (mode === 19) Reflect.apply(Client.LocChangeSetOld, Client, [null, initialAngle]);
        else if (initialAngle === 0) Client.LocChangeSetOld(change);
        else Client.LocChangeSetOld(change, initialAngle);
    } catch (e) {
        if (e === failure) status = 'probe';
        else if (e instanceof RangeError && e.message.startsWith('array index ')) status = 'bounds:' + e.message.slice(12);
        else if (e instanceof TypeError) status = 'null';
        else throw e;
    }
    return [status, [change.oldAngle, change.oldShape, change.oldId].join(','), trace.join(';')].join('|');
}

loginFixture(
    import.meta.url,
    'native previous location lookup and field stores match de.a on actual 530 squares',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-loc-change-old-')),
            probe = join(dir, 'observed');
        const savedCutover = SceneCutover.native,
            savedQueue = Client.locChanges;
        try {
            SceneCutover.native = true;
            const flags = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...flags, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/LocChangeSetOldOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const cp = dir + delimiter + gamepackPath;
            mkdirSync(probe);
            const instrument = Bun.spawnSync(['java', ...flags, '-cp', cp, 'LocChangeSetOldOracle', gamepackPath, probe]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            for (const observed of [false, true]) {
                const rows: Row[] = [],
                    base = 0xfedcba98402c0005n;
                if (!observed) {
                    const ids = [0n, 1n, 0x80000000n, 0x7fffffffn, 0xffffffffn];
                    for (let layer = 0; layer < 4; layer++)
                        for (let shape = 0; shape < 32; shape++)
                            for (let angle = 0; angle < 4; angle++) {
                                const id = ids[(shape + angle + layer) % ids.length];
                                rows.push([layer, 0, BigInt.asIntN(64, (id << 32n) | 0x40000000n | BigInt(angle << 20) | BigInt(shape << 14) | 0x3fffn), 12, 0]);
                            }
                    for (const layer of [-2147483648, -1, 0, 1, 2, 3, 4, 2147483647]) for (let mode = 0; mode <= 19; mode++) for (const key of [0n, -1n, base]) rows.push([layer, mode, BigInt.asIntN(64, key), -2147483648, 0]);
                    for (const layer of [0, 1, 2, 3, 8]) for (const angle of [0, -1, 1, 7, 2147483647]) for (const raw of [0n, 0x8000000000000000n, 0x7fffffffn, 0xffffffff00000000n]) rows.push([layer, 0, BigInt.asIntN(64, raw), angle, 0]);
                } else {
                    for (const layer of [-1, 0, 1, 2, 3, 4])
                        for (const mode of [0, 1, 10, 20, 21, 22, 23]) {
                            for (const fail of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]) rows.push([layer, mode, BigInt.asIntN(64, base), -37, fail]);
                        }
                }
                const directCount = rows.length;
                // l.b always passes zero and visits only non-null, retained queue entries.
                for (const [layer, mode, key, , fail] of rows.slice()) if (mode !== 19) rows.push([layer, mode, key, 0, fail]);
                const wire = rows.map(([l, m, k, a, f]) => [l, m, BigInt.asUintN(64, k).toString(16), a, f].join(' '));
                const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', ...flags, '-cp', observed ? probe + delimiter + cp : cp, 'LocChangeSetOldOracle'], {
                    stdin: Buffer.from(wire.join('\n') + '\n'),
                    maxBuffer: 4 * 1024 * 1024
                });
                expect(java.exitCode, java.stderr.toString()).toBe(0);
                const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
                expect(lines.length).toBe(rows.length);
                for (const [i, row] of rows.entries()) expect(run(row, observed, i >= directCount), wire[i]).toBe(lines[i]);
            }
        } finally {
            SceneCutover.native = savedCutover;
            Client.locChanges = savedQueue;
            Object.assign(world, lookups);
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
