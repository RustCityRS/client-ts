import Js5NetQueue from '#/io/Js5NetQueue.js';
import { loginFixture, setLoginChecksums, javaRsaExponent } from './login-fixture.js';
import { installSocketHost, settleSignlink } from './socket-host.js';
import { gamepackPath, cachePath } from './reference.js';
import { archiveSlots, localAssets } from './cachefile.js';
import MouseTracking from '../src/client/MouseTracking.js';
import Client from '../src/client/Client.js';
import { requireNonNull } from '../src/util/JavaArray.js';
import { expect, spyOn } from 'bun:test';
import { fileURLToPath } from 'node:url';
import Isaac530 from '../src/io/Isaac.js';
import SuperPacket from '../src/io/SuperPacket.js';
import GameShell from '#/client/GameShell.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Login from '../src/io/Login.js';
import Protocol from '#/io/Protocol.js';

import { runRebuild } from './rebuild-fixture.js';

function startLogin(): Client {
    const app = new Client();
    Login.requestLogin(fromJsString('One_Two'), fromJsString('pa£s'), -1, 0);
    return app;
}

class Stream {
    data: number[] = [];
    writes: number[][] = [];
    closed = false;
    GetAvailable(): number {
        return this.data.length;
    }
    Write(offset: number, src: Uint8Array, length: number): void {
        this.writes.push([...src.subarray(offset, offset + length)]);
    }
    async read(): Promise<number> {
        return requireNonNull(this.data.shift());
    }
    async Read(dst: Uint8Array, off: number, length: number) {
        dst.set(this.data.splice(0, length), off);
    }
    Close() {
        this.closed = true;
    }
}

const rebuild = Uint8Array.of(0, 128 + 53, ...Array.from({ length: 64 }, (_, i) => i), 127, 1, 144, 1, 144 ^ 128, 0, 128 + 51);

loginFixture(import.meta.url, 'decodes normal rebuild region keys, map groups and local player coordinates', async () => {
    const area = runRebuild(rebuild, false);
    expect([area.zoneX, area.zoneZ, area.baseX, area.baseZ]).toEqual([400, 400, 3152, 3152]);
    expect([area.localX, area.localZ, area.level]).toEqual([53, 51, 1]);
    expect(area.squares.map(square => square.id)).toEqual([49 * 256 + 49, 49 * 256 + 50, 50 * 256 + 49, 50 * 256 + 50]);
    expect(area.squares[0].key[0]).toBe(0x01000302);
    expect(area.squares[3].underwaterLoc).toBe(2395); // ul50_50 in archive 5
});

loginFixture(import.meta.url, 'login waits for complete success header and payload after the RSA exchange', async () => {
    localAssets(cachePath, [3, 5]);
    const previousRecorder = Client.mouseTracking;
    const draw = spyOn(Client, 'MessageBox').mockImplementation(() => {});
    const previousState = Client.gameState,
        previousNet = Client.js5NetQueue;
    Client.gameState = 10;
    Client.js5NetQueue = new Js5NetQueue();
    Client.mouseTracking = new MouseTracking();
    try {
        const stream = new Stream();
        installSocketHost(async () => stream);
        const app = startLogin();
        stream.data.push(0);
        await app.LoginPoll();
        await settleSignlink();
        await app.LoginPoll();
        await settleSignlink();
        expect(stream.writes[0]).toEqual([14, Number((0x9305d0e78n >> 16n) & 31n)]);
        stream.data.push(0xff, 0xee, 0xdd, 0xcc, 0x76, 0x54, 0x32, 0x10, 1);
        await app.LoginPoll();
        await settleSignlink();
        expect(Login.reply).toBe(1);
        Login.continueLogin();
        await app.LoginPoll();
        await settleSignlink();
        expect(stream.writes[2].length).toBe(1);
        const response = [2, 1, 2, 1, 0, 0, 0, 1, 0, 17, 1, 1, 33, 0, rebuild.length, ...rebuild];
        for (const byte of response) {
            expect(app['pendingLoginSession']).toBeNull();
            stream.data.push(byte);
            await app.LoginPoll();
            await settleSignlink();
        }
        expect(Login.reply).toBe(2);
        expect(app['pendingLoginSession']?.account?.playerId).toBe(17);
        expect(app['pendingLoginSession']?.rebuild?.localX).toBe(53);
        expect(Client.gameState).toBe(25);
        expect(Client.localPlayer?.pathX[0]).toBe(53);
        app['login'].close();
        await settleSignlink();
        expect(stream.closed).toBe(true);
    } finally {
        Client.mouseTracking = previousRecorder;
        Client.gameState = previousState;
        Client.js5NetQueue = previousNet;
        draw.mockRestore();
    }
});

loginFixture(import.meta.url, 'game stream preserves ISAAC position across partial length prefixes and payloads', async () => {
    const seed = Int32Array.of(1, 2, 3, 4);
    const encoder = new Isaac530(seed);
    const stream = new Stream();
    const packet = new SuperPacket(5000);
    packet.SetEnc(seed);
    const oldStream = Client.stream,
        oldPacket = Protocol.inPacket;
    const history = [Protocol.packetType, Protocol.lastPacketType0, Protocol.ptype1, Protocol.ptype2, Protocol.idleReads, Protocol.packetSize];
    Client.stream = stream;
    Protocol.inPacket = packet;
    Protocol.packetType = -1;
    try {
        for (const [opcode, data] of [
            [131, []],
            [70, [72, 101, 108, 108, 111, 0]],
            [22, [255, 255, 255, 255, 0, 1]],
            [197, [2]]
        ] as const) {
            const previous = Protocol.lastPacketType0;
            const size = Protocol.serverPacketSizes[opcode];
            const length = data.length;
            const prefix = size === -1 ? [length] : size === -2 ? [0, length] : [];
            const wire = [(opcode + encoder.TakeNextValue()) & 255, ...prefix, ...data];
            for (const byte of wire.slice(0, -1)) {
                stream.data.push(byte);
                expect(await Protocol.TcpIn()).toBe(false);
                expect(Protocol.lastPacketType0).toBe(previous);
            }
            stream.data.push(wire[wire.length - 1]);
            expect(await Protocol.TcpIn()).toBe(true);
            expect(Protocol.packetType).toBe(-1);
            expect(Protocol.lastPacketType0).toBe(opcode);
            expect(packet.m_pos).toBe(length);
            expect(requireNonNull(packet.m_data).slice(0, length)).toEqual(Uint8Array.from(data));
        }
    } finally {
        Client.stream = oldStream;
        Protocol.inPacket = oldPacket;
        [Protocol.packetType, Protocol.lastPacketType0, Protocol.ptype1, Protocol.ptype2, Protocol.idleReads, Protocol.packetSize] = history;
    }
});

// Run le.a at stage 3 with the two random words and challenge captured by the JVM.
async function pollLoginPacket(seed: Int32Array, plain: boolean): Promise<Uint8Array> {
    const stream = new Stream();
    const challenge = Buffer.alloc(8);
    challenge.writeInt32BE(seed[2]);
    challenge.writeInt32BE(seed[3], 4);
    stream.data.push(...challenge);
    Client.selectedWorldId = 1;
    const app = startLogin();
    Client.loginStep = 3;
    Client.gameState = 10;
    Client.settings = fromJsString('test');
    GameShell.m_sWid = 765;
    GameShell.m_sHei = 503;
    Client.stream = stream;
    const exponent = Client.rsaExponent;
    const random = spyOn(mathRandom, 'nextDouble')
        .mockReturnValueOnce((seed[0] + 0.5) / 99999999)
        .mockReturnValueOnce((seed[1] + 0.5) / 99999999);
    try {
        Client.rsaExponent = plain ? 1n : javaRsaExponent;
        await app.LoginPoll();
        return Uint8Array.from(requireNonNull(stream.writes[0]));
    } finally {
        Client.rsaExponent = exponent;
        random.mockRestore();
    }
}

loginFixture(
    import.meta.url,
    'le.a login payload, RSA ciphertext and 513 server ISAAC draws match Java',
    async () => {
        setLoginChecksums(localAssets(cachePath, []), id => id - 17);
        const source = fileURLToPath(new URL('./login/LoginOracle.java', import.meta.url));
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { timeout: 20000 });
        expect(result.stderr.toString()).toBe('');
        expect(result.exitCode).toBe(0);
        const [plain, rsa, ...draws] = result.stdout.toString().trim().split(/\r?\n/);
        const bytes = Buffer.from(plain, 'hex');
        const rsaStart = 3 + 159 + 5;
        const seed = Int32Array.from({ length: 4 }, (_, i) => bytes.readInt32BE(rsaStart + 2 + i * 4));
        const payload = await pollLoginPacket(seed, true);
        expect(Buffer.from(payload).toString('hex')).toBe(plain);
        const encrypted = await pollLoginPacket(seed, false);
        expect(Buffer.from(encrypted.subarray(rsaStart)).toString('hex')).toBe(rsa);
        const isaac = new Isaac530(seed.map(n => (n + 50) | 0));
        expect(Array.from({ length: 513 }, () => isaac.TakeNextValue())).toEqual(draws.map(Number));
    },
    30000
);

loginFixture(
    import.meta.url,
    'le.a reads the live archive checksums in order and retains the written packet prefix when each slot is absent',
    async () => {
        setLoginChecksums(localAssets(cachePath, []), id => id - 17);
        const source = fileURLToPath(new URL('./login/LoginOracle.java', import.meta.url));
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source, 'missing'], { timeout: 15000 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected).toHaveLength(archiveSlots.length);
        for (let id = 0; id < archiveSlots.length; id++) {
            const slot = archiveSlots[id];
            const saved = Client[slot];
            Client[slot] = null;
            try {
                await expect(pollLoginPacket(new Int32Array(4), true)).rejects.toThrow();
                const out = Client.loginout;
                expect(Buffer.from(requireNonNull(out.m_data).subarray(0, out.m_pos)).toString('hex')).toBe(expected[id]);
            } finally {
                Client[slot] = saved;
            }
        }
    },
    20000
);
