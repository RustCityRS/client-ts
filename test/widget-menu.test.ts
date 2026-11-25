import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Mouse from '#/client/ClientMouseListener.js';
import ObjType from '#/config/ObjType.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { menuArrayHash as hash } from './menuTrace.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Case = [number, number, number, number, number];
function cases(): Case[] {
    const rows: Case[] = [];
    for (let damage = -7; damage <= 7; damage++) for (const mode of [0, 1, 16]) for (const index of [-1, 0, 1, 2, 499, 500]) rows.push([0, damage, 0, mode, index]);
    for (let damage = -7; damage <= 7; damage++) for (const mode of [0, 3, 4, 9]) for (const index of [0, 1]) rows.push([1, damage, 0, mode, index]);
    for (let damage = 0; damage <= 17; damage++) for (let mode = 0; mode < 32; mode++) rows.push([1, 0, damage, mode, 0]);
    for (const family of [2, 3, 4, 5]) for (const damage of [0, 7, 9, 10, 11, 12, 16, 17]) for (const mode of [0, 3]) for (const index of [-1, 0, 4, 5, 9, 10, 32, 2147483647]) rows.push([family, 0, damage, mode, index]);
    for (let damage = -7; damage <= 7; damage++)
        for (const mode of [0, 1, 4, 16]) {
            rows.push([6, damage, 21, mode, 0]);
            for (const count of [-2147483648, -1, 0, 1, 2, 6, 50]) {
                rows.push([7, damage, count, mode, 0]);
                for (const index of [-1, 0, 1, 4, 6]) rows.push([8, damage, count, mode, index]);
            }
        }
    return rows;
}
function names(...values: (string | null)[]): (JagString | null)[] {
    return values.map(v => (v === null ? null : fromJsString(v)));
}

loginFixture(
    import.meta.url,
    'widget menu construction and partial menu writes match the original Java arrays',
    async () => {
        const rows = cases();
        const dir = mkdtempSync(join(tmpdir(), 'rs530-widgetmenu-'));
        let expected: string[];
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const build = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'WidgetMenuOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const child = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetMenuOracle'], { stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n') + '\n') });
            expect(child.exitCode, child.stderr.toString()).toBe(0);
            expected = child.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        expect(expected.length).toBe(rows.length);
        const m = Minimenu,
            obj = new ObjType(),
            sentinel = fromJsString('sentinel');
        obj.id = 21;
        obj.name = fromJsString('item');
        ObjType.types.Put(21n, obj);
        for (const [row, v] of rows.entries()) {
            const [family, damage, widgetDamage, mode, index] = v;
            const length = (slot: number) => (damage === slot ? (family === 6 ? 0 : 1) : 48);
            Reflect.set(m, 'option', damage === -1 ? null : new Array<JagString | null>(length(1)).fill(sentinel));
            Reflect.set(m, 'target', damage === -2 ? null : new Array<JagString | null>(length(2)).fill(sentinel));
            Reflect.set(m, 'cursor', damage === -3 ? null : new Int32Array(length(3)).fill(-31));
            Reflect.set(m, 'actions', damage === -4 ? null : new Int16Array(length(4)).fill(-32));
            Reflect.set(m, 'keys', damage === -5 ? null : new BigInt64Array(length(5)).fill(-33n));
            Reflect.set(m, 'paramB', damage === -6 ? null : new Int32Array(length(6)).fill(-34));
            Reflect.set(m, 'paramC', damage === -7 ? null : new Int32Array(length(7)).fill(-35));
            const c = new IfType();
            c.id = 0xabcde;
            c.childId = 8;
            c.buttonType = mode % 7;
            c.type = 2;
            c.if3 = true;
            c.baseWidth = 2;
            c.baseHeight = 1;
            c.itemX = widgetDamage === 14 ? -32 : widgetDamage === 15 ? 2147483647 - 40 : 0;
            c.itemY = 0;
            c.invSlotOffsetX = widgetDamage === 1 ? null : new Int32Array(widgetDamage === 2 ? 1 : 20);
            c.invSlotOffsetY = widgetDamage === 3 ? null : new Int32Array(widgetDamage === 4 ? 1 : 20);
            c.itemIds = widgetDamage === 5 ? null : widgetDamage === 6 ? Int32Array.of(22) : Int32Array.of(22, widgetDamage === 13 ? 0 : 22);
            Reflect.set(c, 'properties', widgetDamage === 9 ? null : new ServerActiveProperties(widgetDamage === 17 ? 0 : -1, -1));
            c.onOp = widgetDamage === 17 ? [] : null;
            obj.inventoryOps = widgetDamage === 7 ? names('Wear', 'Eat') : widgetDamage === 16 ? null : names('Wear', null, 'Take', 'Rub', 'Drop');
            c.invOptions = widgetDamage === 8 ? names('Zero', 'One') : names('Zero', null, 'Two', null, 'Four');
            c.operationNames = names('First', ' ', 'Third', null, 'Fifth', null, 'Seven', 'Eight', 'Nine', 'Last');
            c.opBaseValue = fromJsString('base');
            c.targetTextValue = fromJsString('target');
            c.buttonTextValue = fromJsString('button');
            c.targetVerbValue = fromJsString('use');
            c.opCursors = Int32Array.of(314, 315, 316, 317, 318, 319);
            if (widgetDamage === 10) requireNonNull(c.operationNames[9]).bytes = null;
            if (widgetDamage === 11) c.targetVerbValue.bytes = null;
            InterfaceList.pressedContinue = null;
            Client.hoveredSlotCom = null;
            m.hoverSlot = -8;
            m.defaultCursor = 53;
            m.objCursor = 64;
            m.targetCursor = 66;
            m.examineCursor = 67;
            m.objSelected = (mode & 4) === 0 ? 0 : 1;
            m.targetMode = (mode & 8) !== 0;
            m.targetFlags = 48;
            m.targetParam = -1;
            m.objComponent = c.id;
            m.objSlot = 0;
            m.objName = fromJsString('selected');
            m.targetName = fromJsString('cast');
            m.targetVerb = fromJsString('spell');
            Client.qaOpTest = (mode & 2) !== 0;
            m.showOpIndices = (mode & 1) !== 0;
            m.count = family >= 2 ? 0 : index;
            m.isOpen = (mode & 16) !== 0;
            m.mouseX = 51;
            m.mouseY = -52;
            m.deferred = mode & 3;
            m.deferredX = 41;
            m.deferredY = -42;
            Mouse.clickButton = (mode & 4) === 0 ? 0 : 1;
            Mouse.clickX = 61;
            Mouse.clickY = -62;
            Mouse.x = 71;
            Mouse.mouseY = -72;
            if (family >= 6) m.count = widgetDamage;
            if (family >= 7)
                for (let i = 0; i < 48; i++) {
                    if (m.option !== null && i < m.option.length) m.option[i] = fromJsString('o' + i);
                    if (m.target !== null && i < m.target.length) m.target[i] = fromJsString('t' + i);
                    if (m.cursor !== null && i < m.cursor.length) m.cursor[i] = 100 + i;
                    if (m.actions !== null && i < m.actions.length) m.actions[i] = [30, 1001, 1000, 12, 1002, 0][i % 6];
                    if (m.keys !== null && i < m.keys.length) m.keys[i] = (1n << 48n) + BigInt(i);
                    if (m.paramB !== null && i < m.paramB.length) m.paramB[i] = 1000 + i;
                    if (m.paramC !== null && i < m.paramC.length) m.paramC[i] = -1000 - i;
                }
            let fault = 'ok',
                result = -1;
            try {
                switch (family) {
                    case 6:
                        m.ResetMinimenu();
                        break;
                    case 7:
                        m.Sort();
                        break;
                    case 8:
                        m.remove(index, (mode & 1) !== 0);
                        break;
                    case 0:
                        m.AddEntry(sentinel, 32760, fromJsString('option'), -127, 359, 0x708090aabbccddeen, (mode & 1) === 0 ? -1 : 17);
                        break;
                    case 1:
                        Reflect.apply(m.AddComponent, m, [0, (mode & 1) === 0 ? 32 : 0, widgetDamage === 12 ? null : c]);
                        break;
                    case 2:
                        result = hash(m.withOpIndices(widgetDamage === 16 ? null : obj.inventoryOps, index));
                        break;
                    case 3:
                        result = Reflect.apply(m.GetIftypeOpName, m, [widgetDamage === 12 ? null : c, index])?.hashCode() ?? 0;
                        break;
                    case 4:
                        result = Reflect.apply(IfType.getOpCursor, IfType, [widgetDamage === 12 ? null : c, index]);
                        break;
                    case 5:
                        result = Reflect.apply(Client.TargetVerb, Client, [widgetDamage === 12 ? null : c])?.hashCode() ?? 0;
                        break;
                }
            } catch (caught) {
                let error = caught;
                while (error instanceof WrappedException && error.cause !== null) error = error.cause;
                fault = error instanceof TypeError ? 'null' : error instanceof RangeError ? 'bounds' : String(error);
            }
            const state = [fault, result, m.count, Client.hoveredSlotCom === c, m.hoverSlot, hash(m.option), hash(m.target), hash(m.cursor), hash(m.actions), hash(m.keys), hash(m.paramB), hash(m.paramC), m.mouseX, m.mouseY];
            expect(state.join(' '), v.join(' ')).toBe(expected[row]);
        }
    },
    30000
);
