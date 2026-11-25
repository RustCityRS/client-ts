import { expect, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import WrappedException from '#/util/WrappedException.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import ClientStream from '#/io/ClientStream.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import SafeTime from '#/io/SafeTime.js';
import { SocketIoError, type SocketHandle } from '#/io/SocketPlatform.js';
import { requireNonNull } from '#/util/JavaArray.js';
import Signlink, { type SignlinkThread } from '#/util/Signlink.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [entry: number, stage: number, state: number, errors: number, response: number, taskStatus: number, queueRead: number, callback: number, action: number, available: number, reply: number];
function cases(): Row[] {
    const rows: Row[] = [];
    // Change or clear the queue on a specific JVM field read, including the
    // second wk.d read in client.a after the old queue's error count changes.
    for (const [errors, response, state] of [
        [0, 0, 5],
        [2, 6, 30],
        [4, -1, 30],
        [4, 9, 5],
        [4, 0, 0],
        [4, 10, 0],
        [2147483647, 0, 30]
    ]) {
        for (const entry of [0, 1, 2]) for (const action of [1, 2]) for (let read = 1; read <= 12; read++) rows.push([entry, -1, state, errors, response, 0, read, 0, action, 0, 0]);
    }
    for (const stage of [2, 3, 4])
        for (const state of [0, 5, 10, 28, 30]) {
            for (const available of [0, 1])
                for (const reply of [0, 13]) {
                    rows.push([0, stage, state, 0, 5, 1, 0, 0, 0, available, reply]);
                    for (const callback of [1, 2]) for (let action = 1; action <= 9; action++) rows.push([0, stage, state, 0, 5, 1, 0, callback, action, available, reply]);
                }
            rows.push([0, stage, state, 0, 5, 1, 0, 0, 11, 1, 0]);
        }
    rows.push([0, 3, 30, 0, 0, 0, 0, 0, 10, 0, 0], [3, 3, 30, 0, 0, 1, 0, 1, 9, 0, 0], [3, 3, 0, 0, 0, 1, 0, 1, 9, 0, 0]);
    return rows;
}

loginFixture(
    import.meta.url,
    'JS5 connection rereads the queue, clock and socket at the gamepack instruction boundaries',
    async () => {
        const rows = cases(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-js5connect-'));
        let expected: string[];
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cp = dir + delimiter + gamepackPath,
                source = join(import.meta.dir, 'js5net');
            const compile = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', dir, join(source, 'Js5ConnectionOracle.java'), join(source, 'Js5ConnectionReadOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const emit = Bun.spawnSync(['java', ...exports, '-cp', cp, 'Js5ConnectionReadOracle', dir]);
            expect(emit.exitCode, emit.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', cp, 'Js5ConnectionReadOracle'], { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'), timeout: 16000, maxBuffer: 8 * 1024 * 1024 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        expect(expected.length).toBe(rows.length);
        const app = new Client(),
            link: Signlink = Object.create(Signlink.prototype);
        app['errorShown'] = true;
        link.startThread = () => {
            const r = new SignlinkRequest<SignlinkThread>();
            r.status = 2;
            return r;
        };
        GameShell.signlink = link;
        const originalQueue = requireNonNull(Object.getOwnPropertyDescriptor(Client, 'js5NetQueue'));
        const now = spyOn(SafeTime, 'CurrentTimeMillis');
        try {
            for (const [index, row] of rows.entries()) {
                const [entry, stage, state, errors, response, status, readAt, callbackAt, action, available, reply] = row;
                const first = new Js5NetQueue(),
                    second = new Js5NetQueue();
                let live: Js5NetQueue | null = first,
                    reads = 0,
                    events = 0,
                    log = '';
                Object.defineProperty(Client, 'js5NetQueue', {
                    configurable: true,
                    get() {
                        if (++reads === readAt) live = action === 2 ? null : second;
                        return live;
                    }
                });
                const event = (name: string) => {
                    log += name;
                    if (++events !== callbackAt) return;
                    if (action === 1 || action === 7) live = second;
                    if (action === 2) live = null;
                    if (action === 3 || action === 7) Client.js5ConnectStream = b;
                    if (action === 4) Client.js5ConnectStream = null;
                    if (action === 5) Client.js5ConnectStage = 7;
                    if (action === 6) Client.gameState = 28;
                    if (action === 8) throw new SocketIoError();
                    if (action === 9) {
                        live = second;
                        throw new SocketIoError();
                    }
                };
                const peer = (id: string): SocketHandle => ({
                    input: {
                        get available() {
                            event(id + 'A');
                            return available;
                        },
                        async read() {
                            event(id + 'R');
                            return id === 'b' ? 19 : reply;
                        },
                        async readBytes() {
                            throw Error('unexpected bulk read');
                        },
                        close() {}
                    },
                    output: { write() {}, flush() {}, close() {} },
                    close() {}
                });
                const a = new ClientStream(peer('a'), link),
                    b = new ClientStream(peer('b'), link);
                Client.js5ConnectStream = action === 11 ? null : a;
                const request = (Client.js5SocketRequest = new SignlinkRequest<SocketHandle>());
                request.result = peer('c');
                request.status = status;
                first.errors = errors;
                first.response = response;
                second.errors = 3;
                second.response = 6;
                Client.gameState = state;
                Client.js5ConnectStage = stage;
                Client.js5ConnectTime = 1733n;
                Client.js5RetryDelay = Client.js5LastErrorCount = 0;
                Client.currentPort = Client.primaryPort = 40231;
                Client.secondaryPort = 50231;
                now.mockImplementation(() => {
                    if (action === 10) Client.js5ConnectTime = 55000n;
                    return 55000n;
                });
                if (entry === 2 || entry === 3) first.RequestData(0, 1, 2, true);
                if (entry === 3) first['stream'] = a;
                let fault = 'ok';
                try {
                    if (entry === 0) await app['js5Connect']();
                    else if (entry === 1) app['js5Error'](-102, 117);
                    else await app['js5Tick']();
                } catch (caught) {
                    let e = caught;
                    while (e instanceof WrappedException) e = e.cause;
                    fault = e instanceof TypeError ? 'null' : String(e);
                }
                const id = (stream: unknown) => (stream === null ? '-' : stream === a ? 'a' : stream === b ? 'b' : 'c');
                const queue = (q: Js5NetQueue) => [q.errors, q.response, id(q['stream'])].join(',');
                const wire = (s: ClientStream) => (s['buffer'] === null ? '-' : Buffer.from(s['buffer'].subarray(0, s['tail'])).toString('hex'));
                const actual = [
                    fault,
                    Client.gameState,
                    Client.js5ConnectStage,
                    Client.js5LastErrorCount,
                    Client.js5RetryDelay,
                    Client.currentPort,
                    Client.js5ConnectTime,
                    reads,
                    log,
                    live === null ? '-' : live === first ? 'a' : 'b',
                    id(Client.js5ConnectStream),
                    Client.js5SocketRequest !== null,
                    queue(first),
                    queue(second),
                    wire(a),
                    wire(b)
                ];
                expect(actual.join(';'), row.join(' ')).toBe(expected[index]);
            }
        } finally {
            Object.defineProperty(Client, 'js5NetQueue', originalQueue);
            now.mockRestore();
        }
    },
    30000
);
