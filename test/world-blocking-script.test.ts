import { program, DelayedSocket } from './world-list-script.js';
import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';
import { localAssets, readGroup } from './cachefile.js';
import { closeGameStream, installRawHost, installSocketHost, openWorldSocket, settleSignlink, socketHandle } from './socket-host.js';
import GameShell from '#/client/GameShell.js';
import Client from '#/client/Client.js';
import GameWorld from '#/io/GameWorld.js';
import SafeTime from '#/io/SafeTime.js';
import WorldList from '#/io/WorldList.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import AudioEngine from '#/sound/AudioEngine.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import JagString from '#/datastruct/JagString.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import { requireNonNull } from '#/util/JavaArray.js';

const root = 190000,
    child = root + 1;
function enqueue(queue: typeof Client.timerEvents, id: number): void {
    const event = new HookReq();
    event.component = new IfType();
    event.component.childId = -1;
    event.args = [id];
    requireNonNull(queue).push_back(event);
}
function bytes(text: JagString | null): string {
    return text === null ? '~' : Buffer.from(text.toBytes()).toString('hex');
}
function state(fetches: number, marks: number): string {
    return [
        '[' + [...DelayedStateChange.varcs.slice(0, 4)].join(', ') + ']',
        bytes(DelayedStateChange.varcStrings[0]),
        bytes(DelayedStateChange.varcStrings[1]),
        ScriptRunner.frameCount,
        requireNonNull(ScriptRunner.intLocals)[0],
        bytes(requireNonNull(ScriptRunner.stringLocals)[0]),
        fetches,
        marks,
        WorldList.fetchStep,
        WorldList.fetchAttempts
    ].join('/');
}

loginFixture(
    import.meta.url,
    'gh suspends inside a gosub at 6500 and resumes the same title hook and queue after the socket read',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-blocking-world-'));
        let expected: string[];
        try {
            const source = (file: string) => fileURLToPath(new URL('./game/' + file, import.meta.url));
            for (const [archive, groups] of [
                [3, [744]],
                [12, [1299, 1328, 1879, 1851, 1852, 1856, 734, 1853, 1854, 1882, 1881, 31, 72, 37, 705]]
            ] as const) {
                const folder = join(dir, String(archive));
                mkdirSync(folder);
                writeFileSync(join(folder, 'index'), readGroup(cachePath, 255, archive));
                for (const group of groups) writeFileSync(join(folder, 'g' + group), readGroup(cachePath, archive, group));
            }
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, source('WorldListOracle.java'), source('../ui/FloorConfigOracle.java'), source('WorldListBlockingOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WorldListBlockingOracle', dir], { timeout: 15000 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            expected = java.stdout.toString().trim().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const append = (digit: number) => `42:0 0:10 4002 0:${digit} 4000 43:0`;
        const assets = localAssets(cachePath, [3, 12]);
        program(root, 1, 1, 0, 0, `0:256 34:0 3:outer 36:0 0:1 43:0 0:303 3:inner 40:${child} 33:0 43:3 35:0 48:0 ${append(2)} 21`);
        program(child, 1, 1, 1, 1, '0:17 6500 43:1 33:0 4000 43:2 35:0 48:1 21');
        for (let digit = 3; digit <= 5; digit++) program(root + digit, 1, 1, 0, 0, append(digit) + ' 21');
        const reports: Error[] = [];
        const ui = new InterfaceSession(new InterfaceView([]), assets, e => reports.push(e));
        const client = new Client();
        client['ui'] = ui;
        InterfaceList.top = -1;
        Client.gameState = 10;
        let fetches = 0,
            marks = 0;
        const fetch = GameWorld.ListFetch.bind(GameWorld);
        GameWorld.ListFetch = () => {
            fetches++;
            return fetch();
        };
        class Counted extends PCMPlayer {
            override DoneUpdate(): void {
                marks++;
                super.DoneUpdate();
            }
        }
        AudioEngine.musicPlayer = new Counted();
        AudioEngine.effectsPlayer = new Counted();
        const actual: string[] = [];
        for (const mode of ['success', 'partial', 'rejected', 'failed', 'closed', 'writer', 'replaceStack']) {
            DelayedStateChange.varcs.fill(0);
            DelayedStateChange.varcStrings.fill(null);
            fetches = marks = 0;
            WorldList.fetchStep = 1;
            WorldList.fetchAttempts = mode === 'rejected' ? 4 : 0;
            GameWorld.fetchStartTime = SafeTime.CurrentTimeMillis();
            WorldList.lastFetchTime = 0n;
            GameWorld.worldListBuffer = null;
            GameWorld.m_num = 0;
            const socket = new DelayedSocket(Uint8Array.from(mode === 'success' || mode === 'writer' ? [0, 0, 2, 1, 0] : [mode === 'rejected' ? 17 : 0]), mode === 'failed');
            const outputRelease = Promise.withResolvers<void>();
            installRawHost(async host => {
                if (host === 'writer-gate') await outputRelease.promise;
                return socketHandle(socket);
            });
            openWorldSocket();
            await settleSignlink();
            if (mode === 'writer') requireNonNull(GameShell.signlink).openSocket('writer-gate', 0);
            enqueue(Client.timerEvents, root);
            enqueue(Client.mouseExit, root + 4);
            enqueue(Client.m_hookQueue, root + 5);
            const pending = client['titleLoop']();
            expect(pending).toBeInstanceOf(Promise);
            await socket.entered.promise;
            actual.push(mode + ' before ' + state(fetches, marks) + '/' + requireNonNull(ScriptRunner.frames[0]).pc);
            enqueue(Client.timerEvents, root + 3);
            const original = ScriptRunner.intStack;
            if (mode === 'replaceStack') Reflect.set(ScriptRunner, 'intStack', new Int32Array(1000).fill(7119));
            if (mode === 'writer') {
                const stream = requireNonNull(Client.stream),
                    closing = Promise.withResolvers<void>();
                const close = stream.Close.bind(stream);
                stream.Close = () => {
                    closing.resolve();
                    return close();
                };
                socket.release.resolve();
                await closing.promise;
                actual.push(mode + ' joining ' + state(fetches, marks) + '/' + socket.sent.length);
                outputRelease.resolve();
            } else if (mode === 'closed') await requireNonNull(Client.stream).Close();
            else socket.release.resolve();
            await pending;
            await closeGameStream();
            actual.push(mode + ' after ' + state(fetches, marks) + '/' + Buffer.from(socket.sent).toString('hex'));
            if (mode === 'replaceStack') {
                actual.push('previous slot ' + original[1]);
                Reflect.set(ScriptRunner, 'intStack', original);
            }
        }
        for (const success of [false, true]) {
            IfType.Init(assets.archive(13), assets.archive(8), assets.archive(7), assets.archive(3));
            const load = new HookReq();
            load.args = [1299];
            await ui.runner.run(load);
            const widget = requireNonNull(IfType.Get(48759008)),
                timer = new HookReq();
            timer.component = widget;
            timer.args = widget.onTimer;
            requireNonNull(Client.timerEvents).push_back(timer);
            WorldList.fetchStep = 1;
            GameWorld.fetchStartTime = SafeTime.CurrentTimeMillis();
            fetches = 0;
            WorldList.fetchAttempts = 0;
            GameWorld.m_num = 0;
            const socket = new DelayedSocket(Uint8Array.from(success ? [0, 0, 2, 1, 0] : [0]));
            installSocketHost(async () => socket);
            openWorldSocket();
            await settleSignlink();
            const pending = client['titleLoop']();
            await socket.entered.promise;
            actual.push('stock ' + success + ' before ' + requireNonNull(widget.onTimer)[0] + '/' + fetches);
            socket.release.resolve();
            await pending;
            await closeGameStream();
            actual.push('stock ' + success + ' after ' + (widget.onTimer?.[0] ?? '~') + '/' + fetches + '/' + Buffer.from(socket.sent).toString('hex'));
        }
        expect(reports).toEqual([]);
        expect(actual).toEqual(expected);
    },
    25000
);
