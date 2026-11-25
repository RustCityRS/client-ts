import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import CollisionMap from '#/dash3d/CollisionMap.js';
import { gamepackPath } from './reference.js';

test('ke mutations and reach predicates match Java, including partial updates, offsets and signed overflow', () => {
    const commands: number[][] = [];
    const add = (op: number, ...args: number[]) => commands.push([op, ...args, ...Array<number>(9 - args.length).fill(0)]);
    for (const [width, height] of [
        [0, 0],
        [0, 9],
        [9, 0],
        [0, -1],
        [-1, 4],
        [14, 19],
        [6, 6],
        [8, 11]
    ])
        add(0, width, height);
    add(1, 18, -13);
    for (const [x, z] of [
        [-1, -1],
        [0, 0],
        [1, 1],
        [7, 10],
        [7, 0],
        [0, 10],
        [8, 11],
        [5, 5]
    ]) {
        for (let shape = -1; shape <= 4; shape++)
            for (let angle = -1; angle <= 4; angle++)
                for (const range of [0, 1]) {
                    add(2, 0);
                    add(4, x + 18, z - 13, shape, angle, range);
                    add(2, -1);
                    add(5, x + 18, z - 13, shape, angle, range);
                }
        for (const [w, h] of [
            [-1, 1],
            [0, 0],
            [0, 4],
            [4, 0],
            [1, 1],
            [2, 3],
            [5, 2]
        ]) {
            for (let angle = -1; angle <= 4; angle++) {
                add(6, x + 18, z - 13, w, h, angle & 1);
                add(7, x + 18, z - 13, w, h, angle & 1, angle);
            }
        }
        for (const op of [8, 9, 10]) add(op, x + 18, z - 13);
        for (let bit = 0; bit < 32; bit++) {
            add(11, x, z, 1 << bit);
            add(12, x, z, 1 << bit);
        }
    }
    add(3);
    add(0, 15, 16);
    add(1, 40, -20);
    for (const flag of [0, -1, ...Array.from({ length: 32 }, (_, i) => 1 << i)]) {
        add(2, flag);
        for (const size of [1, 2, 4])
            for (const [dx, dz] of [
                [-size, 0],
                [1, 0],
                [0, -size],
                [0, 1],
                [-size, 1],
                [1, -size],
                [0, 9],
                [0, 0],
                [-1, -1],
                [1, 1]
            ]) {
                for (let shape = -1; shape <= 11; shape++)
                    for (let angle = -1; angle <= 4; angle++) {
                        for (const op of [13, 14]) add(op, 46 + dx, -13 + dz, size, 46, -13, shape, angle);
                    }
            }
    }
    for (const flag of [0, 2, 8, 32, 128, -1]) {
        add(2, flag);
        for (let dx = -4; dx <= 4; dx++)
            for (let dz = -4; dz <= 4; dz++)
                for (const [size, sizeZ, w, h] of [
                    [1, 1, 3, 2],
                    [2, 2, 1, 1],
                    [4, 4, 1, 1],
                    [2, 2, 3, 3],
                    [2, 4, 1, 2],
                    [1, 1, 0, 0],
                    [0, 0, 1, 2],
                    [-1, 2, 0, 3]
                ]) {
                    for (let sides = 0; sides <= 15; sides++) {
                        for (const op of [15, 16, 17]) add(op, 46 + dx, -13 + dz, size, 46, -13, w, h, sides, sizeZ);
                    }
                }
    }
    for (const coord of [-2147483648, -1, 0, 2147483646, 2147483647]) {
        for (const size of [-1, 0, 1, 2, 4])
            for (const shape of [0, 2, 6, 7, 8, 9])
                for (const op of [13, 14, 15, 16]) {
                    add(op, coord, coord, size, coord, coord, shape, 1, 0, size);
                }
    }

    const bytes = Buffer.alloc(4 + commands.length * 40);
    let cursor = bytes.writeInt32BE(commands.length);
    for (const args of commands) for (const value of args) cursor = bytes.writeInt32BE(value, cursor);
    mkdirSync(resolve('out'), { recursive: true });
    const dir = mkdtempSync(resolve('out', 'collision-oracle-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'CollisionOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CollisionOracle'], { stdin: bytes, maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
        expect(run.stderr.toString()).toBe('');
        expect(run.exitCode).toBe(0);
        let map = new CollisionMap(0, 0);
        let read = 0;
        const next = () => {
            const value = run.stdout.readInt32BE(read);
            read += 4;
            return value;
        };
        for (const command of commands) {
            const [op, x, z, size, tx, tz, w, h, side, sizeZ] = command;
            let result = 1;
            try {
                switch (op) {
                    case 0:
                        map = new CollisionMap(x, z);
                        break;
                    case 1:
                        map['originX'] = x;
                        map['originZ'] = z;
                        break;
                    case 2:
                        for (const row of map.flags) row.fill(x);
                        break;
                    case 3:
                        map.reset();
                        break;
                    case 4:
                        map.addWall(x, z, size, tx, !!tz);
                        break;
                    case 5:
                        map.delWall(x, z, size, tx, !!tz);
                        break;
                    case 6:
                        map.addLoc(x, z, size, tx, !!tz);
                        break;
                    case 7:
                        map.delLoc(x, z, size, tx, w, !!tz);
                        break;
                    case 8:
                        map.blockGround(x, z);
                        break;
                    case 9:
                        map.blockGroundDecor(x, z);
                        break;
                    case 10:
                        map.unblockGroundDecor(x, z);
                        break;
                    case 11:
                        map['addFlag'](size, x, z);
                        break;
                    case 12:
                        map['removeFlag'](size, x, z);
                        break;
                    case 13:
                        result = +map.testWall(x, z, size, tx, tz, w, h);
                        break;
                    case 14:
                        result = +map.testWallDecor(x, z, size, tx, tz, w, h);
                        break;
                    case 15:
                        result = +map.testLoc(x, z, size, tx, tz, w, h, side);
                        break;
                    case 16:
                        result = +map['overlaps'](z, tz, size, h, tx, w, x, sizeZ);
                        break;
                    case 17:
                        result = +map['touches'](h, z, x, w, tx, size, side, tz, sizeZ);
                        break;
                    default:
                        throw Error(String(op));
                }
            } catch (error) {
                if (!(error instanceof RangeError)) throw error;
                result = -1;
            }
            const expected = next();
            if (result !== expected) throw Error('ke ' + command.join(',') + ' returned ' + result + ', expected ' + expected);
            if (op <= 12) {
                expect(map.flags.length).toBe(next());
                for (const row of map.flags) {
                    expect(row.length).toBe(next());
                    for (const flag of row) {
                        const java = next();
                        if (flag !== java) throw Error('ke ' + command.join(',') + ' flag ' + flag + ', expected ' + java);
                    }
                }
            }
        }
        expect(read).toBe(run.stdout.length);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 45000);
