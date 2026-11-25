import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fromLiteral } from '#/datastruct/JagString.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import IfType from '#/ui/IfType.js';
import { componentFields } from '../componentState.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD CS2 installs each widget hook in the original field order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-hook-stores-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const compiler = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdHookStoresOracle.java')]);
            expect(compiler.exitCode, compiler.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdHookStoresOracle'];
            const patch = Bun.spawnSync([...java, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(java);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const rows = readFileSync(join(import.meta.dir, 'widget-fields.tsv'), 'utf8').split(/\r?\n/);
            const names = new Map(
                rows
                    .filter(row => row && !row.startsWith('#'))
                    .map(row => {
                        const [sd, hd] = row.split('\t');
                        return [sd, hd];
                    })
            );
            const fields = componentFields().filter(f => f.member === 'hasHook' || f.member.startsWith('on') || f.member.endsWith('Triggers'));
            const actual: string[] = [];
            const code = new ClientScript();
            const runner = new ScriptRunner(
                () => code,
                err => {
                    throw err;
                }
            );
            const event = new HookReq();
            for (let op = 1400; op <= 1429; op++)
                for (const extra of [0, 1000])
                    for (const id of [71, -1]) {
                        const w = (ScriptRunner.activeComponent = new IfType());
                        IfType.m_list = [null, [w]];
                        IfType.m_open = [false, true];
                        const writes: string[] = [];
                        for (const field of fields)
                            Object.defineProperty(w, field.member, {
                                set(value) {
                                    const text = value instanceof Int32Array || Array.isArray(value) ? '[' + value.join(', ') + ']' : String(value);
                                    writes.push(names.get(field.name) + '=' + text);
                                }
                            });
                        code.key = BigInt(120000 + actual.length);
                        event.args = [Number(code.key)];
                        code.opcodes = Int32Array.from(extra ? [0, 0, 0, 0, 0, 3, 0, op + extra, 21] : [0, 0, 0, 0, 0, 3, op, 21]);
                        code.intOperands = Int32Array.from(extra ? [id, 73, -20, 23, 2, 0, 65536, 0, 0] : [id, 73, -20, 23, 2, 0, 0, 0]);
                        code.stringOperands = new Array(code.opcodes.length).fill(null);
                        code.stringOperands[5] = fromLiteral('iY');
                        expect(runner.ExecuteScript(event, 100)).toBeUndefined();
                        actual.push(writes.join('|'));
                    }
            expect(actual).toEqual(oracle.stdout.toString().trimEnd().split(/\r?\n/));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
