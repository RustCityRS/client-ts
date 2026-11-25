import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import LocType from '#/config/LocType.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import PacketT from '#/io/PacketT.js';
import { gamepackPath } from './reference.js';

type Tile = [level: number, x: number, z: number, shape: number, angle: number];
function encode(groups: [id: number, tiles: Tile[]][]): Uint8Array {
    const bytes: number[] = [];
    function smart(value: number): void {
        if (value < 128) bytes.push(value);
        else bytes.push(128 + (value >> 8), value & 255);
    }
    let lastId = -1;
    for (const [id, tiles] of groups) {
        let idDelta = id - lastId;
        while (idDelta >= 32767) {
            smart(32767);
            idDelta -= 32767;
        }
        smart(idDelta);
        let previous = 0;
        for (const [level, x, z, shape, angle] of tiles) {
            const position = (level << 12) + (x << 6) + z;
            if (position < previous) throw new Error('Unsorted location fixture');
            smart(position - previous + 1);
            bytes.push((shape << 2) + angle);
            previous = position;
        }
        smart(0);
        lastId = id;
    }
    smart(0);
    return Uint8Array.from(bytes);
}

interface Vector {
    dynamic: number;
    x: number;
    z: number;
    sx: number;
    sz: number;
    sourceLevel: number;
    level: number;
    rotation: number;
    underwater: number;
    mode: number;
    bytes: Uint8Array | null;
}
function command(v: Vector): string {
    const data = v.bytes === null ? 'N' : Buffer.from(v.bytes).toString('hex') || '_';
    return [v.dynamic, v.x, v.z, v.sx, v.sz, v.sourceLevel, v.level, v.rotation, v.underwater, v.mode, data].join(' ');
}

const originalMaps = Array.from({ length: 4 }, () => new CollisionMap(2, 2));
const flags = Array.from({ length: 4 }, (_, level) => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (x * 3 + z * 17 + level * 7) & 255)));

function run(v: Vector): string {
    let maps: (CollisionMap | null)[] | null = originalMaps.slice();
    const input = v.bytes?.slice() ?? null;
    const levels = flags.slice();
    levels[1] = levels[1].slice();
    ClientBuild.m_mapl = levels;
    switch (v.mode) {
        case 1:
            levels[1].fill(new Uint8Array(104).fill(2));
            break;
        case 2:
            levels[1].fill(new Uint8Array(104).fill(1));
            break;
        case 3:
            ClientBuild.m_mapl = null;
            break;
        case 4:
            ClientBuild.m_mapl = [levels[0]];
            break;
        case 5:
            Reflect.set(levels, 1, null);
            break;
        case 6:
            Reflect.set(levels, 1, [null]);
            break;
        case 7:
            Reflect.set(levels, 1, new Array(104).fill(null));
            break;
        case 8:
            levels[1].fill(new Uint8Array(1));
            break;
        case 9:
            maps = null;
            break;
        case 10:
            maps = [];
            break;
        case 11:
            maps = [originalMaps[0]];
            break;
        case 12:
            maps[2] = null;
            break;
    }
    const events: string[] = [];
    const state: { packet: PacketT | null; reading: boolean } = { packet: null, reading: false };
    const pos = () => state.packet?.m_pos ?? -1;
    const fail = () => {
        throw new Error('probe');
    };
    function observe(name: 'gSmartsExtend' | 'gSmart1or2' | 'g1', tag: string): () => void {
        const method = PacketT.prototype[name];
        PacketT.prototype[name] = function (): number {
            if (state.reading) return method.call(this);
            state.packet = this;
            state.reading = true;
            const from = this.m_pos;
            try {
                const value = method.call(this);
                events.push(tag + from + ':' + this.m_pos + '=' + value);
                return value;
            } finally {
                state.reading = false;
            }
        };
        return () => {
            PacketT.prototype[name] = method;
        };
    }
    const restoreReads = [observe('gSmartsExtend', 'i'), observe('gSmart1or2', 'p'), observe('g1', 's')];
    Reflect.set(LocType, 'List', (id: number) => {
        events.push('t' + pos() + '=' + id);
        if (v.mode === 13) fail();
        if (v.mode === 14) return null;
        if (v.mode === 15) ClientBuild.m_mapl = null;
        const type = new LocType();
        type.length = v.mode === 16 ? -2147483648 : 1 + (id & 3);
        type.width = v.mode === 16 ? 2147483647 : 1 + ((id >>> 2) & 3);
        return type;
    });
    ClientBuild.AddLoc = (underwater, level, id, heightLevel, angle, shape, x, z, surface, collision) => {
        const index = collision === null ? -1 : originalMaps.indexOf(collision);
        events.push('l' + pos() + '=' + [Number(underwater), level, id, heightLevel, angle, shape, x, z, Number(surface), index].join(','));
        if (v.mode === 17) fail();
        if (v.mode === 18) ClientBuild.m_mapl = null;
        if (v.mode === 19) maps?.fill(null);
        if (v.mode === 20 && input && pos() < input.length) input[pos()] = 0;
    };
    let result = 'ok';
    try {
        if (v.dynamic) ClientBuild.LoadLocationsRegion(v.x, v.sx, maps, v.rotation, v.sourceLevel, input, v.z, Boolean(v.underwater), v.level, v.sz);
        else ClientBuild.LoadLocations(v.x, maps, input, v.z, Boolean(v.underwater));
    } catch (e) {
        if (e instanceof TypeError) result = 'null';
        else if (e instanceof RangeError && /array index /.test(e.message)) result = 'bounds' + e.message.split(' ').at(-1);
        else if (e instanceof Error && e.message === 'probe') result = 'probe';
        else throw e;
    } finally {
        for (const restore of restoreReads) restore();
    }
    return result + '|' + pos() + '|' + events.join(';');
}

test('530 location streams retain packet positions, transformed footprints, bridge clipping and placement order', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-locations-'));
    const before = { flags: ClientBuild.m_mapl, place: ClientBuild.AddLoc, list: LocType.List };
    const inside = encode([
        [
            6,
            [
                [2, 17, 27, 17, 3],
                [2, 17, 27, 3, 0],
                [2, 21, 31, 63, 2]
            ]
        ]
    ]);
    const mixed = encode([
        [
            2,
            [
                [0, 0, 0, 0, 0],
                [1, 16, 24, 1, 1],
                [2, 15, 24, 2, 2],
                [2, 16, 23, 3, 3],
                [2, 16, 24, 4, 0],
                [2, 16, 31, 5, 1],
                [2, 17, 32, 6, 2],
                [2, 23, 24, 7, 3],
                [2, 23, 31, 8, 0],
                [2, 24, 24, 9, 1],
                [3, 16, 24, 10, 2]
            ]
        ],
        [
            32769,
            [
                [2, 18, 25, 11, 3],
                [2, 18, 25, 12, 0],
                [2, 22, 30, 22, 1]
            ]
        ],
        [
            131067,
            [
                [2, 21, 28, 63, 2],
                [2, 23, 29, 0, 3]
            ]
        ]
    ]);
    const cases: Vector[] = [];
    const base: Vector = { dynamic: 0, x: 35, z: 54, sx: 16, sz: 24, sourceLevel: 2, level: 1, rotation: 0, underwater: 0, mode: 0, bytes: mixed };
    for (const dynamic of [0, 1]) {
        for (const underwater of [0, 1]) {
            for (const mode of Array.from({ length: 21 }, (_, i) => i)) {
                for (const level of [0, 3]) cases.push({ ...base, dynamic, underwater, level, mode, bytes: inside });
            }
        }
        for (const rotation of [0, 1, 2, 3, -1, 4, 2147483647]) {
            for (const [x, z] of [
                [35, 54],
                [-3, 5],
                [0, 0],
                [1, 1],
                [95, 95],
                [102, 102],
                [103, 103],
                [-16, -24],
                [2147483647, -2147483648]
            ]) {
                cases.push({ ...base, dynamic, x, z, rotation });
            }
        }
        for (const [sx, sz, sourceLevel, level] of [
            [15, 23, 2, 3],
            [16, 24, 3, 0],
            [17, 25, 1, 2],
            [2147483647, 24, 2, 1],
            [16, 2147483647, 2, 1],
            [-7, -7, 0, -1],
            [16, 24, 2, -3],
            [16, 24, 2, 5]
        ]) {
            cases.push({ ...base, dynamic, sx, sz, sourceLevel, level });
        }
        for (let end = 0; end <= mixed.length; end++) cases.push({ ...base, dynamic, bytes: mixed.slice(0, end) });
        for (const bytes of [null, Uint8Array.of(0, 1, 2), Uint8Array.of(255), Uint8Array.of(255, 255, 255, 255), Uint8Array.of(1, 255, 255, 255, 0, 0), Uint8Array.of(1, 128, 0, 1, 0, 0)]) cases.push({ ...base, dynamic, bytes });
    }
    try {
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const built = Bun.spawnSync(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/LocationsRegionsOracle.java')]);
        expect(built.exitCode, built.stderr.toString()).toBe(0);
        const java = ['java', ...access, '-XX:-OmitStackTraceInFastThrow', '-cp', dir + delimiter + gamepackPath, 'LocationsRegionsOracle'];
        const instrumented = Bun.spawnSync([...java, gamepackPath, dir]);
        expect(instrumented.exitCode, instrumented.stderr.toString()).toBe(0);
        const result = Bun.spawnSync(java, { stdin: Buffer.from(cases.map(command).join('\n') + '\n'), maxBuffer: 16 * 1024 * 1024 });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        const lines = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(cases.length);
        for (const [index, v] of cases.entries()) expect(run(v), command(v)).toBe(lines[index]);
    } finally {
        ClientBuild.m_mapl = before.flags;
        ClientBuild.AddLoc = before.place;
        LocType.List = before.list;
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
