import { expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import world from '#/dash3d/world.js';
import { fromJsString } from '#/datastruct/JagString.js';
import type PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

type Chunk = { sourceX: number; sourceZ: number; rotation: number; level: number; sourceLevel: number };
type Region = { water: boolean; x: number; z: number; nz: number; nx: number; fault: string; data: Uint8Array | null; chunk?: Chunk };

function terrain(water: boolean): Uint8Array {
    const bytes: number[] = [];
    for (let i = 0; i < (water ? 4096 : 16384); i++) {
        if ((i & 7) === 0) bytes.push(2 + (i % 48), (i * 17) & 255, 50 + (i % 32), 82 + (i % 167));
        if (i % 61 === 0) bytes.push(0);
        else bytes.push(1, (i * 73) & 255);
    }
    return Uint8Array.from(bytes);
}
function extension(modes: number[]): Uint8Array {
    const bytes = [129];
    for (const mode of modes) {
        bytes.push(mode);
        if (mode === 1) for (let n = 0; n < 256; n++) bytes.push((n * 167 + 63) & 255);
    }
    return Uint8Array.from(bytes);
}
function cases(): Region[] {
    const rows: Region[] = [];
    function add(water: boolean, x: number, z: number, data: Uint8Array | null, fault = '-', nz = 773, nx = -811) {
        rows.push({ water, x, z, data, nz, nx, fault });
    }
    function chunk(water: boolean, x: number, z: number, data: Uint8Array | null, sourceX: number, sourceZ: number, rotation: number, level: number, sourceLevel: number, fault = '-') {
        rows.push({ water, x, z, data, fault, nz: 0, nx: 0, chunk: { sourceX, sourceZ, rotation, level, sourceLevel } });
    }
    const joinBytes = (...parts: Uint8Array[]) => Buffer.concat(parts);
    for (const water of [false, true]) {
        const land = terrain(water);
        for (const [x, z] of [
            [0, 0],
            [-19, -61],
            [89, 89],
            [102, 103],
            [-65, 110],
            [2147483646, -2147483648]
        ]) {
            for (const supplemental of [new Uint8Array(), Uint8Array.of(128, 129, 1), extension([1, 2, 0, 2]), joinBytes(extension([0, 1, 2, 1]), extension([2, 0, 127, -1]), Uint8Array.of(5, 129))]) {
                add(water, x, z, joinBytes(land, supplemental));
            }
        }
        for (const end of [0, 1, 5, 17, 127, land.length - 1]) add(water, 3, 1, land.subarray(0, end));
        for (const length of [0, 1, 2, 3, 15, 258, 260]) add(water, 3, 1, joinBytes(land, extension([1, 2, 1, 0]).subarray(0, length)));
        for (const fault of ['nullMaps', 'shortMaps', 'nullMap', 'shortFlags', 'nullHeight', 'nullUnderlay']) add(water, 3, 1, land, fault);
        add(water, 3, 1, land, 'nullAux');
        for (const fault of ['nullAux', 'shortAux', 'shortDest']) add(water, 3, 1, joinBytes(land, extension([1, 2, 0, 2])), fault);
        add(water, 103, 103, null, 'nullMaps');
        add(water, 3, 1, null);
        add(water, 3, 1, land, '-', 2147483647, -2147483648);

        const supplement = joinBytes(land, extension([1, 0, 1, 2]), extension([2, 1, 2, 0]), Uint8Array.of(128, 129));
        for (let rotation = 0; rotation < 4; rotation++) {
            const sourceLevel = water ? 0 : rotation;
            for (const [sourceX, sourceZ] of [
                [0, 0],
                [8, 16],
                [11, 19],
                [57, 61],
                [-3, -5],
                [2147483645, 2147483646]
            ]) {
                chunk(water, 13, 9, supplement, sourceX, sourceZ, rotation, 2, sourceLevel);
            }
            for (const [x, z] of [
                [-1, 11],
                [99, 11],
                [11, 99],
                [103, 103],
                [-2147483648, 2147483645],
                [2147483647, 0]
            ]) {
                chunk(water, x, z, supplement, 3, 17, rotation, 0, sourceLevel);
            }
            chunk(water, 31, 33, land, 23, 1, rotation, 1, sourceLevel);
        }
        for (const [level, sourceLevel] of [
            [0, -1],
            [0, 4],
            [4, 0],
            [-1, 1],
            [1, 1],
            [2, 2],
            [3, 3]
        ]) {
            chunk(water, 13, 3, supplement, 3, 5, -5, level, sourceLevel);
        }
        for (const fault of ['nullMaps', 'shortMaps', 'nullMap', 'shortFlags', 'nullHeight', 'nullUnderlay', 'nullAux', 'shortDest', 'shortAux']) {
            chunk(water, 11, 1, supplement, 2, 3, 1, fault === 'shortAux' || fault === 'shortMaps' ? 2 : 1, water ? 0 : 2, fault);
        }
        for (const cut of [0, 1, 5, 33, 4097, land.length - 3, land.length + 1, land.length + 16, land.length + 259, land.length + 260]) {
            chunk(water, 3, 5, supplement.subarray(0, cut), 0, 3, 2, 1, water ? 0 : 3);
        }
        chunk(water, 2, 3, null, 1, 1, 3, 0, 0);
    }
    const maps = localAssets(cachePath, [5]).archive(5);
    for (const name of ['m49_49', 'm49_50', 'm50_49', 'm50_50']) {
        const id = maps.GetGroupId(fromJsString(name));
        expect(id, name).toBeGreaterThanOrEqual(0);
        const data = requireNonNull(maps.GetFile(0, id));
        add(false, 17, 23, data);
        for (let rotation = 0; rotation < 4; rotation++) chunk(false, 17, 23, data, 7, 13, rotation, (rotation + 1) & 3, rotation);
    }
    const late = extension([1, 2, 2, 2]),
        other = late.slice(),
        tiles = terrain(true);
    other[2 + 16 + 15] ^= 173; // Only the 4×4 auxiliary block at (4,60) changes.
    chunk(true, 21, 15, joinBytes(tiles, late), 4, 8, 0, 0, 0);
    chunk(true, 21, 15, joinBytes(tiles, other), 4, 8, 0, 0, 0);
    return rows;
}

function bytes(seed: number) {
    return Array.from({ length: 4 }, (_, p) => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => seed + p * 31 + x * 13 + z * 23)));
}
function heights(seed: number) {
    return Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => seed + p * 0x34567890 + x * 37 + z * 83)));
}
type NumericArray = Int32Array | Uint8Array;
function mix(a: number, b: number): number {
    return (Math.imul(31, a) + b) | 0;
}
function hash2(value: NumericArray[] | null): number {
    if (value === null) return 0;
    let sum = 1;
    for (const line of value) {
        let row = 1;
        for (const n of line) row = mix(row, line instanceof Uint8Array ? (n << 24) >> 24 : n);
        sum = mix(sum, row);
    }
    return sum;
}
function hash3(value: NumericArray[][] | null): number {
    return value === null ? 0 : value.reduce((a, b) => mix(a, hash2(b)), 1);
}
function trace(region: Region): string {
    const { water, x, z, nz, nx, fault, data } = region;
    ClientBuild.m_mapl = bytes(1);
    ClientBuild.m_floort1 = bytes(2);
    ClientBuild.m_floort2 = bytes(3);
    ClientBuild.m_floors = bytes(4);
    ClientBuild.m_floorr = bytes(5);
    world.tileCameraClearance = bytes(6);
    world.mainGroundh = heights(-911);
    world.levelHeightmaps = heights(7967);
    let maps: (CollisionMap | null)[] | null = Array.from({ length: 4 }, (_, p) => {
        const map = new CollisionMap(104, 104);
        for (let i = 0; i < 104; i++) for (let j = 0; j < 104; j++) map.flags[i][j] = 0x01000000 | (p * 141 + i * 237 + j * 63);
        return map;
    });
    switch (fault) {
        case 'nullMaps':
            maps = null;
            break;
        case 'shortMaps':
            maps = maps.slice(0, 2);
            break;
        case 'nullMap':
            maps[1] = null;
            break;
        case 'shortFlags':
            requireNonNull(maps[1]).flags[12] = new Int32Array(3);
            break;
        case 'nullAux':
            world.tileCameraClearance = null;
            break;
        case 'shortAux':
            world.tileCameraClearance[2][x] = new Uint8Array(5);
            break;
        case 'shortDest':
            world.tileCameraClearance[1][x] = new Uint8Array(3);
            break;
        case 'nullUnderlay':
            ClientBuild.m_floort1 = null;
            break;
        case 'nullHeight':
            world.levelHeightmaps = null;
            break;
    }
    const tile = ClientBuild.LoadGroundSquare;
    const observation: { calls: number; trace: number; packet: PacketT | null } = { calls: 0, trace: 1, packet: null };
    ClientBuild.LoadGroundSquare = (p, z, r, level, x, nz, water, nx) => {
        observation.packet = p;
        observation.calls++;
        for (const value of [requireNonNull(p).m_pos, z, r, level, x, nz, +water, nx]) observation.trace = mix(observation.trace, value);
        tile(p, z, r, level, x, nz, water, nx);
    };
    let status = 'ok';
    try {
        if (region.chunk) {
            const { sourceX, sourceZ, rotation, level, sourceLevel } = region.chunk;
            ClientBuild.LoadGroundRegion(x, sourceZ, z, level, data, rotation, maps, sourceLevel, water, sourceX);
        } else ClientBuild.LoadGround(z, water, nz, x, data, nx, maps);
    } catch (e) {
        if (e instanceof TypeError) status = 'null';
        else if (e instanceof RangeError) status = 'bounds';
        else throw e;
    } finally {
        ClientBuild.LoadGroundSquare = tile;
    }
    const arrays = [ClientBuild.m_mapl, ClientBuild.m_floort1, ClientBuild.m_floort2, ClientBuild.m_floors, ClientBuild.m_floorr, world.tileCameraClearance, world.mainGroundh, world.levelHeightmaps];
    const flags = maps === null ? ['-'] : maps.map(map => hash2(map?.flags ?? null));
    return [status, observation.packet?.m_pos ?? -1, observation.calls, observation.trace, ...arrays.map(hash3), ...flags].join(' ');
}

loginFixture(
    import.meta.url,
    'normal and rotated land regions match JAR tile order, collisions, trailing bytes, partial writes and four cache maps',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-ground-region-normal-'));
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/GroundRegionNormalOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const cmd = ['java', '-Djava.awt.headless=true', ...asm, '-cp', dir + delimiter + gamepackPath, 'GroundRegionNormalOracle'];
            const instrument = Bun.spawnSync([...cmd, 'instrument', gamepackPath, dir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const rows = cases();
            const input = rows.map(({ water, x, z, nz, nx, fault, data, chunk }, i) => {
                if (data !== null) writeFileSync(join(dir, String(i)), data);
                const args = [+water, x, z, nz, nx, fault, data === null ? '-' : i];
                if (chunk) args.push(chunk.sourceX, chunk.sourceZ, chunk.rotation, chunk.level, chunk.sourceLevel);
                return args.join(' ');
            });
            const java = Bun.spawnSync([...cmd, dir], { stdin: Buffer.from(input.join('\n') + '\n'), timeout: 30000 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            // lk bytecode 680 accepts the changed block even with sourceZ=8.
            // The eighth row/column survives the final 7×7 overwrite. Only vb.c changes.
            const lateA = expected[expected.length - 2].split(' '),
                lateB = expected[expected.length - 1].split(' ');
            expect(lateA[9]).not.toBe(lateB[9]);
            expect(lateA.filter((_, i) => i !== 9)).toEqual(lateB.filter((_, i) => i !== 9));
            for (const [i, row] of rows.entries()) expect(trace(row), input[i]).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000
);
