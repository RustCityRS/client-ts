import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5ResourceProvider from '#/cache/Js5ResourceProvider.js';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import { fromJsString } from '#/datastruct/JagString.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlAlphaSprite from '#/gl/GlAlphaSprite.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlSprite from '#/gl/GlSprite.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import type AbstractSprite from '#/graphics/AbstractSprite.js';
import Pix2D from '#/graphics/Pix2D.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

const slots = ['titleBarSprite', 'skinTitleEndSprite2', 'bottomEdgeSprite', 'styleSideSprite', 'spriteBottomCorner'] as const;
const themes = [
    [9, 641, 13, 802, 14],
    [641, 9, 802, 13, 882]
];

function cases(): number[][] {
    const out: number[][] = [];
    for (const active of [0, 1])
        for (const theme of [0, 1]) {
            for (const mask of [0, 1, 2, 3, 7, 15, 27, 31]) {
                for (const preset of [0, 1, 3, 4, 28, 31]) out.push([active, mask, preset, 0, -1, theme]);
            }
            for (const mode of [1, 2, 3]) for (let i = 0; i < 10; i++) out.push([active, 31, 0, mode, i, theme]);
            for (const mask of [0, 31]) {
                out.push([active, mask, 0, 4, -1, theme]);
                for (let i = 0; i < 3; i++) out.push([active, mask, 0, 5, i, theme]);
            }
            for (const mode of [6, 7, 8, 9]) for (let i = 0; i < 5; i++) out.push([active, 31, 0, mode, i, theme]);
            out.push([active, 31, 0, 10, -1, theme]);
            for (const i of [0, 2, 3]) out.push([active, 31, 31, 11, i, theme]);
            for (const mode of [12, 13, 14]) out.push([active, mode === 14 ? 3 : 31, 0, mode, -1, theme]);
        }
    return out;
}

function outcome(error: unknown): string {
    let site = '';
    if (error instanceof WrappedException) {
        site = error.context?.endsWith('ij.F(116)') ? '/ij' : '/' + error.context;
        error = error.cause;
    }
    if (error instanceof JavaError) return 'AssertionError' + site;
    if (error instanceof TypeError) return (error.message.includes('ClassCastException') ? 'ClassCastException' : 'NullPointerException') + site;
    if (error instanceof RangeError && error.message === '/ by zero') return 'ArithmeticException' + site;
    if (error instanceof Error && error.message === 'upload') return 'IllegalStateException' + site;
    throw error;
}

loginFixture(
    import.meta.url,
    'HD textured minimenu matches JAR sprite stores, render switches, upload faults and GLTrace',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-sprite-menu-'));
        try {
            const profile = join(import.meta.dir, 'rtx5070.json');
            const rows = cases();
            const caseFile = join(dir, 'cases.txt');
            writeFileSync(caseFile, rows.map(row => row.join(' ')).join('\n'));
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdSpriteMenuOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Dgltrace.stacks=false', '-Djava.awt.headless=true', '-Dgltrace.caps=' + profile, '-cp', cp, 'HdSpriteMenuOracle'];
            const patch = Bun.spawnSync([...java, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([...java, cachePath, dir, caseFile], { maxBuffer: 4 * 1024 * 1024, timeout: 45000 });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(rows.length);
            const frames = readFileSync(join(dir, 'pixels.bin'));
            expect(frames.length).toBe(rows.length * 76 * 70 * 4);
            expect(expected.filter(row => row.startsWith('ClassCastException/ij|')).length).toBeGreaterThan(0);
            expect(expected.filter(row => row.startsWith('AssertionError|')).length).toBeGreaterThan(0);

            const assets = localAssets(cachePath, [8, 13]);
            const sprites = assets.archive(8);
            const provider = requireNonNull(sprites['provider']);
            const metrics = assets.archive(13);
            const fontId = sprites.GetGroupId(fromJsString('b12_full'));
            const writer = new GlTraceWriter();
            const driver = new RecordingGL(new NullGL(capsProfileFromJson(readFileSync(profile, 'utf8'))), writer);
            let mode = 0,
                at = 0,
                available = 0,
                uploads = 0,
                writes = 0,
                fills = 0;
            let ids: number[] = [];
            let events: string[] = [];
            const upload = driver.glTexImage2D.bind(driver);
            driver.glTexImage2D = (...args) => {
                if (uploads++ === at) {
                    if (mode === 8) throw new Error('upload');
                    if (mode === 9) throw new JavaError('upload');
                }
                upload(...args);
            };
            GlRenderer.gl = driver;
            GlRenderer.width = 76;
            GlRenderer.height = 70;
            const fonts = [false, true].map(active => {
                GlRenderer.active = active;
                const font = requireNonNull(SpriteLoader.loadFont(sprites, fontId, 0, metrics));
                const draw = font.drawLeft.bind(font);
                font.drawLeft = (...args) => {
                    draw(...args);
                    events.push('text');
                    if (mode === 4) GlRenderer.active = !GlRenderer.active;
                };
                return font;
            });
            for (const [raster, owner] of [
                [GlRaster, 'dj'],
                [Pix2D, 'kb']
            ] as const) {
                const draw = raster.fillRectTrans.bind(raster);
                raster.fillRectTrans = (...args) => {
                    draw(...args);
                    events.push(owner);
                    if (fills++ === at && mode === 5) GlRenderer.active = !GlRenderer.active;
                };
            }
            const fields: (AbstractSprite | null)[] = Array(5).fill(null);
            const retained: AbstractSprite[] = [];
            function state(): string {
                return fields
                    .map(sprite => {
                        if (sprite === null) return '_';
                        retained.push(sprite);
                        if (sprite instanceof GlAlphaSprite) return 'E';
                        if (sprite instanceof GlSprite) return 'C';
                        return sprite instanceof SoftwareAlphaSprite ? 'A' : 'P';
                    })
                    .join('');
            }
            for (const [slot, name] of slots.entries()) {
                Object.defineProperty(Minimenu, name, {
                    configurable: true,
                    get() {
                        return fields[slot];
                    },
                    set(value: AbstractSprite | null) {
                        fields[slot] = value;
                        events.push('s' + slot + state());
                        if (writes++ !== at) return;
                        if (mode === 1) GlRenderer.active = !GlRenderer.active;
                        if ((mode === 2 || mode === 3) && (slot === 0 || slot === 2 || slot === 3)) fields[slot + 1] = mode === 2 ? value : null;
                    }
                });
            }
            class Source extends Js5ResourceProvider {
                index() {
                    events.push('index');
                    return provider.index();
                }
                prefetchGroup() {
                    throw Error('unexpected prefetch');
                }
                GetGroupLoadPercentage(): number {
                    throw Error('unexpected percentage');
                }
                group(priority: number, group: number) {
                    const slot = ids.indexOf(group);
                    events.push('g' + slot);
                    if (slot === at && mode === 6) GlRenderer.active = !GlRenderer.active;
                    if (slot === at && mode === 7) Client.m_pSprites = null;
                    return (available & (1 << slot)) !== 0 ? provider.group(priority, group) : null;
                }
            }
            LocalisedText.chooseOption = fromJsString('Choose');
            for (let i = 0; i < 3; i++) {
                Minimenu.option[i] = fromJsString('Op' + i);
                Minimenu.target[i] = fromJsString(i === 1 ? 'target' : '');
            }
            for (const [number, row] of rows.entries()) {
                const [active, mask, preset, mutation, target, theme] = row;
                available = mask;
                mode = mutation;
                at = target;
                ids = themes[theme];
                writer.mark('case' + number);
                GlRenderer.active = active === 1;
                Client.fontBold12 = mode === 10 ? null : fonts[active];
                [Minimenu.skinTitleSpriteId, Minimenu.skinTitleEndSprite, Minimenu.bottomSpriteId, Minimenu.sideSpriteId, Minimenu.skinBottomCornerSprite] = ids;
                Client.m_pSprites = new Js5(new Source(), false, false);
                for (let i = 0; i < 5; i++) fields[i] = preset & (1 << i) ? SpriteLoader.loadSoftwareSpriteWithAlpha(0, sprites, ids[i]) : null;
                if (mode === 11) {
                    const sprite = requireNonNull(fields[at]);
                    sprite.width = sprite.height = 0;
                }
                Object.assign(Minimenu, { backgroundColour: 0x217a9f, highlightColour: 0xaa596f, transparency: 33, skinHoverAlpha: -17, textColour: 0xafffff, skinHighlightTextColour: 0xffaa23, x: 4, y: 2, height: 64, width: 48, count: 3 });
                ClientMouseListener.x = 14;
                ClientMouseListener.mouseY = 40;
                InterfaceList.rootCount = 2;
                InterfaceList.rootX.set([5, 69]);
                InterfaceList.rootY.set([5, 69]);
                InterfaceList.rootWidth.set([10, 2]);
                InterfaceList.rootHeight.set([10, 2]);
                InterfaceList.rectangleRedraw.fill(false);
                const pixels = new Int32Array(76 * 70).fill(0x172634);
                Pix2D.setPixels(pixels, 76, 70);
                Pix2D.setClipping(3, 3, 72, 67);
                events = [];
                uploads = writes = fills = 0;
                let result = 'ok';
                try {
                    Minimenu.DrawSpriteMenu();
                    if (mode === 12 || mode === 13 || mode === 14) {
                        events.push('again');
                        if (mode === 13) GlRenderer.active = !GlRenderer.active;
                        if (mode === 14) available = 31;
                        Minimenu.DrawSpriteMenu();
                    }
                } catch (error) {
                    result = outcome(error);
                }
                const dirty = InterfaceList.rectangleRedraw.slice(0, 2).join(',');
                const hash = pixels.reduce((h, n) => (Math.imul(h, 31) + n) | 0, 1);
                expect([result, events.join(','), state(), GlRenderer.active, dirty, hash].join('|'), row.join(' ')).toBe(expected[number]);
                const image = Buffer.alloc(pixels.byteLength);
                for (let i = 0; i < pixels.length; i++) image.writeInt32LE(pixels[i], i * 4);
                expect(image.equals(frames.subarray(number * image.length, (number + 1) * image.length)), 'frame ' + row.join(' ')).toBe(true);
            }
            const oracle = readFileSync(join(dir, 'trace.tsv'), 'utf8');
            const actual = writer.text();
            if (oracle !== actual) {
                const diff = diffTraces(oracle, actual, { includeDeletions: true, context: 4 });
                throw Error(diff.equal ? 'GLTrace encoding differs' : diff.report);
            }
            expect(retained.length).toBeGreaterThan(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000,
    'gl'
);
