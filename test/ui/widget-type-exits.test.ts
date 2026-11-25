import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ObjType from '#/config/ObjType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import PixfontGeneric from '#/graphics/PixfontGeneric.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import { compareFramebuffers } from '../render/Framebuffer.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { readReferenceFrames } from '../reference-frames.js';
import { cachePath, gamepackPath } from '../reference.js';

const width = 48,
    height = 32,
    lineColour = 0xb465c3;

loginFixture(
    import.meta.url,
    'DrawLayer preserves JVM branch exits when rendering changes the current widget type',
    async () => {
        const temp = mkdtempSync(join(tmpdir(), '530-widget-type-exits-'));
        try {
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', temp, join(import.meta.dir, 'WidgetTypeExitOracle.java'), join(import.meta.dir, '../render/ProceduralTextureCacheOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const rows = [2, 4, 5, 6, 7, 8].flatMap(source => [4, 7, 8, 9].map(replacement => [source, replacement]));
            const path = join(temp, 'frames.bin');
            const java = Bun.spawnSync(['java', '-cp', temp + delimiter + gamepackPath, 'WidgetTypeExitOracle', cachePath, path], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n'))
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const states = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(states).toHaveLength(rows.length);
            const assets = localAssets(cachePath, [7, 8, 9, 26]);
            const models = assets.archive(7),
                getFile = models.GetFile.bind(models);
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false);
            for (const { index, frame } of readReferenceFrames(path, width, height, rows.length)) {
                const [source, replacement] = rows[index],
                    c = new IfType();
                Object.assign(c, {
                    parentId: -1,
                    type: source,
                    id: 12,
                    x: 5,
                    y: 4,
                    width: 8,
                    height: 8,
                    colour: lineColour,
                    lineWidth: 1,
                    if3: source === 5 || source === 6,
                    spriteId: 300,
                    fontId: 311,
                    textValue: fromJsString('T'),
                    modelAnim: -1,
                    modelType: 1,
                    modelId: 1100,
                    modelZoom: 384,
                    modelXAngle: 32,
                    showItemCount: true,
                    baseWidth: 1,
                    baseHeight: 1,
                    itemIds: Int32Array.of(source === 2 ? 0 : 34),
                    itemCounts: Int32Array.of(1),
                    invSlotOffsetX: new Int32Array(20),
                    invSlotOffsetY: new Int32Array(20),
                    invSlotSprite: Int32Array.of(300)
                });
                let callbacks = 0;
                function change() {
                    callbacks++;
                    c.type = replacement;
                }
                class Font extends PixfontGeneric {
                    override drawGlyph(_ch: number, x: number, y: number, _w: number, _h: number, colour: number) {
                        change();
                        Pix2D.fillRect(x, y, 1, 1, colour);
                    }
                    override drawGlyphAlpha(): never {
                        throw new Error('Unexpected alpha glyph');
                    }
                }
                const font = new Font(new Uint8Array(257).fill(2), new Int32Array(256), new Int32Array(256), new Int32Array(256).fill(1), new Int32Array(256).fill(1));
                Client.p12 = font;
                Client.tooltipComponent = c;
                InterfaceList.tooltipDelay = Client.tooltipTimer = 4;
                IfType.m_fontCache.Reset();
                IfType.m_fontCache.Put(311n, font);
                const obj = new ObjType();
                obj.name = fromJsString('O');
                ObjType.types.Reset();
                ObjType.types.Put(33n, obj);
                class Sprite extends Pix32 {
                    override draw(x: number, y: number) {
                        change();
                        super.draw(x, y);
                    }
                }
                const sprite = new Sprite(8, 8);
                sprite.pixels?.fill(0x136f21);
                IfType.m_spriteCache.Reset();
                IfType.m_spriteCache.Put(300n, sprite);
                IfType.m_modelCache.Reset();
                models.GetFile = (file, group) => {
                    change();
                    return getFile(file, group);
                };
                Client.localPlayer = new ClientPlayer();
                InterfaceList.rootCount = 0;
                InterfaceList.rectRedrawnLastFrame[0] = true;
                Minimenu.isOpen = true;
                Client.qaOpTest = false;
                const pixels = new Int32Array(width * height).fill(0x7a5c02);
                Pix2D.setPixels(pixels, width, height);
                Client.DrawLayer(0, [c], -1, height, 0, -1, width, 0, 0);
                const context = source + ' to ' + replacement;
                expect(callbacks, context).toBeGreaterThan(0);
                expect([c.type, callbacks, pixels.filter(pixel => pixel === lineColour).length].join(' '), context).toBe(states[index]);
                expect(() => compareFramebuffers(frame, { ...frame, pixels }), context).not.toThrow();
            }
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    },
    30000
);
