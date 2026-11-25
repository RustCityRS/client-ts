import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import Client from '#/client/Client.js';
import VarBitType from '#/config/VarBitType.js';
import VarpType from '#/config/VarpType.js';
import Linkable from '#/datastruct/Linkable.js';
import HashTable from '#/datastruct/HashTable.js';
import LongNode from '#/datastruct/LongNode.js';
import ClientVarCache from '#/util/ClientVarCache.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

const applyServer = 1n << 62n;
const hash = (xs: Int32Array | null) => (xs === null ? 0 : xs.reduce((sum, x) => (Math.imul(sum, 31) + x) | 0, 1));

loginFixture(
    import.meta.url,
    '530 ClientVar and ClientVarCache retain native option and queue writes before type, index and null faults',
    async () => {
        const rows: number[][] = [];
        for (let op = 0; op < 8; op++)
            for (const id of [1, -1, 2])
                for (const [active, server] of [
                    [-1, 0],
                    [0, -1],
                    [1, 2],
                    [2, 1],
                    [3, 3]
                ]) {
                    for (const cache of [0, 1, 2]) for (const node of [0, 1, 2, 3, 4]) rows.push([op, id, 5, active, server, 14, cache, node, 35]);
                }
        for (const code of [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 17, 22, 31, 32, 65535])
            for (const id of [1, -1]) {
                rows.push([0, id, code, 3, 3, 0, 0, 0, 2], [1, id, code, 3, 3, 0, 0, 0, 2]);
                for (const end of [-1, 0, 4, 5, 31, 32, 255]) for (const op of [5, 6, 7]) rows.push([op, id, code, 3, 3, end, 0, 0, 46]);
            }
        const dir = mkdtempSync(join(tmpdir(), 'rs530-varcache-'));
        let expected: string[];
        try {
            const built = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'ui/ClientVarOracle.java')]);
            expect(built.exitCode, built.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'ClientVarOracle'], { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        for (const [i, row] of rows.entries()) {
            const [op, index, code, activeSize, serverSize, end, cache, node, value] = row;
            const active = activeSize < 0 ? null : new Int32Array(activeSize).fill(83);
            const server = serverSize < 0 ? null : new Int32Array(serverSize).fill(549);
            Reflect.set(ClientVarCache, 'm_var', active);
            Reflect.set(ClientVarCache, 'm_varServ', server);
            VarpType.m_recentUse.Reset();
            VarBitType.m_recentUse.Reset();
            VarpType.m_numDefinitions = 2;
            VarpType.m_pConfigClient = VarBitType.m_pConfigClient = null;
            VarpType.m_recentUse.Put(0n, new VarpType());
            const type = new VarpType();
            type.clientCode = code;
            const bit = new VarBitType();
            bit.baseVar = index;
            bit.startBit = code;
            bit.endBit = end;
            if (cache !== 1) {
                Reflect.apply(VarpType.m_recentUse.Put, VarpType.m_recentUse, [BigInt(index), cache === 2 ? {} : type]);
                Reflect.apply(VarBitType.m_recentUse.Put, VarBitType.m_recentUse, [46n, cache === 2 ? {} : bit]);
            }
            const pending = node === 4 ? null : new HashTable<Linkable>(16);
            Reflect.set(ClientVarCache, 'changes', pending);
            const previous = node === 1 ? new Linkable() : node === 2 ? new LongNode(applyServer | 1n) : node === 3 ? new LongNode(1n) : null;
            if (previous !== null) pending?.put(previous, BigInt(index));
            Client.m_usingOneButtonMouse = 17;
            Client.chatEffects = 21;
            Client.bankArrangeMode = 25;
            let result = '-';
            try {
                switch (op) {
                    case 0:
                        Client.ClientVar(index);
                        break;
                    case 1:
                        ClientVarCache.reset();
                        break;
                    case 2:
                        ClientVarCache.setClient(index, value);
                        break;
                    case 3:
                        ClientVarCache.setServer(index, value);
                        break;
                    case 4:
                        result = String(ClientVarCache.poll(true));
                        break;
                    case 5:
                        result = String(ClientVarCache.GetVarbit(46));
                        break;
                    case 6:
                        ClientVarCache.SetVarbit(46, value);
                        break;
                    case 7:
                        ClientVarCache.setBitServer(value, 46);
                        break;
                }
            } catch (error) {
                result = error instanceof TypeError ? (error.message.startsWith('ClassCastException') ? 'cast' : 'null') : error instanceof RangeError ? 'bounds' : String(error);
            }
            const current = ClientVarCache.changes?.get(BigInt(index)) ?? null;
            const status = current instanceof LongNode ? (current.value === (applyServer | 1n) ? 'immediate' : current.value === 1n ? 'expired' : (current.value & applyServer) !== 0n ? 'server' : 'client') : current === null ? '-' : 'other';
            expect([result, hash(active), hash(server), Client.m_usingOneButtonMouse, Client.chatEffects, Client.bankArrangeMode, ClientVarCache.changes?.size() ?? -1, status, current === previous].join(' '), row.join(' ')).toBe(expected[i]);
        }
    },
    20000
);
