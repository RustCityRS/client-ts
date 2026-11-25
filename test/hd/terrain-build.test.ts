import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import FloType from '#/config/FloType.js';
import FluType from '#/config/FluType.js';
import Pix3D from '#/dash3d/Pix3D.js';
import Square from '#/dash3d/Square.js';
import TerrainBatch from '#/dash3d/TerrainBatch.js';
import TerrainBuilder from '#/dash3d/TerrainBuilder.js';
import TextureCache from '#/dash3d/TextureCache.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

class MeshInput {
    pos = 1;
    constructor(readonly data: Buffer) {}
    int(): number {
        const n = this.data.readInt32BE(this.pos);
        this.pos += 4;
        return n;
    }
    array<T>(kind: string): T {
        const size = this.int();
        if (size === -1) return null as T;
        if (kind === 'B') {
            const row = Uint8Array.from(this.data.subarray(this.pos, this.pos + size));
            this.pos += size;
            return row as T;
        }
        if (kind === 'I') return Int32Array.from({ length: size }, () => this.int()) as T;
        if (kind === 'F') return new Float32Array(Int32Array.from({ length: size }, () => this.int()).buffer) as T;
        return Array.from({ length: size }, () => this.array(kind.slice(1))) as T;
    }
}

test('terrain tile lookup skips null squares and preserves the emitted triangle before a bad coordinate', () => {
    const savedIndices = TerrainBatch['indices'],
        savedBlend = TerrainBatch['blendIndices'],
        bigEndian = GlRenderer.bigEndian;
    try {
        TerrainBatch['indices'] = TerrainBatch['blendIndices'] = null;
        GlRenderer.bigEndian = false;
        const batch = new TerrainBatch(-1, 32, false, false, 0);
        batch.tileCapacity = 3;
        batch.allocate();
        for (let z = 0; z < 3; z++) batch.addTile(0, 0, z, Int32Array.of(4, 7, 11), null, false);
        const visible = new Square(0, 0, 1);
        visible.drawFront = true;
        const tiles = [[[null, visible]]];
        const checkPrefix = (index: number) => {
            expect(() => batch.draw(tiles, 0, true)).toThrow('array index ' + index);
            const packet = requireNonNull(TerrainBatch['indices']);
            expect(packet.m_pos).toBe(12);
            expect(requireNonNull(packet.m_data).slice(0, 12)).toEqual(Uint8Array.of(4, 0, 0, 0, 7, 0, 0, 0, 11, 0, 0, 0));
        };
        checkPrefix(2);
        // A short coordinate array faults on the third tile even when another coordinate is also invalid.
        batch['tileX'] = new Int32Array(2);
        requireNonNull(batch['tileZ'])[2] = 15;
        checkPrefix(2);
    } finally {
        TerrainBatch['indices'] = savedIndices;
        TerrainBatch['blendIndices'] = savedBlend;
        GlRenderer.bigEndian = bigEndian;
    }
});

function describe(batch: TerrainBatch): string {
    const packed = requireNonNull(batch['vertexBuffer']);
    const vertices = createHash('sha256').update(packed.storageBytes().subarray(0, packed.limit())).digest('hex');
    const tiles = createHash('sha256');
    const word = Buffer.alloc(4);
    function integer(v: number) {
        word.writeInt32BE(v);
        tiles.update(word);
    }
    for (let i = 0; i < batch['tileCount']; i++) {
        for (const src of [batch['tileLevel'], batch['tileX'], batch['tileZ']]) integer(requireNonNull(src)[i]);
        const polygon = requireNonNull(requireNonNull(batch['polygons'])[i]);
        integer(polygon.length);
        for (const v of polygon) integer(v);
        if (batch.blend) {
            const extra = requireNonNull(batch['blendTriangles'])[i];
            integer(extra === null ? -1 : extra.length);
            if (extra !== null) for (const v of extra) integer(v);
            tiles.update(Uint8Array.of(+requireNonNull(batch['blendPolygon'])[i]));
        }
    }
    return [batch.key, batch.texture, batch.waterColour, batch.vertexCapacity, batch.vertexCount, batch.tileCapacity, batch['tileCount'], batch['indexCount'], batch['blendIndexCount'], vertices, tiles.digest('hex')].join(' ');
}

function check(dir: string, i: number): number {
    const input = new MeshInput(readFileSync(join(dir, i + '.bin')));
    let actual: TerrainBatch[];
    if (input.data[0] === 0) {
        actual = TerrainBuilder.buildUnderlays(
            input.array('[[B'),
            input.array('[B'),
            input.array('[B'),
            input.array('[I'),
            input.array('[F'),
            input.array('[I'),
            input.array('[B'),
            input.array('[B'),
            input.array('[F'),
            input.int(),
            input.array('[F'),
            input.array('[I'),
            input.array('[I'),
            input.array('[I')
        );
        expect(input.int()).toBe(4096);
    } else {
        const ny = input.array<Float32Array[]>('[F'),
            nx = input.array<Float32Array[]>('[F');
        const heights = input.array<Int32Array[]>('[I'),
            level = input.int();
        const nz = input.array<Float32Array[]>('[F'),
            rotations = input.array<Uint8Array[]>('[B'),
            lighting = input.array<Int32Array[]>('[I');
        expect(input.int()).toBe(0);
        actual = TerrainBuilder.buildOverlays(ny, nx, heights, level, nz, rotations, lighting, input.array('[B'), input.array('[B'), input.array('[B'), input.array('[[B'));
    }
    expect(input.pos).toBe(input.data.length);
    const lines = readFileSync(join(dir, i + '.txt'), 'utf8')
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
    expect(actual.map(describe), 'builder call ' + i).toEqual(lines);
    if (i === 0) {
        const polygons = actual.flatMap(batch => requireNonNull(batch['polygons']).slice(0, batch['tileCount']).map(requireNonNull));
        expect(new Set(polygons).size).toBe(polygons.length);
        expect(new Set(polygons.map(polygon => polygon.buffer)).size).toBeLessThan(polygons.length);
    }
    return actual.length;
}

loginFixture(
    import.meta.url,
    'HD terrain buffers match the original title and all underwater tile shapes and rotations',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-terrain-build-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            for (const args of [
                ['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdTerrainBuildOracle.java')],
                ['java', asm, '-cp', cp, 'HdTerrainBuildOracle', 'instrument', hdGamepackPath, dir],
                ['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-Xmx1536m', '-cp', cp, 'HdTerrainBuildOracle', cachePath, dir, join(import.meta.dir, 'rtx5070.json')]
            ]) {
                const result = Bun.spawnSync(args, { timeout: 40000 });
                expect(result.exitCode, result.stderr.toString()).toBe(0);
            }
            GlRenderer.active = true;
            GlRenderer.vboSupported = false;
            GlRenderer.bigEndian = false;
            const assets = localAssets(cachePath, [2, 8, 9, 26]);
            FluType.Init(assets.archive(2));
            FloType.Init(assets.archive(2));
            Pix3D.textureProvider = new TextureCache(assets.archive(9), assets.archive(26), assets.archive(8), 200, false);
            const palette = requireNonNull(Pix3D.colourTable);
            for (let i = 0; i < palette.length; i++) palette[i] = (Math.imul(i, 0x73a753) + 0x552318) & 0xffffff;
            expect(Array.from({ length: 8 }, (_, i) => check(dir, i))).toEqual([3, 1, 2, 0, 1, 0, 0, 0]);
            expect(check(dir, 8)).toBeGreaterThan(1);
            expect(check(dir, 9)).toBeGreaterThan(1);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000,
    'gl'
);
