import TitleScreen from '#/title/TitleScreen.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GameShell from '#/client/GameShell.js';
import Client from '#/client/Client.js';
import { BrowserProgressCanvas, type ProgressCanvas, type ProgressFont, type ProgressGraphics, type ProgressImage } from '#/client/AwtProgressCanvas.js';
import { fromJsString } from '#/datastruct/JagString.js';
import { gamepackPath } from './reference.js';

// A pixel-backed CanvasRenderingContext2D endpoint for the browser adapter's integer rectangles and blits.
class Surface {
    width = 313;
    height = 71;
    readonly pixels = new Int32Array(313 * 71);
    readonly ownerDocument = { createElement: () => new Surface() };
    getContext() {
        const context = {
            font: '',
            fillStyle: '#000000',
            save() {},
            restore() {},
            fillText() {},
            measureText(text: string) {
                return { width: text === 'wide' ? 0x7fffffff : text.length * 11 };
            },
            fillRect: (x: number, y: number, w: number, h: number) => {
                const rgb = 0xff000000 | parseInt(context.fillStyle.substring(1), 16);
                for (let row = Math.max(0, y); row < Math.min(y + h, this.height); row++) {
                    const left = Math.max(x, 0),
                        right = Math.min(x + w, this.width);
                    if (left < right) this.pixels.fill(rgb, row * this.width + left, row * this.width + right);
                }
            },
            drawImage: (src: Surface, x: number, y: number) => {
                for (let v = 0; v < src.height; v++)
                    for (let u = 0; u < src.width; u++) {
                        if (x + u >= 0 && x + u < this.width && y + v >= 0 && y + v < this.height) this.pixels[(y + v) * this.width + x + u] = src.pixels[v * src.width + u];
                    }
            }
        };
        return context;
    }
}

test('initial loading bar matches t.a draw order, clipping, image reuse, fallback, retries and wi.a cleanup', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-progress-'));
    const saved = { ...GameShell },
        game = { gameState: Client.gameState },
        loading = [TitleScreen.m_loadPos, TitleScreen.m_loadString, Client.loadingComplete] as const;
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'ShellProgressOracle.java'), join(import.meta.dir, 'game', 'WindowModeOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const rows: (number | string)[][] = [];
        for (const [w, h] of [
            [313, 71],
            [765, 503],
            [1, 0],
            [-3, -5]
        ])
            for (const progress of [-2, 0, 1, 50, 100, 102, 0x7fffffff, -0x80000000]) {
                rows.push([1, 0, w, h, progress, 1, 'empty', 'null', -1], [0, 0, w, h, progress, 0, 'café', 'wide', 0x01023a]);
            }
        for (let fault = 1; fault <= 8; fault++)
            for (const clear of [0, 1]) {
                rows.push([1, fault, 312, 72, 47, clear, 'message', 'title', -1], [0, 0, 313, 71, 55, 0, 'wide', 'null', 123]);
            }
        for (const msg of ['null', 'empty', 'ÿ', 'wide']) rows.push([1, 0, 313, 71, 50, 0, msg, '½', 0x010101]);
        for (const entry of ['app', 'leave'])
            for (const clear of [0, 1])
                for (const fault of [0, 3, 5, 7]) {
                    rows.push([1, fault, 313, 71, 40, clear, 'message', 'title', -1, entry]);
                }
        const result = Bun.spawnSync(['java', '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ShellProgressOracle'], {
            stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n')
        });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        const expected = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected).toHaveLength(rows.length);
        const surface = new Surface();
        const browser = new BrowserProgressCanvas(surface as unknown as HTMLCanvasElement, () => {});
        let events: string[] = [],
            fault = 0;
        const fontInfo = (f: ProgressFont) => f.family + ',' + Number(f.bold) + ',' + f.size;
        type BackedImage = ProgressImage & { native: ProgressImage };
        const trace = (g: ProgressGraphics, bar: boolean): ProgressGraphics => ({
            setColor(c) {
                events.push('c' + c);
                g.setColor(c);
            },
            drawRect(x, y, w, h) {
                events.push('r' + [x, y, w, h]);
                g.drawRect(x, y, w, h);
            },
            fillRect(x, y, w, h) {
                events.push('f' + [x, y, w, h]);
                g.fillRect(x, y, w, h);
            },
            setFont(f) {
                events.push('font' + fontInfo(f));
                g.setFont(f);
            },
            drawString(s, x, y) {
                events.push('s' + [s, x, y]);
                if ((bar && fault === 6) || (!bar && fault === 7)) throw Error();
                g.drawString(s, x, y);
            },
            drawImage(image, x, y) {
                events.push('blit' + [x, y]);
                if (fault === 5) throw Error();
                g.drawImage((image as BackedImage).native, x, y);
            }
        });
        const canvas: ProgressCanvas = {
            getGraphics() {
                events.push('screen');
                if (fault === 1) throw Error();
                return trace(browser.getGraphics(), false);
            },
            getFontMetrics(f) {
                events.push('metrics' + fontInfo(f));
                if (fault === 2) throw Error();
                // ShellProgressOracle supplies these synthetic advances to test centering and overflow.
                return {
                    stringWidth(s) {
                        events.push('w' + s);
                        if (fault === 8) throw Error();
                        return s === 'wide' ? 0x7fffffff : s.length * 11;
                    }
                };
            },
            createImage(w, h) {
                events.push('new' + [w, h]);
                if (fault === 3) return null;
                const native = browser.createImage(w, h);
                return {
                    native,
                    getGraphics() {
                        events.push('bar');
                        if (fault === 4) throw Error();
                        return trace(native.getGraphics(), true);
                    }
                } as BackedImage;
            },
            repaint() {
                events.push('repaint');
            }
        };
        const str = (v: string | number) => (v === 'null' ? null : fromJsString(v === 'empty' ? '' : String(v)));
        GameShell.canvas = canvas;
        GameShell.fullScreenFrame = { getSize: () => ({ width: 313, height: 71 }), getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
        const client = new Client();
        for (const [i, [reset, mode, w, h, percent, clear, msg, title, colour, entry]] of rows.entries()) {
            if (reset) GameShell.ShowBasicPercentTidy();
            fault = Number(mode);
            events = [];
            GameShell.m_sWid = Number(w);
            GameShell.m_sHei = Number(h);
            GameShell.progressTitle = str(title);
            surface.pixels.fill(0xff416982);
            if (entry) {
                Client.gameState = 0;
                GameShell.fullRedraw = Boolean(clear);
                GameShell.m_frameWidth = Number(w);
                GameShell.m_frameHeight = Number(h);
                GameShell.leftMargin = GameShell.topMargin = 0;
                TitleScreen.m_loadPos = Number(percent);
                TitleScreen.m_loadString = fromJsString(String(msg));
                Client.loadingComplete = false;
                client['MainRedraw']();
                if (entry === 'leave') Client.SetMainState(1);
                events.push('state' + Client.gameState + ',' + GameShell.fullRedraw);
            } else GameShell.drawProgress(Number(percent), Boolean(clear), str(msg), colour === -1 ? null : Number(colour));
            const hash = msg === 'empty' && title === 'null' ? surface.pixels.reduce((v, p) => (Math.imul(v, 31) + p) | 0, 1) : 0;
            const caches = [GameShell.progressImage !== null, GameShell.progressFont !== null, GameShell.progressFontMetrics !== null];
            expect(events.join(';') + ';|' + caches + '|' + hash, rows[i].join(' ')).toBe(expected[i]);
        }
    } finally {
        Object.assign(GameShell, saved);
        Object.assign(Client, game);
        [TitleScreen.m_loadPos, TitleScreen.m_loadString, Client.loadingComplete] = loading;
        rmSync(dir, { recursive: true, force: true });
    }
});
