import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Pix2D from '#/graphics/Pix2D.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from '../reference.js';
import { compareFramebuffers, type Framebuffer } from './Framebuffer.js';

test('the SD framebuffer comparator checks all four pixel bytes across pitches and readback offsets', () => {
    const store = new Int32Array(40).fill(0x7f7f7f7f);
    const pixels = Int32Array.of(-1, 0x7689abcd, -2147483648, 0x030201);
    const reference = { width: 2, height: 2, pitch: 2, pixels };
    const actual = { width: 2, height: 2, pitch: 8, pixels: store.subarray(9, 19) };
    actual.pixels.set(pixels.subarray(0, 2));
    actual.pixels.set(pixels.subarray(2), 8);
    expect(() => compareFramebuffers(reference, actual)).not.toThrow();
    for (const bit of [0, 8, 16, 24, 31]) {
        actual.pixels[8] ^= 1 << bit;
        expect(() => compareFramebuffers(reference, actual)).toThrow(/Pixel \(0, 1\) expected 0x80000000/);
        actual.pixels[8] ^= 1 << bit;
    }
    expect(() => compareFramebuffers(reference, { ...actual, width: 1 })).toThrow('dimensions differ');
    expect(() => compareFramebuffers(reference, { ...actual, pitch: 1 })).toThrow('invalid');
    expect(() => compareFramebuffers(reference, { ...actual, pixels: actual.pixels.subarray(0, 9) })).toThrow('missing active pixels');
});

test('native Pix2D matches every framebuffer byte from td after each draw', () => {
    const previous = Object.getOwnPropertyDescriptors(Pix2D);
    const scratch = mkdtempSync(join(tmpdir(), 'rs530-framebuffers-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', scratch, join(import.meta.dir, 'FramebufferOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const commands: string[] = [],
            actual: Framebuffer[] = [];
        function draw(op: string, ...n: number[]): void {
            commands.push([op, ...n].join(' '));
            const [a, b, c, d, e, f] = n;
            switch (op) {
                case 'new':
                    Pix2D.setPixels(
                        Int32Array.from({ length: a * b }, (_, i) => c ^ Math.imul(i, 0x35b7c295)),
                        a,
                        b
                    );
                    break;
                case 'clip':
                    Pix2D.setClipping(a, b, c, d);
                    break;
                case 'intersect':
                    Pix2D.intersectClipping(a, b, c, d);
                    break;
                case 'rect':
                    Pix2D.drawRect(a, b, c, d, e);
                    break;
                case 'fill':
                    Pix2D.fillRect(a, b, c, d, e);
                    break;
                case 'line':
                    Pix2D.drawLine2(a, b, c, d, e);
                    break;
                case 'over':
                    Pix2D.fillRectTrans(a, b, c, d, e, f);
                    break;
                case 'circle':
                    Pix2D.fillCircleTrans(a, b, c, d, e);
                    break;
                case 'clear':
                    Pix2D.cls();
                    break;
                default:
                    throw new Error('Invalid test instruction');
            }
            actual.push({ width: Pix2D.width, height: Pix2D.height, pitch: Pix2D.width, pixels: requireNonNull(Pix2D.pixels).slice() });
        }
        for (const width of [1, 7, 63, 64, 65, 127]) {
            const height = 31;
            draw('new', width, height, -1450744509);
            draw('rect', -4, 0, width + 7, height, 0x7f123456);
            draw('over', 1, 2, width, height - 2, 0xde8917, 128);
            draw('clip', 2, 1, width - 1, height - 1);
            draw('fill', -1, -1, 14, 13, -2147028871);
            draw('line', -2, 30, width, 0, 0x351076);
            draw('intersect', 5, -13, width + 8, 16);
            for (const alpha of [0, 1, 127, 255, 256]) draw('circle', 9, 10, 7, 0xaabbcc, alpha);
            draw('clear');
        }
        const java = Bun.spawnSync(['java', '-cp', scratch + delimiter + gamepackPath, 'FramebufferOracle'], { stdin: Buffer.from(commands.join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        let offset = 0;
        for (const [i, frame] of actual.entries()) {
            const pixels = Int32Array.from({ length: frame.width * frame.height }, (_, j) => java.stdout.readInt32LE(offset + j * 4));
            expect(() => compareFramebuffers({ ...frame, pixels }, frame), commands[i]).not.toThrow();
            offset += pixels.byteLength;
        }
        expect(offset).toBe(java.stdout.byteLength);
    } finally {
        Object.defineProperties(Pix2D, previous);
        rmSync(scratch, { recursive: true, force: true });
    }
});
