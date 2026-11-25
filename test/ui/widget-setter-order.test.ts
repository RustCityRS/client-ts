import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import ObjType from '#/config/ObjType.js';
import { fromJsString } from '#/datastruct/JagString.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import { componentFields, mix, valueHash } from '../componentState.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';

const slots = 'Bc Ec m ub G M Bb Y h X C H ld jb hc Ac jc Sb Hc Q gb yc w md xc d nd hb db id vd e c Lc Zc Rb Qb Z dc U qc sc i'.split(' ');
const members = componentFields().filter(field => slots.includes(field.name) || ['ob', 'Kc', 'bc'].includes(field.name));
const snapshot = slots.map(name => {
    const field = members.find(slot => slot.name === name);
    if (!field) throw Error('Missing widget field ' + name);
    return field.member;
});
const objFields = { yAngle2d: 'P', xAngle2d: 'U', yOffset2d: 'q', xOffset2d: 'u', zAngle2d: 'm', zoom2d: 'gb' } as const;
let watching = false;
let onWatch: (token: string, value?: unknown) => void;

function watchSlot<T, K extends keyof T>(object: T, key: K, read: string, write?: string): void {
    let backing = object[key];
    Object.defineProperty(object, key, {
        get() {
            const value = backing;
            if (watching) onWatch(read);
            return value;
        },
        set(value: T[K]) {
            backing = value;
            if (watching && write !== undefined) onWatch(write, value);
        }
    });
}

function watchCall(owner: object, method: string, name: string): void {
    const original = Reflect.get(owner, method);
    if (typeof original !== 'function') throw Error('Missing callee ' + method);
    Reflect.set(owner, method, function (this: object, ...args: unknown[]) {
        if (!watching) return Reflect.apply(original, this, args);
        onWatch('!' + name);
        watching = false;
        try {
            return Reflect.apply(original, this, args);
        } finally {
            watching = true;
        }
    });
}

function widget(index: number, layout: number): IfType {
    const c = new IfType();
    c.id = index;
    c.childId = layout === 1 ? 7 : -1;
    c.type = layout === 2 ? 0 : 4;
    c.drawCycle = 176;
    c.rootIndex = index;
    c.scrollWidth = 100;
    c.width = 40;
    c.scrollHeight = 80;
    c.height = 30;
    if (layout === 3) {
        c.scrollWidth = 2147483647;
        c.width = -15;
        c.scrollHeight = 2;
        c.height = 40;
    }
    c.modelWidth = layout === 1 ? 0 : 64;
    c.baseWidth = layout === 2 ? 0 : 32;
    c.modelHeight = 45;
    c.modelAnim = 90;
    c.modelFrame = 4;
    c.modelCycle = 7;
    c.modelNext = 9;
    Reflect.set(c, 'textValue', layout === 1 ? null : fromJsString('old'));
    return c;
}

type Arg = number | string | null;
type Row = { mode: number; layout: number; target: number; edit: number; code: [number, Arg][] };
function vectors(): Row[] {
    const rows: Row[] = [];
    function add(op: number, args: Arg[], mode: number, layout: number, target = 0, edit = 0) {
        const code: [number, Arg][] = args.map(v => [typeof v === 'number' ? 0 : 3, v]);
        if (mode === 2 || mode === 3) {
            code.push([0, 1]);
            op += 1000;
        }
        code.push([op, +(mode === 1)], [21, 0]);
        rows.push({ mode, layout, target, edit, code });
    }
    const cases: [number, Arg[]][] = [
        [1000, [87, 49, -1, 9]],
        [1001, [70, 35, -1, 5]],
        [1100, [90, 90]],
        [1100, [3, 4]],
        [1100, [-5, -6]],
        [1110, [91]],
        [1110, [90]],
        [1112, [null]],
        [1112, ['old']],
        [1112, ['new']],
        [1200, [-1, 5]],
        [1205, [-1, 5]],
        [1200, [4, 15]],
        [1205, [4, 15]]
    ];
    for (const op of [1407, 1414, 1415, 1428, 1429]) {
        cases.push([op, [125, 17, 5, 6, 2, '', 'siY']], [op, [-1, 0, 'Y']], [op, [123, '']], [op, [3, null]]);
    }
    for (const [op, args] of cases) {
        for (const mode of [0, 1, 2, 3, 4]) for (const layout of [0, 1, 2, 3]) add(op, args, mode, layout);
        for (const mode of [0, 2]) {
            for (let boundary = 1; boundary <= (op >= 1400 ? 3 : op === 1100 ? 21 : op >= 1200 ? 26 : 12); boundary++) {
                add(op, args, mode, 0, boundary, 1);
                if (op === 1100) add(op, args, mode, 3, boundary, 3);
                if (op === 1200 || op === 1205) add(op, args, mode, 0, boundary, 4);
                if (op === 1000 || op === 1001 || op === 1100) for (const edit of [2, 5]) add(op, args, mode, 1, boundary, edit);
            }
            for (let n = 0; n < args.length; n++) add(op, args.slice(0, n), mode, 0);
        }
    }
    return rows;
}

function query(row: Row): string {
    const { mode, layout, target, edit, code } = row;
    const a = widget(0, layout),
        b = widget(1, layout),
        c = mode === 0 || mode === 4 ? a : b;
    ScriptRunner.activeComponent = mode === 4 ? null : a;
    ScriptRunner.activeComponent2 = b;
    IfType.m_list = [[a, mode === 3 ? null : b]];
    IfType.m_open = [true];
    InterfaceList.dirty[0] = InterfaceList.dirty[1] = false;
    Reflect.set(ScriptRunner, 'intStack', new Int32Array(24));
    Reflect.set(ScriptRunner, 'stringStack', new Array(12).fill(null));
    for (const field of members) watchSlot(c, field.member, '?' + field.name, '=' + field.name);
    let trace = '',
        boundary = 0,
        fault = '-';
    onWatch = (token, value) => {
        trace += token + (token.startsWith('=') ? ':' + valueHash(value) : '') + ',';
        if (++boundary !== target) return;
        watching = false;
        try {
            switch (edit) {
                case 1:
                    throw Error('widget watchpoint');
                case 2:
                    Reflect.set(ScriptRunner, 'intStack', Int32Array.of(4, 75, 1, 2));
                    break;
                case 3:
                    c.scrollWidth = 127;
                    c.width = -11;
                    c.scrollHeight = -4;
                    c.height = 2147483647;
                    break;
                case 4:
                    c.modelWidth = 0;
                    c.baseWidth = 0;
                    break;
                case 5:
                    Reflect.set(ScriptRunner, 'intStack', new Int32Array(0));
                    break;
            }
        } finally {
            watching = true;
        }
    };
    const script = new ClientScript(),
        event = new HookReq();
    script.opcodes = Int32Array.from(code.map(([op]) => op));
    script.intOperands = Int32Array.from(code.map(([, arg]) => (typeof arg === 'number' ? arg : 0)));
    script.stringOperands = code.map(([, arg]) => (typeof arg === 'string' ? fromJsString(arg) : null));
    script.key = 79500n;
    event.args = [79500];
    const vm = new ScriptRunner(
        () => script,
        error => {
            const ex = error.cause;
            const kind = ex instanceof TypeError ? 'null' : ex instanceof RangeError ? (ex.message.includes('zero') ? 'divide' : 'bounds') : ex instanceof Error && ex.message === 'widget watchpoint' ? 'stop' : 'runtime';
            fault = error.message.split(' op:')[1] + '/' + kind;
        }
    );
    watching = true;
    try {
        expect(vm.ExecuteScript(event, 1200)).toBeUndefined();
    } finally {
        watching = false;
    }
    return [fault, trace, snapshot.reduce((h, key) => mix(h, valueHash(c[key])), 1), InterfaceList.dirty[0], InterfaceList.dirty[1]].join(';');
}

loginFixture(
    import.meta.url,
    'CS2 widget setters preserve original field, hook and invalidation order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'cs2-widget-setters-'));
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cc = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'widget-setter-order-oracle.java'), join(import.meta.dir, 'ComponentOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetSetterOracle'];
            const prep = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prep.exitCode, prep.stderr.toString()).toBe(0);
            const rows = vectors();
            const lines = rows.map(({ mode, layout, target, edit, code }) => [mode, layout, target, edit, ...code.map(([op, v]) => op + ':' + (v ?? '~'))].join(' '));
            const jvm = Bun.spawnSync(java, { stdin: Buffer.from(lines.join('\n') + '\n'), maxBuffer: 16 * 1024 * 1024 });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            GameShell.m_sWid = 765;
            GameShell.m_sHei = 503;
            InterfaceList.cycle = 176;
            const obj = new ObjType();
            Object.assign(obj, { id: 4, yAngle2d: 200, xAngle2d: 321, yOffset2d: -51, xOffset2d: 67, zAngle2d: 189, zoom2d: 12345 });
            ObjType.types.Put(4n, obj);
            for (const key of Object.keys(objFields) as (keyof typeof objFields)[]) watchSlot(obj, key, 'obj.' + objFields[key]);
            watchCall(ObjType, 'List', 'rg');
            for (const [method, tag] of [
                ['ComponentUpdated', 'ed'],
                ['InterfaceCalculateSizeAndPosComponent', 'ik'],
                ['InterfaceCalculateSizeAndPosSubcomponents', 'mi']
            ])
                watchCall(Client, method, tag);
            for (const [method, tag] of [
                ['clientPosition', 'qg'],
                ['clientScroll', 're'],
                ['clientAnimation', 'n'],
                ['clientText', 'cf'],
                ['clientObj', 'pd'],
                ['clientChange', 'fl'],
                ['clientOffsets', 'ti']
            ])
                watchCall(DelayedStateChange, method, tag);
            for (const [i, row] of rows.entries()) expect(query(row), lines[i]).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    40000
);
