import { expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { fromJsString } from '#/datastruct/JagString.js';
import GlRenderer from '#/gl/GlRenderer.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import PixScreen from '#/graphics/PixScreen.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import type { GL } from '#/jogl/GL.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { localAssets } from '../cachefile.js';
import { cachePath } from '../reference.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function command(args: string[]): string[] {
    const result = Bun.spawnSync(args, { timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    return result.stdout.toString().trimEnd().split(/\r?\n/);
}

loginFixture(
    import.meta.url,
    'HD message box and state-10 draw match original GL commands, buffers and field order',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-title-draw-'));
        try {
            const cases: number[][] = [];
            for (const gl of [0, 1])
                for (const immediate of [0, 1]) {
                    for (const mode of [0, 1, 2, 3, 4, 5, 6, 7]) for (const text of [0, 1]) cases.push([0, gl, immediate, mode, -125, text]);
                    for (const guard of [-10, -11, -20, -95, -73]) cases.push([0, gl, immediate, 5, guard, 0]);
                    cases.push([0, gl, immediate, 8, -20, 0]);
                    for (const mode of [0, 1, 2, 3]) cases.push([1, gl, immediate, mode, 0, 0]);
                }
            const file = join(dir, 'cases.txt');
            writeFileSync(file, cases.map(v => v.join(' ')).join('\n'));
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            command(['javac', asm, '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdTitleDrawOracle.java')]);
            command(['java', asm, '-cp', cp, 'HdTitleDrawOracle', 'patch', hdGamepackPath, dir]);
            const expected = command(['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdTitleDrawOracle', file, cachePath]);
            expect(expected).toHaveLength(cases.length);
            const realGlyphs = expected.filter((_, i) => cases[i][1] === 1 && cases[i][3] === 8);
            expect(realGlyphs.map(row => row.match(/glCallList=/g)?.length)).toEqual([16, 16]);
            const pixels = new Int32Array(132 * 91);
            const text = fromJsString('RuneScape<br>Loading');
            const assets = localAssets(cachePath, [8, 13]);
            const sprites = assets.archive(8),
                metrics = assets.archive(13);
            const group = sprites.GetGroupId(fromJsString('p12_full'));
            let events: string[] = [];
            let editing = true,
                mode = 0;
            function watch(owner: object, member: string, java: string) {
                let value = Reflect.get(owner, member);
                Object.defineProperty(owner, member, {
                    configurable: true,
                    get() {
                        return value;
                    },
                    set(next) {
                        value = next;
                        if (!editing) events.push(java);
                    }
                });
            }
            watch(Minimenu, 'tooltipX2', 'hi.a');
            watch(Client, 'hoveredSlotCom', 'nf.h');
            watch(InterfaceList, 'cycle', 'oj.v');
            watch(Client, 'clearInterfaceModelDepth', 'vg.c');
            watch(Minimenu, 'tooltipY', 'rg.s');
            watch(InterfaceList, 'rootCount', 'bn.V');
            watch(AreaSoundManager, 'elapsed', 'od.i');
            Client.AnimateInterface = group => {
                events.push('animate=' + group);
                if (mode === 2) InterfaceList.top = -1;
            };
            Client['drawTopLevelInterface'] = () => {
                events.push('draw=' + Client.clearInterfaceModelDepth);
                if (mode === 1) GlRenderer.active = !GlRenderer.active;
                if (mode === 3) throw new Error('draw');
            };
            const fonts: PixfontGeneric[] = [];
            for (const id of [1, 2]) {
                const font: PixfontGeneric = Object.create(PixfontGeneric.prototype);
                font.getParagraphWidth = (_text, limit) => {
                    events.push('width=' + id + ',' + limit);
                    if (mode === 1 || mode === 2) Client.p12 = mode === 1 ? fonts[1] : null;
                    return 39;
                };
                font.getParagraphLineCount = (_text, limit) => {
                    events.push('lines=' + id + ',' + limit);
                    if (mode === 3) Client.p12 = fonts[1];
                    return 2;
                };
                font.drawParagraph = (_text, ...args) => {
                    events.push('text=' + [id, ...args].join(','));
                    if (mode === 4) GlRenderer.active = !GlRenderer.active;
                    if (mode === 5) throw new Error('paragraph');
                    return 0;
                };
                fonts.push(font);
            }
            const floats = new Float32Array(1),
                bits = new Int32Array(floats.buffer);
            let nextList = 1000;
            GlRenderer.gl = new Proxy({} as GL, {
                get(_target, k) {
                    if (k === 'glGenLists') return () => nextList++;
                    if (k === 'glGenTextures')
                        return (_count: number, ids: Int32Array, offset: number) => {
                            ids[offset] = 415;
                        };
                    return (...args: number[]) => {
                        const parameters = args.map(value => {
                            if (k !== 'glVertex2f' && k !== 'glTranslatef' && k !== 'glTexCoord2f') return value;
                            floats[0] = value;
                            return bits[0];
                        });
                        events.push(String(k) + '=' + parameters.join(','));
                    };
                }
            });
            Object.assign(GlRenderer, {
                drawable: {
                    swapBuffers() {
                        events.push('swapBuffers=');
                    }
                }
            });
            GameShell.canvas = {
                getGraphics() {
                    events.push('graphics');
                    return null;
                },
                repaint() {
                    events.push('repaint');
                }
            };
            const screen: PixScreen = Object.create(PixScreen.prototype);
            screen.draw = (x, y) => {
                events.push('blit=' + x + ',' + y);
                if (mode === 6) throw new Error('blit');
                if (mode === 7) throw new JavaError('fatal');
            };
            GameShell.drawArea = screen;
            for (const [index, v] of cases.entries()) {
                const [draw, active, flag, current, guard, nullText] = v;
                editing = true;
                mode = current;
                Client.p12 = fonts[0];
                pixels.fill(0x102030);
                Pix2D.setPixels(pixels, 132, 91);
                Object.assign(GlRenderer, { width: 132, height: 91, active: active === 1, ortho2d: false, lighting: true, depthTest: true, fog: true, boundTexture: -1, textureMatrixDirty: false });
                if (mode === 8) {
                    nextList = 1000;
                    const font = requireNonNull(SpriteLoader.loadFont(sprites, group, 0, metrics));
                    expect(font.constructor.name).toBe(active ? 'GlFont' : 'SoftwareFont');
                    const width = font.getParagraphWidth.bind(font),
                        lines = font.getParagraphLineCount.bind(font),
                        paragraph = font.drawParagraph.bind(font);
                    font.getParagraphWidth = (s, limit) => {
                        events.push('width=3,' + limit);
                        return width(s, limit);
                    };
                    font.getParagraphLineCount = (s, limit) => {
                        events.push('lines=3,' + limit);
                        return lines(s, limit);
                    };
                    font.drawParagraph = (s, ...args) => {
                        events.push('text=' + [3, ...args].join(','));
                        return paragraph(s, ...args);
                    };
                    Client.p12 = font;
                }
                InterfaceList.rootCount = 3;
                Object.assign(InterfaceList, { dirty: [false, true, false], rectangleRedraw: [false, false, true], rectRedrawnLastFrame: [true, false, false] });
                InterfaceList.rootX.set([0, 17, 120]);
                InterfaceList.rootY.set([0, 15, 2]);
                InterfaceList.rootWidth.set([9, 4, 7]);
                InterfaceList.rootHeight.set([9, 3, 4]);
                Minimenu.tooltipX2 = 13;
                Client.hoveredSlotCom = new IfType();
                InterfaceList.cycle = 12;
                Client.loopCycle = 77;
                Client.clearInterfaceModelDepth = false;
                Minimenu.tooltipY = 9;
                InterfaceList.top = flag === 1 ? 55 : -1;
                AreaSoundManager.elapsed = 42;
                events = [];
                editing = false;
                let outcome = 'ok';
                try {
                    if (draw) Client.drawGame(-54);
                    else Client.MessageBox(nullText ? null : text, flag === 1, guard);
                } catch (error) {
                    if (error instanceof WrappedException) outcome = String(error.context);
                    else if (error instanceof JavaError) outcome = 'fatal';
                    else throw error;
                }
                const flags = [InterfaceList.dirty, InterfaceList.rectangleRedraw, InterfaceList.rectRedrawnLastFrame].map(a => '[' + a.join(',') + ']').join('');
                const state = [Minimenu.tooltipX2, Client.hoveredSlotCom === null, InterfaceList.cycle, Client.clearInterfaceModelDepth, Minimenu.tooltipY, InterfaceList.rootCount, AreaSoundManager.elapsed];
                const hash = pixels.reduce((h, n) => (Math.imul(h, 31) + n) | 0, 1);
                expect([events.join(';'), outcome, hash, flags, state.join(',')].join('|'), v.join(' ')).toBe(expected[index]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
