import GameShell from '#/client/GameShell.js';
import LocType from '#/config/LocType.js';
import ObjType from '#/config/ObjType.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import { loginFixture, setLoginChecksums } from './login-fixture.js';
import { installSocketHost, installRawHost, settleSignlink } from './socket-host.js';
import Preferences from '../src/ui/Preferences.js';
import { expect, spyOn } from 'bun:test';
import Client from '#/client/Client.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import { fileURLToPath } from 'node:url';
import Login from '../src/io/Login.js';
import MouseTracking from '#/client/MouseTracking.js';
import SuperPacket from '../src/io/SuperPacket.js';
import Protocol from '#/io/Protocol.js';
import { SocketIoError } from '../src/io/SocketPlatform.js';
import { openBrowserSocketHandle } from '../src/io/BrowserSocket.js';
import { requireNonNull } from '../src/util/JavaArray.js';
import { clientErrorHost } from '../src/util/ClientError.js';
import { mathRandom } from '../src/util/JavaRandom.js';
import { gamepackPath, cachePath } from './reference.js';
import WorldList from '../src/io/WorldList.js';
import GameWorld from '../src/io/GameWorld.js';
import AccountCreation from '#/io/AccountCreation.js';
import AudioEngine from '#/sound/AudioEngine.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import { fromJsString } from '../src/datastruct/JagString.js';

import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '../src/script/ScriptRunner.js';
import { cacheAssets, localAssets, readGroup } from './cachefile.js';

class Stream {
    data: number[] = [];
    broken = false;
    closed = false;
    GetAvailable() {
        if (this.broken) throw new SocketIoError();
        return this.data.length;
    }
    async read() {
        if (this.broken) throw new SocketIoError();
        return this.data.shift() ?? -1;
    }
    async Read(bytes: Uint8Array, offset: number, length: number) {
        if (this.broken) throw new SocketIoError();
        if (length > bytes.length - offset) throw new RangeError();
        bytes.set(this.data.splice(0, length), offset);
    }
    Write() {}
    Close() {
        this.closed = true;
    }
}

const hex = (packet: SuperPacket) => Buffer.from(requireNonNull(packet.m_data).subarray(0, packet.m_pos)).toString('hex');
function startLogin(reconnect = false): Client {
    const app = new Client();
    if (reconnect) Login.beginLogin(0);
    else Login.requestLogin(fromJsString('Pilot'), fromJsString('s'), -1, 0);
    return app;
}
const challenge = 'ffeeddcc76543210';

function trackPcmMarks(): { count: number } {
    const marks = { count: 0 };
    class CountedPlayer extends PCMPlayer {
        override DoneUpdate(): void {
            marks.count++;
            super.DoneUpdate();
        }
    }
    AudioEngine.musicPlayer = new CountedPlayer();
    AudioEngine.effectsPlayer = new CountedPlayer();
    return marks;
}

loginFixture(
    import.meta.url,
    'every le login reply, retry, timeout and partial account-header transition matches Java',
    async () => {
        const namedEmptyIndex = Uint8Array.of(0, 0, 0, 0, 4, 5, 1, 0, 0);
        const assets = cacheAssets(
            new Map([
                [3, readGroup(cachePath, 255, 3)],
                [5, namedEmptyIndex]
            ]),
            (archive, group) => readGroup(cachePath, archive, group)
        );
        setLoginChecksums(assets, id => id);
        const commands: string[] = [];
        const start = (mode = 10) => commands.push('start ' + mode, 'tick', 'ready');
        for (let code = 0; code <= 255; code++) {
            start(code === 15 ? 40 : 10);
            commands.push('tick 00ff', 'tick eedd', 'tick cc76543210', 'tick ' + code.toString(16).padStart(2, '0'));
            if (code === 1) commands.push('tick', 'continue', 'tick', 'tick 1d', 'tick', 'tick 9e');
            if (code === 21 || code === 29) commands.push('tick', 'tick 7f');
            if (code === 23) commands.push('tick', 'ready', 'tick 00' + challenge + '17');
            if (code === 15) commands.push('resume');
            if (code === 2) commands.push('tick 010201000100', 'tick 0100110101', 'tick 770049', 'tick 00b5', 'tick ' + Buffer.from(Array.from({ length: 64 }, (_, i) => i)).toString('hex') + '7f0190011000b3');
        }
        start();
        commands.push('tick 00' + challenge + '02', 'tick 0102010001000100110101770009', 'abortReset', 'tick 000000000000000000', 'restoreRecorder');
        for (const hook of ['zap', 'unzap'])
            for (let flags = 0; flags < 16; flags++) {
                const status = Buffer.from([1, 2, (flags >> 1) & 1, 0, (flags >> 2) & 1, 0, 1, 0, 17, (flags >> 3) & 1, flags & 1, 119, 0, 9]);
                commands.push('start 10 ' + (flags & 1) + ' ' + hook, 'tick', 'ready', 'tick 00' + challenge + '02', 'tick ' + status.toString('hex'));
            }
        start();
        commands.push('tick 00' + challenge + '02', 'tick 0102010001000100110101770009', 'tick 000000000000000000');
        for (const code of [1, 2, 6, 15, 21, 23, 29, 255]) {
            start();
            commands.push('tick ' + code.toString(16).padStart(2, '0'));
        }
        commands.push('start 10', 'tick', 'refused', 'tick', 'tick', 'refused', 'tick');
        start();
        commands.push('tick 00', 'ticks 2000', 'tick', 'ready', 'tick 00', 'ticks 2000', 'tick');
        start();
        commands.push('tick 00', 'ticks 2147483647', 'tick', 'tick');
        start();
        commands.push('tick 00', 'port 60001', 'ticks 2000', 'tick');
        start();
        commands.push('tick 00', 'break', 'tick', 'tick', 'ready', 'tick 00');
        for (const settings of ['modified', 'none']) {
            start();
            commands.push('tick 00', 'parameters ' + settings, 'tick ' + challenge);
        }
        const source = fileURLToPath(new URL('./login/LoginStagesOracle.java', import.meta.url));
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-cp', gamepackPath, source], { stdin: Buffer.from(commands.join('\n') + '\n'), timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const expected = java.stdout.toString().trim().split(/\r?\n/);
        expect(expected.length).toBe(commands.length);
        const previousSent = Preferences.sent;
        const previousState = Client.gameState,
            previousNet = Client.js5NetQueue;
        const previousLevel = Client.playerLevel;
        const draw = spyOn(Client, 'MessageBox').mockImplementation(() => {});
        Client.js5NetQueue = new Js5NetQueue();
        const previousRecorder = Client.mouseTracking;
        Client.mouseTracking = new MouseTracking();
        const oldSeed = mathRandom['seed'],
            previousExponent = Client.rsaExponent;
        Client.rsaExponent = 1n;
        try {
            let stream = new Stream(),
                task = Promise.withResolvers<Stream>();
            installSocketHost(() => task.promise);
            let app = startLogin();
            let hookProbe = '',
                calls = 0,
                heldSuccess = false,
                abortReset = false;
            const waits: { observed: string[]; expected: string[] }[] = [];
            GameShell.m_sWid = 765;
            GameShell.m_sHei = 503;
            const marks = trackPcmMarks();
            for (let n = 0; n < commands.length; n++) {
                marks.count = 0;
                const [cmd, arg, suppress, probe] = commands[n].split(' ');
                let result = 'ok';
                try {
                    if (cmd === 'start') {
                        Client.gameState = Number(arg);
                        Client.out = new SuperPacket(5000);
                        Client.loginout = new SuperPacket(5000);
                        Protocol.inPacket = new SuperPacket(5000);
                        Protocol.packetSize = 0;
                        Protocol.packetType = 0;
                        Preferences.sent = false; // The Java fixture clears qc.W before every trace.
                        stream = new Stream();
                        Client.stream = null;
                        clientErrorHost.username = 0n;
                        Login.serverKey = 0n;
                        hookProbe = probe ?? '';
                        calls = 0;
                        installSocketHost(
                            () => {
                                task = Promise.withResolvers<Stream>();
                                return task.promise;
                            },
                            1,
                            {
                                call(name: string) {
                                    if (name === hookProbe) calls++;
                                }
                            }
                        );
                        Client.advertSuppressed = suppress === '1';
                        app = startLogin(arg === '40');
                    } else if (cmd === 'parameters') {
                        Client.settings = arg === 'none' ? null : fromJsString('late');
                        GameShell.m_sWid = 991;
                        GameShell.m_sHei = -331;
                        Client.affiliateId = -45678;
                        Preferences.currentAntiAliasingMode = 7;
                        Client.verifyId = 65534;
                        Client.advertSuppressed = true;
                    } else if (cmd === 'ready') {
                        task.resolve(stream);
                        await settleSignlink();
                    } else if (cmd === 'refused') {
                        task.reject(new SocketIoError());
                        await settleSignlink();
                    } else if (cmd === 'continue') Login.continueLogin();
                    else if (cmd === 'abortReset') {
                        abortReset = true;
                        Client.mouseTracking = null;
                    } else if (cmd === 'restoreRecorder') {
                        abortReset = false;
                        Client.mouseTracking = new MouseTracking();
                    } else if (cmd === 'resume') {
                        Client.ReconnectDone();
                    } else if (cmd === 'port') Client.currentPort = +arg;
                    else if (cmd === 'ticks') Login.loops = +arg;
                    else if (cmd === 'break') stream.broken = true;
                    else if (cmd === 'tick') {
                        if (arg) stream.data.push(...Buffer.from(arg, 'hex'));
                        mathRandom.setSeed(530n);
                        if ((!heldSuccess || abortReset) && Client.loginStep === 9 && !stream.broken && stream.data.length >= Protocol.packetSize) {
                            const previousCentre = Client.mapBuildCentreZoneX;
                            const reached = Promise.withResolvers<void>(),
                                resume = Promise.withResolvers<void>();
                            const reset = Client.resetGame;
                            const hook = spyOn(Client, 'resetGame').mockImplementationOnce(() => {
                                reached.resolve();
                                return resume.promise.then(() => reset());
                            });
                            try {
                                const polling = app.LoginPoll();
                                await Promise.race([
                                    reached.promise,
                                    polling.then(() => {
                                        throw Error('Stage 9 missed tj.a');
                                    })
                                ]);
                                const snapshot = [Client.loginStep, Login.reply, Protocol.inPacket.m_pos, Client.mapBuildCentreZoneX === previousCentre, app['pendingLoginSession'] === null].map(String);
                                const row = expected[n].split(';');
                                waits.push({ observed: snapshot, expected: [row[1], row[4], '0', 'true', 'true'] });
                                resume.resolve();
                                if (!abortReset) heldSuccess = true;
                                await polling;
                            } finally {
                                resume.resolve();
                                hook.mockRestore();
                            }
                        } else await app.LoginPoll();
                        await settleSignlink();
                    }
                } catch {
                    result = 'runtime';
                }
                const values: (string | number | boolean | bigint)[] = [
                    result,
                    Client.loginStep,
                    Login.loops,
                    Client.loginRetryCount,
                    Login.reply,
                    Login.hopTime,
                    Login.disallowResult,
                    clientErrorHost.username,
                    Login.serverKey,
                    Protocol.packetType,
                    Protocol.packetSize,
                    Preferences.sent,
                    Client.currentPort,
                    +(Client.stream !== null),
                    hex(Client.out),
                    hex(Client.loginout),
                    Protocol.inPacket.m_pos
                ];
                if (Client.loginStep === 9) {
                    values.push(Client.staffModLevel, Client.blackmarks, Client.underage, Client.parentalChatConsent, Client.parentalAdvertConsent, Client.mapQuickChat, Client.mouseTracked, Client.localPid, Client.playerMember, Client.members);
                    values.push(LocType.members, ObjType.m_memServer);
                    if (hookProbe) values.push(calls);
                }
                const rebuild = app['pendingLoginSession']?.rebuild;
                if (rebuild) {
                    const array = (items: (number | string)[]) => '[' + items.join(', ') + ']';
                    expect(Client.gameState).toBe(25);
                    const player = requireNonNull(Client.localPlayer);
                    values.push(
                        Client.mapBuildCentreZoneX,
                        Client.mapBuildCentreZoneZ,
                        Client.mapBuildBaseX,
                        Client.mapBuildBaseZ,
                        Client.playerLevel,
                        player.pathX[0],
                        player.pathZ[0],
                        array([...requireNonNull(Client.mapBuildIndex)]),
                        array([...requireNonNull(Client.mapBuildGroundFile)]),
                        array(requireNonNull(Client.mapBuildKeys).map(key => array([...key])))
                    );
                    values.push(OrbitCamera.followOffsetX, OrbitCamera.yawOffset, OrbitCamera.followYaw, OrbitCamera.minimapZoom, OrbitCamera.followOffsetZ, OrbitCamera.minimapAngle);
                }
                values.push(marks.count);
                expect(values.join(';'), commands[n] + ' at ' + n).toBe(expected[n]);
            }
            expect(waits).toHaveLength(2);
            for (const wait of waits) expect(wait.observed).toEqual(wait.expected);
        } finally {
            Preferences.sent = previousSent;
            draw.mockRestore();
            Client.gameState = previousState;
            Client.js5NetQueue = previousNet;
            Client.playerLevel = previousLevel;
            Client.mouseTracking = previousRecorder;
            mathRandom['seed'] = oldSeed;
            Client.rsaExponent = previousExponent;
        }
    },
    30000
);

loginFixture(import.meta.url, 'closing during socket setup or the blocking pre-login read releases the peer without advancing the login', async () => {
    for (const acquired of [false, true]) {
        const sent = Promise.withResolvers<void>(),
            closed = Promise.withResolvers<void>();
        const server = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch(req, srv) {
                if (!srv.upgrade(req, { headers: { 'Sec-WebSocket-Protocol': 'binary' } })) return new Response(null, { status: 400 });
            },
            websocket: {
                message() {
                    sent.resolve();
                },
                close() {
                    closed.resolve();
                }
            }
        });
        try {
            const opening = Promise.withResolvers<void>();
            const connected = Promise.withResolvers<void>();
            installRawHost(async () => {
                const handle = await openBrowserSocketHandle(requireNonNull(server.hostname), Number(server.port));
                connected.resolve();
                await opening.promise;
                return handle;
            });
            const app = startLogin();
            await app.LoginPoll();
            await connected.promise;
            let closing: void | Promise<void> = undefined;
            if (!acquired) closing = app['login'].close();
            opening.resolve();
            await settleSignlink();
            const pending = app.LoginPoll();
            if (acquired) {
                await sent.promise;
                closing = app['login'].close();
            }
            await Promise.all([pending, closing, closed.promise]);
            expect([Login.active, Login.reply, app['pendingLoginSession']]).toEqual([false, -3, null]);
        } finally {
            void server.stop(true);
        }
    }
});

loginFixture(
    import.meta.url,
    'account creation, name suggestions and auto-world login use the same CS2, wire and retry states as Java',
    async () => {
        const source = fileURLToPath(new URL('./login/LoginStagesOracle.java', import.meta.url));
        const info = 'script 0:31,0:12,0:1988,0:153,5603 0 0';
        const name = 'script 3:Another_Name,5604 0 0';
        const create = 'script 3:Pilot,3:pass,0:31,0:12,0:1988,0:153,5605 0 0';
        const auto = 'script 3:Pilot,3:pass,0:4,5600 0 0';
        const commands: string[] = [];
        const getName = 'script 5015 0 1';
        commands.push(
            'reset 1',
            'player null',
            getName,
            'submit ~ Abc 7',
            getName,
            'submit Beta ~ 8',
            getName,
            'submit _ ~ 9',
            getName,
            'script 3:Rejected,3:,0:10,5600 0 0',
            getName,
            'submit Pilot pass 12',
            'reset 1',
            getName,
            'player unnamed',
            getName,
            'player Walker',
            getName,
            'player null',
            getName
        );
        for (const state of [0, 5, 20, 25, 28, 30, 40, 1000]) commands.push('reset 1', 'state ' + state, info, name, create, auto);
        for (const command of [info, name, create]) {
            commands.push('reset 1', command, 'reopen', 'script 5606,5609 1 0', 'tick', 'ready', 'reopen', 'tick 15', 'tick 02', 'reopen', 'tick 0000000000000001', 'tick 0000000001d0c640', 'reopen', 'script 5610 0 5', 'script 5609,5606,5609 2 0');
        }
        for (const response of [0, 1, 2, 7, 15, 21, 29, 37, 255]) {
            commands.push('reset 1', name, 'tick', 'ready', 'tick ' + response.toString(16).padStart(2, '0'));
            if (response === 21) commands.push('tick 00', 'script 5610 0 5');
        }
        commands.push('reset 1', info, 'ports 60001', 'tick', 'refused', 'tick', 'tick', 'refused', 'tick');
        commands.push('reset 1', name, 'tick', 'ready', 'tick 15', 'ctime', 'tick', 'ready', 'tick 15', 'ctime', 'tick');
        for (const response of [0, 1, 2, 6, 7, 15, 29, 101, 255]) {
            commands.push('reset -1', auto, 'tick', 'ready', 'tick ' + response.toString(16).padStart(2, '0'));
            if (response === 101) commands.push('tick 00', 'tick 96');
        }
        commands.push('reset -1', auto, 'tick', 'ready', 'tick 65', 'tick 01', 'tick 2d', 'ready', 'tick 03', 'script 5602,5607 1 0');
        commands.push('reset -1', auto, 'ports 60001', 'tick', 'refused', 'tick', 'tick', 'refused', 'tick');
        commands.push('reset -1', auto, 'tick', 'ready', 'tick 65', 'wtime', 'tick', 'ready', 'tick 65', 'wtime', 'tick');
        const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-cp', gamepackPath, source, 'account'], { stdin: Buffer.from(commands.join('\n') + '\n'), timeout: 20000 });
        expect(oracle.stderr.toString()).toBe('');
        expect(oracle.exitCode).toBe(0);
        const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(commands.length);
        localAssets(cachePath, [3]);
        const previousState = Client.gameState;
        const oldSeed = mathRandom['seed'],
            oldExponent = Client.rsaExponent;
        Client.rsaExponent = 1n;
        try {
            let stream = new Stream(),
                task = Promise.withResolvers<Stream>();
            const open = () => {
                task = Promise.withResolvers<Stream>();
                return task.promise;
            };
            installSocketHost(open);
            let app = new Client();
            let runner = new ScriptRunner(ClientScript.Get, () => {});
            const marks = trackPcmMarks();
            for (let i = 0; i < commands.length; i++) {
                marks.count = 0;
                mathRandom.setSeed(530n);
                const [command, arg, intCount, stringCount] = commands[i].split(' ');
                let result = 'ok';
                if (command === 'reset') {
                    Client.gameState = 10;
                    Login.worldLookupStep = Login.worldLookupErrors = Client.loginConnectCycles = Client.loginStep = 0;
                    Login.reply = -2;
                    AccountCreation.step = Login.createRetryCount = Client.accountConnectCycles = 0;
                    AccountCreation.reply = -2;
                    Login.suggestedNames = null;
                    Client.out = new SuperPacket(5000);
                    Client.loginout = new SuperPacket(5000);
                    Protocol.inPacket = new SuperPacket(5000);
                    Protocol.packetSize = 0;
                    Client.stream = null;
                    app = new Client();
                    const world = new GameWorld();
                    world.id = 301;
                    world.host = fromJsString('world301');
                    WorldList.worlds = [world];
                    GameWorld.minId = GameWorld.maxId = 301;
                    WorldList.loaded = true;
                    WorldList.fetchStep = 0;
                    installSocketHost(open, +arg);
                    Client.primaryPort = Client.currentPort = Client.worldListPrimaryPort = Client.worldListPort = 40001;
                    Client.secondaryPort = Client.worldListSecondaryPort = 50001;
                    runner = new ScriptRunner(ClientScript.Get, () => {});
                    stream = new Stream();
                } else if (command === 'reopen') {
                    runner = new ScriptRunner(ClientScript.Get, () => {});
                } else if (command === 'script') {
                    const instructions = arg.split(',');
                    const code = new ClientScript();
                    code.opcodes = new Int32Array(instructions.length + 1);
                    code.intOperands = new Int32Array(code.opcodes.length);
                    code.stringOperands = new Array(code.opcodes.length).fill(null);
                    for (const [pc, part] of instructions.entries()) {
                        const [op, operand] = part.split(':');
                        code.opcodes[pc] = Number(op);
                        if (op === '0') code.intOperands[pc] = Number(operand);
                        if (op === '3') code.stringOperands[pc] = fromJsString(operand);
                    }
                    code.opcodes[instructions.length] = 21;
                    const scriptId = 71000 + i;
                    ClientScript.m_cache.Put(BigInt(scriptId), code);
                    const event = new HookReq();
                    event.args = [scriptId];
                    await runner.ExecuteScript(event, 1000);
                    const output: (string | number)[] = [...ScriptRunner.intStack.slice(0, +intCount)];
                    for (let j = 0; j < +stringCount; j++) {
                        const value = ScriptRunner.stringStack[j];
                        output.push(value === null ? '~' : Buffer.from(value.toBytes()).toString('hex'));
                    }
                    result = output.join(',');
                } else if (command === 'submit') {
                    const value = (s: string) => (s === '~' ? null : fromJsString(s === '_' ? '' : s));
                    try {
                        Login.requestLogin(value(arg), value(intCount), +stringCount, 0);
                    } catch {
                        result = 'runtime';
                    }
                } else if (command === 'player') {
                    const self = (Client.localPlayer = arg === 'null' ? null : new ClientPlayer());
                    if (self !== null && arg !== 'unnamed') {
                        self.username = fromJsString(arg);
                        ClientPlayer.titlePrefixes = [fromJsString('Sir_')];
                        ClientPlayer.nameSuffixes = [fromJsString('_III')];
                    }
                } else if (command === 'ready') {
                    task.resolve(stream);
                    await settleSignlink();
                } else if (command === 'refused') {
                    task.reject(new SocketIoError());
                    await settleSignlink();
                } else if (command === 'ports') Client.currentPort = Client.worldListPort = +arg;
                else if (command === 'ctime') Client.accountConnectCycles = 2000;
                else if (command === 'state') Client.gameState = +arg;
                else if (command === 'wtime') Client.loginConnectCycles = 1500;
                else if (command === 'tick') {
                    if (arg) stream.data.push(...Buffer.from(arg, 'hex'));
                    await AccountCreation.loop();
                    await app['login'].selectLoginWorld();
                    await app.LoginPoll();
                    await settleSignlink();
                }
                const values = [
                    result,
                    AccountCreation.step,
                    Login.createRetryCount,
                    Client.accountConnectCycles,
                    AccountCreation.reply,
                    Login.worldLookupStep,
                    Login.worldLookupErrors,
                    Client.loginConnectCycles,
                    Client.loginStep,
                    Login.reply,
                    Client.selectedWorldId,
                    Client.currentPort,
                    Client.worldListPort,
                    +(Client.stream !== null),
                    hex(Client.out),
                    Protocol.inPacket.m_pos,
                    Login.suggestedNames?.map(s => (s === null ? '~' : Buffer.from(s.toBytes()).toString('hex'))).join(',') ?? '~',
                    ...[Client.username, Client.password].map(s => (s === null ? '~' : Buffer.from(s.toBytes()).toString('hex'))),
                    Login.loginType,
                    marks.count
                ];
                expect(values.join(';'), commands[i] + ' at ' + i).toBe(expected[i]);
            }
        } finally {
            Client.gameState = previousState;
            mathRandom['seed'] = oldSeed;
            Client.rsaExponent = oldExponent;
        }
    },
    30000
);
