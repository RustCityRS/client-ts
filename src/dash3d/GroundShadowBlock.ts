import GlCleaner from '#/gl/GlCleaner';
import GlRenderer from '#/gl/GlRenderer';
import GlBuffer from '#/gl/GlBuffer';
import PacketT from '#/io/PacketT';
import type Pix8 from '#/graphics/Pix8';
import ByteBuffer from '#/util/nio/ByteBuffer';
import ByteOrder from '#/util/nio/ByteOrder';
import { GL } from '#/jogl/GL';
import { arrayAtI32, arrayAtObj, arrayAtU8, arrayPutU8, requireNonNull } from '#/util/JavaArray';

// One in each nonzero byte. The masked addition cannot carry between byte lanes.
function coverageBytes(word: number): number {
    return ((((word & 0x7f7f7f7f) + 0x7f7f7f7f) | word) & 0x80808080) >>> 7;
}

// wm in runescape_gl.jar (HD only): one 8x8-tile block of the ground shadows (GroundShadows.blocks), drawn as a
// 128x128 GL_ALPHA texture over a quad mesh. NXT has no GL 1.x classes, so the name is descriptive (HD_PLAN.md 1.3).
//
// Map construction uploads one vertex and one element buffer per block in wm.a([[III)V.
export default class GroundShadowBlock {
    private static scratch: Uint8Array | null = new Uint8Array(16384); // wm.g

    // wm.a()V
    static unload(): void {
        GroundShadowBlock.scratch = null;
    }
    private elements: GlBuffer | null = null; // wm.a
    private elementBuffer: ByteBuffer | null = null; // wm.c
    private vertexBuffer: ByteBuffer | null = null; // wm.e
    private vertices: GlBuffer | null = null; // wm.f
    // wm.b:Z. The block's shadow bitmap may have changed: set by the constructor and by the scene's shadow updates,
    // cleared once the texture is re-uploaded.
    dirty = false;
    // wm.d:I. The GL texture name from glGenTextures.
    private textureId = 0;
    // wm.h:I. A hash of the bitmap's covered texels per row (wm.a(Lek;II)Z), -1 until the first upload; an upload
    // with an unchanged hash is skipped.
    private coverageHash = 0;

    // wm.a(Lek;II)Z
    updateTexture(bitmap: Pix8 | null, x: number, z: number): boolean {
        const pixels = requireNonNull(bitmap).pixels;
        const width = requireNonNull(bitmap).width;
        const start = (Math.imul(x, 128) + 1 + Math.imul((Math.imul(z, 128) + 1) | 0, width)) | 0;
        // The normal scene includes a one-texel border for wm's four neighbour reads.
        // For incomplete rasters the checked path retains the first fault and the written prefix.
        const bordered = pixels !== null && width >= 128 && start >= width && start + 128 * width + 127 < Math.min(pixels.length, 0x80000000);
        const words = bordered && ArrayBuffer.isView(pixels) ? new DataView(pixels.buffer, pixels.byteOffset, pixels.byteLength) : null;
        let offset = start;
        let hash = 0;
        for (let row = -128; row < 0; row++) {
            hash = ((hash << 8) - hash) | 0;
            if (words !== null) {
                // Each of the four byte lanes counts at most 32 values per row.
                let lanes = 0;
                const end = offset + 128;
                while (offset < end) {
                    lanes += coverageBytes(words.getUint32(offset, true));
                    offset += 4;
                }
                hash = (hash + (Math.imul(lanes, 0x01010101) >>> 24)) | 0;
            } else {
                for (let col = -128; col < 0; col++) {
                    if (arrayAtU8(pixels, offset++) !== 0) hash = (hash + 1) | 0;
                }
            }
            offset = (offset + width - 128) | 0;
        }
        if (hash === this.coverageHash) return false;
        this.coverageHash = hash;
        offset = start;
        let dest = 0;
        const scratch = GroundShadowBlock.scratch;
        const output = words !== null && scratch !== null && scratch.length >= 16384 && scratch.buffer !== words.buffer ? new DataView(scratch.buffer, scratch.byteOffset, scratch.byteLength) : null;
        for (let row = -128; row < 0; row++) {
            if (words !== null && output !== null) {
                const end = offset + 128;
                while (offset < end) {
                    const covered = coverageBytes(words.getUint32(offset, true));
                    let alpha = 0x44444444;
                    if (covered !== 0x01010101) {
                        const above = words.getUint32(offset - width, true);
                        const below = words.getUint32(offset + width, true);
                        const left = words.getUint32(offset - 1, true);
                        const right = words.getUint32(offset + 1, true);
                        if ((above | below | left | right) === 0) alpha = covered * 68;
                        else {
                            const mask = covered * 255;
                            const neighbours = coverageBytes(above) + coverageBytes(below) + coverageBytes(left) + coverageBytes(right);
                            alpha = (0x44444444 & mask) | ((neighbours * 17) & ~mask);
                        }
                    }
                    output.setUint32(dest, alpha, true);
                    offset += 4;
                    dest += 4;
                }
            } else
                for (let col = -128; col < 0; col++) {
                    if (arrayAtU8(pixels, offset) !== 0) {
                        arrayPutU8(GroundShadowBlock.scratch, dest++, 68);
                    } else {
                        let count = 0;
                        if (arrayAtU8(pixels, (offset - 1) | 0) !== 0) count++;
                        if (arrayAtU8(pixels, (offset + 1) | 0) !== 0) count++;
                        if (arrayAtU8(pixels, (offset - width) | 0) !== 0) count++;
                        if (arrayAtU8(pixels, (offset + width) | 0) !== 0) count++;
                        arrayPutU8(GroundShadowBlock.scratch, dest++, 17 * count);
                    }
                    offset = (offset + 1) | 0;
                }
            offset = (offset + width - 128) | 0;
        }
        const gl = GlRenderer.gl;
        const buffer = ByteBuffer.wrap(GroundShadowBlock.scratch);
        buffer.limit(16384);
        GlRenderer.bindTexture2D(this.textureId);
        requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_ALPHA, 128, 128, 0, GL.GL_ALPHA, GL.GL_UNSIGNED_BYTE, buffer);
        return true;
    }

    // wm.b()V
    draw(): void {
        const gl = GlRenderer.gl;
        GlRenderer.bindTexture2D(this.textureId);
        if (this.vertices !== null) {
            this.vertices.bindArray();
            requireNonNull(gl).glInterleavedArrays(GL.GL_T2F_V3F, 20, 0n);
            GlRenderer.normalArray = false;
        } else {
            if (GlRenderer.vboSupported) requireNonNull(gl).glBindBufferARB(GL.GL_ARRAY_BUFFER, 0);
            requireNonNull(gl).glInterleavedArrays(GL.GL_T2F_V3F, 20, this.vertexBuffer);
            GlRenderer.normalArray = false;
        }
        if (this.elements !== null) {
            this.elements.bindElements();
            requireNonNull(gl).glDrawElements(GL.GL_TRIANGLES, 384, GL.GL_UNSIGNED_INT, 0n);
        } else {
            if (GlRenderer.vboSupported) requireNonNull(gl).glBindBufferARB(GL.GL_ELEMENT_ARRAY_BUFFER, 0);
            requireNonNull(gl).glDrawElements(GL.GL_TRIANGLES, 384, GL.GL_UNSIGNED_INT, this.elementBuffer);
        }
    }

    // wm.a([[III)V, called for all 13x13 blocks at the end of gd.c.
    buildMesh(heights: Int32Array[] | null, baseX: number, baseZ: number): void {
        const vertices = new PacketT(1620);
        for (let z = 0; z <= 8; z++) {
            for (let x = 0; x <= 8; x++) {
                if (GlRenderer.bigEndian) {
                    vertices.pFloat(x / 8);
                    vertices.pFloat(z / 8);
                    vertices.pFloat(x * 128);
                    vertices.pFloat(arrayAtI32(arrayAtObj(heights, (baseX + x) | 0), (baseZ + z) | 0));
                    vertices.pFloat(z * 128);
                } else {
                    vertices.pFloatPlatformEndian(x / 8);
                    vertices.pFloatPlatformEndian(z / 8);
                    vertices.pFloatPlatformEndian(x * 128);
                    vertices.pFloatPlatformEndian(arrayAtI32(arrayAtObj(heights, (baseX + x) | 0), (baseZ + z) | 0));
                    vertices.pFloatPlatformEndian(z * 128);
                }
            }
        }
        if (GlRenderer.vboSupported) {
            const buffer = ByteBuffer.wrap(vertices.m_data, 0, vertices.m_pos);
            this.vertices = new GlBuffer();
            this.vertices.uploadArray(buffer);
        } else {
            this.vertexBuffer = ByteBuffer.allocateDirect(vertices.m_pos).order(ByteOrder.nativeOrder());
            this.vertexBuffer.put(vertices.m_data, 0, vertices.m_pos);
            this.vertexBuffer.flip();
        }
        const indices = new PacketT(1536);
        for (let z = 0; z < 8; z++) {
            for (let x = 0; x < 8; x++) {
                if (GlRenderer.bigEndian) {
                    indices.p4(x + (z + 1) * 9);
                    indices.p4(x + z * 9);
                    indices.p4(x + 1 + z * 9);
                    indices.p4(x + (z + 1) * 9);
                    indices.p4(x + 1 + z * 9);
                    indices.p4(x + 1 + (z + 1) * 9);
                } else {
                    indices.p4PlatformEndian(x + (z + 1) * 9);
                    indices.p4PlatformEndian(x + z * 9);
                    indices.p4PlatformEndian(x + 1 + z * 9);
                    indices.p4PlatformEndian(x + (z + 1) * 9);
                    indices.p4PlatformEndian(x + 1 + z * 9);
                    indices.p4PlatformEndian(x + 1 + (z + 1) * 9);
                }
            }
        }
        if (GlRenderer.vboSupported) {
            const buffer = ByteBuffer.wrap(indices.m_data, 0, indices.m_pos);
            this.elements = new GlBuffer();
            this.elements.uploadElements(buffer);
        } else {
            this.elementBuffer = ByteBuffer.allocateDirect(indices.m_pos).order(ByteOrder.nativeOrder());
            this.elementBuffer.put(indices.m_data, 0, indices.m_pos);
            this.elementBuffer.flip();
        }
    }

    // wm.<init>()V. Generates and binds the texture (counting its 128 * 128 bytes into the on-card texture total) and
    // sets linear filtering with edge clamping. tf.t is read once; a null GL throws at glGenTextures, as in Java.
    constructor() {
        this.dirty = true;
        this.coverageHash = -1;
        const var1 = GlRenderer.gl;
        const var2 = new Int32Array(1);
        requireNonNull(var1).glGenTextures(1, var2, 0);
        this.textureId = arrayAtI32(var2, 0);
        GlCleaner.textureMemory = (GlCleaner.textureMemory + 16384) | 0;
        GlRenderer.bindTexture2D(this.textureId);
        requireNonNull(var1).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
        requireNonNull(var1).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
        requireNonNull(var1).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE);
        requireNonNull(var1).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_WRAP_T, GL.GL_CLAMP_TO_EDGE);
    }
}
