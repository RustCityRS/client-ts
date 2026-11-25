import Client from '#/client/Client.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import InvType from '#/config/InvType.js';
import VarBitType from '#/config/VarBitType.js';
import ClientVarCache from '#/util/ClientVarCache.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import HashTable from '#/datastruct/HashTable.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Vector = [op: number, operand: number, ints: number, strings: number, truncate: number, actor: number];
function vectors(): Vector[] {
    const rows: Vector[] = [];
    for (const op of [1, 2, 25, 27, 42, 43, 47, 48]) {
        for (const arg of [-1, 0, 7, 8, 9, 999, 1000, 1999, 2000, 2499, 2500]) {
            for (const [ints, strings] of [
                [0, 0],
                [0, 1],
                [1, 0],
                [1, 1],
                [1000, 0],
                [0, 1000]
            ])
                rows.push([op, arg, ints, strings, 0, 0]);
        }
        rows.push([op, 7, 0, 0, 1, 0], [op, 7, 0, 0, 2, 0], [op, 7, 1, 1, 1, 0]);
    }
    for (let op = 3300; op <= 3399; op++) {
        for (const [operand, ints, actor] of [
            [7, 0, 0],
            [7, 1, 1],
            [7, 2, 2],
            [-1, 3, 1],
            [2500, 4, 0],
            [7, 999, 2],
            [7, 1000, 1]
        ])
            rows.push([op, operand, ints, 0, 0, actor]);
    }
    for (const op of [-1, 4, 24, 26, 28, 41, 49, 50, 99, 103, 299, 402, 501, 999, 2706, 2799, 2900, 2999, 3102]) {
        for (const truncate of [0, 1, 2]) rows.push([op, 0, 0, 0, truncate, 0]);
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'gh variable writes and game queries retain the Java stack, storage, delayed queues and fault order',
    async () => {
        const rows = vectors(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-variable-script-'));
        let expected: string[];
        try {
            const built = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/VariableScriptOracle.java')]);
            expect(built.exitCode, built.stderr.toString()).toBe(0);
            const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'VariableScriptOracle'], { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n') });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            expected = result.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        for (let i = 0; i < 3; i++) {
            const bit = new VarBitType();
            bit.baseVar = i === 2 ? 2500 : 14;
            bit.startBit = 3;
            bit.endBit = i === 1 ? 35 : 7;
            VarBitType.m_recentUse.Put(7n + BigInt(i), bit);
        }
        const inventory = new InvType();
        inventory.m_size = 12;
        InvType.m_recentUse.Put(7n, inventory);
        const script = new ClientScript(),
            event = new HookReq(),
            seed = fromJsString('seed'),
            value = fromJsString('value');
        const hash = (a: Int32Array) => a.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1);
        const strHash = (a: (JagString | null)[]) => a.reduce((h, v) => (Math.imul(h, 31) + (v === null ? 0 : v === seed ? 1 : v === value ? 2 : v === ScriptRunner.nullString ? 3 : 4)) | 0, 1);
        let fault = '-';
        const vm = new ScriptRunner(
            () => script,
            e => {
                const cause = e.cause;
                const kind = cause instanceof TypeError ? 'null' : cause instanceof RangeError ? 'bounds' : cause instanceof Error && cause.message === '' ? 'illegal' : 'runtime';
                fault = e.message.split(' op:')[1] + '/' + kind;
            }
        );
        for (const [i, [op, operand, ints, strings, truncate, actor]] of rows.entries()) {
            DelayedStateChange.clear();
            ClientVarCache.changes = new HashTable(16);
            ScriptRunner.intStack.fill(-5501);
            ScriptRunner.stringStack.fill(null);
            ClientVarCache.m_var.fill(27);
            DelayedStateChange.varcs.fill(59);
            DelayedStateChange.varcStrings.fill(null);
            DelayedStateChange.varcStrings[7] = seed;
            Client.localPlayer = actor === 0 ? null : new ClientPlayer();
            const p = Client.localPlayer;
            if (p !== null) {
                p.combatLevel = 91;
                p.x = -1557;
                p.z = 8081;
                if (actor === 2) {
                    p.appearance = new PlayerModel();
                    p.appearance.female = true;
                }
            }
            const pc = ints + strings;
            script.opcodes = new Int32Array(pc + 3);
            script.intOperands = truncate === 2 ? null : new Int32Array(truncate === 1 ? pc : pc + 3);
            script.stringOperands = new Array(pc + 3).fill(null);
            if (script.intOperands) for (let j = 0; j < ints; j++) script.intOperands[j] = j % 2 === 0 ? operand : 11;
            for (let j = ints; j < pc; j++) {
                script.opcodes[j] = 3;
                script.stringOperands[j] = operand < 0 ? null : value;
            }
            script.opcodes[pc] = op;
            script.opcodes[pc + 1] = 3;
            script.stringOperands[pc + 1] = value;
            script.opcodes[pc + 2] = 21;
            if (truncate === 0 && script.intOperands) script.intOperands[pc] = operand;
            script.key = BigInt(76000 + i);
            event.args = [76000 + i];
            fault = '-';
            expect(vm.run(event)).toBeUndefined();
            expect(
                [
                    fault,
                    hash(ScriptRunner.intStack),
                    strHash(ScriptRunner.stringStack),
                    hash(ClientVarCache.m_var),
                    hash(DelayedStateChange.varcs),
                    strHash(DelayedStateChange.varcStrings),
                    ClientVarCache.changes.size(),
                    DelayedStateChange['changes'].size()
                ].join(' '),
                rows[i].join(' ')
            ).toBe(expected[i]);
        }
    },
    30000
);
