import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Environment from '#/dash3d/Environment.js';
import Pix3D from '#/dash3d/Pix3D.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import TextureCache from '#/dash3d/TextureCache.js';
import world from '#/dash3d/world.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import MaterialManager from '#/gl/material/MaterialManager.js';
import PointLightManager from '#/gl/PointLightManager.js';
import Pix2D from '#/graphics/Pix2D.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import AudioEngine from '#/sound/AudioEngine.js';
import Minimenu from '#/ui/Minimenu.js';
import Preferences from '#/ui/Preferences.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD viewport caller observes camera, mouse and projection state at the native boundaries',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-viewport-order-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const exports = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            function run(args: string[]): string {
                const child = Bun.spawnSync(args);
                expect(child.exitCode, child.stderr.toString()).toBe(0);
                return child.stdout.toString().trim();
            }
            run(['javac', exports, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdSceneViewportOrderOracle.java')]);
            const java = ['java', exports, '-cp', cp, 'HdSceneViewportOrderOracle'];
            run([...java, hdGamepackPath, dir]);
            const rows = run(java).split(/\r?\n/);
            const events: string[] = [];
            let flip = false;
            let scales = 0;
            let active = false;

            function stub(owner: object, names: string[], value: unknown = undefined): void {
                for (const name of names) {
                    expect(typeof Reflect.get(owner, name)).toBe('function');
                    Object.defineProperty(owner, name, { configurable: true, value: () => value });
                }
            }
            stub(Client, ['resetTileOccupancy', 'pushPlayers', 'GdmAddNPCs', 'GdmAddMapAnim', 'GdmAddProjectiles', 'GdmCalcWindowSize', 'CamFollow', 'drawCross']);
            stub(Client, ['GetAvH'], 0);
            stub(RoofModeStatics, ['updateRoofs']);
            stub(RoofModeStatics, ['getRoofMode'], 0);
            stub(GlRaster, ['setClipping']);
            stub(GlRenderer, ['setCamera', 'applyLightingPreference', 'setDepthTest', 'setFog', 'clear']);
            stub(Pix2D, ['setClipping', 'fillRect']);
            stub(Pix3D, ['setRenderClipping']);
            stub(AudioEngine, ['tick']);
            stub(Environment, ['update'], 0);
            stub(MaterialManager, ['setCamera']);
            stub(PointLightManager, ['update', 'clearSlots']);
            stub(world, ['RemoveSprites']);
            stub(Minimenu, ['Build']);
            Pix3D.textureProvider = Object.create(TextureCache.prototype);
            stub(TextureCache.prototype, ['RunAnims']);
            Client.localPlayer = new ClientPlayer();
            Client.viewportX = Client.viewportY = 0;
            Client.viewportWidth = Client.viewportHeight = 100;
            Client.showLoadingMessage = false;
            world.draw = () => {
                events.push('draw');
                if (flip) active = !active;
            };
            Client.GdmEntityOverlays = (_y, _x, _w, _h, sx, sy) => {
                events.push('overlay:' + sx + ',' + sy);
            };
            Client.GdmCoordArrow = (_x, _w, _h, _y, sx, sy) => {
                events.push('arrow:' + sx + ',' + sy);
            };
            function watch(owner: object, property: string, label: string): void {
                expect(Reflect.has(owner, property)).toBe(true);
                let value = Reflect.get(owner, property);
                Object.defineProperty(owner, property, {
                    configurable: true,
                    get() {
                        events.push(label);
                        if (label === 'scale') return 300 + ++scales;
                        if (label === 'active') return active;
                        return value;
                    },
                    set(next: unknown) {
                        value = next;
                    }
                });
            }
            for (const [owner, property, label] of [
                [GlRenderer, 'active', 'active'],
                [Client, 'playerLevel', 'level'],
                [Client, 'localPlayer', 'self'],
                [OrbitCamera, 'focusX', 'focusX'],
                [OrbitCamera, 'focusZ', 'focusZ'],
                [OrbitCamera, 'shakeRandom', 'shakeRandom'],
                [OrbitCamera, 'shakePhase', 'shakePhase'],
                [OrbitCamera, 'shakeFrequency', 'shakeFrequency'],
                [Client, 'viewportScale', 'scale'],
                [Minimenu, 'isOpen', 'menu'],
                [Minimenu, 'mouseX', 'mouseX'],
                [Minimenu, 'mouseY', 'mouseY'],
                [Pix3D, 'clipMaxX', 'maxX'],
                [Pix3D, 'clipMinY', 'minY'],
                [Pix3D, 'clipMinX', 'minX'],
                [Pix3D, 'clipMaxY', 'maxY'],
                [Client, 'gameState', 'state'],
                [AreaSoundManager, 'elapsed', 'elapsed'],
                [Preferences, 'brightness', 'brightness'],
                [Client, 'loopCycle', 'cycle'],
                [Preferences, 'flickeringEffects', 'flicker']
            ] as const)
                watch(owner, property, label);
            let row = 0;
            for (const hardware of [false, true])
                for (const mode of [1, 3])
                    for (const mouse of [-1, 50, 110])
                        for (const toggle of [false, true]) {
                            active = hardware;
                            flip = toggle;
                            OrbitCamera.mode = mode;
                            Minimenu.mouseX = mouse;
                            Minimenu.mouseY = 50;
                            Minimenu.isOpen = mouse === 110;
                            Client.gameState = mode === 1 ? 10 : 30;
                            OrbitCamera.shake.fill(false);
                            OrbitCamera.shake[0] = true;
                            events.length = 0;
                            scales = 0;
                            Client.drawScene(100, 100, 0, 0, false);
                            expect(events.join(' ')).toBe(rows[row++]);
                        }
            expect(row).toBe(rows.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
