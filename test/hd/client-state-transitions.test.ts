import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5MasterIndex from '#/cache/Js5MasterIndex.js';
import Client from '#/client/Client.js';
import MouseTracking from '#/client/MouseTracking.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import { fromJsString } from '#/datastruct/JagString.js';
import GlRenderer from '#/gl/GlRenderer.js';
import NoiseTextures from '#/gl/NoiseTextures.js';
import Fonts from '#/graphics/Fonts.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import GameWorld from '#/io/GameWorld.js';
import SafeTime from '#/io/SafeTime.js';
import WorldList from '#/io/WorldList.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import SuperPacket from '#/io/SuperPacket.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Preferences from '#/ui/Preferences.js';
import TitleScreen from '#/title/TitleScreen.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD state changes match the native call order, failed transitions and forwarded window commands',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-client-state-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            function run(args: string[]): string[] {
                const result = Bun.spawnSync(args);
                expect(result.exitCode, result.stderr.toString()).toBe(0);
                return result.stdout.toString().trimEnd().split(/\r?\n/);
            }
            run(['javac', asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdClientStateOracle.java')]);
            run(['java', asm, '-cp', cp, 'HdClientStateOracle', hdGamepackPath, dir]);
            const expected = run(['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdClientStateOracle']);
            const actual: string[] = [];
            let stop = '',
                recording = false;
            let events: string[] = [];
            function event(label: string): void {
                if (!recording) return;
                events.push(label);
                if (label === stop) throw new RangeError(label);
            }
            function witness<T, K extends keyof T>(owner: T, key: K, label: string): void {
                let value = owner[key];
                Object.defineProperty(owner, key, {
                    configurable: true,
                    get: () => value,
                    set: (next: T[K]) => {
                        value = next;
                        event(label);
                    }
                });
            }
            async function row(name: string, exercise: () => unknown, state: () => string): Promise<void> {
                events = [];
                recording = true;
                let failed = false;
                try {
                    await exercise();
                } catch {
                    failed = true;
                }
                recording = false;
                actual.push([name, failed, events.join(';'), state()].join('|'));
            }
            Client.js5NetQueue = new Js5NetQueue();
            Client.js5NetQueue.setLoggedIn = loggedIn => {
                event('js5:' + loggedIn);
            };
            Preferences.musicVolume = 0;
            GlRenderer.copyFrontToBack = () => event('copy:' + Client.gameState);
            witness(Client, 'gameState', 'commit');
            witness(Client, 'locsNotReadyCount', 'missingLocs');
            witness(Client, 'mapLoadingTotal', 'filePeak');
            witness(Client, 'sceneState', 'phase');
            witness(Client, 'maxLocModelsMissing', 'modelPeak');
            witness(Client, 'mapFilesMissing', 'missingFiles');
            for (const active of [false, true])
                for (const before of [10, 25, 28, 30, 40])
                    for (const next of [10, 25, 28, 30, 40])
                        for (const fail of [false, true]) {
                            GlRenderer.active = active;
                            Client.gameState = before;
                            stop = fail ? 'copy:' + before : '';
                            await row(
                                ['state', active, before, next, fail].join(','),
                                () => Client.SetMainState(next),
                                () => String(Client.gameState)
                            );
                        }
            Client.SetMainState = next => event('state:' + next);
            for (const active of [false, true])
                for (const before of [5, 10, 25, 28, 30, 40]) {
                    GlRenderer.active = active;
                    Client.gameState = before;
                    stop = '';
                    await row(
                        ['rebuild', active, before].join(','),
                        () => Client.rebuildSceneIfIngame(),
                        () => String(Client.gameState)
                    );
                }
            Client.setWindowMode = async (width, apply, mode, replace, height) => {
                expect(apply).toBe(true);
                await Promise.resolve();
                event('mode:' + mode + ',' + width + ',' + height + ',' + replace);
            };
            for (const rights of [0, 2])
                for (const text of ['::wm0', '::WM1', '::wm2', '::wm3', '::wm3 ', '::wm4'])
                    for (const fail of [false, true]) {
                        Client.staffModLevel = rights;
                        const packet = (Client.out = new SuperPacket(128));
                        packet.SetEnc(Int32Array.of(1, 22, 4, 8));
                        const mode = Number(text.charAt(4));
                        stop = fail ? 'mode:' + mode + ',' + (mode === 3 ? '1024,768' : '-1,-1') + ',false' : '';
                        await row(
                            ['cheat', rights, text, fail].join(','),
                            () => Client.DoCheat(fromJsString(text)),
                            () => Buffer.from(requireNonNull(packet.m_data).subarray(0, packet.m_pos)).toString('hex')
                        );
                    }
            Preferences.write = () => event('save');
            NoiseTextures.buildVolumes = () => event('noise');
            witness(Preferences, 'antiAliasingMode', 'aa');
            witness(Preferences, 'currentAntiAliasingMode', 'liveAA');
            witness(Preferences, 'windowMode', 'window');
            witness(Preferences, 'buildArea', 'area');
            witness(Preferences, 'safeMode', 'safe');
            witness(TitleScreen, 'm_loadPos', 'percent');
            witness(TitleScreen, 'm_loadString', 'text');
            witness(Client, 'loadingStage', 'stage');
            const client = Object.create(Client.prototype) as Client;
            for (const safe of [false, true])
                for (const failure of ['', 'noise', 'liveAA', 'safe', 'save', 'mode', 'percent', 'stage', 'text']) {
                    Preferences.safeMode = safe;
                    Preferences.antiAliasingMode = 2;
                    Preferences.currentAntiAliasingMode = 1;
                    Preferences.windowMode = 2;
                    Preferences.buildArea = 3;
                    Client.loadingStage = 150;
                    TitleScreen.m_loadPos = 97;
                    TitleScreen.m_loadString = null;
                    stop = failure === 'mode' ? 'mode:' + (safe ? 0 : 2) + ',-1,-1,false' : failure;
                    await row(
                        ['load', safe, failure].join(','),
                        () => client['MainLoad'](),
                        () =>
                            [
                                Preferences.antiAliasingMode,
                                Preferences.currentAntiAliasingMode,
                                Preferences.windowMode,
                                Preferences.buildArea,
                                Preferences.safeMode,
                                Client.loadingStage,
                                TitleScreen.m_loadPos,
                                TitleScreen.m_loadString === LocalisedText.started3dLibrary
                            ].join(',')
                    );
                }
            const archive = Object.assign(Object.create(Js5.prototype), { GetGroupId: () => 1, discardNames() {} }) as Js5;
            Client.OpenJs5 = () => archive;
            Client.loadFonts = Client.loadSprites = () => {};
            SafeTime.CurrentTimeMillis = () => 2999n;
            Fonts.getFileCount = TitleScreen.ReadyMax = SpriteLoader.total = () => 1;
            for (const stage of [0, 10, 30, 50, 60, 65, 80, 135, 140])
                for (const gate of [0, 1])
                    for (const failure of ['', 'text', 'stage', 'percent']) {
                        Preferences.safeMode = WorldList.loaded = true;
                        Client.usedMemoryKb = () => gate * 20480;
                        Client.lastGcTime = Client.loadingMemoryCheckStart = 0n;
                        Client.countFontsReady = Client.getGameSpritesLoaded = TitleScreen.Ready = () => gate;
                        Client.js5MasterIndex = Object.assign(Object.create(Js5MasterIndex.prototype), { load: () => gate !== 0 });
                        GameWorld.ListFetch = async () => (gate ? 0 : -1);
                        Client.mapsArchive = Client.m_pMidi = Client.m_pSprites = Client.fontMetricsArchive = Client.binaryArchive = Client.interfacesArchive = archive;
                        Client.loadingStage = stage;
                        TitleScreen.m_loadPos = -1;
                        TitleScreen.m_loadString = null;
                        stop = failure;
                        await row(
                            ['progress', stage, gate, failure].join(','),
                            () => client['MainLoad'](),
                            () => [Client.loadingStage, TitleScreen.m_loadPos, TitleScreen.m_loadString !== null].join(',')
                        );
                    }
            InterfaceList.reset = () => {};
            witness(OrbitCamera, 'reportPending', 'camera');
            witness(Client, 'verifyId', 'verify');
            for (const active of [false, true])
                for (const short of [-1, 0, 1, 2])
                    for (const failAtCamera of [false, true]) {
                        stop = failAtCamera ? 'camera' : '';
                        GlRenderer.active = active;
                        Client.forceImmediateEnvironmentUpdate = false;
                        Client.gameState = 10;
                        Client.verifyId = 9;
                        OrbitCamera.reportPending = false;
                        Client.mouseTracking = new MouseTracking();
                        InterfaceList.top = -1;
                        Object.assign(Client, { statEffectiveLevel: new Int32Array(short === 0 ? 24 : 25).fill(1), statBaseLevel: new Int32Array(short === 1 ? 24 : 25).fill(1), statXP: new Int32Array(short === 2 ? 24 : 25).fill(1) });
                        Client.out = new SuperPacket(128);
                        Client.out.SetEnc(Int32Array.of(1, 22, 4, 8));
                        await row(
                            ['reset', active, short, failAtCamera].join(','),
                            () => Client.resetGame(),
                            () =>
                                [Client.forceImmediateEnvironmentUpdate, OrbitCamera.reportPending, Client.verifyId, ...[Client.statEffectiveLevel, Client.statBaseLevel, Client.statXP].map(values => values.reduce((total, x) => total + x, 0))].join(
                                    ','
                                )
                        );
                    }
            expect(actual).toEqual(expected);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
