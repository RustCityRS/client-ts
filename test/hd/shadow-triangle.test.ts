import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Pix3D from '#/dash3d/Pix3D.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

type Triangle = [number, number, number, number, number, number, number, number];

test('HD shadow triangle ties, clipping, wrapping and partial writes match hf', () => {
    const cases: Triangle[] = [];
    for (const y1 of [-2, 0, 3, 7])
        for (const y2 of [-2, 0, 3, 7])
            for (const y3 of [-2, 0, 3, 7]) {
                for (const [x1, x2, x3] of [
                    [1, 3, 6],
                    [6, 3, 1],
                    [2, 2, 2],
                    [-4, 3, 9],
                    [65535, 0, 1],
                    [2147483647, -2147483648, 4]
                ]) {
                    for (const [size, stride] of [
                        [64, 8],
                        [19, 8],
                        [0, 0],
                        [-1, 5],
                        [45, -8],
                        [37, 2147483647]
                    ]) {
                        cases.push([size, y1, y2, y3, x1, x2, x3, stride]);
                    }
                }
            }
    const dir = mkdtempSync(join(tmpdir(), 'rs530-shadow-triangle-'));
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdShadowTriangleOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const reference = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', cp, 'HdShadowTriangleOracle'], {
            stdin: Buffer.from(cases.map(row => row.join(' ')).join('\n') + '\n'),
            maxBuffer: 2 * 1024 * 1024
        });
        expect(reference.exitCode, reference.stderr.toString()).toBe(0);
        const expected = reference.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(cases.length);
        for (const [i, [size, y1, y2, y3, x1, x2, x3, stride]] of cases.entries()) {
            const pixels = size < 0 ? null : new Uint8Array(size).fill(0x5a);
            let status = 'ok';
            try {
                Pix3D.fillShadowTriangle(pixels, y1, y2, y3, x1, x2, x3, stride);
            } catch (error) {
                if (error instanceof RangeError) status = 'bounds:' + error.message.split(' ').at(-1);
                else if (error instanceof TypeError && error.message === 'Null array') status = 'null';
                else throw error;
            }
            expect(status + ' ' + (pixels === null ? '-' : Buffer.from(pixels).toString('hex')), cases[i].join(' ')).toBe(expected[i]);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
