import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GroundShadows from '#/dash3d/GroundShadows.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlSprite from '#/gl/GlSprite.js';
import NullGL from '#/gl/NullGL.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD stage 80 matches mapfunction colours, floor shadows and sprite types in both renderers',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-mapfunction-'));
        try {
            const seeds = [0n, 1n, -1n, 53020n, 104729n, 2147483647n, -9223372036854775808n];
            const output = join(dir, 'pixels.bin');
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const sources = ['HdMapfunctionSpritesOracle.java', 'HdTitleFrameOracle.java', 'GlRecorder.java'];
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, ...sources.map(s => join(import.meta.dir, s))]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const profile = join(import.meta.dir, 'rtx5070.json');
            const run = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, 'HdMapfunctionSpritesOracle', cachePath, output, profile, ...seeds.map(String)]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const java = readFileSync(output);
            const assets = localAssets(cachePath, [8, 13]);
            const archive = assets.archive(8);
            Client.lookupSpriteGroupIds(archive);
            Client.loadFonts(archive, assets.archive(13));
            Client.loadSprites(archive);
            let offset = 0;
            for (const seed of seeds) {
                mathRandom.setSeed(seed);
                Client.loadSprites(archive);
                const sprites = requireNonNull(Client.imageMapfunction);
                expect(SpriteLoader.mapfunctionsRecoloured).toBe(sprites);
                expect(sprites.length).toBe(java.readInt32BE(offset));
                offset += 4;
                for (const sprite of sprites) {
                    const pixels = requireNonNull(requireNonNull(sprite).pixels);
                    expect(pixels.length).toBe(java.readInt32BE(offset));
                    offset += 4;
                    const image = Buffer.allocUnsafe(pixels.byteLength);
                    for (let i = 0; i < pixels.length; i++) image.writeInt32BE(pixels[i], i * 4);
                    expect(image.equals(java.subarray(offset, offset + image.length)), 'mapfunction pixels at ' + offset).toBe(true);
                    offset += image.length;
                }
                expect(mathRandom.nextDouble()).toBe(java.readDoubleBE(offset));
                offset += 8;
            }
            GlRenderer.gl = new NullGL(capsProfileFromJson(readFileSync(profile, 'utf8')));
            const shadowGroup = SpriteLoader.floorShadowsId;
            function nextInt(): number {
                const value = java.readInt32BE(offset);
                offset += 4;
                return value;
            }
            const nextFlag = () => java.readUInt8(offset++) !== 0;
            for (const missing of [false, true]) {
                for (const active of [false, true]) {
                    GlRenderer.active = active;
                    SpriteLoader.floorShadowsId = missing ? -1 : shadowGroup;
                    const before = GroundShadows.shadowSprites;
                    const compass = Client.imageCompass;
                    let failed = false;
                    try {
                        Client.loadSprites(archive);
                    } catch (error) {
                        if (!(error instanceof TypeError)) throw error;
                        failed = true;
                    }
                    expect(failed).toBe(nextFlag());
                    expect(before === GroundShadows.shadowSprites).toBe(nextFlag());
                    expect(compass === Client.imageCompass).toBe(nextFlag());
                    expect(Client.imageCompass instanceof GlSprite).toBe(nextFlag());
                    for (const sprite of requireNonNull(SpriteLoader.hintMapEdge)) expect(sprite instanceof GlSprite).toBe(nextFlag());
                    for (const sprite of requireNonNull(SpriteLoader.mapfunctionsRecoloured)) expect(sprite instanceof GlSprite).toBe(nextFlag());
                    expect(Client.imageMapfunction === SpriteLoader.mapfunctionsRecoloured).toBe(nextFlag());
                    const shadows = GroundShadows.shadowSprites;
                    expect(shadows?.length ?? -1).toBe(nextInt());
                    for (const frame of shadows ?? []) {
                        const shadow = requireNonNull(frame);
                        for (const dim of [shadow.cropW, shadow.cropH, shadow.xOffset, shadow.yOffset, shadow.width, shadow.height]) {
                            expect(dim).toBe(nextInt());
                        }
                        const pixels = requireNonNull(shadow.pixels);
                        expect(pixels.length).toBe(nextInt());
                        expect(Buffer.from(pixels).equals(java.subarray(offset, offset + pixels.length))).toBe(true);
                        offset += pixels.length;
                        const palette = requireNonNull(shadow['palette']);
                        expect(palette.length).toBe(nextInt());
                        for (const colour of palette) expect(colour).toBe(nextInt());
                    }
                }
            }
            expect(offset).toBe(java.length);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
