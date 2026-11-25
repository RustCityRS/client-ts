import Linkable from '#/datastruct/Linkable';
import HashTable from '#/datastruct/HashTable';
import IntNode from '#/datastruct/IntNode';
import PacketT from '#/io/PacketT';
import ByteBuffer from '#/util/nio/ByteBuffer';
import ByteOrder from '#/util/nio/ByteOrder';
import GlBuffer from '#/gl/GlBuffer';
import GlRenderer from '#/gl/GlRenderer';
import MaterialManager from '#/gl/material/MaterialManager';
import UnderwaterMaterial from '#/gl/material/UnderwaterMaterial';
import { GL } from '#/jogl/GL';
import Preferences from '#/ui/Preferences';
import { bitCeil, longFromSignedWords } from '#/util/IntUtils';
import { arrayAtF32, arrayAtI32, arrayAtObj, arrayPutF32, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import Pix3D from './Pix3D';
import type Square from './Square';
import type { HdTextureProvider } from './TextureProvider';

// The two shared packet buffers already hold these indices. A native word view
// writes the same four little-endian bytes without allocating another copy.
const indexViews = new WeakMap<Uint8Array, Uint32Array>();
function indexWords(packet: PacketT): Uint32Array | null {
    const bytes = packet.m_data;
    if (!bytes || (bytes.byteOffset & 3) !== 0 || ByteOrder.nativeOrder() !== ByteOrder.LITTLE_ENDIAN) return null;
    let words = indexViews.get(bytes);
    if (!words) {
        words = new Uint32Array(bytes.buffer, bytes.byteOffset, Math.min(bytes.byteLength, 0x80000000) >>> 2);
        indexViews.set(bytes, words);
    }
    return words;
}

function fitsIndices(words: Uint32Array | null, pos: number, count: number): words is Uint32Array {
    return words !== null && pos >= 0 && pos === (pos & ~3) && (pos >>> 2) + count <= words.length;
}

// hg in runescape_gl.jar. One level's terrain polygons for a material key.
export default class TerrainBatch extends Linkable {
    vertexCapacity = 0; // hg.p
    vertexCount = 0; // hg.q
    tileCapacity = 0; // hg.r
    private vertexBuffer: ByteBuffer | null = null; // hg.s
    private extraCoords: Float32Array | null = null; // hg.t
    private readonly extra: boolean; // hg.u
    private colours: Int32Array | null = null; // hg.v
    private tileZ: Int32Array | null = null; // hg.w
    private tileX: Int32Array | null = null; // hg.x
    readonly texture: number; // hg.y
    private vertexZ: Int32Array | null = null; // hg.z
    private seams: HashTable<IntNode> | null = null; // hg.A
    private normalZ: Float32Array | null = null; // hg.B
    readonly waterColour: number; // hg.C
    private blendIndexCount = 0; // hg.D
    private polygons: (Int32Array | null)[] | null = null; // hg.E
    private vertexY: Int32Array | null = null; // hg.F
    private indexCount = 0; // hg.G
    private blendTriangles: (Int32Array | null)[] | null = null; // hg.I
    private static blendIndexBuffer: ByteBuffer | null = null; // hg.J
    private static blendIndices: PacketT | null = null; // hg.K
    private vbo: GlBuffer | null = null; // hg.L
    readonly blend: boolean; // hg.M
    private normalY: Float32Array | null = null; // hg.N
    private tileCount = 0; // hg.O
    private tileLevel: Int32Array | null = null; // hg.P
    private static indexBuffer: ByteBuffer | null = null; // hg.Q
    private normalX: Float32Array | null = null; // hg.R
    private blendPolygon: boolean[] | null = null; // hg.S
    private vertexX: Int32Array | null = null; // hg.T
    private static indices: PacketT | null = null; // hg.U
    private readonly scale: number; // hg.V

    constructor(texture: number, scale: number, blend: boolean, extra: boolean, waterColour: number) {
        super();
        this.texture = texture;
        this.scale = Math.fround(scale);
        this.blend = blend;
        this.extra = extra;
        this.waterColour = waterColour;
    }

    // hg.a()V
    static unload(): void {
        TerrainBatch.indices = null;
        TerrainBatch.blendIndices = null;
        TerrainBatch.indexBuffer = null;
        TerrainBatch.blendIndexBuffer = null;
    }

    // hg.c()V
    static release(): void {
        TerrainBatch.indices = null;
        TerrainBatch.blendIndices = null;
        TerrainBatch.indexBuffer = null;
        TerrainBatch.blendIndexBuffer = null;
    }

    // hg.b()V
    allocate(): void {
        this.vertexX = new Int32Array(this.vertexCapacity);
        this.vertexY = new Int32Array(this.vertexCapacity);
        this.vertexZ = new Int32Array(this.vertexCapacity);
        if (this.extra) this.extraCoords = new Float32Array(this.vertexCapacity);
        this.colours = new Int32Array(this.vertexCapacity);
        this.normalX = new Float32Array(this.vertexCapacity);
        this.normalY = new Float32Array(this.vertexCapacity);
        this.normalZ = new Float32Array(this.vertexCapacity);
        this.tileX = new Int32Array(this.tileCapacity);
        this.tileZ = new Int32Array(this.tileCapacity);
        this.tileLevel = new Int32Array(this.tileCapacity);
        this.polygons = new Array(this.tileCapacity).fill(null);
        this.seams = new HashTable(bitCeil(this.vertexCapacity), true);
        if (this.blend) {
            this.blendTriangles = new Array(this.tileCapacity).fill(null);
            this.blendPolygon = new Array(this.tileCapacity).fill(false);
        }
    }

    // hg.a(IIIFFFIF)I
    addVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, colour: number, extraCoord: number): number {
        let key = 0n;
        const low = (x + (z << 16)) | 0;
        if ((x & 127) === 0 || (z & 127) === 0) {
            key = longFromSignedWords(colour, low);
            const seam = requireNonNull(this.seams).get(key, low);
            if (seam !== null) {
                if (!(seam instanceof IntNode)) throw new TypeError('ClassCastException: not an IntNode');
                if (y < arrayAtI32(this.vertexY, seam.value)) arrayPutI32(this.vertexY, seam.value, y);
                return seam.value;
            }
        }
        arrayPutI32(this.vertexX, this.vertexCount, x);
        arrayPutI32(this.vertexY, this.vertexCount, y);
        arrayPutI32(this.vertexZ, this.vertexCount, z);
        if (this.extra) arrayPutF32(this.extraCoords, this.vertexCount, extraCoord);
        arrayPutF32(this.normalX, this.vertexCount, nx);
        arrayPutF32(this.normalY, this.vertexCount, ny);
        arrayPutF32(this.normalZ, this.vertexCount, nz);
        arrayPutI32(this.colours, this.vertexCount, colour);
        if (key !== 0n) requireNonNull(this.seams).put(new IntNode(this.vertexCount), key, low);
        return this.vertexCount++;
    }

    // hg.a(III[I[IZ)I
    addTile(level: number, x: number, z: number, polygon: Int32Array | null, blendTriangles: Int32Array | null, blend: boolean): number {
        if (this.blend) {
            arrayPutObj(this.blendTriangles, this.tileCount, blendTriangles);
            arrayPutObj(this.blendPolygon, this.tileCount, blend);
            if (blendTriangles !== null) this.blendIndexCount = (this.blendIndexCount + blendTriangles.length) | 0;
            if (blend) this.blendIndexCount = (this.blendIndexCount + Math.imul(3, requireNonNull(polygon).length - 2)) | 0;
            else this.indexCount = (this.indexCount + Math.imul(3, requireNonNull(polygon).length - 2)) | 0;
        } else {
            this.indexCount = (this.indexCount + Math.imul(3, requireNonNull(polygon).length - 2)) | 0;
        }
        arrayPutI32(this.tileLevel, this.tileCount, level);
        arrayPutI32(this.tileX, this.tileCount, x);
        arrayPutI32(this.tileZ, this.tileCount, z);
        arrayPutObj(this.polygons, this.tileCount, polygon);
        return this.tileCount++;
    }

    // hg.d()V
    upload(): void {
        const bytes = new PacketT(Math.imul(this.extra ? 40 : 36, this.vertexCount));
        for (let i = 0; i < this.vertexCount; i++) {
            if (GlRenderer.bigEndian) {
                bytes.pFloat(arrayAtI32(this.vertexX, i));
                bytes.pFloat(arrayAtI32(this.vertexY, i));
                bytes.pFloat(arrayAtI32(this.vertexZ, i));
                bytes.p4(arrayAtI32(this.colours, i));
                bytes.pFloat(arrayAtF32(this.normalX, i));
                bytes.pFloat(arrayAtF32(this.normalY, i));
                bytes.pFloat(arrayAtF32(this.normalZ, i));
                bytes.pFloat(Math.fround(Math.fround(arrayAtI32(this.vertexX, i)) / this.scale));
                bytes.pFloat(Math.fround(Math.fround(arrayAtI32(this.vertexZ, i)) / this.scale));
                if (this.extra) bytes.pFloat(arrayAtF32(this.extraCoords, i));
            } else {
                bytes.pFloatPlatformEndian(arrayAtI32(this.vertexX, i));
                bytes.pFloatPlatformEndian(arrayAtI32(this.vertexY, i));
                bytes.pFloatPlatformEndian(arrayAtI32(this.vertexZ, i));
                bytes.p4(arrayAtI32(this.colours, i));
                bytes.pFloatPlatformEndian(arrayAtF32(this.normalX, i));
                bytes.pFloatPlatformEndian(arrayAtF32(this.normalY, i));
                bytes.pFloatPlatformEndian(arrayAtF32(this.normalZ, i));
                bytes.pFloatPlatformEndian(Math.fround(Math.fround(arrayAtI32(this.vertexX, i)) / this.scale));
                bytes.pFloatPlatformEndian(Math.fround(Math.fround(arrayAtI32(this.vertexZ, i)) / this.scale));
                if (this.extra) bytes.pFloatPlatformEndian(arrayAtF32(this.extraCoords, i));
            }
        }
        if (GlRenderer.vboSupported) {
            const data = ByteBuffer.wrap(bytes.m_data, 0, bytes.m_pos);
            this.vbo = new GlBuffer();
            this.vbo.uploadArray(data);
        } else {
            this.vertexBuffer = ByteBuffer.allocateDirect(bytes.m_pos).order(ByteOrder.nativeOrder());
            this.vertexBuffer.put(bytes.m_data, 0, bytes.m_pos);
            this.vertexBuffer.flip();
        }
        this.vertexX = null;
        this.vertexY = null;
        this.vertexZ = null;
        this.colours = null;
        this.normalX = null;
        this.normalY = null;
        this.normalZ = null;
        this.seams = null;
        this.extraCoords = null;
    }

    // hg.a([[[Lbj;FZ)V
    draw(tiles: (Square | null)[][][] | null, depthBias: number, forceNoTexture: boolean): void {
        if (TerrainBatch.indices === null || requireNonNull(TerrainBatch.indices.m_data).length < Math.imul(this.indexCount, 4)) {
            TerrainBatch.indices = new PacketT(Math.imul(this.indexCount, 4));
        } else TerrainBatch.indices.m_pos = 0;
        if (TerrainBatch.blendIndices === null || requireNonNull(TerrainBatch.blendIndices.m_data).length < Math.imul(this.blendIndexCount, 4)) {
            TerrainBatch.blendIndices = new PacketT(Math.imul(this.blendIndexCount, 4));
        } else TerrainBatch.blendIndices.m_pos = 0;
        if (GlRenderer.bigEndian) {
            for (let tile = 0; tile < this.tileCount; tile++) {
                const square = arrayAtObj(arrayAtObj(arrayAtObj(tiles, arrayAtI32(this.tileLevel, tile)), arrayAtI32(this.tileX, tile)), arrayAtI32(this.tileZ, tile));
                if (square === null || !square.drawFront) continue;
                const polygon = arrayAtObj(this.polygons, tile);
                let indices: PacketT;
                if (this.blend) {
                    const more = arrayAtObj(this.blendTriangles, tile);
                    if (more !== null) {
                        for (let j = 0; j < more.length; j++) TerrainBatch.blendIndices.p4(arrayAtI32(more, j));
                    }
                    indices = arrayAtObj(this.blendPolygon, tile) ? TerrainBatch.blendIndices : TerrainBatch.indices;
                } else indices = TerrainBatch.indices;
                for (let j = 1; j < requireNonNull(polygon).length - 1; j++) {
                    indices.p4(arrayAtI32(polygon, 0));
                    indices.p4(arrayAtI32(polygon, j));
                    indices.p4(arrayAtI32(polygon, j + 1));
                }
            }
        } else {
            const opaqueWords = indexWords(TerrainBatch.indices);
            const blendWords = indexWords(TerrainBatch.blendIndices);
            const levels = this.tileLevel,
                xs = this.tileX,
                zs = this.tileZ;
            const haveCoords = levels && xs && zs && levels.length >= this.tileCount && xs.length >= this.tileCount && zs.length >= this.tileCount;
            for (let tile = 0; tile < this.tileCount; tile++) {
                // A null square is valid. A missing row or out-of-range coordinate
                // takes the checked path so it faults after the same index prefix.
                const entry = haveCoords ? tiles?.[levels[tile]]?.[xs[tile]]?.[zs[tile]] : undefined;
                const square = entry === undefined ? arrayAtObj(arrayAtObj(arrayAtObj(tiles, arrayAtI32(levels, tile)), arrayAtI32(xs, tile)), arrayAtI32(zs, tile)) : entry;
                if (square === null || !square.drawFront) continue;
                const polygon = arrayAtObj(this.polygons, tile);
                let indices: PacketT;
                if (this.blend) {
                    const more = arrayAtObj(this.blendTriangles, tile);
                    if (more !== null) {
                        const packet = TerrainBatch.blendIndices;
                        if (fitsIndices(blendWords, packet.m_pos, more.length)) {
                            let word = packet.m_pos >>> 2;
                            for (let j = 0; j < more.length; j++) blendWords[word++] = more[j];
                            packet.m_pos = word << 2;
                        } else {
                            for (let j = 0; j < more.length; j++) packet.p4PlatformEndian(arrayAtI32(more, j));
                        }
                    }
                    indices = arrayAtObj(this.blendPolygon, tile) ? TerrainBatch.blendIndices : TerrainBatch.indices;
                } else indices = TerrainBatch.indices;
                const words = indices === TerrainBatch.indices ? opaqueWords : blendWords;
                if (polygon && polygon.length >= 3 && fitsIndices(words, indices.m_pos, 3 * (polygon.length - 2))) {
                    let word = indices.m_pos >>> 2;
                    const first = polygon[0];
                    for (let j = 1; j < polygon.length - 1; j++) {
                        words[word++] = first;
                        words[word++] = polygon[j];
                        words[word++] = polygon[j + 1];
                    }
                    indices.m_pos = word << 2;
                    continue;
                }
                // Preserve the exact failing byte, partial prefix and post-incremented cursor.
                for (let j = 1; j < requireNonNull(polygon).length - 1; j++) {
                    indices.p4PlatformEndian(arrayAtI32(polygon, 0));
                    indices.p4PlatformEndian(arrayAtI32(polygon, j));
                    indices.p4PlatformEndian(arrayAtI32(polygon, j + 1));
                }
            }
        }
        if (TerrainBatch.indices.m_pos === 0 && TerrainBatch.blendIndices.m_pos === 0) return;
        const gl = GlRenderer.gl;
        if (this.texture === -1 || forceNoTexture) {
            GlRenderer.bindTexture2D(-1);
            MaterialManager.setMaterial(0, 0);
        } else {
            (requireNonNull(Pix3D.textureProvider) as HdTextureProvider).bindTexture(this.texture, true);
        }
        const stride = this.extra ? 40 : 36;
        if (this.vbo !== null) {
            this.vbo.bindArray();
            requireNonNull(gl).glVertexPointer(3, GL.GL_FLOAT, stride, 0n);
            requireNonNull(gl).glColorPointer(4, GL.GL_UNSIGNED_BYTE, stride, 12n);
            if (Preferences.graphics.highDetailLighting) requireNonNull(gl).glNormalPointer(GL.GL_FLOAT, stride, 16n);
            requireNonNull(gl).glTexCoordPointer(2, GL.GL_FLOAT, stride, 28n);
            if (this.extra) {
                requireNonNull(gl).glClientActiveTexture(UnderwaterMaterial.rampUnit());
                requireNonNull(gl).glTexCoordPointer(1, GL.GL_FLOAT, stride, 36n);
                requireNonNull(gl).glClientActiveTexture(GL.GL_TEXTURE0);
            }
        } else {
            if (GlRenderer.vboSupported) requireNonNull(gl).glBindBufferARB(GL.GL_ARRAY_BUFFER, 0);
            requireNonNull(this.vertexBuffer).position(0);
            requireNonNull(gl).glVertexPointer(3, GL.GL_FLOAT, stride, this.vertexBuffer);
            requireNonNull(this.vertexBuffer).position(12);
            requireNonNull(gl).glColorPointer(4, GL.GL_UNSIGNED_BYTE, stride, this.vertexBuffer);
            if (Preferences.graphics.highDetailLighting) {
                requireNonNull(this.vertexBuffer).position(16);
                requireNonNull(gl).glNormalPointer(GL.GL_FLOAT, stride, this.vertexBuffer);
            }
            requireNonNull(this.vertexBuffer).position(28);
            requireNonNull(gl).glTexCoordPointer(2, GL.GL_FLOAT, stride, this.vertexBuffer);
            if (this.extra) {
                requireNonNull(gl).glClientActiveTexture(UnderwaterMaterial.rampUnit());
                requireNonNull(this.vertexBuffer).position(36);
                requireNonNull(gl).glTexCoordPointer(1, GL.GL_FLOAT, stride, this.vertexBuffer);
                requireNonNull(gl).glClientActiveTexture(GL.GL_TEXTURE0);
            }
        }
        if (GlRenderer.vboSupported) requireNonNull(gl).glBindBufferARB(GL.GL_ELEMENT_ARRAY_BUFFER, 0);
        if (TerrainBatch.indices.m_pos !== 0) {
            if (TerrainBatch.indexBuffer === null || TerrainBatch.indexBuffer.capacity() < TerrainBatch.indices.m_pos) {
                TerrainBatch.indexBuffer = ByteBuffer.allocateDirect(TerrainBatch.indices.m_pos).order(ByteOrder.nativeOrder());
            } else TerrainBatch.indexBuffer.clear();
            TerrainBatch.indexBuffer.put(TerrainBatch.indices.m_data, 0, TerrainBatch.indices.m_pos);
            TerrainBatch.indexBuffer.flip();
            GlRenderer.setLevelDepthBias(depthBias);
            requireNonNull(gl).glDrawElements(GL.GL_TRIANGLES, (TerrainBatch.indices.m_pos / 4) | 0, GL.GL_UNSIGNED_INT, TerrainBatch.indexBuffer);
        }
        if (TerrainBatch.blendIndices.m_pos !== 0) {
            if (TerrainBatch.blendIndexBuffer === null || TerrainBatch.blendIndexBuffer.capacity() < TerrainBatch.blendIndices.m_pos) {
                TerrainBatch.blendIndexBuffer = ByteBuffer.allocateDirect(TerrainBatch.blendIndices.m_pos).order(ByteOrder.nativeOrder());
            } else TerrainBatch.blendIndexBuffer.clear();
            TerrainBatch.blendIndexBuffer.put(TerrainBatch.blendIndices.m_data, 0, TerrainBatch.blendIndices.m_pos);
            TerrainBatch.blendIndexBuffer.flip();
            GlRenderer.setLevelDepthBias(Math.fround(depthBias - 100));
            GlRenderer.disableDepthWrite();
            requireNonNull(gl).glDrawElements(GL.GL_TRIANGLES, (TerrainBatch.blendIndices.m_pos / 4) | 0, GL.GL_UNSIGNED_INT, TerrainBatch.blendIndexBuffer);
            GlRenderer.enableDepthWrite();
        }
    }
}
