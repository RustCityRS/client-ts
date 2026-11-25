import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import Js5ResourceProvider from '#/cache/Js5ResourceProvider.js';
import ProceduralTexture from '#/dash3d/ProceduralTexture.js';
import type TextureProvider from '#/dash3d/TextureProvider.js';
import Crc32 from '#/io/Crc32.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

class CacheDisk extends Js5ResourceProvider {
    readonly table: Js5Index;
    constructor(private readonly archive: number) {
        super();
        const ref = readGroup(cachePath, 255, archive);
        this.table = new Js5Index(ref, Crc32.prefix(ref, ref.length));
    }
    index() {
        return this.table;
    }
    group(_mode: number, group: number) {
        return readGroup(cachePath, this.archive, group);
    }
    prefetchGroup() {}
    GetGroupLoadPercentage() {
        return 100;
    }
}

// Only the kg/qi entry points used by jd/fk are represented on this side.
// Inputs are the real archive-26 size column and the real qi transpose flag.
// Nested images run the TS graph recursively, including its shared brightness
// table and image dimensions. No pixels or material facts come from the oracle.
function nestedTextures(textures: Js5, sprites: Js5, materials: Js5): TextureProvider {
    const p = new PacketT(requireNonNull(materials.GetFile(0, 0)));
    const present = Uint8Array.from({ length: p.g2() }, () => p.g1());
    const count = present.reduce((sum, flag) => sum + (flag === 1 ? 1 : 0), 0);
    p.m_pos += 2 * count;
    const small = Uint8Array.from(present, flag => (flag === 1 ? p.g1() : 0));
    const definitions = new Map<number, { graph: ProceduralTexture; transposed: boolean }>();
    function definition(id: number) {
        const found = definitions.get(id);
        if (found) return found;
        const bytes = textures.GetFile(0, id);
        if (bytes === null) return null;
        const packet = new PacketT(bytes);
        const graph = new ProceduralTexture(packet);
        packet.g1();
        const def = { graph, transposed: packet.g1() === 1 };
        definitions.set(id, def);
        return def;
    }
    function unused(): never {
        throw Error('Unexpected pc call from procedural graph');
    }
    return {
        getTextureSmall(id) {
            return small[id] === 1;
        },
        isLoaded(id) {
            return definition(id)?.graph.isReady(this, sprites) ?? false;
        },
        getPixels(id) {
            const def = definition(id);
            if (!def || !def.graph.isReady(this, sprites)) return null;
            const size = this.getTextureSmall(id) ? 64 : 128;
            return def.graph.getPixels(this, sprites, def.transposed, size, false, 1, size);
        },
        getTextureData: unused,
        getTextureColour: unused,
        getTextureSolid: unused,
        isAvailable: unused
    };
}

function pixelDigest(pixels: Int32Array): string {
    const data = new DataView(new ArrayBuffer(pixels.length * 4));
    for (let i = 0; i < pixels.length; i++) data.setInt32(i * 4, pixels[i], true);
    return createHash('sha256').update(new Uint8Array(data.buffer)).digest('hex');
}

loginFixture(
    import.meta.url,
    '530 archive 9 procedural texture corpus matches JAR pixels at both sizes and all orientations',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-procedural-texture-cache-'));
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ProceduralTextureCacheOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Xmx384m', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ProceduralTextureCacheOracle', cachePath], { maxBuffer: 4 * 1024 * 1024, timeout: 150000 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const rows = java.stdout
                .toString()
                .trimEnd()
                .split(/\r?\n/)
                .map(line => line.split('|'));
            const disk = new CacheDisk(9),
                ids = requireNonNull(disk.table.groupIds);
            expect(rows.map(row => Number(row[0]))).toEqual(Array.from(ids));
            const textures = new Js5(disk, false, true);
            const sprites = new Js5(new CacheDisk(8), false, true);
            const provider = nestedTextures(textures, sprites, new Js5(new CacheDisk(26), false, true));
            const classIds = new Map<object, number>();
            for (let id = 0; id < 40; id++) classIds.set(requireNonNull(ProceduralTexture.createOp(id)).constructor, id);
            const operators = new Set<number>(),
                usedSprites = new Set<number>(),
                nested = new Set<number>();
            let readyCount = 0,
                imageCount = 0,
                nestedCount = 0;
            const differences: string[] = [];
            for (const [idText, pos, opCsv, spriteCsv, textureCsv, ready, size, ...hashes] of rows) {
                const id = Number(idText);
                const packet = new PacketT(requireNonNull(textures.GetFile(0, id)));
                const graph = new ProceduralTexture(packet);
                const ops = requireNonNull(graph['operators']).map(op => requireNonNull(classIds.get(requireNonNull(op).constructor)));
                const spriteIds = requireNonNull(graph['spriteIds']),
                    textureIds = requireNonNull(graph['textureIds']);
                expect([String(packet.m_pos), ops.join(','), spriteIds.join(','), textureIds.join(',')], idText).toEqual([pos, opCsv, spriteCsv, textureCsv]);
                for (const op of ops) operators.add(op);
                for (const value of spriteIds) usedSprites.add(value);
                for (const value of textureIds) nested.add(value);
                if (textureIds.length) nestedCount++;
                const loaded = graph.isReady(provider, sprites);
                expect([loaded ? '1' : '0', provider.getTextureSmall(id) ? '64' : '128'], idText).toEqual([ready, size]);
                if (!loaded) continue;
                readyCount++;
                expect(hashes.length).toBe(4);
                for (let flags = 0; flags < 4; flags++) {
                    const size = ((id ^ flags) & 1) === 0 ? 64 : 128;
                    const pixels = graph.getPixels(provider, sprites, (flags & 2) !== 0, size, (flags & 1) !== 0, (flags & 1) === 0 ? Math.fround(0.7) : 1, size);
                    expect(pixels.length).toBe(size * size);
                    const actual = pixelDigest(pixels);
                    if (actual !== hashes[flags]) differences.push(`texture ${id}, flags ${flags}, size ${size}: ${actual} != ${hashes[flags]}`);
                    imageCount++;
                }
            }
            const uncovered = Array.from({ length: 40 }, (_, i) => i).filter(id => !operators.has(id));
            expect(uncovered).toEqual([11, 18, 23, 25, 26, 31, 33, 35, 37]);
            expect([ids.length, readyCount, imageCount, usedSprites.size, nestedCount, nested.size]).toEqual([680, 680, 2720, 28, 293, 189]);
            expect(differences.slice(0, 15), `${differences.length} of ${imageCount} full texture images differ`).toEqual([]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    240000
);
