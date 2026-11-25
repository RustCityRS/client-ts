import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import AccountCreation from '#/io/AccountCreation.js';
import ClientStream from '#/io/ClientStream.js';
import Login from '#/io/Login.js';
import Protocol from '#/io/Protocol.js';
import { SocketIoError, type SocketHandle } from '#/io/SocketPlatform.js';
import SuperPacket from '#/io/SuperPacket.js';
import WorldList from '#/io/WorldList.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { mathRandom } from '#/util/JavaRandom.js';
import Signlink, { type SignlinkThread } from '#/util/Signlink.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [method: number, stage: number, status: number, at: number, action: number, primary: string, replacement: string];
function vectors(): Row[] {
    const rows: Row[] = [];
    for (const kind of [0, 1, 2]) for (const status of [-2147483648, -7, -1, 0, 1, 2, 3, 101, 255, 2147483647]) rows.push([kind, 2, status, 0, 0, '05', '07']);
    for (const kind of [0, 1, 2]) for (const action of [10, 11]) rows.push([kind, 2, 1, 0, action, '05', '07']);
    const suggestions = '00000000000000010000000000000026';
    const phases: [number, number, string, string][] = [
        [0, 2, '1502' + suggestions, '01' + suggestions],
        [0, 2, '04', '06'],
        [0, 3, '02' + suggestions, '010000000000000002'],
        [0, 3, '00', 'ff'],
        [0, 3, '02' + '01'.repeat(15), '00'],
        [0, 3, 'ff', '00'],
        [0, 4, suggestions, '0000000000000002'.repeat(2)],
        [0, 4, '01'.repeat(15), suggestions],
        [1, 2, '65012d', '0102'],
        [1, 2, '07', '0a'],
        [1, 3, '012d', '0241'],
        [1, 3, '01', '02'],
        [2, 2, '00ffeeddcc76543210', '0102'],
        [2, 2, '13', '0a'],
        [2, 3, 'ffeeddcc76543210', '7654321001234567'],
        [2, 4, '1513', '1d25'],
        [2, 4, '01', '17'],
        [2, 7, '23', '99'],
        [2, 10, '04', '75'],
        [2, 8, '0001010001010002730100000004', '01'.repeat(14)],
        [2, 9, '1234', 'abcdfe'],
        [2, 9, '123456', '98abde']
    ];
    // Both peers receive the literal bytes in the row. Run each phase once, then
    // apply one mutation at each of its first four host calls independently.
    for (const [kind, stage, primary, replacement] of phases) {
        rows.push([kind, stage, 1, 0, 0, primary, replacement]);
        for (let at = 1; at <= 4; at++) for (let action = 1; action <= 9; action++) rows.push([kind, stage, 1, at, action, primary, replacement]);
    }
    return rows;
}
const packet = (p: SuperPacket) => p.m_pos + ',' + Buffer.from(requireNonNull(p.m_data)).toString('hex');
const names = (values: (JagString | null)[] | null) => (values === null ? '-' : values.length + '[' + values.map(v => (v === null ? '_' : Buffer.from(v.toBytes()).toString('hex'))).join(',') + ']');

loginFixture(
    import.meta.url,
    'login poll and name suggestions reload gamepack globals on every stream callback',
    async () => {
        const rows = vectors(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-loginstream-'));
        let expected: string[];
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'login', 'LoginStreamOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const jvm = Bun.spawnSync(['java', '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'LoginStreamOracle'], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                timeout: 20000,
                maxBuffer: 8 * 1024 * 1024
            });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        expect(expected.length).toBe(rows.length);
        const app = new Client(),
            login = app['login'];
        const signlink: Signlink = Object.create(Signlink.prototype);
        signlink.startThread = () => {
            const request = new SignlinkRequest<SignlinkThread>();
            request.status = 2;
            return request;
        };
        GameShell.signlink = signlink;
        for (const [index, row] of rows.entries()) {
            const [kind, stage, status, at, action, primary, alternate] = row;
            const first = new SuperPacket(32),
                second = new SuperPacket(action === 5 ? 5 : 32);
            requireNonNull(first.m_data).fill(0x31);
            first.m_pos = 7;
            requireNonNull(second.m_data).fill(0x11);
            second.m_pos = 3;
            const oldNames = [fromJsString('Fixture'), null],
                replacedNames = [null];
            const positions = [0, 0, 0];
            let events = 0,
                log = '';
            // The trace records peer a (initial), b (replacement) or c (newly opened),
            // followed by A for available, R for a single byte or B for a bulk read.
            function event(peer: number, type: string) {
                log += 'abc'[peer] + type;
                if (++events !== at) return;
                switch (action) {
                    case 1:
                        Client.stream = b;
                        break;
                    case 2:
                        Client.stream = null;
                        break;
                    case 3:
                    case 5:
                        Protocol.inPacket = second;
                        break;
                    case 4:
                        Reflect.set(Protocol, 'inPacket', null);
                        break;
                    case 6:
                        Login.suggestedNames = replacedNames;
                        break;
                    case 7:
                        Login.suggestedNames = null;
                        break;
                    case 8:
                        throw new SocketIoError('fixture read');
                }
            }
            function peer(id: number, hex: string): SocketHandle {
                const data = Buffer.from(hex, 'hex');
                return {
                    input: {
                        get available() {
                            const n = data.length - positions[id];
                            event(id, 'A');
                            return n;
                        },
                        async read() {
                            const value = positions[id] < data.length ? data[positions[id]++] : -1;
                            event(id, 'R');
                            return events === at && action === 9 ? -1 : value;
                        },
                        async readBytes(dst, offset, size) {
                            const n = Math.min(data.length - positions[id], size);
                            if (n > 0) {
                                dst.set(data.subarray(positions[id], positions[id] + n), offset);
                                positions[id] += n;
                            }
                            event(id, 'B');
                            return n > 0 ? n : -1;
                        },
                        close() {}
                    },
                    output: { write() {}, flush() {}, close() {} },
                    close() {}
                };
            }
            const a = new ClientStream(peer(0, primary), signlink),
                b = new ClientStream(peer(1, alternate), signlink);
            Client.stream = a;
            const request = new SignlinkRequest<SocketHandle>();
            request.status = status;
            request.result = action === 10 ? null : peer(2, primary);
            Client.socketRequest = action === 11 ? null : request;
            Protocol.inPacket = first;
            Client.out = new SuperPacket(32);
            requireNonNull(Client.out.m_data).fill(0x53);
            Client.out.m_pos = 4;
            Login.suggestedNames = oldNames;
            AccountCreation.step = kind === 0 ? stage : 0;
            Login.worldLookupStep = kind === 1 ? stage : 0;
            Client.loginStep = kind === 2 ? stage : 0;
            Client.accountConnectCycles = 4;
            Client.loginConnectCycles = 5;
            Login.loops = 6;
            Login.createRetryCount = Login.worldLookupErrors = Client.loginRetryCount = 0;
            Login.reply = 31;
            AccountCreation.reply = 32;
            Login.serverKey = 33n;
            Login.hopTime = 21;
            Login.disallowResult = 20;
            Client.selectedWorldId = -1;
            WorldList.loaded = false;
            Client.socketError = false;
            Protocol.packetType = -1;
            Protocol.packetSize = kind === 2 && stage === 9 ? 3 : 0;
            Client.mouseTracking = null;
            Client.lastSentFocus = false;
            Client.username = kind === 2 && stage === 3 ? null : fromJsString('Fixture');
            Client.password = null;
            Client.currentPort = Client.primaryPort = 40001;
            Client.secondaryPort = 50001;
            Client.worldListPort = Client.worldListPrimaryPort = 40002;
            Client.worldListSecondaryPort = 50002;
            Client.staffModLevel = Client.blackmarks = Client.localPid = 0;
            Client.underage = Client.parentalChatConsent = Client.parentalAdvertConsent = Client.mapQuickChat = Client.mouseTracked = Client.playerMember = Client.members = false;
            mathRandom.setSeed(530n);
            let fault = 'ok';
            try {
                if (kind === 0) await AccountCreation.loop();
                else if (kind === 1) await login.selectLoginWorld();
                else await app.LoginPoll();
            } catch (e) {
                fault = e instanceof TypeError ? 'null' : e instanceof RangeError ? (/array length/i.test(e.message) ? 'negative' : 'bounds') : String(e);
            }
            const fields = [
                AccountCreation.step,
                Login.worldLookupStep,
                Client.loginStep,
                Client.accountConnectCycles,
                Client.loginConnectCycles,
                Login.loops,
                Login.createRetryCount,
                Login.worldLookupErrors,
                Client.loginRetryCount,
                Login.reply,
                AccountCreation.reply,
                Login.hopTime,
                Login.disallowResult,
                Client.selectedWorldId,
                Client.currentPort,
                Client.worldListPort,
                Protocol.packetType,
                Protocol.packetSize,
                Client.staffModLevel,
                Client.blackmarks,
                Client.localPid
            ];
            const result = [
                fault,
                fields.join(','),
                Login.serverKey,
                log,
                positions.join(','),
                Client.socketRequest === request,
                Client.stream === null ? '-' : Client.stream === a ? 'a' : Client.stream === b ? 'b' : 'c',
                [a['closed'], b['closed']].join(','),
                Protocol.inPacket === null ? '-' : Protocol.inPacket === first ? 'a' : 'b',
                packet(first),
                packet(second),
                packet(Client.out),
                Client.lastSentFocus,
                Login.suggestedNames === null ? '-' : Login.suggestedNames === oldNames ? 'old' : Login.suggestedNames === replacedNames ? 'replaced' : 'new',
                names(Login.suggestedNames),
                names(oldNames),
                names(replacedNames)
            ];
            expect(result.join(';'), row.join(' ')).toBe(expected[index]);
        }
    },
    30000
);
