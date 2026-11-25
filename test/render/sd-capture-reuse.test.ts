import { expect, test } from 'bun:test';
import SdRasterSpans from '#/dash3d/SdRasterSpans.js';

test('device-owned SD captures reuse upload storage and refresh mutable sources on each redraw', () => {
    const target = new Int32Array(24);
    const live = new SdRasterSpans(target, 6, 4, true);
    const sprites = Int32Array.of(5, 6, 7);
    const glyph = Uint8Array.of(0, 1, 1);
    expect(live.matches(target, 6, 4)).toBe(true);
    expect(live.matches(target, 4, 6)).toBe(false);
    expect(live.matches(target.slice(), 6, 4)).toBe(false);
    const paint = (capture: SdRasterSpans): void => {
        const pixels = capture.guardedTarget;
        capture.blit(pixels, sprites, 0, 0, 3, 1, 0, 0, 0);
        capture.glyph(pixels, glyph, 43, 0, 6, 3, 1, 0, 0);
        // A row-crossing read isolates the batch and sets the serial execution flag.
        capture.record(pixels, 0, 0, 4, 6, 0, 0, 254, 0, null);
        for (let i = 0; i < 18000; i++) capture.record(pixels, 4, 6, 0, 2, i, 0, 0, 0, null);
    };
    paint(live);
    const first = live.finish();
    const capacities = first.batches.map(x => x.buffer);
    expect(first.batches.every(x => x.byteOffset % 256 === 0)).toBe(true);
    const firstAssetBuffer = first.assets.buffer;
    expect(first.initial === target).toBe(true);
    expect(first.batches.length).toBeGreaterThan(5);
    expect(new Set(capacities).size).toBeGreaterThan(1);
    live.reset();
    sprites[2] = 91;
    glyph[0] = 255;
    const snapshot = new SdRasterSpans(target, 6, 4);
    for (const recorder of [live, snapshot]) {
        paint(recorder);
        // A rebinding or explicit source mutation must preserve both versions in draw order.
        recorder.invalidate(sprites);
        sprites[2] = 127;
        recorder.blit(recorder.guardedTarget, sprites, 12, 0, 3, 1, 0, 0, 0);
        sprites[2] = 91;
    }
    const second = live.finish(),
        immutable = snapshot.finish();
    expect(second.assets).toEqual(immutable.assets);
    expect(Array.from(second.assets)).toEqual([5, 6, 91, 0x101ff, 5, 6, 127]);
    expect(second.assets.buffer === firstAssetBuffer).toBe(true);
    expect(second.batches.map((b, i) => b.buffer === capacities[i]).every(Boolean)).toBe(true);
    expect(second.batches.length).toBe(immutable.batches.length);
    for (let i = 0; i < second.batches.length; i++) {
        expect(Buffer.from(second.batches[i].buffer, second.batches[i].byteOffset, second.batches[i].byteLength).equals(Buffer.from(immutable.batches[i].buffer, immutable.batches[i].byteOffset, immutable.batches[i].byteLength))).toBe(true);
    }
    live.reset();
    try {
        live.guardedTarget[0] = 0;
    } catch {
        // finish() must also report a guarded write that the caller caught.
    }
    expect(() => live.finish()).toThrow('Unsupported CPU framebuffer access');
    live.reset();
    const empty = live.finish();
    expect(empty.assets.length).toBe(0);
    expect(empty.batches.length).toBe(0);
    expect(immutable.batches.length).toBeGreaterThan(5);
    target[0] = 27;
    expect(immutable.initial[0]).toBe(0);
    expect(() => snapshot.reset()).toThrow('persistent');
});

test('the common Gouraud command preserves palette changes, barriers and source faults', () => {
    const target = new Int32Array(24),
        palette = Int32Array.of(1, 2, 3, 4, 5);
    const captures = [new SdRasterSpans(target, 6, 4), new SdRasterSpans(target, 6, 4)];
    const frames = captures.map((capture, i) => {
        const pixels = capture.guardedTarget;
        const draw = (row: number, x0: number, x1: number, colour: number): boolean => (i === 0 ? capture.record(pixels, 1, row, x0, x1, colour, 16, 7, 1, palette) : capture.gouraud(pixels, row, x0, x1, colour, 16, 7, 1, palette));
        expect(draw(0, 1, 4, 0)).toBe(true);
        expect(draw(0, 3, 6, 256)).toBe(true);
        expect(draw(0, 4, 8, 128)).toBe(true);
        capture.invalidate(palette);
        palette[1] = 19;
        for (let k = 0; k < 4200; k++) draw(6, 0, 6, 288);
        palette[1] = 2;
        return capture.finish();
    });
    expect(frames[0].assets).toEqual(frames[1].assets);
    expect(frames[0].batches.length).toBe(frames[1].batches.length);
    for (let i = 0; i < frames[0].batches.length; i++) {
        const a = frames[0].batches[i],
            b = frames[1].batches[i];
        expect(Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength))).toBe(true);
    }
    const faulty = new SdRasterSpans(target, 6, 4);
    expect(faulty.gouraud(faulty.guardedTarget, 0, 0, 4, 0, 8, 0, 0, palette)).toBe(true);
    expect(faulty.gouraud(faulty.guardedTarget, 0, 0, 4, 1244, 69, 0, 0, palette)).toBe(false);
    expect(() => faulty.finish()).toThrow('exceeds its palette');
});
