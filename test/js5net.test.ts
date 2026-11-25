import { loginFixture } from './login-fixture.js';
import Js5LocalCache from '#/cache/Js5LocalCache.js';
import { createJs5Client } from './js5net/client.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import ClientStream from '#/io/ClientStream.js';
import { openBrowserSocketHandle } from '#/io/BrowserSocket';
import Signlink from '#/util/Signlink';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import { installRawHost, installSocketHost, settleSignlink } from './socket-host.js';
import { gamepackPath } from './reference.js';
import { requireNonNull } from '../src/util/JavaArray.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import Js5NetQueue from '../src/io/Js5NetQueue.js';
import { SocketIoError, type Js5Stream } from '../src/io/SocketPlatform.js';
import { mathRandom } from '../src/util/JavaRandom.js';
import type Js5NetQueueRequest from '../src/io/Js5NetQueueRequest.js';
import type SecondaryLinkedList from '../src/datastruct/SecondaryLinkedList.js';

class Stream implements Js5Stream {
    writes: number[] = [];
    input: number[] = [];
    closed = false;

    GetAvailable(): number {
        return this.input.length;
    }
    Write(offset: number, src: Uint8Array, length: number): void {
        this.writes.push(...src.subarray(offset, offset + length));
    }
    async read(): Promise<number> {
        return requireNonNull(this.input.shift());
    }
    async Read(dst: Uint8Array, offset: number, length: number): Promise<void> {
        dst.set(this.input.splice(0, length), offset);
    }
    Close(): void {
        this.closed = true;
    }
}

function response(archive: number, group: number, type: number, data: number[]): number[] {
    const length = (type & 127) === 0 ? data.length : data.length - 4;
    const bytes = [archive, group >>> 8, group & 255, type, 0, 0, length >>> 8, length & 255];
    for (const byte of data) {
        if ((bytes.length & 511) === 0) {
            bytes.push(255);
        }
        bytes.push(byte);
    }
    return bytes;
}

async function start(client: Client, stream: Stream): Promise<void> {
    stream.input.push(0);
    for (let i = 0; i < 3; i++) {
        await client['js5Tick']();
        await settleSignlink();
    }
}

// Preempt a large prefetch after the first block. Its replacement starts from byte zero.
const body = Array.from({ length: 1050 }, (_, i) => i & 255);
const prefetchResponse = response(7, 258, 128, body);
const urgentResponse = response(3, 65502, 2, [0, 0, 0, 1, 154, 180, 82]);
const wire = [...prefetchResponse.slice(0, 512), ...urgentResponse, ...prefetchResponse];

async function runTrace() {
    const stream = new Stream();
    installSocketHost(async () => stream);
    const { client, queue: net } = createJs5Client(5);
    const prefetch = net.RequestData(2, 258, 7, false);
    const urgent = net.RequestData(0, 65502, 3, true);
    await start(client, stream);
    const progress = [];
    for (let i = 0; i < wire.length; i++) {
        stream.input.push(wire[i]);
        await client['js5Tick']();
        progress.push(prefetch.getPercentage(), urgent.getPercentage());
    }
    net.close();
    return { writes: stream.writes, prefetch: prefetch.getData(), urgent: urgent.getData(), progress };
}

test('530 JS5 interleaves queues and accepts fragmented headers and continuation bytes', async () => {
    const trace = await runTrace();
    expect(trace.writes).toEqual([15, 0, 0, 2, 18, 6, 0, 0, 3, 3, 0, 0, 0, 1, 3, 255, 222, 0, 7, 1, 2]);
    expect([...trace.prefetch]).toEqual([0, 0, 0, 4, 26, ...body, 0, 0]);
    expect([...trace.urgent]).toEqual([2, 0, 0, 0, 3, 0, 0, 0, 1, 154, 180, 82]);
});

test('buffered WebSocket input preserves a partial JS5 header and reads across frames without waiting', async () => {
    const packet = Uint8Array.from(response(7, 258, 128, body));
    const more = Promise.withResolvers<void>();
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(req, srv) {
            if (!srv.upgrade(req, { headers: { 'Sec-WebSocket-Protocol': 'binary' } })) return new Response(null, { status: 400 });
        },
        websocket: {
            open(ws) {
                ws.sendBinary(Uint8Array.of(0xaa, ...packet.subarray(0, 5)));
                void more.promise.then(() => {
                    ws.sendBinary(packet.subarray(5, 9));
                    ws.sendBinary(packet.subarray(9, 513));
                    ws.sendBinary(packet.subarray(513));
                });
            },
            message() {}
        }
    });
    const platform = new Signlink(null, { openSocket: openBrowserSocketHandle });
    let stream: ClientStream | undefined;
    try {
        const handle = await openBrowserSocketHandle(requireNonNull(server.hostname), Number(server.port));
        stream = new ClientStream(handle, platform);
        expect(await stream.read()).toBe(0xaa);
        const scratch = new Uint8Array(6).fill(0xfe);
        expect(stream.tryReadBuffered(scratch, 0, 6)).toBe(false);
        expect(stream.GetAvailable()).toBe(5);
        expect(scratch).toEqual(new Uint8Array(6).fill(0xfe));
        expect(() => requireNonNull(stream).tryReadBuffered(scratch, 1, 6)).toThrow(RangeError);
        stream.Read = async () => {
            throw new Error('buffered JS5 read fell back to the blocking path');
        };
        const queue = new Js5NetQueue();
        const request = queue.RequestData(2, 258, 7, false);
        queue.ProvideConnection(false, stream);
        await queue.Service();
        expect(request.incomplete).toBe(true);
        expect(stream.GetAvailable()).toBe(0);
        more.resolve();
        const deadline = Date.now() + 2000;
        while (stream.GetAvailable() < packet.length - 5 && Date.now() < deadline) await settleSignlink();
        expect(stream.GetAvailable()).toBe(packet.length - 5);
        await queue.Service();
        expect([...request.getData()]).toEqual([0, 0, 0, 4, 26, ...body, 0, 0]);
        expect(stream.GetAvailable()).toBe(0);
    } finally {
        await stream?.Close();
        await platform.stopWorker();
        await server.stop(true);
    }
});

test('each queue holds twenty requests across queued and sent states', async () => {
    const stream = new Stream();
    installSocketHost(async () => stream);
    const { client, queue: net } = createJs5Client(5);
    for (let i = 0; i < 20; i++) {
        net.RequestData(0, i, 4, true);
        net.RequestData(0, i, 4, false);
    }
    expect(() => net.RequestData(0, 20, 4, true)).toThrow();
    await start(client, stream);
    expect(net.IsUrgentQueueFull()).toBe(true);
    expect(net.IsPrefetchQueueFull()).toBe(true);
    stream.input.push(...response(4, 2, 128, [123]));
    await client['js5Tick']();
    expect(net.IsUrgentQueueFull()).toBe(true);
    expect(net.IsPrefetchQueueFull()).toBe(false);
    net.close();
});

test('CRC retry resends outstanding groups and decodes the XOR stream', async () => {
    const first = new Stream();
    const second = new Stream();
    installSocketHost(async alternate => (alternate ? second : first));
    const { client, queue: net } = createJs5Client(5);
    const request = net.RequestData(0, 129, 0, true);
    await start(client, first);
    first.input.push(...response(0, 129, 0, body).slice(0, 512));
    await client['js5Tick']();
    expect(request.getPercentage()).toBeGreaterThan(0);
    net.RecordCRCFailure();
    await settleSignlink();
    expect(first.closed).toBe(true);
    await start(client, second);
    const key = second.writes[14];
    expect(key).toBeGreaterThan(0);
    expect(second.writes.slice(13)).toEqual([4, key, 0, 0, 1, 0, 0, 129]);
    second.input.push(...response(0, 129, 0, body).map(byte => byte ^ key));
    await client['js5Tick']();
    expect([...request.getData()]).toEqual([0, 0, 0, 4, 26, ...body]);
    net.close();
});

test('reply code 6 on two handshake attempts reports out of date', async () => {
    const savedState = Client.gameState;
    const ports: boolean[] = [];
    installSocketHost(async alternate => {
        ports.push(alternate);
        const stream = new Stream();
        stream.input.push(6);
        return stream;
    });
    const { client, queue: net } = createJs5Client(5);
    net.RequestData(0, 255, 255, true);
    for (let i = 0; i < 4; i++) {
        await client['js5Tick']();
        await settleSignlink();
    }
    try {
        const errors: string[] = [];
        client.ShowError = reason => errors.push(reason);
        await client['js5Tick']();
        expect(errors).toEqual(['js5connect_outofdate']);
        expect(Client.gameState).toBe(1000);
        expect(ports).toEqual([false, true]);
    } finally {
        Client.gameState = savedState;
        net.close();
    }
});

test.skipIf(!process.env.GAMEPACK_530)(
    'same wire trace through fd and ej in the supplied Java client',
    async () => {
        const trace = await runTrace();
        const jar = gamepackPath;
        const source = fileURLToPath(new URL('./js5net/Js5NetOracle.java', import.meta.url));
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', jar, source, Buffer.from(wire).toString('hex')], { timeout: 20000 });
        expect(result.stderr.toString()).toBe('');
        expect(result.exitCode).toBe(0);
        const java = result.stdout.toString().trim().split(/\r?\n/);
        // client.b(boolean) sends the initial five bytes before it installs the stream on ej.
        const bytes = [trace.writes.slice(5), trace.prefetch, trace.urgent, trace.progress];
        expect(bytes.map(value => Buffer.from(value).toString('hex'))).toEqual(java);
    },
    30000
);

test('ej narrows original request longs and sends reads to se before handling socket errors', async () => {
    const source = fileURLToPath(new URL('./js5net/Js5NetOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source, 'reads']);
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
    const read = [0, 0, 0];
    const stream = new Stream();
    stream.Read = async (_bytes, offset, length) => {
        read[0]++;
        read[1] = offset;
        read[2] = length;
        throw new SocketIoError('read failed');
    };
    const queue = new Js5NetQueue();
    queue.RequestData(0, 9, 3, true).secondaryKey = 0x7ffffffeeeeabcdfn;
    queue.RequestData(0, 13, 4, false).secondaryKey = BigInt.asIntN(64, 0x8000000fffffffd3n);
    queue.ProvideConnection(true, stream);
    expect((await queue.Service()) + ':' + Buffer.from(stream.writes).toString('hex')).toBe(expected[0]);
    const header = requireNonNull(queue['header']);
    header.m_pos = -1;
    stream.input.push(2, 9);
    expect([await queue.Service(), '[' + read.join(', ') + ']', header.m_pos, queue.response, queue.errors].join(':')).toBe(expected[1]);
});

test('ej queue links, error recovery, command packets and Java runtime failures match at each transition', async () => {
    class Socket extends Stream {
        failed = false;
        broken = false;
        checkError() {
            if (this.failed) {
                this.failed = false;
                throw new SocketIoError('asynchronous write');
            }
        }
        breakConnection() {
            this.broken = true;
        }
    }
    const source = fileURLToPath(new URL('./js5net/Js5NetOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-cp', gamepackPath, source, 'edges'], { timeout: 20000 });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const lines = java.stdout.toString().trim().split(/\r?\n/);
    const net = new Js5NetQueue();
    const keys = (list: SecondaryLinkedList<Js5NetQueueRequest>) => {
        const ids: bigint[] = [];
        for (let node = list.head(); node !== null; node = list.next()) ids.push(node.secondaryKey);
        return '[' + ids.join(', ') + ']';
    };
    const state = (stream: Socket | null, result: string | boolean) => {
        const current = net['current'];
        expect(
            [
                result,
                net.response,
                net.errors,
                net['stream'] === null ? 'off' : 'on',
                net['xorKey'],
                net['header']?.m_pos ?? '-',
                current === null ? '-' : current.secondaryKey + '/' + current.blockPosition,
                keys(net['urgent']),
                keys(net['urgentSent']),
                keys(net['prefetch']),
                keys(net['prefetchSent']),
                stream === null ? '' : Buffer.from(stream.writes).toString('hex')
            ].join(';')
        ).toBe(requireNonNull(lines.shift()));
    };
    let s = new Socket();
    state(null, await net.Service(0));
    net.RequestData(0, 6, 1, true);
    net.RequestData(2, 6, 1, true);
    net.RequestData(0, 2, 6, false);
    state(null, await net.Service(0));
    net.ProvideConnection(false, s);
    net.setLoggedIn(true);
    net.RequestServerDrop();
    s.input.push(...Buffer.from('010006000000000101010006000000000102', 'hex'));
    for (const start of [100, 99, 99, 99, 99, 0]) state(s, await net.Service(start));
    net.RequestData(0, 7, 7, false);
    s.failed = true;
    state(s, await net.Service(100));
    s = new Socket();
    net.ProvideConnection(true, s);
    state(s, 'attach');
    s.input.push(...Buffer.from('ff00020000000001', 'hex'));
    state(s, await net.Service(0));
    const previousSeed = mathRandom['seed'];
    try {
        mathRandom.setSeed(530n);
        net.RecordCRCFailure();
    } finally {
        mathRandom['seed'] = previousSeed;
    }
    state(s, 'crc');
    net['xorKey'] = -103;
    s = new Socket();
    net.ProvideConnection(true, s);
    s.input.push(...Buffer.from('07000780fffffff0', 'hex').map(b => b ^ 0x99));
    await expect(net.Service(0)).rejects.toThrow(RangeError);
    state(s, 'runtime');
    net.breakConnection();
    state(s, s.broken ? 'broken' : 'open');
    net.close();
    state(s, s.closed ? 'closed' : 'open');
    const offline = new Js5NetQueue();
    expect(String(await offline.Service(7)) + '/' + String(offline['header'] === null)).toBe(requireNonNull(lines.shift()));
    const busy = new Js5NetQueue();
    busy.RequestData(0, 1, 1, true);
    expect(String(await busy.Service(7)) + '/' + String(busy['header'] === null)).toBe(requireNonNull(lines.shift()));
    expect(lines).toHaveLength(0);
}, 30000);

test('JS5 connection stages preserve the Signlink socket and writer requests, errors and handoff in client.b', async () => {
    const source = fileURLToPath(new URL('./js5net/Js5ConnectionOracle.java', import.meta.url));
    const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { timeout: 10000 });
    expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
    const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
    installRawHost(async () => {
        throw Error('unexpected worker');
    }, 231);
    Client.gameHost = 'game.example';
    // The Java fixture holds the worker so each queued dj can be inspected before and after the socket is supplied.
    await requireNonNull(GameShell.signlink).stopWorker();
    const { client, queue: net } = createJs5Client(30);
    function requestFields(r: SignlinkRequest | null, stream: ClientStream | null) {
        return r === null ? '-' : [r.type, r.intArg, r.objectArg === stream ? 'self' : r.objectArg, r.status].join(':');
    }
    let line = 0,
        reply = -1;
    function state(previous: ClientStream | null = null) {
        const active = net['stream'],
            connecting = Client.js5ConnectStream;
        const stream = connecting ?? (active instanceof ClientStream ? active : previous),
            buffer = stream?.['buffer'];
        const bytes = buffer ? Buffer.from(buffer.subarray(0, stream?.['tail'])).toString('hex') : '-';
        expect(
            [
                Client.js5ConnectStage,
                Client.currentPort,
                net.errors,
                net.response,
                requestFields(Client.js5SocketRequest, null),
                connecting !== null,
                active !== null,
                requestFields(stream?.['writer'] ?? null, stream),
                bytes,
                stream?.['closed'] ?? '-'
            ].join(';')
        ).toBe(expected[line++]);
    }
    function ready(broken: boolean) {
        const r = requireNonNull(Client.js5SocketRequest);
        r.result = {
            setSoTimeout() {
                if (broken) throw new SocketIoError();
            },
            input: {
                get available() {
                    return reply < 0 ? 0 : 1;
                },
                async read() {
                    const out = reply;
                    reply = -1;
                    return out;
                },
                async readBytes() {
                    return -1;
                },
                close() {}
            },
            output: { write() {}, flush() {}, close() {} },
            close() {}
        };
        r.status = 1;
    }
    async function tick(previous: ClientStream | null = null) {
        await client['js5Connect']();
        state(previous);
    }
    await tick();
    ready(false);
    await tick();
    const first = Client.js5ConnectStream;
    reply = 7;
    await tick(first);
    await tick();
    ready(true);
    await tick();
    Client.js5RetryDelay = 0;
    Client.js5LastErrorCount = 2;
    await tick();
    ready(false);
    await tick();
    reply = 0;
    await tick();
    expect(line).toBe(expected.length);
});

test('client.g preserves JS5 error screen order, retry delays and alternate ports from the gamepack', async () => {
    const source = fileURLToPath(new URL('./js5net/Js5ConnectionOracle.java', import.meta.url));
    const cases: number[][] = [];
    for (const state of [0, 5, 10, 25, 28, 30, 40]) {
        for (const code of [-2, -1, 0, 6, 7, 9, 15]) {
            for (const errorCount of [1, 2, 4]) cases.push([errorCount, code, state, 0, 0, 40231, 0, 1]);
        }
    }
    cases.push([4, 6, 5, 0, 7, 50231, 1, 1], [8, -1, 5, 8, 123, 50231, 0, 1], [15, 7, 30, 0, 7, 55000, 0, 1], [2147483647, 7, 30, 0, 7, 40231, 0, 1], [4, 6, 5, 0, 7, 40231, 0, 0]);
    const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source, 'errors', ...cases.map(v => v.join(','))]);
    expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
    const lines = oracle.stdout.toString().trim().split(/\r?\n/);
    installRawHost(async () => {
        throw Error('unexpected socket');
    }, 231);
    const { client } = createJs5Client(0);
    const logger = console.log;
    let event = '-';
    console.log = msg => {
        event = String(msg) + '@' + Client.gameState;
    };
    try {
        for (let i = 0; i < cases.length; i++) {
            const [errors, code, gameState, previous, delay, port, alreadyShown, pending] = cases[i];
            const queue = (Client.js5NetQueue = new Js5NetQueue());
            queue.errors = errors;
            queue.response = code;
            Client.gameState = gameState;
            Client.js5LastErrorCount = previous;
            Client.js5RetryDelay = delay;
            Client.currentPort = port;
            client['errorShown'] = alreadyShown !== 0;
            if (pending !== 0) queue.RequestData(0, 7, 8, true);
            Client.js5ConnectStage = -1;
            event = '-';
            await client['js5Tick']();
            expect([event, client['errorShown'], Client.gameState, Client.js5LastErrorCount, Client.js5RetryDelay, Client.currentPort, Client.js5ConnectStage].join(' '), cases[i].join(',')).toBe(lines[i]);
        }
        expect(lines.length).toBe(cases.length);
    } finally {
        console.log = logger;
    }
}, 30000);

test('client.b reads startup handshakes and uses the signed-long timeout only in later states', async () => {
    const cases: number[][] = [];
    for (const state of [0, 5, 10, 28, 30])
        for (const reply of [-1, 0, 7]) {
            for (const clock of [0, 1, 2]) cases.push([state, reply, clock]);
        }
    const source = fileURLToPath(new URL('./js5net/Js5ConnectionOracle.java', import.meta.url));
    const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source, 'handshakes', ...cases.map(v => v.join(','))]);
    expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
    const lines = oracle.stdout.toString().trim().split(/\r?\n/);
    installRawHost(async () => {
        throw Error('unexpected socket');
    }, 0);
    Client.currentPort = 0;
    const worker = requireNonNull(GameShell.signlink);
    await worker.stopWorker();
    const { client } = createJs5Client(0);
    for (let i = 0; i < cases.length; i++) {
        const [state, reply, clock] = cases[i];
        const queue = (Client.js5NetQueue = new Js5NetQueue());
        const stream = new ClientStream(
            {
                input: {
                    get available() {
                        return reply < 0 ? 0 : 1;
                    },
                    async read() {
                        return reply;
                    },
                    async readBytes() {
                        return -1;
                    },
                    close() {}
                },
                output: { write() {}, flush() {}, close() {} },
                close() {}
            },
            worker
        );
        Client.gameState = state;
        Client.js5ConnectStage = 3;
        Client.js5ConnectStream = stream;
        Client.js5SocketRequest = new SignlinkRequest();
        Client.js5ConnectTime = clock === 0 ? BigInt(Date.now()) : clock === 1 ? 0n : -(1n << 63n);
        Client.js5LastErrorCount = 0;
        await client['js5Connect']();
        const writer = stream['writer'];
        const buffer = stream['buffer'];
        const request = Client.js5SocketRequest;
        const socketRequest = request === null ? '-' : [request.type, request.intArg, request.objectArg === null ? 'self' : request.objectArg, request.status].join(':');
        expect(
            [
                Client.js5ConnectStage,
                Client.currentPort,
                queue.errors,
                queue.response,
                socketRequest,
                Client.js5ConnectStream !== null,
                queue['stream'] !== null,
                writer === null ? '-' : [writer.type, writer.intArg, writer.objectArg === stream ? 'self' : writer.objectArg, writer.status].join(':'),
                buffer === null ? '-' : Buffer.from(buffer.subarray(0, stream['tail'])).toString('hex'),
                stream['closed']
            ].join(';'),
            cases[i].join(',')
        ).toBe(lines[i]);
    }
    expect(lines.length).toBe(cases.length);
}, 30000);

loginFixture(import.meta.url, 'shutting down JS5 releases pending Signlink dials and blocked handshake reads', async () => {
    GameShell.canvas = { removeKeyListener() {}, removeFocusListener() {}, removeMouseListener() {}, removeMouseMotionListener() {} };
    for (const mode of ['pending', 'resolve', 'reject']) {
        const beforeConnect = mode === 'pending';
        const dial = Promise.withResolvers<void>();
        const acquired = Promise.withResolvers<void>();
        const reading = Promise.withResolvers<void>();
        const read = Promise.withResolvers<number>();
        const closed = Promise.withResolvers<void>();
        let closes = 0;
        installRawHost(async () => {
            acquired.resolve();
            await dial.promise;
            return {
                input: {
                    available: 0,
                    read() {
                        reading.resolve();
                        return read.promise;
                    },
                    async readBytes() {
                        return -1;
                    },
                    close() {
                        if (mode === 'reject') read.reject(new SocketIoError('closed during handshake'));
                        else read.resolve(-1);
                    }
                },
                output: { write() {}, flush() {}, close() {} },
                close() {
                    closes++;
                    closed.resolve();
                }
            };
        });
        const { client, queue } = createJs5Client(5);
        Client.js5DiskQueue = await Js5LocalCache.create();
        queue.RequestData(0, 255, 255, true);
        await client['js5Tick']();
        await acquired.promise;
        let tick: Promise<void> | null = null;
        if (!beforeConnect) {
            dial.resolve();
            await settleSignlink();
            tick = client['js5Tick']();
            await reading.promise;
        }
        const request = Client.js5SocketRequest,
            handshake = Client.js5ConnectStream;
        client['closed'] = true;
        await client['MainQuit']();
        dial.resolve();
        await closed.promise;
        await tick;
        expect(closes).toBe(1);
        expect(Client.js5SocketRequest).toBe(request);
        expect(Client.js5ConnectStream).toBe(handshake);
        expect(queue['stream']).toBeNull();
        expect(queue.errors).toBe(0);
    }
});
