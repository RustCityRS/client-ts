import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import BufferedImagePixMap from '#/graphics/BufferedImagePixMap.js';
import { CanvasComponent, type AwtGraphics, type CanvasSurface } from '#/graphics/PixScreen.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Preferences from '#/ui/Preferences.js';
import { JavaError } from '#/util/ClientError.js';
import WrappedException from '#/util/WrappedException.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath } from './render/hd-reference.js';

type Case = [state: number, debug: number, full: number, count: number, mode: number, failAt?: number];

loginFixture(
    import.meta.url,
    'MainRedraw presents the original full and dirty pixel regions and repaints the live canvas after a failed blit',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-frame-present-'));
        try {
            const rows: Case[] = [];
            for (const state of [10, 20, 30, 1000]) for (const debug of [-1, 0, 3]) for (const full of [0, 1]) for (const count of [-2147483648, 0, 1, 4, 6, 7, 2147483647]) rows.push([state, debug, full, count, 0]);
            for (const state of [10, 30, 20]) for (let mode = 1; mode <= 29; mode++) for (const full of [0, 1]) rows.push([state, 0, full, 4, mode]);
            const sources = join(import.meta.dir, 'game');
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cc = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(sources, 'WindowModeOracle.java'), join(sources, 'FramePresentationOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', asm, '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true'];
            const run = Bun.spawnSync([...java, '-cp', dir + delimiter + gamepackPath, 'FramePresentationOracle'], { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n')), maxBuffer: 16 * 1024 * 1024 });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trim().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);

            const width = 19,
                height = 13,
                screen = new Int32Array(width * height);
            const surface: CanvasSurface = {
                createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as ImageData,
                putImageData(image, dx, dy, x, y, w, h) {
                    for (let row = y; row < y + h; row++)
                        for (let col = x; col < x + w; col++) {
                            const offset = (col + row * image.width) * 4,
                                d = image.data;
                            screen[col + dx + (row + dy) * width] = (d[offset + 3] << 24) | (d[offset] << 16) | (d[offset + 1] << 8) | d[offset + 2];
                        }
                }
            };
            const component = new CanvasComponent(surface),
                client = new Client();
            GameShell.fullScreenFrame = { getSize: () => ({ width, height }), getInsets: () => ({ top: 0, left: 0, bottom: 0, right: 0 }) };
            GameShell.m_frameWidth = GameShell.m_sWid = width;
            GameShell.m_frameHeight = GameShell.m_sHei = height;
            GameShell.leftMargin = GameShell.topMargin = 0;
            GameShell.canvasInvalid = false;
            Client.windowModeRefreshTime = 0n;
            Client.loadingComplete = Preferences.safeMode = false;
            InterfaceList.top = -1;
            let original: boolean[] = [],
                events = '',
                count = 0,
                mode = 0,
                draws = 0,
                targetState = 0;
            let graphics = component.getGraphics(),
                traceReads = false,
                tracing = false,
                reads = 0,
                failAt = 0;
            const installRoots = () => {
                InterfaceList.rootCount = count;
                original = [true, false, true, true, false, true];
                Object.assign(InterfaceList, {
                    rectangleRedraw: original,
                    rootHeight: Int32Array.of(6, 2, 4, 9, 1, 2),
                    rootWidth: Int32Array.of(9, 2, 5, 23, 6, -3),
                    rootX: Int32Array.of(-2, 3, 4, 7, 5, 0),
                    rootY: Int32Array.of(3, 2, -1, 8, 6, 1)
                });
            };
            const canvas = (id: number) => ({
                getGraphics() {
                    events += 'G' + id + ';';
                    installRoots();
                    switch (mode) {
                        case 1:
                            throw Error();
                        case 2:
                            throw new JavaError();
                        case 3:
                            GameShell.canvas = secondCanvas;
                            throw Error();
                        case 4:
                            GameShell.canvas = null;
                            throw Error();
                        case 5:
                            return null;
                        case 6:
                            GameShell.drawArea = secondMap;
                            break;
                        case 7:
                            GameShell.drawArea = null;
                            break;
                        case 8:
                            InterfaceList.rootCount = 0;
                            break;
                        case 9:
                            InterfaceList.rootCount = 6;
                            break;
                        case 10:
                            Object.assign(InterfaceList, { rectangleRedraw: null });
                            break;
                        case 11:
                            Object.assign(InterfaceList, { rectangleRedraw: [false, true] });
                            break;
                        case 12:
                            Object.assign(InterfaceList, { rootHeight: InterfaceList.rootHeight.slice(0, 2) });
                            break;
                        case 13:
                            Object.assign(InterfaceList, { rootX: null });
                            break;
                        case 14:
                            Object.assign(InterfaceList, { rootWidth: null });
                            break;
                        case 15:
                            Object.assign(InterfaceList, { rootY: null });
                            break;
                        case 26:
                            throw Error();
                    }
                    return graphics;
                },
                repaint() {
                    events += 'R' + id + ';';
                    if (mode === 26) throw new Error('repaint');
                }
            });
            const firstCanvas = canvas(1),
                secondCanvas = canvas(2);
            const area = (id: number) => {
                const map = new BufferedImagePixMap();
                map.init(height, width, component);
                const pixels = requireNonNull(map.pixels);
                for (let i = 0; i < pixels.length; i++) pixels[i] = (id * 0x194877 + i * 0x7023) & 0xffffff;
                const before = (g: AwtGraphics | null) => {
                    events += (g === null ? 'null' : g === graphics ? 'g' : '?') + ';';
                    draws++;
                    if ((mode === 16 && draws === 1) || (mode === 17 && draws === 2)) throw Error();
                    if (mode === 18 && draws === 1) throw new JavaError();
                };
                const after = () => {
                    if (draws !== 1) return;
                    switch (mode) {
                        case 19:
                            Object.assign(InterfaceList, { rectangleRedraw: [true, true, false, true, false, false] });
                            break;
                        case 20:
                            Object.assign(InterfaceList, { rectangleRedraw: null });
                            break;
                        case 21:
                            GameShell.drawArea = secondMap;
                            GameShell.canvas = secondCanvas;
                            break;
                        case 22:
                            InterfaceList.rootCount = 1;
                            break;
                        case 23:
                            InterfaceList.rootCount = 6;
                            break;
                        case 24:
                            InterfaceList.rootHeight[2] = 7;
                            InterfaceList.rootWidth[2] = 3;
                            InterfaceList.rootX[2] = -1;
                            InterfaceList.rootY[2] = -2;
                            break;
                        case 25:
                            Client.gameState = 0;
                            GameShell.fullRedraw = true;
                            break;
                        case 27:
                            GameShell.canvas = secondCanvas;
                            throw Error();
                        case 28:
                            Object.assign(InterfaceList, { rectangleRedraw: [] });
                            break;
                    }
                };
                const full = map.draw.bind(map),
                    clipped = map.drawClipped.bind(map);
                map.draw = (x, y, g) => {
                    events += 'F' + [id, x, y].join(',') + ',';
                    before(g);
                    full(x, y, g);
                    after();
                };
                map.drawClipped = (h, w, x, y, g) => {
                    events += 'D' + [id, h, w, x, y].join(',') + ',';
                    before(g);
                    clipped(h, w, x, y, g);
                    after();
                };
                return map;
            };
            const firstMap = area(1),
                secondMap = area(2);
            const flags = (value: boolean[] | null) => (value === null ? '~' : value.map(v => (v ? '1' : '0')).join(''));
            // The JAR uses no top interface. Both original frame bodies still run in states 10 and 30.
            Client.localPlayer = new ClientPlayer();
            const drawGame = Client.drawGame,
                gameDraw = Client.GameDraw;
            Client.drawGame = guard => {
                drawGame(guard);
                tracing = traceReads;
            };
            Client.GameDraw = guard => {
                gameDraw(guard);
                tracing = traceReads;
            };
            const observe = (row: Case) => {
                let debug: number, full: number;
                [targetState, debug, full, count, mode, failAt = 0] = row;
                Client.gameState = targetState;
                Client.rectDebug = debug;
                GameShell.fullRedraw = full !== 0;
                GameShell.drawArea = firstMap;
                GameShell.canvas = mode === 29 ? null : firstCanvas;
                InterfaceList.rootCount = 0;
                original = [true, true, true];
                Object.assign(InterfaceList, { rectangleRedraw: original });
                graphics = component.getGraphics();
                graphics.clipRect(1, 1, width - 2, height - 2);
                screen.fill(0xff324152);
                events = '';
                draws = reads = 0;
                let status = 'ok';
                try {
                    client['MainRedraw']();
                } catch (err) {
                    const cause = err instanceof WrappedException ? err.cause : err;
                    status = cause instanceof JavaError ? 'error' : cause instanceof TypeError ? 'null' : cause instanceof Error ? cause.message : String(cause);
                    if (err instanceof WrappedException) status += '@' + err.context;
                }
                tracing = false;
                return [status, events, InterfaceList.rootCount, flags(original), flags(InterfaceList.rectangleRedraw), GameShell.fullRedraw, Client.gameState, Buffer.from(screen.buffer).toString('base64')].join('|');
            };
            for (const [i, row] of rows.entries()) expect(observe(row), row.join('/')).toBe(expected[i]);

            const observed = join(dir, 'observed');
            mkdirSync(observed);
            const patch = Bun.spawnSync([...java, '-cp', dir + delimiter + gamepackPath, 'FramePresentationOracle', gamepackPath, observed]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const faultRows: Case[] = [];
            for (const state of [10, 30]) for (const debug of [0, 3]) for (let fault = 0; fault <= 40; fault++) faultRows.push([state, debug, 0, 4, 0, fault]);
            const probes = Bun.spawnSync([...java, '-cp', observed + delimiter + dir + delimiter + gamepackPath, 'FramePresentationOracle'], { stdin: Buffer.from(faultRows.map(row => row.join(' ')).join('\n')), maxBuffer: 16 * 1024 * 1024 });
            expect(probes.exitCode, probes.stderr.toString()).toBe(0);
            const traces = probes.stdout.toString().trim().split(/\r?\n/);
            expect(traces.length).toBe(faultRows.length);
            // Instrument the same storage at its property read. This fixture runs in
            // a separate process so the live classes keep their ordinary fields.
            for (const [owner, fields] of [
                [Client, { gameState: 'tf.C', rectDebug: 'ml.T', loadingComplete: 'end' }],
                [GameShell, { canvas: 'pe.S', drawArea: 'rg.s' }],
                [InterfaceList, { rootCount: 'ik.G', rectangleRedraw: 'ce.T', rootHeight: 'ik.Q', rootWidth: 'gk.i', rootX: 'nh.Y', rootY: 'r.U' }]
            ] as const) {
                for (const [field, key] of Object.entries(fields)) {
                    let value: unknown = Reflect.get(owner, field);
                    Object.defineProperty(owner, field, {
                        configurable: true,
                        enumerable: true,
                        set(v: unknown) {
                            value = v;
                        },
                        get() {
                            if (key === 'end') tracing = false;
                            if (tracing) {
                                events += key + ';';
                                if (++reads === failAt) throw Error('probe');
                            }
                            return value;
                        }
                    });
                }
            }
            traceReads = true;
            for (const [i, row] of faultRows.entries()) expect(observe(row), row.join('/')).toBe(traces[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    20000
);

loginFixture(
    import.meta.url,
    'HD gamepack software presentation evaluates dirty rectangle operands in JVM order',
    async () => {
        const dump = Bun.spawnSync(['javap', '-p', '-c', '-classpath', hdGamepackPath, 'client']);
        expect(dump.exitCode, dump.stderr.toString()).toBe(0);
        const body = dump.stdout
            .toString()
            .split('void f(int);')[1]
            .split(/\r?\n {2}\S/)[0];
        const fields = {
            'sd.V': 'rootWidth',
            'vh.b': 'rootX',
            'fe.lb': 'rootHeight',
            'e.sc': 'rootY'
        } as const;
        const call = body.match(/getstatic[^\n]*Field vd\.w:Lvk;([\s\S]*?)invokevirtual[^\n]*vk\.a:\(IIIILjava\/awt\/Graphics;I\)V/);
        expect(call).not.toBeNull();
        const order = [...requireNonNull(call)[1].matchAll(/getstatic[^\n]*Field (\w+\.\w+):\[I/g)].map(match => fields[match[1] as keyof typeof fields]);
        expect(order).toEqual(['rootWidth', 'rootX', 'rootHeight', 'rootY']);

        const game = new Client();
        GameShell.fullScreenFrame = { getSize: () => ({ width: 765, height: 503 }), getInsets: () => ({ top: 0, left: 0, bottom: 0, right: 0 }) };
        GameShell.canvasInvalid = GameShell.fullRedraw = false;
        GameShell.m_focus = true;
        Client.gameState = 10;
        Client.rectDebug = 0;
        Client.loadingComplete = Preferences.safeMode = false;
        Client.drawGame = () => {};
        InterfaceList.rootCount = 1;
        let stop = '';
        let events: string[] = [];
        const coordinates = { rootHeight: 6, rootWidth: 9, rootX: -2, rootY: 3 };
        for (const [key, value] of Object.entries(coordinates)) {
            const array = Int32Array.of(value);
            Object.defineProperty(InterfaceList, key, {
                configurable: true,
                get() {
                    events.push(key);
                    if (stop === key) throw new RangeError(key);
                    return array;
                }
            });
        }
        Object.assign(GameShell, {
            canvas: {
                getGraphics() {
                    return {};
                },
                repaint() {
                    events.push('repaint');
                }
            },
            drawArea: {
                drawClipped(h: number, w: number, x: number, y: number) {
                    events.push([h, w, x, y].join(','));
                }
            }
        });
        for (stop of ['', ...order]) {
            InterfaceList.rectangleRedraw[0] = true;
            events = [];
            await game['MainRedraw']();
            const expected = stop ? [...order.slice(0, order.indexOf(stop as (typeof order)[number]) + 1), 'repaint'] : [...order, '6,9,-2,3'];
            expect(events).toEqual(expected);
            expect(InterfaceList.rectangleRedraw[0]).toBe(Boolean(stop));
        }
    },
    20000,
    'gl'
);
