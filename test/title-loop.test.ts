import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Keyboard from '#/client/ClientKeyboardListener.js';
import Mouse from '#/client/ClientMouseListener.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import TitleFlames from '#/title/TitleFlames.js';
import Js5 from '#/cache/Js5.js';
import { mathRandom } from '#/util/JavaRandom.js';
import PixScreen, { CanvasComponent } from '#/graphics/PixScreen.js';
import { requireNonNull } from '#/util/JavaArray.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import type SharedPtrList from '#/datastruct/SharedPtrList.js';
import { gamepackPath } from './reference.js';

async function trace(): Promise<void> {
    const client = new Client();
    const ui: InterfaceSession = Object.create(InterfaceSession.prototype);
    Object.assign(ui, { runner: new ScriptRunner(ClientScript.Get), properties: Client.GetActive });
    client['ui'] = ui;
    let script = 0;
    let adverts = 0;
    const refresh = Client.refreshToolbar;
    Client.refreshToolbar = () => {
        adverts++;
        refresh();
    };
    function event(component: IfType | null, digit: number): HookReq {
        const code = new ClientScript();
        code.opcodes = Int32Array.of(42, 0, 4002, 0, 4000, 43, 21);
        code.intOperands = Int32Array.of(0, 10, 0, digit, 0, 0, 0);
        code.stringOperands = new Array(code.opcodes.length).fill(null);
        ClientScript.m_cache.Put(BigInt(++script), code);
        const event = new HookReq();
        event.component = component;
        event.args = [script];
        return event;
    }
    function count(queue: SharedPtrList<HookReq>): number {
        let n = 0;
        for (let node = queue.head(); node !== null; node = queue.next()) n++;
        return n;
    }
    async function tick(): Promise<void> {
        let status = 'ok';
        try {
            await client['titleLoop']();
        } catch {
            status = 'threw';
        }
        console.log(
            [
                status,
                Keyboard.codes.slice(0, Keyboard.count).join(','),
                Keyboard.chars.slice(0, Keyboard.count).join(','),
                AreaSoundManager.elapsed,
                Client.transmitCycle,
                TitleFlames.pendingCycles,
                DelayedStateChange.varcs[0],
                count(requireNonNull(Client.timerEvents)),
                count(requireNonNull(Client.mouseExit)),
                count(requireNonNull(Client.m_hookQueue)),
                Client.openUrlRequest !== null,
                Client.urlNewWindow,
                adverts
            ].join('/')
        );
    }
    Client.loopCycle = 1;
    InterfaceList.top = -1;
    AreaSoundManager.elapsed = 0;
    Client.transmitCycle = 9;
    TitleFlames.pendingCycles = 3;
    DelayedStateChange.varcs[0] = 0;
    const parent = new IfType(),
        good = new IfType(),
        stale = new IfType(),
        high = new IfType(),
        root = new IfType();
    good.childId = stale.childId = 0;
    high.childId = 2;
    root.childId = -1;
    good.parentId = stale.parentId = high.parentId = 0;
    parent.childSlots = [good];
    IfType.m_list = [[parent]];
    IfType.m_open = [true];
    Keyboard.eventReader = 126;
    Keyboard.eventLimit = 1;
    Keyboard.eventCodes[126] = 3;
    Keyboard.eventCodes[127] = 4;
    Keyboard.eventCodes[0] = 5;
    Keyboard.eventChars[126] = 97;
    Keyboard.eventChars[127] = 0;
    Keyboard.eventChars[0] = -1;
    requireNonNull(Client.timerEvents).push_back(event(root, 1));
    requireNonNull(Client.timerEvents).push_back(event(stale, 7));
    requireNonNull(Client.timerEvents).push_back(event(good, 2));
    requireNonNull(Client.mouseExit).push_back(event(high, 8));
    requireNonNull(Client.mouseExit).push_back(event(root, 3));
    requireNonNull(Client.m_hookQueue).push_back(event(root, 4));
    const url = new SignlinkRequest();
    Client.openUrlRequest = url;
    url.status = 2;
    Client.urlNewWindow = true;
    await tick();
    url.status = 1;
    requireNonNull(Client.timerEvents).push_back(event(null, 8));
    requireNonNull(Client.mouseExit).push_back(event(root, 5));
    requireNonNull(Client.m_hookQueue).push_back(event(root, 6));
    await tick();
    await tick();
    await tick();
    InterfaceList.top = 3;
    IfType.m_list = null;
    IfType.m_open = null;
    requireNonNull(Client.timerEvents).push_back(event(root, 7));
    await tick();
    InterfaceList.top = -1;
    await tick();
    GameShell.m_sWid = 765;
    GameShell.m_sHei = 503;
    InterfaceList.top = 0;
    IfType.m_open = [true];
    IfType.m_list = [[parent]];
    parent.parentId = -1;
    parent.childId = -1;
    parent.id = 0;
    parent.if3 = parent.hasHook = true;
    parent.type = 4;
    parent.width = 24;
    parent.height = 24;
    parent.onTimer = event(parent, 9).args;
    await tick();
    await tick();
    Client.loopCycle = 1500;
    InterfaceList.top = -1;
    ComponentDrag.component = root;
    ComponentDrag.parent = null;
    ComponentDrag.visible = ComponentDrag.parentVisible = ComponentDrag.started = true;
    Mouse.mouseButton = 1;
    root.onDrag = event(root, 2).args;
    const dragUrl = new SignlinkRequest();
    Client.openUrlRequest = dragUrl;
    dragUrl.status = 1;
    Client.urlNewWindow = true;
    await tick();
    ComponentDrag.parent = parent;
    const runner = ui.runner,
        release = Promise.withResolvers<void>();
    Object.assign(ui, { runner: { run: (hook: HookReq) => release.promise.then(() => runner.run(hook)) } });
    const waiting = tick();
    if (Client.openUrlRequest !== dragUrl || adverts !== 0) throw new Error('Title URL or advert was polled before the drag hook resumed');
    release.resolve();
    await waiting;
    Object.assign(ui, { runner });
    ComponentDrag.component = null;
    const component = new CanvasComponent({
        createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as ImageData,
        putImageData() {}
    });
    GameShell.canvas = component;
    GameShell.fullScreenFrame = { getSize: () => ({ width: 765, height: 503 }), getInsets: () => ({ top: 0, left: 0, bottom: 0, right: 0 }) };
    GameShell.m_frameWidth = GameShell.m_sWid = 765;
    GameShell.m_frameHeight = GameShell.m_sHei = 503;
    GameShell.canvasInvalid = GameShell.fullRedraw = Client.loadingComplete = false;
    Client.windowModeRefreshTime = 0n;
    GameShell.drawArea = await PixScreen.create(503, component, 765);
    const frame = requireNonNull(GameShell.drawArea.pixels).subarray(0, 765 * 503);
    const flame = Object.assign(new IfType(), { id: 0, parentId: -1, if3: true, type: 3, clientCode: 1402, x: 16, y: 16, width: 128, height: 254 });
    IfType.m_list = [[flame]];
    IfType.m_open = [true];
    InterfaceList.top = 0;
    Client.gameState = 10;
    const sprites = Object.assign(Object.create(Js5.prototype), { GetFile2: () => null });
    // The title has already initialized the shuffled draw classes before its seeded fire sequence.
    TitleFlames.SetupFire(sprites);
    TitleFlames.pendingCycles = 0;
    client['MainRedraw']();
    mathRandom.setSeed(1431n);
    TitleFlames.SetupFire(sprites);
    frame.fill(0x999933);
    console.log('setup/' + mathRandom['seed']);
    for (let cycle = 1; cycle <= 75; cycle++) {
        Client.loopCycle = cycle;
        await client['titleLoop']();
        if (cycle % 5 === 0) {
            const pending = TitleFlames.pendingCycles;
            client['MainRedraw']();
            let hash = 1;
            for (const pixel of frame) hash = (Math.imul(31, hash) + pixel) | 0;
            console.log([cycle, pending, TitleFlames.pendingCycles, flame.rootIndex, flame.drawCycle, InterfaceList.rootCount, InterfaceList.dirty[0], InterfaceList.rectangleRedraw[0], mathRandom['seed'], hash].join('/'));
        }
    }
}

if (process.argv[2] === 'trace') await trace();
else {
    const { expect, test } = await import('bun:test');
    test('client.g runs the keyboard, title flames, three hook queues and URL polling at the original tick and failure boundaries', () => {
        const dir = mkdtempSync(join(tmpdir(), 'title-loop530-'));
        try {
            const java = join(import.meta.dir, 'game', 'TitleLoopOracle.java');
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, java]);
            expect(compile.stderr.toString()).toBe('');
            expect(compile.exitCode).toBe(0);
            const reference = Bun.spawnSync(['java', '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '--add-opens', 'java.base/java.util=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TitleLoopOracle']);
            const port = Bun.spawnSync([process.execPath, import.meta.path, 'trace']);
            expect(reference.stderr.toString()).toBe('');
            expect(reference.exitCode).toBe(0);
            expect(port.stderr.toString()).toBe('');
            expect(port.exitCode).toBe(0);
            const expected = reference.stdout.toString().trim().split(/\r?\n/);
            expect(expected.length).toBe(26);
            expect(expected[25].endsWith('/803259979')).toBe(true);
            expect(port.stdout.toString().trim().split(/\r?\n/)).toEqual(expected);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 45000);
}
