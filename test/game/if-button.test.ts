import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import HashTable from '#/datastruct/HashTable.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import SuperPacket from '#/io/SuperPacket.js';
import { ClientScript } from '#/script/ClientScript.js';
import type HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import IfType from '#/ui/IfType.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';

const id = 65537,
    scriptId = 61234;
const hex = (s: JagString | null) => (s === null ? '~' : Buffer.from(s.toBytes()).toString('hex'));
// op, slot, flags, clientCode, hook mode, post-hook mutation, write boundary, packet mutation,
// first/second capacity, first cursor, damaged fields mask, second cursor.
type Row = [number, number, number, number, number, number, number, number, number, number, number, number, number];

loginFixture(
    import.meta.url,
    'Client.IfButtonX matches the gamepack across op hooks, permission changes and live packet replacement',
    async () => {
        const rows: Row[] = [];
        for (const op of [-2147483648, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 31, 32, 33, 2147483647]) {
            for (const slot of [-2, -1, 0, 2, 3])
                for (const code of [-7, 0, 42, 205]) {
                    rows.push([op, slot, -1, code, 0, 0, 0, 0, 7, 7, 0, 0, 0]);
                    rows.push([op, slot, 0, code, 0, 0, 0, 0, 7, 7, 0, 16, 0]);
                }
        }
        for (let op = 1; op <= 10; op++) {
            for (const cap of [-1, 0, 1, 2, 3, 4, 5, 6, 7])
                for (const start of [-1, 0, 1, 2147483647]) {
                    rows.push([op, 2, 1 << op, 205, -1, 0, 0, 0, cap, 7, start, 0, 0]);
                }
            for (const boundary of [-1, 1, 2, 3])
                for (const cap of [-1, 0, 1, 2, 3, 4, 5, 6, 7]) {
                    rows.push([op, 2, -1, 0, -1, 0, boundary, 1, 7, cap, 0, 0, 0]);
                }
            for (const boundary of [1, 2, 3]) for (const swap of [2, 3, 4]) rows.push([op, -1, -1, 205, -1, 0, boundary, swap, 7, 7, 0, 0, 0]);
            for (const mask of [1, 2, 3, 4, 8, 16, 32, 64]) for (const start of [0, -1]) rows.push([op, 2, -1, 205, -1, 0, 1, 1, 7, 7, 0, mask, start]);
            for (const mode of [1, 2])
                for (const mutation of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
                    rows.push([op, 2, mutation === 4 ? 0 : -1, mutation === 2 ? 42 : 205, mode, mutation, -1, 1, 7, 7, 0, (op % 2) * 16, 0]);
                }
        }
        const dir = mkdtempSync(join(tmpdir(), 'rs530-ifbutton-'));
        let expected: string[];
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cc = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'if-button-oracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const run = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'IfButtonOracle'];
            const patch = Bun.spawnSync([...run, gamepackPath, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const jvm = Bun.spawnSync(run, { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'), timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const code = new ClientScript();
        code.intLocals = 1;
        code.stringLocals = 1;
        code.opcodes = Int32Array.of(33, 43, 35, 48, 21);
        code.intOperands = Int32Array.of(0, 115, 0, 116, 0);
        code.stringOperands = Array(5).fill(null);
        ClientScript.m_cache.Put(BigInt(scriptId), code);
        const runner = new ScriptRunner(ClientScript.Get);
        Client.activeClient = null;
        for (const [index, r] of rows.entries()) {
            const [op, slot, flags, clientCode, mode, mutation, boundary, swap, capA, capB, posA, damage, posB] = r;
            const parent = new IfType(),
                child = new IfType();
            parent.childSlots = [null, null, child];
            IfType.m_list = [null, [null, parent]];
            IfType.m_open = [false, true];
            parent.id = child.id = id;
            parent.childId = -1;
            child.childId = 2;
            parent.clientCode = child.clientCode = clientCode;
            parent.properties = child.properties = new ServerActiveProperties(flags, -1);
            if (damage & 8) {
                Reflect.set(child, 'properties', null);
                Reflect.set(parent, 'properties', null);
            }
            const args = [scriptId, -2147483644, fromJsString('event_opbase')];
            if (mode >= 0) parent.onOp = child.onOp = args;
            const base = damage & 16 ? null : fromJsString('Inspect');
            if (damage & 32) parent.childSlots = null;
            Client.serverActiveProperties = new HashTable(32);
            if (damage & 64) Reflect.set(Client, 'serverActiveProperties', null);
            Client.logoutTimer = -12;
            DelayedStateChange.varcs[115] = -97;
            DelayedStateChange.varcStrings[116] = fromJsString('seed');
            let writes = '',
                hook = '-',
                paused = '-',
                fault = 'ok';
            function packet(cap: number, pos: number, seeded: boolean, seed: number): SuperPacket {
                const p = new SuperPacket(Math.max(cap, 0));
                if (cap < 0) p.m_data = null;
                else requireNonNull(p.m_data).fill(0xa5);
                p.m_pos = pos;
                if (seeded) p.SetEnc(Int32Array.of(seed, 2, 3, 4));
                return p;
            }
            const a = packet(capA, posA, (damage & 1) === 0, 1),
                b = packet(capB, posB, (damage & 2) === 0, 12);
            const owner = (p: SuperPacket | null) => (p === null ? 'N' : p === a ? 'A' : 'B');
            Client.out = a;
            if (damage & 4) Reflect.set(Client, 'out', null);
            function changed(write: number): void {
                if (boundary !== write && boundary !== -1) return;
                if (swap === 1) Client.out = Client.out === a ? b : a;
                if (swap === 2) Reflect.set(Client, 'out', null);
                if (swap === 3) Client.out.m_data = null;
                if (swap === 4) Client.out.m_pos = -1;
            }
            for (const p of [a, b]) {
                const head = p.pHead.bind(p),
                    word = p.p4.bind(p),
                    half = p.p2.bind(p);
                p.pHead = val => {
                    writes += owner(p) + 'h';
                    head(val);
                    changed(1);
                };
                p.p4 = val => {
                    writes += owner(p) + 'w';
                    word(val);
                    changed(2);
                };
                p.p2 = val => {
                    writes += owner(p) + 's';
                    half(val);
                    changed(3);
                };
            }
            const gate = Promise.withResolvers<void>();
            function onHook(e: HookReq): void | Promise<void> {
                const c = requireNonNull(e.component);
                hook = [c === child ? 'C' : 'P', e.args === args, e.opBase === base, e.opIndex].join('.');
                const outcome = runner.run(e);
                if (outcome instanceof Promise) throw Error('Arithmetic hook unexpectedly suspended');
                function changedHook(): void {
                    switch (mutation) {
                        case 1:
                            c.properties = new ServerActiveProperties(0, -1);
                            break;
                        case 2:
                            c.clientCode = 205;
                            break;
                        case 3:
                            c.clientCode = 42;
                            break;
                        case 4:
                            c.properties = new ServerActiveProperties(0, -1);
                            Client.serverActiveProperties.put(new ServerActiveProperties(-1, -1), (BigInt(c.id) << 32n) + BigInt(c.childId));
                            break;
                        case 5:
                            requireNonNull(parent.childSlots)[2] = new IfType();
                            requireNonNull(requireNonNull(IfType.m_list)[1])[1] = new IfType();
                            break;
                        case 6:
                            Reflect.set(c, 'properties', null);
                            break;
                        case 7:
                            Client.out = b;
                            break;
                        case 8:
                            Reflect.set(Client, 'serverActiveProperties', null);
                            break;
                        case 9:
                            Reflect.set(Client, 'out', null);
                            break;
                    }
                }
                if (mode === 2) return gate.promise.then(changedHook);
                changedHook();
            }
            try {
                const result = mode > 0 ? Client.IfButtonX(base, slot, id, op, { run: onHook }) : Client.IfButtonX(base, slot, id, op);
                if (result instanceof Promise) {
                    if (mode !== 2) throw Error('Unexpected hook suspension');
                    paused = [Client.logoutTimer, DelayedStateChange.varcs[115], hex(DelayedStateChange.varcStrings[116]), a.m_pos, b.m_pos].join('.');
                    gate.resolve();
                    await result;
                }
            } catch (error) {
                if (error instanceof TypeError) fault = 'null';
                else if (error instanceof RangeError) fault = 'bounds';
                else throw error;
            }
            function dump(p: SuperPacket): string {
                return [p.m_pos, p.m_data === null ? '~' : Buffer.from(p.m_data).toString('hex'), p['m_pIsaac']?.TakeNextValue() ?? '~'].join('.');
            }
            expect([fault, writes, hook, paused, Client.logoutTimer, DelayedStateChange.varcs[115], hex(DelayedStateChange.varcStrings[116]), owner(Client.out), dump(a), dump(b)].join(';'), r.join(' ')).toBe(expected[index]);
        }
    },
    30000
);
