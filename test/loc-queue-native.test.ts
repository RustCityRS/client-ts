import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import LocType from '#/config/LocType.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import LocChange from '#/dash3d/LocChange.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import world from '#/dash3d/world.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import SceneCutover from '#/scene/SceneCutover.js';
import Preferences from '#/ui/Preferences.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Scenario = [mode: number, expiry: number, shape: number];
function run([mode, expiry, shape]: Scenario): string[] {
    const queue = (Client.locChanges = new SharedPtrList<LocChange>());
    const change = new LocChange(),
        waiting = new LocChange();
    waiting.remaining = waiting.delay = 9;
    Object.assign(change, {
        x: mode === 15 ? 0 : 2,
        z: 3,
        plane: 1,
        layer: 0,
        shape,
        oldShape: shape,
        angle: 2,
        oldAngle: mode === 22 ? 2 : 1,
        id: mode === 16 ? -1 : 1,
        oldId: mode === 16 ? -1 : mode === 22 ? 1 : 2,
        remaining: expiry === 1 ? 1 : 3,
        delay: 1
    });
    queue.push_back(change);
    queue.push_back(waiting);
    const name = (n: unknown) => (n === null ? '-' : n === queue.sentinel ? 'S' : n === change ? 'a' : n === waiting ? 'b' : '?');
    const flags = Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => new Uint8Array(8)));
    flags[1][2][3] = 2;
    ClientBuild.m_mapl = mode === 7 ? null : flags;
    Preferences.allLevelsVisible = mode !== 14;
    ClientBuild.buildLevel = 0;
    Preferences.showGroundDecorations = false;
    Reflect.set(CollisionMap, 'levelMaps', mode === 8 ? null : mode === 9 ? [null] : [null, mode === 11 ? null : new CollisionMap(8, 8)]);
    world.squares = mode === 10 ? null : Array.from({ length: 2 }, () => Array.from({ length: 8 }, () => new Array<Square | null>(8).fill(null)));
    const square = new Square(1, 2, 3);
    square.wall = new Wall();
    square.wall.typecode = 7n << 32n;
    if (world.squares !== null) world.squares[1][2][3] = square;
    LocType.m_recentUse.Reset();
    let calls: string[] = [],
        tick = 0;
    const stop = new Error('model or placement exception');
    const models: Js5 = Object.create(Js5.prototype);
    models.RequestDownload = (accelerated, group, file) => {
        calls.push(['model', accelerated, group, file].join(','));
        if (mode === 4 && group === 5) throw stop;
        if (mode === 17) Reflect.set(Client, 'locChanges', null);
        if (mode === 18) LocType.m_pModels = null;
        if (mode === 21) {
            change.x = 3;
            change.z = 4;
            change.angle = 2;
            change.oldAngle = 3;
        }
        return mode !== 2 && (mode !== 1 || tick > 1) && (mode !== 3 || group !== 5 || tick > 0);
    };
    ClientBuild.AddLoc = (water, plane, id, height, angle, shape, x, z, surface, collision) => {
        calls.push(['add', water, plane, id, height, angle, shape, x, z, surface, collision !== null, Preferences.showGroundDecorations].join(','));
        if (mode === 12) throw new TypeError('null in placement');
        if (mode === 13 && tick === 0) throw stop;
    };
    LocType.m_pModels = mode === 5 || mode === 19 || mode === 23 ? null : models;
    for (const id of [0, 1, 2, 7]) {
        const def = new LocType();
        def.id = id;
        def.blockwalk = mode === 11 ? 1 : 0;
        if (id === 1 || id === 2) {
            def.modelShapes = [3, 4, 18, 20].includes(mode) ? null : mode === 23 ? Int32Array.of(999) : Int32Array.of(4, 10, 22, 4);
            def.modelIds = mode === 6 || mode === 19 ? new Int32Array(0) : mode === 20 ? null : Int32Array.of(-1, 65541, 23, 88);
        }
        LocType.m_recentUse.Put(BigInt(id), def);
    }
    const result: string[] = [];
    for (tick = 0; tick < 3; tick++) {
        calls = [];
        let status = 'ok';
        try {
            Client.LocChangeDoQueue();
        } catch (error) {
            if (error === stop) status = 'stop';
            else if (error instanceof TypeError) status = 'null';
            else if (error instanceof RangeError) status = 'bounds';
            else throw error;
        }
        result.push(
            [
                status,
                calls.join(';'),
                [change.remaining, change.delay, waiting.remaining, waiting.delay].join(','),
                [queue.sentinel.next, queue.sentinel.prev, queue['cursor'], change.prev, change.next].map(name).join(''),
                [square.wall !== null, Preferences.showGroundDecorations].join(',')
            ].join('|')
        );
    }
    return result;
}

loginFixture(
    import.meta.url,
    'native pending location changes preserve real model selection, removed walls and retries through the original queue',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-native-loc-queue-'));
        const originalAddLoc = ClientBuild.AddLoc;
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compile = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'LocQueueNativeOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'LocQueueNativeOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const scenarios: Scenario[] = [];
            for (let mode = 0; mode < 24; mode++) {
                for (const expiry of [0, 1]) for (const shape of [-1, 4, 5, 6, 7, 8, 9, 10, 11, 22]) scenarios.push([mode, expiry, shape]);
            }
            const reference = Bun.spawnSync(java, { stdin: Buffer.from(scenarios.map(s => s.join(' ')).join('\n') + '\n') });
            expect(reference.exitCode, reference.stderr.toString()).toBe(0);
            const lines = reference.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines).toHaveLength(3 * scenarios.length);
            SceneCutover.native = true;
            LocChange.scene = null;
            for (const [i, scenario] of scenarios.entries()) expect(run(scenario), scenario.join(' ')).toEqual(lines.slice(i * 3, i * 3 + 3));
        } finally {
            ClientBuild.AddLoc = originalAddLoc;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
