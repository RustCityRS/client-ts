import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderSdFrames } from './sd-device.js';
import SdRasterSpans from '#/dash3d/SdRasterSpans.js';

test('an ordinary projected dc triangle records the nine exact arguments once across all covered row bands', () => {
    const width = 50,
        height = 32;
    const backing = new Int32Array(width * height + 1);
    const spans = new SdRasterSpans(backing, width, height, true);
    const scanline = Int32Array.from({ length: height }, (_, y) => y * width + 3);
    const palette = new Int32Array(65536);
    const submit = (start: number, x: number, colour: number, rows: Int32Array | null) => spans.projectedGouraud(spans.guardedTarget, width, rows, height, 41, true, 173, palette, start, 11, 27, x, 33, 14, 32100, colour, 32102);
    // Invalid metadata and unbounded colour gradients take the checked native path.
    expect(submit(2, 5, 32101, null)).toBe(false);
    expect(submit(2, 32768, 32101, scanline)).toBe(false);
    expect(submit(2, 5, -1, scanline)).toBe(false);
    expect(submit(-3, 5, 32101, scanline)).toBe(true);
    const frame = spans.finish();
    expect(frame.batches.length).toBe(1);
    const commands = frame.batches[0];
    const references = commands.subarray(commands[height + 2], commands[height + 6]);
    expect(references.length).toBe(4);
    expect(new Set(references).size).toBe(1);
    const record = references[0];
    expect(Array.from(commands.subarray(record, record + 8))).toEqual([~3, (11 << 16) | 65533, (5 << 16) | 27, (14 << 16) | 33, (32101 << 16) | 32100, (height << 16) | 32102, (1 << 24) | (173 << 16) | 41, 0]);
});

test('a projected triangle separates consecutive paintPixel writes on the same row', async () => {
    const dir = mkdtempSync(join(tmpdir(), '530-sd-pixel-order-'));
    try {
        const backing = new Int32Array(64);
        const capture = new SdRasterSpans(backing, 8, 8, true);
        const target = capture.guardedTarget;
        capture.paintPixel(target, 8, 12);
        const rows = Int32Array.from({ length: 8 }, (_, y) => y * 8);
        expect(capture.projectedGouraud(target, 8, rows, 8, 8, true, 0, Int32Array.of(87), 0, 0, 6, 0, 7, 0, 0, 0, 0)).toBe(true);
        capture.paintPixel(target, 9, 12);
        const [out] = await renderSdFrames(dir, [capture.finish()]);
        expect(Array.from(out.subarray(8, 11))).toEqual([87, 12, 87]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
