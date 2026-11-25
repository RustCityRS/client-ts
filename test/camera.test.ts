import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import ProtocolInput from './protocol-input.js';
import Protocol from '#/io/Protocol.js';
import world from '#/dash3d/world.js';
import ClientBuild from '#/client/ClientBuild.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Keyboard from '#/client/ClientKeyboardListener.js';
import MouseTracking from '#/client/MouseTracking.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import { freshGame } from './actor-fixture.js';
import { loginFixture } from './login-fixture.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import Orbit from '#/client/OrbitCamera.js';
import Cut from '#/client/CinematicCamera.js';
import SuperPacket from '#/io/SuperPacket.js';
import Preferences from '#/ui/Preferences.js';
import { intQuery } from './int-query.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const fold = (h: number, n: number) => (Math.imul(31, h) + n) | 0;
const hash = (a: ArrayLike<number>) => Array.from(a).reduce(fold, 1);
const floatbits = (n: number) => new Int32Array(Float32Array.of(n).buffer)[0];

test('530 orbit, cinematic ease, spline float bits, camera packets and CS2 instructions match the gamepack', async () => {
    const inputStream = new ProtocolInput();
    const dir = mkdtempSync(join(tmpdir(), 'camera530-')),
        so = Object.getOwnPropertyDescriptors(Orbit),
        sc = Object.getOwnPropertyDescriptors(Cut),
        pref = Preferences.steppedCameraKeys;
    const savedHeights = world.levelHeightmaps,
        savedFlags = ClientBuild.m_mapl,
        savedClearance = world.tileCameraClearance;
    const savedBaseX = Client.mapBuildBaseX,
        savedBaseZ = Client.mapBuildBaseZ,
        savedLevel = Client.playerLevel;
    const previousPlayer = Client.localPlayer,
        oldCount = Keyboard.count,
        oldPressed = Keyboard.pressed.slice(),
        oldCodes = Keyboard.codes.slice();
    const self = (Client.localPlayer = new ClientPlayer());
    const oldVerify = Client.verifyId,
        oldAck = Protocol.sequenceAckPending;
    const arrays = [Orbit.shakeRandom, Orbit.shakeAmplitude, Orbit.shakeFrequency, Orbit.shakePhase],
        saved = arrays.map(a => a.slice()),
        savedShake = Orbit.shake.slice(),
        paths = Cut.paths.slice();
    try {
        localAssets(cachePath, [2, 3]);
        Client.verifyId = 0;
        Protocol.sequenceAckPending = false;
        Client.mapBuildBaseX = 3040;
        Client.mapBuildBaseZ = 3056;
        Client.playerLevel = 1;
        const heights = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => -p * 240 - ((x * 3 - z * 5 + x * z * 13) & 511))));
        const flags = Array.from({ length: 4 }, () => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => ((x + z) % 7 === 0 ? 2 : 0))));
        const environment = Array.from({ length: 4 }, (_, p) => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => p * 16 + x - z)));
        world.levelHeightmaps = heights;
        ClientBuild.m_mapl = flags;
        world.tileCameraClearance = environment;
        Orbit.x = Orbit.y = Orbit.z = Orbit.pitch = Orbit.yaw = Orbit.focusX = Orbit.focusZ = Orbit['distance'] = Orbit['pitchVelocity'] = Orbit['yawVelocity'] = 0;
        Orbit.followPitch = 128;
        Orbit.followOffsetX = Orbit.followOffsetZ = Orbit.followYaw = Orbit.yawOffset = Orbit.minimapAngle = Orbit.minimapZoom = 0;
        Orbit.shake.fill(false);
        for (const a of arrays) a.fill(0);
        Cut.paths.fill(null);
        Cut.tileX = Cut.tileZ = Cut.height = Cut.step = Cut.factor = Cut.lookX = Cut.lookZ = Cut.lookHeight = Cut.lookStep = Cut.lookFactor = 0;
        Cut.positionSegment = Cut.lookSegment = Cut.progress = Cut.startRate = Cut.endRate = Cut.pitchRadians = Cut.yawRadians = 0;
        Cut.ended = Cut.justEnded = false;
        const commands: string[] = [],
            answers: string[] = [];
        const run = async (action: string, ...n: number[]) => {
            commands.push([action, ...n].join(' '));
            let result = '';
            switch (action) {
                case 'reset':
                    Orbit.reset();
                    break;
                case 'offsets':
                    [Orbit.followOffsetX, Orbit.followOffsetZ, Orbit.followYaw, Orbit.yawOffset] = n;
                    break;
                case 'follow': {
                    Preferences.steppedCameraKeys = n[0] !== 0;
                    self.x = n[1];
                    self.z = n[2];
                    Keyboard.pressed.fill(false);
                    Keyboard.count = n.length - 3;
                    Keyboard.codes.set(n.slice(3));
                    for (const code of n.slice(3)) Keyboard.pressed[code] = true;
                    Client.GlFollowCamera();
                    break;
                }
                case 'orbit':
                    Client.CamFollow(n[0], n[1], n[2], n[3], n[4], n[5]);
                    break;
                case 'tick':
                    Client.GlCinemaCamera();
                    break;
                case 'spline':
                    Cut.spline();
                    break;
                case 'splineRows': {
                    Cut.positionPath = 0;
                    Cut.lookPath = 1;
                    Cut.positionSegment = Cut.lookSegment = 0;
                    Cut.progress = n[3];
                    Cut.startRate = 271;
                    Cut.endRate = 39871;
                    Cut.ended = true;
                    Cut.justEnded = false;
                    Orbit.x = 17;
                    Orbit.y = 33;
                    Orbit.z = -19;
                    Orbit.pitch = 461;
                    Orbit.yaw = 256;
                    Cut.pitchRadians = 0.5;
                    Cut.yawRadians = -0.25;
                    for (let path = 0; path < 2; path++) {
                        Cut.paths[path] = Array.from({ length: 4 }, (_, row) => {
                            const length = path !== n[0] || row < 2 ? 3 : n[row - 1];
                            return length < 0 ? null : Int32Array.from({ length }, (_, axis) => Math.imul(0x65432109, row * 2 + 3 * path - axis * 7));
                        });
                    }
                    try {
                        Cut.spline();
                        result = 'ok';
                    } catch (caught) {
                        let e = caught;
                        while (e instanceof WrappedException && e.cause !== null) e = e.cause;
                        result = e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : String(e);
                    }
                    break;
                }
                case 'script': {
                    const outputs = n[0] === 5407 || n[0] === 5505 || n[0] === 5506;
                    const value = intQuery(n[0], n.slice(1), outputs);
                    if (outputs) result = String(value);
                    break;
                }
                case 'wire': {
                    const bytes = Uint8Array.from(n.slice(1));
                    commands[commands.length - 1] = 'wire ' + n[0] + ' ' + Buffer.from(bytes).toString('hex');
                    try {
                        result = (await inputStream.read(n[0], bytes)) ? 'ok' : 'pending';
                    } catch {
                        result = 'exception';
                    }
                    result += ' ' + Protocol.inPacket.m_pos + ',' + Protocol.packetType;
                    break;
                }
                case 'buffers': {
                    const field = (['shake', 'shakeRandom', 'shakeAmplitude', 'shakeFrequency', 'shakePhase'] as const)[n[0]];
                    Reflect.set(Orbit, field, n[0] === 0 ? new Array<boolean>(n[1]).fill(true) : new Int32Array(n[1]));
                    break;
                }
            }
            answers.push(
                result +
                    '|[' +
                    [
                        Orbit.mode,
                        Orbit.x,
                        Orbit.y,
                        Orbit.z,
                        Orbit.pitch,
                        Orbit.yaw,
                        Orbit.followPitch,
                        Orbit.followYaw,
                        Orbit.focusX,
                        Orbit.focusZ,
                        Orbit['pitchVelocity'],
                        Orbit['yawVelocity'],
                        Orbit['distance'],
                        Cut.tileX,
                        Cut.tileZ,
                        Cut.height,
                        Cut.step,
                        Cut.factor,
                        Cut.lookX,
                        Cut.lookZ,
                        Cut.lookHeight,
                        Cut.lookStep,
                        Cut.lookFactor,
                        Cut.positionPath,
                        Cut.lookPath,
                        Cut.positionSegment,
                        Cut.lookSegment,
                        Cut.progress,
                        Cut.startRate,
                        Cut.endRate,
                        +Cut.ended,
                        +Cut.justEnded,
                        floatbits(Cut.pitchRadians),
                        floatbits(Cut.yawRadians),
                        Cut.paths.reduce((h, row) => fold(h, row === null ? 0 : row.reduce((n, v) => fold(n, v === null ? 0 : hash(v)), 1)), 1),
                        hash(Orbit.shake.map(v => (v ? 1231 : 1237))),
                        ...[Orbit.shakeRandom, Orbit.shakeAmplitude, Orbit.shakeFrequency, Orbit.shakePhase].map(hash),
                        Client.verifyId
                    ].join(', ') +
                    ']'
            );
        };
        await run('reset');
        await run('offsets', -49, 53, 2046, -37);
        for (let i = 0; i < 210; i++) {
            const keys = [[], [96, 98], [97], [99], [96, 97, 98, 99], [97, 98, 98]][i % 6];
            await run('follow', +(i % 9 < 3), i < 83 ? 6554 + i * 15 : 10240 - i * 3, 4805 - i * 9, ...keys);
        }
        for (let i = 0; i < 30; i++) await run('orbit', -580, 600 + 25 * i, (i * 83) & 2047, 6116, 127 + i * 9, 8140);
        await run('wire', 154, 0x11, 0x22, 34, 64, 1, 129, 12, 101);
        await run('wire', 125, 0x33, 0x44, 55, 90, 2, 188, 4, 13);
        for (let i = 0; i < 91; i++) await run('tick');
        await run('wire', 27, 0xff, 0xff, 4, 52, 41, 79, 0xe4, 9);
        await run('wire', 187, 0x12, 0x4, 0x40, 0x11, 0x3, 0xff);
        await run('wire', 24, 0x81, 0x82);
        for (let field = 0; field < 5; field++) {
            await run('buffers', field, 3);
            await run('wire', 27, 0x45, 0x67, 3, 10 + field, 20 + field, 30 + field, 0x12, 0x34);
            if (field === 0) await run('wire', 24, 0x23, 0x45);
            await run('buffers', field, 6);
        }
        await run('wire', 24, 0x34, 0x56);
        for (const [op, packet] of [
            [154, [0, 1, 8, 9, 0, 20, 1, 70]],
            [125, [0, 1, 9, 8, 0, 20, 2, 71]],
            [187, [1, 2, 3, 4, 5, 6]],
            [27, [0, 1, 3, 19, 20, 21, 0, 22]],
            [24, [0, 1]]
        ] as const) {
            for (let length = 1; length < packet.length; length++) await run('wire', op, ...packet.slice(0, length));
        }
        await run('script', 5504, -16, 5138);
        await run('script', 5505);
        await run('script', 5506);
        const coord = (x: number, z: number) => (x << 14) | z;
        await run('script', 5500, coord(3123, 3111), 96, 9, 99);
        await run('script', 5501, coord(3119, 3109), 71, 22, 127);
        for (let i = 0; i < 55; i++) await run('tick');
        for (let p = 0; p < 2; p++) {
            await run('script', 5405, p, 4 + p);
            for (let i = 0; i < 4 + p; i++) await run('script', 5406, p, i, coord(3067 + 13 * i - 60 * p, 3088 + i * 5), 7993 - i * 370 + p * 1900, coord(3094 + i * 11, 2992 - i * 29), 2371 + i * 511, 51 - p + i);
            await run('script', 5407, p);
        }
        await run('script', 5502, 0, 0, 293, 2500, 1, 2);
        for (let i = 0; i < 105; i++) await run('spline');
        await run('script', 5503);
        for (const path of [0, 1]) {
            for (const endLength of [-1, 0, 1, 2, 3]) {
                for (const controlLength of [-1, 0, 1, 2, 3]) {
                    for (const progress of [-2147483648, -36, 0, 40193, 65535, 2147483647]) {
                        await run('splineRows', path, endLength, controlLength, progress);
                    }
                }
            }
        }
        const java = (name: string) => fileURLToPath(new URL('./game/' + name + '.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, java('ChatOracle'), java('CameraOracle')]);
        expect(build.stderr.toString()).toBe('');
        const jar = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CameraOracle'], { stdin: Buffer.from(commands.join('\n')), maxBuffer: 1024 * 1024 });
        expect(jar.stderr.toString()).toBe('');
        expect(jar.exitCode).toBe(0);
        const lines = jar.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(answers.length);
        for (let i = 0; i < answers.length; i++) expect(answers[i], commands[i]).toBe(lines[i]);
    } finally {
        inputStream.restore();
        Client.mapBuildBaseX = savedBaseX;
        Client.mapBuildBaseZ = savedBaseZ;
        Client.playerLevel = savedLevel;
        world.levelHeightmaps = savedHeights;
        ClientBuild.m_mapl = savedFlags;
        world.tileCameraClearance = savedClearance;
        Client.verifyId = oldVerify;
        Protocol.sequenceAckPending = oldAck;
        Object.defineProperties(Orbit, so);
        Object.defineProperties(Cut, sc);
        Client.localPlayer = previousPlayer;
        Keyboard.count = oldCount;
        Keyboard.codes.set(oldCodes);
        Keyboard.pressed.splice(0, Keyboard.pressed.length, ...oldPressed);
        for (let i = 0; i < arrays.length; i++) arrays[i].set(saved[i]);
        Orbit.shake.splice(0, 5, ...savedShake);
        Cut.paths.splice(0, 2, ...paths);
        Preferences.steppedCameraKeys = pref;
        rmSync(dir, { recursive: true, force: true });
    }
}, 45000);

loginFixture(
    import.meta.url,
    'native camera key scans retain focus, velocities, report delay and ISAAC packet prefixes at the original fault',
    async () => {
        const inputs: number[][] = [];
        for (const phase of [0, 1])
            for (const stepped of [0, 1])
                for (const length of [-1, 0, 1, 2, 96, 97, 98, 99, 100]) {
                    for (const key of [8, 96, 97, 98, 99])
                        for (const count of [-1, 0, 1, 3]) {
                            inputs.push([phase, stepped, length, count, key, 8, 0, 1, 1, 0]);
                        }
                }
        for (const length of [0, 1, 2, 3, 4, 5, 6])
            for (const pos of [-1, 0, 1])
                for (const delay of [0, 1, 2]) {
                    inputs.push([0, 0, 100, 0, 96, length, pos, 1, delay, 1]);
                    inputs.push([0, 1, 1, 2, 97, length, pos, 1, delay, 0]);
                }
        for (const stepped of [0, 1]) inputs.push([1, stepped, -1, 2, 97, 8, 0, 0, 19, 1]);
        const dir = mkdtempSync(join(tmpdir(), 'camera530-fault-'));
        let expected: string[];
        try {
            const exp = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const build = Bun.spawnSync(['javac', ...exp, '-cp', gamepackPath, '-d', dir, fileURLToPath(new URL('./game/CameraTimingOracle.java', import.meta.url))]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', ...exp, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-cp', dir + delimiter + gamepackPath, 'CameraTimingOracle', 'fault'], { stdin: Buffer.from(inputs.map(row => row.join(' ')).join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(inputs.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const packet = new SuperPacket(0),
            client: Client = Object.create(Client.prototype);
        client.game = freshGame({ outgoing: packet, account: null, rebuild: null });
        Client.gameState = 30;
        MinimapBuilder.minimapLevel = Client.playerLevel;
        Client.mouseTracking = new MouseTracking();
        Client.lastSentFocus = GameShell.m_focus;
        Preferences.sent = true;
        Client.playerLevel = 0;
        world.levelHeightmaps = null;
        const endOfReport = new Error(),
            savedCheck = Client.GlCheckMinimap;
        Client.GlCheckMinimap = () => {
            throw endOfReport;
        };
        try {
            for (const [i, row] of inputs.entries()) {
                const [phase, stepped, length, count, key, capacity, pos, hasPlayer, delay, pending] = row;
                const self = (Client.localPlayer = hasPlayer ? new ClientPlayer() : null);
                if (self !== null) {
                    self.x = 12;
                    self.z = 32;
                }
                Orbit.followOffsetX = 3;
                Orbit.followOffsetZ = 6;
                Orbit.focusX = 1000;
                Orbit.focusZ = -600;
                Preferences.steppedCameraKeys = stepped !== 0;
                Keyboard.count = count;
                const codes = length < 0 ? null : new Int32Array(length),
                    pressed = length < 0 ? null : new Array<boolean>(length).fill(false);
                if (codes !== null && length > 0) codes[0] = key;
                if (pressed !== null && key >= 0 && key < length) pressed[key] = true;
                Reflect.set(Keyboard, 'codes', codes);
                Reflect.set(Keyboard, 'pressed', pressed);
                Orbit['pitchVelocity'] = 11;
                Orbit['yawVelocity'] = 13;
                Orbit.followPitch = 289;
                Orbit.followYaw = 1976;
                Orbit['distance'] = 49001;
                Orbit.reportDelay = delay;
                Orbit.reportPending = pending !== 0;
                packet.m_data = new Uint8Array(capacity).fill(0xa5);
                packet.m_pos = pos;
                packet.SetEnc(Int32Array.of(1, 22, 4, 8));
                let fault = '-';
                try {
                    if (phase === 0) await client.GameLoop();
                    else Client.GlFollowCamera();
                } catch (caught) {
                    let e = caught;
                    while (e instanceof WrappedException) e = e.cause;
                    if (e !== endOfReport) fault = e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : String(e);
                }
                const cursor = packet.m_pos,
                    bytes = Buffer.from(packet.m_data).toString('hex');
                packet.m_data = new Uint8Array(1);
                packet.m_pos = 0;
                packet.pHead(251);
                expect(
                    [
                        fault,
                        Orbit.reportDelay,
                        Orbit.reportPending,
                        cursor,
                        bytes,
                        requireNonNull(packet.m_data)[0],
                        Orbit.focusX,
                        Orbit.focusZ,
                        Orbit.followPitch,
                        Orbit.followYaw,
                        Orbit['pitchVelocity'],
                        Orbit['yawVelocity'],
                        Orbit['distance']
                    ].join(' '),
                    row.join(' ')
                ).toBe(expected[i]);
            }
        } finally {
            Client.GlCheckMinimap = savedCheck;
        }
    },
    20000
);

loginFixture(
    import.meta.url,
    'original t.c report and drift blocks and kk.a camera shake consume identical inputs and RNG over 2408 ticks',
    async () => {
        const savedHeights = world.levelHeightmaps;
        const dir = mkdtempSync(join(tmpdir(), 'camera530-timing-')),
            saved = Object.getOwnPropertyDescriptors(Orbit),
            rng = mathRandom['seed'],
            stepped = Preferences.steppedCameraKeys;
        const arrays = [Orbit.shakeRandom, Orbit.shakeAmplitude, Orbit.shakeFrequency, Orbit.shakePhase],
            previous = arrays.map(a => a.slice()),
            shakes = Orbit.shake.slice(),
            path = Cut.positionPath;
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const file = fileURLToPath(new URL('./game/CameraTimingOracle.java', import.meta.url)),
                build = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', dir, file]);
            expect(build.stderr.toString()).toBe('');
            const jar = Bun.spawnSync(['java', ...exports, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CameraTimingOracle'], { maxBuffer: 1024 * 1024 });
            expect(jar.stderr.toString()).toBe('');
            expect(jar.exitCode).toBe(0);
            const lines = jar.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(2408);
            const outgoing = new SuperPacket(128);
            const client: Client = Object.create(Client.prototype);
            client.game = freshGame({ outgoing, account: null, rebuild: null });
            Client.gameState = 30;
            MinimapBuilder.minimapLevel = Client.playerLevel;
            Client.loopCycle = 1;
            Client.playerLevel = ClientBuild.buildLevel = 0;
            Client.mouseTracking = new MouseTracking();
            Client.lastSentFocus = GameShell.m_focus;
            requireNonNull(Client.localPlayer).x = requireNonNull(Client.localPlayer).z = 4096;
            Preferences.sent = true;
            outgoing.SetEnc(Int32Array.of(1, 2, 3, 4));
            mathRandom.setSeed(60733n);
            world.levelHeightmaps = null;
            Object.assign(Orbit, { followOffsetX: -52, followOffsetZ: 56, followYaw: 523, yawOffset: 39, minimapZoom: 11, minimapAngle: 59 });
            Orbit.focusX = 6712;
            Orbit.focusZ = 5820;
            Orbit.followPitch = 185;
            Orbit['distance'] = 51200;
            Orbit['reportPending'] = true;
            Orbit['reportDelay'] = Orbit['driftTicks'] = Orbit['minimapTicks'] = 0;
            Orbit['driftX'] = 2;
            Orbit['driftZ'] = 2;
            Orbit['driftYaw'] = 1;
            Orbit['driftAngle'] = 2;
            Orbit['driftZoom'] = 1;
            Cut.positionPath = -1;
            for (let i = 0; i < 5; i++) {
                Orbit.shake[i] = true;
                Orbit.shakeRandom[i] = 17 * i + 8;
                Orbit.shakeAmplitude[i] = 71 + i * 8;
                Orbit.shakeFrequency[i] = i * 54 + 26;
                Orbit.shakePhase[i] = i * 15 + 8;
            }
            for (let t = 0; t < lines.length; t++) {
                Preferences.steppedCameraKeys = ((t / 111) | 0) % 2 !== 0;
                Keyboard.pressed.fill(false);
                Keyboard.pressed[96] = t % 31 === 5;
                Keyboard.pressed[99] = t % 73 < 9;
                Keyboard.count = t % 33 === 11 ? 2 : 0;
                Keyboard.codes[0] = 97;
                Keyboard.codes[1] = 100;
                Client.m_ticksSinceNoTimeOutPacket = 0;
                Protocol.idleReads = 0;
                outgoing.m_pos = 0;
                Orbit.mode = 0;
                await client.GameLoop();
                let view = '-';
                if (t % 11 === 0) {
                    Orbit.mode = 1;
                    const e = Orbit.view(0, 16, 25);
                    view = [e.x, e.y, e.z, e.pitch, e.yaw].join(',');
                }
                expect(
                    [
                        Orbit.followOffsetX,
                        Orbit.followOffsetZ,
                        Orbit.yawOffset,
                        Orbit.minimapZoom,
                        Orbit.minimapAngle,
                        Orbit['reportDelay'],
                        Orbit['reportPending'],
                        Buffer.from(requireNonNull(outgoing.m_data).slice(0, outgoing.m_pos)).toString('hex')
                    ].join(' ') +
                        '|' +
                        view,
                    'tick ' + t
                ).toBe(lines[t]);
            }
        } finally {
            world.levelHeightmaps = savedHeights;
            Object.defineProperties(Orbit, saved);
            Cut.positionPath = path;
            Orbit.shake.splice(0, 5, ...shakes);
            for (let i = 0; i < arrays.length; i++) arrays[i].set(previous[i]);
            mathRandom.setSeed(rng ^ 0x5deece66dn);
            Preferences.steppedCameraKeys = stepped;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
