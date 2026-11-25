import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import PacketT from '#/io/PacketT.js';
import { hdGamepackPath, joglPath } from './hd-reference.js';
import { runTerrainBatch } from './terrain-batch-harness.js';
import { loginFixture } from '../login-fixture.js';

// path 0 is the direct client array. Path 1 uploads without VBO capability and
// draws after VBO support is enabled; hg must explicitly unbind both buffer targets.
// Path 2 exercises the original vi allocator, upload and vertex pointer offsets.
type Row = [path: number, big: number, auxiliary: number, normals: number, secondary: number, thirdUnit: number, visible: number, perspective: number, repeats: number, fault: string];
function vectors(): Row[] {
    const rows: Row[] = [];
    for (const path of [0, 1, 2])
        for (const endian of [0, 1])
            for (const aux of [0, 1])
                for (const normals of [0, 1])
                    for (const secondary of [0, 1])
                        for (const third of [0, 1])
                            for (const visible of [0, 1, 2, 3, 5]) {
                                rows.push([path, endian, aux, normals, secondary, third, visible, (aux + normals + endian) & 1, 2, '-']);
                            }
    for (const path of [0, 1, 2])
        for (const visible of [1, 2, 3])
            for (const fault of [
                'glGenBuffersARB',
                'glBindBufferARB',
                'glBufferDataARB',
                'glVertexPointer',
                'glColorPointer',
                'glNormalPointer',
                'glTexCoordPointer',
                'glClientActiveTexture',
                'glMatrixMode',
                'glLoadMatrixf',
                'glDepthMask',
                'glDrawElements'
            ])
                rows.push([path, 0, 1, 1, 1, 1, visible, 1, 1, fault]);
    return rows;
}
function packedVertices(auxiliary: boolean, big: boolean): string {
    const stride = auxiliary ? 40 : 36;
    const bytes = Buffer.alloc(stride * 4);
    const packet = new PacketT(bytes);
    const putFloat = (value: number) => (big ? packet.pFloat(value) : packet.pFloatPlatformEndian(value));
    // The fifth input reuses the first seam's color and X/Z, keeping the lower height -7.
    const vertices = [
        [0, -7, 0, 0x10203040, 0.25, 0.5, -1, 0.75],
        [63, -8, 2, 0x718293a4, 1, 0, 0.25, -0.5],
        [-3, 39, 67, 0x55667788, -0.25, 2, 0.125, 2.25],
        [0, 23, 64, 0xdeadbeef, 0, -1.5, 1, 1.25]
    ];
    for (const [x, y, z, colour, nx, ny, nz, extra] of vertices) {
        putFloat(x);
        putFloat(y);
        putFloat(z);
        packet.p4(colour); // RGBA is byte-ordered independently of the float/index packing branch.
        putFloat(nx);
        putFloat(ny);
        putFloat(nz);
        putFloat(x / 32);
        putFloat(z / 32);
        if (auxiliary) putFloat(extra);
    }
    return bytes.toString('hex');
}
function packedIndices(indices: number[], big: boolean): string {
    const bytes = Buffer.alloc(indices.length * 4);
    const packet = new PacketT(bytes);
    for (const value of indices) {
        if (big) packet.p4(value);
        else packet.p4PlatformEndian(value);
    }
    return bytes.toString('hex');
}
function matrix(offset: number): string {
    const f = Math.fround,
        delta = f(offset * 1.5),
        ratio = f(3000 / f(delta + 3000)),
        one = f(1 - ratio);
    const matrix = new Float32Array(16);
    matrix[0] = 1.25;
    matrix[5] = 2;
    matrix[11] = -1;
    matrix[10] = f(-1.25 + f(f(f(100 * one) * one) / delta));
    matrix[14] = f(-100 * f(ratio * ratio));
    return Array.from(new Uint32Array(matrix.buffer), v => v.toString(16)).join(',');
}
function expected(row: Row): string {
    const [path, big, aux, normals, secondary, third, visible, perspective, repeats, fault] = row;
    let array = path === 0 ? '0' : '71',
        element = path === 0 ? '0' : '83',
        unit = 33984,
        depth = true,
        lastOffset: number | null = null;
    const trace: string[] = [],
        ids = new Map<string, number>();
    const stopped = Symbol();
    function emit(name: string, line: string) {
        trace.push(line);
        if (name === fault) throw stopped;
    }
    function bind(target: number, id: string) {
        emit('glBindBufferARB', 'bind ' + target + ' ' + id);
        if (target === 34962) array = id;
        else element = id;
    }
    function buffer(key: string, offset: number, size: number, kind: string) {
        if (!ids.has(key)) ids.set(key, ids.size);
        return 'buffer:' + ids.get(key) + ':' + offset + ':' + size + ':' + size + ':' + kind;
    }
    const stride = aux ? 40 : 36,
        byteLength = stride * 4;
    const payload = packedVertices(aux !== 0, big !== 0);
    function pointer(name: string, description: string, offset: number) {
        const address = path === 2 ? 'offset:' + offset : buffer('vertices', offset, byteLength, 'direct');
        const contents = name === 'Vertex' && path !== 2 ? ' ' + payload : '';
        emit('gl' + name + 'Pointer', name + ' ' + description + ' ' + stride + ' ' + array + ' ' + unit + ' ' + address + contents);
    }
    function project(offset: number) {
        if (!perspective || offset === lastOffset) return;
        lastOffset = offset;
        emit('glMatrixMode', 'matrix 5889');
        emit('glLoadMatrixf', 'load 0 ' + matrix(offset));
        emit('glMatrixMode', 'matrix 5888');
    }
    function indices(key: string, values: number[]) {
        emit('glDrawElements', 'draw 4 ' + values.length + ' 5125 ' + element + ' ' + depth + ' ' + buffer(key, 0, values.length * 4, 'direct') + ' ' + packedIndices(values, big !== 0));
    }
    function depthMask(value: boolean) {
        emit('glDepthMask', 'depth ' + value);
        depth = value;
    }
    let status = 'ok';
    try {
        if (path === 2) {
            emit('glGenBuffersARB', 'gen 1 0');
            bind(34962, 'V');
            emit('glBufferDataARB', 'upload 34962 ' + byteLength + ' 35044 ' + array + ' ' + buffer('upload', 0, byteLength, 'heap') + ' ' + payload);
        }
        for (let i = 0; i < repeats; i++) {
            const primary: number[] = [],
                extra: number[] = [];
            if (visible & 1) {
                primary.push(0, 1, 2, 0, 2, 3);
                if (secondary) extra.push(1, 3, 0);
            }
            if (visible & 2 && !(visible & 4)) (secondary ? extra : primary).push(0, 2, 1);
            if (!primary.length && !extra.length) continue;
            if (path !== 0) bind(34962, path === 2 ? 'V' : '0');
            pointer('Vertex', '3 5126', 0);
            pointer('Color', '4 5121', 12);
            if (normals) pointer('Normal', '5126', 16);
            pointer('TexCoord', '2 5126', 28);
            if (aux) {
                const next = third ? 33986 : 33985;
                emit('glClientActiveTexture', 'unit ' + next);
                unit = next;
                pointer('TexCoord', '1 5126', 36);
                emit('glClientActiveTexture', 'unit 33984');
                unit = 33984;
            }
            if (path !== 0) bind(34963, '0');
            if (primary.length) {
                project(8);
                indices('main', primary);
            }
            if (extra.length) {
                project(-92);
                depthMask(false);
                indices('extra', extra);
                depthMask(true);
            }
        }
    } catch (e) {
        if (e !== stopped) throw e;
        status = 'fault';
    }
    return [status, '0,1,2,3,0,0,1', 4, [array, element, unit, depth].join(','), trace.join(';')].join('|');
}

loginFixture(
    import.meta.url,
    'original HD JOGL terrain draws match generated geometry bytes, index fans, pointer layouts and render state',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-geometry-'));
        try {
            const cp = hdGamepackPath + delimiter + joglPath;
            const compile = Bun.spawnSync(['javac', join(import.meta.dir, '../hd/GlRecorder.java'), '-cp', cp, '-d', dir, join(import.meta.dir, 'HdGeometryOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const rows = vectors();
            const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + cp, 'HdGeometryOracle'], {
                stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                maxBuffer: 12 * 1024 * 1024,
                timeout: 25000
            });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const lines = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) {
                expect(lines[i], row.join(' ')).toBe(expected(row));
                expect(runTerrainBatch(row), row.join(' ')).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
