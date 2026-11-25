import PlayerTask from '#/sound/PlayerTask.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import { test, expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import Signlink, { type SignlinkClass, type SignlinkEventQueue } from '#/util/Signlink.js';
import type SignlinkRequest from '#/util/SignlinkRequest.js';
import { requireNonNull } from '#/util/JavaArray.js';
import File from '#/io/File.js';
import type { SocketHandle } from '#/io/SocketPlatform.js';
import { gamepackPath } from './reference.js';

test('Signlink worker, suspended queue, priority errors, event-queue pump and shutdown match fb and dj', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sign530-')),
        saved = Object.getOwnPropertyDescriptors(Signlink);
    const file = fileURLToPath(new URL('./game/SignlinkOracle.java', import.meta.url));
    let sign: Signlink | null = null;
    const entered = Promise.withResolvers<void>(),
        release = Promise.withResolvers<void>();
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, file]);
        expect(build.stderr.toString()).toBe('');
        const jar = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'SignlinkOracle'], { timeout: 15000 });
        expect(jar.exitCode, jar.stderr.toString()).toBe(0);
        const expected = jar.stdout.toString().trimEnd().split(/\r?\n/),
            actual: string[] = [];
        const props = new Map([
            ['java.vendor', 'Test Vendor'],
            ['java.version', '1.8.53'],
            ['os.name', 'Windows'],
            ['os.arch', 'TeSt64'],
            ['os.version', 'TeStBuild'],
            ['user.home', 'directory']
        ]);
        const sock: SocketHandle = {
            input: {
                available: 0,
                async read() {
                    return -1;
                },
                async readBytes() {
                    return -1;
                },
                close() {}
            },
            output: { write() {}, flush() {}, close() {} },
            close() {}
        };
        const calls: string[] = [];
        const url = new URL('fixture://stream');
        sign = new Signlink(null, {
            property: key => props.get(key) ?? null,
            async openSocket(host, port) {
                calls.push(host + ':' + port);
                return sock;
            },
            async openUrl(input) {
                expect(input).toEqual(url);
                entered.resolve();
                await release.promise;
                const payload = [191, 2, -1];
                return {
                    async read() {
                        return requireNonNull(payload.shift());
                    },
                    async close() {}
                };
            }
        });
        Signlink.connectBlockedUntil = 0n;
        actual.push(
            [
                Signlink.javaVendor,
                Signlink.javaVersion,
                Signlink.osArch,
                Signlink.osVersion,
                Signlink.homeDir,
                Signlink.platform,
                sign.cacheData === null && sign.masterIndex === null && sign.cacheIndexes === null && sign.randomFile === null && sign.getAudioDevice() === null
            ].join('|')
        );
        const hold = sign.openUrl(url);
        await entered.promise;
        let ran = 0;
        const run = {
            run() {
                ran++;
            }
        };
        const socket = sign.openSocket('127.0.0.1', 530),
            valid = sign.startThread(run, 7),
            invalid = sign.startThread(run, 11);
        const klass: SignlinkClass = {
            getDeclaredMethod(name, args) {
                if (args?.length === 1 && args[0] === klass && name === 'plus') return name;
                throw new Error();
            },
            getDeclaredField(name) {
                if (name === 'probe') return name;
                throw new Error();
            }
        };
        const method = sign.getDeclaredMethod(klass, 'plus', [klass]),
            bad = sign.getDeclaredMethod(klass, 'plus', []),
            field = sign.getDeclaredField(klass, 'probe'),
            missing = sign.getDeclaredField(klass, 'absent');
        const component = { getLocationOnScreen: () => ({ x: 10, y: 20 }) };
        const work: SignlinkRequest[] = [
            hold,
            socket,
            valid,
            invalid,
            method,
            bad,
            field,
            missing,
            sign.openPreferences('prefs'),
            sign.reverseDns(0x7f000001),
            sign.openUrlExternally('page'),
            sign.showCursor(component, true),
            sign.moveMouse(-1, 4, component),
            sign.setCursor(4, 12, component, Int32Array.of(2), { x: 0, y: 0 })
        ];
        actual.push(work.map((r, i) => [r.status, r.type, i === 1 ? 'port' : r.intArg, r.next === (i >= 1 && i + 1 < work.length ? work[i + 1] : null)].join(':')).join(' '));
        release.resolve();
        while (work.some(r => r.status === 0)) await Bun.sleep(1);
        expect(ran).toBe(2);
        expect(socket.result).toBe(sock);
        expect(calls).toEqual(['127.0.0.1:530']);
        actual.push('[' + work.map(r => r.status).join(', ') + ']');
        const thread = requireNonNull(valid.result),
            stream = requireNonNull(hold.result);
        await thread.join();
        actual.push([await stream.read(), await stream.read(), await stream.read(), thread.priority, thread.daemon, method.result, field.result, invalid.result === null && bad.result === null].join(':'));
        await stream.close();
        sign.breakConnection();
        const a = sign.openSocket('127.0.0.1', 530),
            b = sign.openUrl(url);
        while (b.status === 0) await Bun.sleep(1);
        actual.push([a.status, b.status, Signlink.connectBlockedUntil > BigInt(Date.now())].join(':'));
        expect(calls.length).toBe(1);
        let peeks = 0,
            remaining = 3,
            posted = '-';
        const q: SignlinkEventQueue = {
            peekEvent() {
                peeks++;
                return remaining-- > 0 ? {} : null;
            },
            postEvent(e) {
                posted = [e.id, e.command, e.source === q].join(':');
            }
        };
        sign.eventQueue = q;
        await Signlink.flushEvents(q, sign);
        actual.push(peeks + ':' + posted);
        remaining = 59;
        peeks = 0;
        posted = '-';
        await Signlink.flushEvents(null, sign);
        actual.push(peeks + ':' + posted);
        const events: string[] = [];
        const pump = new PlayerTask();
        pump.signlink = sign;
        class AudioPlayer extends PCMPlayer {
            constructor(private readonly id: string) {
                super();
                this.samples = new Int32Array(256);
                this.capacity = 256;
            }
            protected override AlreadyWritten() {
                events.push(this.id);
                return 0;
            }
        }
        pump.players[0] = new AudioPlayer('music');
        pump.players[1] = new AudioPlayer('fx');
        let polls = 0;
        sign.eventQueue = {
            peekEvent() {
                events.push('poll:' + pump.running);
                if (++polls === 3) pump.stop();
                return null;
            },
            postEvent() {}
        };
        const audio = sign.startThread(pump, 2);
        while (audio.status === 0) await Bun.sleep(1);
        await requireNonNull(audio.result).join();
        actual.push(events.join(',') + ':' + pump.running);
        const closed: string[] = [];
        function opened(tag: string) {
            return File.open(
                {
                    seek() {},
                    read() {
                        return -1;
                    },
                    write() {},
                    length: () => 0n,
                    close() {
                        closed.push(tag);
                    }
                },
                tag,
                200n
            );
        }
        sign.cacheData = opened('data');
        sign.masterIndex = opened('master');
        sign.cacheIndexes = [opened('index0'), null, opened('index2')];
        sign.randomFile = opened('random');
        await sign.stopWorker();
        actual.push(closed.join(',') + ':' + sign.reverseDns(7).status);
        expect(actual).toEqual(expected);
    } finally {
        release.resolve();
        await sign?.stopWorker();
        Object.defineProperties(Signlink, saved);
        rmSync(dir, { force: true, recursive: true });
    }
});
