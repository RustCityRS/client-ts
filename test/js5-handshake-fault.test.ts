import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import ClientStream from '#/io/ClientStream.js';
import { FileIoError } from '#/io/File.js';
import { GamepackClassNotFound } from '#/io/GamepackClass.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import { SocketIoError, type SocketHandle } from '#/io/SocketPlatform.js';
import { JavaError } from '#/util/JavaException.js';
import Signlink from '#/util/Signlink.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

type Row = [entry: number, stage: number, bad: number, site: number, code: number, point: string, action: number, available: number, reply: number];
function vectors(): Row[] {
    const rows: Row[] = [];
    for (const entry of [0, 1]) {
        for (const stage of [1, 2])
            for (const status of [0, 1, 2, 3, -1])
                for (let bad = 0; bad <= 7; bad++) {
                    rows.push([entry, stage, bad, -102, status, '-', 0, 1, 0]);
                }
        for (const point of ['timeout30000', 'nodelaytrue', 'input', 'output'])
            for (let action = 1; action <= 8; action++) {
                rows.push([entry, 2, 0, -102, 1, point, action, 1, 0]);
            }
        for (const stage of [1, 2, 3])
            for (const point of ['available', 'read'])
                for (let action = 0; action <= 8; action++) {
                    for (const available of [0, 1]) for (const reply of [-1, 0, 6, 19]) rows.push([entry, stage, 0, -102, 1, point, action, available, reply]);
                }
    }
    for (const site of [-102, -103, -111, -112]) for (const code of [-1, 0, 19, 1000, 1001, 1002]) rows.push([2, 1, 6, site, code, '-', 0, 1, 0]);
    return rows;
}
function fault(e: unknown, original: WrappedException): string {
    if (e instanceof WrappedException) return (e === original ? 'same:' : 'wrap:') + e.context + '/' + fault(e.cause, original);
    if (e instanceof TypeError) return e.message.startsWith('ClassCastException') ? 'cast' : 'null';
    if (e instanceof JavaError) return 'error';
    if (e instanceof GamepackClassNotFound) return 'class';
    if (e instanceof FileIoError || e instanceof SocketIoError) return 'io';
    return 'runtime';
}
loginFixture(
    import.meta.url,
    'native JS5 handshake preserves worker-result casts, checked IO recovery and nested failure context',
    async () => {
        const rows = vectors(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-handshake-fault-'));
        let lines: string[];
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...['Js5ConnectionOracle', 'Js5HandshakeFaultOracle'].map(x => join(import.meta.dir, 'js5net', x + '.java'))]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'Js5HandshakeFaultOracle'], {
                stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'),
                maxBuffer: 4194304
            });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            lines = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const app = new Client();
        for (const [i, row] of rows.entries()) {
            const [entry, stage, bad, site, code, point, action, available, reply] = row;
            const original = WrappedException.wrap(new Error('wrapped'), 'origin');
            let trace = '';
            const hit = (name: string) => {
                trace += name + ';';
                if (name !== point) return;
                switch (action) {
                    case 1:
                        throw new FileIoError();
                    case 2:
                        throw new SocketIoError();
                    case 3:
                        throw new Error('socket');
                    case 4:
                        throw original;
                    case 5:
                        throw new JavaError();
                    case 6:
                        throw new GamepackClassNotFound();
                    case 7:
                        Client.js5NetQueue = null;
                        throw new FileIoError();
                    case 8:
                        Client.js5NetQueue = null;
                        break;
                }
            };
            const peer = (enabled: () => boolean): SocketHandle => ({
                setSoTimeout(t) {
                    if (enabled()) hit('timeout' + t);
                },
                setTcpNoDelay(on) {
                    if (enabled()) hit('nodelay' + on);
                },
                get input() {
                    if (enabled()) hit('input');
                    return {
                        get available() {
                            if (enabled()) hit('available');
                            return available;
                        },
                        async read() {
                            if (enabled()) hit('read');
                            return reply;
                        },
                        async readBytes() {
                            return -1;
                        },
                        close() {}
                    };
                },
                get output() {
                    if (enabled()) hit('output');
                    return { close() {}, write() {}, flush() {} };
                },
                close() {}
            });
            let live = false;
            const host = (GameShell.signlink = Object.create(Signlink.prototype) as Signlink);
            host.startThread = () => new SignlinkRequest();
            const old = new ClientStream(
                peer(() => live),
                host
            );
            live = stage === 3;
            const q = (Client.js5NetQueue = new Js5NetQueue());
            if (entry === 1) q.RequestData(0, 1, 2, true);
            const task = (Client.js5SocketRequest = new SignlinkRequest<SocketHandle>());
            task.status = code;
            Reflect.set(task, 'result', bad === 1 || bad === 7 ? null : bad === 2 ? 42 : bad === 3 ? 'socket' : bad === 4 ? {} : peer(() => true));
            if (bad === 5) Client.js5SocketRequest = null;
            if (bad === 6) Client.js5NetQueue = null;
            if (bad === 7) GameShell.signlink = null;
            Client.js5ConnectStream = old;
            Client.js5ConnectStage = stage;
            Client.gameState = 30;
            Client.js5LastErrorCount = Client.js5RetryDelay = 0;
            Client.js5ConnectTime = 0n;
            Client.currentPort = Client.primaryPort = 40729;
            Client.secondaryPort = 50729;
            q.errors = 0;
            q.response = 72;
            let result = 'ok';
            try {
                if (entry === 2) app['js5Error'](site, code);
                else if (entry === 1) await app['js5Tick']();
                else await app['js5Connect']();
            } catch (e) {
                result = fault(e, original);
            }
            const active = q['stream'];
            const stream = Client.js5ConnectStream !== null && Client.js5ConnectStream !== old ? Client.js5ConnectStream : active;
            const data = stream instanceof ClientStream ? stream['buffer'] : null;
            const wire = data !== null && stream instanceof ClientStream ? Buffer.from(data.subarray(0, stream['tail'])).toString('hex') : '-';
            const state = [
                Client.js5ConnectStage,
                q.errors,
                q.response,
                Client.currentPort,
                Client.js5RetryDelay,
                Client.js5SocketRequest === task,
                Client.js5NetQueue === q,
                Client.js5ConnectStream === null ? '-' : Client.js5ConnectStream === old ? 'old' : 'new',
                active !== null,
                Client.js5ConnectTime !== 0n
            ];
            expect([result, trace, state.join(','), wire].join('|'), row.join(' ')).toBe(lines[i]);
        }
    },
    20000
);
