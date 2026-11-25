import SceneCutover from '#/scene/SceneCutover.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import GameShell from '#/client/GameShell.js';
import Js5 from '#/cache/Js5.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';

import SuperPacket from '#/io/SuperPacket.js';
import AudioEngine from '#/sound/AudioEngine.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { gamepackPath } from './reference.js';

test('map-build completion matches the JAR around the pending native roof setup, including all stacks and packet gates', () => {
    const previousNative = SceneCutover.native;
    using _geometryStub = {
        [Symbol.dispose]() {
            SceneCutover.native = previousNative;
        }
    };
    SceneCutover.native = false;
    const dir = mkdtempSync(join(tmpdir(), 'rs530-map-post-'));
    const client = {
        gameState: Client.gameState,
        sceneState: Client.sceneState,
        sceneMapLandData: Client.sceneMapLandData,
        sceneMapLocData: Client.sceneMapLocData,
        mapBuildGroundFile: Client.mapBuildGroundFile,
        mapBuildLocationFile: Client.mapBuildLocationFile,
        npcSpawnGroupIds: Client.npcSpawnGroupIds,
        mapFilesMissing: Client.mapFilesMissing,
        locsNotReadyCount: Client.locsNotReadyCount,
        mapBuildCentreZoneX: Client.mapBuildCentreZoneX,
        mapBuildCentreZoneZ: Client.mapBuildCentreZoneZ,
        dynamicRegion: Client.dynamicRegion,
        mapsArchive: Client.mapsArchive,
        stream: Client.stream,
        out: Client.out,
        PreventTimeout: Client.PreventTimeout,
        ShowObject: Client.ShowObject,
        LocChangePostBuildCorrect: Client.LocChangePostBuildCorrect,
        ResetCache: Client.ResetCache,
        SetMainState: Client.SetMainState
    };
    const old = { frame: GameShell.frame, labels: WorldMapLabels.scene, quit: ClientBuild.Quit, roof: RoofModeStatics.applyRoofMode, tick: AudioEngine.tick, reopen: WorldMap.reopen, slow: GameShell.DoneSlowUpdate };
    let calls: string[] = [],
        count = 0,
        hash = 1,
        hints = 0,
        mode = 0,
        pumps = 0,
        pending = false;
    function event(label: string): void {
        calls.push(label);
        if (mode === 31 && label === 'reset') {
            Client.stream = null;
            Client.gameState = 28;
        }
    }
    function fail(code: number): void {
        if (code === mode) throw new Error('probe');
    }
    try {
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const build = Bun.spawnSync(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/MapBuildPostOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const java = ['java', ...access, '-cp', dir + delimiter + gamepackPath, 'MapBuildPostOracle'];
        const instrumented = Bun.spawnSync([...java, gamepackPath, dir]);
        expect(instrumented.exitCode, instrumented.stderr.toString()).toBe(0);
        const groups = new Js5({ index: () => null, group: () => null, GetGroupLoadPercentage: () => 0, prefetchGroup() {} }, false, false);
        const app = Object.create(Client.prototype) as Client;
        Object.assign(app, {
            viewport: {
                load(rebuild: boolean) {
                    if (!rebuild) throw new Error('Expected rebuild');
                    event('geometry');
                    fail(1);
                    return !pending;
                }
            }
        });
        Client.PreventTimeout = force => event('keep' + force);
        ClientBuild.Quit = () => {
            event('quit');
            fail(2);
        };
        Client.ShowObject = (z, x) => {
            if (x !== ((count / 104) | 0) || z !== count % 104) throw new Error('Unexpected ground tile ' + x + ',' + z + ' at ' + count);
            if (count === 0) event('sort');
            count++;
            hash = (Math.imul(hash, 31) + (x << 8) + z) | 0;
            if (count === 1) fail(3);
            if (count === 105) fail(4);
            if (count === 10816) fail(5);
        };
        RoofModeStatics.applyRoofMode = () => {
            throw new Error('The viewport has not built the native scene squares');
        };
        AudioEngine.tick = () => {
            event('audio');
            fail(++pumps === 1 ? 7 : 14);
        };
        Client.LocChangePostBuildCorrect = () => {
            event('correct');
            fail(8);
        };
        Client.ResetCache = () => {
            event('reset');
            fail(9);
        };
        groups.UpdateCacheHint2 = () => {
            if (++hints === 1) event('hints');
            fail(11);
        };
        groups.GetFile = () => {
            event('missing');
            return null;
        };
        Client.SetMainState = next => {
            Client.gameState = next;
            event('state' + next);
        };
        WorldMap.reopen = () => {
            event('reopen');
            fail(13);
        };
        GameShell.DoneSlowUpdate = () => {
            event('slow');
            fail(15);
        };
        const cases: number[][] = [];
        for (const state of [25, 28])
            for (const dynamic of [0, 1])
                for (const host of [0, 1, 2, 3]) {
                    for (const probe of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 30, 31, 32]) cases.push([state, dynamic, host, probe]);
                }
        const observed = Bun.spawnSync(java, { stdin: Buffer.from(cases.map(a => a.join(' ')).join('\n') + '\n'), maxBuffer: 8 * 1024 * 1024 });
        expect(observed.exitCode, observed.stderr.toString()).toBe(0);
        const lines = observed.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(cases.length);
        function reset(a: number[]): void {
            Client.gameState = a[0];
            Client.sceneState = 0;
            Client.dynamicRegion = a[1] !== 0;
            GameShell.frame = a[2] & 1 ? Object.create(null) : null;
            Client.stream = a[2] & 2 ? Object.create(null) : null;
            mode = a[3];
            count = hints = pumps = 0;
            hash = 1;
            calls = [];
            Client.sceneMapLandData = mode === 30 ? [null] : [];
            Client.sceneMapLocData = mode === 30 ? [null] : [];
            Client.mapBuildGroundFile = Int32Array.of(3);
            Client.mapBuildLocationFile = Int32Array.of(-1);
            Client.npcSpawnGroupIds = null;
            Client.mapsArchive = groups;
            Client.mapBuildCentreZoneX = 30;
            Client.mapBuildCentreZoneZ = 42;
            WorldMapLabels.scene = new WorldMapLabels(0);
            Client.out = new SuperPacket(8);
            Client.out.pHead = value => {
                event('p' + value);
                fail(value === 20 ? 10 : 12);
            };
            Client.out.p4 = value => event('w' + value);
        }
        function run(): string {
            let result = 'ok';
            try {
                app['MapBuildLoop']();
            } catch (e) {
                if (e instanceof Error && e.message === 'probe') result = 'probe';
                else throw e;
            }
            return [result, Client.gameState, Client.sceneState, count, hash, hints, calls.join(',')].join('/');
        }
        // The JAR retains ia.c(512) and its fault and static-mutation probes. The live client can call the
        // native roof setup once the viewport has populated world.squares. Compare the other operations
        // to the same JAR input with that sole callback omitted. Modes 6/32 act only inside ia.c.
        const normal = new Map<string, string>();
        const liveSuffix = (line: string) => line.replace(',sort,roof,audio', ',sort,audio');
        for (const [i, a] of cases.entries()) {
            const key = a.slice(0, 3).join(' ');
            const original = lines[i];
            if (a[3] === 0) {
                expect(original).toContain(',quit,sort,roof,audio,correct,reset,');
                normal.set(key, original);
            } else if (a[3] === 6) {
                expect(original).toBe('probe/' + a[0] + '/0/10816/24436001/0/keepfalse,geometry,quit,sort,roof');
            } else if (a[3] === 32) {
                const loginAck = a[2] & 2 ? ',p110' : '';
                expect(original).toBe('ok/30/0/10816/24436001/0/keepfalse,geometry,quit,sort,roof,audio,correct,reset,state30' + loginAck + ',reopen,audio,slow');
            }
            const reference = a[3] === 6 || a[3] === 32 ? normal.get(key) : original;
            if (reference === undefined) throw new Error('Missing JAR baseline ' + key);
            reset(a);
            expect(run(), a.join(' ')).toBe(liveSuffix(reference));
        }
        reset(cases[0]);
        pending = true;
        expect(run()).toBe('ok/25/0/0/1/0/keepfalse,geometry');
        expect(Client.gameState).toBe(25);
        pending = false;
        calls = [];
        expect(run()).toBe(liveSuffix(lines[0]));
    } finally {
        Object.assign(Client, client);
        GameShell.frame = old.frame;
        WorldMapLabels.scene = old.labels;
        ClientBuild.Quit = old.quit;
        RoofModeStatics.applyRoofMode = old.roof;
        AudioEngine.tick = old.tick;
        WorldMap.reopen = old.reopen;
        GameShell.DoneSlowUpdate = old.slow;
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
