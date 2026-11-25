import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Js5ResourceProvider from '#/cache/Js5ResourceProvider.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import SpriteLoader from '#/graphics/SpriteLoader.js';
import type { ColourImageRow } from '#/dash3d/ColourImageCache.js';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpSprite from '#/dash3d/TextureOpSprite.js';
import TextureOpTexture from '#/dash3d/TextureOpTexture.js';
import TextureOpTiledSprite from '#/dash3d/TextureOpTiledSprite.js';
import type TextureProvider from '#/dash3d/TextureProvider.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';

class Provider extends Js5ResourceProvider {
    constructor(
        private table: Js5Index,
        private data: Map<number, Uint8Array>
    ) {
        super();
    }
    index() {
        return this.table;
    }
    group(_mode: number, id: number) {
        return this.data.get(id) ?? null;
    }
    GetGroupLoadPercentage() {
        return 100;
    }
    prefetchGroup() {}
}

function cases(groups: number[]): number[][] {
    const cases: number[][] = [];
    for (const op of [18, 36, 39]) {
        for (const cap of [1, 2, 255]) {
            for (const [w, h] of [
                [1, 3],
                [3, 2],
                [7, 1],
                [8, 4],
                [64, 3],
                [128, 3]
            ]) {
                for (const [sw, sh] of [
                    [0, 1],
                    [3, 0],
                    [3, 2],
                    [2, 3],
                    [w, h],
                    [-3, 2],
                    [1073741825, 3]
                ]) {
                    for (const kind of [7, 8]) cases.push([op, kind, 4, -1, w, h, sw, sh, cap, 2]);
                }
                for (const kind of op === 36 ? [0, 1, 2, 3, 5, 6, 9] : [0, 9]) {
                    for (const id of [-1, 0, 1]) cases.push([op, kind, id, -1, w, h, 0, 0, cap, 2]);
                }
            }
        }
        for (const len of [-1, 0, 1, 2, 3]) cases.push([op, 9, 1573, -1, 5, 3, 0, 0, 1, len]);
        if (op !== 36)
            for (const group of groups)
                for (const cap of [1, 255]) {
                    cases.push([op, 0, group, -1, 13, 7, 0, 0, cap, 2]);
                    cases.push([op, 0, 0, group, 13, 7, 0, 0, cap, 2]);
                    cases.push([op, 0, 1, group, 13, 7, 0, 0, cap, 2]);
                }
    }
    return cases;
}

function failure(e: unknown) {
    if (e instanceof TypeError) return 'null';
    if (e instanceof RangeError) return e.message.includes('zero') ? 'arith' : 'bounds';
    if (e instanceof Error) return 'runtime';
    throw e;
}

function rowHash(rgb: ColourImageRow | null) {
    return rgb?.reduce((v, channel) => (Math.imul(31, v) + (channel?.reduce((h, p) => (Math.imul(31, h) + p) | 0, 1) ?? 0)) | 0, 1) ?? 0;
}

const image = Int32Array.from({ length: 128 * 128 }, (_, i) => Math.imul(i, 0x5def7123) ^ 0xa752008f);

function run([op, kind, id, group, w, h, sw, sh, cap, len]: number[], provider: Provider) {
    const node = op === 36 ? new TextureOpTexture() : op === 18 ? new TextureOpTiledSprite() : new TextureOpSprite();
    let log = '';
    function textures(mode: number): TextureProvider {
        return {
            getTextureSmall(id) {
                log += 's' + id + ',';
                if (mode === 3) TextureOp.textureProvider = textures(4);
                if (mode === 5) TextureOp.textureProvider = null;
                if (mode === 6) TextureOp.setSize(33, 7);
                return (id & 1) === 0;
            },
            getPixels(id) {
                log += 'p' + id + '.' + mode + ',';
                TextureOp.setSize(11, 5);
                return mode === 1 ? null : mode === 2 ? Int32Array.of(0xabcd) : image;
            },
            isAvailable() {
                throw Error();
            },
            isLoaded() {
                throw Error();
            },
            getTextureData() {
                throw Error();
            },
            getTextureColour() {
                throw Error();
            },
            getTextureSolid() {
                throw Error();
            }
        };
    }
    TextureOp.width = TextureOp.height = TextureOp.widthMask = TextureOp.heightMask = TextureOp.sizeScale = 0;
    TextureOp.normalisedX = TextureOp.normalisedY = null;
    TextureOp.setSize(w, h);
    node.cacheCapacity = cap;
    node.initCache(w, h);
    TextureOpSprite.spriteGroupId = group;
    TextureOpSprite.spriteArchive = kind === 9 ? null : new Js5(provider, false, true);
    TextureOp.textureProvider = kind === 9 ? null : textures(kind);
    const bytes = len < 0 ? null : new Uint8Array(len);
    if (bytes !== null) {
        bytes[0] = id >> 8;
        bytes[1] = id;
    }
    const p = new PacketT(bytes);
    let result = 'ok';
    try {
        node.decode(p, id < 0 ? 1 : 0);
    } catch (e) {
        result = failure(e);
    }
    if (kind === 7 || kind === 8) {
        const pixels = image.slice(0, kind === 7 ? 60 : 3);
        if (node instanceof TextureOpTexture) {
            node['textureWidth'] = sw;
            node['textureHeight'] = sh;
            node['pixels'] = pixels;
        } else {
            node['spriteWidth'] = sw;
            node['spriteHeight'] = sh;
            node['pixels'] = pixels;
        }
    }
    const retained = cap === 1 ? requireNonNull(node.colourImageCache).get(0) : null;
    if (retained !== null) {
        requireNonNull(retained[0])[0] = 97;
        if (h > 1) requireNonNull(node.colourImageCache).get(1);
    }
    const trace = [[result, p.m_pos, node.getSpriteId(), node.getTextureId()].join(':')];
    const ids = new Map<ColourImageRow | null, number>();
    const pixels = () => (node instanceof TextureOpTexture ? node['pixels'] : node['pixels']);
    for (const row of [0, 1, 1, h - 1, 2, -1, 0, h]) {
        try {
            const rgb = node.getColourOutput(row);
            const tag = ids.get(rgb) ?? ids.size + 1;
            ids.set(rgb, tag);
            result = 'r' + tag + '.' + rowHash(rgb);
        } catch (e) {
            result = failure(e);
        }
        const width = node instanceof TextureOpTexture ? node['textureWidth'] : node['spriteWidth'];
        const height = node instanceof TextureOpTexture ? node['textureHeight'] : node['spriteHeight'];
        trace.push([result, width, height, pixels() !== null, rowHash(retained), TextureOp.width, TextureOp.height, log].join(':'));
        log = '';
    }
    for (let i = 0; i < 2; i++) {
        try {
            node.clearImageCache();
            result = 'ok';
        } catch (e) {
            result = failure(e);
        }
        trace.push([result, pixels() !== null, rowHash(retained)].join(':'));
    }
    return trace.join('|');
}

test('530 sprite and texture inputs match archive loads, non-square sampling, provider changes and shared rows', () => {
    const oldTexture = { ...TextureOp },
        oldSprite = { ...TextureOpSprite },
        oldLoader = { ...SpriteLoader };
    const directory = mkdtempSync(join(tmpdir(), 'texture-image-input-'));
    try {
        const reference = readGroup(cachePath, 255, 8);
        const table = new Js5Index(reference, Crc32.prefix(reference, reference.length));
        const groups = Array.from(requireNonNull(table.groupIds)).filter((_, i) => i % 67 === 0);
        const data = new Map(groups.map(g => [g, readGroup(cachePath, 8, g)]));
        writeFileSync(join(directory, 'index'), reference);
        for (const [g, container] of data) writeFileSync(join(directory, String(g)), container);
        const vectors = cases(groups);
        const cc = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', directory, join(import.meta.dir, 'TextureImageInputOracle.java')]);
        expect(cc.exitCode, cc.stderr.toString()).toBe(0);
        const jvm = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', directory + delimiter + gamepackPath, 'TextureImageInputOracle', directory, groups.join(',')], {
            stdin: Buffer.from(vectors.map(v => v.join(' ')).join('\n') + '\n'),
            maxBuffer: 8 * 1024 * 1024
        });
        expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
        const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(vectors.length);
        const provider = new Provider(table, data);
        for (const [i, v] of vectors.entries()) expect(run(v, provider), v.join(' ')).toBe(expected[i]);
    } finally {
        Object.assign(TextureOp, oldTexture);
        Object.assign(TextureOpSprite, oldSprite);
        Object.assign(SpriteLoader, oldLoader);
        rmSync(directory, { recursive: true, force: true });
    }
}, 30000);
