import SceneCutover from '#/scene/SceneCutover.js';
import LocType from '#/config/LocType.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import GameShell from '#/client/GameShell.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import SuperPacket from '#/io/SuperPacket.js';
import AudioEngine from '#/sound/AudioEngine.js';
import MapArea from '#/ui/MapArea.js';
import Preferences from '#/ui/Preferences.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

function trace(commands: string): void {
    const previousNative = SceneCutover.native;
    using _geometryStub = {
        [Symbol.dispose]() {
            SceneCutover.native = previousNative;
        }
    };
    SceneCutover.native = false;
    let calls: string[] = [];
    let phase = 0;
    let trigger = 0,
        occurrence = 0,
        action = 0,
        argument = 0,
        seen = 0;
    let originalOut: SuperPacket | null = null,
        replacementOut: SuperPacket | null = null;
    type Files = (Uint8Array | null)[] | null;
    let oldLand: Files = null,
        oldLoc: Files = null,
        oldNpc: Files = null;
    const suffix = WorldMapLabels.suffix;
    function hash(values: ArrayLike<number> | null): number {
        if (values === null) return 0;
        let result = 1;
        for (let i = 0; i < values.length; i++) result = (Math.imul(31, result) + values[i]) | 0;
        return result;
    }
    function fileHash(files: Files): number {
        return files === null ? 0 : hash(files.map(b => (b === null ? 0 : hash(new Int8Array(b.buffer, b.byteOffset, b.byteLength)))));
    }
    function groups(n: number): Int32Array | null {
        return n < 0 ? null : Int32Array.from({ length: n }, (_, i) => 400 + i);
    }
    function data(n: number): Files {
        return n < 0 ? null : Array.from({ length: n }, () => (n < 3 ? null : Uint8Array.of(0)));
    }
    function hook(point: number): void {
        if (point !== trigger || ++seen !== occurrence) return;
        switch (action) {
            case 1:
                Client.sceneMapLandData = data(argument);
                break;
            case 2:
                Client.sceneMapLocData = data(argument);
                break;
            case 3:
                Client.mapBuildNpcData = data(argument);
                break;
            case 4:
                Client.mapBuildGroundFile = groups(argument);
                break;
            case 5:
                Client.mapBuildLocationFile = groups(argument);
                break;
            case 6:
                Client.npcSpawnGroupIds = groups(argument);
                break;
            case 7:
                Reflect.set(Client, 'mapBuildKeys', argument < 0 ? null : Array.from({ length: argument }, (_, i) => (i === 1 ? null : Int32Array.of(99, 71 + i))));
                break;
            case 8:
                Client.mapBuildIndex = groups(argument);
                break;
            case 9:
                Client.mapFilesMissing = argument;
                break;
            case 10:
                Client.locsNotReadyCount = argument;
                break;
            case 11:
                WorldMap.sceneArea = argument < 0 ? null : new MapArea(argument === 0 ? null : fromJsString('other'), null, 0, 0, 0, true, 0);
                break;
            case 12:
                Reflect.set(WorldMapLabels, 'suffix', argument < 0 ? null : fromJsString('_more'));
                break;
            case 13:
                Client.worldMapArchive = argument < 0 ? null : alternate;
                break;
            case 14:
                Client.mapsArchive = argument < 0 ? null : alternate;
                break;
            case 15:
                WorldMapLabels.scene = new WorldMapLabels(argument);
                break;
            case 20:
                Client.loadingDoneSuffix = argument < 0 ? null : fromJsString('replacement');
                break;
            case 16:
                Client.out = requireNonNull(replacementOut);
                break;
            case 17:
                Reflect.set(Client, 'out', null);
                break;
            case 18:
                phase = argument;
                break;
            case 19:
                if (argument !== 0) Client.dynamicRegion = true;
                else Client.stream = null;
                break;
            default:
                throw Error('Unknown mutation ' + action);
        }
    }
    function observe(point: number, value: string): void {
        calls.push(value);
        hook(point);
    }
    function packet(capacity: number, seed: Int32Array): SuperPacket {
        const p = new SuperPacket(Math.max(capacity, 0));
        p.SetEnc(seed);
        if (capacity < 0) p.m_data = null;
        const original = p.pHead.bind(p);
        p.pHead = opcode => {
            original(opcode);
            hook(opcode === 20 ? 13 : 14);
        };
        return p;
    }
    function packetState(p: SuperPacket | null): string {
        if (p === null) return '~';
        const memory = p.m_data === null ? null : new Int8Array(p.m_data.buffer, p.m_data.byteOffset, p.m_data.byteLength);
        return [p.m_pos, hash(memory), requireNonNull(p['m_pIsaac']).TakeNextValue()].join('.');
    }
    function fixtureArchive(tag: string): Js5 {
        const archive = new Js5({ index: () => null, group: () => null, GetGroupLoadPercentage: () => 0, prefetchGroup() {} }, false, false);
        archive.GetFile = (file, group) => {
            observe(2, 'land' + tag + group + '.' + file);
            return phase === 0 ? null : Uint8Array.of(1, 2, 3);
        };
        archive.FetchFile = (file, key, group) => {
            observe(group >= 300 && group < 400 ? 4 : 3, 'file' + tag + group + '.' + file + '.' + hash(key ?? null));
            if (phase === 0) return null;
            if (group === 201 || group === 202) return Uint8Array.of(1, 66, 40, 2, 40, 0, 1, 67, 88, 0, 1, 68, 88, 0, 1, 69, 88, 0, 1, 70, 88, 0, 0);
            return Uint8Array.of(7);
        };
        archive.UpdateCacheHint2 = name => {
            observe(11, 'hint' + tag + toJsString(requireNonNull(name)));
        };
        archive.containsGroup = name => {
            observe(5, 'exists' + tag + toJsString(requireNonNull(name)));
            return phase !== 3;
        };
        archive.RequestGroupDownload2 = name => {
            observe(6, 'labels' + tag + toJsString(requireNonNull(name)));
            return phase !== 0;
        };
        archive.RequestDownload = (_check, id) => {
            observe(8, 'model' + tag + id);
            return phase !== 1 || (id & 1) === 0;
        };
        return archive;
    }
    const archive = fixtureArchive(''),
        alternate = fixtureArchive('+');
    const loadLabels = WorldMapLabels.load;
    const loadingDoneSuffix = Client.loadingDoneSuffix;
    WorldMapLabels.load = (name, source) => {
        if (source === null) {
            observe(7, 'read-null');
            return loadLabels(name, source);
        }
        observe(7, 'read' + (source === alternate ? '+' : '') + toJsString(requireNonNull(name)));
        return new WorldMapLabels(source === alternate ? 3 : 0);
    };
    Client.SetMainState = next => {
        Client.gameState = next;
        observe(12, 'state' + next);
    };
    WorldMap.reopen = () => {
        calls.push('reopen');
    };
    GameShell.DoneSlowUpdate = () => {
        calls.push('slow');
    };
    AudioEngine.tick = () => {
        calls.push('audio');
    };
    ClientBuild.Quit = () => {};
    Client.ShowObject = () => {};
    Client.LocChangePostBuildCorrect = () => {};
    Client.ResetCache = () => {};
    Client.MessageBox = (text, immediate) => {
        observe(9, 'msg' + toJsString(requireNonNull(text)) + '.' + immediate);
    };

    const app: Client = Object.create(Client.prototype);
    Client.out = new SuperPacket(5000);
    const stream = { GetAvailable: () => 0, Read: async () => {}, read: async () => -1, Write() {}, Close() {} };
    Client.PreventTimeout = force => {
        observe(1, 'keep' + force);
    };
    Object.assign(app, {
        viewport: {
            load() {
                observe(10, 'scene');
                return true;
            }
        }
    });
    for (const line of commands.trim().split(/\r?\n/)) {
        const [op, ...args] = line.split(' ').map(Number);
        if (op === 0) {
            const [state, dynamic, decor, host, zoneX, zoneZ, baseX, baseZ, stage, npc] = args;
            Reflect.set(WorldMapLabels, 'suffix', suffix);
            Client.loadingDoneSuffix = loadingDoneSuffix;
            Client.mapsArchive = Client.worldMapArchive = LocType.m_pModels = archive;
            LocType.m_recentUse.Reset();
            for (let i = 0; i < 5; i++) {
                const type = new LocType();
                type.active = i === 2 ? 1 : 0;
                type.blockwalk = i === 3 ? 1 : 0;
                type.forceDecor = i === 4;
                type.modelIds = Int32Array.of(i * 2, i * 2 + 1);
                LocType.m_recentUse.Put(BigInt(i), type);
            }
            Client.gameState = state;
            Client.sceneState = stage;
            Preferences.showGroundDecorations = decor !== 0;
            Client.dynamicRegion = dynamic !== 0;
            WorldMapLabels.scene = null;
            WorldMap.sceneArea = new MapArea(fromJsString('field'), null, 0, 0, 0, true, 0);
            GameShell.frame = host & 1 ? Object.create(null) : null;
            Client.stream = host & 2 ? stream : null;
            Client.mapBuildCentreZoneX = zoneX;
            Client.mapBuildCentreZoneZ = zoneZ;
            Client.mapBuildBaseX = baseX;
            Client.mapBuildBaseZ = baseZ;
            Client.mapBuildGroundFile = Int32Array.of(101, -1, 103);
            Client.mapBuildLocationFile = Int32Array.of(201, 202, -1);
            Client.npcSpawnGroupIds = npc === 0 ? null : Int32Array.of(-1, 301, 302);
            Client.mapBuildIndex = Int32Array.of(0, 257, 514);
            Client.mapBuildKeys = [11, -22, 33].map(n => Int32Array.of(0, n, 0, 0));
            Client.sceneMapLandData = [null, null, null];
            Client.sceneMapLocData = [null, null, null];
            Client.mapBuildNpcData = npc === 0 ? null : [null, null, null];
            if (npc === 2) {
                Client.sceneMapLandData[0] = Uint8Array.of(11);
                requireNonNull(Client.mapBuildNpcData)[1] = Uint8Array.of(13);
            }
            Client.mapFilesMissing = 65;
            Client.locsNotReadyCount = 84;
            Client.out = packet(5000, Int32Array.of(1, 2, 3, 4));
        } else {
            phase = args[0];
            trigger = op === 2 ? args[1] : 0;
            seen = 0;
            if (trigger !== 0) {
                [occurrence, action, argument] = args.slice(2);
                oldLand = Client.sceneMapLandData;
                oldLoc = Client.sceneMapLocData;
                oldNpc = Client.mapBuildNpcData;
                originalOut = Client.out;
                replacementOut = packet(action === 16 ? argument : 6, Int32Array.of(-31, 88, 499, 21));
            }
            calls = [];
            let result = 'ok';
            try {
                app['MapBuildLoop']();
            } catch (error) {
                if (trigger === 0) result = 'error';
                else if (error instanceof TypeError) result = 'null-ref';
                else if (error instanceof RangeError) result = 'bounds';
                else throw error;
            }
            let output;
            if (trigger === 0) {
                output = Buffer.from(requireNonNull(Client.out.m_data).subarray(0, Client.out.m_pos)).toString('hex');
            } else {
                output = [
                    Client.sceneMapLandData === oldLand,
                    Client.sceneMapLocData === oldLoc,
                    Client.mapBuildNpcData === oldNpc,
                    fileHash(oldLand),
                    fileHash(oldLoc),
                    fileHash(oldNpc),
                    hash(Client.mapBuildGroundFile),
                    hash(Client.mapBuildLocationFile),
                    hash(Client.npcSpawnGroupIds),
                    Client.mapBuildKeys === null ? 0 : hash(Client.mapBuildKeys.map(hash)),
                    hash(Client.mapBuildIndex),
                    WorldMapLabels.scene?.count ?? -1,
                    seen,
                    Client.out === null ? -1 : Client.out === originalOut ? 0 : 1,
                    packetState(originalOut),
                    packetState(replacementOut)
                ].join(':');
            }
            console.log(
                [
                    result,
                    Client.gameState,
                    Client.mapFilesMissing,
                    Client.locsNotReadyCount,
                    Client.sceneState,
                    WorldMapLabels.scene === null,
                    fileHash(Client.sceneMapLandData),
                    fileHash(Client.sceneMapLocData),
                    fileHash(Client.mapBuildNpcData),
                    output,
                    calls.join(',')
                ].join('/')
            );
        }
    }
}

if (process.argv[2] === 'trace') trace(await Bun.stdin.text());
else {
    const { expect, test } = await import('bun:test');
    test('gj.e and ll.a preserve live archive reads, partial rebuild state, model checks and both packet buffers', () => {
        const dir = mkdtempSync(join(tmpdir(), 'mapbuildloop530-'));
        const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'MapBuildLoopOracle'];
        try {
            const source = fileURLToPath(new URL('./game/MapBuildLoopOracle.java', import.meta.url));
            const compile = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, source]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const patch = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const rows: string[] = [];
            for (const dynamic of [0, 1])
                for (const state of [25, 28])
                    for (const host of [0, 1, 2, 3])
                        for (const decor of [0, 1]) {
                            for (const [x, z, bx, bz, npc] of [
                                [386, 388, 0, 0, 0],
                                [-11, 5, 65, 66, 1],
                                [1, -30, -200, 1, 2]
                            ]) {
                                rows.push([0, state, dynamic, decor, host, x, z, bx, bz, 0, npc].join(' '), '1 0', '1 0', '1 1', '1 2');
                            }
                        }
            const labels = rows.filter(line => line.startsWith('1 ')).map((_, i) => 'baseline ' + i);
            function mutate(phase: number, point: number, at: number, action: number, argument: number): void {
                rows.push('0 25 0 1 3 386 388 0 0 2 1');
                const cmd = [2, phase, point, at, action, argument].join(' ');
                rows.push(cmd);
                labels.push(cmd);
            }
            // A fetch writes to its original destination, then gj.e reads the live field again.
            for (const point of [1, 2, 3, 4])
                for (const at of point === 1 ? [1] : [1, 2]) {
                    for (const action of [1, 2, 3, 4, 5, 6, 7, 8]) for (const size of [-1, 0, 1, 2, 3, 4]) mutate(2, point, at, action, size);
                    for (const size of [2, 3]) for (const action of [1, 2, 3]) mutate(0, point, at, action, size);
                }
            // A signed counter may wrap or be overwritten while the method holds a failed-ready flag.
            for (const point of [2, 3, 4, 5, 6, 7, 8, 9, 10])
                for (const phase of [0, 1, 2])
                    for (const n of [-1, 0, 2147483647, -2147483648]) {
                        mutate(phase, point, 1, 9, n);
                        mutate(phase, point, 1, 10, n);
                    }
            // The final failing model can increment -1 to 0; gj.e must still publish stage 2.
            for (const at of [2, 10, 20]) for (const n of [-1, 2147483647]) mutate(1, 8, at, 10, n);
            for (const point of [2, 3, 4, 5, 6, 7, 8, 11]) for (const action of [11, 12, 13, 14]) for (const n of [-1, 0, 1]) mutate(2, point, 1, action, n);
            for (const point of [5, 6, 7])
                for (const phase of [0, 2, 3]) {
                    mutate(phase, point, 1, 15, 7);
                    for (const n of [0, 2, 3]) mutate(phase, point, 1, 18, n);
                }
            for (const point of [1, 2, 3, 4, 5, 6, 7, 8]) for (const arg of [-1, 0]) mutate(2, point, 1, 20, arg);
            // Each header and payload re-reads qk.v, and ej.a can replace it before the final header.
            for (const point of [1, 9, 10, 11, 12, 13, 14]) {
                for (const n of [-1, 0, 1, 2, 3, 4, 5, 6]) mutate(2, point, 1, 16, n);
                mutate(2, point, 1, 17, 0);
                for (const n of [0, 1]) mutate(2, point, 1, 19, n);
            }
            for (const action of [1, 2, 3, 7, 8]) for (const n of [-1, 0, 1, 2, 3, 4]) mutate(2, 8, 1, action, n);
            const stdin = Buffer.from(rows.join('\n') + '\n');
            const expected = Bun.spawnSync(java, { stdin, maxBuffer: 16 * 1024 * 1024 });
            expect(expected.exitCode, expected.stderr.toString()).toBe(0);
            const actual = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'trace'], { stdin, maxBuffer: 16 * 1024 * 1024 });
            expect(actual.exitCode, actual.stderr.toString()).toBe(0);
            const original = expected.stdout.toString().trim().split(/\r?\n/);
            const result = actual.stdout.toString().trim().split(/\r?\n/);
            expect(original.length).toBe(labels.length);
            expect(result.length).toBe(original.length);
            for (let i = 0; i < result.length; i++) expect(result[i], labels[i]).toBe(original[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 20000);
}
