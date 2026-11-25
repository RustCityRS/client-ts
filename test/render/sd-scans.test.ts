import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { captureSdFrame } from '#/dash3d/SdWorldRaster.js';
import Pix2D from '#/graphics/Pix2D.js';
import Pix3D from '#/dash3d/Pix3D.js';
import SdRasterSpans from '#/dash3d/SdRasterSpans.js';
import { gamepackPath } from '../reference.js';
import { renderSdFrames } from './sd-device.js';

function wire(data: ArrayLike<number>): Buffer {
    const result = Buffer.alloc(4 + data.length * 4);
    result.writeInt32BE(data.length, 0);
    for (let i = 0; i < data.length; i++) result.writeInt32BE(data[i], 4 + 4 * i);
    return result;
}

test('SD GPU scanlines match dc blended neighbours, palette groups and signed perspective samples', async () => {
    const dir = mkdtempSync(join(tmpdir(), '530-sd-spans-'));
    const width = 37,
        height = 160;
    const pixels = Int32Array.from({ length: width * height }, (_, i) => Math.imul(i + 1, 0x87654321));
    const palette = Int32Array.from({ length: 65536 }, (_, i) => Math.imul(i, -173725393));
    const source = (size: number): Int32Array =>
        Int32Array.from({ length: size }, (_, i) => {
            if (i % 5 === 0) return 0;
            if (i % 7 === 0) return 0x7f000000;
            return Math.imul(i + 1, 0x92183573);
        });
    const small = source(4096),
        large = source(16384);
    const ops: number[][] = [];
    const flat = (alpha: number, start: number, x0: number, x1: number, rgb: number): void => {
        ops.push([0, width, 0, alpha, 0, start, x0, x1, rgb, 0, 0, 0, 0, 0, 0, 0, 0]);
    };
    flat(0, width, 0, 3, 0x805901ab | 0);
    flat(254, 0, 2, width, 0); // Last pixel reads the modified first pixel of row 1.
    flat(0, width, 0, 3, 0x41ee00aa); // Contains the next-row write after the read as well.
    ops.push([1, width, 0, 0, 1, 0, 0, 17, 2 << 8, 0x40000000, 0, 0, 0, 0, 0, 0, 0]);
    for (const alpha of [0, 1, 128, 254, 255]) {
        for (const flags of [0, 1]) {
            const row = ops.length * width;
            ops.push([1, 31, 1, alpha, flags, row + 3, -6, 40, 2290345, -987, 0, 0, 0, 0, 0, 0, 0]);
            flat(alpha, row + width, 5, 23, 0xb71934fe | 0);
        }
    }
    for (const kind of [2, 3])
        for (const flags of [0, 1, 2, 3]) {
            for (const length of [1, 7, 8, 9, 28])
                for (const zero of [false, true]) {
                    const row = ops.length * width;
                    ops.push([kind, length + 3, 1, 254, flags, row + 3, -3, length, 0xff67, -1928, 12, 0x71112233, -1953423432, zero ? 0 : 0x123456, -20173221, 912121, zero ? 0 : -0x5192]);
                }
        }
    const state = [Pix3D.width, Pix3D.hclip, Pix3D.trans, Pix3D.lowDetail, Pix3D['lowMemTexture'], Pix3D['opaque'], Pix3D.originX, Pix3D.colourTable, Pix3D.spanTarget] as const;
    try {
        const input = join(dir, 'dc.bin'),
            count = Buffer.alloc(4);
        count.writeInt32BE(ops.length);
        writeFileSync(input, Buffer.concat([wire(pixels), wire(palette), wire(small), wire(large), count, ...ops.map(wire)]));
        const oracle = Bun.spawnSync(['java', '-cp', gamepackPath, join(import.meta.dir, 'SdScanlineOracle.java'), input]);
        expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
        const frame = new SdRasterSpans(pixels, width, height);
        Pix3D.spanTarget = frame;
        Pix3D.colourTable = palette;
        for (const [kind, clipWidth, clip, alpha, flags, row, x0, x1, colour, step, origin, u, v, w, du, dv, dw] of ops) {
            Pix3D.width = clipWidth;
            Pix3D.hclip = clip !== 0;
            Pix3D.trans = alpha;
            Pix3D.lowDetail = Pix3D['lowMemTexture'] = (flags & 1) !== 0;
            Pix3D['opaque'] = (flags & 2) !== 0;
            Pix3D.originX = origin;
            switch (kind) {
                case 0:
                    Pix3D['flatRaster'](pixels, row, colour, 0, x0, x1);
                    break;
                case 1:
                    Pix3D['gouraudRaster'](pixels, row, 0, 0, x0, x1, colour, step);
                    break;
                default:
                    Pix3D[kind === 2 ? 'terrainTextureRaster' : 'textureRaster'](pixels, flags & 1 ? small : large, 0, 0, row, x0, x1, colour, step, u, v, w, du, dv, dw);
            }
        }
        const recorded = frame.finish();
        expect(recorded.batches.length).toBeGreaterThanOrEqual(3);
        const [output] = await renderSdFrames(dir, [recorded]);
        expect(wire(output).subarray(4).equals(oracle.stdout)).toBe(true);
    } finally {
        [Pix3D.width, Pix3D.hclip, Pix3D.trans, Pix3D.lowDetail, Pix3D['lowMemTexture'], Pix3D['opaque'], Pix3D.originX, Pix3D.colourTable, Pix3D.spanTarget] = state;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);

test('SD GPU world passes detect interleaved CPU framebuffer writes and insufficient source data', () => {
    const pixels = new Int32Array(9);
    const mixed = new SdRasterSpans(pixels, 3, 3);
    pixels[4] = 1;
    expect(() => mixed.finish()).toThrow('CPU framebuffer write');
    const invalid = new SdRasterSpans(pixels, 3, 3);
    expect(invalid.record(pixels, 2, 0, 0, 3, 0, 0, 0, 0, new Int32Array(4096))).toBe(false);
    expect(() => invalid.finish()).toThrow('incomplete source');
});

test('resident Gouraud runs cross compact destination and count boundaries on the device', async () => {
    const dir = mkdtempSync(join(tmpdir(), '530-sd-gouraud-'));
    const width = 4096,
        height = 257,
        pixels = new Int32Array(width * height);
    const expected = pixels.slice(),
        palette = Int32Array.of(113, 225, -17, 45);
    const spans = new SdRasterSpans(pixels, width, height, true),
        target = spans.guardedTarget;
    try {
        for (const [first, count, colour] of [
            [0, 1, 1],
            [0, 2047, 2],
            [512, 2048, 3],
            [4096 * 255, 2047, 0],
            [0xfffff, 1, 1],
            [0x100000, 1, 2],
            [0x100000, 2048, 3]
        ]) {
            expect(spans.gouraud(target, first, 0, count, colour << 8, 0, 0, 1, palette)).toBe(true);
            expected.fill(palette[colour], first, first + count);
            // A glyph run can follow either descriptor and then merge with its next pixel.
            const pixel = first + (count > 1 ? count - 2 : 0);
            spans.paintPixel(target, pixel, 73);
            expected[pixel] = 73;
            if (pixel + 1 < first + count) {
                spans.paintPixel(target, pixel + 1, 73);
                expected[pixel + 1] = 73;
            }
        }
        // The first four pixels take palette[1], and the remaining group takes palette[2].
        spans.gouraud(target, 2 * width, 0, 8, 256, 64, 0, 1, palette);
        expected.fill(palette[1], 2 * width, 2 * width + 4);
        expected.fill(palette[2], 2 * width + 4, 2 * width + 8);
        const [output] = await renderSdFrames(dir, [spans.finish()]);
        expect(Buffer.from(output.buffer).equals(Buffer.from(expected.buffer))).toBe(true);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);

test('SD capture rejects unsupported writes even when a blitter swallows an exception or preserves the CPU colour', () => {
    const state = [Pix2D.pixels, Pix2D.width, Pix2D.height] as const;
    const pixels = new Int32Array(8);
    try {
        Pix2D.pixels = pixels;
        Pix2D.width = 4;
        Pix2D.height = 2;
        expect(() =>
            captureSdFrame(() => {
                const buffer = Pix2D.pixels;
                if (buffer === null) throw new Error('missing framebuffer');
                try {
                    buffer[1] = 0;
                } catch {
                    // The capture must report the write even when its callback catches the error.
                }
            })
        ).toThrow('Unsupported CPU framebuffer access');
        expect(Pix2D.pixels === pixels).toBe(true);
        expect(Pix3D.spanTarget).toBeNull();
        expect(() =>
            captureSdFrame(() => {
                Pix2D.pixels?.slice();
            })
        ).toThrow('Unsupported CPU framebuffer access');
        expect(Pix2D.pixels === pixels).toBe(true);
    } finally {
        [Pix2D.pixels, Pix2D.width, Pix2D.height] = state;
    }
});

test('device-owned SD frames retain untouched words and upload changed palette entries across redraws', async () => {
    const dir = mkdtempSync(join(tmpdir(), '530-sd-retention-')),
        width = 37,
        height = 12;
    const { pixels, width: previousWidth, height: previousHeight, clipMinX, clipMinY, clipMaxX, clipMaxY, maskOffsets, maskLengths } = Pix2D;
    try {
        const backing = Int32Array.from({ length: width * height }, (_, i) => Math.imul(i, -73031993));
        Pix2D.setPixels(backing, width, height);
        const first = captureSdFrame(() => Pix2D.fillRect(2, 1, 19, 5, 0xff703e));
        const second = captureSdFrame(() => Pix2D.fillRectTrans(6, 4, 12, 3, 0x17394e, 149));
        const frames = await renderSdFrames(dir, [first, second], true);
        Pix2D.fillRect(2, 1, 19, 5, 0xff703e);
        expect(Array.from(frames[0])).toEqual(Array.from(backing));
        Pix2D.fillRectTrans(6, 4, 12, 3, 0x17394e, 149);
        expect(Array.from(frames[1])).toEqual(Array.from(backing));
    } finally {
        Object.assign(Pix2D, { pixels, width: previousWidth, height: previousHeight, clipMinX, clipMinY, clipMaxX, clipMaxY, maskOffsets, maskLengths });
        rmSync(dir, { recursive: true, force: true });
    }
});
