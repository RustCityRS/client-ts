import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import Mouse from '#/client/ClientMouseListener.js';
import MouseTracking from '#/client/MouseTracking.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import CursorType from '#/config/CursorType.js';
import NpcType from '#/config/NpcType.js';
import LocType from '#/config/LocType.js';
import ObjType from '#/config/ObjType.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientObjNode from '#/dash3d/ClientObjNode.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import ModelLit from '#/dash3d/ModelLit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import Square from '#/dash3d/Square.js';
import Wall from '#/dash3d/Wall.js';
import world from '#/dash3d/world.js';
import BufferedImagePixMap from '#/graphics/BufferedImagePixMap.js';
import { CanvasComponent } from '#/graphics/PixScreen.js';
import Pix32 from '#/graphics/Pix32.js';
import Pix2D from '#/graphics/Pix2D.js';
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
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import { requireNonNull } from '#/util/JavaArray.js';
import Signlink from '#/util/Signlink.js';
import { freshGame } from '../actor-fixture.js';
import { localAssets } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { loginFixture } from '../login-fixture.js';

enum Pick {
    Ground,
    Npc,
    Loc,
    Obj,
    Player
}
enum Mode {
    Normal,
    Use,
    Target
}
type Frame = [tick: number, pick: Pick, mouseX: number, mouseY: number, button: number, mode: Mode];

function redraw(pick: Pick, mode = Mode.Normal, x = 35, y = 10): Frame {
    return [0, pick, x, y, 0, mode];
}
function tick(pick: Pick, button: number, mode = Mode.Normal, x = 35, y = 10): Frame {
    return [1, pick, x, y, button, mode];
}
function defaultAction(pick: Pick, mode = Mode.Normal): Frame[] {
    return [redraw(pick, mode), tick(pick, 1, mode)];
}
function menuRow(pick: Pick, y: number): Frame[] {
    return [redraw(pick), tick(pick, 2), redraw(pick, Mode.Normal, 35, y), tick(pick, 1, Mode.Normal, 35, y)];
}
const groundFinish = [redraw(Pick.Ground, Mode.Normal, 26, 12), tick(Pick.Ground, 0, Mode.Normal, 26, 12)];
const normalFrames = [...defaultAction(Pick.Loc), ...menuRow(Pick.Loc, 84), ...menuRow(Pick.Loc, 99), ...defaultAction(Pick.Obj), ...menuRow(Pick.Obj, 99), ...defaultAction(Pick.Player), ...menuRow(Pick.Player, 54), ...groundFinish];
const selectedFrames = [
    ...[Pick.Loc, Pick.Npc, Pick.Player, Pick.Obj].flatMap(pick => defaultAction(pick, Mode.Use)),
    redraw(Pick.Ground, Mode.Target, 26, 12),
    tick(Pick.Ground, 1, Mode.Target, 26, 12),
    redraw(Pick.Ground, Mode.Target, 26, 12),
    tick(Pick.Ground, 0, Mode.Target, 26, 12),
    ...[Pick.Npc, Pick.Loc, Pick.Player, Pick.Obj].flatMap(pick => defaultAction(pick, Mode.Target)),
    ...groundFinish
];

// Original ISAAC-encrypted bytes, including the mouse click and any movement packet.
// Index the frames that actually dispatch a menu action. All other frames also compare to the JAR.
const normalPackets = [
    [1, '8981000a0023008405800c1f0c04711e0ce39f0c84'], // 20
    [5, '89810054002300959fe3'], // 1004
    [9, '898100630023008405800c1f0c041d9fe39e0c040c'], // 1003
    [11, '8981000a0023008407800c200cff827e571006220c010c'], // 21
    [15, '89810063002300938610'], // 1006
    [17, '8981000a0023008405800c1e0c00b7db00'], // 33
    [21, '898100360023008405800c1e0c0027db00'] // 9
] as const;
const selectedPackets = [
    [1, '8981000a0023008405800c1f0c04f90c9edb3b840c000701000000e39f'], // 48
    [3, '8981000a0023008407800c1f0c00827ee60100000007006400bbdb'], // 60
    [5, '8981000a0023008405800c1e0c006bdb00db3b000701000000'], // 47
    [7, '8981000a0023008407800c200cff827ed8a20c07003bdb0610010c01000000'], // 36
    [9, '8981000c001a00'], // 41 first records the click
    [11, 'c1010000000ca17fff0c03'], // packet 131 after the next redraw
    [13, '8981000a0023008407800c1f0c00827e6200000100ff7fe400'], // 32
    [15, '8981000a0023008405800c1f0c045c040c0c9e7fff00000001e39f'], // 28
    [17, '8981000a0023008405800c1e0c0036ff7f00000100db00'], // 16
    [19, '8981000a0023008407800c200cff827ebc000000010c818610a20cffff'] // 24
] as const;

function oracle(temp: string, frames: Frame[]) {
    const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
    const sources = ['WindowModeOracle', 'GameProtocolOracle', 'WidgetMenuFramesOracle', 'SceneMenuFramesOracle', 'SceneActionFramesOracle'];
    const compile = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', temp, ...sources.map(name => join(import.meta.dir, name + '.java')), join(import.meta.dir, '../review/provider-config/ProviderConfigOracle.java')]);
    expect(compile.exitCode, compile.stderr.toString()).toBe(0);
    const java = ['java', ...exports, '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', temp + delimiter + gamepackPath];
    const patch = Bun.spawnSync([...java, 'SceneMenuFramesOracle', 'patch', temp]);
    expect(patch.exitCode, patch.stderr.toString()).toBe(0);
    const framebuffer = join(temp, 'frames.rgb');
    const run = Bun.spawnSync([...java, 'SceneActionFramesOracle', framebuffer, cachePath], { stdin: Buffer.from(frames.map(f => f.join(' ')).join('\n') + '\n') });
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    const records = run.stdout.toString().trimEnd().split(/\r?\n/);
    expect(records.length).toBe(frames.length);
    return { records, pixels: readFileSync(framebuffer) };
}

async function setupScene() {
    const width = 160,
        height = 128;
    const assets = localAssets(cachePath, [8]),
        app = (Client.activeClient = new Client()),
        out = new SuperPacket(5000);
    const sprites = assets.archive(8);
    SpriteLoader.cross = SpriteLoader.loadSprites2(0, sprites, sprites.GetGroupId(Client.crossName));
    expect(SpriteLoader.cross).toHaveLength(8);
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
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as ImageData,
        putImageData() {}
    });
    GameShell.canvas = canvas;
    const pixmap = (GameShell.drawArea = new BufferedImagePixMap());
    pixmap.init(height, width, canvas);
    InterfaceList.top = -1;
    const view = new InterfaceView([]),
        ui = (app.ui = new InterfaceSession(view, assets));
    ui.beginGame(game);
    Client.p12 = new SoftwareFont(
        new Uint8Array(257),
        new Int32Array(256),
        new Int32Array(256),
        new Int32Array(256),
        new Int32Array(256),
        Array.from({ length: 256 }, () => new Uint8Array(0))
    );
    for (const cursor of [41, 73, 44, 45, 331, 432]) CursorType.types.Put(BigInt(cursor), new CursorType());
    CursorType.spriteCache.Put(0n, new Pix32(1, 1));
    Preferences.cursorsEnabled = true;
    Client.currentCursor = Client.defaultCursor = Minimenu.defaultCursor = -1;
    Minimenu.count = Minimenu.deferred = Minimenu.deferredX = Minimenu.deferredY = 0;
    Minimenu.mouseX = 8;
    Minimenu.mouseY = 9;
    Minimenu.isOpen = Client.qaOpTest = false;
    InterfaceList.dirty.fill(true);
    InterfaceList.rectRedrawnLastFrame.fill(false);

    SceneCutover.native = true;
    Client.gameState = 30;
    const scene = new IfType();
    Object.assign(scene, { id: 0x10000, parentId: -1, type: 3, if3: true, x: 2, y: 3, width: 155, height: 122, clientCode: 1337 });
    IfType.m_list = [null, [scene]];
    IfType.m_open = [false, true];
    InterfaceList.top = 1;
    InterfaceList.rootCount = 0;
    ui.refreshView();
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
    const s = fromJsString;
    const npc = (Client.npcs[100] = new ClientNpc()),
        type = new NpcType();
    Object.assign(type, { id: 7843, name: s('Guide'), interactive: true, m_visibleCombatLevel: 0, ops: [s('Chat'), null, null, null, null] });
    npc.setType(type);
    npc.pathX[0] = 33;
    npc.pathZ[0] = 35;
    npc.x = 33 * 128 + 64;
    npc.z = 35 * 128 + 64;
    const self = requireNonNull(Client.localPlayer);
    self.pathX[0] = self.pathZ[0] = 31;
    self.x = self.z = 31 * 128 + 64;
    Object.assign(self, { combatLevel: 44, combatRange: -1, team: 0 });
    Client.mapBuildBaseX = 3072;
    Client.mapBuildBaseZ = 3168;
    const map = (CollisionMap.levelMaps[0] = new CollisionMap(104, 104));
    for (const col of map.flags) col.fill(0);
    world.groundX = world.groundZ = -1;
    // Loc
    const LOC = 3859231,
        ITEM = 4102,
        PLAYER = 91;
    const LOC_KEY = (BigInt(LOC) << 32n) | BigInt((2 << 29) | (2 << 20) | (10 << 14) | (36 << 7) | 30);
    const OBJ_KEY = BigInt((3 << 29) | (33 << 7) | 34);
    const PLAYER_KEY = (BigInt(PLAYER) << 32n) | BigInt((32 << 7) | 29);
    const NPC_KEY = (100n << 32n) | (1n << 29n) | (35n << 7n) | 33n;
    const loc = new LocType();
    Object.assign(loc, { id: LOC, name: s('High key'), ops: [s('Climb'), null, s('Search'), null, s('Push')], cursorOp1: 0, cursorOp2: 0, cursor1: 44, cursor2: 45, width: 3, length: 2, forceApproach: 5 });
    LocType.m_recentUse.Put(BigInt(LOC), loc);
    world.squares = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Array(104).fill(null)));
    const square = (world.squares[0][30][36] = new Square(0, 30, 36));
    square.wall = new Wall();
    square.wall.typecode = LOC_KEY;
    // Obj
    const o = new ObjType();
    o.id = ITEM;
    o.name = s('Arrow');
    o.groundOps = [s('Lift'), null, s('Take'), null, s('Burn')];
    o.cursor1 = 331;
    o.cursor2 = 432;
    o.cursorOp1 = o.cursorOp2 = 2;
    ObjType.types.Put(BigInt(ITEM), o);
    const pile = new SharedPtrList<ClientObjNode>();
    const item = new ClientObj();
    item.id = ITEM;
    pile.push_back(new ClientObjNode(item));
    Client.groundObj[0][34][33] = pile;
    // Player
    ClientPlayer.titlePrefixes = ClientPlayer.nameSuffixes = null;
    const player = (Client.players[PLAYER] = new ClientPlayer());
    Object.assign(player, { username: s('Other'), combatLevel: 50, combatLevelWithSummoning: 50, combatRange: -1, team: 0, skillLevel: 0 });
    player.pathX[0] = 29;
    player.pathZ[0] = 32;
    player.x = 29 * 128 + 64;
    player.z = 32 * 128 + 64;
    Minimenu.playerOption.fill(null);
    Minimenu.playerCursor.fill(-1);
    Minimenu.playerSecondary.fill(false);
    Minimenu.playerOption[0] = s('Follow');
    Minimenu.playerOption[3] = s('Trade with');
    ReceivePlayerPositions.m_lastNum = 0;
    Client.npcCount = 0;

    return { app, out, pixels: requireNonNull(pixmap.pixels), keys: [0n, NPC_KEY, LOC_KEY, OBJ_KEY, PLAYER_KEY] };
}

function selectMode(mode: Mode) {
    const menu = Minimenu;
    menu.objSelected = mode === Mode.Use ? 1 : 0;
    menu.targetMode = mode === Mode.Target;
    menu.targetFlags = mode === Mode.Target ? 127 : 0;
    menu.targetParam = -1;
    menu.targetName = fromJsString('Target');
    menu.targetVerb = fromJsString('Cast');
    menu.objName = fromJsString('Selected');
    menu.objCursor = menu.targetCursor = -1;
    menu.objComponent = menu.targetComponent = 0x10000;
    menu.targetChild = -1;
    menu.objId = 56123;
    menu.objSlot = 7;
}

async function compare(frames: Frame[], packets: ReadonlyArray<readonly [number, string]>) {
    const temp = mkdtempSync(join(tmpdir(), '530-scene-action-frames-'));
    const priorDraw = Client.drawScene,
        priorNative = SceneCutover.native,
        priorCross = SpriteLoader.cross;
    try {
        const expected = oracle(temp, frames);
        for (const [i, hex] of packets) expect(expected.records[i].split('|').at(-1), 'JAR packet frame ' + i).toBe(hex);
        const { app, out, pixels, keys } = await setupScene();
        const raster = Buffer.alloc(pixels.length * 4);
        expect(expected.pixels.length).toBe(raster.length * frames.length);
        const menu = Minimenu;
        const paintedCrosses = new Set<number>();
        let pick = Pick.Ground;
        Client.drawScene = (height, width, y, x, fixed) => {
            pixels.fill(0);
            requireNonNull(ModelLit.pickedTypecodes)[0] = keys[pick];
            ModelLit.pickedCount = pick === Pick.Ground ? 0 : 1;
            if (world.takingInput) {
                world.groundX = 33;
                world.groundZ = 35;
                world.takingInput = false;
            }
            Pix2D.setClipping(x, y, x + width, y + height);
            Client.drawCross();
            if (menu.crossMode !== 0 && pixels.some(pixel => pixel !== 0)) {
                paintedCrosses.add((menu.crossMode - 1) * 4 + ((menu.crossTicks / 100) | 0));
            }
            if (!fixed && !menu.isOpen && menu.mouseX >= x && menu.mouseX < x + width && menu.mouseY >= y && menu.mouseY < y + height) {
                menu.Build(y, menu.mouseX, width, height, menu.mouseY, x);
            }
        };
        for (const [index, [isTick, entity, x, y, button, mode]] of frames.entries()) {
            selectMode(mode);
            pick = entity;
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
            if (isTick) await app.GameLoop();
            else app['MainRedraw']();

            for (let i = 0; i < pixels.length; i++) raster.writeInt32BE(pixels[i], i * 4);
            expect(raster.equals(expected.pixels.subarray(index * raster.length, (index + 1) * raster.length)), 'cross and menu pixels frame ' + index).toBe(true);
            const rows = Array.from({ length: menu.count }, (_, i) => [menu.actions[i], menu.paramB[i], menu.paramC[i], menu.keys[i], menu.cursor[i]].join(':')).join(',');
            const trace = [
                rows,
                [menu.isOpen, menu.x, menu.y, menu.width, menu.height].join(','),
                [menu.deferred, menu.mouseX, menu.mouseY].join(','),
                [menu.crossMode, menu.crossTicks, menu.crossX, menu.crossY].join(','),
                [world.takingInput, world.groundX, world.groundZ].join(','),
                toJsString(requireNonNull(menu.getTooltip())),
                Buffer.from(requireNonNull(out.m_data).subarray(0, out.m_pos)).toString('hex')
            ].join('|');
            expect(trace, 'scene frame ' + index).toBe(expected.records[index]);
        }
        return [...paintedCrosses].sort();
    } finally {
        Client.drawScene = priorDraw;
        SceneCutover.native = priorNative;
        SpriteLoader.cross = priorCross;
        rmSync(temp, { recursive: true, force: true });
    }
}

loginFixture(import.meta.url, 'native loc, ground-object and player menu rows match 24 JAR frames', async () => {
    expect(await compare(normalFrames, normalPackets)).toContain(4);
});
loginFixture(import.meta.url, 'native use-on and target-mode actions match 22 JAR frames', async () => {
    expect(await compare(selectedFrames, selectedPackets)).toContain(4);
});

loginFixture(import.meta.url, 'walk and interact clicks animate every cached crosshair frame through expiry', async () => {
    const frames: Frame[] = [];
    for (const [pick, x, y] of [
        [Pick.Ground, 3, 4],
        [Pick.Npc, 155, 123]
    ] as const) {
        frames.push(redraw(pick, Mode.Normal, x, y), tick(pick, 1, Mode.Normal, x, y));
        if (pick === Pick.Ground) {
            frames.push(redraw(pick, Mode.Normal, x, y), tick(pick, 0, Mode.Normal, x, y));
        }
        for (let i = 0; i < 21; i++) {
            frames.push(redraw(pick, Mode.Normal, x, y), tick(pick, 0, Mode.Normal, x, y));
        }
    }
    expect(await compare(frames, [])).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
});
