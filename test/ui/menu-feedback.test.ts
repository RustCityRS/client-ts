import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { gamepackPath } from '../reference.js';
import { PIX2D, withClinitStatics, type StaticReset } from '../review/staticState.js';
import Client from '#/client/Client.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import { fromJsString } from '#/datastruct/JagString.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import JavaRandom from '#/util/JavaRandom.js';

function makeFont(style: number): SoftwareFont {
    const metrics = new Uint8Array(257).fill(4 + style);
    metrics[256] = 6 + style;
    const w = new Int32Array(256).fill(3 + style),
        h = new Int32Array(256).fill(4 + style);
    const x = Int32Array.from(w, (_, i) => (i + style) % 2),
        y = new Int32Array(256).fill(1);
    const masks = Array.from(w, (width, i) => Uint8Array.from({ length: width * h[i] }, (_, k) => +((i + 3 * k + style) % 5 < 3)));
    return new SoftwareFont(metrics, x, y, w, h, masks);
}

type MenuCase = { kind: number; count: number; x: number; y: number; w: number; h: number; mx: number; my: number; font: number; align: number; seed: number; selection: number; clip: number; fault: number };
function render(c: MenuCase): { state: string; frame: Buffer } {
    const word = fromJsString,
        bounds = Int32Array.of(-13, -11, -9, -7);
    const random = new JavaRandom(1987n),
        bold = makeFont(0),
        cache = new LRUHashCache<PixfontGeneric>(20);
    cache.Put(23n, makeFont(1));
    const component = c.font === -2 ? null : new IfType();
    if (component) Object.assign(component, { fontId: c.font, width: c.w, height: c.h, colour: 0xb54472, spriteShadow: 0x31230a, textAlignH: (c.align / 4) | 0, textAlignV: c.align % 4 });
    const pressed = new Array(112).fill(false);
    pressed[81] = c.selection === 3;
    const redraw = new Array(7).fill(false),
        dirty = new Array(7).fill(false);
    redraw[5] = true;
    dirty[6] = true;
    const resets: StaticReset[] = [
        PIX2D(),
        {
            target: Minimenu,
            clinit: {
                x: c.x,
                y: c.y,
                width: c.w,
                height: c.h,
                count: c.count,
                tooltipBounds: bounds,
                tooltipSeed: c.seed,
                tooltipRandom: random,
                option: ['Walk', 'Take', 'Read', 'Try', null].map(s => (s === null ? null : word(s))),
                target: ['', 'Coin', '<col=22bbda>Caf\xe9</col>', 'Box', ''].map(word),
                objSelected: +(c.selection === 1),
                objName: word('Key'),
                targetMode: c.selection === 2,
                targetVerb: word('Cast'),
                targetName: word('Fire'),
                shiftClick: c.selection === 3
            }
        },
        { target: Client, clinit: { fontBold12: bold } },
        { target: IfType, clinit: { m_fontCache: cache, resourceMissing: true, m_pSprites: null, m_pFontMetrics: null } },
        { target: ClientMouseListener, clinit: { x: c.mx, mouseY: c.my } },
        { target: ClientKeyboardListener, clinit: { pressed } },
        { target: LocalisedText, clinit: { chooseOption: word('Choose Option'), use: word('Use'), MOREOPTIONS: word(' more'), MINISEPERATOR: LocalisedText.englishMenuSeparator } },
        {
            target: InterfaceList,
            clinit: {
                rootX: Int32Array.of(0, 10, 43, 60, 80, 18, -8),
                rootY: Int32Array.of(0, 11, 4, 52, 63, 32, 16),
                rootWidth: Int32Array.of(7, 46, 15, 10, 25, 19, 16),
                rootHeight: Int32Array.of(7, 31, 13, 16, 27, 8, 12),
                rootCount: 7,
                dirty,
                rectangleRedraw: redraw
            }
        },
        { target: PixfontGeneric, clinit: { nameIcons: null, defaultAlpha: 256, colour: 0, justifySpacing: 0, strikeColour: -1, defaultColour: 0, alpha: 256, defaultShadowColour: -1, justifyRemainder: 0, underlineColour: -1, shadowColour: -1 } }
    ];
    return withClinitStatics(resets, () => {
        const pixels = Int32Array.from({ length: 96 * 72 }, (_, k) => (0x327019 ^ Math.imul(k, 0x778251)) & 0xffffff);
        Pix2D.setPixels(pixels, 96, 72);
        if (c.clip === 1) Pix2D.setClipping(7, 13, 41, 49);
        else if (c.clip === 2) Pix2D.setClipping(21, 23, 21, 23);
        switch (c.fault) {
            case 1:
                Client.fontBold12 = null;
                break;
            case 2:
                Reflect.set(Minimenu, 'target', null);
                break;
            case 3:
                Reflect.set(Minimenu, 'target', Minimenu.target.slice(0, 1));
                break;
            case 4:
                Reflect.set(Minimenu, 'option', Minimenu.option.slice(0, 1));
                break;
            case 5:
                Minimenu.target[0] = null;
                break;
            case 6:
                Reflect.set(InterfaceList, 'rectangleRedraw', [false]);
                Reflect.set(InterfaceList, 'dirty', [false]);
                break;
            case 7:
                Reflect.set(InterfaceList, 'rootWidth', Int32Array.of(7, 46));
                break;
            case 8:
                Reflect.set(Minimenu, 'tooltipBounds', null);
                break;
            case 9:
                Reflect.set(Minimenu, 'tooltipBounds', Int32Array.of(-13, -11));
                break;
            case 10:
                Reflect.set(Minimenu, 'tooltipRandom', null);
                break;
            case 11:
                IfType.resourceMissing = false;
                break;
            case 12:
                Reflect.set(LocalisedText, 'chooseOption', null);
                break;
        }
        const initialRandom = Minimenu.tooltipRandom,
            initialFont = Client.fontBold12;
        const probes: [object, string][] = [
            [Client, 'fontBold12'],
            [Minimenu, 'tooltipRandom'],
            [Minimenu, 'tooltipSeed'],
            [Minimenu, 'tooltipBounds'],
            [ClientMouseListener, 'x'],
            [ClientMouseListener, 'mouseY'],
            [Minimenu, 'x'],
            [Minimenu, 'y'],
            [Minimenu, 'width'],
            [Minimenu, 'height']
        ];
        let trace = '',
            hits = 0;
        const restore: (() => void)[] = [];
        if (c.fault >= 100)
            probes.forEach(([owner, field], site) => {
                const desc = Object.getOwnPropertyDescriptor(owner, field);
                if (!desc) throw new Error(field);
                let value: unknown = desc.value;
                Object.defineProperty(owner, field, {
                    configurable: true,
                    get() {
                        trace += site;
                        if (site === (((c.fault - 100) / 10) | 0) && ++hits === c.fault % 10) {
                            if (c.selection !== 4) throw new RangeError('injected read');
                            value = site === 0 ? makeFont(1) : site === 1 ? new JavaRandom(-443n) : site === 3 ? Int32Array.of(10, 11, 12, 13) : (Number(value) + 1) | 0;
                        }
                        return value;
                    }
                });
                restore.push(() => Object.defineProperty(owner, field, { ...desc, value }));
            });
        let result = 'ok';
        try {
            if (c.kind === 0) Minimenu.Draw();
            else Minimenu.DrawFeedbackText(c.x, component, c.y);
        } catch (e) {
            result = e instanceof RangeError ? 'bounds' : e instanceof TypeError ? 'null' : String(e);
        } finally {
            for (const reset of restore) reset();
        }
        const bools = (a: boolean[]) => a.map(b => (b ? '1' : '0')).join('');
        const state = [
            result,
            bools(InterfaceList.rectangleRedraw),
            bools(InterfaceList.dirty),
            Minimenu.tooltipBounds === null ? 'null' : '[' + Minimenu.tooltipBounds.join(', ') + ']',
            IfType.resourceMissing,
            Minimenu.tooltipRandom === null ? '-' : Minimenu.tooltipRandom.nextInt(),
            Minimenu.tooltipBounds === bounds,
            initialRandom === Minimenu.tooltipRandom,
            initialFont === Client.fontBold12,
            trace
        ].join('/');
        const frame = Buffer.alloc(pixels.length * 4);
        pixels.forEach((pixel, i) => frame.writeInt32BE(pixel, i * 4));
        return { state, frame };
    });
}

test('oi.b and ii.a match the original SD menu pixels, hover, font cache, jitter and partial redraws', () => {
    const standard: MenuCase = { kind: 0, count: 3, x: 4, y: 3, w: 77, h: 65, mx: 7, my: 34, font: -2, align: 0, seed: 219, selection: 0, clip: 0, fault: 0 };
    const cases: MenuCase[] = [];
    const add = (args: Partial<MenuCase>) => cases.push({ ...standard, ...args });
    for (const mx of [3, 4, 5, 80, 81]) for (const my of [20, 21, 22, 35, 36, 37, 48, 49, 50, 64]) add({ mx, my });
    for (const clip of [0, 1, 2])
        for (const [x, y, w, h] of [
            [-13, -9, 35, 45],
            [88, 65, 60, 30],
            [6, 3, 1, 7],
            [0, 0, -1, -1]
        ])
            add({ x, y, w, h, clip });
    for (const font of [-2, -1, 23, 4242])
        for (const align of [0, 1, 2, 4, 5, 6, 8, 9, 10, 15]) {
            for (const seed of [-2147483648, 37]) add({ kind: 1, font, align, seed });
        }
    for (const count of [-1, 0, 1, 2, 3, 4, 5, 6]) for (const selection of [0, 1, 2, 3]) add({ kind: 1, count, selection });
    for (const fault of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        add({ fault });
        for (const font of [-2, -1, 23]) add({ kind: 1, font, fault });
        for (const clip of [1, 2]) add({ kind: 1, font: 23, fault, clip, x: -8, y: -4 });
    }
    const ordinary = cases.length;
    for (let site = 0; site < 10; site++)
        for (const hit of [1, 2, 4])
            for (const selection of [0, 4]) {
                const fault = 100 + site * 10 + hit;
                add({ fault, selection });
                add({ kind: 1, font: -2, fault, selection });
                add({ kind: 1, font: 23, fault, selection });
            }
    const dir = mkdtempSync(join(tmpdir(), 'rs530-menu-feedback-'));
    try {
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const build = Bun.spawnSync(['javac', asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'menu-feedback-oracle.java')]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const commands = cases.map(c => Object.values(c).join(' '));
        const launch = ['java', asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'MenuFeedbackOracle'];
        function run(rows: string[]): string[] {
            const java = Bun.spawnSync(launch, { stdin: Buffer.from(rows.join('\n') + '\n'), maxBuffer: 64 * 1024 * 1024, timeout: 20000 });
            expect(java.stderr.toString()).toBe('');
            expect(java.exitCode).toBe(0);
            return java.stdout.toString().trimEnd().split(/\r?\n/);
        }
        const results = run(commands.slice(0, ordinary));
        const prepare = Bun.spawnSync([...launch, gamepackPath, dir]);
        expect(prepare.stderr.toString()).toBe('');
        expect(prepare.exitCode).toBe(0);
        results.push(...run(commands.slice(ordinary)));
        expect(results.length).toBe(cases.length);
        for (const [i, c] of cases.entries()) {
            const [state, image] = results[i].split('|'),
                expected = Buffer.from(image, 'base64'),
                actual = render(c);
            expect(actual.state, commands[i]).toBe(state);
            const mismatch = actual.frame.findIndex((byte, pos) => byte !== expected[pos]);
            expect(mismatch, `${commands[i]} pixel ${(mismatch / 4) | 0}`).toBe(-1);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
