import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import HashTable from '#/datastruct/HashTable.js';
import JagString, { fromJsString, toJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import SubInterface from '#/ui/SubInterface.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';

type Row = [flags: number, x: number, y: number, fault: number];

function draw([flags, x, y, fault]: Row): string {
    function widget(id: number, parentId: number, type: number, x: number, y: number, width: number, height: number) {
        return Object.assign(new IfType(), { id, parentId, type, x, y, width, height, buttonType: fault === 0 ? 1 : 0, buttonTextValue: fromJsString('W' + id) });
    }
    const back = widget(3, -1, 3, 0, 0, 90, 65);
    const parent = widget(10, -1, 0, 6, 4, 68, 53);
    Object.assign(parent, { scrollX: 5, scrollY: 7, scrollHeight: 74, if3: !!(flags & 16), noClickThrough: !!(flags & 1), hidden: !!(flags & 32) });
    const fixed = widget(11, 10, 3, 5, 7, 40, 36);
    const inv = widget(12, 10, 2, 6, 9, 64, 32);
    Object.assign(inv, { baseWidth: 2, baseHeight: 1, invSlotOffsetX: new Int32Array(20), invSlotOffsetY: new Int32Array(20), itemIds: new Int32Array(2) });
    parent.childSlots = [null, inv];
    const mount = widget(65536, -1, 3, 1, 3, 18, 20);
    const tip = widget(13, -1, 3, 2, 3, 64, 54);
    tip.clientCode = 1406;
    const top = [back, parent, fixed, tip];
    const view = new InterfaceView(top);
    IfType.m_list = [top, [mount]];
    IfType.m_open = [true, true];
    InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
    if (flags & 2) {
        InterfaceList.subInterfaces.put(Object.assign(new SubInterface(), { type: flags & 4 ? 1 : 0, group: 1 }), 10n);
    }
    Client.qaOpTest = !!(flags & 8);
    Minimenu.isOpen = !!(flags & 64);
    Minimenu.mouseX = x;
    Minimenu.mouseY = y;
    Object.assign(Minimenu, {
        cursor: new Int32Array(fault === 1 ? 0 : 64).fill(-3),
        actions: new Int16Array(fault === 2 ? 0 : 64).fill(19),
        option: new Array<JagString | null>(fault === 3 ? 0 : 64).fill(null),
        target: new Array<JagString | null>(fault === 4 ? 0 : 64).fill(null),
        paramB: new Int32Array(64),
        paramC: new Int32Array(64),
        keys: new BigInt64Array(64),
        count: 2,
        defaultCursor: 45,
        hoverSlot: -7,
        tooltipX: -5,
        tooltipY2: -5,
        tooltipComponent: null
    });
    Client.loopCycle = 7;
    Client.rectDebug = 0;
    Client.hoveredSlotCom = null;
    InterfaceList.rootCount = 0;
    InterfaceList.rectRedrawnLastFrame.fill(false);
    const pixels = new Int32Array(96 * 72);
    Pix2D.setPixels(pixels, 96, 72);
    Pix2D.setClipping(3, 1, 88, 62);
    let result = 'ok';
    try {
        view.draw();
    } catch (err) {
        if (!(err instanceof WrappedException) || !(err.cause instanceof RangeError)) throw err;
        result = err.context + '/ArrayIndexOutOfBoundsException';
    }
    const rows = Array.from({ length: Minimenu.count }, (_, i) => {
        const text = Minimenu.option[i],
            target = Minimenu.target[i];
        return [
            Minimenu.actions[i] ?? 'short',
            text === undefined ? 'short' : text === null ? '-' : toJsString(text),
            Minimenu.cursor[i] ?? 'short',
            Minimenu.paramC[i],
            target === undefined ? 'short' : target === null ? '-' : target === JagString.empty ? 'empty' : 'value'
        ].join(',');
    });
    const hovered = Reflect.get(Client, 'hoveredSlotCom') as IfType | null;
    return [result, rows.join(';'), [hovered?.id ?? -1, Minimenu.hoverSlot, parent.scrollY, InterfaceList.rootCount, Minimenu.tooltipComponent === tip, Minimenu.tooltipX, Minimenu.tooltipY2].join(',')].join('|');
}

loginFixture(import.meta.url, '530 widget draws build mouse-relative inventory and button rows, and reset them at modal layers', async () => {
    const dir = mkdtempSync(join(tmpdir(), '530-widget-menu-handoff-'));
    try {
        const rows: Row[] = [];
        for (let flags = 0; flags < 128; flags++) {
            for (const [x, y] of [
                [2, 1],
                [3, 1],
                [6, 4],
                [7, 7],
                [24, 26],
                [25, 27],
                [39, 12],
                [72, 33],
                [74, 57],
                [88, 62]
            ])
                rows.push([flags, x, y, 0]);
        }
        for (const flags of [1, 2, 3, 6, 9, 17, 33, 65]) for (let fault = 1; fault <= 4; fault++) rows.push([flags, 12, 10, fault]);
        const javac = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'WidgetMenuHandoffOracle.java')]);
        expect(javac.exitCode, javac.stderr.toString()).toBe(0);
        const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetMenuHandoffOracle'], {
            stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
            maxBuffer: 4 * 1024 * 1024
        });
        expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
        const answers = jvm.stdout.toString().trimEnd().split(/\r?\n/);
        expect(answers).toHaveLength(rows.length);
        for (const [i, row] of rows.entries()) expect(draw(row), row.join(' ')).toBe(answers[i]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
