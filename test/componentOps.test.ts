import DelayedStateChange from '#/ui/DelayedStateChange.js';
import Client from '#/client/Client.js';
import { freshGame } from './actor-fixture.js';
import ObjType from '#/config/ObjType.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { localAssets } from './cachefile.js';
import { gamepackPath, cachePath } from './reference.js';
import { componentFields, mix, valueHash } from './componentState.js';
import { fromJsString } from '#/datastruct/JagString.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import IdkType from '#/config/IdkType.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import IfType from '#/ui/IfType.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import InterfaceList from '#/ui/InterfaceList.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';

const root = 65536;

type Instruction = { op: number; value: number | string };

function componentScripts(): Instruction[][] {
    const scripts: Instruction[][] = [];
    const make = (op: number, ints: number[] = [], strings: string[] = [], dot = false, widget?: number) => {
        const code: Instruction[] = ints.map(value => ({ op: 0, value }));
        for (const value of strings) code.push({ op: 3, value });
        if (widget !== undefined) code.push({ op: 0, value: widget });
        code.push({ op, value: +dot }, { op: 0, value: 871 }, { op: 43, value: 1901 }, { op: 21, value: 0 });
        scripts.push(code);
    };
    for (const [op, ints, strings] of [
        [1300, [0], []],
        [1300, [11], ['option']],
        [1300, [1], []],
        [1300, [1], ['option']],
        [1309, [0, 91], []],
        [1309, [11, 91], []],
        [1309, [1], []],
        [1309, [1, 91], []],
        [1000, [], []],
        [1100, [], []],
        [1101, [], []],
        [1200, [], []],
        [1301, [], []],
        [1400, [], []],
        [1400, [51], ['']],
        [1413, [51], ['']],
        [1499, [51], ['']],
        [1500, [], []],
        [1701, [], []],
        [1801, [], []]
    ] as [number, number[], string[]][]) {
        make(op, ints, strings);
        make(op + 1000, ints, strings, false, 2 << 16);
    }
    for (const op of [
        1000,
        1001,
        1003,
        1004,
        1005,
        ...Array.from({ length: 24 }, (_, i) => 1100 + i),
        1200,
        1201,
        1202,
        1203,
        1204,
        1205,
        ...Array.from({ length: 10 }, (_, i) => 1300 + i),
        1400,
        1407,
        1427,
        1428,
        1429,
        1500,
        1602,
        1701,
        1800,
        1801,
        1802
    ]) {
        for (const n of [0, 1, 4]) {
            const ints = Array.from({ length: n }, (_, i) => 37 + i);
            if (op === 1301 && n >= 2) ints[n - 2] = root;
            make(op, ints);
            make(op + 1000, ints, [], false, 2 << 16);
        }
    }
    for (const dot of [false, true]) for (const part of [0, 7, 1, 8, 77]) make(403, [part, 3], [], dot);
    make(404, [3, 71]);
    make(410, [1]);
    make(201, [root]);
    make(201, [root + 1], [], true);
    make(100, [root, 5, 0]);
    make(100, [root, 7, 1], [], true);
    make(100, [root, 1, 4]);
    make(200, [root, -1]);
    make(200, [root, 0]);
    make(200, [root, 1], [], true);
    const setters: [number, number[], string[]?][] = [
        [1000, [23, -9, -3, 9]],
        [1001, [88, 64, 0, 0]],
        [1003, [1]],
        [1003, [1]],
        [1004, [8, 11]],
        [1005, [1]],
        [1100, [1, -10]],
        [1101, [0xff3412]],
        [1102, [1]],
        [1103, [132]],
        [1104, [3]],
        [1105, [19]],
        [1106, [1102]],
        [1107, [1]],
        [1108, [91]],
        [1109, [15, 26, 48, 62, 75, 85]],
        [1110, [555]],
        [1110, [555]],
        [1111, [1]],
        [1112, [], ['label']],
        [1112, [], ['label']],
        [1113, [99]],
        [1114, [3, 5, 7]],
        [1115, [1]],
        [1116, [9]],
        [1117, [0xff3245]],
        [1118, [1]],
        [1119, [1]],
        [1120, [192, 137]],
        [1100, [405, -212]],
        [1121, [12, 28]],
        [1122, [1]],
        [1123, [345]],
        [1200, [4, 661]],
        [1205, [4, 23]],
        [1200, [-1, 465]],
        [1201, [31]],
        [1202, []],
        [1203, [42]],
        [1204, [51]],
        [1300, [10], ['option']],
        [1300, [0], ['bad']],
        [1300, [11], ['bad']],
        [1301, [root, 0]],
        [1302, [1]],
        [1303, [56]],
        [1304, [67]],
        [1305, [], ['base']],
        [1306, [], ['verb']],
        [1307, []],
        [1308, [22, 33]],
        [1309, [5, 123]],
        [1309, [-1, 2]]
    ];
    for (const explicit of [false, true]) {
        for (const [op, ints, strings] of setters) make(op + (explicit ? 1000 : 0), ints, strings, op % 4 === 0, explicit ? root + 1 : undefined);
        for (let op = 1400; op <= 1429; op++) {
            for (const script of [9901, -1]) make(op + (explicit ? 1000 : 0), [script, 17, 9, 87, 2], ['hook', 'siY'], true, explicit ? root + 1 : undefined);
        }
        for (const op of [1500, 1501, 1502, 1503, 1504, 1505, 1600, 1601, 1602, 1603, 1604, 1605, 1606, 1607, 1608, 1609, 1610, 1611, 1612, 1700, 1701, 1800, 1801, 1802])
            make(op + (explicit ? 1000 : 0), op === 1801 ? [3] : [], [], true, explicit ? root + 1 : undefined);
    }
    make(1499, [4], ['']);
    make(1400, [-1, -2], ['Y']);
    make(1300, [11]);
    make(1300, [1], ['first']);
    make(1801, [-2147483648]);
    make(1801, [0]);
    make(1801, [2147483647]);
    make(2801, [-2147483648], [], false, root);
    for (const op of [2000, 2100, 2200, 2300, 2400, 2500, 2600, 2700, 2800]) make(op);
    make(1702);
    make(1702, [], [], true);
    make(2703, [], [], false, root);
    make(101);
    make(2703, [], [], false, root);
    make(200, [root, 0]);
    make(200, [root, -2]);
    make(101, [], [], true);
    make(102, [root]);
    make(2703, [], [], false, root);
    make(201, [root]);
    make(101);
    make(100, [root, 0, 0]);
    make(100, [root, 1, -1]);
    make(100, [root, 1, -2]);
    for (const [op, total] of [
        [1000, 4],
        [1001, 4],
        [1004, 2],
        [1100, 2],
        [1109, 6],
        [1114, 3],
        [1120, 2],
        [1205, 2],
        [1301, 2],
        [1308, 2],
        [1309, 2]
    ]) {
        for (let count = 0; count < total; count++)
            make(
                op,
                Array.from({ length: count }, (_, i) => 5 + i),
                [],
                false
            );
    }
    make(2702, [root]);
    make(2703, [root]);
    make(2704, [root, 13]);
    make(2705, [root + 1, 4]);
    make(201, [root + 1]);
    make(1301, [root, -1]);
    for (const x of [-7, 7]) {
        make(3108, [x, 19, root + 1]);
        make(3108, [x, 19, root]);
        make(3109, [x, 61]);
        make(3109, [x, 61], [], true);
        make(3108, [x]);
        make(3109, [x]);
    }
    // gh.a dispatches each setter/getter family before testing the exact instruction.
    // Unassigned IDs may still pop a component, invalidate a root or decode a hook signature.
    const defined = new Set<number>();
    const range = (start: number, end: number) => {
        for (let n = start; n <= end; n++) defined.add(n);
    };
    for (const offset of [0, 1000]) {
        for (const n of [1000, 1001, 1003, 1004, 1005, 1700, 1701, 1800, 1801, 1802]) defined.add(n + offset);
        for (const [start, end] of [
            [1100, 1123],
            [1200, 1205],
            [1300, 1309],
            [1400, 1412],
            [1414, 1429],
            [1500, 1505],
            [1600, 1612]
        ]) {
            range(start + offset, end + offset);
        }
    }
    defined.add(1702);
    range(2702, 2705);
    for (let op = 1000; op < 3000; op++) {
        if (defined.has(op)) continue;
        make(op);
        make(op, [7], [''], false, root + 1);
    }
    return scripts;
}

test('all gh component setters, hooks, getters and dynamic child operations agree with Java after each script', () => {
    const scripts = componentScripts();
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const tmp = mkdtempSync(join(out, 'component-ops-'));
    let lines: string[];
    try {
        const java = resolve(import.meta.dir, 'ui');
        const c = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', tmp, join(java, 'ComponentOpsOracle.java'), join(java, 'ComponentOracle.java')]);
        if (c.exitCode !== 0) throw Error(c.stderr.toString());
        const stdin = scripts.map(ops => ops.map(({ op, value }) => op + ':' + value).join(' ')).join('\n') + '\n';
        const r = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', tmp + delimiter + gamepackPath, 'ComponentOpsOracle'], { stdin: Buffer.from(stdin), maxBuffer: 5000000 });
        if (r.exitCode !== 0) throw Error(r.stderr.toString());
        lines = r.stdout.toString().trimEnd().split(/\r?\n/);
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
    const assets = localAssets(cachePath, [3]);
    const outgoing = Client.out;
    const game = freshGame({ outgoing, account: null, rebuild: null }, assets);
    let reported: Error | null = null;
    const ui = new InterfaceSession(new InterfaceView([]), assets, e => {
        reported = e;
    });
    const c = new IfType(),
        d = new IfType();
    c.id = root;
    d.id = root + 1;
    c.drawCycle = d.drawCycle = 134;
    c.rootIndex = 0;
    d.rootIndex = 1;
    c.type = 0;
    d.type = 4;
    d.parentId = root;
    requireNonNull(IfType.m_list)[1] = [c, d];
    requireNonNull(IfType.m_open)[1] = true;
    requireNonNull(IfType.m_list)[2] = [null];
    requireNonNull(IfType.m_open)[2] = true;
    const obj = new ObjType();
    Object.assign(obj, { id: 4, yAngle2d: 200, xAngle2d: 321, yOffset2d: -51, xOffset2d: 67, zAngle2d: 189, zoom2d: 12345 });
    ObjType.types.Put(4n, obj);
    const appearance = (game.actors.self.appearance = new PlayerModel()),
        equipment = new Int32Array(12);
    equipment[8] = -2147483648;
    appearance.setAppearance(false, Int32Array.of(1, 2, 3, 4, 5), 0, equipment, -1);
    appearance['cachedModelKey'] = 0x123456789n;
    IdkType.m_recentUse.Put(3n, new IdkType());
    const oldCache = ClientScript.m_cache,
        oldCycle = InterfaceList.cycle,
        originalActive = ScriptRunner.activeComponent,
        originalDot = ScriptRunner.activeComponent2;
    const initialMenu = Minimenu.isOpen;
    const initialDrag = { component: ComponentDrag.component, parent: ComponentDrag.parent, dragMouseX: ComponentDrag.dragMouseX, dragMouseY: ComponentDrag.dragMouseY, cycles: ComponentDrag.cycles, started: ComponentDrag.started };
    ClientScript.m_cache = new LruHashTable<ClientScript>(128);
    InterfaceList.cycle = 134;
    ScriptRunner.activeComponent = ScriptRunner.activeComponent2 = null;
    const fields = componentFields(),
        target = (c: IfType | null) => (c === null ? '-' : c.id + ',' + c.childId);
    const snapshot = (c: IfType | null) => (c === null ? '-' : fields.reduce((hash, f) => mix(hash, valueHash(c[f.member])), 1).toString());
    try {
        expect(lines.length).toBe(scripts.length);
        for (const [i, ops] of scripts.entries()) {
            if (ops.some(o => o.op === 3108 || o.op === 3109)) {
                Minimenu.isOpen = ops[0].value === -7;
                Object.assign(ComponentDrag, { component: null, parent: null, dragMouseX: -1, dragMouseY: -2, started: true, cycles: 23 });
            }
            const code = new ClientScript();
            code.opcodes = Int32Array.from(ops, o => o.op);
            code.intOperands = Int32Array.from(ops, o => (typeof o.value === 'number' ? o.value : 0));
            code.stringOperands = ops.map(o => (typeof o.value === 'string' ? fromJsString(o.value) : null));
            ClientScript.m_cache.Put(BigInt(17000 + i), code);
            DelayedStateChange.varcs[1901] = -999;
            InterfaceList.dirty[0] = InterfaceList.dirty[1] = false;
            ScriptRunner.intStack.fill(-9801);
            ScriptRunner.stringStack.fill(null);
            const event = new HookReq();
            event.args = [17000 + i];
            reported = null;
            if (ops.some(o => o.op === 403 && o.value === 1)) {
                d.onLoad = event.args;
                ScriptRunner.OnLoad(1, ui.runner);
                d.onLoad = null;
            } else ui.runner.run(event);
            let ints = 1,
                strings = 1;
            for (let j = 0; j < 16; j++) {
                ints = mix(ints, ScriptRunner.intStack[j]);
                strings = mix(strings, valueHash(ScriptRunner.stringStack[j]));
            }
            const active = ScriptRunner.activeComponent,
                dot = ScriptRunner.activeComponent2;
            const result = [
                DelayedStateChange.varcs[1901],
                InterfaceList.dirty[0],
                InterfaceList.dirty[1],
                target(active),
                target(dot),
                snapshot(c),
                snapshot(d),
                snapshot(active),
                snapshot(dot),
                ints,
                strings,
                appearance['cachedModelKey'],
                appearance['modelKey'],
                ...(c.childSlots ?? []).map(snapshot),
                fault(reported)
            ];
            if (ops.some(o => o.op === 3108 || o.op === 3109)) result.push(target(ComponentDrag.component), target(ComponentDrag.parent), ComponentDrag.dragMouseX, ComponentDrag.dragMouseY, ComponentDrag.cycles, ComponentDrag.started);
            expect(result.join(' '), ops.map(o => o.op + ':' + o.value).join(' ')).toBe(lines[i]);
        }
    } finally {
        ClientScript.m_cache = oldCache;
        InterfaceList.cycle = oldCycle;
        ScriptRunner.activeComponent = originalActive;
        ScriptRunner.activeComponent2 = originalDot;
        ObjType.types.Reset();
        IdkType.m_recentUse.Reset();
        Object.assign(ComponentDrag, initialDrag);
        Minimenu.isOpen = initialMenu;
    }
}, 20000);

function fault(error: Error | null): string {
    if (error === null) return '-';
    const cause = error.cause;
    const kind = cause instanceof TypeError ? 'null' : cause instanceof RangeError ? (cause.message.toLowerCase().includes('array length') ? 'size' : 'bounds') : 'runtime';
    return error.message.split(' op:')[1] + '/' + kind;
}
