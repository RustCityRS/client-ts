import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import AudioEngine from '#/sound/AudioEngine.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

const fields: [object, string][] = [
    [Client, 'sceneMapLocData'],
    [Client, 'sceneMapLandData'],
    [Client, 'mapBuildIndex'],
    [Client, 'mapBuildBaseX'],
    [Client, 'mapBuildBaseZ'],
    [CollisionMap, 'levelMaps'],
    [Client, 'dynamicChunks']
];

function template(p: number, r: number, x: number, z: number): number {
    return (p << 24) | (r << 1) | (x << 14) | (z << 3);
}

function observe(dynamic: number, water: number, mode: number): string {
    const a = Uint8Array.of(11),
        b = Uint8Array.of(22),
        c = Uint8Array.of(33);
    const original: (Uint8Array | null)[] = [a, null, b, null, c];
    const ids = Int32Array.of(0x1234, 0x1234, 0x1234, 0x147, 0x7fff);
    const coll = new Array<CollisionMap | null>(4).fill(null);
    const chunks = Array.from({ length: 4 }, () => Array.from({ length: 13 }, () => new Int32Array(13).fill(-1)));
    const current: unknown[] = [original, new Array(5).fill(null), ids, 393, -516, coll, chunks];
    for (let p = 0; p < 4; p++) for (let i = 0; i < 4; i++) chunks[p][i * 3][i * 4] = template(i, i, 144 + i, 416 + 7 - i);
    chunks[0][0][1] = template(0, 3, 9, 568);
    chunks[3][12][12] = 0xef000001 | template(0, 3, 1023, 2047);
    switch (mode) {
        case 13:
            current[0] = null;
            break;
        case 14:
            current[1] = null;
            break;
        case 15:
            current[2] = null;
            break;
        case 16:
            current[2] = new Int32Array(0);
            break;
        case 17:
            current[0] = [null];
            break;
        case 18:
            ids[0] = -2147483648;
            current[3] = 2147483647;
            current[4] = -2147483648;
            break;
        case 19:
            current[6] = null;
            break;
        case 20:
            Reflect.set(chunks, 0, [null]);
            break;
        case 21:
            current[1] = [];
            current[0] = null;
            break;
        case 22:
            original[0] = null;
            original[1] = null;
            break;
        case 23:
            current[5] = null;
            break;
        case 26:
            for (const p of chunks) for (const row of p) row.fill(-1);
            current[2] = null;
            current[0] = null;
            break;
        case 27:
            for (const p of chunks) for (const row of p) row.fill(template(2, 1, 144, 416));
            current[2] = null;
            break;
    }
    let reads = 0,
        digest = 1,
        indexReads = 0,
        pumps = 0,
        loads = 0;
    const trace: string[] = [];
    for (const [id, [owner, key]] of fields.entries()) {
        Object.defineProperty(owner, key, {
            configurable: true,
            get() {
                const value = current[id];
                reads++;
                digest = (Math.imul(digest, 31) + id) | 0;
                if (id === 2 && ++indexReads === 1) {
                    if (mode === 24) current[2] = Int32Array.of(0x070b, 0x1234);
                    if (mode === 25) current[2] = null;
                }
                return value;
            }
        });
    }
    AudioEngine.tick = () => {
        trace.push('p' + ++pumps);
        if (pumps === 1)
            switch (mode) {
                case 1:
                    current[0] = [c];
                    break;
                case 2:
                    current[1] = null;
                    break;
                case 3:
                    original[0] = null;
                    original[1] = c;
                    break;
                case 4:
                    current[2] = null;
                    break;
                case 5:
                    current[5] = [null];
                    current[3] = 2147483647;
                    current[4] = -2147483648;
                    break;
                case 6:
                    throw new Error('probe');
                case 7: {
                    const replacement = Array.from({ length: 4 }, () => Array.from({ length: 13 }, () => new Int32Array(13)));
                    replacement[0][0][0] = template(0, 1, 144, 416);
                    current[6] = replacement;
                    break;
                }
            }
        if (mode === 8 && pumps === 2) {
            current[5] = null;
            current[0] = null;
            current[3] = -2147483648;
            current[4] = 2147483647;
        }
    };
    function placed(): void {
        if (++loads !== 1) return;
        switch (mode) {
            case 9:
                current[2] = Int32Array.of(0x1234, 0x1234);
                original[1] = b;
                break;
            case 10:
                chunks[0][0] = new Int32Array(1);
                break;
            case 11:
                throw new Error('probe');
            case 12:
                original.fill(null);
                current[5] = null;
                break;
        }
    }
    const name = (data: Uint8Array | null) => (data === a ? 'a' : data === b ? 'b' : data === c ? 'c' : 'null');
    const maps = (value: (CollisionMap | null)[] | null) => (value === null ? 'null' : value === coll ? 'old' : 'new');
    ClientBuild.LoadLocations = (x, cs, data, z, w) => {
        trace.push('n' + [x, maps(cs), name(data), z, w].join(','));
        placed();
    };
    ClientBuild.LoadLocationsRegion = (x, sx, cs, r, sl, data, z, w, p, sz) => {
        trace.push('i' + [x, sx, maps(cs), r, sl, name(data), z, w, p, sz].join(','));
        placed();
    };
    let result = 'ok';
    try {
        if (dynamic) Client.mapBuildLocsDynamic(Boolean(water));
        else Client.loadAllLocs(Boolean(water));
    } catch (error) {
        if (error instanceof TypeError && error.message.startsWith('Null ')) result = 'null';
        else if (error instanceof RangeError && /^array index -?\d+$/.test(error.message)) result = 'index' + error.message.slice(12);
        else if (error instanceof Error && error.message === 'probe') result = 'probe';
        else throw error;
    }
    return result + ' ' + reads + ' ' + digest + '|' + trace.join(';');
}

test('normal and instanced location groups match dg and jh for source snapshots, active map reads, selection and audio callback order', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-location-groups-'));
    const previous = fields.map(([obj, name]) => requireNonNull(Object.getOwnPropertyDescriptor(obj, name)));
    const pump = AudioEngine.tick,
        normal = ClientBuild.LoadLocations,
        instance = ClientBuild.LoadLocationsRegion;
    try {
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'LocationGroupsOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const command = ['java', asm, '-XX:-OmitStackTraceInFastThrow', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'LocationGroupsOracle'];
        const prepare = Bun.spawnSync([...command, gamepackPath, dir]);
        expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
        const rows: number[][] = [];
        for (const dynamic of [0, 1]) for (const water of [0, 1]) for (let mode = 0; mode <= 27; mode++) rows.push([dynamic, water, mode]);
        const lines = rows.map(row => row.join(' '));
        const java = Bun.spawnSync(command, { stdin: Buffer.from(lines.join('\n') + '\n'), timeout: 20000 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        for (const [i, [dynamic, water, mode]] of rows.entries()) expect(observe(dynamic, water, mode), lines[i]).toBe(expected[i]);
    } finally {
        for (const [i, [owner, key]] of fields.entries()) Object.defineProperty(owner, key, previous[i]);
        AudioEngine.tick = pump;
        ClientBuild.LoadLocations = normal;
        ClientBuild.LoadLocationsRegion = instance;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
