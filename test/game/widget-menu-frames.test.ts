import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Mouse from '#/client/ClientMouseListener.js';
import MouseTracking from '#/client/MouseTracking.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import CursorType from '#/config/CursorType.js';
import NpcType from '#/config/NpcType.js';
import SeqType from '#/config/SeqType.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import ModelLit from '#/dash3d/ModelLit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import world from '#/dash3d/world.js';
import BufferedImagePixMap from '#/graphics/BufferedImagePixMap.js';
import { CanvasComponent } from '#/graphics/PixScreen.js';
import Pix32 from '#/graphics/Pix32.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SuperPacket from '#/io/SuperPacket.js';
import SceneCutover from '#/scene/SceneCutover.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Preferences from '#/ui/Preferences.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import SubInterface from '#/ui/SubInterface.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import { requireNonNull } from '#/util/JavaArray.js';
import Signlink from '#/util/Signlink.js';
import { freshGame } from '../actor-fixture.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

type Event = [tick: number, state: number, mouseX: number, mouseY: number, clickX: number, clickY: number, button: number];
const events: Event[] = [
    [0, 10, 8, 9, 0, 0, 0], // Title draws the group but doesn't publish a hardware cursor.
    [0, 30, 8, 9, 0, 0, 0], // Left option, cursor 41.
    [1, 30, 8, 9, 55, 9, 1], // Click on the right between redraws.
    [1, 30, 8, 9, 55, 9, 0], // Still no frame at the stored click.
    [0, 30, 8, 9, 55, 9, 0], // Right option, cursor 73; pointer back on the left.
    [1, 30, 8, 9, 55, 9, 0], // IF_BUTTON2 for the right widget.
    [0, 30, 8, 9, 55, 9, 0],
    [1, 30, 8, 9, 8, 9, 1], // Immediate IF_BUTTON1 on the already sampled left widget.
    [0, 30, 94, 41, 8, 9, 0], // Cancel alone, restore OS default.
    [1, 30, 55, 9, 8, 9, 1],
    [0, 30, 55, 9, 8, 9, 0],
    [1, 30, 55, 9, 8, 9, 0], // Left action despite the pointer now being on the right.
    [0, 30, 55, 9, 8, 9, 0],
    [0, 10, 8, 9, 0, 0, 0] // Title retains the last sampled menu coordinates.
];

loginFixture(
    import.meta.url,
    '530 real interface frames publish hover cursors and dispatch the stored widget click on a later game tick',
    async () => {
        const temp = mkdtempSync(join(tmpdir(), '530-widget-menu-frames-'));
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', temp, ...['WidgetMenuFramesOracle', 'GameProtocolOracle', 'WindowModeOracle'].map(name => join(import.meta.dir, name + '.java'))]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', temp + delimiter + gamepackPath, 'WidgetMenuFramesOracle'], {
                stdin: Buffer.from(events.map(e => e.join(' ')).join('\n') + '\n')
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(events.length);
            expect(expected[2].split('|').slice(3)).toEqual(['2,55,9', '41', '89810009003700']);
            expect(expected[5].split('|').slice(3)).toEqual(['0,55,9', '73', '0200010001ffff']);

            const { app, out } = await frameClient();
            const actual: string[] = [];
            for (const [tick, state, mx, my, cx, cy, b] of events) {
                Client.gameState = state;
                Mouse.x = mx;
                Mouse.mouseY = my;
                Mouse.clickX = cx;
                Mouse.clickY = cy;
                Mouse.clickButton = b;
                Mouse.mouseButton = 0;
                Client.prevMouseClickTime = 100n;
                Mouse.clickTime = 150n;
                Client.mouseTracked = OrbitCamera.reportPending = false;
                GameShell.m_focus = Client.lastSentFocus = true;
                out.m_pos = 0;
                out.SetEnc(Int32Array.of(1, 2, 3, 4));
                if (tick === 0) app['MainRedraw']();
                else await app.GameLoop();
                const rows = Array.from({ length: Minimenu.count }, (_, j) => [Minimenu.actions[j], Minimenu.cursor[j], Minimenu.paramB[j], Minimenu.paramC[j], Minimenu.keys[j]].join(','));
                const observed = [
                    Minimenu.count,
                    rows.join(';'),
                    [Minimenu.mouseX, Minimenu.mouseY].join(','),
                    [Minimenu.deferred, Minimenu.deferredX, Minimenu.deferredY].join(','),
                    Client.currentCursor,
                    Buffer.from(requireNonNull(out.m_data).subarray(0, out.m_pos)).toString('hex')
                ].join('|');
                actual.push(observed);
            }
            expect(actual).toEqual(expected);
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    },
    30000
);

async function frameClient(width = 96, height = 48, archives: number[] = []) {
    const assets = localAssets(cachePath, archives),
        app = (Client.activeClient = new Client()),
        out = new SuperPacket(5000);
    Client.loopCycle = 1;
    Client.stream = null;
    Preferences.sent = true;
    const game = (app.game = freshGame({ outgoing: out, rebuild: null, account: null }, assets));
    game.actors.self.x = game.actors.self.z = 4096;
    Client.playerLevel = MinimapBuilder.minimapLevel = 0;
    Client.mouseTracking = new MouseTracking();
    const signlink = (GameShell.signlink = new Signlink());
    await signlink.stopWorker();
    GameShell.m_frameWidth = GameShell.m_sWid = width;
    GameShell.m_frameHeight = GameShell.m_sHei = height;
    GameShell.fullScreenFrame = { getSize: () => ({ width, height }), getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
    GameShell.canvasInvalid = GameShell.fullRedraw = Client.loadingComplete = Preferences.safeMode = false;
    const canvas = new CanvasComponent({
        createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as ImageData,
        putImageData() {}
    });
    GameShell.canvas = canvas;
    const pixels = (GameShell.drawArea = new BufferedImagePixMap());
    pixels.init(height, width, canvas);
    InterfaceList.top = -1;
    const view = new InterfaceView([]),
        ui = (app.ui = new InterfaceSession(view, assets));
    ui.beginGame(game);
    Client.fontBold12 = Client.p12 = new SoftwareFont(
        new Uint8Array(257),
        new Int32Array(256),
        new Int32Array(256),
        new Int32Array(256),
        new Int32Array(256),
        Array.from({ length: 256 }, () => new Uint8Array(0))
    );
    function widget(slot: number, op: number, cursor: number, name: string): IfType {
        const c = new IfType();
        c.id = 0x10000 + slot;
        c.parentId = -1;
        c.type = 3;
        c.if3 = true;
        c.x = 5 + 45 * slot;
        c.y = 4;
        c.width = 34;
        c.height = 21;
        c.properties = new ServerActiveProperties(1 << op, -1);
        c.SetOpName(op - 1, fromJsString(name));
        c.setOpCursor(op - 1, cursor);
        c.opBaseValue = fromJsString(slot === 0 ? 'Left target' : 'Right target');
        return c;
    }
    IfType.m_list = [null, [widget(0, 1, 41, 'Left'), widget(1, 2, 73, 'Right')]];
    IfType.m_open = [false, true];
    InterfaceList.top = 1;
    InterfaceList.rootCount = 0;
    ui.refreshView();
    for (const cursor of [41, 73]) CursorType.types.Put(BigInt(cursor), new CursorType());
    CursorType.spriteCache.Put(0n, new Pix32(1, 1));
    Preferences.cursorsEnabled = true;
    Client.currentCursor = Client.defaultCursor = Minimenu.defaultCursor = -1;
    Minimenu.count = Minimenu.deferred = Minimenu.deferredX = Minimenu.deferredY = 0;
    Minimenu.mouseX = 8;
    Minimenu.mouseY = 9;
    Minimenu.isOpen = Client.qaOpTest = false;
    InterfaceList.dirty.fill(true);
    InterfaceList.rectRedrawnLastFrame.fill(false);
    return { app, ui, view, widget, out, assets };
}

loginFixture(
    import.meta.url,
    'Tutorial Island progress hooks let scene clicks through while modal layers and widget ops keep their Java priority',
    async () => {
        const temp = mkdtempSync(join(tmpdir(), '530-tutorial-overlay-'));
        const drawScene = Client.drawScene;
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const compile = Bun.spawnSync([
                'javac',
                ...exports,
                '-cp',
                gamepackPath,
                '-d',
                temp,
                ...['WidgetMenuFramesOracle', 'GameProtocolOracle', 'WindowModeOracle', 'SceneMenuFramesOracle', 'TutorialOverlayOracle'].map(name => join(import.meta.dir, name + '.java')),
                join(import.meta.dir, '../review/provider-config/ProviderConfigOracle.java')
            ]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', ...exports, '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', temp + delimiter + gamepackPath];
            const patch = Bun.spawnSync([...java, 'SceneMenuFramesOracle', 'patch', temp]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const reference = Bun.spawnSync([...java, 'TutorialOverlayOracle', cachePath]);
            expect(reference.exitCode, reference.stderr.toString()).toBe(0);
            const rows = reference.stdout.toString().trimEnd().split(/\r?\n/);
            expect(rows).toHaveLength(16);
            expect(rows.slice(0, 4)).toEqual(['440 50 1002,57 true', '255 300 1002,57 true', '368 6 1002,57 true', '512 95 1002,57 true']);
            expect(rows.slice(9, 12)).toEqual(['255 300 1002 false', '255 300 1002 false', '255 300 1002,57,59 false']);
            expect(rows.slice(12)).toEqual(['255 160 1002 false', '255 300 1002 false', '100 337 1002 false', '100 338 1002 false']);

            const { app, ui, out, assets } = await frameClient(765, 503, [0, 1, 3, 7, 8, 13, 20]);
            SeqType.Init(assets.archive(20), assets.archive(1), assets.archive(0));
            IfType.Init(assets.archive(13), assets.archive(8), assets.archive(7), assets.archive(3));
            Client.lookupSpriteGroupIds(assets.archive(8));
            const compass = requireNonNull(SpriteLoader.loadSoftwareSprite(assets.archive(8), SpriteLoader.compassId, 0));
            compass.trim();
            Client.imageCompass = compass;
            IfType.OpenInterface(548);
            IfType.OpenInterface(371);
            const group = requireNonNull(requireNonNull(IfType.m_list)[371]);
            const layer = requireNonNull(group[0]);
            expect(layer.onVarTransmit).not.toBeNull();
            expect(layer.noClickThrough).toBe(false);
            requireNonNull(group[4]).hidden = true;
            InterfaceList.top = 548;
            const mount = new SubInterface();
            mount.group = 371;
            mount.type = 1;
            InterfaceList.subInterfaces.put(mount, BigInt((548 << 16) | 4));
            Client.InterfaceCalculateSizeAndPosAll(false);
            ui.refreshView();
            Client.gameState = 30;
            Minimenu.walkHere = LocalisedText.walkHere;
            const self = requireNonNull(Client.localPlayer);
            self.pathX[0] = self.pathZ[0] = 31;
            const map = (CollisionMap.levelMaps[0] = new CollisionMap(104, 104));
            for (const row of map.flags) row.fill(0);
            Client.drawScene = () => {
                if (world.takingInput) {
                    world.groundX = 33;
                    world.groundZ = 35;
                    world.takingInput = false;
                }
            };
            SpriteLoader.cross = Array.from({ length: 8 }, () => new Pix32(1, 1));
            for (const [i, row] of rows.entries()) {
                const [sx, sy, menu, picked] = row.split(' '),
                    x = Number(sx),
                    y = Number(sy);
                mount.type = i === 10 ? 0 : 1;
                layer.noClickThrough = i === 9;
                if (i === 11) {
                    layer.SetOpName(0, fromJsString('Inspect'));
                    layer.onOp = [1];
                }
                if (i === 12) {
                    layer.onOp = null;
                    layer.operationNames = null;
                    for (const [host, groupId, subType] of [
                        [11, 771, 0],
                        [76, 752, 1]
                    ]) {
                        IfType.OpenInterface(groupId);
                        const sub = new SubInterface();
                        sub.group = groupId;
                        sub.type = subType;
                        InterfaceList.subInterfaces.put(sub, BigInt((548 << 16) | host));
                    }
                    Client.InterfaceCalculateSizeAndPosAll(false);
                    ui.refreshView();
                }
                Mouse.x = Mouse.clickX = x;
                Mouse.mouseY = Mouse.clickY = y;
                Mouse.clickButton = 0;
                Mouse.mouseButton = 0;
                Minimenu.deferred = Minimenu.crossMode = 0;
                Minimenu.isOpen = false;
                out.m_pos = 0;
                out.SetEnc(Int32Array.of(1, 2, 3, 4));
                app['MainRedraw']();
                const expectScene = picked === 'true';
                expect(ui.isSceneClick(x, y), 'scene click for jar menu ' + menu + ' at ' + x + ',' + y).toBe(expectScene);
                if (i === 11) expect(Minimenu.actions.slice(0, Minimenu.count).includes(59)).toBe(true);
            }
            for (const host of [11, 76]) InterfaceList.subInterfaces.get(BigInt((548 << 16) | host))?.Unlink();
            ui.refreshView();
            const defaults = { x: 255, y: 300, code: 0, if3: 1, type: 0, button: 0, events: 0, hidden: 0, opaque: 0, op: -1, child: 0, qa: 0, map: 0 };
            const cases: [string, Partial<typeof defaults>][] = [
                ...[6, 50, 95].flatMap(y => [368, 440, 512].map(x => ['FPS at ' + x + ',' + y, { x, y }] as [string, { x: number; y: number }])),
                ['outside FPS', { x: 367, y: 5 }],
                ['blank op', { events: 2 }],
                ['drag event', { events: 1 << 21 }],
                ['passive unknown code', { code: 1700 }],
                ['interactive unknown code', { code: 1700, button: 1 }],
                ['FPS subtree', { code: 1405, opaque: 1, child: 1 }],
                ['tooltip subtree', { code: 1406, opaque: 1, child: 1 }],
                ['visible button under normal container', { child: 1 }],
                ['hidden IF1 button', { if3: 0, type: 3, hidden: 1, button: 1 }],
                ['hidden IF1 subtree', { if3: 0, hidden: 1, child: 1 }],
                ['hidden IF1 container own button', { if3: 0, hidden: 1, button: 1 }],
                ['hidden IF3', { hidden: 1, events: 2, op: 0 }],
                ['empty inventory', { if3: 0, type: 2 }],
                ['low priority op', { events: 1 << 6, op: 5 }],
                ['primary op', { events: 2, op: 0 }],
                ['QA hidden op', { events: 2, hidden: 1, qa: 1 }],
                ['QA click-through', { opaque: 1, qa: 1 }],
                ['mask left outside', { code: 1338, x: 246 }],
                ['mask first pixel', { code: 1338, x: 247 }],
                ['mask last pixel', { code: 1338, x: 255 }],
                ['mask right outside', { code: 1338, x: 256 }],
                ['disabled minimap', { code: 1338, map: 2 }],
                ['minimap state three', { code: 1338, map: 3 }]
            ];
            const frames = cases.map(([, overrides]) => ({ ...defaults, ...overrides }));
            const painted = Bun.spawnSync([...java, 'TutorialOverlayOracle', cachePath, 'widgets'], {
                stdin: Buffer.from(frames.map(frame => Object.values(frame).join(' ')).join('\n') + '\n')
            });
            expect(painted.exitCode, painted.stderr.toString()).toBe(0);
            const jarMenus = painted.stdout.toString().trimEnd().split(/\r?\n/);
            expect(jarMenus).toHaveLength(frames.length);
            const menuState = () => ({
                count: Minimenu.count,
                open: Minimenu.isOpen,
                hover: Minimenu.hoverSlot,
                hovered: Client.hoveredSlotCom,
                actions: Minimenu.actions.slice(),
                keys: Minimenu.keys.slice(),
                cursors: Minimenu.cursor.slice(),
                b: Minimenu.paramB.slice(),
                c: Minimenu.paramC.slice(),
                options: Minimenu.option.slice(),
                targets: Minimenu.target.slice()
            });
            for (const [i, frame] of frames.entries()) {
                const { x, y } = frame,
                    name = cases[i][0],
                    c = new IfType();
                Object.assign(c, {
                    id: (371 << 16) | 1000,
                    parentId: layer.id,
                    x: 199,
                    y: 12,
                    width: 34,
                    height: 24,
                    clientCode: frame.code,
                    if3: !!frame.if3,
                    type: frame.type,
                    buttonType: frame.button,
                    hidden: !!frame.hidden,
                    noClickThrough: !!frame.opaque,
                    properties: new ServerActiveProperties(frame.events, -1)
                });
                if (frame.op >= 0) c.SetOpName(frame.op, fromJsString('Inspect'));
                if (frame.child) {
                    const child = new IfType();
                    Object.assign(child, { id: c.id + 1, parentId: c.id, if3: false, type: 3, buttonType: 1, width: 34, height: 24 });
                    c.childSlots = [child];
                }
                if (c.type === 2)
                    Object.assign(c, { baseWidth: 1, baseHeight: 1, itemIds: new Int32Array(1), itemCounts: new Int32Array(1), invSlotOffsetX: new Int32Array(20), invSlotOffsetY: new Int32Array(20), invSlotSprite: new Int32Array(20).fill(-1) });
                if (c.clientCode === 1338) {
                    c.maskStarts = new Int32Array(c.height).fill(10);
                    c.maskWidths = new Int32Array(c.height).fill(8);
                }
                Client.qaOpTest = !!frame.qa;
                Client.minimapState = frame.map;
                layer.childSlots = [c];
                Mouse.x = Mouse.clickX = x;
                Mouse.mouseY = Mouse.clickY = y;
                Mouse.clickButton = 0;
                Minimenu.deferred = 0;
                Minimenu.isOpen = false;
                app['MainRedraw']();
                const nativeRows = Array.from(Minimenu.actions.subarray(0, Minimenu.count), (action, index) => action + ':' + Minimenu.keys[index]);
                const jarRows = jarMenus[i].split(',');
                expect(nativeRows, name + ' native widget rows').toEqual(jarRows.filter(row => row !== '57:0'));
                const before = menuState();
                expect(ui.isSceneClick(x, y), name + ' top row ' + jarMenus[i]).toBe(jarRows.at(-1) === '57:0');
                expect(menuState(), name + ' preserved menu').toEqual(before);
            }
            // sf.a has already added a button row and assigned the hovered slot when
            // a malformed inventory throws. Restore even unpublished cells on unwind.
            const corrupt = new IfType();
            Object.assign(corrupt, { id: (371 << 16) | 1000, parentId: layer.id, type: 2, if3: false, buttonType: 1, x: 199, y: 12, baseWidth: 1, baseHeight: 1, invSlotOffsetX: new Int32Array(20), invSlotOffsetY: new Int32Array(20) });
            layer.childSlots = [corrupt];
            Minimenu.isOpen = true;
            Minimenu.hoverSlot = 71;
            Client.hoveredSlotCom = layer;
            const beforeFailure = menuState();
            expect(() => ui.isSceneClick(255, 300)).toThrow();
            expect(menuState()).toEqual(beforeFailure);
        } finally {
            Client.drawScene = drawScene;
            rmSync(temp, { recursive: true, force: true });
        }
    },
    30000
);

loginFixture(
    import.meta.url,
    'native scene frames dispatch walk and NPC clicks, draw hover and open menus and send the jar packets',
    async () => {
        // draw/tick, picked NPC, mouse x/y, button. Only the projected ground tile
        // and picked typecode are injected at the viewport boundary on each side.
        const frames = [
            [0, 0, 26, 12, 0],
            [1, 0, 26, 12, 1],
            [0, 0, 26, 12, 0],
            [1, 0, 26, 12, 0], // walk
            [0, 1, 35, 10, 0],
            [1, 1, 35, 10, 1], // NPC default
            [0, 1, 35, 10, 0],
            [1, 1, 35, 10, 2],
            [0, 1, 35, 68, 0],
            [1, 1, 35, 68, 1], // examine row
            [0, 0, 26, 12, 0],
            [1, 1, 35, 10, 2],
            [0, 1, 92, 20, 0],
            [1, 1, 92, 20, 0], // deferred open
            [0, 0, 150, 121, 0],
            [1, 0, 150, 121, 0] // close outside
        ];
        const temp = mkdtempSync(join(tmpdir(), '530-scene-menu-frames-'));
        const priorDraw = Client.drawScene,
            priorNative = SceneCutover.native;
        try {
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const java = ['java', ...exports, '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', temp + delimiter + gamepackPath, 'SceneMenuFramesOracle'];
            const compile = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', temp, ...['WidgetMenuFramesOracle', 'GameProtocolOracle', 'WindowModeOracle', 'SceneMenuFramesOracle'].map(name => join(import.meta.dir, name + '.java'))]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const patch = Bun.spawnSync([...java, 'patch', temp]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const framebuffer = join(temp, 'frames.rgb');
            const run = Bun.spawnSync([...java, 'run', framebuffer], { stdin: Buffer.from(frames.map(e => e.join(' ')).join('\n') + '\n') });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(frames.length);
            expect(expected[3].split('|').at(-1)).toBe('1507800c1f0c01827e'); // MOVE_GAMECLICK
            expect(expected[5].split('|').at(-1)).toBe('8981000a0023008407800c1f0c00827ec16400'); // click, route and NPC op 1
            expect(expected[9].split('|').at(-1)).toBe('898100440023007f1ea3'); // click and examine NPC type 7843
            expect([7, 11, 13, 15].map(i => expected[i].split('|')[1].split(',')[0])).toEqual(['true', 'false', 'true', 'false']);

            const { app, ui, out } = await frameClient(160, 128);
            SceneCutover.native = true;
            Client.gameState = 30;
            const scene = new IfType();
            Object.assign(scene, { id: 0x10000, parentId: -1, type: 3, if3: true, x: 2, y: 3, width: 155, height: 122, clientCode: 1337 });
            IfType.m_list = [null, [scene]];
            ui.refreshView();
            // A 1337 pick, the next menu tick and an open-menu redraw must all
            // work when the retired viewport no longer exists.
            Object.defineProperty(app, 'viewport', {
                get() {
                    throw new Error('legacy viewport read during native scene frame');
                }
            });
            const metrics = new Uint8Array(257).fill(4);
            metrics[256] = 6;
            const sizes = new Int32Array(256).fill(1);
            Client.fontBold12 = new SoftwareFont(
                metrics,
                new Int32Array(256),
                new Int32Array(256),
                sizes,
                sizes,
                Array.from({ length: 256 }, () => Uint8Array.of(1))
            );
            Minimenu.walkHere = LocalisedText.walkHere;
            Minimenu.tooltipSeed = 42;
            Object.assign(Pix3D, { clipMinX: -80, clipMaxX: 80, clipMinY: -64, clipMaxY: 64 });
            const npc = (Client.npcs[100] = new ClientNpc()),
                type = new NpcType();
            Object.assign(type, { id: 7843, name: fromJsString('Guide'), interactive: true, m_visibleCombatLevel: 0, ops: [fromJsString('Chat'), null, null, null, null] });
            npc.setType(type);
            npc.pathX[0] = 33;
            npc.pathZ[0] = 35;
            npc.x = 33 * 128 + 64;
            npc.z = 35 * 128 + 64;
            const self = requireNonNull(Client.localPlayer);
            self.pathX[0] = self.pathZ[0] = 31;
            self.x = self.z = 31 * 128 + 64;
            Client.mapBuildBaseX = 3072;
            Client.mapBuildBaseZ = 3168;
            const map = (CollisionMap.levelMaps[0] = new CollisionMap(104, 104));
            for (const col of map.flags) col.fill(0);
            world.groundX = world.groundZ = -1;
            const pixels = requireNonNull(requireNonNull(GameShell.drawArea).pixels);
            const javaPixels = readFileSync(framebuffer),
                raster = Buffer.alloc(pixels.length * 4);
            expect(javaPixels.length).toBe(raster.length * frames.length);
            let npcPicked = false;
            Client.drawScene = (height, width, y, x, fixed) => {
                pixels.fill(0);
                requireNonNull(ModelLit.pickedTypecodes)[0] = (100n << 32n) | (1n << 29n) | (35n << 7n) | 33n;
                ModelLit.pickedCount = npcPicked ? 1 : 0;
                if (world.takingInput) {
                    world.groundX = 33;
                    world.groundZ = 35;
                    world.takingInput = false;
                }
                if (!fixed && !Minimenu.isOpen && Minimenu.mouseX >= x && Minimenu.mouseX < x + width && Minimenu.mouseY >= y && Minimenu.mouseY < y + height) {
                    expect(Minimenu.Build(y, Minimenu.mouseX, width, height, Minimenu.mouseY, x)).toBeUndefined();
                }
            };
            const m = Minimenu;
            for (const [index, [step, pick, x, y, button]] of frames.entries()) {
                npcPicked = pick !== 0;
                Mouse.x = Mouse.clickX = x;
                Mouse.mouseY = Mouse.clickY = y;
                Mouse.clickButton = button;
                Mouse.mouseButton = 0;
                Client.prevMouseClickTime = 100n;
                Mouse.clickTime = 150n;
                Client.mouseTracked = OrbitCamera.reportPending = false;
                GameShell.m_focus = Client.lastSentFocus = true;
                out.m_pos = 0;
                out.SetEnc(Int32Array.of(1, 2, 3, 4));
                if (step === 0) app['MainRedraw']();
                else await app.GameLoop();
                for (let i = 0; i < pixels.length; i++) raster.writeInt32BE(pixels[i], i * 4);
                expect(raster.equals(javaPixels.subarray(index * raster.length, (index + 1) * raster.length)), 'frame pixels ' + index).toBe(true);
                const trace = [
                    m.actions.slice(0, m.count).join(','),
                    [m.isOpen, m.x, m.y, m.width, m.height].join(','),
                    [m.deferred, m.mouseX, m.mouseY].join(','),
                    [m.crossMode, m.crossTicks, m.crossX, m.crossY].join(','),
                    [world.takingInput, world.groundX, world.groundZ].join(','),
                    toJsString(requireNonNull(m.getTooltip())),
                    Buffer.from(requireNonNull(out.m_data).subarray(0, out.m_pos)).toString('hex')
                ].join('|');
                expect(trace, 'scene frame ' + index).toBe(expected[index]);
            }
        } finally {
            Client.drawScene = priorDraw;
            SceneCutover.native = priorNative;
            rmSync(temp, { recursive: true, force: true });
        }
    },
    30000
);
