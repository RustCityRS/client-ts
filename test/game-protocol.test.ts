import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import TitleScreen from '#/title/TitleScreen.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { freshGame } from './actor-fixture.js';
import Login from '#/io/Login.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import Protocol from '#/io/Protocol.js';
import MidiManager from '#/sound/MidiManager.js';
import MidiPlayer from '#/sound/MidiPlayer.js';
import Preferences from '#/ui/Preferences.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import Client from '#/client/Client.js';
import Js5 from '#/cache/Js5.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { emptyTextureCache } from './texture-cache-fixture.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import { expect, spyOn, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, delimiter, resolve } from 'node:path';
import GameShell from '#/client/GameShell.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import MouseTracking from '#/client/MouseTracking.js';
import SuperPacket from '#/io/SuperPacket.js';
import { SocketIoError } from '#/io/SocketPlatform.js';
import { JavaError } from '#/util/ClientError.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

test('rg packet cursors and history, t.c queued output and ph forced flushes match the running gamepack', async () => {
    const savedIncoming = Protocol.inPacket,
        savedSize = Protocol.packetSize;
    const savedBaseX = Client.mapBuildBaseX,
        savedBaseZ = Client.mapBuildBaseZ;
    const savedLogin = [Login.reply, Login.disallowResult, Login.loops, Login.hopTime, Client.loginStep, Client.loginRetryCount];
    const savedSocketError = Client.socketError,
        savedNoTimeout = Client.m_ticksSinceNoTimeOutPacket;
    Client.m_ticksSinceNoTimeOutPacket = 0;
    const beforeVerify = Client.verifyId,
        beforeAck = Protocol.sequenceAckPending;
    const oldUrl = Client.openUrlRequest,
        oldAddress = Client.pendingUrl,
        oldWindow = Client.urlNewWindow;
    const oldDrift = [OrbitCamera['driftTicks'], OrbitCamera['minimapTicks']];
    const oldSong = [Client.midiSong, MidiManager.status, Preferences.musicVolume];
    const oldJingle = Client.jingleActive,
        oldStream = MidiManager['stream'];
    const oldCycle = [Client.transmitCycle, InterfaceList.miscTransmitAt, Client.rebootTimer];
    const archiveFields = ['animFramesArchive', 'basesArchive', 'interfacesArchive', 'm_pJagFx', 'mapsArchive', 'm_pMidi', 'modelsArchive', 'm_pSprites', 'binaryArchive', 'jingleArchive'] as const;
    const beforeArchives = archiveFields.map(key => Client[key]);
    const beforeScripts = Client.m_pClientScripts,
        beforeMaps = CollisionMap.levelMaps.slice();
    const empty = new Js5({ index: () => null, group: () => null, prefetchGroup() {}, GetGroupLoadPercentage: () => 0 }, false, false);
    const previousTextures = Pix3D.textureProvider;
    Pix3D.setTextures(emptyTextureCache(empty));
    for (const key of archiveFields) Client[key] = empty;
    Client.m_pClientScripts = empty;
    for (let level = 0; level < 4; level++) CollisionMap.levelMaps[level] = new CollisionMap(104, 104);
    const beforeZone = [Protocol.zoneUpdateX, Protocol.zoneBaseZ];
    const stateBefore = Client.gameState,
        cycleBefore = Client.loopCycle;
    const focusBefore = GameShell.m_focus,
        sentFocusBefore = Client.lastSentFocus;
    const mouseState = {
        mouseTracking: Client.mouseTracking,
        mouseTracked: Client.mouseTracked,
        mouseTrackedX: Client.mouseTrackedX,
        mouseTrackedY: Client.mouseTrackedY,
        mouseRepeatCount: Client.mouseRepeatCount,
        prevMouseClickTime: Client.prevMouseClickTime
    };
    const clickState = { clickButton: ClientMouseListener.clickButton, clickX: ClientMouseListener.clickX, clickY: ClientMouseListener.clickY, clickTime: ClientMouseListener.clickTime };
    const recorder = new MouseTracking();
    const pendingCamera = OrbitCamera['reportPending'],
        reportDelay = OrbitCamera['reportDelay'];
    const previousSocket = Protocol.oldSocket;
    const oldNet = Client.js5NetQueue,
        titleBefore = { ...TitleScreen };
    const outgoing = new SuperPacket(5000),
        incoming = new SuperPacket(5000),
        encoder = new SuperPacket(5000);
    Protocol.inPacket = incoming;
    Protocol.packetSize = 0;
    Client.mapBuildBaseX = Client.mapBuildBaseZ = 0;
    const seed = Int32Array.of(1, 2, 3, 4);
    for (const p of [outgoing, incoming, encoder]) p.SetEnc(seed);
    const data: number[] = [],
        wire: number[] = [];
    let pos = 0,
        visible = 0,
        polls = 0,
        fail = false;
    let replaceOnRead = false,
        detachOnRead = false,
        ioFailure = false,
        assertionFailure = false;
    const stream = {
        GetAvailable() {
            polls++;
            if (ioFailure) {
                ioFailure = false;
                throw new SocketIoError('receive');
            }
            if (assertionFailure) {
                assertionFailure = false;
                throw new JavaError('receive');
            }
            return visible;
        },
        async read() {
            throw Error('rg uses the block reader, including for opcodes');
        },
        async Read(dst: Uint8Array | null, offset: number, size: number) {
            if (size > visible) throw new SocketIoError();
            if (size > 0) requireNonNull(dst).set(data.slice(pos, pos + size), offset);
            pos += size;
            visible -= size;
            if (replaceOnRead) {
                replaceOnRead = false;
                const packet = new SuperPacket(5000);
                packet['m_pIsaac'] = Protocol.inPacket['m_pIsaac'];
                requireNonNull(packet.m_data).fill(5, 0, 24);
                packet.m_pos = 19;
                Protocol.inPacket = packet;
            }
            if (detachOnRead) {
                detachOnRead = false;
                Client.stream = null;
            }
        },
        Write(offset: number, src: Uint8Array | null, size: number) {
            if (fail) {
                fail = false;
                throw new SocketIoError();
            }
            wire.push(...requireNonNull(src).subarray(offset, offset + size));
        },
        Close() {}
    };
    const oldClient = Client.activeClient,
        oldConnection = Client.stream;
    const oldReservedSize = Protocol.serverPacketSizes[1],
        oldDestination = Client.destinationX;
    const history = [Protocol.packetType, Protocol.lastPacketType0, Protocol.ptype1, Protocol.ptype2, Protocol.idleReads];
    Protocol.packetType = Protocol.lastPacketType0 = Protocol.ptype1 = Protocol.ptype2 = -1;
    Protocol.idleReads = 0;
    Client.stream = stream;
    const game = freshGame({ outgoing, account: null, rebuild: null });
    const app: Client = Object.create(Client.prototype);
    app.game = game;
    Client.activeClient = app;
    const savedIdle = [ClientMouseListener.idleCycles, ClientKeyboardListener.idleCycles];
    const tracking = ['samples 1 1', 'tick', 'track true', 'samples 2 2', 'tick', 'click 1 1 2 50', 'tick', 'samples -1 -1 -32 -32 65535 -1 2147483647 -2147483648', 'tick', 'click 2 70000 -8 8000000000000', 'tick'];
    for (const repetitions of [7, 8, 31, 32, 497, 500, 500, 500, 500]) {
        tracking.push('samples' + ' 0 0'.repeat(repetitions), 'tick');
        if (repetitions < 40) tracking.push('samples 31 31 63 63 32 32 -1 -1 70000 70000', 'tick');
    }
    tracking.push('samples -1 -1', 'tick', 'click 0 0 0 0', 'samples' + ' 65535 0 -1 -1'.repeat(250), ...Array(10).fill('tick'), 'click 2 99999 65536 -9223372036854775808', 'tick', 'track false', 'click 0 0 0 0');
    const commands = [
        'connect no',
        'read 0',
        'force true',
        'connect yes',
        'frame 85 0102',
        'idles 14 0',
        'read 0',
        'read 1',
        'read 0',
        'read 1',
        'read 1',
        'read 0',
        'frame 70 4100',
        'read 1',
        'read 1',
        'read 1',
        'read 1',
        'frame 22 ffffffff0001',
        'read 1',
        'read 1',
        'read 0',
        'read 1',
        'read 4',
        'read 2',
        'frame 192 02',
        'frame 131',
        'read 3',
        'read 0',
        'read 0',
        'frame 26 f0ed',
        'read 3',
        'frame 230 96c3eb363c',
        'read 8',
        'verify -2147483648',
        'verify -1',
        'tick',
        'verify 65534',
        'verify 65535',
        'verify 2147483647',
        'tick',
        'write 10 00010002',
        'write 155 ffffffff0003',
        'ack 45678',
        'idles 0 50',
        'tick',
        'focus true',
        'tick',
        'tick',
        'focus false',
        'tick',
        'state 25',
        'focus true',
        'tick',
        'state 30',
        'tick',
        ...tracking,
        'idleinput 15000 15001',
        'tick',
        'idleinput 15001 15000',
        'tick',
        'idleinput 15001 15001',
        'tick',
        'tick',
        'idleinput 14999 15001',
        'tick',
        'idleinput 15001 2147483647',
        'tick',
        'idleinput 0 0',
        'cleartimer',
        'write 93',
        'idles 0 48',
        'force false',
        'force false',
        'force true',
        'state 10',
        'write 94 8099',
        'idles 0 49',
        'force true',
        'state 25',
        'force true',
        'state 30',
        'idles 0 49',
        'tick',
        'tick',
        'connect no',
        'write 3 1234',
        'ack 65535',
        'tick',
        'connect yes',
        'tick',
        'idles 0 2147483647',
        'force false',
        'tick',
        'write 228 aabbcc',
        'fail',
        'force true',
        'force true',
        'tick',
        'state 30',
        'connect yes',
        'write 53 000000020000',
        'fail',
        'tick',
        'state 30',
        'connect yes',
        'idles 750 0',
        'seedorder',
        'tick',
        'order',
        'restart',
        'idles 0 0',
        'tick',
        'order',
        'restart',
        'frame 70 4100',
        'read 1',
        'replace',
        'read 1',
        'raw 010203',
        'read 5',
        'frame 22',
        'read 1',
        'detach',
        'check 2',
        'restart',
        'read 0',
        'assert',
        'check 0',
        'io',
        'check 0',
        'restart',
        'empty-null',
        'frame 32 01',
        'check 4',
        'restart',
        'size 1 2',
        'frame 1 ff80',
        'check 3'
    ];
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const dir = mkdtempSync(join(out, 'game-protocol-'));
    const log = spyOn(console, 'log').mockImplementation(() => {});
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'GameProtocolOracle.java')]);
        if (compile.exitCode) throw Error(compile.stderr.toString());
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'GameProtocolOracle'], { stdin: Buffer.from(commands.join('\n') + '\n'), timeout: 10000 });
        if (java.exitCode) throw Error(java.stdout.toString() + '\n' + java.stderr.toString());
        const rows = java.stdout.toString().trimEnd().split(/\r?\n/),
            expected = rows.filter(line => !line.startsWith('Error:'));
        const diagnostic = (line: string) => ({
            dispatch: Array.from(line.matchAll(/(?:qd\.A\(64\)|rg\.D\(57\))/g), match => match[0]),
            packet: line.substring(line.search(/T[12] - /))
        });
        const errors = rows.filter(line => line.startsWith('Error:')).map(diagnostic);
        expect(errors.length).toBe(3);
        expect(errors.some(error => error.dispatch.includes('rg.D(57)'))).toBe(true);
        expect(expected.length).toBe(commands.length);
        Client.loopCycle = 1; // client.a increments hh.kb before calling t.c.
        game.actors.self.x = game.actors.self.z = 4096;
        Client.gameState = 30;
        MinimapBuilder.minimapLevel = Client.playerLevel;
        Protocol.oldSocket = null;
        GameShell.m_focus = false;
        Client.lastSentFocus = false; // after the oracle's warm-up t.c
        OrbitCamera['reportPending'] = false;
        OrbitCamera['reportDelay'] = 20;
        Object.assign(Client, { mouseTracking: recorder, mouseTracked: false, mouseTrackedX: 0, mouseTrackedY: 0, mouseRepeatCount: 0, prevMouseClickTime: 0n });
        ClientMouseListener.clickButton = 0;
        ClientKeyboardListener.idleCycles = ClientMouseListener.idleCycles = 0;
        Client.js5NetQueue = new Js5NetQueue();
        TitleScreen.m_open = false;
        Client.verifyId = 0;
        Protocol.sequenceAckPending = false;
        Protocol.zoneUpdateX = Protocol.zoneBaseZ = 0;
        for (let i = 0; i < commands.length; i++) {
            const [op, a, b] = commands[i].split(' ');
            let result = '';
            switch (op) {
                case 'empty-null': {
                    const before = Protocol.inPacket.m_data;
                    Protocol.inPacket.m_data = null;
                    visible++;
                    Client.destinationX = 17;
                    Protocol.packetType = 153;
                    Protocol.packetSize = 0;
                    try {
                        result = (await Protocol.TcpIn()) + ',' + Client.destinationX;
                    } finally {
                        Protocol.inPacket.m_data = before;
                        visible--;
                    }
                    break;
                }
                case 'size':
                    Protocol.serverPacketSizes[+a] = +b;
                    break;
                case 'replace':
                    replaceOnRead = true;
                    break;
                case 'detach':
                    detachOnRead = true;
                    break;
                case 'raw':
                    data.push(...Buffer.from(a, 'hex'));
                    break;
                case 'io':
                    ioFailure = true;
                    break;
                case 'assert':
                    assertionFailure = true;
                    break;
                case 'cleartimer':
                    game.logoutTimer = 0;
                    break;
                case 'idleinput':
                    ClientMouseListener.idleCycles = Number(a);
                    ClientKeyboardListener.idleCycles = Number(b);
                    break;
                case 'connect':
                    Client.stream = a === 'yes' ? stream : null;
                    break;
                case 'frame': {
                    const body = Buffer.from(b ?? '', 'hex'),
                        opcode = +a;
                    encoder.m_pos = 0;
                    encoder.pHead(opcode);
                    data.push(requireNonNull(encoder.m_data)[0]);
                    if (Protocol.serverPacketSizes[opcode] === -2) data.push(body.length >>> 8);
                    if (Protocol.serverPacketSizes[opcode] < 0) data.push(body.length & 255);
                    data.push(...body);
                    break;
                }
                case 'read':
                    visible += +a;
                    result = String(await Protocol.TcpIn());
                    break;
                case 'check':
                    visible += +a;
                    try {
                        result = String(await Protocol.tryReadPacket());
                    } catch (error) {
                        if (!(error instanceof JavaError) || error.message !== 'receive') throw error;
                        result = 'error';
                    }
                    break;
                case 'restart':
                    Protocol.packetType = -1;
                    game.loggedOut = false;
                    Client.gameState = 30;
                    MinimapBuilder.minimapLevel = Client.playerLevel;
                    Protocol.oldSocket = null;
                    Client.stream = stream;
                    break;
                case 'idles':
                    Protocol.idleReads = +a;
                    Client.m_ticksSinceNoTimeOutPacket = +b;
                    break;
                case 'seedorder': {
                    const request = (Client.openUrlRequest = new SignlinkRequest());
                    request.status = 1;
                    request.result = {};
                    Client.pendingUrl = null;
                    Client.urlNewWindow = true;
                    OrbitCamera['driftTicks'] = 321;
                    OrbitCamera['minimapTicks'] = 411;
                    MidiManager.status = 0;
                    MidiManager['stream'] = new MidiPlayer();
                    Client.midiSong = 117;
                    Preferences.musicVolume = 255;
                    Client.jingleActive = false;
                    Client.transmitCycle = 42;
                    Client.rebootTimer = 2;
                    InterfaceList.miscTransmitAt = 987;
                    break;
                }
                case 'order':
                    result = [
                        Client.openUrlRequest === null,
                        Client.urlNewWindow,
                        OrbitCamera['driftTicks'],
                        OrbitCamera['minimapTicks'],
                        Client.midiSong,
                        InterfaceList.miscTransmitAt,
                        Client.rebootTimer,
                        Buffer.from(requireNonNull(outgoing.m_data).subarray(0, outgoing.m_pos)).toString('hex')
                    ].join(',');
                    break;
                case 'write':
                    game.write(+a, Buffer.from(b ?? '', 'hex'));
                    break;
                case 'ack':
                    Protocol.sequenceAckPending = true;
                    Client.verifyId = +a;
                    break;
                case 'verify':
                    result = String(Protocol.setVerifyId(+a));
                    break;
                case 'state':
                    Client.gameState = +a;
                    break;
                case 'focus':
                    GameShell.m_focus = a === 'true';
                    break;
                case 'track':
                    Client.mouseTracked = a === 'true';
                    break;
                case 'samples': {
                    const coords = commands[i].split(' ').slice(1).map(Number);
                    for (let k = 0; k < coords.length; k += 2) {
                        requireNonNull(recorder.samplesX)[recorder.count] = coords[k];
                        requireNonNull(recorder.samplesY)[recorder.count++] = coords[k + 1];
                    }
                    break;
                }
                case 'click': {
                    const [, button, x, y, time] = commands[i].split(' ');
                    ClientMouseListener.clickButton = +button;
                    ClientMouseListener.clickX = +x;
                    ClientMouseListener.clickY = +y;
                    ClientMouseListener.clickTime = BigInt(time);
                    break;
                }
                case 'force':
                    Client.PreventTimeout(a === 'true');
                    break;
                case 'fail':
                    fail = true;
                    break;
                case 'tick':
                    await app.GameLoop();
                    break;
            }
            const snapshot = [
                result,
                Protocol.packetType,
                Protocol.packetSize,
                Protocol.lastPacketType0,
                Protocol.ptype1,
                Protocol.ptype2,
                Protocol.idleReads,
                Client.m_ticksSinceNoTimeOutPacket,
                Client.socketError,
                Protocol.inPacket.m_pos,
                Buffer.from(requireNonNull(Protocol.inPacket.m_data).subarray(0, 24)).toString('hex'),
                pos,
                polls,
                Buffer.from(requireNonNull(outgoing.m_data).subarray(0, outgoing.m_pos)).toString('hex'),
                Buffer.from(wire.splice(0)).toString('hex'),
                Client.gameState,
                Client.stream !== null,
                Protocol.sequenceAckPending,
                Client.verifyId,
                Protocol.zoneUpdateX,
                Protocol.zoneBaseZ,
                Client.lastSentFocus,
                recorder.count,
                requireNonNull(recorder.samplesX).reduce((h, v) => (Math.imul(31, h) + v) | 0, 1),
                requireNonNull(recorder.samplesY).reduce((h, v) => (Math.imul(31, h) + v) | 0, 1),
                Client.mouseTrackedX,
                Client.mouseTrackedY,
                Client.mouseRepeatCount,
                Client.prevMouseClickTime,
                ClientMouseListener.idleCycles,
                ClientKeyboardListener.idleCycles,
                game.logoutTimer
            ].join(';');
            expect(snapshot, commands[i]).toBe(expected[i]);
        }
        expect(log.mock.calls.map(call => diagnostic(String(call[0])))).toEqual(errors);
    } finally {
        Client.activeClient = oldClient;
        Client.stream = oldConnection;
        Protocol.serverPacketSizes[1] = oldReservedSize;
        Client.destinationX = oldDestination;
        [Protocol.packetType, Protocol.lastPacketType0, Protocol.ptype1, Protocol.ptype2, Protocol.idleReads] = history;
        Protocol.inPacket = savedIncoming;
        Protocol.packetSize = savedSize;
        Client.mapBuildBaseX = savedBaseX;
        Client.mapBuildBaseZ = savedBaseZ;
        Client.openUrlRequest = oldUrl;
        Client.pendingUrl = oldAddress;
        Client.urlNewWindow = oldWindow;
        [OrbitCamera['driftTicks'], OrbitCamera['minimapTicks']] = oldDrift;
        [Client.midiSong, MidiManager.status, Preferences.musicVolume] = oldSong;
        Client.jingleActive = oldJingle;
        MidiManager['stream'] = oldStream;
        [Client.transmitCycle, InterfaceList.miscTransmitAt, Client.rebootTimer] = oldCycle;
        archiveFields.forEach((key, i) => {
            Client[key] = beforeArchives[i];
        });
        Client.m_pClientScripts = beforeScripts;
        Pix3D.setTextures(previousTextures);
        beforeMaps.forEach((map, i) => {
            CollisionMap.levelMaps[i] = map;
        });
        [Login.reply, Login.disallowResult, Login.loops, Login.hopTime, Client.loginStep, Client.loginRetryCount] = savedLogin;
        Client.socketError = savedSocketError;
        Client.m_ticksSinceNoTimeOutPacket = savedNoTimeout;
        Client.verifyId = beforeVerify;
        Protocol.sequenceAckPending = beforeAck;
        [Protocol.zoneUpdateX, Protocol.zoneBaseZ] = beforeZone;
        log.mockRestore();
        Client.js5NetQueue = oldNet;
        Object.assign(TitleScreen, titleBefore);
        GameShell.m_focus = focusBefore;
        Client.lastSentFocus = sentFocusBefore;
        [ClientMouseListener.idleCycles, ClientKeyboardListener.idleCycles] = savedIdle;
        Object.assign(Client, mouseState);
        Object.assign(ClientMouseListener, clickState);
        OrbitCamera['reportPending'] = pendingCamera;
        OrbitCamera['reportDelay'] = reportDelay;
        Client.loopCycle = cycleBefore;
        Client.gameState = stateBefore;
        Protocol.oldSocket = previousSocket;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
