import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import ClientBuild from '#/client/ClientBuild.js';
import GameShell from '#/client/GameShell.js';
import MouseTracking from '#/client/MouseTracking.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import world from '#/dash3d/world.js';
import Protocol from '#/io/Protocol.js';
import SceneCutover from '#/scene/SceneCutover.js';
import AudioEngine from '#/sound/AudioEngine.js';
import Preferences from '#/ui/Preferences.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

function cornerCount(): number {
    return world.levelHeightmaps === null ? -1 : world.levelHeightmaps[0][0].length;
}

loginFixture(
    import.meta.url,
    'scene cutover preserves gj.e geometry boundaries and the t.c minimap retry and publication order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'scene530-cutover-'));
        const asm = ['--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports=java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
        let rows: string[];
        try {
            const compile = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'SceneCutoverOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'SceneCutoverOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(java);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            rows = run.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }

        expect(SceneCutover.native).toBe(true);
        const client: Client = Object.create(Client.prototype);
        const init = world.init,
            roof = RoofModeStatics.applyRoofMode;
        const end = new Error('end of observed bytecode');
        let events: string[] = [],
            pending = false,
            inNativeGeometry = false,
            geometry = false,
            tiles = 0,
            tileHash = 1,
            action = 0,
            cursor = 0;
        Client.PreventTimeout = force => {
            if (!inNativeGeometry) events.push('keep' + force);
        };
        Client.ResetCache = () => {
            if (inNativeGeometry) return;
            events.push('reset-18131');
            if (geometry) throw end;
        };
        AudioEngine.tick = () => {
            if (!inNativeGeometry) events.push('audio64');
        };
        world.init = (levels, x, z, radius, underwater) => {
            events.push('init' + [levels, x, z, radius, underwater].join(','));
            init(levels, x, z, radius, underwater);
            geometry = true;
            events.push('viewport' + (world.squares?.length ?? -1));
            if (pending) throw end;
            inNativeGeometry = true;
        };
        RoofModeStatics.applyRoofMode = () => {
            events.push('roof512:' + MinimapBuilder.minimapLevel + ':' + tiles);
            roof();
        };
        // SceneCutoverOracle jumps from mc.a directly to lk.c. The full region is exercised by native-scene-click.
        for (let level = 0; level < 4; level++) CollisionMap.levelMaps[level] = new CollisionMap(104, 104);
        ClientBuild.Init = () => {};
        ClientBuild.FinishBuild = () => {};
        world.FillBaseLevel = () => {};
        ClientBuild.Quit = () => {
            inNativeGeometry = false;
            events.push('quit8428');
        };
        Client.ShowObject = (z, x) => {
            tiles++;
            tileHash = (Math.imul(31, (Math.imul(31, tileHash) + x) | 0) + z) | 0;
        };
        Client.LocChangePostBuildCorrect = () => {
            events.push('locstrue');
        };
        Client.LocChangeDoQueue = () => {
            events.push('queue-118');
            throw end;
        };
        function build(level: number, native: boolean): boolean {
            events.push((native ? 'buffer' : 'legacy') + level);
            if (action === 2) Client.playerLevel = 3;
            if (action === 3) Client.gameState = 25;
            if (!native && action !== 0) MinimapBuilder.minimapLevel = level;
            return native && action !== 0;
        }
        MinimapBuilder.BuildBuffer = level => build(level, true);
        Object.assign(client, {
            viewport: {
                load(force: boolean) {
                    expect(force).toBe(true);
                    geometry = true;
                    events.push('viewport' + (world.squares?.length ?? -1));
                    return !pending;
                },
                minimap: {
                    prepareNativeBuffer(level: number) {
                        build(level, false);
                    }
                }
            }
        });
        Protocol.tryReadPacket = async () => false;
        Client.mouseTracking = new MouseTracking();
        Client.lastSentFocus = GameShell.m_focus;
        OrbitCamera.reportPending = false;
        Preferences.sent = true;
        for (const enabled of [false, true]) {
            SceneCutover.native = enabled;
            Client.sceneMapLandData = Client.sceneMapLocData = [];
            WorldMapLabels.scene = new WorldMapLabels(0);
            Client.sceneState = 0;
            Client.gameState = 25;
            RoofModeStatics.roofRemovalDisabled = true;
            MinimapBuilder.minimapLevel = -1;
            world.squares = world.mainLevelTiles = null;
            world.levelHeightmaps = world.mainGroundh = null;
            RoofModeStatics.roofMarks = [[new Uint8Array(1)]];
            RoofModeStatics.hideMinZ = new Int32Array(3);
            for (const retry of [true, false]) {
                pending = retry;
                geometry = false;
                tiles = 0;
                tileHash = 1;
                events = [];
                const old = world.squares;
                try {
                    client['MapBuildLoop']();
                } catch (error) {
                    if (error !== end) throw error;
                }
                const actual = [
                    events.join(';'),
                    tiles,
                    tileHash,
                    world.squares !== old,
                    world.squares === world.mainLevelTiles,
                    world.levelHeightmaps === world.mainGroundh,
                    cornerCount(),
                    RoofModeStatics.roofMarks === null,
                    RoofModeStatics.hideMinZ.length
                ].join('/');
                expect(actual, 'rebuild native=' + enabled + ' retry=' + retry).toBe(rows[cursor++]);
            }
            Preferences.allLevelsVisible = true;
            MinimapBuilder.minimapLevel = -1;
            Client.playerLevel = 2;
            tiles = 0;
            for (const step of [0, 0, 1, 1, 2, 3]) {
                if (step >= 2) Client.playerLevel = step - 2;
                Client.gameState = 30;
                action = step;
                events = [];
                RoofModeStatics.roofMarks = [[new Uint8Array(1)]];
                RoofModeStatics.hideMinZ = new Int32Array(3);
                try {
                    await client.GameLoop();
                } catch (error) {
                    if (error !== end) throw error;
                }
                const actual = [events.join(';'), Client.gameState, Client.playerLevel, MinimapBuilder.minimapLevel, RoofModeStatics.roofMarks === null, RoofModeStatics.hideMinZ.length].join('/');
                expect(actual, 'game native=' + enabled + ' action=' + step).toBe(rows[cursor++]);
            }
        }
        expect(cursor).toBe(rows.length);
    },
    45000
);
