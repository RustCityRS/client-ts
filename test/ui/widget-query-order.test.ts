import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import HashTable from '#/datastruct/HashTable.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import Linkable from '#/datastruct/Linkable.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import SubInterface from '#/ui/SubInterface.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';

const integers = [
    'x',
    'y',
    'width',
    'height',
    'parentId',
    'scrollX',
    'scrollY',
    'scrollWidth',
    'scrollHeight',
    'modelZoom',
    'modelXAngle',
    'modelZAngle',
    'modelYAngle',
    'transparency',
    'modelOffsetX',
    'modelOffsetY',
    'spriteId',
    'childId',
    'itemId',
    'itemCount'
] as const;
const observed = { x: 'ib', textValue: 'gb', itemId: 'yc', itemCount: 'xc', operationNames: 'Yc', opBaseValue: 'r', childSlots: 'pb' };

function widget(base: number, layout: number): IfType {
    const c = new IfType();
    integers.forEach((key, i) => {
        c[key] = base + i;
    });
    c.hidden = base > 100;
    c.textValue = fromJsString('text' + base);
    c.properties = new ServerActiveProperties(base << 11, -1);
    c.id = base === 100 ? -2147483648 : 2147483647;
    if (layout === 10) c.childId = -2147483648;
    c.opBaseValue = layout === 1 ? null : fromJsString('base' + base);
    c.operationNames = layout === 1 ? null : layout === 3 ? [] : [layout === 2 ? null : fromJsString('first' + base), fromJsString('second' + base)];
    c.childSlots = layout === 1 ? null : layout === 3 ? [] : [c, c, layout === 2 ? null : c];
    if (layout === 1) c.itemId = -1;
    return c;
}

function observe<T, K extends keyof T>(object: T, key: K, afterRead: () => void): void {
    let value = object[key];
    Object.defineProperty(object, key, {
        get() {
            const fetched = value;
            afterRead();
            return fetched;
        },
        set(replacement: T[K]) {
            value = replacement;
        }
    });
}

function query(op: number, mode: number, layout: number, target: number, edit: number, intCapacity: number, stringCapacity: number, ...args: number[]): string {
    const primary = widget(100, layout),
        secondary = widget(200, layout);
    const c = op >= 2000 || mode !== 1 ? primary : secondary;
    ScriptRunner.activeComponent = layout === 4 ? null : primary;
    ScriptRunner.activeComponent2 = layout === 4 ? null : secondary;
    IfType.m_list = [[ScriptRunner.activeComponent, ScriptRunner.activeComponent2]];
    IfType.m_open = [true];
    const hash = new HashTable<Linkable>(8);
    const sub = new SubInterface();
    sub.group = 77;
    if (layout !== 1) hash.put(layout === 5 ? new Linkable() : sub, 0n);
    Reflect.set(InterfaceList, 'subInterfaces', layout === 3 ? null : hash);
    const properties = new HashTable<Linkable>(8),
        secondProperties = new HashTable<Linkable>(8);
    const key = BigInt.asIntN(64, (BigInt(c.id) << 32n) + BigInt(c.childId));
    secondProperties.put(new ServerActiveProperties(30 << 11, -1), key);
    properties.put(new ServerActiveProperties(31 << 11, -1), (25n << 32n) - 7n);
    if (layout === 6 || layout === 10) properties.put(new ServerActiveProperties(32 << 11, -1), key);
    else if (layout === 7) Reflect.set(c, 'properties', null);
    else if (layout === 9) properties.put(new Linkable(), key);
    Object.defineProperty(Client, 'serverActiveProperties', { configurable: true, writable: true, value: layout === 8 ? null : properties });
    const firstInts = intCapacity < 0 ? null : new Int32Array(intCapacity).fill(-111);
    const secondInts = new Int32Array(4).fill(-222);
    const firstStrings = stringCapacity < 0 ? null : new Array<JagString | null>(stringCapacity).fill(fromJsString('a'));
    const secondStrings = [fromJsString('b'), fromJsString('b')];
    Reflect.set(ScriptRunner, 'intStack', firstInts);
    Reflect.set(ScriptRunner, 'stringStack', firstStrings);
    let reads = 0,
        fields = '',
        fault = '-';
    function afterRead(field: string): void {
        fields += field + '.';
        if (++reads !== target) return;
        switch (edit) {
            case 1:
                Reflect.set(ScriptRunner, 'intStack', secondInts);
                break;
            case 2:
                Reflect.set(ScriptRunner, 'stringStack', secondStrings);
                break;
            case 3:
                c.operationNames = null;
                c.opBaseValue = null;
                c.childSlots = null;
                c.itemCount = 419;
                break;
            case 4:
                c.operationNames = [];
                c.opBaseValue = fromJsString('changed');
                c.childSlots = [];
                break;
            case 5:
                c.operationNames = [fromJsString('other'), null];
                c.childSlots = [null, c];
                break;
            case 6:
                Reflect.set(ScriptRunner, 'intStack', null);
                break;
            case 7:
                Reflect.set(ScriptRunner, 'stringStack', null);
                break;
            case 8:
                Reflect.set(Client, 'serverActiveProperties', secondProperties);
                break;
            case 9:
                Reflect.set(Client, 'serverActiveProperties', null);
                break;
            case 10:
                c.id = 25;
                c.childId = -7;
                break;
            case 11:
                Reflect.set(c, 'properties', null);
                break;
        }
    }
    for (const component of [primary, secondary]) {
        for (const key of Object.keys(observed) as (keyof typeof observed)[]) observe(component, key, () => afterRead(observed[key]));
    }
    observe(sub, 'group', () => afterRead('v'));
    if (op === 1800 || op === 2800) {
        observe(Client, 'serverActiveProperties', () => afterRead('W'));
        observe(c, 'id', () => afterRead('Kc'));
        observe(c, 'childId', () => afterRead('bc'));
        observe(c, 'properties', () => afterRead('Sc'));
    }
    const code = new ClientScript(),
        event = new HookReq();
    code.opcodes = Int32Array.from([...args.map(() => 0), op, 0, 21]);
    code.intOperands = Int32Array.from([...args, mode, -72, 0]);
    code.stringOperands = new Array(code.opcodes.length).fill(null);
    code.key = 79500n;
    event.args = [79500];
    const vm = new ScriptRunner(
        () => code,
        error => {
            const ex = error.cause;
            const kind = ex instanceof TypeError ? (ex.message.includes('ClassCastException') ? 'cast' : 'null') : ex instanceof RangeError ? 'bounds' : ex instanceof Error && ex.message === '' ? 'illegal' : 'runtime';
            fault = error.message.split(' op:')[1] + '/' + kind;
        }
    );
    expect(vm.ExecuteScript(event, 1200)).toBeUndefined();
    const ints = (array: Int32Array | null) => (array === null ? 'null' : '[' + array.join(', ') + ']');
    const strings = (array: (JagString | null)[] | null) => (array === null ? '~' : array.map(s => (s === null ? '~' : Buffer.from(s.toBytes()).toString('hex'))).join(','));
    return [
        fault,
        fields,
        ints(firstInts),
        ints(secondInts),
        strings(firstStrings),
        strings(secondStrings),
        ScriptRunner.intStack === null ? 'N' : ScriptRunner.intStack === firstInts ? 'A' : 'B',
        ScriptRunner.stringStack === null ? 'N' : ScriptRunner.stringStack === firstStrings ? 'A' : 'B'
    ].join(';');
}

type Row = Parameters<typeof query>;
function vectors(): Row[] {
    const rows: Row[] = [];
    const valid = [1500, 1501, 1502, 1503, 1504, 1505, 1600, 1601, 1602, 1603, 1604, 1605, 1606, 1607, 1608, 1609, 1610, 1611, 1612, 1700, 1701, 1702, 1800, 1801, 1802];
    const ops = [...valid, ...valid.map(op => op + 1000), 2703, 2704, 2705, 1506, 1613, 1703, 1799, 2506, 2613, 2706, 2799];
    for (const op of ops) {
        const args = op === 2704 || op === 2705 ? [0, 77] : [...(op === 1801 || op === 2801 ? [1] : []), ...(op >= 2000 ? [0] : [])];
        if (op === 1800 || op === 2800) {
            for (const layout of [0, 4, 6, 7, 8, 9, 10])
                for (const mode of [0, 1]) {
                    for (let read = 1; read <= 4; read++) for (const edit of [1, 6, 8, 9, 10, 11]) rows.push([op, mode, layout, read, edit, 4, 2, ...args]);
                }
        }
        for (const layout of [0, 1, 2, 3, 4, 5]) {
            for (const mode of [0, 1, 2]) rows.push([op, mode, layout, 0, 0, 4, 2, ...args]);
            for (const cap of [-1, 0, 1]) rows.push([op, 0, layout, 0, 0, cap, cap, ...args], [op, 0, layout, 0, 0, cap, cap]);
            if (op === 1801 || op === 2801) for (const index of [-2147483648, -1, 0, 2, 3, 2147483647]) rows.push([op, 1, layout, 0, 0, 4, 2, index, ...(op === 2801 ? [0] : [])]);
        }
        const maximumReads = op === 2703 ? 10 : [1801, 2801].includes(op) ? 4 : [1701, 2701, 1802, 2802].includes(op) ? 2 : [1500, 1602, 1700, 2500, 2602, 2700, 2704, 2705].includes(op) ? 1 : 0;
        for (let boundary = 1; boundary <= maximumReads; boundary++)
            for (let edit = 1; edit <= 7; edit++) {
                rows.push([op, 1, 0, boundary, edit, 4, 2, ...args], [op, 0, 1, boundary, edit, 4, 2, ...args]);
            }
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'CS2 widget queries match original field reads, stack writes and subinterface lookup faults',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'cs2-widget-queries-'));
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cc = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'widget-query-order-oracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetQueryOracle'];
            const patched = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(patched.exitCode, patched.stderr.toString()).toBe(0);
            const rows = vectors();
            const jvm = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'), maxBuffer: 8 * 1024 * 1024 });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(query(...row), row.join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    40000
);
