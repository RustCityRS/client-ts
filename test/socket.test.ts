import GameWorld from '#/io/GameWorld.js';
import Client from '#/client/Client.js';
import { loginFixture } from './login-fixture.js';
import type { SocketHandle } from '#/io/SocketPlatform.js';

import { installRawHost } from './socket-host.js';
import GameShell from '#/client/GameShell.js';
import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ClientStream from '../src/io/ClientStream.js';
import { settleSignlink } from './socket-host.js';
import Signlink, { SignlinkThread, onSignlinkRequestSettled } from '#/util/Signlink.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { openBrowserSocketHandle } from '../src/io/BrowserSocket.js';
import { SocketIoError } from '../src/io/SocketPlatform.js';

const hash = (b: Uint8Array | null) => (b === null ? 'null' : createHash('sha256').update(b).digest('hex'));

test('socket cursors, ring contents, EOF, deferred errors and close match se in the 530 jar', async () => {
    const jar = gamepackPath;
    const source = fileURLToPath(new URL('./js5net/SocketOracle.java', import.meta.url));
    const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', jar, source], { timeout: 15000 });
    expect(oracle.stderr.toString()).toBe('');
    expect(oracle.exitCode).toBe(0);
    const expected = oracle.stdout.toString().trim().split(/\r?\n/);
    const input = [7, 1, 2, 3, 4];
    const output: number[] = [];
    let inputClosed = false,
        outputClosed = false,
        closed = false,
        failFlush = false,
        writes = 0,
        flushes = 0;
    let timeout = 0,
        tcpNoDelay = false;
    const stream = new ClientStream(
        {
            setSoTimeout(value) {
                timeout = value;
            },
            setTcpNoDelay(value) {
                tcpNoDelay = value;
            },
            input: {
                get available() {
                    return input.length;
                },
                async read() {
                    return input.shift() ?? -1;
                },
                async readBytes(dst, offset, length) {
                    if (input.length === 0) return -1;
                    const chunk = input.splice(0, Math.min(length, 2));
                    dst.set(chunk, offset);
                    return chunk.length;
                },
                close() {
                    inputClosed = true;
                }
            },
            output: {
                write(bytes, off, len) {
                    writes++;
                    output.push(...bytes.subarray(off, off + len));
                },
                flush() {
                    flushes++;
                    if (failFlush) throw new SocketIoError();
                },
                close() {
                    outputClosed = true;
                }
            },
            close() {
                closed = true;
            }
        },
        null
    );
    expect([timeout, tcpNoDelay]).toEqual([30000, true]);
    const gate = Promise.withResolvers<void>();
    const writer = new SignlinkRequest<SignlinkThread>();
    writer.result = new SignlinkThread({
        async run() {
            await gate.promise;
            await stream.run();
        }
    });
    writer.status = 1;
    stream['writer'] = writer;
    const dest = new Uint8Array(5).fill(88);
    let line = 0;
    function state(result: string) {
        const actual = [
            result,
            stream['closed'],
            stream['head'],
            stream['tail'],
            stream['writeFailed'],
            hash(stream['buffer']),
            hash(Uint8Array.from(output)),
            writes,
            flushes,
            closed,
            inputClosed,
            outputClosed,
            Buffer.from(dest).toString('hex'),
            stream.GetAvailable()
        ].join(';');
        expect(actual, 'Java state ' + line).toBe(expected[line++]);
    }
    async function invoke(call: () => unknown, idle = false) {
        let result: string;
        try {
            const value = await call();
            result = value === undefined ? 'ok' : String(value);
        } catch (e) {
            result = e instanceof SocketIoError ? 'io' : 'runtime';
        }
        if (idle) await settleSignlink();
        state(result);
    }
    state('init');
    await invoke(() => stream.read());
    await invoke(() => stream.Read(dest, 1, 3));
    await invoke(() => stream.Read(dest, 1, 2));
    await invoke(() => stream.read());
    const bytes = Uint8Array.from({ length: 5000 }, (_, i) => (i * 37 + 19) & 255);
    await invoke(() => stream.Write(2, bytes, 4896));
    await invoke(() => stream.Write(4999, bytes, 3));
    await invoke(() => stream.Write(2, bytes, 5));
    gate.resolve();
    await settleSignlink();
    state('drain');
    await invoke(() => stream.Write(14, bytes, 119), true);
    failFlush = true;
    await invoke(() => stream.Write(5, bytes, 13), true);
    await invoke(() => stream.checkError());
    await invoke(() => stream.checkError());
    await invoke(() => stream.Write(8, bytes, 16), true);
    await invoke(() => stream.Write(12, bytes, 3));
    failFlush = false;
    await invoke(() => stream.breakConnection());
    await invoke(() => stream.Write(8, bytes, 6), true);
    await invoke(() => stream.checkError());
    await invoke(() => stream.Close());
    await invoke(() => stream.read());
    await invoke(() => stream.Read(dest, -1, 37));
    await invoke(() => stream.Write(-1, bytes, 30000));
    await invoke(() => stream.finalize());
    expect(line).toBe(expected.length);
});

test('530 WebSocket boundary carries the byte stream across fragmented messages and flushes before close', async () => {
    const received: number[] = [];
    const { promise: peerClosed, resolve: finished } = Promise.withResolvers<void>();
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(req, srv) {
            if (!srv.upgrade(req, { headers: { 'Sec-WebSocket-Protocol': 'binary' } })) return new Response(null, { status: 400 });
        },
        websocket: {
            open(ws) {
                ws.sendBinary(Uint8Array.of(4, 5, 6));
                ws.sendBinary(Uint8Array.of(7, 8, 9, 10));
            },
            message(_ws, bytes) {
                received.push(...new Uint8Array(bytes as Buffer));
            },
            close() {
                finished();
            }
        }
    });
    const platform = new Signlink(null, { openSocket: openBrowserSocketHandle });
    try {
        const request = platform.openSocket(requireNonNull(server.hostname), Number(server.port));
        await new Promise<void>(resolve => onSignlinkRequestSettled(request, resolve));
        const stream = new ClientStream(requireNonNull(request.result), platform);
        expect(await stream.read()).toBe(4);
        const dst = new Uint8Array(8).fill(99);
        await stream.Read(dst, 1, 6);
        expect([...dst]).toEqual([99, 5, 6, 7, 8, 9, 10, 99]);
        expect(stream.GetAvailable()).toBe(0);
        stream.Write(1, dst, 3);
        stream.Write(4, dst, 3);
        await stream.Close();
        await peerClosed;
        expect(received).toEqual([5, 6, 7, 8, 9, 10]);
    } finally {
        await platform.stopWorker();
        await server.stop(true);
    }
});

loginFixture(import.meta.url, 'world-list teardown waits for a queued Signlink writer before worker shutdown', async () => {
    let closed = false;
    const received: number[] = [];
    const raw: SocketHandle = {
        input: {
            available: 0,
            async read() {
                return 0;
            },
            async readBytes() {
                return -1;
            },
            close() {}
        },
        output: {
            write(data, off, len) {
                received.push(...data.subarray(off, off + len));
            },
            flush() {},
            close() {}
        },
        close() {
            closed = true;
        }
    };
    const gate = Promise.withResolvers<void>();
    installRawHost(async host => {
        if (host === 'hold') await gate.promise;
        return raw;
    });
    const platform = requireNonNull(GameShell.signlink);
    await GameWorld.ListFetch();
    await settleSignlink();
    const blocker = platform.openSocket('hold', 0);
    await GameWorld.ListFetch();
    const writer = requireNonNull((Client.stream as ClientStream)['writer']);
    expect([blocker.status, writer.status, writer.intArg]).toEqual([0, 0, 3]);
    let joined = false;
    const stopping = Promise.resolve(GameWorld.close()).then(() => {
        joined = true;
    });
    await settleSignlink();
    expect([joined, closed, received.length]).toEqual([false, false, 0]);
    gate.resolve();
    await stopping;
    expect([joined, closed, writer.status, received]).toEqual([true, true, 1, [255, 0, 0, 0, 0]]);
    await platform.stopWorker();
});
