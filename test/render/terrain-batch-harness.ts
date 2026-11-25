import TerrainBatch from '#/dash3d/TerrainBatch.js';
import Square from '#/dash3d/Square.js';
import GlRenderer from '#/gl/GlRenderer.js';
import MaterialManager from '#/gl/material/MaterialManager.js';
import UnderwaterMaterial from '#/gl/material/UnderwaterMaterial.js';
import type { GL } from '#/jogl/GL.js';
import Preferences from '#/ui/Preferences.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';

// Mirrors the device boundary in HdGeometryOracle.java. All geometry, uploads, projection and
// tile selection are performed by the production TerrainBatch, GlBuffer and GlRenderer.
export function runTerrainBatch(row: [number, number, number, number, number, number, number, number, number, string]): string {
    const [path, big, aux, normals, blend, third, visible, perspective, repeats, fault] = row;
    const calls: string[] = [];
    const buffers = new Map<ByteBuffer, number>();
    let array = path === 0 ? '0' : '71';
    let element = path === 0 ? '0' : '83';
    let unit = 33984;
    let depth = true;
    const stop = Symbol();
    function record(name: string, value: string) {
        calls.push(value);
        if (name === fault) throw stop;
    }
    function pointer(buffer: ByteBuffer | bigint): string {
        if (typeof buffer === 'bigint') return 'offset:' + buffer;
        if (!buffers.has(buffer)) buffers.set(buffer, buffers.size);
        return ['buffer', buffers.get(buffer), buffer.position(), buffer.limit(), buffer.capacity(), buffer.isDirect() ? 'direct' : 'heap'].join(':');
    }
    function hex(buffer: ByteBuffer) {
        return Buffer.from(buffer.storageBytes().subarray(0, buffer.limit())).toString('hex');
    }
    function attribute(name: string, args: (bigint | number | ByteBuffer)[]) {
        const ptr = args.pop() as bigint | ByteBuffer;
        record(name, [name.slice(2, -7), ...args, array, unit, pointer(ptr)].join(' ') + (name === 'glVertexPointer' && ptr instanceof ByteBuffer ? ' ' + hex(ptr) : ''));
    }
    const gl: Partial<GL> = {
        glGenBuffersARB(n, names, offset) {
            if (names !== null) names[offset] = 9173;
            record('glGenBuffersARB', 'gen ' + n + ' ' + offset);
        },
        glBindBufferARB(target, id) {
            const name = id === 9173 ? 'V' : String(id);
            record('glBindBufferARB', 'bind ' + target + ' ' + name);
            if (target === 34962) array = name;
            else element = name;
        },
        glBufferDataARB(target, size, data, usage) {
            const bytes = data as ByteBuffer;
            record('glBufferDataARB', ['upload', target, size, usage, array, pointer(bytes), hex(bytes)].join(' '));
        },
        glClientActiveTexture(id) {
            record('glClientActiveTexture', 'unit ' + id);
            unit = id;
        },
        glVertexPointer(...args) {
            attribute('glVertexPointer', args as (bigint | number | ByteBuffer)[]);
        },
        glColorPointer(...args) {
            attribute('glColorPointer', args as (bigint | number | ByteBuffer)[]);
        },
        glNormalPointer(...args) {
            attribute('glNormalPointer', args as (bigint | number | ByteBuffer)[]);
        },
        glTexCoordPointer(...args) {
            attribute('glTexCoordPointer', args as (bigint | number | ByteBuffer)[]);
        },
        glDrawElements(mode, count, type, data) {
            const bytes = data as ByteBuffer;
            record('glDrawElements', ['draw', mode, count, type, element, depth, pointer(bytes), hex(bytes)].join(' '));
        },
        glDepthMask(mask) {
            record('glDepthMask', 'depth ' + mask);
            depth = mask;
        },
        glMatrixMode(mode) {
            record('glMatrixMode', 'matrix ' + mode);
        },
        glLoadMatrixf(matrix, offset) {
            const payload = Array.from(new Uint32Array((matrix as Float32Array).buffer), v => v.toString(16));
            record('glLoadMatrixf', 'load ' + offset + ' ' + payload.join(','));
        }
    };
    TerrainBatch.release();
    GlRenderer.gl = gl as GL;
    GlRenderer.vboSupported = path === 2;
    GlRenderer.bigEndian = big !== 0;
    Preferences.highDetailLighting = normals !== 0;
    UnderwaterMaterial['threeUnits'] = third !== 0;
    GlRenderer['ortho2d'] = perspective === 0;
    GlRenderer['boundTexture'] = -1;
    GlRenderer['depthBiasDistance'] = GlRenderer['depthBias'] = 0;
    GlRenderer['projectionZScale'] = -1.25;
    GlRenderer['projectionZOffset'] = -100;
    const matrix = new Float32Array(16);
    matrix[0] = 1.25;
    matrix[5] = 2;
    matrix[11] = -1;
    GlRenderer['projection'] = matrix;
    MaterialManager.current = 0;
    const batch = new TerrainBatch(-1, 32, blend !== 0, aux !== 0, 0);
    batch.vertexCapacity = 5;
    batch.tileCapacity = 2;
    batch.allocate();
    const ids = [
        batch.addVertex(0, 11, 0, 0.25, 0.5, -1, 0x10203040, 0.75),
        batch.addVertex(63, -8, 2, 1, 0, 0.25, 0x718293a4, -0.5),
        batch.addVertex(-3, 39, 67, -0.25, 2, 0.125, 0x55667788, 2.25),
        batch.addVertex(0, 23, 64, 0, -1.5, 1, 0xdeadbeef | 0, 1.25),
        batch.addVertex(0, -7, 0, 9, 9, 9, 0x10203040, 9),
        batch.addTile(0, 0, 0, Int32Array.of(0, 1, 2, 3), Int32Array.of(1, 3, 0), false),
        batch.addTile(0, 1, 0, Int32Array.of(0, 2, 1), null, true)
    ];
    const a = new Square(0, 0, 0),
        b = new Square(0, 1, 0);
    a.drawFront = (visible & 1) !== 0;
    b.drawFront = (visible & 2) !== 0;
    const tiles = [[[a], [(visible & 4) === 0 ? b : null]]];
    let status = 'ok';
    try {
        batch.upload();
        GlRenderer.vboSupported = path !== 0;
        for (let i = 0; i < repeats; i++) batch.draw(tiles, 8, true);
    } catch (error) {
        if (error !== stop) throw error;
        status = 'fault';
    }
    return [status, ids, batch.vertexCount, [array, element, unit, depth], calls.join(';')].join('|');
}
