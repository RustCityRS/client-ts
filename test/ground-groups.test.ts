import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import AudioEngine from '#/sound/AudioEngine.js';
import { gamepackPath } from './reference.js';

function template(level: number, rotation: number, x: number, z: number): number {
    return (level << 24) | (rotation << 1) | (x << 14) | (z << 3);
}

function run(dynamic: number, underwater: number, centreZ: number, mode: number): string {
    const a = Uint8Array.of(11),
        b = Uint8Array.of(22),
        c = Uint8Array.of(33);
    const bytes = [a, null, b, null, null],
        ids = Int32Array.of(0x1234, 0x1234, 0x1234, 0x147, -1);
    const coll = new Array<CollisionMap | null>(4).fill(null);
    const chunks = Array.from({ length: 4 }, () => Array.from({ length: 13 }, () => new Int32Array(13).fill(-1)));
    Client.sceneMapLandData = bytes;
    Client.mapBuildIndex = ids;
    Reflect.set(CollisionMap, 'levelMaps', coll);
    Reflect.set(Client, 'dynamicChunks', chunks);
    Client.mapBuildBaseX = -393;
    Client.mapBuildBaseZ = 0x234;
    Client.mapBuildCentreZoneX = 22;
    Client.mapBuildCentreZoneZ = centreZ;
    for (let level = 0; level < 4; level++) for (let i = 0; i < 4; i++) chunks[level][(i * 3) % 13][(i * 5) % 13] = template(i, i, 144 + i, 416 + 7 - i);
    chunks[0][12][12] = template(2, 3, 9, 568);
    switch (mode) {
        case 13:
            Client.sceneMapLandData = null;
            break;
        case 14:
            Client.mapBuildIndex = null;
            break;
        case 15:
            Client.mapBuildIndex = Int32Array.of(0x999, 0x1234, 0x1234, 0x147, -1);
            Client.sceneMapLandData = [null, null];
            break;
        case 16:
            Client.mapBuildBaseX = -2147483648;
            Client.mapBuildBaseZ = 2147483647;
            Client.mapBuildCentreZoneX = 2147483647;
            ids[0] = -2147483648;
            break;
        case 17:
            Reflect.set(Client, 'dynamicChunks', null);
            break;
        case 18:
            Reflect.set(chunks, 0, [null]);
            break;
        case 19:
            Client.mapBuildIndex = new Int32Array(0);
            Client.sceneMapLandData = [];
            break;
        case 20:
            Client.mapBuildIndex = Int32Array.of(0x999, 0x1234, 0x1234, 0x147, -1);
            break;
    }
    const calls: string[] = [];
    let audio = 0,
        loads = 0,
        clears = 0;
    const fail = () => {
        throw new Error('probe');
    };
    AudioEngine.tick = () => {
        calls.push('p' + ++audio);
        if (audio === 1) {
            switch (mode) {
                case 1:
                    Client.sceneMapLandData = [c];
                    break;
                case 2:
                    Client.mapBuildBaseX = 2147483647;
                    Client.mapBuildBaseZ = -2147483648;
                    Client.mapBuildCentreZoneX = -2147483648;
                    Client.mapBuildCentreZoneZ = 2147483647;
                    Client.mapBuildIndex = Int32Array.of(0, 1, 3, 4, 5);
                    Reflect.set(CollisionMap, 'levelMaps', [null, null]);
                    break;
                case 3:
                    bytes[0] = null;
                    bytes[1] = c;
                    break;
                case 4:
                    Client.mapBuildIndex = null;
                    break;
                case 5: {
                    const replacement = Array.from({ length: 4 }, () => Array.from({ length: 13 }, () => new Int32Array(13)));
                    replacement[0][0][0] = template(3, 1, 144, 416);
                    Reflect.set(Client, 'dynamicChunks', replacement);
                    break;
                }
                case 6:
                    fail();
            }
        }
        if (mode === 7 && audio === 2) {
            Client.mapBuildCentreZoneZ = 799;
            Client.sceneMapLandData = null;
            Reflect.set(CollisionMap, 'levelMaps', null);
        }
    };
    function loaded(): void {
        if (++loads !== 1) return;
        if (mode === 8) {
            bytes[1] = bytes[0];
            Client.mapBuildIndex = Int32Array.of(0, 0x1234);
        }
        if (mode === 9) Client.dynamicChunks[0][0] = new Int32Array(1);
        if (mode === 10) fail();
    }
    const data = (v: Uint8Array | null) => (v === a ? 'a' : v === b ? 'b' : v === c ? 'c' : '_');
    const maps = (v: (CollisionMap | null)[] | null) => (v === null ? 'null' : v === coll ? 'old' : 'new');
    ClientBuild.LoadGround = (z, u, noiseZ, x, src, noiseX, cs) => {
        calls.push('g' + [z, u, noiseZ, x, data(src), noiseX, maps(cs)].join(','));
        loaded();
    };
    ClientBuild.LoadGroundRegion = (x, sz, z, level, src, rot, cs, sl, u, sx) => {
        calls.push('d' + [x, sz, z, level, data(src), rot, maps(cs), sl, u, sx].join(','));
        loaded();
    };
    ClientBuild.clearMapArea = (x, w, z, h, level) => {
        calls.push('c' + [x, w, z, h, level].join(','));
        if (++clears !== 1) return;
        if (mode === 11) {
            Client.mapBuildIndex = null;
            Client.sceneMapLandData = null;
            Reflect.set(CollisionMap, 'levelMaps', null);
            Client.dynamicChunks[0][0] = new Int32Array(0);
            Client.mapBuildCentreZoneZ = 805;
        }
        if (mode === 12) fail();
    };
    let result = 'ok';
    try {
        if (dynamic) ClientBuild.loadDynamicGround(underwater !== 0);
        else Client.loadGroundRegions(underwater !== 0);
    } catch (e) {
        if (e instanceof TypeError && /^Null /.test(e.message)) result = 'null';
        else if (e instanceof RangeError && /^array index /.test(e.message)) result = 'bounds' + e.message.split(' ').at(-1);
        else if (e instanceof Error && e.message === 'probe') result = 'probe';
        else throw e;
    }
    return result + '|' + calls.join(';');
}

test('normal and instanced 530 map builds preserve audio, packed-square search, live reads and missing-area ordering', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-ground-groups-'));
    const saved = {
        dynamicChunks: Client.dynamicChunks,
        sceneMapLandData: Client.sceneMapLandData,
        mapBuildIndex: Client.mapBuildIndex,
        mapBuildBaseX: Client.mapBuildBaseX,
        mapBuildBaseZ: Client.mapBuildBaseZ,
        mapBuildCentreZoneX: Client.mapBuildCentreZoneX,
        mapBuildCentreZoneZ: Client.mapBuildCentreZoneZ
    };
    const methods = { LoadGround: ClientBuild.LoadGround, LoadGroundRegion: ClientBuild.LoadGroundRegion, clearMapArea: ClientBuild.clearMapArea };
    const previousAudio = AudioEngine.tick,
        previousMaps = CollisionMap.levelMaps;
    try {
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const build = Bun.spawnSync(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/GroundGroupsOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const java = ['java', ...access, '-XX:-OmitStackTraceInFastThrow', '-cp', dir + delimiter + gamepackPath, 'GroundGroupsOracle'];
        const probes = Bun.spawnSync([...java, gamepackPath, dir]);
        expect(probes.exitCode, probes.stderr.toString()).toBe(0);
        const cases: number[][] = [];
        for (const dynamic of [0, 1]) for (const u of [0, 1]) for (const z of [799, 800, 801]) for (let mode = 0; mode <= 20; mode++) cases.push([dynamic, u, z, mode]);
        const lines = cases.map(v => v.join(' '));
        const j = Bun.spawnSync(java, { stdin: Buffer.from(lines.join('\n') + '\n'), maxBuffer: 16 * 1024 * 1024 });
        expect(j.exitCode, j.stderr.toString()).toBe(0);
        const expected = j.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(cases.length);
        for (const [i, [dynamic, u, z, mode]] of cases.entries()) expect(run(dynamic, u, z, mode), lines[i]).toBe(expected[i]);
    } finally {
        Object.assign(Client, saved);
        Object.assign(ClientBuild, methods);
        AudioEngine.tick = previousAudio;
        Reflect.set(CollisionMap, 'levelMaps', previousMaps);
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
