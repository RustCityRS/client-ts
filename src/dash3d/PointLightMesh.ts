import GlBuffer from '#/gl/GlBuffer';
import GlRenderer from '#/gl/GlRenderer';
import { GL } from '#/jogl/GL';
import { arrayAtI32, arrayAtU8, arrayPutI32, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import PacketT from '#/io/PacketT';
import HashTable from '#/datastruct/HashTable';
import IntNode from '#/datastruct/IntNode';
import { bitCeil } from '#/util/IntUtils';
import type StaticPointLight from './StaticPointLight';

// HD fj. Geometry and indices for a single light's additive glow on the terrain.
export default class PointLightMesh {
    private vertices: GlBuffer | null = null; // fj.a
    private elements: GlBuffer | null = null; // fj.e
    private vertexBuffer: ByteBuffer | null = null; // fj.f
    private elementBuffer: ByteBuffer | null = null; // fj.k
    indexCount = 0; // fj.n
    indexCapacity = 0; // fj.j
    vertexCount = 0; // fj.l
    vertexCapacity = 0; // fj.p
    private indices: Int32Array | null = null; // fj.b
    private green: Uint8Array | null = null; // fj.c
    private xs: Int32Array | null = null; // fj.d
    private zs: Int32Array | null = null; // fj.g
    private ys: Int32Array | null = null; // fj.h
    private blue: Uint8Array | null = null; // fj.i
    private red: Uint8Array | null = null; // fj.m
    private seams: HashTable<IntNode> | null = null; // fj.o

    // fj.a(Lgi;IIIFFF)I
    addVertex(light: StaticPointLight, x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
        let key = 0n;
        if ((x & 127) === 0 || (z & 127) === 0) {
            key = BigInt((x + (z << 16)) | 0);
            const cached = requireNonNull(this.seams).get(key);
            if (cached !== null) {
                if (!(cached instanceof IntNode)) throw new TypeError('ClassCastException: not an IntNode');
                return cached.value;
            }
        }
        const rgb = light.m_rGB;
        const f = Math.fround;
        let dx = f((light.x - x) | 0);
        let dy = f((light.y - y) | 0);
        let dz = f((light.z - z) | 0);
        const distance = f(Math.sqrt(f(f(f(dx * dx) + f(dy * dy)) + f(dz * dz))));
        const inv = f(1 / distance);
        dx = f(dx * inv);
        dy = f(dy * inv);
        dz = f(dz * inv);
        const ratio = f(distance / f(((light.m_radius << 7) + 64) | 0));
        let falloff = f(1 - f(ratio * ratio));
        if (falloff < 0) falloff = 0;
        let dot = f(f(f(dx * nx) + f(dy * ny)) + f(dz * nz));
        if (dot < 0) dot = 0;
        let scale = f(f(dot * falloff) * 2);
        if (scale > 1) scale = 1;
        let r = f(scale * ((rgb >> 16) & 255)) | 0;
        if (r > 255) r = 255;
        let g = f(scale * ((rgb >> 8) & 255)) | 0;
        if (g > 255) g = 255;
        let b = f(scale * (rgb & 255)) | 0;
        if (b > 255) b = 255;
        arrayPutU8(this.red, this.vertexCount, r);
        arrayPutU8(this.green, this.vertexCount, g);
        arrayPutU8(this.blue, this.vertexCount, b);
        arrayPutI32(this.xs, this.vertexCount, x);
        arrayPutI32(this.ys, this.vertexCount, y);
        arrayPutI32(this.zs, this.vertexCount, z);
        requireNonNull(this.seams).put(new IntNode(this.vertexCount), key);
        return this.vertexCount++;
    }

    // fj.a()V
    upload(): void {
        const idx = new PacketT(Math.imul(this.indexCount, 4));
        const vtx = new PacketT(Math.imul(this.vertexCount, 16));
        if (GlRenderer.bigEndian) {
            for (let i = 0; i < this.vertexCount; i++) {
                vtx.p1(arrayAtU8(this.red, i));
                vtx.p1(arrayAtU8(this.green, i));
                vtx.p1(arrayAtU8(this.blue, i));
                vtx.p1(255);
                vtx.pFloat(arrayAtI32(this.xs, i));
                vtx.pFloat(arrayAtI32(this.ys, i));
                vtx.pFloat(arrayAtI32(this.zs, i));
            }
            for (let i = 0; i < this.indexCount; i++) idx.p4(arrayAtI32(this.indices, i));
        } else {
            for (let i = 0; i < this.vertexCount; i++) {
                vtx.p1(arrayAtU8(this.red, i));
                vtx.p1(arrayAtU8(this.green, i));
                vtx.p1(arrayAtU8(this.blue, i));
                vtx.p1(255);
                vtx.pFloatPlatformEndian(arrayAtI32(this.xs, i));
                vtx.pFloatPlatformEndian(arrayAtI32(this.ys, i));
                vtx.pFloatPlatformEndian(arrayAtI32(this.zs, i));
            }
            for (let i = 0; i < this.indexCount; i++) idx.p4PlatformEndian(arrayAtI32(this.indices, i));
        }
        if (GlRenderer.vboSupported) {
            this.vertices = new GlBuffer();
            let data = ByteBuffer.wrap(vtx.m_data);
            this.vertices.uploadArray(data);
            this.elements = new GlBuffer();
            data = ByteBuffer.wrap(idx.m_data);
            this.elements.uploadElements(data);
        } else {
            this.vertexBuffer = ByteBuffer.allocateDirect(vtx.m_pos);
            this.vertexBuffer.put(vtx.m_data);
            this.vertexBuffer.flip();
            this.elementBuffer = ByteBuffer.allocateDirect(idx.m_pos);
            this.elementBuffer.put(idx.m_data);
            this.elementBuffer.flip();
        }
        this.xs = null;
        this.ys = null;
        this.zs = null;
        this.red = null;
        this.green = null;
        this.blue = null;
        this.indices = null;
        this.seams = null;
    }

    // fj.b()V
    allocate(): void {
        this.indices = new Int32Array(this.indexCapacity);
        this.xs = new Int32Array(this.vertexCapacity);
        this.ys = new Int32Array(this.vertexCapacity);
        this.zs = new Int32Array(this.vertexCapacity);
        this.red = new Uint8Array(this.vertexCapacity);
        this.green = new Uint8Array(this.vertexCapacity);
        this.blue = new Uint8Array(this.vertexCapacity);
        this.seams = new HashTable(bitCeil(this.vertexCapacity));
    }

    // fj.a([I)V
    addPolygon(polygon: Int32Array): void {
        for (let i = 1; i < polygon.length - 1; i++) {
            arrayPutI32(this.indices, this.indexCount++, arrayAtI32(polygon, 0));
            arrayPutI32(this.indices, this.indexCount++, arrayAtI32(polygon, i));
            arrayPutI32(this.indices, this.indexCount++, arrayAtI32(polygon, i + 1));
        }
    }

    // fj.c()V
    draw(): void {
        const gl = GlRenderer.gl;
        if (GlRenderer.vboSupported) {
            requireNonNull(this.vertices).bindArray();
            requireNonNull(gl).glInterleavedArrays(GL.GL_C4UB_V3F, 16, 0n);
            GlRenderer.normalArray = false;
            requireNonNull(this.elements).bindElements();
            requireNonNull(gl).glDrawElements(GL.GL_TRIANGLES, this.indexCount, GL.GL_UNSIGNED_INT, 0n);
        } else {
            if (GlRenderer.vboSupported) {
                requireNonNull(gl).glBindBufferARB(GL.GL_ARRAY_BUFFER, 0);
                requireNonNull(gl).glBindBufferARB(GL.GL_ELEMENT_ARRAY_BUFFER, 0);
            }
            requireNonNull(gl).glInterleavedArrays(GL.GL_C4UB_V3F, 16, this.vertexBuffer);
            GlRenderer.normalArray = false;
            requireNonNull(gl).glDrawElements(GL.GL_TRIANGLES, this.indexCount, GL.GL_UNSIGNED_INT, this.elementBuffer);
        }
    }
}
