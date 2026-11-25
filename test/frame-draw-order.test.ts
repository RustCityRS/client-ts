import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { JavaCheckedException, JavaError } from '#/util/JavaException.js';
import { gamepackPath } from './reference.js';
import { loginFixture } from './login-fixture.js';

type Vector = [entry: number, group: number, menu: number, pointer: number, drawMode: number, bad: number, rectDebug: number, rootCount: number, failAt: number];
function vectors(): Vector[] {
    const rows: Vector[] = [];
    for (const entry of [0, 1])
        for (const group of [-1, 530]) for (const menu of [0, 1, 2]) for (let pointer = 0; pointer < 8; pointer++) for (let draw = 0; draw <= 9; draw++) rows.push([entry, group, menu, pointer, draw, 0, draw % 2 === 0 ? 3 : 0, 3, 0]);
    for (let bad = 1; bad <= 22; bad++)
        for (const entry of [0, 1])
            for (const [menu, draw, pointer] of [
                [0, 0, 0],
                [0, 5, 5],
                [1, 2, 2],
                [2, 4, 4],
                [0, 1, 4]
            ])
                rows.push([entry, 989, menu, pointer, draw, bad, 3, 3, 0]);
    for (const count of [-2147483648, -1, 0, 1, 4, 5, 2147483647]) for (const entry of [0, 1]) rows.push([entry, -1, 0, 2, 0, 0, 3, count, 0]);
    // Inject at each observable field access or call in the title, game, both menu skins, and both feedback routes.
    for (let fault = 1; fault <= 150; fault++)
        for (const [entry, menu, draw] of [
            [0, 0, 0],
            [1, 0, 1],
            [1, 0, 2],
            [1, 0, 6],
            [1, 1, 0],
            [1, 2, 0]
        ])
            rows.push([entry, 530, menu, 5, draw, 0, 3, 3, fault]);
    for (const entry of [0, 1]) for (const mode of [10, 11, 12]) rows.push([entry, 530, 0, 0, mode, 0, 0, 3, 0]);
    return rows;
}

loginFixture(
    import.meta.url,
    'title and game frames preserve original draw order, redraw flags, menu, cursor, sound and debug pixels',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-frame-draw-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cc = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/FrameDrawOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'FrameDrawOracle'];
            const observed = vectors();
            const unmodified: Vector[] = [];
            // With no root/menu, every remaining downstream operation has a native implementation.
            // Run these against the untouched gamepack first, with no replacement class on the classpath.
            for (const entry of [0, 1])
                for (let bad = 0; bad <= 22; bad++)
                    for (const size of [-1, 0, 3, 5]) {
                        unmodified.push([entry, -1, 0, bad & 7, 0, bad, 3, size, 0]);
                    }
            function reference(cases: Vector[]): string[] {
                const result = Bun.spawnSync(java, { stdin: Buffer.from(cases.map(v => v.join(' ')).join('\n') + '\n'), maxBuffer: 16 * 1024 * 1024 });
                expect(result.exitCode, result.stderr.toString()).toBe(0);
                const lines = result.stdout.toString().trimEnd().split(/\r?\n/);
                expect(lines.length).toBe(cases.length);
                return lines;
            }
            const expected = reference(unmodified);
            const prep = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prep.exitCode, prep.stderr.toString()).toBe(0);
            expected.push(...reference(observed));
            const rows = [...unmodified, ...observed];
            let active = false,
                drawMode = 0,
                faultAt = 0,
                count = 0,
                trace = '';
            const widget = new IfType(),
                player = new ClientPlayer(),
                sounds = AreaSoundManager.locs;
            const names = ['A', 'B', 'C', 'D', 'E'].map(fromJsString);
            let injected: Error | null = null;
            const set = Reflect.set;
            function event(label: string) {
                trace += label + ';';
                if (++count === faultAt) throw Error('probe');
            }
            function watch(owner: object, key: string, label: string): void {
                let value = Reflect.get(owner, key);
                Object.defineProperty(owner, key, {
                    configurable: true,
                    get() {
                        const before = value;
                        if (active) event('r' + label);
                        return before;
                    },
                    set(next: unknown) {
                        value = next;
                        if (active) event('w' + label);
                    }
                });
            }
            for (const [owner, spec] of [
                [InterfaceList, 'dirty=sf.m rectangleRedraw=ce.T rectRedrawnLastFrame=n.i rootCount=ik.G cycle=vk.db rootX=nh.Y rootY=r.U rootWidth=gk.i rootHeight=ik.Q top=hd.m'],
                [Client, 'loopCycle=hh.kb defaultCursor=ig.t rectDebug=ml.T playerLevel=ah.f localPlayer=te.g hoveredSlotCom=hg.f walkClickStage=lh.a targetTileState=vi.S'],
                [AreaSoundManager, 'elapsed=id.p'],
                [JagString, 'empty=ga.J'],
                [LocalisedText, 'cancel=dd.b'],
                [
                    Minimenu,
                    'tooltipY=jb.ab tooltipX2=oi.g tooltipComponent=nk.V isOpen=ie.F actions=p.u count=vb.o cursor=ia.n defaultCursor=aa.e deferred=pk.k mouseX=ve.g deferredX=g.n mouseY=ud.j deferredY=ef.J option=ak.a target=ph.e tooltipX=fd.Z tooltipY2=li.y spriteStyle=ec.g'
                ],
                [ClientMouseListener, 'clickButton=oi.h mouseY=pf.Q x=sj.C clickY=oj.e clickX=sa.x']
            ] as const)
                for (const mapping of spec.split(' ')) {
                    const [key, label] = mapping.split('=');
                    watch(owner, key, label);
                }
            type Inner = (args: unknown[], run: () => unknown) => unknown;
            function wrap(owner: object, key: string, body: Inner): void {
                const original = Reflect.get(owner, key);
                set(owner, key, function (this: object, ...args: unknown[]) {
                    if (!active) return Reflect.apply(original, this, args);
                    active = false;
                    try {
                        return body(args, () => Reflect.apply(original, this, args));
                    } finally {
                        active = true;
                    }
                });
            }
            wrap(Client, 'AnimateInterface', args => {
                event('animate,' + args[0]);
                if (drawMode === 8) InterfaceList.top = -1;
                if (drawMode === 9) {
                    InterfaceList.rootCount = 1;
                    Client.loopCycle = -2147483648;
                    InterfaceList.top = 771;
                    set(InterfaceList, 'dirty', [true, true, false]);
                }
            });
            wrap(Client, 'drawTopLevelInterface', () => {
                event('layer');
                InterfaceList.rootCount = 3;
                if (drawMode === 10) throw (injected = WrappedException.wrap(Error('probe'), 'layer'));
                if (drawMode === 11) throw (injected = new JavaError());
                if (drawMode === 12) throw (injected = new JavaCheckedException());
                if (drawMode === 1 || drawMode === 2) {
                    Minimenu.tooltipX2 = 41;
                    Minimenu.tooltipY = 56;
                    if (drawMode === 2) {
                        Minimenu.tooltipComponent = widget;
                        Minimenu.tooltipX = -7;
                        Minimenu.tooltipY2 = 91;
                    }
                }
                if (drawMode === 3) Minimenu.isOpen = true;
                if (drawMode === 4) Minimenu.isOpen = false;
                if (drawMode >= 5 && drawMode <= 7) {
                    Minimenu.count = 4;
                    set(Minimenu, 'actions', Int16Array.of(41, 1001, 13, 1002));
                    set(Minimenu, 'cursor', Int32Array.of(1, 207, drawMode === 5 ? -1 : 108, 91));
                    set(Minimenu, 'option', names.slice());
                    set(Minimenu, 'target', names.slice());
                    set(Minimenu, 'paramB', Int32Array.of(71, 70, 80, 72));
                    set(Minimenu, 'paramC', Int32Array.of(83, 85, 92, 81));
                    set(Minimenu, 'keys', BigInt64Array.of(-9223372036854775808n, 63n, 12n, 9223372036854775807n));
                    Minimenu.tooltipX2 = 11;
                    Minimenu.tooltipY = 44;
                }
                if (drawMode === 6) {
                    requireNonNull(Client.localPlayer).x = 734;
                    requireNonNull(Client.localPlayer).z = -289;
                    Client.playerLevel = 2;
                    AreaSoundManager.elapsed = -77;
                    Client.walkClickStage = Client.targetTileState = 1;
                }
                if (drawMode === 7) Client.localPlayer = null;
            });
            wrap(Pix2D, 'resetClipping', (_, run) => {
                event('clip');
                return run();
            });
            wrap(Minimenu, 'Sort', (_, run) => {
                event('sort');
                return run();
            });
            wrap(Minimenu, 'DrawFeedbackText', ([x, c, y]) => {
                event('tip,' + x + ',' + (c === null ? '~' : 'widget') + ',' + y);
            });
            wrap(Minimenu, 'Draw', () => event('classic'));
            wrap(Minimenu, 'DrawSpriteMenu', () => event('sprite'));
            wrap(Minimenu, 'topCursor', (_, run) => {
                event('top');
                return run();
            });
            wrap(Client, 'setCursor', ([id], run) => {
                event('cursor,' + id);
                return run();
            });
            wrap(Pix2D, 'fillRectTrans', (args, run) => {
                event('tint,' + args.join(','));
                return run();
            });
            wrap(AreaSoundManager, 'update', (args, run) => {
                event('sound,' + args.join(','));
                return run();
            });
            const bools = (a: boolean[] | null) => (a === null ? '~' : a.map(v => (v ? '1' : '0')).join(''));
            const ids = (a: (JagString | null)[] | null) => (a === null ? '~' : a.map(v => (v === null ? '~' : v === LocalisedText.cancel ? 'c' : v === JagString.empty ? 'e' : names.indexOf(v))).join(','));
            const nums = (a: Int16Array | Int32Array | BigInt64Array | null) => (a === null ? '~' : '[' + a.join(', ') + ']');
            for (const [i, v] of rows.entries()) {
                const [entry, group, menu, pointer, draw, bad, debug, rootCount, failAt] = v;
                InterfaceList.top = group;
                drawMode = draw;
                Client.rectDebug = debug;
                InterfaceList.rootCount = rootCount;
                faultAt = failAt;
                count = 0;
                trace = '';
                Minimenu.isOpen = menu !== 0;
                Minimenu.spriteStyle = menu === 2;
                ClientMouseListener.clickButton = pointer & 1;
                Minimenu.deferred = pointer & 2 ? 2 : 0;
                Minimenu.shiftClick = (pointer & 4) !== 0;
                set(ClientKeyboardListener, 'pressed', new Array<boolean>(112).fill(false));
                ClientKeyboardListener.pressed[81] = (pointer & 1) !== 0;
                ClientMouseListener.x = 13;
                ClientMouseListener.mouseY = 19;
                ClientMouseListener.clickX = 37;
                ClientMouseListener.clickY = 43;
                Minimenu.deferredX = 79;
                Minimenu.deferredY = 83;
                Minimenu.mouseX = 101;
                Minimenu.mouseY = -105;
                Minimenu.defaultCursor = 44;
                Client.defaultCursor = 57;
                Preferences.cursorsEnabled = false;
                Client.currentCursor = -1;
                Minimenu.count = 4;
                set(Minimenu, 'actions', Int16Array.of(40, 1001, 13, 1002));
                set(Minimenu, 'cursor', Int32Array.of(39, 50, 169, 72));
                set(Minimenu, 'option', names.slice());
                set(Minimenu, 'target', names.slice());
                set(Minimenu, 'paramB', Int32Array.of(6, 8, 1, 2));
                set(Minimenu, 'paramC', Int32Array.of(1, 7, 3, 9));
                set(Minimenu, 'keys', BigInt64Array.of(1n, 0n, 9223372036854775807n, -9223372036854775808n));
                set(InterfaceList, 'dirty', [false, true, false, true]);
                set(InterfaceList, 'rectangleRedraw', [true, false, false, true]);
                set(InterfaceList, 'rectRedrawnLastFrame', [true, false, true, false]);
                set(InterfaceList, 'rootX', Int32Array.of(-2, 3, 11, 15));
                set(InterfaceList, 'rootY', Int32Array.of(1, 2, 4, 7));
                set(InterfaceList, 'rootWidth', Int32Array.of(6, 8, 10, 1));
                set(InterfaceList, 'rootHeight', Int32Array.of(7, 9, 4, 2));
                InterfaceList.cycle = -33;
                Client.loopCycle = 121;
                AreaSoundManager.elapsed = 29;
                Client.playerLevel = 1;
                Client.localPlayer = player;
                player.x = 2451;
                player.z = 4407;
                set(AreaSoundManager, 'locs', sounds);
                Minimenu.tooltipY = 32;
                Minimenu.tooltipX2 = 12;
                Minimenu.tooltipX = 24;
                Minimenu.tooltipY2 = 50;
                Minimenu.tooltipComponent = Client.hoveredSlotCom = widget;
                Client.walkClickStage = pointer % 3;
                Client.targetTileState = (pointer + 1) % 3;
                const pixels = Int32Array.from({ length: 21 * 11 }, (_, i) => 0x234198 + i * 17);
                Pix2D.setPixels(pixels, 21, 11);
                Pix2D.setClipping(3, 4, 15, 7);
                switch (bad) {
                    case 1:
                        set(InterfaceList, 'dirty', null);
                        break;
                    case 2:
                        set(InterfaceList, 'dirty', [true]);
                        break;
                    case 3:
                        set(InterfaceList, 'rectangleRedraw', null);
                        break;
                    case 4:
                        set(InterfaceList, 'rectRedrawnLastFrame', null);
                        break;
                    case 5:
                        set(InterfaceList, 'rectRedrawnLastFrame', []);
                        break;
                    case 6:
                        set(InterfaceList, 'rectangleRedraw', [false]);
                        break;
                    case 7:
                        set(InterfaceList, 'dirty', [false, false, false, false]);
                        break;
                    case 8:
                        set(Minimenu, 'actions', new Int16Array(0));
                        break;
                    case 9:
                        set(Minimenu, 'cursor', null);
                        break;
                    case 10:
                        set(Minimenu, 'option', null);
                        break;
                    case 11:
                        set(Minimenu, 'target', []);
                        break;
                    case 12:
                        set(ClientKeyboardListener, 'pressed', null);
                        break;
                    case 13:
                        Client.localPlayer = null;
                        break;
                    case 14:
                        set(InterfaceList, 'rootX', null);
                        break;
                    case 15:
                        set(InterfaceList, 'rootY', new Int32Array(0));
                        break;
                    case 16:
                        set(InterfaceList, 'rootWidth', Int32Array.of(7));
                        break;
                    case 17:
                        set(InterfaceList, 'rootHeight', Int32Array.of(8));
                        break;
                    case 18:
                        set(Minimenu, 'keys', null);
                        break;
                    case 19:
                        set(InterfaceList, 'rectRedrawnLastFrame', InterfaceList.dirty);
                        break;
                    case 20:
                        set(InterfaceList, 'rectRedrawnLastFrame', InterfaceList.rectangleRedraw);
                        break;
                    case 21:
                        set(InterfaceList, 'dirty', InterfaceList.rectangleRedraw);
                        break;
                    case 22:
                        set(AreaSoundManager, 'locs', null);
                        break;
                }
                let fault = 'ok';
                injected = null;
                active = i >= unmodified.length;
                try {
                    if (entry === 0) Client.drawGame(-98);
                    else Client.GameDraw(101);
                } catch (e) {
                    const cause = e instanceof WrappedException ? e.cause : e;
                    if (cause instanceof JavaError) {
                        fault = 'fatal';
                    } else if (cause instanceof JavaCheckedException) {
                        fault = 'checked';
                    } else if (cause instanceof RangeError) {
                        fault = 'bounds';
                    } else if (cause instanceof TypeError) {
                        fault = 'null';
                    } else if (cause instanceof Error && cause.message === 'probe') {
                        fault = 'probe';
                    } else {
                        fault = String(cause);
                    }
                    if (e instanceof WrappedException) fault += '@' + e.context;
                    if (injected !== null) fault += '#' + (e === injected);
                } finally {
                    active = false;
                }
                const state = [
                    fault,
                    trace,
                    [InterfaceList.top, InterfaceList.rootCount, InterfaceList.cycle, Client.loopCycle, AreaSoundManager.elapsed],
                    bools(InterfaceList.dirty),
                    bools(InterfaceList.rectangleRedraw),
                    bools(InterfaceList.rectRedrawnLastFrame),
                    [Minimenu.tooltipY, Minimenu.tooltipX2, Minimenu.tooltipX, Minimenu.tooltipY2, Minimenu.tooltipComponent === null ? '~' : 'c', Client.hoveredSlotCom === null ? '~' : 'c'],
                    [Minimenu.isOpen, Minimenu.count, Minimenu.mouseX, Minimenu.mouseY, Client.walkClickStage, Client.targetTileState],
                    nums(Minimenu.actions),
                    nums(Minimenu.cursor),
                    ids(Minimenu.option),
                    ids(Minimenu.target),
                    nums(Minimenu.paramB),
                    nums(Minimenu.paramC),
                    nums(Minimenu.keys),
                    [Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY],
                    Buffer.from(pixels.buffer).toString('base64')
                ];
                const reference = expected[i].split('|');
                for (const [index, value] of state.entries()) expect(String(value), v.join(' ') + ' field ' + index).toBe(reference[index]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
