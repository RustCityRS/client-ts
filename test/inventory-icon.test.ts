import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ObjType from '#/config/ObjType.js';
import Pix3D from '#/dash3d/Pix3D.js';
import TextureCache from '#/dash3d/TextureCache.js';
import { fromLiteral } from '#/datastruct/JagString.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { localAssets } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

type Row = [id: number, count: number, outline: number, shadow: number, text: number, entry: number, mode: number, reset: number];
function vectors(): Row[] {
    const r: Row[] = [];
    // Includes a normal whip, its paper note and lent icon, bronze arrows and
    // their four stack models, coins, and two textured fishing nets and their notes.
    for (const id of [6, 7, 39, 303, 304, 305, 306, 995, 1127, 1128, 4151, 4152, 13405, 13444, 13482]) {
        for (const count of [-1, 1, 2, 5, 10, 25, 100, 99999, 100000, 9999999, 10000000, 2147483647]) {
            for (const entry of [0, 1, 2]) {
                const outline = (count + 2) % 4,
                    shadow = [0, 0x302020, 0xf09152][entry];
                r.push([id, count, outline, shadow, 1, entry, 0, 1]);
            }
        }
    }
    for (let mode = 0; mode <= 20; mode++) {
        const id = mode === 8 ? 4152 : mode === 9 ? 13444 : mode === 12 ? 303 : 1127;
        for (const count of [-1, 1, 5]) for (const entry of [0, 1]) r.push([id, count, 2, 0x332277, 1, entry, mode, 1]);
    }
    // Missing material data must leave the sprite out of the LRU, including notes
    // whose recursive copy encountered the missing texture.
    for (const id of [303, 304, 305, 306]) for (const reset of [1, 0]) r.push([id, 10, 1, 0, 0, 0, 12, reset]);
    for (const count of [-2147483648, -1, 2, 2147483647]) {
        // 32-bit signed overflow before the cache hash widens to long.
        for (const outline of [-2147483648, -32769, 0, 2, 16384, 2147483647]) for (const shadow of [-2147483648, -8192, 4095, 4096, 8192, 2147483647]) r.push([4151, count, outline, shadow, 0, 0, 0, 0]);
    }
    for (const id of [-1, 2147483647, -2147483648, 65536 + 4151]) r.push([id, 1, 1, 0, 1, 0, 0, 1]);
    r.push([4151, 1, 1, 0, 0, 0, 0, 1], [4151, 1, 1, 8192, 0, 0, 13, 0], [4151, 1, 1, 0, 1, 0, 0, 0], [69687, 1, 1, 0, 0, 0, 13, 0]);
    for (let count = 1; count <= 101; count++) r.push([995, count, 0, 0, 0, 0, 0, +(count === 1)]);
    for (const count of [1, 2, 101, 99]) r.push([995, count, 0, 0, 0, 0, 0, 0]);
    return r;
}
function pixels(buffer: Int32Array | null): string {
    return buffer === null ? '-' : Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength).toString('base64');
}

loginFixture(
    import.meta.url,
    'inventory icon cache, note and lent composition, failures and final raster state match the original gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-obj-icon-'));
        try {
            const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'config/InventoryIconOracle.java'), join(import.meta.dir, 'render/ProceduralTextureCacheOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const cases = vectors();
            const jvm = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InventoryIconOracle', cachePath], {
                stdin: Buffer.from(cases.map(row => row.join(' ')).join('\n') + '\n'),
                maxBuffer: 32 * 1024 * 1024,
                timeout: 60000
            });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(cases.length);
            const assets = localAssets(cachePath, [7, 8, 9, 13, 19, 26]);
            const objects = assets.archive(19),
                models = assets.archive(7),
                sprites = assets.archive(8);
            const font = SpriteLoader.loadFont(sprites, sprites.GetGroupId(fromLiteral('p11_full')), 0, assets.archive(13));
            if (!(font instanceof SoftwareFont)) throw Error('Missing p11_full');
            ObjType.Init(objects, true, font, models);
            const tex = new TextureCache(assets.archive(9), assets.archive(26), sprites, 20, false);
            const data = tex.getTextureData.bind(tex);
            mathRandom.setSeed(1201n);
            Pix3D.setBrightness(Math.fround(0.7));
            const cos = Pix3D.cosTable,
                sin = Pix3D.sinTable,
                ids = new Map<object, number>();
            const tag = (o: object | null) => {
                if (o === null) return 0;
                const old = ids.get(o);
                if (old !== undefined) return old;
                ids.set(o, ids.size + 1);
                return ids.size;
            };
            let nonBlank = 0,
                uncachedFallbacks = 0,
                lateFaults = 0,
                restoreFaults = 0;
            for (const [i, [id, count, outline, shadow, text, entry, mode, reset]] of cases.entries()) {
                if (reset) ObjType.ResetSpriteCache();
                const packed = (id + (text ? 65536 : 0) + (outline << 17) + (shadow << 19)) | 0;
                const key = BigInt.asIntN(64, 3849834839n * BigInt(packed) + 3147483667n * BigInt(count));
                ObjType.types.Reset();
                ObjType.m_pConfigClient = objects;
                ObjType.m_pModels = models;
                ObjType.m_countFont = font;
                Pix3D.textureProvider = tex;
                tex.getTextureData = mode === 12 ? () => null : data;
                Pix3D.cosTable = cos;
                Pix3D.sinTable = sin;
                const prev = new Int32Array(53 * 43).fill(0x32577a);
                Pix2D.setPixels(prev, 53, 43);
                Pix2D.setClipping(3, 7, 48, 40);
                Pix3D.setRenderClipping();
                Pix3D.setOrigin(23, 28);
                Pix2D.maskOffsets = new Int32Array(33);
                Pix2D.maskLengths = new Int32Array(33);
                Pix3D.lowDetail = (mode & 1) === 0;
                Pix3D.textureFallback = true;
                Pix3D.trans = 74;
                Pix3D.hclip = true;
                if (mode === 1) ObjType.m_pModels = null;
                else if (mode === 3) ObjType.m_countFont = null;
                else if (mode === 4) Pix3D.cosTable = null;
                else if (mode === 5) Pix3D.sinTable = null;
                else if (mode === 10) ObjType.spriteCache.Put(key, {});
                else if (mode === 11) ObjType.spriteCache.Put(key, new Pix32(3, 2));
                else if (mode === 13) ObjType.m_pConfigClient = null;
                else if (mode === 19) Pix2D.clipMaxY = 0x40000100;
                else if (mode === 20) Pix2D.pixels = null;
                else if (mode !== 0 && mode !== 12) {
                    const t = ObjType.List(id);
                    switch (mode) {
                        case 2:
                            t.model = -1;
                            break;
                        case 6:
                            t.xAngle2d = 2048;
                            break;
                        case 7:
                            t.countObj = Int32Array.of(1);
                            t.countThreshold = Int32Array.of(2);
                            break;
                        case 8:
                            ObjType.List(t.certLink).model = -1;
                            break;
                        case 9:
                            ObjType.List(t.lentLink).model = -1;
                            break;
                        case 14:
                            t.zoom2d = 2147483647;
                            break;
                        case 15:
                            t.zoom2d = -2147483648;
                            break;
                        case 16:
                            t.countThreshold = null;
                            t.countObj = new Int32Array(10);
                            break;
                        case 17:
                            t.zAngle2d = -2147483648;
                            break;
                        case 18:
                            t.certTemplate = 1;
                            t.lentTemplate = 2;
                            t.certLink = 4151;
                            t.lentLink = 300;
                            break;
                    }
                }
                let status = 'ok',
                    icon: Pix32 | null = null;
                try {
                    const result = entry === 0 ? ObjType.GetSprite(id, outline, !!text, count, shadow) : ObjType.buildSprite(id, count, entry === 2, outline, !!text, shadow);
                    if (result !== null && !(result instanceof Pix32)) throw Error('Expected Pix32');
                    icon = result;
                } catch (err) {
                    if (err instanceof TypeError && err.message.startsWith('ClassCastException')) status = 'cast';
                    else if (err instanceof TypeError) status = 'null';
                    else if (err instanceof RangeError) status = err.message.startsWith('array index') ? 'bounds' : 'size';
                    else throw err;
                }
                const cached = ObjType.spriteCache.Find(key),
                    pixelsNow = Pix2D.pixels;
                const output = [
                    status,
                    key,
                    tag(icon),
                    cached instanceof Pix32 ? tag(cached) : cached === null ? 0 : 'other',
                    ObjType.spriteCache.countHard(),
                    Pix3D.textureFallback,
                    pixelsNow === prev ? 'old' : 'icon',
                    [Pix2D.width, Pix2D.height, Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY, Pix2D.maskOffsets === null, Pix2D.maskLengths === null],
                    [Pix3D.lowDetail, Pix3D.originX, Pix3D.originY, Pix3D.width, Pix3D.trans, Pix3D.hclip],
                    icon === null ? '-' : [icon.width, icon.height, icon.cropW, icon.cropH, icon.xOffset, icon.yOffset],
                    icon === null ? '-' : pixels(icon.pixels),
                    pixelsNow === prev ? prev.reduce((h, p) => (Math.imul(31, h) + p) | 0, 1) : pixels(pixelsNow)
                ];
                const reference = expected[i].split('|').map(String);
                for (const [field, actual] of output.entries()) expect(String(actual), 'case ' + i + ' ' + cases[i].join('/') + ', field ' + field).toBe(reference[field]);
                if (icon?.pixels?.some(p => p !== 0)) nonBlank++;
                if (mode === 12 && entry === 0 && icon !== null && cached === null && Pix3D.textureFallback) uncachedFallbacks++;
                if (status !== 'ok' && pixelsNow !== prev) lateFaults++;
                if (mode === 19 && status === 'size' && pixelsNow === prev && !Pix3D.lowDetail) restoreFaults++;
            }
            expect(nonBlank).toBeGreaterThan(800);
            expect(uncachedFallbacks).toBeGreaterThan(8);
            expect(lateFaults).toBeGreaterThan(10);
            expect(restoreFaults).toBe(6);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
