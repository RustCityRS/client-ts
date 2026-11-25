import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type JagString from '#/datastruct/JagString.js';
import SafeTime from '#/io/SafeTime.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import JavaCalendar from '#/util/JavaCalendar.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [op: number, count: number, change: number, mode: number, zone: string, ...args: number[]];
loginFixture(
    import.meta.url,
    'CS2 calendar calls preserve receiver order, partial local dates and VM stack writes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-script-calendar-'));
        const descriptor = Object.getOwnPropertyDescriptor(ScriptRunner, 'calendar');
        const oldInts = ScriptRunner.intStack,
            oldStrings = ScriptRunner.stringStack,
            oldNow = SafeTime.CurrentTimeMillis;
        try {
            const cp = dir + delimiter + gamepackPath,
                access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            for (const cmd of [
                ['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ScriptCalendarOrderOracle.java')],
                ['java', ...access, '-cp', cp, 'ScriptCalendarOrderOracle', dir]
            ]) {
                const r = Bun.spawnSync(cmd);
                expect(r.exitCode, r.stderr.toString()).toBe(0);
            }
            const rows: Row[] = [];
            for (const zone of ['GMT', 'America/New_York', 'Asia/Kathmandu']) {
                for (const [op, args] of [
                    [4104, [-132472]],
                    [4104, [2147483647]],
                    [6302, [14, 2, 2021]],
                    [6302, [7, 9, 1582]],
                    [6302, [32, -1, -12]],
                    [6303, []]
                ] as [number, number[]][]) {
                    for (let count = 0; count <= args.length; count++) rows.push([op, count, 0, 0, zone, ...args]);
                    for (let change = 1; change <= 4; change++) for (let mode = 1; mode <= 6; mode++) rows.push([op, args.length, change, mode, zone, ...args]);
                }
            }
            const java = Bun.spawnSync(['java', ...access, '-cp', cp, 'ScriptCalendarOrderOracle'], {
                stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n') + '\n'),
                maxBuffer: 4 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            for (const [index, row] of rows.entries()) {
                const [op, count, change, mode, zone, ...args] = row;
                const original = new JavaCalendar(zone, 1609559893781n),
                    other = new JavaCalendar(zone, 637597507639n);
                let current: JavaCalendar | null = original,
                    ordinal = 0,
                    fault = 'ok';
                const trace: string[] = [],
                    stack = Int32Array.of(51, 52, 53, 54),
                    strings: (JagString | null)[] = [null];
                Reflect.set(ScriptRunner, 'intStack', stack);
                Reflect.set(ScriptRunner, 'stringStack', strings);
                const boundary = new Error('calendar probe');
                SafeTime.CurrentTimeMillis = () => {
                    trace.push('now');
                    return 1931010265013n;
                };
                Object.defineProperty(ScriptRunner, 'calendar', {
                    configurable: true,
                    get() {
                        const captured = current;
                        trace.push(captured === null ? 'null' : captured === original ? 'A' : 'B');
                        if (++ordinal === change)
                            switch (mode) {
                                case 1:
                                    current = other;
                                    break;
                                case 2:
                                    current = null;
                                    break;
                                case 3:
                                    throw boundary;
                                case 4:
                                    captured?.setTimeInMillis(637597507639n);
                                    break;
                                case 5:
                                    Reflect.set(ScriptRunner, 'intStack', Int32Array.of(-20, -21, -22, -23));
                                    break;
                                case 6:
                                    Reflect.set(ScriptRunner, 'stringStack', null);
                                    break;
                            }
                        return captured;
                    }
                });
                const script = new ClientScript(),
                    event = new HookReq();
                script.opcodes = new Int32Array(count + 2);
                script.intOperands = new Int32Array(count + 2);
                script.stringOperands = Array(count + 2).fill(null);
                script.intOperands.set(args.slice(0, count));
                script.opcodes[count] = op;
                script.opcodes[count + 1] = 21;
                event.args = [77];
                const runner = new ScriptRunner(
                    () => script,
                    error => {
                        const cause = error.cause;
                        fault = cause === boundary ? 'stop' : cause instanceof TypeError ? 'null' : cause instanceof RangeError ? 'bounds' : 'other';
                    }
                );
                runner.ExecuteScript(event, 100);
                const ints = (v: Int32Array) => '[' + v.join(', ') + ']';
                const value = [
                    fault,
                    trace.join(','),
                    ints(stack),
                    ints(ScriptRunner.intStack),
                    strings[0] === null ? '~' : Buffer.from(strings[0].toBytes()).toString('hex'),
                    original.time,
                    other.time,
                    current === null ? 'null' : current === original ? 'A' : 'B'
                ].join('/');
                expect(value, row.join(' ')).toBe(lines[index]);
            }
        } finally {
            if (descriptor) Object.defineProperty(ScriptRunner, 'calendar', descriptor);
            Reflect.set(ScriptRunner, 'intStack', oldInts);
            Reflect.set(ScriptRunner, 'stringStack', oldStrings);
            SafeTime.CurrentTimeMillis = oldNow;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
