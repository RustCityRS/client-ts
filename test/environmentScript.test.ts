import { setLocalWorld, saveWorldConnection } from './world-connection.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { gamepackPath } from './reference.js';
import JavaCalendar from '#/util/JavaCalendar.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Signlink from '#/util/Signlink.js';
import SafeTime from '#/io/SafeTime.js';
import { ClientScript } from '#/script/ClientScript.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import HookReq from '#/script/HookReq.js';
import IfType from '#/ui/IfType.js';

const fields = ['viewportFovLow', 'zoomWidth2', 'viewportZoomMin', 'zoomWidth', 'fovClampMinWidth', 'viewportMaxZoom', 'zoomWidthMin', 'fovClampMaxHeight', 'viewportWidth', 'viewportHeight'] as const;
type Vector = { op: number; ints: number[]; i: number; time: bigint };

function inputs(): Vector[] {
    const rows: Vector[] = [],
        dates = [-9223372036854775808n, -62135726400000n, -12219292800000n, -2208988800000n, -86400000n, -1n, 0n, 1n, 86400000n, 946684800000n, 1672531200000n, 8640000000000000n, 8640000000000001n, 9223372036854775807n];
    const years = [-2147483648, -100000001, -401, -4, -1, 0, 1, 4, 100, 400, 1550, 1581, 1582, 1583, 1600, 1700, 1850, 1899, 1900, 1999, 2000, 2024, 2100, 2147483647];
    for (let i = 0; i < 96; i++) {
        const a = ([0, -1, 32767, 32768, 65536, -65535, 1082, -2147483648, 2147483647][i % 9] + (i % 3)) | 0;
        const b = ([1, 2, -1534, 124, 109, 33950, 0, 32700][i % 8] - i) | 0,
            c = (b * 256 + i) | 0,
            d = (a - i) | 0;
        const time = dates[i % dates.length],
            year = years[i % years.length],
            day = [1, 4, 5, 10, 14, 15, 29, 31, 32, -13, 300][i % 11];
        const month = [0, 1, 9, 11, 12, -1, -19, 18][i % 8];
        for (const [op, ints] of [
            [6200, [a, b]],
            [6201, [b, c]],
            [6202, [a, d, b, c]],
            [6203, []],
            [6204, []],
            [6205, []],
            [4104, [a]],
            [6300, []],
            [6301, []],
            [6302, [day, month, year]],
            [6303, []],
            [6304, [year]],
            [6405, []],
            [6406, []]
        ] as [number, number[]][])
            rows.push({ op, ints, i, time });
    }
    const values = [-2147483648, -10000000, -365, -13, -1, 0, 9, 13, 365, 10000000, 2147483647];
    for (const year of [-2147483648, -1, 0, 1581, 1582, 1583, 2000, 2147483647]) for (const month of values) for (const day of values) rows.push({ op: 6302, ints: [day, month, year], i: 0, time: 0n });
    return rows;
}

test('viewport, civil calendar, leap years and advertisement callbacks follow the original gh scripts', () => {
    const vectors = inputs(),
        dir = mkdtempSync(join(tmpdir(), 'env-script-530-')),
        classes = join(dir, 'classes');
    mkdirSync(classes);
    const old = { javascript: Client.javascript, calendar: ScriptRunner.calendar, now: SafeTime.CurrentTimeMillis, link: GameShell.signlink, scene: InterfaceList.viewportComponent, fields: fields.map(k => Client[k]) };
    const savedWorld = saveWorldConnection();
    setLocalWorld(1);
    let call = '-',
        jsMode = 0;
    const applet = {
        call(name: string) {
            call = name;
            switch (jsMode) {
                case 0:
                    throw Error();
                case 1:
                    return true;
                case 2:
                    return false;
                case 3:
                    return null;
                default:
                    return 'true';
            }
        }
    };
    const link = (GameShell.signlink = new Signlink(applet));
    const code = new ClientScript(),
        event = new HookReq();
    event.args = [75301];
    const errors: Error[] = [];
    const vm = new ScriptRunner(
        () => code,
        e => errors.push(e)
    );
    const mark = 1099435;
    try {
        const manifest = join(dir, 'MANIFEST.MF'),
            agent = join(dir, 'clock.jar');
        writeFileSync(manifest, 'Manifest-Version: 1.0\r\nPremain-Class: EnvironmentScriptOracle\r\n\r\n');
        const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const build = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', classes, resolve(import.meta.dir, 'ui/EnvironmentScriptOracle.java')]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const pack = Bun.spawnSync(['jar', 'cfm', agent, manifest, '-C', classes, '.']);
        expect(pack.exitCode).toBe(0);
        const payload = Buffer.from(vectors.map(v => [v.op, v.i, v.time, ...v.ints].join(' ')).join('\n') + '\n');
        for (const zone of ['UTC', 'America/New_York', 'Pacific/Kiritimati']) {
            ScriptRunner.calendar = new JavaCalendar(zone, 0n);
            const java = Bun.spawnSync(['java', ...exports, '-javaagent:' + agent, '-Djava.awt.headless=true', '-cp', classes + delimiter + gamepackPath, 'EnvironmentScriptOracle', zone], { stdin: payload, maxBuffer: 4000000 });
            expect(java.stderr.toString()).toBe('');
            expect(java.exitCode).toBe(0);
            const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(vectors.length);
            for (const [index, { op, i, ints, time }] of vectors.entries()) {
                Client.viewportFovLow = i + 12;
                Client.zoomWidth2 = i + 40;
                Client.viewportZoomMin = i + 10;
                Client.zoomWidth = i + 11;
                Client.fovClampMinWidth = i;
                Client.viewportMaxZoom = i + 45;
                Client.zoomWidthMin = i + 87;
                Client.fovClampMaxHeight = i + 120;
                Client.viewportWidth = 810;
                Client.viewportHeight = 445;
                const component = (InterfaceList.viewportComponent = new IfType());
                component.width = i * 45803 - 87533;
                component.height = i * 7331 - 14128;
                Client.javascript = !!(i & 1);
                call = '-';
                jsMode = (i >> 1) % 5;
                SafeTime.CurrentTimeMillis = () => time;
                code.opcodes = Int32Array.from([...ints.map(() => 0), op, 0, 21]);
                code.intOperands = Int32Array.from([...ints, 0, mark, 0]);
                code.stringOperands = Array(ints.length + 3).fill(null);
                vm.run(event);
                const stack = ScriptRunner.intStack.slice(0, ScriptRunner.intStack.indexOf(mark) + 1).join(',');
                expect([stack, fields.map(f => Client[f]).join(','), call, ScriptRunner.calendar.time].join(';'), [zone, op, i, ...ints, time].join(' ')).toBe(lines[index]);
            }
            expect(errors.map(e => e.message)).toEqual([]);
        }
    } finally {
        Object.assign(Client, savedWorld);
        Client.javascript = old.javascript;
        ScriptRunner.calendar = old.calendar;
        SafeTime.CurrentTimeMillis = old.now;
        GameShell.signlink = old.link;
        void link.stopWorker();
        InterfaceList.viewportComponent = old.scene;
        fields.forEach((f, i) => {
            Client[f] = old.fields[i];
        });
        rmSync(dir, { recursive: true, force: true });
    }
}, 45000);
