import { expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Pix3D from '#/dash3d/Pix3D.js';
import SdRasterSpans, { type SdRasterFrame } from '#/dash3d/SdRasterSpans.js';
import Pix2D from '#/graphics/Pix2D.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { renderSdFrames } from './sd-device.js';

loginFixture(
    import.meta.url,
    'resident Gouraud capture preserves original partial writes and the first failing load or store',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-gouraud-faults-'));
        try {
            const seeds = [
                [5, 0, 0, 11, 0, 256],
                [8, 0, 0, 13, 6 << 8, -256],
                [8, 30, 0, 9, 0, 0],
                [3, 28, 0, 9, 0, 256],
                [1, 32, 0, 4, 0, 0],
                [0, -1, 0, 3, 0, 1],
                [-1, -1, 0, 6, 0, 12],
                [2, 9, -2, 5, 0, 0x40000000],
                [3, 8, -4, 7, 2 << 8, 0x40000000]
            ];
            const cases: number[][] = [];
            for (const low of [0, 1])
                for (const alpha of [0, 177]) {
                    for (const [length, base, x, end, shade, step] of seeds) cases.push([length, low, alpha, base, x, end, shade, step]);
                }
            const aliasStart = cases.length;
            for (const low of [0, 1])
                for (const alpha of [0, 177]) {
                    for (const [base, x, end, shade, step] of [
                        [2, 0, 12, 0, 128],
                        [0, 0, 13, 6 << 8, -256],
                        [0, 0, 15, 31 << 8, 128],
                        [27, 0, 13, 25 << 8, 256],
                        [-1, 0, 9, 4 << 8, 128],
                        [2, -2, 11, 0, 0x40000000]
                    ]) {
                        cases.push([-2, low, alpha, base, x, end, shade, step]);
                    }
                }
            const words = [cases.length, ...cases.flat()],
                wire = Buffer.alloc(4 * words.length);
            words.forEach((n, i) => wire.writeInt32BE(n, i * 4));
            const input = join(dir, 'input');
            writeFileSync(input, wire);
            const native = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', gamepackPath, join(import.meta.dir, 'SdGouraudFaultOracle.java'), input, 'triangles']);
            expect(native.exitCode, native.stderr.toString()).toBe(0);
            const initial = (): Int32Array => Int32Array.from({ length: 33 }, (_, i) => i * 657438);
            const draw = (pixels: Int32Array, table: Int32Array, args: number[]): number => {
                const [size, low, alpha, base, x, end, shade, step] = args;
                Pix3D.colourTable = size === -2 ? table : size < 0 ? null : Int32Array.from({ length: size }, (_, j) => j * 0x63175a + 1234);
                Pix3D.hclip = false;
                Pix3D.lowDetail = low !== 0;
                Pix3D.trans = alpha;
                try {
                    Pix3D['gouraudRaster'](pixels, base, 0, 0, x, end, shade, step);
                } catch (error) {
                    if (error instanceof RangeError) return Number(error.message.split(' ').at(-1));
                    if (error instanceof TypeError && error.message === 'Null array') return 2147483647;
                    throw error;
                }
                return -2147483648;
            };
            const compare = (i: number, pixels: Int32Array): void => {
                expect(pixels.length).toBe(33);
                for (let p = 0; p < 33; p++) expect(pixels[p], String(cases[i])).toBe(native.stdout.readInt32BE((i * 34 + p + 1) * 4));
            };
            const frames: SdRasterFrame[] = [];
            const residentFrames: SdRasterFrame[] = [];
            for (const [i, args] of cases.entries()) {
                const expectedFault = native.stdout.readInt32BE(i * 34 * 4);
                const cpu = initial();
                Pix3D.spanTarget = null;
                expect(draw(cpu, cpu, args), String(args)).toBe(expectedFault);
                compare(i, cpu);

                const pixels = initial(),
                    recorder = new SdRasterSpans(pixels, 8, 4, true);
                Pix3D.spanTarget = recorder;
                expect(draw(recorder.guardedTarget, pixels, args), String(args)).toBe(expectedFault);
                // The isolated readback includes the legal sentinel beyond the final display row.
                frames.push({ ...recorder.finish(), feedback: [] });
                if (i < aliasStart) continue;

                // Use the same resident device buffer across cases. Only GPU writes supply the
                // actual palette; every word in the CPU seed remains stale. Expose all 33 words
                // as visible rows so this readback also checks the final word.
                const stale = new Int32Array(33).fill(-513);
                const resident = new SdRasterSpans(stale, 11, 3, true);
                Pix3D.spanTarget = resident;
                for (let p = 0; p < 33; p++) resident.paintPixel(resident.guardedTarget, p, p * 657438);
                const alias = i % 2 === 0 ? resident.guardedTarget : stale;
                expect(draw(resident.guardedTarget, alias, args), String(args)).toBe(expectedFault);
                const frame = resident.finish();
                expect(frame.assets.length).toBe(0);
                residentFrames.push(frame);
            }
            const outputs = await renderSdFrames(dir, frames);
            outputs.forEach((pixels, i) => compare(i, pixels));
            const aliasCases = residentFrames.length;
            for (const low of [false, true])
                for (const alpha of [0, 177]) {
                    const stale = new Int32Array(33).fill(-513),
                        raster = new SdRasterSpans(stale, 11, 3, true);
                    Pix3D.spanTarget = raster;
                    Pix2D.setPixels(stale, 11, 3);
                    Pix3D.setRenderClipping();
                    Pix3D.colourTable = Pix2D.pixels;
                    Pix3D.lowDetail = low;
                    Pix3D.trans = alpha;
                    for (let p = 0; p < 33; p++) raster.paintPixel(raster.guardedTarget, p, p * 657438);
                    Pix3D.gouraudTriangle(0, 3, 1, 0, 4, 10, 0, 7, 9);
                    Pix3D.gouraudTriangle(2, 0, 3, 10, 3, 0, 2, 4, 5);
                    const frame = raster.finish();
                    expect(frame.assets.length).toBe(0);
                    residentFrames.push(frame);
                }
            const retained = await renderSdFrames(dir, residentFrames, true);
            retained.forEach((pixels, i) => {
                if (i < aliasCases) compare(aliasStart + i, pixels);
                else
                    for (let p = 0; p < 33; p++) {
                        expect(pixels[p], 'triangle mode ' + (i - aliasCases)).toBe(native.stdout.readInt32BE((cases.length * 34 + (i - aliasCases) * 33 + p) * 4));
                    }
            });
        } finally {
            Pix3D.spanTarget = null;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
