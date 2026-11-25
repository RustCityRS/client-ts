import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import ClientBuild from '#/client/ClientBuild.js';
import GameShell, { gameClient } from '#/client/GameShell.js';
import NanoTimer from '#/client/NanoTimer.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import LightType from '#/config/LightType.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import GroundShadows from '#/dash3d/GroundShadows.js';
import LocChange from '#/dash3d/LocChange.js';
import ClientLocAnim from '#/dash3d/ClientLocAnim.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import Preferences from '#/ui/Preferences.js';
import world from '#/dash3d/world.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { GlTraceWriter, type BlobSink } from '#/gl/GlTrace.js';
import { NullGLDrawableFactory } from '#/gl/NullGL.js';
import PointLightManager from '#/gl/PointLightManager.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import Pix2D from '#/graphics/Pix2D.js';
import { CanvasComponent } from '#/graphics/PixScreen.js';
import Signlink from '#/util/Signlink.js';
import { RecordingGLDrawableFactory } from '#/gl/RecordingGL.js';
import { registerGLDrawableFactory } from '#/jogl/GLDrawableFactory.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function hash(array: unknown): number {
    if (typeof array === 'number') return array;
    if (array === null) return 0;
    const bytes = array instanceof Uint8Array;
    let result = 1;
    for (const item of array as Iterable<unknown>) {
        result = (Math.imul(result, 31) + (bytes ? (Number(item) << 24) >> 24 : hash(item))) | 0;
    }
    return result;
}

function shadowBuffers(trace: string): string[] {
    return trace
        .split(/\r?\n/)
        .filter(line => line.includes('\tglBufferDataARB\t'))
        .slice(-338)
        .map(line => line.slice(line.indexOf('\t') + 1));
}

// A light's VBO names depend on its place in the whole context's allocation history. Resolve the
// actual bound buffers at its native draw, then compare the upload arguments, including every byte.
function lightBuffers(trace: string): string[][] {
    const bound = new Map<string, string>();
    const uploads = new Map<string, string>();
    const pairs: string[][] = [];
    let light = false;
    for (const line of trace.split(/\r?\n/)) {
        const [, entry, target, name] = line.split('\t');
        if (entry === '~mark') light = target.startsWith('light.');
        if (entry === 'glBindBufferARB') bound.set(target, name);
        if (entry === 'glBufferDataARB') uploads.set(requireNonNull(bound.get(target)), line.slice(line.indexOf('\t') + 1));
        if (light && entry === 'glDrawElements') {
            pairs.push(['34962', '34963'].map(key => requireNonNull(uploads.get(requireNonNull(bound.get(key))))));
        }
    }
    return pairs;
}

loginFixture(
    import.meta.url,
    'the HD title rebuilds its native cached region before the first title draw',
    async () => {
        const retained = process.env.RS530_TITLE_TRACE_DIR;
        if (retained) mkdirSync(retained, { recursive: true });
        const dir = mkdtempSync(join(retained ?? tmpdir(), 'rs530-title-build-'));
        const signlink = new Signlink({ getSize: () => ({ width: 765, height: 503 }) });
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const javac = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...['GlRecorder', 'HdTitleFrameOracle', 'HdTitleRegionBuildOracle'].map(name => join(import.meta.dir, name + '.java'))]);
            expect(javac.exitCode, javac.stderr.toString()).toBe(0);
            const profile = join(import.meta.dir, 'rtx5070.json');
            const java = Bun.spawnSync([
                'java',
                '--add-opens=java.base/java.lang=ALL-UNNAMED',
                '--add-opens=java.base/java.util=ALL-UNNAMED',
                '-Djava.awt.headless=true',
                '-Dgltrace.stacks=false',
                '-Xmx1536m',
                '-cp',
                cp,
                'HdTitleRegionBuildOracle',
                cachePath,
                dir,
                profile
            ]);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const original = java.stdout.toString().trim().split(/\r?\n/);
            const onloadSeed = BigInt(requireNonNull(original.shift()).split(' ')[1]);
            const mapRequest = requireNonNull(original.shift());
            const colours = requireNonNull(original.find(s => s.startsWith('terrain-colours ')))
                .split(' ')
                .slice(1)
                .map(Number);
            const assets = localAssets(
                cachePath,
                Array.from({ length: 28 }, (_, i) => i)
            );
            LightType.Init(assets.archive(2));
            const tsBlobs = join(dir, 'ts-blobs');
            if (retained) mkdirSync(tsBlobs);
            const saveBlob: BlobSink = (hash, bytes) => {
                const file = join(tsBlobs, hash);
                if (!existsSync(file)) writeFileSync(file, bytes);
            };
            const writer = new GlTraceWriter(retained ? { blobs: saveBlob } : {});
            const caps = capsProfileFromJson(readFileSync(profile, 'utf8'));
            registerGLDrawableFactory(() => new RecordingGLDrawableFactory(new NullGLDrawableFactory(caps), writer));
            // Stage 90 installs nk while tf.w is false. On the first successful SD -> HD change,
            // pm.a replaces both LRUs at capacity 200 before the title rebuild.
            const textures = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, !Preferences.highDetailTextures);
            Pix3D.setTextures(textures);
            function cacheState(cache: TextureCache): string {
                return [cache['capacity'], cache['lowMemory'], cache['recentUse']['m_cacheSize'], cache['secondaryCache']?.['m_cacheSize'] ?? '-'].join(' ');
            }
            const initialCache = cacheState(textures);
            expect(await GlRenderer.init({ isDisplayable: () => true, getSize: () => ({ width: 765, height: 503 }) }, 0)).toBe(0);
            textures.setCapacity(200);
            const newActiveCache = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 7, true);
            expect(['texture-caches', initialCache, cacheState(textures), cacheState(newActiveCache)].join(' ')).toBe(requireNonNull(original.find(line => line.startsWith('texture-caches '))));
            GroundShadows.init(104, 104);
            PointLightManager.setDimensions(4, 104, 104);
            PointLightManager.allocate();
            for (let i = 0; i < 4; i++) CollisionMap.levelMaps[i] = new CollisionMap(104, 104);
            Client.lookupSpriteGroupIds(assets.archive(8));
            GroundShadows.shadowSprites = Client['loadFloorShadowSprites'](SpriteLoader.floorShadowsId, assets.archive(8), 0);
            for (const sprite of requireNonNull(GroundShadows.shadowSprites)) requireNonNull(sprite).trim();
            Client.loadFonts(assets.archive(8), assets.archive(13));
            GameShell.timer = new NanoTimer();
            // fk.l is installed before script 1172 queries the available fullscreen modes during login OnLoad.
            GameShell.signlink = signlink;
            GameShell.m_sWid = 765;
            GameShell.m_sHei = 503;
            Client.gameState = 5;
            Client.mapBuildBaseX = Client.mapBuildBaseZ = 0;
            const client = (Client.activeClient = new Client());
            client['assets'] = assets;
            mathRandom.setSeed(onloadSeed);
            Client.loginScreenInterface = assets.archive(3).GetGroupId(Client.loginScreenName);
            await client.resetToTitle(true);
            expect(Client.gameState).toBe(28);
            expect(['map-request', mathRandom['seed'], OrbitCamera.mode, OrbitCamera.x, OrbitCamera.z, '[' + requireNonNull(Client.mapBuildGroundFile).join(',') + ']'].join(' ')).toBe(mapRequest);
            expect(Client.mapBuildGroundFile?.[4]).toBe(1800);
            // The focused fixture enters after Java <clinit> chose the palette offsets from its process RNG.
            // Carry those inputs across so the following native di.a random steps and colour output are comparable.
            [ClientBuild.m_hueOff, ClientBuild.m_ligOff] = colours;
            mathRandom.setSeed(5302036n);
            Pix3D.setBrightness(Math.fround(0.7));
            expect([new Int32Array(Float32Array.of(Pix3D.legacyBrightness).buffer)[0], hash(requireNonNull(Pix3D.colourTable))]).toEqual(colours.slice(2, 4));
            const finish = ClientBuild.FinishBuild;
            let beforeFloorShadows = new Uint8Array();
            ClientBuild.FinishBuild = (maps, underwater) => {
                if (!underwater) beforeFloorShadows = new Uint8Array(requireNonNull(requireNonNull(GroundShadows.shadowMap).pixels));
                finish.call(ClientBuild, maps, underwater);
            };
            try {
                for (let i = 0; i < 4 && Client.gameState === 28; i++) client['MapBuildLoop']();
            } finally {
                ClientBuild.FinishBuild = finish;
            }
            expect(Client.gameState).toBe(10);
            expect([ClientBuild.m_hueOff, ClientBuild.m_ligOff]).toEqual(colours.slice(4));
            expect(
                [
                    'region',
                    Client.gameState,
                    Client.mapBuildCentreZoneX,
                    Client.mapBuildCentreZoneZ,
                    Client.mapBuildBaseX,
                    Client.mapBuildBaseZ,
                    world.viewRadius,
                    ClientBuild.minusedlevel,
                    PointLightManager.lightCount,
                    hash(PointLightManager['tileLights']),
                    hash(world.levelHeightmaps),
                    hash(ClientBuild.m_mapl),
                    hash(world.tileCameraClearance)
                ].join(' ')
            ).toBe(original[0]);
            expect(['collision', ...CollisionMap.levelMaps.map(map => hash(requireNonNull(map).flags))].join(' ')).toBe(original[1]);
            const counts: string[] = [];
            for (let i = 0; i < PointLightManager.lightCount; i++) {
                const mesh = requireNonNull(requireNonNull(PointLightManager.lights)[i]).mesh;
                counts.push('light ' + i + ' ' + (mesh === null ? '-' : mesh.vertexCount + ' ' + mesh.indexCount));
                if (mesh !== null) {
                    writer.mark('light.' + i);
                    mesh.draw();
                }
            }
            expect(counts).toEqual(original.filter(line => line.startsWith('light ')));
            const trace = readFileSync(join(dir, 'trace.tsv'), 'utf8');
            const expectedLights = lightBuffers(trace);
            expect(expectedLights.length).toBeGreaterThan(0);
            expect(lightBuffers(writer.text())).toEqual(expectedLights);
            const allShadows = requireNonNull(requireNonNull(GroundShadows.shadowMap).pixels);
            expect(beforeFloorShadows.length).toBe(allShadows.length);
            const floorShadows = allShadows.map((value, i) => value - beforeFloorShadows[i]);
            expect('floor-shadows ' + createHash('sha256').update(floorShadows).digest('hex')).toBe(original[2]);
            expect('all-shadows ' + createHash('sha256').update(allShadows).digest('hex')).toBe(original[3]);
            const expectedBuffers = shadowBuffers(trace.slice(0, trace.indexOf('\t~mark\twarmup')));
            expect(expectedBuffers).toHaveLength(338);
            expect(shadowBuffers(writer.text())).toEqual(expectedBuffers);
            const ticks = original.filter(line => line.startsWith('tick '));
            expect(ticks).toHaveLength(121);
            mathRandom.setSeed(5303575n);
            for (let tick = 0; tick < ticks.length; tick++) {
                if (tick > 0) {
                    Client.loopCycle++;
                    await client['titleLoop']();
                }
                let actors = 1;
                for (let i = 0; i < Client.npcs.length; i++) {
                    const npc = Client.npcs[i];
                    if (npc === null) continue;
                    actors = (Math.imul(actors, 31) + hash([i, npc.x, npc.z, npc.pathLength, npc.targetYaw, npc.yaw, npc.walkSeq, npc.walkCycle, npc.walkFrame, npc.walkNext, hash(npc.pathX), hash(npc.pathZ), hash(npc.pathSpeed)])) | 0;
                }
                expect(['tick', tick, OrbitCamera.x, OrbitCamera.y, OrbitCamera.z, OrbitCamera.pitch, OrbitCamera.yaw, CinematicCamera.progress, actors, hash(requireNonNull(CollisionMap.levelMaps[Client.playerLevel]).flags)].join(' ')).toBe(
                    ticks[tick]
                );
            }
            writer.mark('scene.terrain');
            const gl = requireNonNull(GlRenderer.gl);
            let depth = 0;
            let terrain = true;
            const push = gl.glPushMatrix.bind(gl),
                pop = gl.glPopMatrix.bind(gl);
            gl.glPushMatrix = () => {
                push();
                depth++;
            };
            gl.glPopMatrix = () => {
                pop();
                if (--depth === 0 && terrain && new Error().stack?.includes('Render')) {
                    writer.mark('scene.models');
                    terrain = false;
                }
            };
            const drawWorld = world.draw;
            world.draw = (...args) => {
                drawWorld.apply(world, args);
                writer.mark('scene.world.end');
            };
            try {
                Client.drawScene(503, 765, 0, 0, true);
            } finally {
                world.draw = drawWorld;
                gl.glPushMatrix = push;
                gl.glPopMatrix = pop;
                if (retained) writeFileSync(join(dir, 'ts-trace.tsv'), writer.text());
            }
            expect(terrain).toBe(false);
            writer.mark('scene.end');
            const nativeVisibility = original.find(line => line.startsWith('visibility '));
            function visible(map: boolean[][] | null): number {
                return hash(requireNonNull(map).map(row => row.map(v => (v ? 1231 : 1237))));
            }
            expect(['visibility', visible(world.cornerVisibility), visible(world.visibilityMap)].join(' ')).toBe(requireNonNull(nativeVisibility));
            function sceneCommands(trace: string, operation: string, phase = 'terrain'): string[] {
                return trace
                    .slice(trace.indexOf('\t~mark\tscene.' + phase), trace.indexOf('\t~mark\tscene.end'))
                    .split(/\r?\n/)
                    .filter(line => line.includes(operation))
                    .map(line => line.slice(line.indexOf('\t') + 1));
            }
            const expectedDraws = sceneCommands(trace, '\tglDrawElements\t');
            expect(expectedDraws.length).toBe(1078);
            expect(sceneCommands(trace, '\tglDrawElements\t', 'models')).toHaveLength(1045);
            const submitted = writer.text();
            if (retained) writeFileSync(join(dir, 'ts-trace.tsv'), submitted);
            expect(sceneCommands(submitted, '\tglDrawElements\t')).toEqual(expectedDraws);
            const uploads = sceneCommands(trace, '\tglBufferDataARB\t');
            const actualUploads = sceneCommands(submitted, '\tglBufferDataARB\t');
            expect(uploads).toHaveLength(506);
            expect(actualUploads).toHaveLength(uploads.length);
            for (const [index, command] of uploads.entries()) expect(actualUploads[index], 'scene VBO upload ' + index).toBe(command);
            // Startup in the fixture skips the JAR's initial UI sprite allocations. Keep each distinct texture
            // and all rebinds, relabelling its context-local GL name on first use within the camera-matched scene.
            function worldCommands(source: string): string[] {
                const names = new Map<string, number>();
                const first = source.indexOf('\t~mark\tscene.terrain');
                const end = source.indexOf('\t~mark\tscene.world.end', first);
                expect(first).toBeGreaterThan(0);
                expect(end).toBeGreaterThan(first);
                return source
                    .slice(first, end)
                    .split(/\r?\n/)
                    .filter(l => l.includes('\t'))
                    .map(line =>
                        line.slice(line.indexOf('\t') + 1).replace(/#T\d+/g, name => {
                            if (!names.has(name)) names.set(name, names.size);
                            return '#T' + names.get(name);
                        })
                    );
            }
            const nativeWorld = worldCommands(trace),
                tsWorld = worldCommands(submitted);
            expect(tsWorld).toHaveLength(nativeWorld.length);
            for (const [index, command] of nativeWorld.entries()) expect(tsWorld[index], 'world command ' + index).toBe(command);
            const alphaTexture = '\tglTexImage2D\t3553\t0\t6406\t';
            const expectedAlpha = sceneCommands(trace, alphaTexture);
            expect(expectedAlpha.length).toBeGreaterThan(0);
            expect(sceneCommands(writer.text(), alphaTexture)).toEqual(expectedAlpha);
            expect('submitted-shadows ' + createHash('sha256').update(allShadows).digest('hex')).toBe(requireNonNull(original.find(line => line.startsWith('submitted-shadows '))));
            const removals = original.filter(line => line.startsWith('remove '));
            expect(
                removals.some(line => {
                    const fields = line.split(' ');
                    return fields[1].endsWith('.true') && fields[9] !== fields[7];
                })
            ).toBe(true);
            for (const row of removals) {
                const fields = row.split(' ');
                const [plane, x, z, layer, height] = fields.slice(2, 7).map(Number);
                if (fields[1].endsWith('.true')) {
                    const model = layer === 0 ? world.GetWall(plane, x, z)?.model1 : layer === 1 ? world.GetDecor(plane, x, z)?.model : layer === 2 ? world.GetScene(plane, x, z)?.model : world.GetGroundDecor(plane, x, z)?.model;
                    if (!(model instanceof ClientLocAnim)) throw new Error('Missing native animated loc ' + row);
                    model.GetTempModel();
                }
                expect(createHash('sha256').update(allShadows).digest('hex'), row).toBe(fields[9]);
                LocChange.removeUnchecked(CollisionMap.levelMaps[plane], x, height, plane, z, layer);
                expect(createHash('sha256').update(allShadows).digest('hex'), row).toBe(fields[7]);
                expect(hash(requireNonNull(CollisionMap.levelMaps[plane]).flags), row).toBe(Number(fields[8]));
            }
            // Switch the populated cache region through th.a/pm.a in gameplay state. The headless
            // host supplies the canvas and thread normally installed by the browser/Java applet.
            const displayed = new Uint8ClampedArray(765 * 503 * 4);
            const software = new CanvasComponent({
                createImageData: (width, height) => ({ width, height, colorSpace: 'srgb', data: new Uint8ClampedArray(width * height * 4) }),
                putImageData(image, dx, dy, x, y, width, height) {
                    for (let row = y; row < y + height; row++) {
                        const start = (row * image.width + x) * 4;
                        displayed.set(image.data.subarray(start, start + width * 4), ((row + dy) * 765 + x + dx) * 4);
                    }
                }
            });
            const canvas = Object.assign(software, {
                isDisplayable: () => true,
                getSize: () => ({ width: 765, height: 503 }),
                setIgnoreRepaint() {}
            });
            Object.assign(client, {
                getGlCanvas: () => canvas,
                setCanvasSize() {},
                setCanvasLocation() {}
            });
            gameClient.instance = client;
            GameShell.canvas = canvas;
            GameShell.gameThread = Object.assign(Object.create(null), { priority: 5 });
            Signlink.osNameLower = 'win';
            Client.m_pSprites = assets.archive(8);
            Client.fontMetricsArchive = assets.archive(13);
            Client.gameState = 30;
            mathRandom.setSeed(5304500n);
            await Client.setWindowMode(-1, true, 0, false, -1);
            expect(GlRenderer.active).toBe(false);
            expect(Client.gameState).toBe(25);
            expect(Pix2D.pixels).toBe(requireNonNull(GameShell.drawArea).pixels);
            ClientBuild.m_hueOff = ClientBuild.m_ligOff = 0;
            mathRandom.setSeed(5304501n);
            Pix3D.setBrightness(Math.fround(0.7));
            for (let attempt = 0; attempt < 4 && Client.gameState === 25; attempt++) client['MapBuildLoop']();
            expect(['software-region', Client.gameState, world.viewRadius, ClientBuild.minusedlevel, hash(world.levelHeightmaps), hash(ClientBuild.m_mapl), ...CollisionMap.levelMaps.map(map => hash(requireNonNull(map).flags))].join(' ')).toBe(
                requireNonNull(original.find(line => line.startsWith('software-region ')))
            );
            Client.showLoadingMessage = false;
            const frame = requireNonNull(Pix2D.pixels);
            frame.fill(0x345678);
            for (let draw = 0; draw < 2; draw++) {
                if (draw === 1) OrbitCamera.yaw = (OrbitCamera.yaw + 256) & 2047;
                Client.drawScene(334, 512, 4, 4, false);
                const reference = readFileSync(join(dir, 'software-scene-' + draw + '.i32'));
                expect(reference.byteLength).toBe(frame.byteLength);
                const rgba = Buffer.alloc(displayed.length);
                for (let i = 0; i < rgba.length; i += 4) {
                    rgba[i] = reference[i + 1];
                    rgba[i + 1] = reference[i + 2];
                    rgba[i + 2] = reference[i + 3];
                    rgba[i + 3] = 255;
                }
                expect(Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength).equals(reference.swap32())).toBe(true);
                const area = requireNonNull(GameShell.drawArea);
                if (draw === 0) area.draw(0, 0, software.getGraphics());
                else area.drawClipped(334, 512, 4, 4, software.getGraphics());
                expect(Buffer.from(displayed.buffer).equals(rgba)).toBe(true);
                const colours = new Set<number>();
                for (let y = 4; y < 338; y++) {
                    for (let x = 4; x < 516; x++) colours.add(frame[y * 765 + x]);
                }
                expect(colours.size).toBeGreaterThan(100);
                expect(frame[0]).toBe(0x345678);
            }
        } finally {
            await signlink.stopWorker();
            if (!retained) rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
