import { expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Pix3D from '#/dash3d/Pix3D.js';
import SdRasterSpans, { type SdRasterFrame } from '#/dash3d/SdRasterSpans.js';
import Pix2D from '#/graphics/Pix2D.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { renderSdFrames } from './sd-device.js';

loginFixture(
    import.meta.url,
    'resident SD triangles preserve original edge ties, clipping, painter order and alpha',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-sd-triangle-order-'));
        const width = 63,
            height = 43,
            frameCount = 38;
        const input = [width, height, frameCount],
            captures: SdRasterFrame[] = [];
        const orders = [
            [0, 1, 2],
            [0, 2, 1],
            [1, 0, 2],
            [1, 2, 0],
            [2, 0, 1],
            [2, 1, 0]
        ];
        const shapes = [
            [
                [-6, 3],
                [21, 52],
                [33, 7]
            ],
            [
                [4, -3],
                [4, 57],
                [34, 18]
            ],
            [
                [-11, 49],
                [39, 2],
                [39, 53]
            ],
            [
                [-2, 13],
                [41, 13],
                [30, 19]
            ],
            [
                [22, -32768],
                [26, 32767],
                [30, 7]
            ],
            [
                [20, 20],
                [21, 21],
                [21, 21]
            ],
            [
                [-3, 17],
                [35, 28],
                [15, 24]
            ],
            [
                [-7, 61],
                [13, -19],
                [52, 48]
            ]
        ];
        const palette = Int32Array.from({ length: 65536 }, (_, i) => Math.imul(i, 0x181165));
        try {
            Pix3D.colourTable = palette;
            for (let frame = 0; frame < frameCount; frame++) {
                const pixels = Int32Array.from({ length: width * height }, (_, i) => Math.imul(i, 0x913a7811) ^ frame);
                const left = frame % 5,
                    top = frame % 3,
                    w = width - left - (frame % 2),
                    h = height - top - 1;
                Pix2D.setPixels(pixels, width, height);
                Pix2D.setClipping(left, top, left + w, top + h);
                Pix3D.setRenderClipping();
                const recorder = new SdRasterSpans(pixels, width, height, true);
                Pix3D.spanTarget = recorder;
                Pix2D.pixels = recorder.guardedTarget;
                const count = frame >= 36 ? 850 : 11;
                input.push(left, top, w, h, count);
                for (let i = 0; i < count; i++) {
                    const shape = shapes[(frame + i) % shapes.length],
                        order = orders[(frame + i * 5) % orders.length];
                    const y = order.map(n => shape[n][0]),
                        x = order.map(n => shape[n][1]);
                    const extreme = shape === shapes[4],
                        clipped = extreme || x.some(v => v < 0 || v > w);
                    const alpha = [0, 0, 254, 1, 192, 255, 0][(frame + i) % 7];
                    Pix3D.lowDetail = (i + frame) % 4 !== 0;
                    Pix3D.hclip = clipped;
                    Pix3D.trans = alpha;
                    if (i % 7 === 2) {
                        const colour = Math.imul(91 + i, 0x97424);
                        input.push(7, +clipped, +Pix3D.lowDetail, alpha, ...y, ...x, colour);
                        Pix3D.flatTriangle(y[0], y[1], y[2], x[0], x[1], x[2], colour);
                    } else {
                        const colours = order.map(n => 30000 + (extreme ? 0 : 13 * n));
                        input.push(9, +clipped, +Pix3D.lowDetail, alpha, ...y, ...x, ...colours);
                        Pix3D.gouraudTriangle(y[0], y[1], y[2], x[0], x[1], x[2], colours[0], colours[1], colours[2]);
                    }
                }
                captures.push(recorder.finish());
                Pix3D.spanTarget = null;
                Pix2D.pixels = pixels;
            }
            const bytes = Buffer.alloc(input.length * 4);
            input.forEach((word, i) => bytes.writeInt32BE(word, 4 * i));
            const path = join(dir, 'triangles.bin');
            writeFileSync(path, bytes);
            const native = Bun.spawnSync(['java', '-cp', gamepackPath, join(import.meta.dir, 'SdGouraudTriangleOracle.java'), path]);
            expect(native.exitCode, native.stderr.toString()).toBe(0);
            const results = await renderSdFrames(dir, captures);
            let offset = 0;
            for (let f = 0; f < results.length; f++)
                for (let i = 0; i < results[f].length; i++, offset += 4) {
                    const expected = native.stdout.readInt32BE(offset);
                    if (results[f][i] !== expected) throw new Error(`frame ${f}, word ${i}: expected ${expected}, got ${results[f][i]}`);
                }
            expect(offset).toBe(native.stdout.length);
        } finally {
            Pix3D.spanTarget = null;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'sd'
);
