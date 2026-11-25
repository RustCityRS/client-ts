import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixScreen, { CanvasComponent, type CanvasSurface } from '#/graphics/PixScreen.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { fromLiteral } from '#/datastruct/JagString.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

function hash(words: ArrayLike<number | boolean>): number {
    let value = 1;
    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        value = (Math.imul(value, 31) + (typeof word === 'boolean' ? (word ? 1231 : 1237) : word)) | 0;
    }
    return value;
}

test('MessageBox and MainRedraw match Java glyphs, rebuild percentages, reconnect text, image presentation and root damage', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-messagebox-'));
    const frame = GameShell.drawArea,
        active = Client.activeClient,
        plain = Client.p12,
        render = { ...Pix2D },
        fonts = { ...PixfontGeneric };
    const fontLines = requireNonNull(PixfontGeneric.splitLines).slice(),
        count = InterfaceList.rootCount;
    const arrays = [InterfaceList.rootX, InterfaceList.rootY, InterfaceList.rootWidth, InterfaceList.rootHeight];
    const savedArrays = arrays.map(a => a.slice()),
        dirty = InterfaceList.dirty.slice(),
        damaged = InterfaceList.rectangleRedraw.slice();
    const shell = { ...GameShell },
        textState = { ...LocalisedText },
        nativeState = {
            sceneState: Client.sceneState,
            mapFilesMissing: Client.mapFilesMissing,
            gameState: Client.gameState,
            locsNotReadyCount: Client.locsNotReadyCount,
            mapLoadingTotal: Client.mapLoadingTotal,
            maxLocModelsMissing: Client.maxLocModelsMissing
        };
    const complete = Client.loadingComplete;
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'MessageBoxOracle.java'), join(import.meta.dir, 'game', 'WindowModeOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const jvm = Bun.spawnSync(['java', '--add-opens=java.desktop/java.awt=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'MessageBoxOracle']);
        expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
        const refs = jvm.stdout.toString().trim().split(/\r?\n/);
        const w = 281,
            h = 127,
            screen = new Int32Array(w * h);
        const surface: CanvasSurface = {
            createImageData: (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }) as ImageData,
            putImageData(data, dx, dy, x, y, width, height) {
                for (let row = y; row < y + height; row++)
                    for (let col = x; col < x + width; col++) {
                        const k = (col + row * data.width) * 4,
                            d = data.data;
                        screen[dx + col + (row + dy) * w] = (d[k + 3] << 24) | (d[k] << 16) | (d[k + 1] << 8) | d[k + 2];
                    }
            }
        };
        const component = new CanvasComponent(surface);
        GameShell.canvas = component;
        const client = (Client.activeClient = new Client());
        client['host'] = { component } as NonNullable<(typeof client)['host']>;
        const pixmap = (GameShell.drawArea = await PixScreen.create(h, component, w));
        const metrics = new Uint8Array(257).fill(5);
        metrics[256] = 8;
        const zero = new Int32Array(256),
            width = new Int32Array(256).fill(3),
            height = new Int32Array(256).fill(5);
        const masks = Array.from({ length: 256 }, (_, c) => Uint8Array.from({ length: 15 }, (_, j) => +!!((c + j) % 3)));
        Client.p12 = new SoftwareFont(metrics, zero, zero, width, height, masks);
        const strings = ['Please wait', 'This line is deliberately long enough to wrap more than once when drawn in the original black message box.', 'first<br>second', '<col=ff00ff>text</col>-<lt>', '', null];
        for (let step = 0; step < 64; step++) {
            InterfaceList.rootCount = (step * 13) % 101;
            for (let i = 0; i < 100; i++) {
                InterfaceList.rootX[i] = ((37 * i + step) % 311) - 20;
                InterfaceList.rootY[i] = ((9 * i - step) % 170) - 7;
                InterfaceList.rootWidth[i] = (91 * i) % 90;
                InterfaceList.rootHeight[i] = (37 * i) % 41;
                InterfaceList.dirty[i] = i % 13 === 0;
                InterfaceList.rectangleRedraw[i] = i % 7 === 0;
            }
            const pixels = requireNonNull(pixmap.pixels);
            pixels.fill(0x112233);
            screen.fill(0xff445566);
            const text = strings[step % strings.length];
            Client.MessageBox(text === null ? null : fromLiteral(text), !!(step & 1));
            expect([hash(pixels), hash(screen), hash(InterfaceList.dirty), hash(InterfaceList.rectangleRedraw)].join(' '), 'step ' + step).toBe(refs[step]);
        }
        GameShell.fullScreenFrame = { getSize: () => ({ width: w, height: h }), getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
        GameShell.m_frameWidth = GameShell.m_sWid = w;
        GameShell.m_frameHeight = GameShell.m_sHei = h;
        GameShell.leftMargin = GameShell.topMargin = 0;
        Client.loadingComplete = false;
        LocalisedText.loadingPleaseWait2 = LocalisedText.englishLoadingPleaseWait2;
        LocalisedText.conlost = LocalisedText.englishConlost;
        LocalisedText.attempt_to_reestablish = LocalisedText.englishAttemptToReestablish;
        let row = 64;
        const amounts = [0, -2147483648, 6, 50, 2147483647, 1073741824],
            maxima = [0, 1, 17, 37, 2147483647, 1073741900];
        for (let language = 0; language < 3; language++) {
            LocalisedText.setLanguage(language);
            for (const state of [25, 28, 40, 20, 1000])
                for (const stage of [0, 1, 2, 3])
                    for (const [k, amount] of amounts.entries()) {
                        Client.gameState = state;
                        Client.sceneState = stage;
                        Client.locsNotReadyCount = Client.mapFilesMissing = amount;
                        Client.maxLocModelsMissing = Client.mapLoadingTotal = maxima[k];
                        GameShell.fullRedraw = (k & 1) === 0;
                        InterfaceList.rootCount = 34;
                        InterfaceList.rectangleRedraw.fill(true);
                        InterfaceList.dirty.fill(false);
                        const pixels = requireNonNull(pixmap.pixels);
                        pixels.fill(0x112233);
                        screen.fill(0xff445566);
                        let error = false;
                        try {
                            client['MainRedraw']();
                        } catch {
                            error = true;
                        }
                        const actual = [error, hash(pixels), hash(screen), hash(InterfaceList.dirty), hash(InterfaceList.rectangleRedraw), Client.mapLoadingTotal, Client.maxLocModelsMissing, GameShell.fullRedraw];
                        expect(actual.join(' '), [language, state, stage, k].join('/')).toBe(refs[row++]);
                    }
        }
        expect(row).toBe(refs.length);
    } finally {
        Object.assign(LocalisedText, textState);
        Object.assign(Client, nativeState);
        Object.assign(GameShell, shell);
        Client.loadingComplete = complete;
        GameShell.drawArea = frame;
        Client.activeClient = active;
        Client.p12 = plain;
        Object.assign(Pix2D, render);
        Object.assign(PixfontGeneric, fonts);
        requireNonNull(PixfontGeneric.splitLines).splice(0, fontLines.length, ...fontLines);
        arrays.forEach((a, i) => a.set(savedArrays[i]));
        InterfaceList.rootCount = count;
        InterfaceList.dirty.splice(0, dirty.length, ...dirty);
        InterfaceList.rectangleRedraw.splice(0, damaged.length, ...damaged);
        rmSync(dir, { recursive: true, force: true });
    }
});
