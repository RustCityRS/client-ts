import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import GroundShadows from '#/dash3d/GroundShadows.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

test('HD ground shadow stamps preserve byte order, overlap and partial failures in tj', () => {
    const cases: number[][] = [];
    for (const operation of [0, 1]) {
        for (const [dst, src] of [
            [18, 18],
            [18, -2],
            [5, 5],
            [18, 3],
            [3, 18],
            [-1, 2],
            [2, -1]
        ]) {
            for (const [from, to] of [
                [0, 1],
                [1, 0],
                [-1, -1],
                [2, 5],
                [0, 0]
            ]) {
                for (const width of [-1, 0, 1, 3, 4, 5, 7, 8]) {
                    for (const [height, dstStep, srcStep] of [
                        [0, 0, 0],
                        [2, 1, 2],
                        [3, -3, -1],
                        [2, 2147483647, 0]
                    ]) {
                        cases.push([operation, dst, src, from, to, width, height, dstStep, srcStep]);
                    }
                }
            }
        }
        cases.push([operation, 5, 5, 0, 0, 4, -2147483648, 0, 0]);
    }
    const dir = mkdtempSync(join(tmpdir(), '530-shadow-blit-'));
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdShadowBlitOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const oracle = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', cp, 'HdShadowBlitOracle'], {
            stdin: Buffer.from(cases.map(v => v.join(' ')).join('\n') + '\n')
        });
        expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
        const lines = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(cases.length);
        const pixels = (size: number) => (size < 0 ? null : Uint8Array.from({ length: size }, (_, i) => 0xf5 - 29 * i));
        for (const [i, [op, d, s, from, to, width, height, ds, ss]] of cases.entries()) {
            const dst = pixels(d),
                src = s === -2 ? dst : pixels(s);
            let result = 'ok';
            try {
                GroundShadows[op === 0 ? 'addPixels' : 'subtractPixels'](dst, src, from, to, width, height, ds, ss);
            } catch (e) {
                if (e instanceof RangeError) result = 'bounds ' + e.message.split(' ').at(-1);
                else if (e instanceof TypeError && e.message === 'Null array') result = 'null';
                else throw e;
            }
            expect(result + ' ' + (dst === null ? '-' : Buffer.from(dst).toString('hex')), cases[i].join(' ')).toBe(lines[i]);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
