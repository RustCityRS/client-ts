import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClientScript } from '#/script/ClientScript.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import HookReq from '#/script/HookReq.js';
import type JagString from '#/datastruct/JagString.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

function trace(line: string): string {
    const [fault, ...counts] = line.split(' ');
    const [ri, rs, ci, cs] = counts.map(Number);
    const events: string[] = [];
    const seen = new Map<string, number>();
    function note(name: string) {
        const n = (seen.get(name) ?? 0) + 1;
        seen.set(name, n);
        const point = name + n;
        events.push(point);
        if (point === fault) throw new Error('read fault');
    }
    let ints: Int32Array | null = new Int32Array(7),
        strings: (JagString | null)[] | null = new Array(8).fill(null);
    Object.defineProperties(ScriptRunner, {
        intLocals: {
            configurable: true,
            get: () => ints,
            set: (x: Int32Array | null) => {
                note('putInt');
                ints = x;
            }
        },
        stringLocals: {
            configurable: true,
            get: () => strings,
            set: (x: (JagString | null)[] | null) => {
                note('putString');
                strings = x;
            }
        }
    });
    function script(root: boolean, intCount: number, strCount: number) {
        const s = new ClientScript();
        const ops = new Int32Array(root ? [40, 21] : [21]),
            args = new Int32Array(root ? [2, 0] : [0]);
        Object.defineProperties(s, {
            opcodes: {
                get() {
                    note('ops');
                    return ops;
                }
            },
            intOperands: {
                get() {
                    note('args');
                    return args;
                }
            },
            intLocals: {
                get() {
                    note('newInt');
                    return intCount;
                }
            },
            stringLocals: {
                get() {
                    note('newString');
                    return strCount;
                }
            }
        });
        return s;
    }
    const root = script(true, ri, rs),
        child = script(false, ci, cs);
    ScriptRunner.frames[0] = null;
    const runner = new ScriptRunner(
        id => (id === 1 ? root : child),
        () => events.push('report')
    );
    const hook = new HookReq();
    hook.args = [1];
    try {
        runner.ExecuteScript(hook, 100);
    } catch {
        events.push('escaped');
    }
    const saved = ScriptRunner.frames.at(0);
    return line + '|' + events.join(',') + '|' + ints?.length + '/' + strings?.length + '/' + ScriptRunner.frameCount + '|' + (saved ? saved.ints?.length + '/' + saved.strings?.length : '-');
}

if (process.argv.includes('--trace')) {
    for (const row of readFileSync(0, 'utf8').trim().split(/\r?\n/)) console.log(trace(row));
} else
    test('CS2 entry, gosub and return publish locals in original order under both gamepacks', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-script-locals-'));
        function command(cmd: string[], input = '', identity = 'sd') {
            const proc = Bun.spawnSync(cmd, { stdin: Buffer.from(input), env: { ...process.env, RS530_GAMEPACK_IDENTITY: identity } });
            if (proc.exitCode !== 0) throw new Error(proc.stderr.toString());
            return proc.stdout.toString().trim().split(/\r?\n/);
        }
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            command(['javac', asm, '-d', dir, join(import.meta.dir, 'game/ScriptLocalsOracle.java')]);
            const cases = ['- 2 3 4 5', '- -1 3 4 5', '- 2 -1 4 5', '- 2 3 -1 5', '- 2 3 4 -1', '- -1 -1 -1 -1'];
            for (const op of ['ops', 'args', 'putInt', 'putString', 'newInt', 'newString']) {
                const count = op.startsWith('new') ? 2 : 3;
                for (let i = 1; i <= count; i++) cases.push(op + i + ' 2 3 4 5');
            }
            const input = cases.join('\n');
            for (const [identity, pack] of [
                ['sd', gamepackPath],
                ['gl', hdGamepackPath]
            ]) {
                const base = ['java', asm, '-cp', [dir, pack, joglPath].join(delimiter), 'ScriptLocalsOracle', identity];
                command([...base, pack, dir]);
                const reference = command(base, input);
                const actual = command([process.execPath, import.meta.path, '--trace'], input, identity);
                expect(actual).toHaveLength(cases.length);
                expect(reference).toHaveLength(cases.length);
                for (let i = 0; i < cases.length; i++) expect(actual[i], identity + ' ' + cases[i]).toBe(reference[i]);
            }
        } finally {
            rmSync(dir, { force: true, recursive: true });
        }
    }, 30000);
