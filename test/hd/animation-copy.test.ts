import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GlModel from '#/dash3d/GlModel.js';
import GlModelBounds from '#/dash3d/GlModelBounds.js';
import GlModelStream from '#/dash3d/GlModelStream.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function snapshot(model: GlModel): string {
    const arrays = [model.pointX, model.pointY, model.pointZ, model.faceAlpha, model.faceColour];
    return ' ' + [...arrays.map(a => (a === null ? '-' : '[' + a.join(',') + ']')), model.positionStream?.valid ?? '-', model.bounds?.valid ?? '-', model.colourStream?.valid ?? '-'].join(' ');
}

function outcome(call: () => void): string {
    try {
        call();
        return 'ok';
    } catch (e) {
        if (e instanceof TypeError) return 'null';
        if (e instanceof RangeError && e.message.startsWith('array index ')) return 'bounds:' + e.message.slice('array index '.length);
        throw e;
    }
}

function animate(opcode: number, mode: number): string {
    const model = new GlModel();
    const x = Int32Array.of(2147483647, -81203, 12),
        y = mode === 1 ? x : Int32Array.of(4, 91, 5);
    model.pointX = x;
    model.pointY = mode === 3 ? Int32Array.of(7) : y;
    model.pointZ = mode === 2 ? y : mode === 4 ? null : Int32Array.of(-5, -7, -2147483648);
    const labels = mode === 5 ? null : mode === 6 ? new Int32Array() : Int32Array.of(0, 1, mode === 7 ? -1 : 4, 0);
    const groups = [Int32Array.of(1, 0), mode === 8 ? null : Int32Array.of(2, mode === 9 ? -1 : 1)];
    model.labelVertices = mode === 10 ? null : groups;
    model.labelFaces = groups;
    model.faceAlpha = Uint8Array.of(-5, 127, -120);
    model.faceColour = Int16Array.of(-10, 8654, -32);
    model.colourStream = new GlModelStream();
    model.colourStream.valid = true;
    GlModel.pivotX = 32;
    GlModel.pivotY = -63;
    GlModel.pivotZ = 100;
    const result = outcome(() => model.Animate2(opcode, labels, 113, 77, 21, false));
    return ['a', opcode, mode, result].join(' ') + snapshot(model) + ' ' + [GlModel.pivotX, GlModel.pivotY, GlModel.pivotZ].join(' ');
}

function copy(mode: number, flags: number): string {
    const src = new GlModel();
    let dst = new GlModel(),
        storage = new GlModel();
    src.vertexCount = src.faceCount = mode === 15 ? 0 : 3;
    const x = Int32Array.of(9, 10, 11),
        y = Int32Array.of(20, 21, 22);
    src.pointX = mode === 1 ? Int32Array.of(1) : x;
    src.pointY = mode === 2 ? Int32Array.of(2) : mode === 3 ? null : y;
    src.pointZ = mode === 4 ? Int32Array.of(3) : Int32Array.of(31, 32, 33);
    dst.pointX = mode === 5 ? y : mode === 6 ? null : Int32Array.of(80, 80, 80);
    dst.pointY = mode === 7 ? Int32Array.of(70) : mode === 8 ? null : Int32Array.of(70, 70, 70);
    dst.pointZ = mode === 9 ? Int32Array.of(60) : mode === 5 ? x : Int32Array.of(60, 60, 60);
    src.faceAlpha = mode === 10 ? Uint8Array.of(-9) : mode === 11 ? null : Uint8Array.of(-48, 19, 30);
    src.faceColour = mode === 12 ? Int16Array.of(-32) : mode === 13 ? null : Int16Array.of(281, -182, 1528);
    storage.faceAlpha = Uint8Array.of(61, 62, 63);
    storage.faceColour = Int16Array.of(72, 73, 74);
    dst.positionStream = new GlModelStream();
    dst.positionStream.valid = true;
    dst.bounds = new GlModelBounds();
    dst.bounds.valid = true;
    if (mode === 16) dst = src;
    if (mode === 17) storage = src;
    const result = outcome(() => src['copyAnimation'](!!(flags & 1), !!(flags & 2), true, mode === 18 ? null : dst, mode === 14 ? null : storage));
    return ['c', mode, flags, result].join(' ') + snapshot(dst) + snapshot(src) + snapshot(storage) + ' ' + [dst.deferredUpdateMask, dst.vertexCount, dst.faceCount, dst.faceAlpha === src.faceAlpha, dst.faceColour === src.faceColour].join(' ');
}

loginFixture(
    import.meta.url,
    'HD labelled animations and model copies match td after every coordinate or face array fault',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-hd-animation-copy-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const build = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdAnimationCopyOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', cp, 'HdAnimationCopyOracle']);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const native = run.stdout.toString().trimEnd().split(/\r?\n/);
            const rows: string[] = [];
            for (const op of [0, 1, 2, 3, 5, 7]) for (let mode = 0; mode <= 10; mode++) rows.push(animate(op, mode));
            for (let mode = 0; mode <= 18; mode++) for (let flags = 0; flags < 4; flags++) rows.push(copy(mode, flags));
            expect(native.length).toBe(rows.length);
            for (let i = 0; i < rows.length; i++) expect(rows[i], native[i]).toBe(native[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
