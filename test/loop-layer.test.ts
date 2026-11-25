import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import Keyboard from '#/client/ClientKeyboardListener.js';
import Mouse from '#/client/ClientMouseListener.js';
import type SharedPtrList from '#/datastruct/SharedPtrList.js';
import SuperPacket from '#/io/SuperPacket.js';
import { ClientScript } from '#/script/ClientScript.js';
import type HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import Minimenu from '#/ui/Minimenu.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import WorldMap from '#/ui/WorldMap.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';

function queue(list: SharedPtrList<HookReq>): string {
    let hash = 1,
        count = 0;
    for (let event = list.takeFrontAndPop(); event !== null; event = list.takeFrontAndPop()) {
        for (const v of [Number(requireNonNull(event.args)[0]), requireNonNull(event.component).id, event.mouseX, event.mouseY, event.keyCode, event.keyChar, Number(event.mouseInput)]) hash = (Math.imul(hash, 31) + v) | 0;
        count++;
    }
    return count + ',' + hash;
}

function widget(index: number): IfType {
    const c = new IfType();
    Object.assign(c, {
        id: 65536 + index,
        parentId: -1,
        childId: -1,
        type: 3,
        if3: true,
        hasHook: true,
        x: 0,
        y: 0,
        width: 55,
        height: 39,
        properties: new ServerActiveProperties(6, -1),
        onClick: [31],
        onClickRepeat: [32],
        onTimer: [33],
        onMouseOver: [34],
        onKey: [35]
    });
    return c;
}

function hoverId(): number {
    return InterfaceList.mouseOverComponent?.id ?? -1;
}

async function trace(): Promise<void> {
    const script = new ClientScript();
    script.intLocals = 1;
    script.opcodes = Int32Array.of(33, 43, 0, 201, 21);
    script.intOperands = Int32Array.of(0, 1500, 0, 0, 0);
    const runner = new ScriptRunner(
        () => script,
        error => {
            throw error;
        }
    );
    const client = (Client.activeClient = new Client());
    const ui: InterfaceSession = Object.create(InterfaceSession.prototype);
    client['ui'] = ui;
    for (let i = 0; i < 300; i++) {
        const hot = widget(0),
            next = widget(1),
            action = i % 10,
            mode = ((i / 10) | 0) % 15;
        const row: (IfType | null)[] = [hot, next];
        let reads = 0;
        hot.onOp = mode === 5 ? null : [9131, -2147483644];
        hot.opKeyCode = mode === 1 ? Int8Array.of(-1) : Int8Array.of(10, 11);
        hot.opKeyModifier = mode === 2 ? null : Int8Array.of(0, 0);
        hot.opKeyRate = mode === 3 ? Int32Array.of(7) : Int32Array.of(7, 0);
        hot.keyNextCycles = mode === 4 ? new Int32Array(0) : null;
        hot.clientCode = mode === 6 ? 205 : mode === 7 ? 7 : 0;
        if (mode === 8) Object.assign(hot, { properties: null });
        if (mode === 9) hot.onKey = null;
        if (mode === 10) {
            hot.if3 = false;
            hot.overLayer = 2;
        }
        IfType.m_list = [null, mode === 12 ? null : row];
        IfType.m_open = mode === 11 ? [] : [false, true];
        const unexpected = (): never => {
            throw Error('unexpected group request');
        };
        IfType.m_pInterfaces = new Js5(
            {
                index() {
                    if (++reads === 1) {
                        switch (action) {
                            case 1:
                                Mouse.x = -700;
                                Mouse.mouseY = 700;
                                Mouse.clickX = -51;
                                Mouse.clickY = 100;
                                Mouse.mouseButton = Mouse.clickButton = 0;
                                break;
                            case 2:
                                Minimenu.isOpen = true;
                                break;
                            case 3:
                                hot.opKeyRate = null;
                                break;
                            case 4:
                                hot.clientCode = 205;
                                break;
                            case 5:
                                Object.assign(hot, { properties: null });
                                break;
                            case 6:
                                Keyboard.pressed[11] = false;
                                break;
                            case 7:
                                row[1] = null;
                                break;
                            case 8:
                                hot.opKeyCode = null;
                                break;
                            case 9:
                                Keyboard.count = 129;
                                break;
                        }
                    }
                    return null;
                },
                group: unexpected,
                prefetchGroup: unexpected,
                GetGroupLoadPercentage: unexpected
            },
            true,
            true
        );
        const packet = (Client.out = new SuperPacket(mode === 13 ? 3 : 32));
        if (mode !== 14) packet.SetEnc(Int32Array.of(1, 2, 5, 8));
        ComponentDrag.component = ComponentDrag.parent = ComponentDrag.target = null;
        Mouse.x = 5;
        Mouse.mouseY = 6;
        Mouse.clickX = 9;
        Mouse.clickY = 11;
        Mouse.mouseButton = Mouse.clickButton = 1;
        Minimenu.isOpen = false;
        Minimenu.objDragComponent = null;
        Keyboard.pressed[10] = true;
        Keyboard.pressed[11] = i >= 150;
        Keyboard.count = 2;
        Keyboard.codes[0] = 7;
        Keyboard.codes[1] = 12;
        Keyboard.chars[0] = 24;
        Keyboard.chars[1] = 67;
        Client.loopCycle = 8;
        Client.transmitCycle = 17;
        DelayedStateChange.varcs[1500] = -455;
        Client.logoutTimer = -22;
        WorldMap.dragging = 0;
        InterfaceList.mouseOverComponent = null;
        let status = 'ok';
        // On alternate calls simulate a browser read inside the current gh hook.
        const resumed = {
            run: async (e: HookReq) => {
                await Promise.resolve();
                await runner.run(e);
            }
        };
        Object.assign(ui, { runner: i % 2 === 0 ? runner : resumed });
        try {
            await Client.LoopInterface(1, -7, -9, 89, 67, 4, 2);
        } catch (caught) {
            let e = caught;
            while (e instanceof WrappedException) e = e.cause;
            status = e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : String(e);
        }
        console.log(
            [
                status,
                reads,
                DelayedStateChange.varcs[1500],
                Client.logoutTimer,
                hot.keyNextCycles === null ? 'null' : '[' + hot.keyNextCycles.join(', ') + ']',
                hot.pressed,
                hot.mouseOver,
                hot.lastTransmitCycle,
                next.lastTransmitCycle,
                hoverId(),
                packet.m_pos,
                Buffer.from(requireNonNull(packet.m_data)).toString('hex'),
                queue(requireNonNull(Client.timerEvents)),
                queue(requireNonNull(Client.mouseExit)),
                queue(requireNonNull(Client.m_hookQueue))
            ].join(' ')
        );
    }
}

if (process.argv[2] === 'trace') await trace();
else {
    const { expect, test } = await import('bun:test');
    test('LoopInterface and LoopLayer preserve native hotkey re-entry, input rereads and partial queue/packet failures', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-loop-layer-'));
        try {
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui', 'LoopLayerOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'LoopLayerOracle']);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const ts = Bun.spawnSync([process.execPath, import.meta.path, 'trace']);
            expect(ts.exitCode, ts.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/),
                actual = ts.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(300);
            expect(actual.length).toBe(300);
            for (let i = 0; i < expected.length; i++) expect(actual[i], String(i)).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 20000);
}
