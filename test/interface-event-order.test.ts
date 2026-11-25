import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import WrappedException from '#/util/WrappedException.js';
import Mouse from '#/client/ClientMouseListener.js';
import Keyboard from '#/client/ClientKeyboardListener.js';
import MouseWheel from '#/client/MouseWheel.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import type HookReq from '#/script/HookReq.js';
import IfType, { type Hook, type HookName } from '#/ui/IfType.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import WorldMap from '#/ui/WorldMap.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Slot = [object, string];
type Change = [mode: number, watch: string, occurrence: number, target: string, replacement: string];
const hooks: [string, HookName][] = [
    ['Pc', 'onScrollWheel'],
    ['Gc', 'onClick'],
    ['pc', 'onClickRepeat'],
    ['g', 'onRelease'],
    ['W', 'onHold'],
    ['Tc', 'onMouseOver'],
    ['Pb', 'onMouseRepeat'],
    ['V', 'onMouseLeave'],
    ['J', 'onTimer'],
    ['dc', 'onVarcTransmit'],
    ['qc', 'onVarcstrTransmit'],
    ['Lc', 'onVarTransmit'],
    ['Zc', 'onInvTransmit'],
    ['Z', 'onStatTransmit'],
    ['p', 'onChatTransmit'],
    ['u', 'onFriendTransmit'],
    ['od', 'onClanTransmit'],
    ['K', 'onStockTransmit'],
    ['gd', 'onMiscTransmit'],
    ['x', 'onKey'],
    ['nb', 'onCamFinished']
];
const transmits = [
    ['dc', 'U', 'varcTriggers', 'sd', 'lastVarcTransmit', 'lc.t', 'varcChanges', 'e.a', 'updatedVarcs'],
    ['qc', 'sc', 'varcstrTriggers', 'o', 'lastVarcStringTransmit', 'uc.i', 'varcStrChangeCount', 'rg.o', 'updatedVarcStrings'],
    ['Lc', 'c', 'varTriggers', 'b', 'lastVarTransmit', 'qg.B', 'varpTransmitCount', 'ii.c', 'varpUpdates'],
    ['Zc', 'Rb', 'invTriggers', 'rd', 'lastInvTransmit', 'b.I', 'invTransmitCount', 'pa.zb', 'changedInvs'],
    ['Z', 'Qb', 'statTriggers', 'Nc', 'lastStatTransmit', 'od.V', 'changedStatCount', 'ld.d', 'statUpdates']
] as const;

function vectors(): Change[] {
    const rows: Change[] = [];
    for (let mode = 0; mode < 6; mode++) rows.push([mode, 'aj.J', 0, 'aj.J', 'null']);
    for (const [name] of hooks) {
        const mode = name === 'g' || name === 'V' ? 1 : 0;
        const hook = 'aj.' + name;
        const queue = name === 'J' ? 'db.s' : mode === 1 ? 'ra.r' : 'mi.q';
        for (const action of ['null', 'hook']) for (const read of [1, 2, 3]) rows.push([mode, hook, read, hook, action]);
        // The second listener read supplies wf.G after constructing the event.
        for (const value of ['null', 'queue']) rows.push([mode, hook, 2, queue, value]);
        rows.push([mode, hook, 2, hook, 'throw']);
    }
    for (const [name, trigger, , cursor, , counter, , ring] of transmits) {
        for (const read of [1, 2, 3, 4, 5, 6, 7, 8]) {
            rows.push([0, counter, read, counter, '1'], [0, 'aj.' + trigger, read, 'aj.' + trigger, 'null']);
        }
        for (const read of [1, 2, 3]) {
            rows.push([0, ring, read, ring, 'null'], [0, ring, read, ring, 'short'], [0, ring, read, ring, 'match']);
            rows.push([0, 'aj.' + cursor, read, 'aj.' + cursor, '2'], [0, 'aj.' + trigger, read, counter, '1']);
        }
        // A counter may change after receipt but before the unconditional cursor store.
        rows.push([0, 'aj.' + name, 2, counter, '77'], [0, 'aj.' + name, 2, 'mi.q', 'null']);
        // Signed overflowing distance on a valid > comparison still takes the ring branch.
        rows.push([2, ring, 1, ring, 'short'], [3, ring, 2, ring, 'short'], [4, 'aj.' + trigger, 1, ring, 'null']);
    }
    for (const read of [1, 2, 3, 4, 5, 6]) {
        for (const mouse of ['sj.C', 'pf.Q', 'sa.x', 'oj.e']) rows.push([0, mouse, read, mouse, '55']);
        rows.push([0, 'kf.l', read, 'kf.l', '-13'], [0, 'ok.D', read, 'ok.D', '1']);
        for (const keyboard of ['sc.T', 'hd.i']) {
            rows.push([0, keyboard, read, keyboard, 'short'], [0, keyboard, read, keyboard, 'null'], [0, keyboard, read, 'aj.x', 'hook']);
        }
        rows.push([0, 'aj.Mc', read, 'aj.Mc', '20'], [0, 'mi.q', read, 'mi.q', 'queue'], [1, 'ra.r', read, 'ra.r', 'null']);
    }
    rows.push(
        [0, 'aj.pc', 1, 'sj.C', '82'],
        [0, 'aj.pc', 2, 'pf.Q', '71'],
        [0, 'aj.Pc', 2, 'kf.l', '-29'],
        [0, 'aj.J', 1, 'aj.Lc', 'null'],
        [0, 'aj.J', 2, 'tk.a', 'false'],
        [0, 'aj.u', 1, 'qe.N', '0'],
        [0, 'aj.x', 2, 'ok.D', '1'],
        [0, 'hd.i', 1, 'sc.T', 'null'],
        [0, 'kf.l', 1, 'ie.F', 'true'],
        [0, 'aj.i', 1, 'aj.i', 'false'],
        [0, 'aj.i', 2, 'aj.i', 'false'],
        [0, 'aj.J', 1, 'aj.i', 'false'],
        [0, 'aj.J', 2, 'aj.Xc', 'false'],
        [0, 'aj.Fc', 2, 'aj.Fc', 'false'],
        [1, 'aj.Fc', 1, 'aj.Xc', 'false'],
        [0, 'aj.J', 2, 'bb.e', '-99'],
        [0, 'aj.x', 2, 'bb.e', '-99'],
        [0, 'aj.x', 2, 'hd.i', 'short']
    );
    for (const mode of [6, 7, 8])
        for (const read of [1, 2]) {
            for (const value of ['null', 'hook', 'throw']) rows.push([mode, 'aj.ic', read, 'aj.ic', value]);
            for (const value of ['null', 'queue']) rows.push([mode, 'aj.ic', read, 'mi.q', value]);
            rows.push([mode, 'aj.C', read, 'aj.H', '3'], [mode, 'mi.q', read, 'aj.ic', 'null']);
        }
    return rows;
}

function drain(list: SharedPtrList<HookReq>, widget: IfType, installed: Set<Hook>): string {
    const values: string[] = [];
    for (let event = list.takeFrontAndPop(); event !== null; event = list.takeFrontAndPop()) {
        values.push([event.args === null ? '-' : installed.has(event.args) ? event.args[0] : 'copy', +(event.component === widget), +event.mouseInput, event.mouseX, event.mouseY, event.keyCode, event.keyChar].join(','));
    }
    return values.join('/');
}

async function run([mode, watch, at, target, action]: Change): Promise<string> {
    const widget = new IfType();
    Object.assign(widget, {
        id: 47,
        parentId: -1,
        childId: -1,
        type: 3,
        if3: true,
        hasHook: true,
        x: 2,
        y: 3,
        width: 50,
        height: 40,
        properties: new ServerActiveProperties(0, -1),
        mouseOver: mode === 1,
        pressed: mode === 1,
        lastTransmitCycle: 2,
        baseWidth: mode === 7 ? 50 : 19,
        baseHeight: mode === 7 ? 40 : 21
    });
    const installed = new Set<Hook>();
    widget.onResize = [22];
    installed.add(widget.onResize);
    const slots: Record<string, Slot> = {
        'aj.Mc': [widget, 'lastTransmitCycle'],
        'mi.q': [Client, 'm_hookQueue'],
        'ra.r': [Client, 'mouseExit'],
        'db.s': [Client, 'timerEvents'],
        'sj.C': [Mouse, 'x'],
        'pf.Q': [Mouse, 'mouseY'],
        'sa.x': [Mouse, 'clickX'],
        'oj.e': [Mouse, 'clickY'],
        'kf.l': [MouseWheel, 'rotation'],
        'ok.D': [Keyboard, 'count'],
        'sc.T': [Keyboard, 'codes'],
        'hd.i': [Keyboard, 'chars'],
        'ie.F': [Minimenu, 'isOpen'],
        'qe.N': [Client, 'clanTransmitCycle'],
        'tk.a': [CinematicCamera, 'justEnded'],
        'aj.ic': [widget, 'onResize'],
        'aj.C': [widget, 'width'],
        'aj.H': [widget, 'height'],
        'aj.i': [widget, 'hasHook'],
        'aj.Xc': [widget, 'mouseOver'],
        'aj.Fc': [widget, 'pressed'],
        'bb.e': [Client, 'transmitCycle']
    };
    for (const [i, [obf, name]] of hooks.entries()) {
        slots['aj.' + obf] = [widget, name];
        const args = [i + 1];
        installed.add(args);
        widget[name] = args;
    }
    const count = mode === 3 ? 1 : mode === 4 ? 33 : mode === 5 ? -2147483646 : 4;
    const prev = mode === 2 ? -2147483648 : mode === 3 ? -2 : mode === 5 ? 2147483646 : 0;
    for (const [, tr, trigger, pos, cursor, ct, counter, rg, ring] of transmits) {
        slots['aj.' + tr] = [widget, trigger];
        slots['aj.' + pos] = [widget, cursor];
        slots[ct] = [Client, counter];
        slots[rg] = [Client, ring];
        const values = new Int32Array(32);
        values[2] = values[31] = 42;
        if (mode === 2) values[0] = 42;
        Reflect.set(Client, ring, values);
        Reflect.set(Client, counter, count);
        widget[trigger] = Int32Array.of(73, 42);
        widget[cursor] = prev;
    }
    const main = new SharedPtrList<HookReq>(),
        exits = new SharedPtrList<HookReq>(),
        timers = new SharedPtrList<HookReq>(),
        alternate = new SharedPtrList<HookReq>();
    Reflect.set(Client, 'm_hookQueue', main);
    Reflect.set(Client, 'mouseExit', exits);
    Reflect.set(Client, 'timerEvents', timers);
    Mouse.x = mode === 1 ? -8 : 8;
    Mouse.mouseY = 12;
    Mouse.clickX = 15;
    Mouse.clickY = 16;
    Mouse.clickButton = Mouse.mouseButton = mode === 1 ? 0 : 1;
    ComponentDrag.component = ComponentDrag.parent = null;
    Minimenu.isOpen = false;
    Minimenu.objDragComponent = null;
    WorldMap.dragging = 0;
    MouseWheel.rotation = 3;
    Client.transmitCycle = 30;
    Client.chatTransmitCycle = Client.friendListTransmitCycle = Client.clanTransmitCycle = Client.stockTransmitCycle = InterfaceList.miscTransmitAt = 9;
    CinematicCamera.justEnded = true;
    Keyboard.count = 2;
    Reflect.set(Keyboard, 'codes', Int32Array.of(50, 51));
    Reflect.set(Keyboard, 'chars', Int32Array.of(61, 62));
    const [owner, key] = slots[watch],
        [destination, property] = slots[target];
    const descriptor = requireNonNull(Object.getOwnPropertyDescriptor(owner, key));
    let value: unknown = descriptor.value,
        reads = 0;
    const stop = new Error('field read');
    Object.defineProperty(owner, key, {
        configurable: true,
        get() {
            if (++reads === at) {
                if (action === 'throw') throw stop;
                let replacement;
                if (action === 'null') {
                    replacement = null;
                } else if (action === 'hook') {
                    replacement = [999];
                } else if (action === 'queue') {
                    replacement = alternate;
                } else if (action === 'short') {
                    replacement = new Int32Array(1);
                } else if (action === 'match') {
                    replacement = new Int32Array(32).fill(42);
                } else if (action === 'true') {
                    replacement = true;
                } else if (action === 'false') {
                    replacement = false;
                } else {
                    replacement = Number(action);
                }
                if (Array.isArray(replacement)) installed.add(replacement);
                Reflect.set(destination, property, replacement);
            }
            return value;
        },
        set(v: unknown) {
            value = v;
        }
    });
    let result = 'ok';
    try {
        if (mode >= 6) Client.InterfaceCalculateSize(widget, 100, mode !== 8, 100);
        else await Client.LoopLayer([widget], -1, 0, 0, 100, 100, 2, 3);
    } catch (e) {
        const cause = e instanceof WrappedException ? e.cause : e;
        if (cause === stop) result = 'stop';
        else if (cause instanceof RangeError) result = 'bounds';
        else if (cause instanceof TypeError) result = 'null';
        else throw e;
    } finally {
        Object.defineProperty(owner, key, { ...descriptor, value });
    }
    return [
        result,
        reads,
        [+widget.pressed, +widget.mouseOver, widget.lastTransmitCycle, widget.width, widget.height, ...transmits.map(row => widget[row[4]])].join(','),
        drain(main, widget, installed),
        drain(exits, widget, installed),
        drain(timers, widget, installed),
        drain(alternate, widget, installed)
    ].join(';');
}

loginFixture(
    import.meta.url,
    'LoopLayer preserves live event operands and partial widget queues',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-event-order-'));
        const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const cp = [dir, gamepackPath].join(delimiter);
        const rows = vectors();
        try {
            for (const cmd of [
                ['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'InterfaceEventOrderOracle.java')],
                ['java', ...asm, '-cp', cp, 'InterfaceEventOrderOracle', dir]
            ]) {
                const p = Bun.spawnSync(cmd);
                expect(p.exitCode, p.stderr.toString()).toBe(0);
            }
            const java = Bun.spawnSync(['java', ...asm, '-Djava.awt.headless=true', '-cp', cp, 'InterfaceEventOrderOracle'], {
                stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n') + '\n'),
                maxBuffer: 8 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(await run(row), row.join(' ')).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
