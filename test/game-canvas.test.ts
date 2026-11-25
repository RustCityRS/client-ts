import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import GameCanvas from '#/graphics/GameCanvas.js';
import BufferedImagePixMap from '#/graphics/BufferedImagePixMap.js';
import Pix2D from '#/graphics/Pix2D.js';
import { CanvasGraphics, type AwtGraphics, type CanvasSurface } from '#/graphics/PixScreen.js';
import { JavaError, clientErrorHost } from '#/util/ClientError.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { FileIoError } from '#/io/File.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from './reference.js';

test('GameCanvas forwards each graphics object and the original nested paint and update exceptions', () => {
    const dir = mkdtempSync(join(tmpdir(), '530-game-canvas-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/GameCanvasOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'GameCanvasOracle']);
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        const reference = run.stdout.toString().trimEnd().split(/\r?\n/);
        const draws = [null, {} as AwtGraphics, {} as AwtGraphics];
        const runtimeFailure = new Error(),
            seriousFailure = new JavaError(),
            checkedFailure = new FileIoError();
        let trace = '',
            mode = 0,
            row = 0;
        function record(id: number, method: 'P' | 'U', gr: AwtGraphics | null): void {
            trace += id + method + draws.indexOf(gr);
            if (id === 1 && ((mode >= 4 && mode <= 7) || mode === 9)) {
                if (method === 'U') nested.paint(gr);
                else nested.update(gr);
            } else if (mode === 1 || mode === 5) throw runtimeFailure;
            else if (mode === 2 || mode === 6) throw seriousFailure;
            else if (mode === 3 || mode === 7) throw WrappedException.wrap(runtimeFailure, 'parent');
            else if (mode >= 8) throw checkedFailure;
        }
        const parent = (id: number) => ({
            paint(gr: AwtGraphics | null) {
                record(id, 'P', gr);
            },
            update(gr: AwtGraphics | null) {
                record(id, 'U', gr);
            }
        });
        const nested = new GameCanvas(parent(2));
        for (const target of [null, parent(1)]) {
            const canvas = new GameCanvas(target);
            for (const method of ['paint', 'update'] as const)
                for (const gr of draws)
                    for (mode = 0; mode < 10; mode++) {
                        let result = 'ok';
                        trace = '';
                        try {
                            canvas[method](gr);
                        } catch (error) {
                            if (error instanceof WrappedException) {
                                result = error.context + '|' + (error.cause === runtimeFailure ? 'runtime' : error.cause instanceof TypeError ? 'null' : 'unknown');
                            } else if (error === seriousFailure) result = 'error';
                            else if (error === checkedFailure) result = 'checked';
                            else throw error;
                        }
                        expect(trace + '|' + result).toBe(reference[row++]);
                    }
        }
        expect(row).toBe(reference.length);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('mounting a replacement canvas keeps the native paint target and presents the live framebuffer to the new surface', () => {
    const globals = ['window', 'location', 'requestAnimationFrame'] as const;
    const descriptors = globals.map(key => Object.getOwnPropertyDescriptor(globalThis, key));
    const oldShell = { ...GameShell },
        oldClient = { ...Client },
        oldRaster = { ...Pix2D },
        oldBase = clientErrorHost.base;
    try {
        let pendingPaint: FrameRequestCallback | null = null;
        const values = [
            new EventTarget(),
            new URL('http://localhost/'),
            (callback: FrameRequestCallback) => {
                pendingPaint = callback;
                return 1;
            }
        ];
        globals.forEach((key, i) => Object.defineProperty(globalThis, key, { value: values[i], configurable: true }));
        const output: number[][] = [];
        class Element extends EventTarget {
            readonly style = {};
            readonly surface: CanvasSurface = {
                createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }) as ImageData,
                putImageData: image => {
                    output.push(Array.from(image.data));
                }
            };
            cloneNode() {
                return new Element();
            }
            replaceWith() {}
            getContext() {
                return this.surface;
            }
            focus() {}
        }
        class Shell extends Client {
            readonly updates: (AwtGraphics | null)[] = [];
            override update(graphics: AwtGraphics | null) {
                this.updates.push(graphics);
                super.update(graphics);
            }
        }
        const client = new Shell(),
            node = new Element();
        client['attachBrowser'](node as unknown as HTMLCanvasElement, node.surface as CanvasRenderingContext2D);
        const first = requireNonNull(client['host']).component;
        const next = client['mountCanvas']();
        expect(first).toBeInstanceOf(GameCanvas);
        expect(next).toBeInstanceOf(GameCanvas);
        expect(next).not.toBe(first);
        expect(next.surface).not.toBe(first.surface);
        GameShell.m_activeShell = client;
        GameShell.m_shutdown = GameShell.java5OrLater = GameShell.fullRedraw = false;
        GameShell.fullScreenFrame = { getSize: () => ({ width: 2, height: 1 }), getInsets: () => ({ top: 0, left: 0, bottom: 0, right: 0 }) };
        Client.gameState = 1;
        Client.loadingComplete = false;
        const frame = (GameShell.drawArea = new BufferedImagePixMap());
        frame.init(1, 2, next);
        requireNonNull(frame.pixels).set([0xff4001, 0x027f33]);
        client['MainRedraw']();
        expect(output).toEqual([[255, 64, 1, 255, 2, 127, 51, 255]]);
        frame.draw = () => {
            throw Error('lost surface');
        };
        client['MainRedraw']();
        expect(pendingPaint).toBeFunction();
        expect(GameShell.fullRedraw).toBe(false);
        (pendingPaint as unknown as FrameRequestCallback)(0);
        expect(client.updates).toHaveLength(1);
        expect(client.updates[0]).toBeInstanceOf(CanvasGraphics);
        expect(GameShell.fullRedraw).toBe(true);
    } finally {
        Object.assign(GameShell, oldShell);
        Object.assign(Client, oldClient);
        Object.assign(Pix2D, oldRaster);
        clientErrorHost.base = oldBase;
        globals.forEach((key, i) => {
            const descriptor = descriptors[i];
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else Reflect.deleteProperty(globalThis, key);
        });
    }
});
