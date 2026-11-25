import { afterEach, beforeEach, expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import MouseTracking from '#/client/MouseTracking.js';
import MouseWheel from '#/client/MouseWheel.js';
import JavaMouseWheel from '#/client/JavaMouseWheel.js';
import Keyboard from '#/client/ClientKeyboardListener.js';
import Mouse from '#/client/ClientMouseListener.js';
import AudioEngine from '#/sound/AudioEngine.js';
import DataFile from '#/cache/DataFile.js';
import type { KeyboardSurface } from '#/client/ClientKeyboardListener.js';
import type { MouseSurface } from '#/client/ClientMouseListener.js';
import Login from '#/io/Login.js';
import WorldList from '#/io/WorldList.js';
import AccountCreation from '#/io/AccountCreation.js';
import GameWorld from '#/io/GameWorld.js';
import SafeTime from '#/io/SafeTime.js';
import Signlink from '#/util/Signlink.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { attachMainInitHost } from './main-init-fixture.js';
import Protocol from '#/io/Protocol.js';
import { SocketIoError, type Js5Stream } from '#/io/SocketPlatform.js';
import { FileIoError } from '#/io/File.js';
import { JavaError } from '#/util/ClientError.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

const fields = [
    [Client, 'mouseTracking', 'ej.p'],
    [Client, 'stream', 'ek.s'],
    [GameShell, 'canvas', 'pe.S'],
    [MouseWheel, 'instance', 'lj.k'],
    [AudioEngine, 'musicPlayer', 'm.S'],
    [AudioEngine, 'effectsPlayer', 'ld.k'],
    [Client, 'js5NetQueue', 'wk.d'],
    [Client, 'js5DiskQueue', 'ud.a'],
    [Client, 'cacheData', 'ik.O'],
    [Client, 'cacheIndexFiles', 'f.g'],
    [DataFile, 'masterIndexFile', 'q.c'],
    [Client, 'uidFile', 'ei.q']
] as const;

// The field-read probes replace property descriptors. Restore the ordinary native fields
// even when running all four child fixtures in one process during diagnosis.
let restoreFields: (() => void)[] = [];
beforeEach(() => {
    const touched: [object, string][] = [
        ...fields.map(([owner, name]): [object, string] => [owner, name]),
        [Keyboard, 'instance'],
        [Keyboard, 'changeWriter'],
        [Mouse, 'instance'],
        [Mouse, 'currentButton'],
        [Client, 'activeClient'],
        [Client, 'loginStep'],
        [Login, 'worldLookupStep'],
        [AccountCreation, 'step'],
        [WorldList, 'fetchStep'],
        [Protocol, 'oldSocket'],
        [GameShell, 'drawArea'],
        [GameShell, 'signlink']
    ];
    restoreFields = touched.map(([owner, name]) => {
        const descriptor = requireNonNull(Object.getOwnPropertyDescriptor(owner, name));
        return () => Object.defineProperty(owner, name, descriptor);
    });
});
afterEach(() => {
    for (const restore of restoreFields) restore();
});

type Vector = [mask: number, at: number, action: number, key: string];
function vectors(): Vector[] {
    const rows: Vector[] = [
        [0, 0, 0, '-'],
        [4095, 0, 0, '-']
    ];
    for (let field = 0; field < fields.length; field++) rows.push([1 << field, 0, 0, '-']);
    for (let at = 1; at <= 60; at++) {
        for (const action of [1, 4, 5, 6, 7, 8]) rows.push([0, at, action, '-']);
        for (const [, , key] of fields) for (const action of [2, 3]) rows.push([0, at, action, key]);
    }
    for (const key of ['keyboard', 'mouse']) for (const mask of [0, 4]) for (let at = 0; at <= 4; at++) for (const action of [1, 5, 6, 7, 8]) rows.push([mask, at, action, key]);
    return rows;
}

function normalized(error: unknown): string {
    if (error instanceof WrappedException) return error.context + '/' + normalized(error.cause);
    if (error instanceof JavaError) return 'error';
    if (error instanceof FileIoError || error instanceof SocketIoError) return 'io';
    if (error instanceof TypeError) return 'null';
    if (error instanceof RangeError) return 'bounds';
    return 'fault';
}

loginFixture(
    import.meta.url,
    'MainQuit closes and detaches native resources in JAR order with live array reads and Java failure prefixes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-mainquit-'));
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        try {
            const cc = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'MainQuitOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'MainQuitOracle'];
            // Execute the real stream, input, PCM, network queue and joined disk-worker closes
            // before adding field and call observation. Native file handles are absent on these rows.
            const untouched: Vector[] = [];
            for (const missing of [0, 1, 2, 4, 8, 16, 32, 64, 128, 255]) {
                for (const at of [0, 1, 2, 3, 4, 5, 6]) untouched.push([3840 | missing, at, 1, 'full']);
            }
            const reference = (rows: Vector[]) => {
                const ref = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'), maxBuffer: 16777216 });
                expect(ref.exitCode, ref.stderr.toString()).toBe(0);
                const lines = ref.stdout.toString().trimEnd().split(/\r?\n/);
                expect(lines.length).toBe(rows.length);
                return lines;
            };
            const unmodified = reference(untouched);
            const prep = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prep.exitCode, prep.stderr.toString()).toBe(0);
            const observedRows = vectors(),
                rows = [...untouched, ...observedRows];
            const expected = [...unmodified, ...reference(observedRows)];
            const client = new Client(),
                ids = new Map<unknown, string>(),
                data = new Map<string, unknown>();
            let observed = false,
                steps = 0,
                at = 0,
                action = 0,
                target = '',
                trace = '';
            let injected: WrappedException;
            const tag = <T>(v: T, id: string): T => {
                ids.set(v, id);
                return v;
            };
            const empty = tag([], 'empty');
            function event(name: string) {
                if (!observed || (target === 'full' && !name.startsWith('pe.S'))) return;
                trace += name + ';';
                if (++steps !== at) return;
                if (action === 1) throw new Error('event');
                if (action === 2) data.set(target, null);
                if (action === 3) data.set(target, alternate.get(target));
                if (action === 4) data.set('f.g', empty);
                if (action === 5) throw new FileIoError('file');
                if (action === 6) throw new JavaError('event');
                if (action === 7) throw injected;
                if (action === 8) throw new SocketIoError('io');
            }
            const original = new Map<string, unknown>(),
                alternate = new Map<string, unknown>();
            const trackers: MouseTracking[] = [];
            for (const [owner, prop, key] of fields) {
                Object.defineProperty(owner, prop, {
                    configurable: true,
                    get() {
                        event('r' + key);
                        return data.get(key);
                    },
                    set(value) {
                        data.set(key, value);
                        event('w' + key);
                    }
                });
                for (const variant of [0, 1]) {
                    const id = key + variant;
                    let value: unknown;
                    const file = (label: string) =>
                        tag(
                            {
                                Close() {
                                    event('file:' + label);
                                }
                            },
                            label
                        );
                    switch (key) {
                        case 'ej.p':
                            value = trackers[variant] = new MouseTracking();
                            break;
                        case 'ek.s':
                            value = {
                                Close() {
                                    event('stream:' + id);
                                }
                            };
                            break;
                        case 'pe.S':
                            value = {
                                removeKeyListener() {
                                    event(id + ':key');
                                },
                                removeMouseListener() {
                                    event(id + ':mouse');
                                },
                                removeMouseMotionListener() {
                                    event(id + ':motion');
                                },
                                removeFocusListener(listener: unknown) {
                                    event(id + ':focus' + (listener instanceof Keyboard ? 'K' : 'M'));
                                },
                                removeMouseWheelListener(listener: unknown) {
                                    event(id + ':wheel:' + ids.get(listener));
                                }
                            };
                            break;
                        case 'lj.k':
                            value = new JavaMouseWheel();
                            break;
                        case 'm.S':
                        case 'ld.k':
                            value = {
                                QueueQuit() {
                                    event('pcm:' + id);
                                }
                            };
                            break;
                        case 'wk.d':
                            value = {
                                close() {
                                    event('net:' + id);
                                }
                            };
                            break;
                        case 'ud.a':
                            value = {
                                async EndAndJoin() {
                                    event('disk:' + id);
                                }
                            };
                            break;
                        case 'f.g': {
                            const a = file('F' + variant + 'a'),
                                b = file('F' + variant + 'b');
                            value = variant === 0 ? [a, null, b] : [null, b];
                            break;
                        }
                        default:
                            value = file(id);
                    }
                    (variant === 0 ? original : alternate).set(key, tag(value, id));
                }
            }
            for (const [index, row] of rows.entries()) {
                const mask = row[0];
                [, at, action, target] = row;
                for (const [i, [, , k]] of fields.entries()) data.set(k, mask & (1 << i) ? null : original.get(k));
                for (const t of trackers) t.running = true;
                Keyboard.instance = new Keyboard();
                Mouse.instance = new Mouse();
                Keyboard.changeWriter = 77;
                Mouse.currentButton = 71;
                trace = '';
                steps = 0;
                observed = true;
                let result = 'ok';
                injected = WrappedException.wrap(new Error('event'), 'origin');
                try {
                    if (target === 'keyboard') Keyboard.stop(63, data.get('pe.S') as KeyboardSurface);
                    else if (target === 'mouse') Mouse.stop(data.get('pe.S') as MouseSurface, -7);
                    else await client['MainQuit']();
                } catch (error) {
                    result = normalized(error) + (action === 7 && at <= steps && at !== 0 ? '/' + (error === injected) : '');
                }
                observed = false;
                const identities = fields.map(([, , key]) => ids.get(data.get(key)) ?? '-');
                expect([result, trace, identities.join(','), [trackers[0].running, trackers[1].running, Keyboard.instance !== null, Mouse.instance !== null, Keyboard.changeWriter, Mouse.currentButton].join(',')].join('|'), row.join(' ')).toBe(
                    expected[index]
                );
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    25000
);
loginFixture(import.meta.url, 'browser shutdown waits for the game writer, JS5 writer and disk worker before closing files and retains protocol state', async () => {
    for (const alias of [false, true]) {
        const events: string[] = [];
        const gate = Array.from({ length: 3 }, () => Promise.withResolvers<void>());
        const started = Array.from({ length: 3 }, () => Promise.withResolvers<void>());
        const wait = (n: number) => {
            events.push(['game', 'net', 'disk'][n]);
            started[n].resolve();
            return gate[n].promise;
        };
        const client = new Client();
        client['closed'] = true;
        let activeCloses = 0,
            oldCloses = 0;
        const live = {
            Close() {
                activeCloses++;
                return wait(0);
            }
        } as Js5Stream;
        let old;
        if (alias) {
            old = live;
        } else {
            old = {
                Close() {
                    oldCloses++;
                }
            } as Js5Stream;
        }
        Client.stream = live;
        Protocol.oldSocket = old;
        GameShell.canvas = {
            removeKeyListener() {
                events.push('key');
            },
            removeFocusListener() {},
            removeMouseListener() {
                events.push('mouse');
            },
            removeMouseMotionListener() {}
        };
        Reflect.set(Client, 'js5NetQueue', {
            close() {
                return wait(1);
            }
        });
        Reflect.set(Client, 'js5DiskQueue', {
            EndAndJoin() {
                return wait(2);
            }
        });
        Reflect.set(Client, 'uidFile', {
            Close() {
                events.push('uid');
            }
        });
        Reflect.set(client, 'disk', {
            close() {
                events.push('indexedDB');
            }
        });
        Client.loginStep = 7;
        Login.worldLookupStep = 4;
        AccountCreation.step = 3;
        WorldList.fetchStep = 2;
        const done = client['MainQuit']();
        await started[0].promise;
        expect(Client.stream).toBe(live);
        expect(events).toEqual(['game']);
        gate[0].resolve();
        await started[1].promise;
        expect(Client.stream).toBeNull();
        expect(events).toEqual(['game', 'key', 'mouse', 'net']);
        gate[1].resolve();
        await started[2].promise;
        expect(events).toEqual(['game', 'key', 'mouse', 'net', 'disk']);
        gate[2].resolve();
        await done;
        expect(events).toEqual(['game', 'key', 'mouse', 'net', 'disk', 'uid', 'indexedDB']);
        expect([activeCloses, oldCloses, Protocol.oldSocket === old]).toEqual([1, alias ? 0 : 1, true]);
        expect([Client.loginStep, Login.worldLookupStep, AccountCreation.step, WorldList.fetchStep]).toEqual([7, 4, 3, 2]);
    }
});

loginFixture(import.meta.url, 'browser shutdown releases the pending shared read without advancing login, account or world-list state', async () => {
    for (const kind of ['login', 'auto-world', 'account', 'world-list']) {
        const client = new Client(),
            read = Promise.withResolvers<number>(),
            waiting = Promise.withResolvers<void>();
        let reads = 0,
            closes = 0;
        const blocked = () => {
            reads++;
            waiting.resolve();
            return read.promise;
        };
        Client.stream = {
            GetAvailable() {
                return 8;
            },
            Write() {},
            read: blocked,
            Read: blocked,
            Close() {
                closes++;
                read.resolve(221);
            }
        };
        Client.loginStep = 3;
        Login.worldLookupStep = 3;
        AccountCreation.step = 3;
        WorldList.fetchStep = 2;
        GameWorld.fetchStartTime = SafeTime.CurrentTimeMillis();
        GameShell.canvas = { removeKeyListener() {}, removeMouseListener() {}, removeMouseMotionListener() {}, removeFocusListener() {} };
        Reflect.set(Client, 'js5NetQueue', { close() {} });
        Reflect.set(Client, 'js5DiskQueue', { async EndAndJoin() {} });
        const task = kind === 'login' ? client.LoginPoll() : kind === 'auto-world' ? client['login'].selectLoginWorld() : kind === 'account' ? AccountCreation.loop() : GameWorld.ListFetch();
        await waiting.promise;
        client['closed'] = true;
        await client['MainQuit']();
        await task;
        expect(Client.stream).toBeNull();
        expect([reads, closes, Client.loginStep, Login.worldLookupStep, AccountCreation.step, WorldList.fetchStep]).toEqual([1, 1, 3, 3, 3, 2]);
    }
});

loginFixture(import.meta.url, 'an IndexedDB open completing inside or after browser shutdown closes its new handle once', async () => {
    for (const during of [true, false]) {
        const app = new Client(),
            pending = Promise.withResolvers<void>(),
            stream = Promise.withResolvers<void>();
        attachMainInitHost(app);
        GameShell.canvas = requireNonNull(app['host']).canvas;
        GameShell.signlink = new Signlink({
            getSize() {
                return { width: 765, height: 503 };
            }
        });
        const platform = GameShell.signlink;
        let closes = 0;
        const request = {
            result: {
                close() {
                    closes++;
                }
            },
            onsuccess: () => {}
        };
        Object.defineProperty(globalThis, 'indexedDB', {
            configurable: true,
            value: {
                open() {
                    pending.resolve();
                    return request;
                }
            }
        });
        try {
            const init = app['MainInit']();
            await pending.promise;
            expect(app['disk']).toBeUndefined();
            Client.stream = {
                Close() {
                    return stream.promise;
                }
            } as Js5Stream;
            app['closed'] = true;
            const quit = app['MainQuit']().catch((err: unknown) => err);
            if (during) {
                request.onsuccess();
                await init;
            }
            stream.resolve();
            const err = await quit;
            expect(err).toBeInstanceOf(WrappedException); // the unallocated wk.d at pc 126
            if (!during) {
                request.onsuccess();
                await init;
            }
            expect([closes, app['disk'], Client.js5NetQueue, Client.js5DiskQueue]).toEqual([1, undefined, null, null]);
        } finally {
            await platform.stopWorker();
            Reflect.deleteProperty(globalThis, 'indexedDB');
        }
    }
});
