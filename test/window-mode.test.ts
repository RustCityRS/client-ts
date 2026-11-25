import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameCanvas from '#/graphics/GameCanvas.js';
import GameShell from '#/client/GameShell.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import Signlink from '#/util/Signlink.js';
import LocType from '#/config/LocType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Preferences from '#/ui/Preferences.js';
import { gamepackPath } from './reference.js';

// Only the DOM peer is substituted. Client still removes and re-attaches all
// input listeners, creates its new framebuffer and updates the gamepack state.
class Canvas extends EventTarget {
    width = 30;
    height = 40;
    style = { marginLeft: '10px', marginTop: '20px' };
    hidden = false;
    replacements = 0;
    constructor(
        readonly parentElement: { clientWidth: number; clientHeight: number },
        readonly ownerDocument: { body: object; documentElement: { clientWidth: number; clientHeight: number } }
    ) {
        super();
    }
    cloneNode(): Canvas {
        const next = new Canvas(this.parentElement, this.ownerDocument);
        next.replacements = this.replacements + 1;
        return next;
    }
    replaceWith(): void {}
    focus(): void {}
    getContext() {
        return {};
    }
    bounds(): number[] {
        return [parseInt(this.style.marginLeft), parseInt(this.style.marginTop), this.width, this.height];
    }
}

test('SD display mode requests match ui.a, he.a and p.c including the intermediate canvas and recursive fixed-mode fallback', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-window-'));
    const shell = { ...GameShell },
        prefs = { ...Preferences },
        keyboard = { ...ClientKeyboardListener },
        mouse = { ...ClientMouseListener },
        signlink = { ...Signlink };
    const dirty = InterfaceList.dirty.slice(),
        top = InterfaceList.top,
        low = LocType.m_lowMem,
        refresh = Client.windowModeRefreshTime;
    const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const savedClient = Client.activeClient,
        client = new Client(),
        worker = new Signlink(client);
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'WindowModeOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WindowModeOracle']);
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trim().split(/\r?\n/);
        Client.activeClient = client;
        GameShell.m_activeShell = client;
        GameShell.signlink = worker;
        InterfaceList.top = -1;
        let row = 0;
        for (let host = 0; host < 3; host++)
            for (let options = 0; options < 16; options++)
                for (let mode = -1; mode <= 5; mode++) {
                    const width = (options & 1) === 0 ? 1180 : 610,
                        height = (options & 1) === 0 ? 801 : 407;
                    const frame = (w: number, h: number) => ({
                        getSize: () => ({ width: w, height: h }),
                        getInsets: () => ({ top: 17, left: 3, bottom: 9, right: 8 })
                    });
                    GameShell.frame = host > 0 ? frame(width + 10, height + 20) : null;
                    GameShell.fullScreenFrame = host === 2 ? frame(width + 300, height + 200) : null;
                    Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
                    // A standalone canvas uses the viewport even if the body's height reflects the old fixed canvas.
                    // An embedded canvas uses its own parent even when the viewport is larger.
                    const standalone = (options & 2) === 0;
                    const bounds = { clientWidth: width, clientHeight: height };
                    const body = { clientWidth: width + 9, clientHeight: 503 };
                    const ownerDocument = { body, documentElement: standalone ? bounds : { clientWidth: 1620, clientHeight: 935 } };
                    const old = new Canvas(standalone ? body : bounds, ownerDocument);
                    const canvas = old as unknown as HTMLCanvasElement;
                    GameShell.canvas = canvas;
                    const canvas2d = old.getContext() as CanvasRenderingContext2D;
                    const component = new GameCanvas(client);
                    component.attachSurface(canvas2d);
                    client['host'] = {
                        canvas,
                        canvas2d,
                        component,
                        ...client['browserInputs'](canvas)
                    };
                    Signlink.osNameLower = (options & 2) !== 0 ? 'mac os x' : 'windows';
                    Preferences.windowMode = options % 3;
                    Preferences.allLevelsVisible = (options & 1) !== 0;
                    GameShell.fullRedraw = GameShell.m_focus = GameShell.m_focusIn = false;
                    LocType.m_lowMem = GameShell.canvasInvalid = true;
                    GameShell.m_frameWidth = GameShell.m_frameHeight = GameShell.m_sWid = GameShell.m_sHei = GameShell.leftMargin = GameShell.topMargin = -44;
                    GameShell.canvasSetTime = 0n;
                    Client.windowModeRefreshTime = 12345n;
                    InterfaceList.dirty.fill(false);
                    if (mode === 5) Client.resizeCanvas();
                    else Client.setWindowMode(123, (options & 4) !== 0, mode, (options & 8) !== 0, 456);
                    const active = GameShell.canvas as unknown as Canvas;
                    const hash = InterfaceList.dirty.reduce((h, v) => (Math.imul(h, 31) + (v ? 1231 : 1237)) | 0, 1);
                    const actual = [
                        Client.getWindowMode(),
                        Client.windowModeRefreshTime,
                        GameShell.m_frameWidth,
                        GameShell.m_frameHeight,
                        GameShell.m_sWid,
                        GameShell.m_sHei,
                        GameShell.leftMargin,
                        GameShell.topMargin,
                        ...active.bounds(),
                        ...old.bounds(),
                        active.replacements,
                        LocType.m_lowMem,
                        GameShell.m_focus,
                        GameShell.m_focusIn,
                        GameShell.canvasInvalid,
                        GameShell.canvasSetTime !== 0n,
                        GameShell.fullRedraw,
                        hash
                    ];
                    expect(actual.join(' '), 'host ' + host + ' options ' + options + ' mode ' + mode).toBe(lines[row++]);
                }
        for (let options = 0; options < 32; options++) {
            const pixels = new Int32Array(91 * 79).fill(0xff445566);
            const frame = {
                getSize: () => ({ width: 79, height: 55 }),
                getInsets: () => ({ top: 17, left: 3, bottom: 9, right: 8 }),
                getGraphics: () => ({
                    fillBlackRect(x: number, y: number, w: number, h: number) {
                        for (let j = Math.max(0, y); j < Math.min(79, y + h); j++) {
                            for (let i = Math.max(0, x); i < Math.min(91, x + w); i++) pixels[j * 91 + i] = 0xff000000;
                        }
                    }
                })
            };
            GameShell.frame = frame;
            GameShell.fullScreenFrame = (options & 1) === 0 ? null : { ...frame };
            GameShell.m_frameWidth = 79;
            GameShell.m_frameHeight = 55;
            GameShell.leftMargin = (options & 2) === 0 ? -4 : 11;
            GameShell.topMargin = (options & 4) === 0 ? -7 : 9;
            GameShell.m_sWid = (options & 8) === 0 ? 48 : 99;
            GameShell.m_sHei = (options & 16) === 0 ? 36 : 66;
            GameShell.clearCanvasMargins();
            const hash = pixels.reduce((h, p) => (Math.imul(h, 31) + p) | 0, 1);
            expect(hash.toString(), 'AWT frame margin raster ' + options).toBe(lines[row++]);
        }
        expect(lines.length).toBe(row);
    } finally {
        await worker.stopWorker();
        Client.activeClient = savedClient;
        Object.assign(GameShell, shell);
        Object.assign(Preferences, prefs);
        Object.assign(ClientKeyboardListener, keyboard);
        Object.assign(ClientMouseListener, mouse);
        Object.assign(Signlink, signlink);
        InterfaceList.dirty.splice(0, dirty.length, ...dirty);
        InterfaceList.top = top;
        LocType.m_lowMem = low;
        Client.windowModeRefreshTime = refresh;
        if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
        else Reflect.deleteProperty(globalThis, 'window');
        rmSync(dir, { recursive: true, force: true });
    }
});
