import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import LocType from '#/config/LocType.js';
import ObjType from '#/config/ObjType.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import ClientStream from '#/io/ClientStream.js';
import Login from '#/io/Login.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

loginFixture(
    import.meta.url,
    'le stage eight commits each native account field and loc and obj cache in JAR order',
    async () => {
        const rows: number[][] = [];
        for (let mask = 0; mask < 8; mask++) {
            for (let prefix = -1; prefix <= 14; prefix++) rows.push([prefix, 14, -1, mask]);
            for (let missing = 0; missing < 7; missing++) rows.push([14, 14, missing, mask]);
            rows.push([14, 13, -1, mask]);
        }
        const dir = mkdtempSync(join(tmpdir(), 'rs530-login-header-'));
        let expected: string[];
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'login/LoginHeaderOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'LoginHeaderOracle'], { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n') });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            expected = oracle.stdout.toString().trim().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const slots: [object, string][] = [
            [LocType, 'm_recentUse'],
            [LocType, 'm_mc1'],
            [LocType, 'm_mc2'],
            [LocType, 'm_mc3'],
            [ObjType, 'types'],
            [ObjType, 'modelCache'],
            [ObjType, 'spriteCache']
        ];
        const app = new Client();
        Login.beginLogin(0);
        for (const [i, [prefix, avail, missing, mask]] of rows.entries()) {
            const bytes = Uint8Array.of(201, 195, 1, 0, 1, 0, 1, 190, 239, 0, 1, 100, 16, 32);
            if (mask & 1) for (let n = 2; n < 11; n++) if (n !== 7 && n !== 8) bytes[n] ^= 1;
            Client.staffModLevel = -9;
            Client.blackmarks = -11;
            Client.localPid = -77;
            Client.underage = bytes[2] !== 1;
            Client.parentalChatConsent = bytes[3] !== 1;
            Client.parentalAdvertConsent = bytes[4] !== 1;
            Client.mapQuickChat = bytes[5] !== 1;
            Client.mouseTracked = bytes[6] !== 1;
            Client.playerMember = bytes[9] !== 1;
            Client.members = bytes[10] !== 1;
            LocType.members = !!(mask & 2) === (bytes[10] === 1);
            ObjType.m_memServer = !!(mask & 4) === (bytes[10] === 1);
            const original = slots.map(([owner, prop], j) => {
                const cache = new LRUHashCache<object>(2);
                cache.Put(7n, {});
                Object.defineProperty(owner, prop, { value: j === missing ? null : cache });
                return cache;
            });
            Client.loginStep = 8;
            Login.loops = 0;
            Protocol.packetSize = 21;
            Protocol.packetType = 33;
            Client.advertSuppressed = true;
            const incoming = (Protocol.inPacket = new SuperPacket(14));
            incoming.m_pos = 35;
            incoming.SetEnc(Int32Array.of(2, 7, 4));
            let available = avail,
                failed = false;
            Client.stream = new ClientStream(
                {
                    input: {
                        get available() {
                            return available;
                        },
                        async read() {
                            throw Error('unexpected read');
                        },
                        async readBytes(dst, off, len) {
                            dst.set(bytes.subarray(0, len), off);
                            available -= len;
                            incoming.m_data = prefix < 0 ? null : dst.slice(0, prefix);
                            return len;
                        },
                        close() {}
                    },
                    output: { write() {}, flush() {}, close() {} },
                    close() {}
                },
                null
            );
            try {
                await app.LoginPoll();
            } catch {
                failed = true;
            }
            const retained = original.map(c => +(c.Find(7n) !== null)).join('');
            expect(
                [
                    failed,
                    Client.loginStep,
                    Login.loops,
                    incoming.m_pos,
                    Protocol.packetType,
                    Protocol.packetSize,
                    Client.staffModLevel,
                    Client.blackmarks,
                    Client.underage,
                    Client.parentalChatConsent,
                    Client.parentalAdvertConsent,
                    Client.mapQuickChat,
                    Client.mouseTracked,
                    Client.localPid,
                    Client.playerMember,
                    Client.members,
                    LocType.members,
                    ObjType.m_memServer,
                    retained
                ].join(' '),
                rows[i].join(' ')
            ).toBe(expected[i]);
        }
    },
    20000
);
