import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import MSITypeList from '#/config/MSITypeList.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { captureSdFrame } from '#/dash3d/SdWorldRaster.js';
import SdRasterSpans, { type SdRasterFrame } from '#/dash3d/SdRasterSpans.js';
import Pix2D from '#/graphics/Pix2D.js';
import PixScreen, { CanvasComponent } from '#/graphics/PixScreen.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import SubInterface from '#/ui/SubInterface.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { buildScene } from '../game/lumbridge-scene.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';
import { renderSdFrames } from './sd-device.js';

const width = 765,
    height = 503;

loginFixture(
    import.meta.url,
    'complete cached root and native Lumbridge viewport match the original on SD CPU and WebGPU',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-root-'));
        try {
            const modules = ['asm', 'asm.tree'].map(name => '--add-exports=java.base/jdk.internal.org.objectweb.' + name + '=ALL-UNNAMED');
            const cp = dir + delimiter + gamepackPath;
            const build = Bun.spawnSync([
                'javac',
                ...modules,
                '-cp',
                cp,
                '-d',
                dir,
                ...['NativeRootSdOracle.java', '../game/NativeSceneClickOracle.java', '../game/FinishBuildOracle.java', '../review/provider-config/ProviderConfigOracle.java'].map(file => join(import.meta.dir, file))
            ]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', ...modules, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, 'NativeRootSdOracle', cachePath, dir]);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const frames = readFileSync(join(dir, 'root.bin'));
            expect(frames.byteLength).toBe(2 * width * height * 4);
            let changed = 0;
            for (let i = 0; i < width * height; i++) {
                if (frames.readInt32BE(i * 4) !== frames.readInt32BE((i + width * height) * 4)) changed++;
            }
            expect(changed).toBeGreaterThan(10000);
            const pixels = buildScene(false, width, height);
            const sprites = requireNonNull(Client.m_pSprites);
            mathRandom.setSeed(55301n);
            MSITypeList.init(sprites, requireNonNull(Client.configArchive));
            IfType.Init(Client.fontMetricsArchive, sprites, Client.modelsArchive, Client.interfacesArchive);
            Client.lookupSpriteGroupIds(sprites);
            Client.loadFonts(sprites, Client.fontMetricsArchive);
            mathRandom.setSeed(55302n);
            Client.loadSprites(sprites);
            GameShell.m_sWid = width;
            GameShell.m_sHei = height;
            GameShell.drawArea = await PixScreen.create(height, new CanvasComponent(), width);
            GameShell.drawArea.pixels = pixels;
            mathRandom.setSeed(55303n);
            expect(MinimapBuilder.BuildBuffer(0)).toBe(true);
            WorldMapLabels.scene = null;
            Minimenu.mouseX = Minimenu.mouseY = -1;
            Client.displayFps = false;
            Minimenu.isOpen = true;
            InterfaceList.top = 548;
            const inventory = new SubInterface();
            inventory.group = 149;
            InterfaceList.subInterfaces.put(inventory, (548n << 16n) + 11n);
            Client.InterfaceCalculateSizeAndPosAll(false);
            const captures: SdRasterFrame[] = [];
            for (const path of ['cpu', 'snapshot', 'resident']) {
                for (const [index, yaw] of [0, 128].entries()) {
                    OrbitCamera.yaw = yaw;
                    mathRandom.setSeed(55304n);
                    InterfaceList.rectRedrawnLastFrame.fill(true);
                    InterfaceList.rootCount = 0;
                    Pix2D.setPixels(pixels, width, height);
                    Pix3D.setRenderClipping();
                    pixels.fill(0x131b23);
                    if (path === 'snapshot') captures.push(captureSdFrame(() => Client.drawTopLevelInterface()));
                    else if (path === 'resident') {
                        const recorder = new SdRasterSpans(pixels, width, height, true);
                        Pix3D.spanTarget = recorder;
                        Pix2D.pixels = recorder.guardedTarget;
                        try {
                            Client.drawTopLevelInterface();
                            captures.push(recorder.finish());
                        } finally {
                            Pix3D.spanTarget = null;
                            Pix2D.pixels = pixels;
                        }
                    } else {
                        Client.drawTopLevelInterface();
                        compare(pixels, index);
                    }
                }
            }
            const results = await renderSdFrames(dir, captures);
            results.forEach((frame, i) => compare(frame, i % 2));
            function compare(actual: Int32Array, frame: number): void {
                for (let i = 0; i < actual.length; i++) {
                    const original = frames.readInt32BE(4 * (frame * width * height + i));
                    if (original !== actual[i]) throw new Error('Frame ' + frame + ' at ' + (i % width) + ',' + ((i / width) | 0) + ' expected ' + original + ' got ' + actual[i]);
                }
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000,
    'sd'
);
