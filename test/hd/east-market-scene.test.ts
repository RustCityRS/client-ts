import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import GameShell from '#/client/GameShell.js';
import NanoTimer from '#/client/NanoTimer.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import LightType from '#/config/LightType.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import GlModel from '#/dash3d/GlModel.js';
import GroundShadows from '#/dash3d/GroundShadows.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import Pix3D from '#/dash3d/Pix3D.js';
import SdRasterSpans from '#/dash3d/SdRasterSpans.js';
import TextureCache from '#/dash3d/TextureCache.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { NullGLDrawableFactory } from '#/gl/NullGL.js';
import PointLightManager from '#/gl/PointLightManager.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import Pix2D from '#/graphics/Pix2D.js';
import { registerGLDrawableFactory } from '#/jogl/GLDrawableFactory.js';
import HookReq from '#/script/HookReq.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { mathRandom } from '#/util/JavaRandom.js';
import Signlink from '#/util/Signlink.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { renderSdFrames } from '../render/sd-device.js';

loginFixture(
    import.meta.url,
    'East Ardougne market matches original HD draw order and complete SD framebuffer words on CPU and WebGPU',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-east-market-'));
        const width = 1148,
            height = 896,
            signlink = new Signlink({ getSize: () => ({ width, height }) });
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const profile = join(import.meta.dir, 'rtx5070.json');
            const run = (args: string[]): string => {
                const p = Bun.spawnSync(args);
                expect(p.exitCode, p.stderr.toString()).toBe(0);
                return p.stdout.toString();
            };
            run(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...['HdEastMarketOracle', 'HdTitleFrameOracle', 'GlRecorder'].map(n => join(import.meta.dir, n + '.java'))]);
            run(['java', asm, '-cp', cp, 'HdEastMarketOracle', 'patch', hdGamepackPath, dir]);
            const diagnostic = run(['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-Xmx1536m', '-cp', cp, 'HdEastMarketOracle', cachePath, dir, profile]);
            if (process.env.RS530_EAST_MARKET_EVIDENCE) await Bun.write(process.env.RS530_EAST_MARKET_EVIDENCE, diagnostic);
            const reference = readFileSync(join(dir, 'east.txt'), 'utf8').trimEnd().split(/\r?\n/);
            const assets = localAssets(
                cachePath,
                Array.from({ length: 28 }, (_, i) => i)
            );
            LightType.Init(assets.archive(2));
            const caps = capsProfileFromJson(readFileSync(profile, 'utf8'));
            registerGLDrawableFactory(() => new NullGLDrawableFactory(caps));
            const textures = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, !Preferences.highDetailTextures);
            Pix3D.setTextures(textures);
            expect(await GlRenderer.init({ isDisplayable: () => true, getSize: () => ({ width, height }) }, 4)).toBe(0);
            textures.setCapacity(200);
            GroundShadows.init(104, 104);
            PointLightManager.setDimensions(4, 104, 104);
            PointLightManager.allocate();
            for (let i = 0; i < 4; i++) CollisionMap.levelMaps[i] = new CollisionMap(104, 104);
            Client.lookupSpriteGroupIds(assets.archive(8));
            GroundShadows.shadowSprites = Client['loadFloorShadowSprites'](SpriteLoader.floorShadowsId, assets.archive(8), 0);
            for (const s of requireNonNull(GroundShadows.shadowSprites)) requireNonNull(s).trim();
            Client.loadFonts(assets.archive(8), assets.archive(13));
            GameShell.timer = new NanoTimer();
            GameShell.signlink = signlink;
            GameShell.m_sWid = width;
            GameShell.m_sHei = height;
            Client.gameState = 5;
            const client = (Client.activeClient = new Client());
            client['assets'] = assets;
            mathRandom.setSeed(530n);
            Client.loginScreenInterface = assets.archive(3).GetGroupId(Client.loginScreenName);
            await client.resetToTitle(true);
            Pix3D.setBrightness(Math.fround(0.7));
            const finishRegion = (): void => {
                for (let i = 0; i < 8 && Client.gameState === 28; i++) client['MapBuildLoop']();
            };
            finishRegion();
            Client.loopCycle = 1000;
            ClientBuild.m_hueOff = ClientBuild.m_ligOff = 0;
            mathRandom.setSeed(6999n);
            Pix3D.setBrightness(Math.fround(0.7));
            mathRandom.setSeed(7000n);
            DelayedStateChange.varcs[176] = 110;
            const event = new HookReq();
            event.args = [1887, 48758909, 48758911, 48758910, 48758912, 48758913];
            await requireNonNull(client['ui']).runner.run(event);
            let tick = 0;
            for (; tick < 400; tick++) {
                mathRandom.setSeed(BigInt(8000 + tick));
                finishRegion();
                Client.loopCycle++;
                await client['titleLoop']();
                if (CinematicCamera.progress >= 12000 && CinematicCamera.progress < 13000) break;
            }
            expect([Client.mapBuildBaseX, Client.mapBuildBaseZ]).toEqual([2608, 3248]);
            const events = ['P ' + [tick, OrbitCamera.x, OrbitCamera.y, OrbitCamera.z, OrbitCamera.pitch, OrbitCamera.yaw, CinematicCamera.progress].join(' ')];
            let trace = false;
            const modelDraw = GlModel.prototype.draw;
            GlModel.prototype.draw = function (...args) {
                if (trace) events.push('M ' + [...args.slice(0, 10), args[10] !== null].join(' '));
                modelDraw.apply(this, args);
            };
            const gl = requireNonNull(GlRenderer.gl),
                draw = gl.glDrawElements.bind(gl),
                list = gl.glCallList.bind(gl);
            gl.glDrawElements = (mode, count, type, source) => {
                if (typeof source === 'bigint') {
                    if (trace) events.push('D ' + [mode, count, type, '@' + source].join(' '));
                    draw(mode, count, type, source);
                } else {
                    if (trace) {
                        if (!(source instanceof ByteBuffer)) throw new Error('Expected client index bytes');
                        const pos = source.position();
                        const bytes = source.storageBytes().subarray(pos, pos + count * 4);
                        events.push('D ' + [mode, count, type, Buffer.from(bytes).toString('base64')].join(' '));
                    }
                    draw(mode, count, type, source);
                }
            };
            gl.glCallList = id => {
                if (trace) events.push('L ' + id);
                list(id);
            };
            for (let i = 0; i < 3; i++) {
                mathRandom.setSeed(BigInt(9500 + i));
                Client.showLoadingMessage = false;
                trace = i === 2;
                Client.drawScene(height, width, 0, 0, true);
            }
            const evidence = process.env.RS530_EAST_MARKET_EVIDENCE;
            if (evidence) {
                await Bun.write(evidence + '.jar.txt', reference.join('\n') + '\n');
                await Bun.write(evidence + '.ts.txt', events.join('\n') + '\n');
            }
            expect(events.length).toBe(reference.length);
            for (let i = 0; i < reference.length; i++) {
                if (events[i] !== reference[i]) throw new Error('East market event ' + i + ' expected ' + reference[i].slice(0, 180) + ' got ' + events[i].slice(0, 180));
            }
            trace = false;
            GlRenderer.shutdown();
            ModelLitImpl.allocateSoftwareScratch();
            Client.ResetCache();
            textures.setCapacity(20);
            mathRandom.setSeed(9599n);
            Pix3D.setBrightness(Math.fround(0.7));
            const sw = (GameShell.m_sWid = 765),
                sh = (GameShell.m_sHei = 503);
            const pixels = new Int32Array(sw * sh);
            Pix2D.setPixels(pixels, sw, sh);
            Pix3D.setRenderClipping();
            mathRandom.setSeed(9600n);
            Client.showLoadingMessage = false;
            Client.SetMainState(28);
            finishRegion();
            expect([Client.gameState, GlRenderer.active]).toEqual([10, false]);
            const frames = readFileSync(join(dir, 'east-sd.bin'));
            expect(frames.byteLength).toBe(2 * sw * sh * 4);
            const colours = new Set<number>();
            for (let i = 0; i < sw * sh; i++) colours.add(frames.readInt32BE(i * 4));
            expect(colours.size).toBeGreaterThan(256);
            if (evidence) await Bun.write(evidence + '.sd.bin', frames);
            for (let frame = 0; frame < 3; frame++) {
                pixels.fill(0x131b23);
                mathRandom.setSeed(BigInt(9601 + frame));
                Client.showLoadingMessage = false;
                let actual: Int32Array = pixels;
                if (frame === 2) {
                    const record = new SdRasterSpans(pixels, sw, sh, true);
                    Pix2D.pixels = record.guardedTarget;
                    Pix3D.spanTarget = record;
                    try {
                        Client.drawScene(sh, sw, 0, 0, true);
                        [actual] = await renderSdFrames(dir, [record.finish()]);
                    } finally {
                        Pix3D.spanTarget = null;
                        Pix2D.pixels = pixels;
                    }
                } else Client.drawScene(sh, sw, 0, 0, true);
                if (frame === 0) continue;
                for (let i = 0; i < pixels.length; i++) {
                    const original = frames.readInt32BE(((frame - 1) * pixels.length + i) * 4);
                    if (actual[i] !== original) throw new Error('East market SD frame ' + frame + ' pixel ' + (i % sw) + ',' + ((i / sw) | 0) + ' expected ' + original + ' got ' + actual[i]);
                }
            }
        } finally {
            await signlink.stopWorker();
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
