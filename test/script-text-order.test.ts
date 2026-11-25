import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [opcode: number, operand: number, editAt: number, edit: number, argumentCount: number];
const charOps = [4113, 4114, 4115, 4116, 4122, 4123];

function cases(): Row[] {
    const rows: Row[] = [];
    for (const op of charOps) {
        for (const value of [-2147483648, -1, ...Array.from({ length: 257 }, (_, i) => i), 65535, 2147483647]) {
            rows.push([op, value, 0, 0, 1]);
        }
    }
    for (const op of [4108, 4109, ...charOps]) {
        const count = op < 4110 ? 2 : 1;
        for (let args = 0; args <= count; args++) {
            for (let at = 0; at <= (count === 2 ? 6 : 3); at++) {
                for (let edit = 1; edit <= 4; edit++) rows.push([op, count === 2 ? 19 : 140, at, edit, args]);
            }
        }
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'CS2 character calls and paragraph metrics use the 530 operand and destination order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-script-text-'));
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cc = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ScriptTextOrderOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ScriptTextOrderOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const rows = cases();
            const jvm = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'), maxBuffer: 2 * 1024 * 1024 });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);

            const metrics = Uint8Array.from({ length: 257 }, (_, i) => 1 + (i % 7));
            for (const id of [100, 203]) SoftwareFont.cache.Put(BigInt(id), new SoftwareFont(metrics));
            Client.fontMetricsArchive = null;
            Client.modeWhere = 0;
            const stringStack: (JagString | null)[] = [null];
            let current: Int32Array | null = null;
            let observe: (tag: string) => void = () => {};
            Object.defineProperty(ScriptRunner, 'intStack', {
                get() {
                    const arr = current;
                    observe('I');
                    return arr;
                }
            });
            Object.defineProperty(ScriptRunner, 'stringStack', {
                get() {
                    observe('S');
                    return stringStack;
                }
            });
            function watch(object: object, name: string, argument: number, tag: string): void {
                const original = requireNonNull(Object.getOwnPropertyDescriptor(object, name)).value;
                Reflect.set(object, name, function (this: unknown, ...args: unknown[]) {
                    observe(tag + args[argument]);
                    return Reflect.apply(original, this, args);
                });
            }
            watch(SoftwareFont, 'getFontMetrics', 0, 'font');
            watch(PixfontGeneric.prototype, 'getParagraphLineCount', 1, 'lines');
            watch(PixfontGeneric.prototype, 'getParagraphWidth', 1, 'width');
            watch(JagString, 'isPrintable', 0, 'print');
            watch(JagString, 'isAlphaNumeric', 0, 'alnum');
            watch(JagString, 'isAlpha', 0, 'alpha');
            watch(JagString, 'isDigit', 0, 'digit');
            watch(JagString, 'toLowerCaseChar', 0, 'lower');
            watch(JagString, 'toUpperCaseChar', 0, 'upper');

            const text = fromJsString('abc def gh');
            for (const [i, row] of rows.entries()) {
                const [target, value, at, edit, count] = row;
                const primary = Int32Array.of(-14, -15, -16),
                    secondary = Int32Array.of(9, 203, 99);
                current = primary;
                stringStack[0] = null;
                let active = false,
                    reads = 0,
                    trace = '',
                    fault = 'ok';
                observe = tag => {
                    if (!active) return;
                    trace += tag + ',';
                    if (++reads !== at) return;
                    switch (edit) {
                        case 1:
                            current = secondary;
                            break;
                        case 2:
                            current = null;
                            break;
                        case 3:
                            current = new Int32Array(0);
                            break;
                        case 4:
                            throw new Error('observer');
                    }
                };
                const isFont = target === 4108 || target === 4109;
                const code = new ClientScript(),
                    event = new HookReq();
                const n = count + Number(isFont);
                const ops = new Int32Array(n + 2);
                code.intOperands = new Int32Array(ops.length);
                code.stringOperands = new Array(ops.length).fill(null);
                for (let j = 0; j < count; j++) code.intOperands[j] = j === 0 ? value : 100;
                if (isFont) {
                    ops[count] = 3;
                    code.stringOperands[count] = text;
                }
                ops[n] = target;
                ops[n + 1] = 21;
                code.opcodes = new Proxy(ops, {
                    get(array, key) {
                        const value = Reflect.get(array, key, array);
                        if (typeof key === 'string' && /^\d+$/.test(key)) active = value === target;
                        return value;
                    }
                });
                event.args = [77];
                const runner = new ScriptRunner(
                    () => code,
                    error => {
                        const e = error.cause;
                        fault = e instanceof RangeError ? 'bounds' : e instanceof TypeError ? 'null' : e instanceof Error && e.message === 'observer' ? 'observer' : 'other';
                    }
                );
                runner.ExecuteScript(event, 100);
                active = false;
                const identity = current === primary ? 'A' : current === secondary ? 'B' : current === null ? 'N' : 'E';
                const result = [fault, trace, '[' + primary.join(', ') + ']', '[' + secondary.join(', ') + ']', identity];
                expect(result.join(';'), row.join(' ')).toBe(expected[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
