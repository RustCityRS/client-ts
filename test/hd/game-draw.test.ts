import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import JagString from '#/datastruct/JagString.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import Pix2D from '#/graphics/Pix2D.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import Preferences from '#/ui/Preferences.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

function cases(): number[][] {
    const rows: number[][] = [];
    for (const active of [0, 1])
        for (const group of [-1, 548])
            for (const menu of [0, 1, 2]) {
                for (const guard of [0, 1, -98]) for (const pointer of [0, 1, 2]) for (const debug of [0, 3]) rows.push([active, guard, group, menu, pointer, 0, debug, 0, 0]);
            }
    for (const active of [0, 1]) for (const menu of [0, 1, 2]) for (let draw = 1; draw <= 7; draw++) rows.push([active, 0, 548, menu, 1, draw, 3, 0, 0]);
    for (const active of [0, 1]) for (const menu of [0, 1]) for (let bad = 1; bad <= 12; bad++) rows.push([active, 0, 548, menu, 2, 1, 3, bad, 0]);
    for (const [active, menu, draw] of [
        [1, 0, 1],
        [0, 0, 2],
        [1, 1, 7],
        [0, 2, 3]
    ]) {
        for (let event = 1; event <= 100; event++) rows.push([active, 0, 548, menu, 2, draw, 3, 0, event]);
    }
    return rows;
}

function outcome(error: unknown): string {
    let context = '';
    if (error instanceof WrappedException) {
        context = '@' + error.context;
        error = error.cause;
    }
    if (error instanceof JavaError) return 'AssertionError' + context;
    if (error instanceof TypeError) return 'NullPointerException' + context;
    if (error instanceof RangeError) return 'ArrayIndexOutOfBoundsException' + context;
    if (error instanceof Error && error.message === 'probe') return 'IllegalStateException' + context;
    throw error;
}

loginFixture(
    import.meta.url,
    'HD state-30 GameDraw matches original frame dispatch, raster, ordered field access and exceptional prefixes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-game-draw-'));
        try {
            const rows = cases();
            const casesFile = join(dir, 'cases.txt');
            writeFileSync(casesFile, rows.map(r => r.join(' ')).join('\n'));
            const profile = join(import.meta.dir, 'rtx5070.json');
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdGameDrawOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Dgltrace.stacks=false', '-Djava.awt.headless=true', '-Dgltrace.caps=' + profile, '-cp', cp, 'HdGameDrawOracle'];
            const patch = Bun.spawnSync([...java, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([...java, casesFile, dir], { maxBuffer: 8 * 1024 * 1024, timeout: 45000 });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(rows.length);

            const writer = new GlTraceWriter();
            GlRenderer.gl = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(profile, 'utf8'))), writer);
            GlRenderer.width = 21;
            GlRenderer.height = 11;
            const player = new ClientPlayer(),
                widget = new IfType();
            let observing = false,
                drawing = 0,
                faultAt = 0,
                n = 0,
                events = '';
            function event(name: string) {
                events += name + ';';
                if (++n === faultAt) throw Error('probe');
            }
            for (const [obj, fields] of [
                [GlRenderer, 'active=tf.w'],
                [InterfaceList, 'top=md.W rootCount=bn.V dirty=pa.R rectangleRedraw=ch.y rectRedrawnLastFrame=sc.z cycle=oj.v rootX=vh.b rootY=e.sc rootWidth=sd.V rootHeight=fe.lb'],
                [Client, 'loopCycle=gj.d hoveredSlotCom=nf.h clearInterfaceModelDepth=vg.c defaultCursor=wb.c targetTileState=jl.v walkClickStage=pb.ab rectDebug=qc.U localPlayer=nk.O playerLevel=ee.b'],
                [player, 'x=e.Qb z=e.ac'],
                [AreaSoundManager, 'elapsed=od.i'],
                [LocalisedText, 'cancel=wb.h'],
                [JagString, 'empty=pa.O'],
                [ClientMouseListener, 'x=rh.o mouseY=sc.v clickButton=lk.Z clickX=ah.s clickY=em.y'],
                [
                    Minimenu,
                    'isOpen=em.z deferred=ml.Q deferredX=wi.W deferredY=wl.u mouseX=me.nb mouseY=em.w count=sk.kb option=uj.C target=t.v actions=d.eb cursor=pf.r defaultCursor=cl.Y tooltipComponent=qf.X tooltipX2=hi.a tooltipY=rg.s tooltipX=kd.Bb tooltipY2=ld.c spriteStyle=ve.w'
                ]
            ] as const) {
                for (const pair of fields.split(' ')) {
                    const [key, field] = pair.split('=');
                    let value = Reflect.get(obj, key);
                    Object.defineProperty(obj, key, {
                        configurable: true,
                        get() {
                            if (observing) event('r' + field);
                            return value;
                        },
                        set(next) {
                            value = next;
                            if (observing) event('w' + field);
                        }
                    });
                }
            }
            function wrap(owner: object, key: string, body: (args: unknown[], original: () => unknown) => unknown) {
                const method = Reflect.get(owner, key);
                Reflect.set(owner, key, function (this: object, ...args: unknown[]) {
                    if (!observing) return Reflect.apply(method, this, args);
                    observing = false;
                    try {
                        return body(args, () => Reflect.apply(method, this, args));
                    } finally {
                        observing = true;
                    }
                });
            }
            wrap(Client, 'AnimateInterface', ([group]) => {
                event('animate' + group);
                if (drawing === 6) InterfaceList.top = -1;
            });
            wrap(Client, 'drawTopLevelInterface', () => {
                event('layer');
                InterfaceList.rootCount = 3;
                if (drawing === 1 || drawing === 2) {
                    Minimenu.tooltipX2 = 33;
                    Minimenu.tooltipY = 49;
                    if (drawing === 2) {
                        Minimenu.tooltipComponent = widget;
                        Minimenu.tooltipX = -7;
                        Minimenu.tooltipY2 = 18;
                    }
                }
                if (drawing === 3) GlRenderer.active = !GlRenderer.active;
                if (drawing === 4) Minimenu.isOpen = !Minimenu.isOpen;
                if (drawing === 5) throw new JavaError('fatal');
            });
            wrap(Minimenu, 'Draw', () => event('plain'));
            wrap(Minimenu, 'DrawSpriteMenu', () => event('sprite'));
            wrap(Minimenu, 'DrawFeedbackText', ([x, c, y, guard]) => {
                expect(guard).toBe(c === null ? -86 : -120);
                event('tip' + (c === null ? 0 : 1) + ',' + x + ',' + y);
            });
            wrap(Minimenu, 'Sort', (_, original) => {
                event('sort');
                return original();
            });
            wrap(Minimenu, 'topCursor', (_, original) => {
                event('cursor');
                return original();
            });
            wrap(Client, 'setCursor', ([id], original) => {
                event('apply' + id);
                return original();
            });
            wrap(AreaSoundManager, 'update', ([plane, elapsed, x, z]) => event('audio' + elapsed + ',' + x + ',' + z + ',' + plane));
            for (const [raster, prefix] of [
                [GlRaster, 'gl'],
                [Pix2D, 'sw']
            ] as const) {
                wrap(raster, 'resetClipping', (_, original) => {
                    event(prefix + 'Clip');
                    return original();
                });
                wrap(raster, 'fillRectTrans', (args, original) => {
                    event(prefix + 'Tint' + args[4]);
                    original();
                    if (drawing === 7) GlRenderer.active = !GlRenderer.active;
                });
            }
            const bools = (ary: boolean[] | null) => (ary === null ? '~' : ary.map(v => (v ? '1' : '0')).join(''));
            const names = (ary: (JagString | null)[] | null) => (ary === null ? '~' : ary.map(v => (v === LocalisedText.cancel ? 'c' : v === JagString.empty ? 'e' : 'x')).join(''));
            const ints = (ary: Int32Array | Int16Array | null) => (ary === null ? 'null' : '[' + ary.join(', ') + ']');
            for (const [number, v] of rows.entries()) {
                const [active, guard, group, menu, pointer, mode, debug, bad, fault] = v;
                drawing = mode;
                faultAt = fault;
                writer.mark('case' + number);
                InterfaceList.top = group;
                GlRenderer.active = active === 1;
                Object.assign(Minimenu, {
                    isOpen: menu !== 0,
                    spriteStyle: menu === 2,
                    deferred: pointer === 2 ? 2 : 0,
                    deferredX: 17,
                    deferredY: 20,
                    mouseX: 60,
                    mouseY: 61,
                    defaultCursor: 55,
                    shiftClick: true,
                    count: 3,
                    option: Array(3).fill(null),
                    target: Array(3).fill(null),
                    actions: Int16Array.of(41, 1003, 42),
                    cursor: Int32Array.of(33, 44, 55),
                    paramB: Int32Array.of(1, 2, 3),
                    paramC: Int32Array.of(4, 5, 6),
                    keys: BigInt64Array.of(7n, 8n, 9n),
                    tooltipComponent: widget,
                    tooltipX2: 9,
                    tooltipY: 11,
                    tooltipX: 13,
                    tooltipY2: 15
                });
                Object.assign(ClientMouseListener, { clickButton: pointer === 1 ? 1 : 0, x: 31, mouseY: 32, clickX: 41, clickY: 42 });
                Object.assign(Client, { defaultCursor: -4, currentCursor: -1, hoveredSlotCom: widget, clearInterfaceModelDepth: false, loopCycle: 67, targetTileState: 1, walkClickStage: 1, rectDebug: debug, localPlayer: player, playerLevel: 2 });
                Preferences.cursorsEnabled = false;
                Reflect.set(ClientKeyboardListener, 'pressed', new Array(112).fill(false));
                ClientKeyboardListener.pressed[81] = true;
                Object.assign(InterfaceList, {
                    rootCount: 3,
                    dirty: [true, false, false],
                    rectangleRedraw: [false, true, false],
                    rectRedrawnLastFrame: [false, true, true],
                    rootX: Int32Array.of(2, -2, 7),
                    rootY: Int32Array.of(1, 5, 0),
                    rootWidth: Int32Array.of(6, 10, 3),
                    rootHeight: Int32Array.of(3, 7, 8),
                    cycle: -2
                });
                AreaSoundManager.elapsed = 27;
                player.x = 123;
                player.z = -889;
                switch (bad) {
                    case 1:
                        Reflect.set(Minimenu, 'option', null);
                        break;
                    case 2:
                        Reflect.set(Minimenu, 'target', []);
                        break;
                    case 3:
                        Reflect.set(Minimenu, 'actions', new Int16Array(0));
                        break;
                    case 4:
                        Reflect.set(Minimenu, 'cursor', null);
                        break;
                    case 5:
                        Reflect.set(InterfaceList, 'dirty', [true]);
                        break;
                    case 6:
                        Reflect.set(InterfaceList, 'rectRedrawnLastFrame', null);
                        break;
                    case 7:
                        Reflect.set(InterfaceList, 'rectangleRedraw', []);
                        break;
                    case 8:
                        Reflect.set(InterfaceList, 'rootX', null);
                        break;
                    case 9:
                        Reflect.set(InterfaceList, 'rootHeight', new Int32Array(0));
                        break;
                    case 10:
                        Client.localPlayer = null;
                        break;
                    case 11:
                        Reflect.set(Minimenu, 'keys', null);
                        break;
                    case 12:
                        Reflect.set(ClientKeyboardListener, 'pressed', null);
                        break;
                }
                const pixels = new Int32Array(231).fill(0x265172);
                Pix2D.setPixels(pixels, 21, 11);
                Pix2D.setClipping(2, 3, 8, 7);
                events = '';
                n = 0;
                observing = true;
                let result = 'ok';
                try {
                    Client.GameDraw(guard);
                } catch (error) {
                    result = outcome(error);
                } finally {
                    observing = false;
                }
                const image = Buffer.alloc(pixels.byteLength);
                for (let i = 0; i < pixels.length; i++) image.writeInt32LE(pixels[i], i * 4);
                const fields = [
                    result,
                    events,
                    [InterfaceList.top, InterfaceList.rootCount, InterfaceList.cycle, AreaSoundManager.elapsed, Client.clearInterfaceModelDepth, GlRenderer.active].join(','),
                    bools(InterfaceList.dirty),
                    bools(InterfaceList.rectangleRedraw),
                    bools(InterfaceList.rectRedrawnLastFrame),
                    names(Minimenu.option),
                    names(Minimenu.target),
                    ints(Minimenu.actions),
                    ints(Minimenu.cursor),
                    [Minimenu.count, Minimenu.mouseX, Minimenu.mouseY, Client.targetTileState, Client.walkClickStage, Minimenu.tooltipX2, Minimenu.tooltipY, Minimenu.tooltipComponent === null, Client.hoveredSlotCom === null].join(','),
                    image.toString('base64')
                ];
                const javaFields = expected[number].split('|');
                for (const [i, field] of fields.entries()) expect(field, 'case ' + v.join(' ') + ' field ' + i).toBe(javaFields[i]);
            }
            const trace = readFileSync(join(dir, 'trace.tsv'), 'utf8');
            const actual = writer.text();
            if (trace !== actual) {
                const diff = diffTraces(trace, actual, { context: 4, includeDeletions: true });
                throw Error(diff.equal ? 'GLTrace encoding differs' : diff.report);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000,
    'gl'
);
