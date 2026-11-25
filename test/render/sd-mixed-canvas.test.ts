import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fromJsString } from '#/datastruct/JagString.js';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import MSITypeList from '#/config/MSITypeList.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { captureSdFrame } from '#/dash3d/SdWorldRaster.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixScreen, { CanvasComponent } from '#/graphics/PixScreen.js';
import IfType from '#/ui/IfType.js';
import Minimenu from '#/ui/Minimenu.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { buildScene } from '../game/lumbridge-scene.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';
import { renderSdFrames } from './sd-device.js';

const width = 496,
    height = 340;
const names = ['first viewport', 'overlapping viewport', 'cached cross', 'minimap', 'compass', 'disabled minimap and compass', 'masked styled p12', 'translucent shadowed p11', 'rebound sprite and partial rotated span'];

function oracle(dir: string): Int32Array[] {
    const exports = ['--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports=java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
    const compile = Bun.spawnSync([
        'javac',
        ...exports,
        '-cp',
        gamepackPath,
        '-d',
        dir,
        join(import.meta.dir, '../review/provider-config/ProviderConfigOracle.java'),
        join(import.meta.dir, '../game/FinishBuildOracle.java'),
        join(import.meta.dir, '../game/NativeSceneClickOracle.java'),
        join(import.meta.dir, 'SdMixedCanvasOracle.java')
    ]);
    expect(compile.exitCode, compile.stderr.toString()).toBe(0);
    const run = Bun.spawnSync(['java', ...exports, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'SdMixedCanvasOracle', cachePath, dir]);
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    const raw = readFileSync(join(dir, 'mixed-canvas.bin'));
    expect(raw.length).toBe(width * height * 4 * names.length);
    return names.map((_, i) => Int32Array.from({ length: width * height }, (_, j) => raw.readInt32BE(4 * (i * width * height + j))));
}

function mask(child: number): IfType {
    const c = requireNonNull(IfType.Get((548 << 16) | child));
    c.width = c.baseWidth;
    c.height = c.baseHeight;
    expect(c.GetMask()).toBe(true);
    return c;
}

function compare(actual: Int32Array, expected: Int32Array, label: string): void {
    expect(actual.length, label).toBe(expected.length);
    const i = actual.findIndex((pixel, j) => pixel !== expected[j]);
    if (i !== -1) throw new Error(label + ' pixel (' + (i % width) + ', ' + ((i / width) | 0) + ') expected ' + (expected[i] >>> 0).toString(16) + ', received ' + (actual[i] >>> 0).toString(16));
}

loginFixture(
    import.meta.url,
    'two offset Lumbridge views, the cross and masked minimap overlays match the original SD canvas on WebGPU',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-mixed-sd-canvas-'));
        try {
            const reference = oracle(dir);
            const pixels = buildScene(false, width, height);
            const sprites = requireNonNull(Client.m_pSprites);
            mathRandom.setSeed(55301n);
            MSITypeList.init(sprites, requireNonNull(Client.configArchive));
            IfType.Init(Client.fontMetricsArchive, sprites, Client.modelsArchive, Client.interfacesArchive);
            Client.lookupSpriteGroupIds(sprites);
            Client.loadFonts(sprites, Client.fontMetricsArchive);
            mathRandom.setSeed(55302n);
            Client.loadSprites(sprites);
            const minimap = mask(64),
                compass = mask(65);
            expect([minimap.clientCode, compass.clientCode]).toEqual([1338, 1339]);
            GameShell.drawArea = await PixScreen.create(height, new CanvasComponent(), width);
            GameShell.drawArea.pixels = pixels;
            mathRandom.setSeed(55303n);
            expect(MinimapBuilder.BuildBuffer(0)).toBe(true);
            expect(Pix2D.pixels === pixels).toBe(true);
            WorldMapLabels.scene = null;

            const reset = () => {
                Pix2D.setPixels(pixels, width, height);
                Pix3D.setRenderClipping();
                for (let i = 0; i < pixels.length; i++) pixels[i] = 0x204060 ^ ((i * 31) & 0x1f3f5f);
                Minimenu.mouseX = Minimenu.mouseY = -1;
                Minimenu.crossMode = 0;
                OrbitCamera.yaw = 0;
                mathRandom.setSeed(55304n);
            };
            const steps = [
                () => Client.drawScene(174, 255, 17, 13, false),
                () => {
                    OrbitCamera.yaw = 105;
                    Client.drawScene(179, 278, 132, 143, false);
                },
                () => {
                    Minimenu.crossMode = 2;
                    Minimenu.crossTicks = 200;
                    Minimenu.crossX = 241;
                    Minimenu.crossY = 159;
                    Client.drawCross();
                },
                () => {
                    OrbitCamera.followYaw = 317;
                    OrbitCamera.minimapAngle = 23;
                    OrbitCamera.minimapZoom = 41;
                    Client.minimapState = 0;
                    MinimapBuilder.Draw(288, minimap, 3, 15);
                },
                () => MinimapBuilder.CompassDraw(4, compass, 3, 301, 17),
                () => {
                    OrbitCamera.followYaw = 1747;
                    Client.minimapState = 5;
                    MinimapBuilder.Draw(288, minimap, 3, 15);
                    MinimapBuilder.CompassDraw(4, compass, 3, 301, 17);
                },
                () => {
                    Pix2D.setClipping(205, 172, 405, 192);
                    Pix2D.setClipMask(
                        Int32Array.from({ length: 20 }, (_, i) => 63 + (i % 9)),
                        Int32Array.from({ length: 20 }, (_, i) => 70 - (i % 7))
                    );
                    requireNonNull(Client.p12).drawCentred(fromJsString('<col=ff7f00>Rune</col><u>Scape</u> 530'), 285, 188, 0xfdf8c9, 0x080e14);
                },
                () => {
                    Pix2D.setClipping(100, 160, 415, 230);
                    requireNonNull(Client.fontPlain11).drawParagraphAlpha(fromJsString('Lumbridge <col=87f83e>Castle</col>'), 190, 195, 155, 30, 0xfcac37, 0x470c56, 129, 1, 1, 0);
                },
                () => {
                    Pix2D.resetClipping();
                    const swatch = new Pix32(3, 2, 0, 0, 3, 2, Int32Array.of(0x55ffc844, 0xff112233, 0, 0xff886633, 0x873427ba, 0x00ff0077));
                    swatch.draw(183, 165);
                    swatch.bind();
                    Pix2D.fillRect(0, 0, 3, 2, 0xe52af5);
                    Pix2D.setPixels(pixels, width, height);
                    swatch.draw(184, 166);
                    const alpha = new SoftwareAlphaSprite(3, 2, 0, 0, 3, 2, Int32Array.of(0xffcc2200, 0xfe71c958, 0x01001122, 0, 0x10304550, 0x8055cc22));
                    alpha.draw(185, 166);
                    Pix2D.fillRectTrans(185, 167, 10, 3, 0xffee2288, 37);
                    swatch.drawRotatedMaskedOpaque(196, 167, 5, 1, 3, 1, 0, 256, Int32Array.of(0), Int32Array.of(5));
                }
            ];
            reset();
            let previous: Int32Array = pixels.slice();
            for (let i = 0; i < steps.length; i++) {
                steps[i]();
                compare(pixels, reference[i], 'CPU ' + names[i]);
                const changed = reference[i].reduce((n, value, j) => n + Number(value !== previous[j]), 0);
                expect(changed, names[i]).toBeGreaterThan(0);
                previous = reference[i];
            }
            // Each prefix is a single mixed submission starting from the original patterned canvas.
            // Intermediate JAR framebuffers serve only as expectations, never as a GPU draw input.
            const captures = steps.map((_, i) => {
                reset();
                return captureSdFrame(() => {
                    for (let j = 0; j <= i; j++) steps[j]();
                });
            });
            const gpu = await renderSdFrames(dir, captures);
            expect(gpu.length).toBe(reference.length);
            gpu.forEach((frame, i) => compare(frame, reference[i], 'WebGPU ' + names[i]));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000,
    'sd'
);
