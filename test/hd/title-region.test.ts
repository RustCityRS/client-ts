import { expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import HashTable from '#/datastruct/HashTable.js';
import Linkable from '#/datastruct/Linkable.js';
import { toJsString } from '#/datastruct/JagString.js';
import GlRenderer from '#/gl/GlRenderer.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import TitleFlames from '#/title/TitleFlames.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import Minimenu from '#/ui/Minimenu.js';
import SubInterface from '#/ui/SubInterface.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function command(args: string[]): string[] {
    const child = Bun.spawnSync(args, { timeout: 25000, maxBuffer: 8 * 1024 * 1024 });
    expect(child.exitCode, child.stderr.toString()).toBe(0);
    return child.stdout.toString().trimEnd().split(/\r?\n/);
}

function titleState() {
    const player = Client.localPlayer;
    const keys = Client.mapBuildKeys;
    const state = [OrbitCamera.x, OrbitCamera.z, Client.forceImmediateEnvironmentUpdate, InterfaceList.top, Minimenu.defaultCursor, player ? player.x + '/' + player.z : 'null'];
    const ids = [Client.mapBuildIndex, Client.mapBuildGroundFile, Client.mapBuildLocationFile, Client.npcSpawnGroupIds, Client.sceneMapUnderwaterLandFile, Client.sceneMapUnderwaterLocFile].map(a => (a === null ? 'null' : '[' + a.join(',') + ']'));
    const files = [Client.sceneMapLocData, Client.mapBuildNpcData, Client.sceneMapUnderwaterLandData, Client.sceneMapLandData, Client.sceneMapUnderwaterLocData].map(a => (a === null ? 'null' : a.length + '/' + a.filter(v => v !== null).length));
    const keyState = keys === null ? 'null' : keys.length + '/' + keys.filter(k => k.length === 4 && k.every(v => v === 0)).length;
    return [state.join(','), ...ids, keyState, files.join(',')];
}

loginFixture(
    import.meta.url,
    'HD title reset and camera map requests match fm and ca including partial JS5 failures',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-title-regions-'));
        try {
            const cases: number[][] = [];
            for (const [x, z, bx, bz] of [
                [0, 0, 3200, 3200],
                [-17001, 7550, -97, 655],
                [0, 0, 0, 0],
                [1024, 32767, 3, 77],
                [2147483647, -2147483648, -2147483648, 2147483647]
            ]) {
                for (const mode of [0, 1, 2, 3]) cases.push([0, 0, 1, 0, x, z, bx, bz, mode, 0]);
            }
            // 3 by 3 squares. Stop each of the five group lookups to observe the preceding array stores.
            for (let fail = 1; fail <= 45; fail++) cases.push([0, 0, 1, 0, 4096, 4096, 3200, 3200, 1, fail]);
            for (const open of [0, 1])
                for (const gl of [0, 1])
                    for (const camera of [0, 2, 3, 4]) {
                        cases.push([1, open, gl, camera, 61000, 49000, 3200, 3200, 0, 0], [1, open, gl, camera, 61000, 49000, 3200, 3200, 1, 3]);
                    }
            cases.push([1, 1, 0, 2, 0, 0, 3200, 3200, 4, 0], [1, 1, 1, 2, 0, 0, 3200, 3200, 4, 0]);
            const input = join(dir, 'cases.txt');
            writeFileSync(input, cases.map(row => row.join(' ')).join('\n') + '\n');
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            command(['javac', asm, '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdTitleRegionOracle.java')]);
            command(['java', asm, '-cp', cp, 'HdTitleRegionOracle', 'patch', hdGamepackPath, dir]);
            const expected = command(['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdTitleRegionOracle', cachePath, input]);
            expect(expected).toHaveLength(cases.length);
            expect(expected[0]).toContain('n50_50=2434');

            const assets = localAssets(cachePath, [5]),
                maps = assets.archive(5);
            const groupId = maps.GetGroupId.bind(maps);
            const game = new Client();
            Object.assign(game, { assets });
            let events: string[] = [];
            Client.StartRebuild = (level, zoneZ, localX, zoneX, localZ, title) => {
                events.push(['rebuild', level, zoneZ, localX, zoneX, localZ, title].join(' '));
            };
            IfType.CloseInterface = id => {
                events.push('close ' + id);
            };
            Client.CloseSubinterface = (sub, discard) => {
                events.push('sub ' + sub.key + ' ' + sub.group + ' ' + discard);
                sub.Unlink();
            };
            InterfaceList.reset = () => {
                events.push('reset');
            };
            Client.InterfaceCalculateSizeAndPosAll = resize => {
                events.push('resize ' + resize);
            };
            InterfaceList.redrawAll = () => {
                events.push('redraw');
            };
            ScriptRunner.OnLoad = id => {
                events.push('load ' + id);
            };
            InterfaceSession.prototype.refreshView = () => {};
            Client.setCursor = id => {
                events.push('cursor ' + id);
            };
            TitleFlames.SetupFire = () => {
                events.push('flames');
            };
            Client.SetMainState = id => {
                events.push('state ' + id);
            };
            for (const [i, c] of cases.entries()) {
                const [path, open, gl, camera, x, z, bx, bz, mode, fail] = c;
                events = [];
                let requests = 0;
                const retained: { ground: Int32Array | null } = { ground: null };
                maps.GetGroupId = name => {
                    const text = toJsString(requireNonNull(name));
                    let id = groupId(name);
                    requests++;
                    if (mode === 1) id = text.startsWith('n') && (requests & 1) === 1 ? -1 : requests + 4000;
                    events.push(text + '=' + id);
                    if (requests === fail) throw new RangeError('fixture');
                    if (mode === 2 && requests === 1) Client.mapsArchive = null;
                    if (mode === 3 && requests === 1) {
                        retained.ground = Client.mapBuildGroundFile;
                        Client.mapBuildGroundFile = new Int32Array(18).fill(9191);
                    }
                    return id;
                };
                Client.mapsArchive = maps;
                OrbitCamera.x = x;
                OrbitCamera.z = z;
                Client.mapBuildBaseX = bx;
                Client.mapBuildBaseZ = bz;
                CinematicCamera.tileX = -21;
                CinematicCamera.tileZ = 387;
                OrbitCamera.mode = camera;
                CinematicCamera.positionPath = CinematicCamera.lookPath = -1;
                if (camera === 4) {
                    OrbitCamera.mode = 3;
                    CinematicCamera.positionPath = 0;
                    CinematicCamera.lookPath = 1;
                    CinematicCamera.positionSegment = CinematicCamera.lookSegment = 0;
                    CinematicCamera.progress = 5731;
                    CinematicCamera.startRate = 432;
                    CinematicCamera.endRate = 3011;
                    CinematicCamera.paths[0] = [
                        [399250, 307, 418761],
                        [388555, -18, 378200],
                        [435567, 1414, 459298],
                        [490917, 17, 381943]
                    ].map(row => Int32Array.from(row));
                    CinematicCamera.paths[1] = [
                        [412318, 355, 415048],
                        [385713, 2340, 402148],
                        [409999, -932, 385165],
                        [470130, 1514, 377201]
                    ].map(row => Int32Array.from(row));
                }
                InterfaceList.top = 331;
                Client.loginScreenInterface = 738;
                InterfaceList.subInterfaces = new HashTable(8);
                for (const key of [3, 1, 9]) {
                    const sub = new SubInterface();
                    sub.group = key + 700;
                    InterfaceList.subInterfaces.put(sub, BigInt(key));
                }
                if (mode === 4) (InterfaceList.subInterfaces as HashTable<Linkable>).put(new Linkable(), 2n);
                Client.defaultCursor = 3;
                Minimenu.defaultCursor = 500;
                Client.localPlayer = null;
                GlRenderer.active = gl !== 0;
                Client.forceImmediateEnvironmentUpdate = false;
                Client.sceneMapLocData = Client.mapBuildNpcData = Client.sceneMapUnderwaterLandData = Client.sceneMapLandData = Client.sceneMapUnderwaterLocData = null;
                Client.sceneMapUnderwaterLocFile = Client.mapBuildGroundFile = Client.mapBuildIndex = Client.npcSpawnGroupIds = Client.sceneMapUnderwaterLandFile = Client.mapBuildLocationFile = null;
                Client.mapBuildKeys = null;
                let fault = '-';
                try {
                    if (path === 0) Client.setupTitleRegion();
                    else {
                        const result = game.resetToTitle(open !== 0);
                        expect(result).toBeUndefined(); // these cases complete before returning to the browser
                    }
                } catch (error) {
                    if (!(error instanceof WrappedException)) throw error;
                    const type = error.cause instanceof RangeError ? 'IllegalArgumentException' : error.cause?.message.startsWith('ClassCastException') ? 'ClassCastException' : 'NullPointerException';
                    fault = type + '/' + error.context;
                }
                const original = retained.ground === null ? 'null' : '[' + retained.ground.join(',') + ']';
                expect([events.join(';'), fault, ...titleState(), original].join('|'), c.join(' ')).toBe(expected[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
