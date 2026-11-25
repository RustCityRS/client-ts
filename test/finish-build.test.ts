import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import world from '#/dash3d/world.js';
import Pix2D from '#/graphics/Pix2D.js';
import SceneCutover from '#/scene/SceneCutover.js';
import { captureSdWorld } from '#/dash3d/SdWorldRaster.js';
import type { SdRasterFrame } from '#/dash3d/SdRasterSpans.js';
import { renderSdFrames } from './render/sd-device.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

function ints(data: ArrayLike<number>): Buffer {
    const out = Buffer.alloc(data.length * 4);
    for (let i = 0; i < data.length; i++) out.writeInt32BE(data[i], i * 4);
    return out;
}

loginFixture(
    import.meta.url,
    'FinishBuild matches every Lumbridge ground call, shadow, collision flag, occluder and textured viewport pixel',
    async () => {
        const retain = process.env.RS530_FINISHBUILD_ARTIFACTS;
        const dir = retain ?? mkdtempSync(join(tmpdir(), '530-finish-build-'));
        mkdirSync(dir, { recursive: true });
        const originalGround = world.SetGround,
            originalPlace = ClientBuild.placeLocation,
            originalMode = SceneCutover.native;
        try {
            const assets = localAssets(cachePath, [0, 1, 2, 5, 7, 8, 9, 16, 20, 22, 26]);
            const keys = [
                [-1653558720, 2119901478, -1449369788, -1829505468],
                [1150282919, 572626783, -257791473, 2031745700],
                [183396243, -461663209, -212681663, -266126212],
                [0, 0, 0, 0]
            ];
            const squares = [254, 256, 380, 382].map((id, i) => {
                const land = requireNonNull(assets.file(5, id)),
                    locs = requireNonNull(assets.files(5, id + 1, Int32Array.from(keys[i]))?.[0]);
                writeFileSync(join(dir, 'map' + id + '.bin'), land);
                writeFileSync(join(dir, 'loc' + id + '.bin'), locs);
                return { land, locs, x: (49 + (i >> 1)) * 64 - 3160, z: (49 + (i & 1)) * 64 - 3160 };
            });
            const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const compile = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/FinishBuildOracle.java'), join(import.meta.dir, 'review/provider-config/ProviderConfigOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', ...exports, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp'];
            const patch = Bun.spawnSync([...java, gamepackPath + delimiter + dir, 'FinishBuildOracle', 'patch', dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([...java, dir + delimiter + gamepackPath, 'FinishBuildOracle', cachePath, dir]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const stats = run.stdout.toString().trim().split(/\s+/).map(Number);
            if (retain)
                writeFileSync(
                    join(dir, 'summary.json'),
                    JSON.stringify(
                        {
                            groundCalls: stats[0],
                            occluders: stats[1],
                            materializedTextureReads: stats[2],
                            hueOff: stats[3],
                            lightnessOff: stats[4]
                        },
                        null,
                        2
                    ) + '\n'
                );

            const textures = (Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 20, false));
            let textured = 0;
            const getData = textures.getTextureData.bind(textures);
            textures.getTextureData = (id, brightness) => {
                const result = getData(id, brightness);
                if (result !== null) textured++;
                return result;
            };
            world.init(4, 104, 104, 25, false);
            ClientBuild.Init(false);
            const maps = Array.from({ length: 4 }, () => new CollisionMap(104, 104));
            for (const { x, z, land } of squares) ClientBuild.LoadGround(z, false, 3160, x, land, 3160, maps);
            SceneCutover.native = true;
            ClientBuild.placeLocation = ClientBuild.AddLoc;
            mathRandom.setSeed(53001n);
            for (const { x, z, locs } of squares) ClientBuild.LoadLocations(x, maps, locs, z, false);
            const shadow = Buffer.concat(
                requireNonNull(ClientBuild.m_shadow)
                    .flat()
                    .map(row => Buffer.from(row))
            );
            mathRandom.setSeed(53002n);
            Pix3D.setBrightness(Math.fround(0.8));
            const calls: number[] = [];
            world.SetGround = (...args) => {
                calls.push(...args);
                originalGround(...args);
            };
            ClientBuild.m_hueOff = ClientBuild.m_ligOff = 0;
            mathRandom.setSeed(53003n);
            ClientBuild.FinishBuild(maps, false);
            const collision = Buffer.concat(maps.flatMap(map => map.flags.map(row => ints(row))));
            const occlusion: number[] = [];
            for (let i = 0; i < world.numOccluders; i++) {
                const o = requireNonNull(requireNonNull(world.occluders)[i]);
                occlusion.push(o.type, o.minX, o.maxX, o.minZ, o.maxZ, o.minY, o.maxY);
            }
            const pixels = new Int32Array(512 * 334);
            Pix2D.setPixels(pixels, 512, 334);
            Pix3D.setRenderClipping();
            mathRandom.setSeed(53004n);
            const captures: SdRasterFrame[] = [];
            const draw = (...args: Parameters<typeof world.draw>): void => {
                if (process.env.RS530_SD_GPU_WORLD === '1') captures.push(captureSdWorld(...args));
                else world.draw(...args);
            };
            draw(6500, -1080, 5700, 256, 0, null, null, null, null, null, null, 0, 0, 50, 50);
            let frame = ints(pixels);
            pixels.fill(0);
            draw(3904, -900, 3250, 256, 0, null, null, null, null, null, null, 0, 0, 30, 32);
            if (captures.length) {
                const [first, second] = await renderSdFrames(dir, captures);
                frame = ints(first);
                pixels.set(second);
            }
            const differences: string[] = [];
            for (const [name, actual] of Object.entries({ shadow, tiles: ints(calls), collision, occluders: ints(occlusion), frame, river: ints(pixels) })) {
                const expected = readFileSync(join(dir, name + '.bin'));
                if (retain) writeFileSync(join(dir, 'ts-' + name + '.bin'), actual);
                if (!actual.equals(expected)) {
                    const first = actual.findIndex((value, i) => value !== expected[i]);
                    differences.push(name + ': first byte ' + first + ', TS ' + actual.length + ' bytes, JAR ' + expected.length + ' bytes');
                }
            }
            expect(differences).toEqual([]);
            expect([calls.length / 20, world.numOccluders, textured, ClientBuild.m_hueOff, ClientBuild.m_ligOff]).toEqual(stats);
            expect(textured).toBeGreaterThan(0);
            expect(calls.length / 20).toBeGreaterThan(10000);
        } finally {
            world.SetGround = originalGround;
            ClientBuild.placeLocation = originalPlace;
            SceneCutover.native = originalMode;
            if (!retain) rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
