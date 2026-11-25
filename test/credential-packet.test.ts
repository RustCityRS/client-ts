import { expect, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import JagString from '#/datastruct/JagString.js';
import AccountCreation from '#/io/AccountCreation.js';
import ByteArrayPool from '#/io/ByteArrayPool.js';
import Login from '#/io/Login.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { loginFixture, javaRsaExponent, javaRsaModulus } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Vector = [method: number, world: number, name: number, password: number, capacity: number, offset: number, swapAt: number, mode: number, longCase?: number];

function vectors(): Vector[] {
    const rows: Vector[] = [];
    for (const world of [-1, 0, 301]) for (const name of [-4, -3, -2, -1, 0, 6, 19]) for (const pw of [-3, -2, -1, 0, 6]) rows.push([0, world, name, pw, 96, 0, 0, 0]);
    for (const op of [0, 1]) {
        // Cross both the password copy and the subsequent random and account fields at byte 128.
        for (let length = 84; length <= 133; length++) rows.push([op, -1, 6, length, 96, 0, 0, 0]);
        for (const pw of [-4, -3, -2, -1, 0, 5]) rows.push([op, -1, 6, pw, 96, 0, 0, 0]);
        for (let size = -1; size <= 68; size++) rows.push([op, -1, 6, 9, size, 0, 0, 0]);
        for (let mode = 2; mode <= 6; mode++) rows.push([op, -1, 6, 9, 96, 0, 0, mode]);
    }
    for (const op of [2, 3]) for (let size = -1; size <= 10; size++) rows.push([op, 301, 6, 9, size, 0, 0, 0]);
    for (const op of [0, 1, 2, 3]) for (let read = 1; read <= 7; read++) for (const mode of [0, 1]) rows.push([op, -1, 6, 9, 96, 0, read, mode]);
    for (const op of [1, 3]) for (const capacity of [3, 8, 96]) for (let key = 0; key < 4; key++) rows.push([op, -1, 6, 9, capacity, 0, 0, 0, key]);
    return rows;
}

function text(spec: number, name: boolean): JagString | null {
    if (spec === -1) return null;
    const value = new JagString(),
        length = spec < 0 ? 2 : spec;
    const source = name ? 'Fixture530' : 'test-only-';
    value.bytes = spec === -2 ? null : Uint8Array.from({ length: spec === -3 ? 1 : length }, (_, i) => source.charCodeAt(i % source.length));
    value.length = spec === -4 ? -3 : length;
    return value;
}
function bytes(p: PacketT | null): string {
    if (p === null) return '-';
    return p.m_pos + ',' + (p.m_data === null ? 'null' : Buffer.from(p.m_data).toString('hex'));
}

loginFixture(
    import.meta.url,
    'login and creation credential packets match the original gamepack on partial fields and RNG order',
    async () => {
        const rows = vectors();
        // Direct Java calls only. gh 5600 always supplies offset zero. Offset 17 starts
        // the dead dummy-argument trap (125 ^ 17 == 108), while 16 still skips it.
        const diagnostics: Vector[] = [0, 3, 16, 17, 18, 31, 32].map(offset => [0, -1, 6, 9, 160, offset, 0, 0]);
        const dir = mkdtempSync(join(tmpdir(), 'rs530-credentials-'));
        let expected: string[];
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const cp = dir + delimiter + gamepackPath;
            const compile = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'login', 'CredentialPacketOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const instrument = Bun.spawnSync(['java', ...exports, '-cp', cp, 'CredentialPacketOracle', dir, gamepackPath]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            expect(instrument.stdout.toString().trim()).toBe('gh.a(Lwf;II)V:0');
            const run = Bun.spawnSync(['java', ...exports, '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, 'CredentialPacketOracle'], {
                stdin: Buffer.from([...rows, ...diagnostics].map(v => v.join(' ')).join('\n') + '\n'),
                maxBuffer: 8 * 1024 * 1024
            });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            expected = run.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        expect(expected.length).toBe(rows.length + diagnostics.length);
        const baseline = expected[rows.length].split(';')[5].split(',');
        const body = baseline[1].slice(4, 2 * Number(baseline[0]));
        for (const [i, v] of diagnostics.entries()) {
            const record = expected[rows.length + i].split(';'),
                [pos, data] = record[5].split(',');
            const offset = v[5],
                skip = (offset ^ 125) <= 108 ? 1 : 0;
            expect(record[0]).toBe('ok');
            expect(Number(pos)).toBe(Number(baseline[0]) + offset + skip);
            expect(data.slice(2 * offset, 2 * (offset + 2))).toBe(baseline[1].slice(0, 4));
            if (skip !== 0) expect(data.slice(2 * (offset + 2), 2 * (offset + 3))).toBe('b5');
            expect(data.slice(2 * (offset + 2 + skip), 2 * Number(pos))).toBe(body);
        }

        const alternateText = text(8, true),
            originalP1 = PacketT.prototype.p1,
            originalDraw = mathRandom.nextDouble.bind(mathRandom);
        const firstByte = spyOn(PacketT.prototype, 'p1'),
            random = spyOn(mathRandom, 'nextDouble');
        const originalOut = requireNonNull(Object.getOwnPropertyDescriptor(Client, 'out'));
        const oldExponent = Client.rsaExponent,
            oldModulus = Login.rsaModulus;
        Client.rsaExponent = javaRsaExponent;
        Login.rsaModulus = javaRsaModulus;
        try {
            for (const [index, v] of rows.entries()) {
                const [op, world, nameSpec, passSpec, size, offset, changeAt, mode, key] = v;
                const name37 = key === undefined ? 0x05a48927a1c4572bn : [0n, -1n, -9223372036854775808n, 9223372036854775807n][key];
                const name = text(nameSpec, true),
                    password = text(passSpec, false);
                Client.username = Client.password = text(1, false);
                Client.selectedWorldId = world;
                Client.affiliateId = 0x527a;
                Login.reply = 31;
                Login.worldLookupStep = 32;
                Client.loginConnectCycles = 33;
                Login.worldLookupErrors = 34;
                Login.loginType = 35;
                Login.createRetryCount = 36;
                AccountCreation.reply = 37;
                AccountCreation.step = 38;
                Client.accountConnectCycles = 39;
                Login.disallowResult = 40;
                Client.socketError = true;
                Client.loginRetryCount = 41;
                Login.loops = 42;
                Client.loginStep = 43;
                Login.hopTime = 44;
                const storage = size < 0 ? null : new Uint8Array(size).fill(0xb5);
                ByteArrayPool.medium[0] = storage;
                ByteArrayPool.mediumCount = 1;
                const first = new SuperPacket(5000);
                first.m_pos = 7;
                const second = new SuperPacket(0);
                second.m_data = new Uint8Array(73).fill(0xe3);
                second.m_pos = 3;
                let out: SuperPacket | null = first,
                    reads = 0,
                    draws = 0;
                const capture: { block: PacketT | null } = { block: null };
                firstByte.mockImplementation(function (this: PacketT, value: number) {
                    if (this !== first && this !== second && capture.block === null) capture.block = this;
                    originalP1.call(this, value);
                });
                Object.defineProperty(Client, 'out', {
                    configurable: true,
                    get() {
                        if (++reads === changeAt) out = mode === 1 ? null : second;
                        return out;
                    }
                });
                mathRandom.setSeed(543210n);
                random.mockImplementation(() => {
                    const value = originalDraw();
                    if (++draws === 1 && (mode === 2 || mode === 3)) Client.username = mode === 2 ? alternateText : null;
                    if (draws === 2 && (mode === 4 || mode === 5)) Client.password = mode === 4 ? alternateText : null;
                    if (draws === 3 && mode === 6) Client.affiliateId = 0x7654;
                    return value;
                });
                let fault = 'ok';
                try {
                    switch (op) {
                        case 0:
                            Login.requestLogin(name, password, 11, offset);
                            break;
                        case 1:
                            AccountCreation.createAccount(name37, 0x12345, -1972, 0x101, password, 0x103);
                            break;
                        case 2:
                            AccountCreation.checkDateOfBirth(0x103, 0x12345, -1972, 0x101);
                            break;
                        case 3:
                            AccountCreation.checkName(name37);
                            break;
                    }
                } catch (e) {
                    fault = e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : String(e);
                }
                const ref = (s: JagString | null, original: JagString | null) => (s === null ? 'null' : s === alternateText ? 'changed' : s === original ? 'input' : 'old');
                const fields = [
                    Login.reply,
                    Login.worldLookupStep,
                    Client.loginConnectCycles,
                    Login.worldLookupErrors,
                    Login.loginType,
                    Login.createRetryCount,
                    AccountCreation.reply,
                    AccountCreation.step,
                    Client.accountConnectCycles,
                    Login.disallowResult,
                    Client.loginRetryCount,
                    Login.loops,
                    Client.loginStep,
                    Login.hopTime,
                    Client.affiliateId
                ];
                const actual = [
                    fault,
                    fields.join(','),
                    Client.socketError,
                    ref(Client.username, name),
                    ref(Client.password, password),
                    bytes(first),
                    bytes(second),
                    out === null ? 'null' : out === first ? 'first' : 'second',
                    bytes(capture.block),
                    ByteArrayPool.mediumCount,
                    ByteArrayPool.medium[0] === null,
                    first.m_data === storage,
                    reads,
                    draws,
                    mathRandom.nextInt()
                ];
                expect(actual.join(';'), v.join(' ')).toBe(expected[index]);
            }
        } finally {
            Client.rsaExponent = oldExponent;
            Login.rsaModulus = oldModulus;
            firstByte.mockRestore();
            random.mockRestore();
            Object.defineProperty(Client, 'out', originalOut);
        }
    },
    30000
);
