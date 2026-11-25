import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Client from '#/client/Client.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import Pix2D from '#/graphics/Pix2D.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Crc32 from '#/io/Crc32.js';
import TitleScreen from '#/title/TitleScreen.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { readGroup } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

type Case = [mode: number, details: number, brightness: number, prefix: number, materialId: number, seed: number];
function scenarios(): Case[] {
    const rows: Case[] = [];
    for (const details of [0, 1]) for (const brightness of [0, 1, 2, 3, 4, 5]) for (const sample of [0, 17, 597]) rows.push([0, details, brightness, 0, sample, 98 + brightness]);
    for (const mode of [1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 13]) for (const detailed of [0, 1]) for (const brightness of [0, 3]) rows.push([mode, detailed, brightness, 0, 17, 87]);
    for (const prefix of [0, 1, 2, 5, 17, 79, 303, 678, 680, 705, 900, 1457, 2001, 3000, 5898, -1]) rows.push([6, 1, 3, prefix, 7, 101]);
    return rows;
}
function hash(a: Int32Array | null): number {
    if (a === null) return 0;
    let h = 1;
    for (const v of a) h = (Math.imul(h, 31) + v) | 0;
    return h;
}
function floatBits(n: number): number {
    const f = Float32Array.of(n);
    return new Int32Array(f.buffer)[0];
}
function failure(e: unknown): string {
    return e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : String(e);
}

loginFixture(
    import.meta.url,
    'stage 90 installs the original software texture cache before brightness and retains JAR state on faults',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-texture-startup-'));
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'cache/TextureStartupOracle.java'), join(import.meta.dir, 'render/ProceduralTextureCacheOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const cases = scenarios(),
                oracle = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'TextureStartupOracle', cachePath], {
                    stdin: Buffer.from(cases.map(row => row.join(' ')).join('\n') + '\n'),
                    maxBuffer: 3 * 1024 * 1024
                });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(cases.length);
            const app = new Client();
            const tables = new Map(
                [8, 9, 26].map(id => {
                    const b = readGroup(cachePath, 255, id);
                    return [id, new Js5Index(b, Crc32.prefix(b, b.length))];
                })
            );
            const disk = (id: number) => new Js5({ index: () => requireNonNull(tables.get(id)), group: (_, g) => readGroup(cachePath, id, g), prefetchGroup() {}, GetGroupLoadPercentage: () => 100 }, id === 26, true);
            const tex = disk(9),
                altTex = disk(9),
                sprites = disk(8),
                altSprites = disk(8);
            const realMeta = disk(26),
                metaBytes = requireNonNull(realMeta.GetFile(0, 0));
            const prior = new TextureCache(tex, realMeta, sprites, 3, false);
            let mode = 0,
                cut = 0,
                events = '',
                changed = false,
                altMeta: Js5 | null = null;
            function metadata(tag: string): Js5 {
                return new Js5(
                    {
                        index() {
                            events += 'i' + tag + ';';
                            if (mode === 5 && tag === 'b') {
                                Client.texturesArchive = Client.m_pSprites = null;
                                Preferences.highDetailTextures = !Preferences.highDetailTextures;
                                Preferences.brightness = 4;
                            }
                            return mode === 2 ? null : requireNonNull(tables.get(26));
                        },
                        group(_, group) {
                            events += 'g' + tag + group + ';';
                            if (!changed && tag === 'a') {
                                changed = true;
                                if (mode === 4 || mode === 5 || mode === 12) {
                                    Client.texturesArchive = altTex;
                                    Client.m_pSprites = altSprites;
                                    Client.materialsArchive = altMeta;
                                    Preferences.highDetailTextures = !Preferences.highDetailTextures;
                                }
                                if (mode === 11) Client.materialsArchive = null;
                            }
                            if (mode === 1 || (mode === 12 && tag === 'a')) return null;
                            if (mode === 6) {
                                const length = cut < 0 ? metaBytes.length - 1 : Math.min(cut, metaBytes.length);
                                const packed = Buffer.alloc(5 + length);
                                packed.writeInt32BE(length, 1);
                                packed.set(metaBytes.subarray(0, length), 5);
                                return packed;
                            }
                            return readGroup(cachePath, 26, group);
                        },
                        prefetchGroup() {},
                        GetGroupLoadPercentage(group) {
                            events += 'p' + tag + group + ';';
                            return -53;
                        }
                    },
                    true,
                    true
                );
            }
            function describe(o: object | null, a: object, b: object): string {
                return o === null ? '~' : o === a ? 'a' : o === b ? 'b' : '?';
            }
            let residentFrames = 0,
                nonBlank = 0;
            function frame(id: number, terrain: boolean): string {
                const pixels = new Int32Array(28 * 22).fill(0x53213a);
                Pix2D.setPixels(pixels, 28, 22);
                Pix3D.setRenderClipping();
                Pix3D.trans = 0;
                Pix3D.textureFallback = false;
                const triangle = terrain ? Pix3D.terrainTextureTriangle : Pix3D.textureTriangle;
                triangle(1, 19, 17, 2, 6, 26, 100, 112, 96, -45, 12, 41, -20, 40, 55, 500, 420, 569, id);
                if (!Pix3D.textureFallback) {
                    residentFrames++;
                    if (pixels.some(v => v !== 0x53213a)) nonBlank++;
                }
                return Pix3D.textureFallback + ':' + Buffer.from(pixels.buffer).toString('base64');
            }
            const state = (provider: TextureCache, sample: number): string => {
                const lru = provider['recentUse'],
                    free = lru['remaining'];
                let pix;
                try {
                    const first = provider.getTextureData(sample, Math.fround(0.7)),
                        second = provider.getTextureData(sample, Math.fround(0.7));
                    pix = first === null ? 'missing' : [first.length, hash(first), first === second].join(',');
                    if (first !== null && (mode === 0 || mode === 4 || mode === 5)) pix += ',' + frame(sample, true) + ',' + frame(sample, false);
                } catch (e) {
                    pix = failure(e);
                }
                return [
                    describe(provider['textures'], tex, altTex),
                    describe(provider['sprites'], sprites, altSprites),
                    provider['capacity'],
                    provider['lowMemory'],
                    provider['secondaryCache'] === null,
                    lru['m_cacheSize'],
                    free,
                    lru['remaining'],
                    provider.getTextureColour(sample),
                    provider.getTextureSmall(sample),
                    provider.isAvailable(sample),
                    provider.getTextureSolid(sample),
                    pix
                ].join(',');
            };
            for (const [i, v] of cases.entries()) {
                const [kind, details, brightness, prefix, sample, seed] = v;
                mode = kind;
                cut = prefix;
                events = '';
                changed = false;
                altMeta = metadata('b');
                Client.materialsArchive = mode === 7 ? null : metadata('a');
                Client.texturesArchive = mode === 8 ? null : tex;
                Client.m_pSprites = mode === 13 ? null : sprites;
                Pix3D.textureProvider = prior;
                Preferences.brightness = brightness;
                Preferences.highDetailTextures = details !== 0;
                Preferences.safeMode = true;
                Client.loadingStage = 90;
                TitleScreen.m_loadPos = 29;
                TitleScreen.m_loadString = fromJsString('seed');
                Pix3D.colourTable = mode === 9 ? null : new Int32Array(mode === 10 ? 29 : 65536).fill(0x139bc);
                Reflect.set(Pix3D, 'brightness', 0.546875);
                mathRandom.setSeed(BigInt(seed));
                let fault = 'ok';
                try {
                    await app['MainLoad']();
                } catch (e) {
                    fault = failure(e);
                }
                const provider = Pix3D.textureProvider;
                const actual = [
                    fault,
                    events,
                    [Client.loadingStage, TitleScreen.m_loadPos, Buffer.from(TitleScreen.m_loadString.toBytes()).toString('base64')],
                    floatBits(Pix3D.legacyBrightness),
                    hash(Pix3D.colourTable),
                    mathRandom.nextInt(),
                    provider === prior ? 'prior' : provider instanceof TextureCache ? state(provider, sample) : 'wrong class'
                ];
                expect(actual.join('|'), v.join(' ')).toBe(expected[i]);
            }
            expect(residentFrames).toBe(88);
            expect(nonBlank).toBeGreaterThan(0);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
