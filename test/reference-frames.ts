import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { endianness } from 'node:os';
import type { Framebuffer } from './render/Framebuffer.js';

// The JAR writes little-endian td.g words. Each iteration reuses one frame's storage.
export function* readReferenceFrames(path: string, width: number, height: number, count: number): Generator<{ index: number; frame: Framebuffer }> {
    const fd = openSync(path, 'r');
    try {
        const pixels = new Int32Array(width * height);
        const bytes = Buffer.from(pixels.buffer);
        const expectedSize = count * bytes.length;
        const size = fstatSync(fd).size;
        if (size !== expectedSize) throw new Error(`JAR wrote ${size} framebuffer bytes, expected ${expectedSize}`);
        for (let index = 0; index < count; index++) {
            let offset = 0;
            while (offset < bytes.length) {
                const read = readSync(fd, bytes, offset, bytes.length - offset, null);
                if (read === 0) throw new Error('Incomplete JAR framebuffer at frame ' + index);
                offset += read;
            }
            if (endianness() === 'BE') bytes.swap32();
            yield { index, frame: { width, height, pitch: width, pixels } };
        }
    } finally {
        closeSync(fd);
    }
}
