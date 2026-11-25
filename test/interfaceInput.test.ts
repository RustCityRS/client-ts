import DelayedStateChange from '#/ui/DelayedStateChange.js';
import FriendChatChannel from '#/client/FriendChatChannel.js';
import InterfaceInputFixture from './interfaceInputFixture.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import MouseWheel from '#/client/MouseWheel.js';
import Client from '#/client/Client.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import LruHashTable from '#/datastruct/LruHashTable.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type SharedPtrList from '#/datastruct/SharedPtrList.js';
import { ClientScript } from '#/script/ClientScript.js';
import type HookReq from '#/script/HookReq.js';
import ChatHistory from '#/game/ChatHistory.js';
import IfType from '#/ui/IfType.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import SubInterface from '#/ui/SubInterface.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import WorldMap from '#/ui/WorldMap.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { cachePath, gamepackPath } from './reference.js';
import { localAssets } from './cachefile.js';

const hooks = ['onClick', 'onClickRepeat', 'onRelease', 'onHold', 'onMouseOver', 'onMouseRepeat', 'onMouseLeave', 'onTimer', 'onScrollWheel', 'onKey', 'onStockTransmit', 'onCamFinished', 'onOp', 'onDrag', 'onDragComplete'] as const;
// id, parent, type, flags (if3, hook, hidden, block), x, y, width, height, scrollX, scrollY, scrollHeight, content, events, hover, child.
const config = [
    [0, -1, 0, 3, 3, 4, 150, 108, 5, 6, 180, 0, 0, -1, -1],
    [1, 0, 3, 3, 5, 7, 55, 30, 0, 0, 0, 0, 14, -1, -1],
    [2, 0, 0, 11, 10, 10, 30, 25, 0, 0, 0, 0, 0, -1, -1],
    [3, 0, 3, 3, 48, 15, 30, 23, 0, 0, 0, 0, 1 << 18, -1, -1],
    [4, 0, 3, 3, 78, 16, 21, 40, 0, 0, 0, 0, 1 << 21, -1, -1],
    [5, 0, 9, 7, 64, 65, 0, 0, 0, 0, 0, 0, 2, -1, -1],
    [6, 0, 2, 3, 393, 900, 0, 0, 0, 0, 0, 1338, 0, -1, -1],
    [7, 0, 0, 3, 68, 68, 30, 32, 6, 7, 0, 0, 0, -1, -1],
    [8, 0, 8, 0, 105, 16, 25, 70, 0, 12, 165, 0, 0, 9, -1],
    [9, 0, 3, 3, 190, 0, 30, 30, 0, 0, 0, 0, 0, -1, -1],
    [10, 0, 3, 3, 10, 60, 40, 20, 0, 0, 0, 1337, 0, -1, -1],
    [0, 0, 3, 3, 30, 30, 35, 27, 0, 0, 0, 0, 0, -1, 0],
    [65536, -1, 0, 3, 1, 1, 28, 28, 3, 5, 0, 0, 0, -1, -1],
    [65537, 65536, 3, 3, 3, 5, 20, 20, 0, 0, 0, 0, 0, -1, -1]
];

test('native client.a input tree and fl.b drags match widget state, hooks and ISAAC output', () => {
    const steps: number[][] = [];
    function step(x: number, y: number, button = 0, click = 0, wheel = 0, menu = 0, qa = 0, blockHidden = 1, objDrag = 0, mapDrag = 0, cam = 0, stock = 0, keys = 0): void {
        steps.push([steps.length, x, y, button, click, x, y, wheel, menu, qa, blockHidden, objDrag, mapDrag, cam, stock, keys]);
    }
    step(10, 10, 1, 1, -1);
    step(11, 15, 1);
    step(11, 15, 0, 0, 2, 0, 0, 0);
    step(80, 70, 0, 0, 1);
    step(62, 63, 0, 0, 0, 0, 1);
    step(111, 50, 0, 0, 1);
    step(134, 16, 1);
    step(134, 80, 2);
    step(136, 44, 1);
    step(151, 45, 1);
    step(115, 47, 1);
    step(109, 84, 0, 0, -2);
    step(55, 19, 1, 1);
    step(74, 24, 1);
    step(89, 31, 1);
    step(91, 32, 0);
    step(55, 19, 1, 1);
    step(55, 19, 1);
    step(55, 19);
    step(132, 44, 0, 0, 2, 1, 1);
    step(10, 15, 1, 1, 2, 0, 0, 1, 1);
    step(10, 15, 1, 1, 2, 0, 0, 1, 0, 1, 1, 99);
    for (const keys of [7, 7, 7, 0, 7, 63, 63, 63, 63, 0, 55]) step(-5, -5, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, keys);
    // Half-open clip boundaries, one-pixel lines, duplicate pointer targets and a mounted group.
    for (let i = 0; i < 600; i++)
        step(((i * 61) % 190) - 8, ((i * 43) % 135) - 7, i % 9 === 0 ? 1 : 0, i % 17 === 0 ? 1 : 0, i % 11 === 0 ? -1 : 0, +(i % 31 === 0), i & 1, +(i % 4 !== 0), +(i % 37 === 0), +(i % 29 === 0), +(i % 19 === 0), i % 23 === 0 ? i + 1 : 0, i % 29);
    const out = resolve(import.meta.dir, '../out');
    mkdirSync(out, { recursive: true });
    const tmp = mkdtempSync(join(out, 'component-input-'));
    let lines: string[];
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', tmp, fileURLToPath(new URL('./ui/InterfaceInputOracle.java', import.meta.url))]);
        if (build.exitCode !== 0) throw Error(build.stderr.toString());
        const stdin = [...config.map((spec, i) => [i, ...spec]), ...steps].map(row => row.join(',')).join('\n') + '\n';
        const r = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', tmp + delimiter + gamepackPath, 'InterfaceInputOracle'], { stdin: Buffer.from(stdin), maxBuffer: 20_000_000 });
        if (r.exitCode !== 0) throw Error(r.stderr.toString());
        lines = r.stdout.toString().trim().split(/\r?\n/);
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }
    const ui = new InterfaceSession(new InterfaceView([]), localAssets(cachePath, [3, 12]));
    const widgets = config.map(([id, parent, type, flags, x, y, width, height, scrollX, scrollY, scrollHeight, content, mask, hover, child], i) => {
        const c = new IfType();
        Object.assign(c, {
            id,
            parentId: parent,
            type,
            if3: !!(flags & 1),
            hasHook: !!(flags & 2),
            hidden: !!(flags & 4),
            noClickThrough: !!(flags & 8),
            x,
            y,
            width,
            height,
            scrollX,
            scrollY,
            scrollHeight,
            clientCode: content,
            properties: new ServerActiveProperties(mask, -1),
            overLayer: hover,
            childId: child,
            drawCycle: 9,
            rootIndex: i,
            dragDeadZone: 2,
            dragDeadTime: 1
        });
        for (const [j, hook] of hooks.entries()) c[hook] = [9001, i * 20 + j, -2147483647, -2147483646, -2147483642, -2147483641, -2147483644];
        return c;
    });
    const index = (c: IfType | null) => (c === null ? -1 : widgets.indexOf(c));
    const trace = (q: SharedPtrList<HookReq>) => {
        const a: string[] = [];
        for (let e = q.takeFrontAndPop(); e !== null; e = q.takeFrontAndPop()) a.push([requireNonNull(e.args)[1], index(e.component), e.mouseX, e.mouseY, e.keyCode, e.keyChar, +e.mouseInput].join(','));
        return a.join(';');
    };
    IfType.m_list = [widgets.slice(0, 11), widgets.slice(12)];
    IfType.m_open = [true, true];
    widgets[0].childSlots = [widgets[11]];
    const sub = new SubInterface();
    sub.group = 1;
    InterfaceList.subInterfaces.put(sub, 7n);
    widgets[1].opKeyCode = Int8Array.of(16, 17, 18);
    widgets[1].opKeyModifier = Int8Array.of(0, 3, 4);
    widgets[1].opKeyRate = Int32Array.of(0, 2, 3);
    const ops = [42],
        args = [2];
    for (let i = 0; i < 6; i++) {
        ops.push(0, 4002, 33, 4000);
        args.push(31, 0, i, 0);
    }
    ops.push(43, 21);
    args.push(2, 0);
    const script = new ClientScript();
    script.opcodes = Int32Array.from(ops);
    script.intOperands = Int32Array.from(args);
    script.stringOperands = new Array(ops.length).fill(null);
    script.intLocals = 6;
    const oldScriptCache = ClientScript.m_cache;
    ClientScript.m_cache = new LruHashTable<ClientScript>(128);
    ClientScript.m_cache.Put(9001n, script);
    const d = ComponentDrag;
    const originalHover = InterfaceList.mouseOverComponent,
        originalTip = Client.tooltipComponent;
    const originalMapX = Client.minimapClickX,
        originalMapY = Client.minimapClickY;
    const previousButton = ClientMouseListener.mouseButton,
        previousWheel = MouseWheel.rotation,
        previousMenu = Minimenu.isOpen;
    const previousX = ClientMouseListener.x,
        previousY = ClientMouseListener.mouseY;
    const shot = Object.getOwnPropertyDescriptors(CinematicCamera),
        eye = Object.getOwnPropertyDescriptors(OrbitCamera),
        oldPaths = CinematicCamera.paths.slice();
    CinematicCamera.positionPath = CinematicCamera.lookPath = CinematicCamera.positionSegment = CinematicCamera.lookSegment = 0;
    CinematicCamera.paths[0] = Array.from({ length: 4 }, () => new Int32Array(3));
    CinematicCamera.startRate = CinematicCamera.endRate = 1;
    const originalRedraw = InterfaceList.cycle,
        originalClock = Client.loopCycle;
    function reset(): void {
        d.component = d.parent = d.target = null;
        d.visible = d.parentVisible = d.started = false;
        d.x = d.y = d.parentX = d.parentY = -1;
        d.cycles = d.dragMouseX = d.dragMouseY = 0;
        Minimenu.objDragComponent = Client.tooltipComponent = InterfaceList.mouseOverComponent = InterfaceList.viewportComponent = null;
        Client.scrollGrabbed = CinematicCamera.justEnded = false;
        Client.stockTransmitCycle = Client.minimapClickX = Client.minimapClickY = Client.scrollInputPadding = WorldMap.dragging = 0;
        Client.transmitCycle = 1;
        InterfaceList.dirty.fill(false);
        Client.qaOpTest = false;
        for (const q of [Client.m_hookQueue, Client.mouseExit, Client.timerEvents]) requireNonNull(q).clear();
    }
    const nativeInput = new InterfaceInputFixture(ui);
    reset();
    Client.friendCount = Client.friendState = FriendChatChannel.memberCount = 0;
    FriendChatChannel.members = FriendChatChannel.channelName = null;
    ChatHistory.text.fill(null);
    ChatHistory.count = 0;
    DelayedStateChange.varcs[2] = 0;
    InterfaceList.cycle = 9;
    Client.out.SetEnc(Int32Array.of(0, 3, 5, 8));
    try {
        for (const [step, x, y, button, click, cx, cy, wheel, menu, qa, hidden, objDrag, mapDrag, cam, stock, keys] of steps) {
            ClientMouseListener.x = x;
            ClientMouseListener.mouseY = y;
            ClientMouseListener.mouseButton = button;
            MouseWheel.rotation = wheel;
            Minimenu.isOpen = !!menu;
            widgets[2].hidden = !!hidden;
            Minimenu.objDragComponent = objDrag ? widgets[1] : null;
            WorldMap.dragging = mapDrag;
            CinematicCamera.progress = cam ? 65534 : 3;
            CinematicCamera.ended = false;
            CinematicCamera.spline();
            Client.stockTransmitCycle = stock;
            Client.transmitCycle = step + 1;
            Client.loopCycle = step;
            Client.qaOpTest = !!qa;
            const heldCodes = new Array<boolean>(112).fill(false);
            for (const [bit, key] of [16, 17, 18, 81, 82, 86].entries()) heldCodes[key] = !!(keys & (1 << bit));
            const input = {
                x,
                y,
                button,
                held: button === 1,
                click: click ? { x: cx, y: cy } : undefined,
                wheel,
                menuOpen: !!menu,
                heldCodes,
                keys: [
                    { keyCode: 48, keyChar: -1 },
                    { keyCode: -1, keyChar: 65 }
                ]
            };
            d.target = null;
            d.visible = d.parentVisible = false;
            InterfaceList.mouseOverComponent = Client.tooltipComponent = null;
            InterfaceList.dirty.fill(false);
            const packet = Client.out,
                pos = packet.m_pos;
            nativeInput.set(input);
            Client.LoopInterface(0, 0, 0, 160, 120, 0, 0);
            const row = [trace(requireNonNull(Client.timerEvents)), trace(requireNonNull(Client.mouseExit)), trace(requireNonNull(Client.m_hookQueue))];
            if (d.component !== null) Client.LoopIf3Drag(ui.runner, ui);
            const state = [
                index(d.component),
                index(d.parent),
                index(d.target),
                +d.visible,
                +d.parentVisible,
                d.x,
                d.y,
                d.parentX,
                d.parentY,
                d.dragMouseX,
                d.dragMouseY,
                d.cycles,
                +d.started,
                index(InterfaceList.mouseOverComponent),
                index(Client.tooltipComponent),
                +Client.scrollGrabbed,
                Client.scrollInputPadding,
                Client.minimapClickX,
                Client.minimapClickY,
                WorldMap.dragging,
                index(InterfaceList.viewportComponent),
                DelayedStateChange.varcs[2]
            ];
            row.push('[' + state.join(', ') + ']', widgets[1].keyNextCycles === null ? 'null' : '[' + Array.from(widgets[1].keyNextCycles).join(', ') + ']', Buffer.from(requireNonNull(packet.m_data).subarray(pos, packet.m_pos)).toString('hex'));
            for (const c of widgets) row.push([+c.pressed, +c.mouseOver, c.scrollY, c.lastTransmitCycle, +InterfaceList.dirty[c.rootIndex]].join(','));
            expect(row.join('|'), 'tick ' + step).toBe(lines[step]);
        }
    } finally {
        nativeInput.restore();
        ClientScript.m_cache = oldScriptCache;
        reset();
        InterfaceList.cycle = originalRedraw;
        InterfaceList.subInterfaces.clear();
        InterfaceList.top = -1;
        InterfaceList.mouseOverComponent = originalHover;
        Client.tooltipComponent = originalTip;
        Client.minimapClickX = originalMapX;
        Client.minimapClickY = originalMapY;
        DelayedStateChange.varcs[2] = 0;
        Client.loopCycle = originalClock;
        ClientMouseListener.mouseButton = previousButton;
        MouseWheel.rotation = previousWheel;
        Minimenu.isOpen = previousMenu;
        Object.defineProperties(CinematicCamera, shot);
        CinematicCamera.paths.splice(0, 2, ...oldPaths);
        Object.defineProperties(OrbitCamera, eye);
        ClientMouseListener.x = previousX;
        ClientMouseListener.mouseY = previousY;
    }
}, 20000);
