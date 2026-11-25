import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import world from '#/dash3d/world.js';
import Pix3D from '#/dash3d/Pix3D.js';
import Js5Compression from '#/cache/Js5Compression.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { readGroup } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const fields: [target: object, key: string, java: string][] = [
    [ClientBuild, 'm_ligtot', 'vk.O'],
    [ClientBuild, 'm_huetot', 't.ab'],
    [ClientBuild, 'm_sattot', 'tf.E'],
    [ClientBuild, 'm_tot', 'lc.A'],
    [ClientBuild, 'm_comtot', 'li.B'],
    [ClientBuild, 'm_shadow', 'ke.E'],
    [ClientBuild, 'm_floorr', 'lg.A'],
    [ClientBuild, 'm_mapo', 'ti.db'],
    [ClientBuild, 'm_floort1', 'qe.V'],
    [ClientBuild, 'm_floort2', 'ka.m'],
    [ClientBuild, 'm_floors', 'ib.jb'],
    [ClientBuild, 'minusedlevel', 'je.Z'],
    [ClientBuild, 'buildLevel', 'sb.h'],
    [ClientBuild, 'm_mapl', 'tb.t'],
    [world, 'levelHeightmaps', 've.q'],
    [world, 'mainGroundh', 'lf.g']
];
const tiles = [13, 8, 9, 10, 6, 14, 15];
type Plane = (Int32Array | Uint8Array)[];
type Grid = Plane[];
type TileCase = [fault: number, start: number, z: number, rotation: number, level: number, x: number, noiseZ: number, water: number, noiseX: number, hex: string];
const min = -2147483648,
    max = 2147483647;

function grid(planes: number, w: number, h: number, ints: boolean): Grid {
    return Array.from({ length: planes }, () => Array.from({ length: w }, () => (ints ? new Int32Array(h) : new Uint8Array(h))));
}

function life(op: string): string {
    const writes: string[] = [];
    const originals = fields.map(([target, key]) => requireNonNull(Object.getOwnPropertyDescriptor(target, key)));
    const before = originals.map(descriptor => descriptor.value);
    const current = before.slice();
    try {
        for (const [i, [target, key, java]] of fields.entries()) {
            Object.defineProperty(target, key, {
                configurable: true,
                get: () => current[i],
                set(value: unknown) {
                    current[i] = value;
                    writes.push(java);
                }
            });
        }
        if (op === 'quit') ClientBuild.Quit();
        else ClientBuild.Init(op === 'water');
    } finally {
        for (const [i, [target, key]] of fields.entries()) Object.defineProperty(target, key, { ...originals[i], value: current[i] });
    }
    const state = current.map((value, i) => {
        if (value === null) return '-';
        if (typeof value === 'number') return value.toString();
        const shape: (number | string)[] = [value === before[i] ? 'same' : 'new'];
        let row = value;
        while (Array.isArray(row)) {
            shape.push(row.length);
            row = row[row.length - 1];
        }
        shape.push(row.length, row[row.length - 1]);
        row[row.length - 1] = i + 31;
        return shape.join(':');
    });
    return [writes.join(','), ...state].join(' ');
}

function* cases(): Generator<TileCase> {
    for (let op = 0; op < 256; op++) {
        for (const arg of [0, 1, 128, 255]) {
            const bytes = op === 0 ? [op] : op === 1 ? [op, arg] : op <= 49 ? [op, arg, 0] : [op, 0];
            for (let length = 0; length <= bytes.length; length++) {
                const hex = Buffer.from(bytes.slice(0, length)).toString('hex');
                for (const [plane, x, z, water] of [
                    [0, 1, 2, 0],
                    [1, 1, 2, 0],
                    [1, 1, 2, 1],
                    [0, 1, 2, 1],
                    [max, 104, 1, 0],
                    [min, 1, -1, 1]
                ]) {
                    yield [0, 0, z, op & 1 ? min : max, plane, x, max, water, min, hex];
                }
            }
        }
    }
    const streams = ['00', '0101', '01ff', '32', '51ff00', 'ff00', '027fe031ff510101', '1aff321a80fe00'];
    for (const fault of [0, 1, 2, 3, ...Array.from({ length: 42 }, (_, i) => 10 + i)]) {
        for (const [plane, x, z, water] of [
            [0, 1, 2, 0],
            [1, 1, 2, 0],
            [1, 1, 2, 1],
            [0, 1, 2, 1],
            [-1, 1, 2, 1],
            [5, 1, 2, 0],
            [0, 103, 103, 0],
            [0, 104, 103, 0]
        ]) {
            for (const hex of streams) yield [fault, 0, z, 3, plane, x, -45365, water, 91923, hex];
        }
    }
    for (const start of [min, -1, 0, 1, 3, 12, max]) {
        for (const [x, z] of [
            [0, 0],
            [1, 1],
            [104, 0],
            [0, 104],
            [-1, 0],
            [0, -1],
            [max, min]
        ]) {
            for (const water of [0, 1]) yield [0, start, z, min, 0, x, min, water, max, '31ff51fe010100'];
        }
    }
}

function tile([fault, start, z, rot, p, x, noiseZ, water, noiseX, hex]: TileCase): string {
    const packet = fault === 1 ? null : new PacketT(fault === 2 ? null : Buffer.from(hex, 'hex'));
    if (packet) packet.m_pos = start;
    const savedRows: Plane[] = [];
    for (const [i, field] of tiles.entries()) {
        const ints = i >= 5,
            fresh = grid(2, 2, 3, ints);
        savedRows.push(fresh.flat());
        for (let l = 0; l < 2; l++)
            for (let a = 0; a < 2; a++)
                for (let b = 0; b < 3; b++) {
                    const offset = l * 6 + a * 3 + b;
                    fresh[l][a][b] = ints ? (i === 5 ? min + offset : max - offset) : 100 + i * 13 + offset;
                }
        let active: Grid | null = fresh;
        if (fault >= 10 && (((fault - 10) / 6) | 0) === i) {
            const level = p === 1 ? 1 : 0;
            switch ((fault - 10) % 6) {
                case 0:
                    active = null;
                    break;
                case 1:
                    active = [];
                    break;
                case 2:
                    Reflect.set(fresh, level, null);
                    break;
                case 3:
                    fresh[level] = [];
                    break;
                case 4:
                    Reflect.set(fresh[level], 1, null);
                    break;
                case 5:
                    fresh[level][1] = ints ? new Int32Array(0) : new Uint8Array(0);
                    break;
            }
        }
        const [target, key] = fields[field];
        Reflect.set(target, key, active);
    }
    if (fault === 3) world.levelHeightmaps = world.mainGroundh;
    let status = 'ok';
    try {
        ClientBuild.LoadGroundSquare(packet, z, rot, p, x, noiseZ, Boolean(water), noiseX);
    } catch (e) {
        if (e instanceof TypeError && e.message.startsWith('Null ')) status = 'null';
        else if (e instanceof RangeError && /^(?:byte )?array index -?\d+$/.test(e.message)) status = 'index' + e.message.split(' ').at(-1);
        else throw e;
    }
    const hashes = savedRows.map(rows => {
        let hash = 1;
        for (const row of rows) for (const value of row) hash = (Math.imul(hash, 31) + value) | 0;
        return hash;
    });
    return [status, packet?.m_pos ?? '-', ...hashes].join(' ');
}

type RegionCase = { bytes: Uint8Array; water: number; ox: number; oz: number; rotation: number };
function region({ bytes, water, ox, oz, rotation }: RegionCase): string {
    ClientBuild.Init(false);
    ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
    world.levelHeightmaps = Array.from({ length: 4 }, () => Array.from({ length: 105 }, () => new Int32Array(105)));
    world.mainGroundh = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => max - (p * 65536 + x * 256 + z))));
    const packet = new PacketT(bytes);
    const raw = Buffer.alloc(4 * 64 * 64 * 4 + 4 * 104 * 104 * 9);
    let pos = 0;
    for (let p = 0; p < 4; p++)
        for (let x = 0; x < 64; x++)
            for (let z = 0; z < 64; z++) {
                ClientBuild.LoadGroundSquare(packet, z + oz, rotation, p, x + ox, 3160, Boolean(water), 3160);
                raw.writeInt32BE(packet.m_pos, pos);
                pos += 4;
            }
    const channels = [ClientBuild.m_mapl, ClientBuild.m_floort1, ClientBuild.m_floort2, ClientBuild.m_floors, ClientBuild.m_floorr].map(requireNonNull);
    for (let p = 0; p < 4; p++)
        for (let x = 0; x < 104; x++)
            for (let z = 0; z < 104; z++) {
                raw.writeInt32BE(world.levelHeightmaps[p][x][z], pos);
                pos += 4;
                for (const channel of channels) raw[pos++] = channel[p][x][z];
            }
    return packet.m_pos + ' ' + createHash('sha256').update(raw).digest('hex');
}

test('ground initialization, release and every ground-square opcode match the JAR, including partial writes, source alignment and underwater heights', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-ground-square-'));
    const originals = fields.map(([target, key]) => Reflect.get(target, key));
    const cosine = Pix3D.cosTable;
    try {
        Pix3D.cosTable = Int32Array.from({ length: 2048 }, (_, i) => (65536 * Math.cos(i * 0.0030679615)) | 0);
        ClientBuild.buildLevel = 71;
        ClientBuild.minusedlevel = -59;
        ClientBuild.m_mapl = [[new Uint8Array(3), new Uint8Array(3)]];
        world.levelHeightmaps = [[new Int32Array(3), new Int32Array(3)]];
        world.mainGroundh = [[new Int32Array(3), new Int32Array(3)]];
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'GroundSquareOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const command = ['java', asm, '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'GroundSquareOracle'];
        const prepare = Bun.spawnSync([...command, gamepackPath, dir]);
        expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
        const ops = ['land', 'land', 'water', 'quit', 'quit', 'water', 'land', 'quit'];
        const samples = Array.from(cases());
        const regions: RegionCase[] = [];
        for (const [i, id] of [254, 256, 380, 382].entries()) {
            const bytes = Js5Compression.Decompress(readGroup(cachePath, 5, id));
            for (const water of [0, 1]) regions.push({ bytes, water, ox: [0, -13, 44, 95][i], oz: [0, 66, -24, 98][i], rotation: i });
        }
        const lines = [...ops.map(op => 'life ' + op), ...samples.map(row => 'tile ' + row.join(' ')), ...regions.map(({ bytes, water, ox, oz, rotation }) => ['region', water, ox, oz, rotation, Buffer.from(bytes).toString('base64')].join(' '))];
        const java = Bun.spawnSync(command, { stdin: Buffer.from(lines.join('\n') + '\n'), maxBuffer: 8 * 1024 * 1024, timeout: 60000 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const observed = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(observed.length).toBe(lines.length);
        let i = 0;
        for (const op of ops) expect(life(op), op).toBe(observed[i++]);
        for (const row of samples) expect(tile(row), lines[i]).toBe(observed[i++]);
        for (const map of regions) expect(region(map), 'real cache region ' + map.rotation + ' underwater ' + map.water).toBe(observed[i++]);
    } finally {
        Pix3D.cosTable = cosine;
        for (const [i, [target, key]] of fields.entries()) Reflect.set(target, key, originals[i]);
        rmSync(dir, { recursive: true, force: true });
    }
}, 120000);
