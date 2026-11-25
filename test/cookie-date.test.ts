import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import CookieStatics from '#/util/CookieStatics.js';
import JavaCalendar from '#/util/JavaCalendar.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

const firstTime = -86400001n,
    otherTime = 951782400123n;
type Row = [time: bigint, mode: number, boundary: number, action: number];

function vectors(): Row[] {
    const rows: Row[] = [];
    const day = 86400000n,
        cutover = -12219292800000n;
    const min = -(1n << 63n),
        max = -min - 1n;
    for (const base of [min, max, -8640000000000000n, 8640000000000000n, cutover, -62135769600000n, -1n, 0n, otherTime, 951868799999n, 4107542400000n]) {
        for (const offset of [-366n, -10n, -1n, 0n, 1n, 10n, 366n]) for (const near of [-1n, 0n, 1n, 999n, 1000n, 59999n, 3599999n, 86399999n]) rows.push([BigInt.asIntN(64, base + offset * day + near), 0, 0, 0]);
    }
    let seed = 530n;
    for (let i = 0; i < 512; i++) {
        seed = BigInt.asIntN(64, seed * 6364136223846793005n + 1442695040888963407n);
        rows.push([seed, 0, 0, 0]);
    }
    for (const time of [min, cutover - 1n, 0n, max]) {
        rows.push([time, 2, 0, 0]);
        for (let boundary = 1; boundary <= 8; boundary++) for (let action = 0; action <= 13; action++) rows.push([time, 1, boundary, action]);
    }
    return rows;
}

loginFixture(
    import.meta.url,
    '530 cookie date formatter retains GMT calendar time and field lookup order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-cookie-date-'));
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'CookieDateOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const rows = vectors(),
                lines = rows.map(row => row.join(' '));
            const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CookieDateOracle'], {
                stdin: Buffer.from(lines.join('\n') + '\n'),
                maxBuffer: 4 * 1024 * 1024
            });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            const original = requireNonNull(CookieStatics.gmtCalendar);
            const weekdays = requireNonNull(CookieStatics.dayNames),
                months = requireNonNull(CookieStatics.monthNames);
            const dash = CookieStatics.dateDash,
                colon = CookieStatics.timeSeparator;
            const originalInt = JagString.fromInt;
            let conversions = 0;
            JagString.fromInt = function (value) {
                conversions++;
                return originalInt.call(JagString, value);
            };
            let trace = '',
                reads = 0,
                boundary = 0,
                action = 0;
            class Probe extends JavaCalendar {
                constructor(
                    readonly name: string,
                    time: bigint
                ) {
                    super('GMT', time);
                }
                override setTimeInMillis(time: bigint): void {
                    super.setTimeInMillis(time);
                    change(this, 'S', 0);
                }
                override get(field: Parameters<JavaCalendar['get']>[0]): number {
                    return change(this, String(field), super.get(field));
                }
            }
            const first = new Probe('A', firstTime),
                other = new Probe('B', otherTime);
            function change(receiver: Probe, field: string, value: number): number {
                trace += receiver.name + field + '.';
                if (++reads !== boundary) return value;
                switch (action) {
                    case 1:
                        CookieStatics.gmtCalendar = other;
                        break;
                    case 2:
                        CookieStatics.gmtCalendar = null;
                        break;
                    case 3:
                        receiver.time = otherTime;
                        break;
                    case 4:
                        CookieStatics.dayNames = null;
                        break;
                    case 5:
                        CookieStatics.dayNames = [];
                        break;
                    case 6:
                        CookieStatics.monthNames = null;
                        break;
                    case 7:
                        CookieStatics.monthNames = [];
                        break;
                    case 8:
                        CookieStatics.dayNames = new Array(7).fill(null);
                        CookieStatics.monthNames = new Array(12).fill(null);
                        break;
                    case 9: {
                        const same = fromJsString('alias');
                        requireNonNull(CookieStatics.dayNames).fill(same);
                        requireNonNull(CookieStatics.monthNames).fill(same);
                        Reflect.set(CookieStatics, 'dateDash', same);
                        Reflect.set(CookieStatics, 'timeSeparator', same);
                        break;
                    }
                    case 10:
                        throw Error('probe');
                    case 11:
                        return -2147483648;
                    case 12:
                        return 2147483647;
                    case 13: {
                        const bad = new JagString();
                        bad.length = 1;
                        bad.bytes = null;
                        requireNonNull(CookieStatics.dayNames).fill(bad);
                        break;
                    }
                }
                return value;
            }
            for (const [i, row] of rows.entries()) {
                const [time, mode] = row;
                boundary = row[2];
                action = row[3];
                conversions = 0;
                reads = 0;
                trace = '';
                original.time = firstTime;
                first.time = firstTime;
                other.time = otherTime;
                CookieStatics.gmtCalendar = mode === 0 ? original : mode === 1 ? first : null;
                Reflect.set(ScriptRunner, 'calendar', CookieStatics.gmtCalendar);
                CookieStatics.dayNames = weekdays.slice();
                CookieStatics.monthNames = months.slice();
                Reflect.set(CookieStatics, 'dateDash', dash);
                Reflect.set(CookieStatics, 'timeSeparator', colon);
                let result: string;
                try {
                    result = Buffer.from(CookieStatics.formatCookieDate(time).toBytes()).toString('base64');
                } catch (error) {
                    result = error instanceof TypeError ? 'null' : error instanceof RangeError ? 'bounds' : error instanceof Error && error.message === 'probe' ? 'stop' : String(error);
                }
                const current = CookieStatics.gmtCalendar,
                    shared = ScriptRunner.calendar;
                const ref = current === null ? 'N' : current === original ? 'O' : current === first ? 'A' : 'B';
                expect([result, trace, ref, conversions, original.time, first.time, other.time, shared === null ? '-' : shared.time].join(';'), lines[i]).toBe(expected[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    20000
);
