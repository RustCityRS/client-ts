import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import MonochromeImageCache from '#/dash3d/MonochromeImageCache.js';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpVoronoiNoise from '#/dash3d/TextureOpVoronoiNoise.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function draw([metric, output, xLength, dstLength, permLength, offsetLength, xCells, y]: number[]): string {
    const op = new TextureOpVoronoiNoise();
    const cache = (op.monochromeImageCache = new MonochromeImageCache(1, 1, 13));
    TextureOp.width = 13;
    TextureOp.normalisedY = Int32Array.of(y);
    const xs = (TextureOp.normalisedX = xLength < 0 ? null : Int32Array.from({ length: xLength }, (_, i) => (i - 3) * 734003 + i * 7919));
    const dst = dstLength === -2 ? xs : dstLength < 0 ? null : new Int32Array(dstLength).fill(777);
    requireNonNull(cache['pixels'])[0] = dst;
    Object.assign(op, {
        metric,
        output,
        xCells,
        yCells: 19,
        permutation: permLength < 0 ? null : Uint8Array.from({ length: permLength }, (_, i) => 89 * i + 113),
        offsets: offsetLength < 0 ? null : Int16Array.from({ length: offsetLength }, (_, i) => 1877 * i - 29399)
    });
    Object.assign(TextureOpVoronoiNoise, { nearestDistance: 10, secondDistance: 11, thirdDistance: 12, fourthNearest: 13 });
    let outcome = 'ok';
    try {
        op.getMonochromeOutput(0);
    } catch (error) {
        if (error instanceof RangeError) outcome = 'index ' + error.message.split(' ').at(-1);
        else if (error instanceof TypeError) outcome = 'null';
        else throw error;
    }
    const distances = [TextureOpVoronoiNoise.nearestDistance, TextureOpVoronoiNoise.secondDistance, TextureOpVoronoiNoise.thirdDistance, TextureOpVoronoiNoise.fourthNearest];
    return [outcome, dst === null ? 'null' : '[' + dst.join(', ') + ']', cache.invalid, distances.join(',')].join('|');
}

loginFixture(
    import.meta.url,
    'HD Voronoi rows match hm including four distances and the destination at every fault',
    async () => {
        const rows: number[][] = [];
        for (const metric of [0, 1, 2, 3, 4, 5, 6])
            for (const output of [0, 1, 2, 3, 4, 5]) {
                for (const [x, dst, perm, offsets] of [
                    [13, 13, 512, 512],
                    [13, -2, 256, 512],
                    [13, 7, 512, 512],
                    [6, 13, 512, 512],
                    [-1, 13, 512, 512],
                    [13, -1, 512, 512],
                    [13, 13, 76, 512],
                    [13, 13, 255, 511],
                    [13, 13, -1, 512],
                    [13, 13, 512, 367],
                    [13, 13, 512, -1]
                ]) {
                    for (const scale of [0, 7, 255]) rows.push([metric, output, x, dst, perm, offsets, scale, scale === 7 ? 2463 : 2147483597]);
                }
            }
        const dir = mkdtempSync(join(tmpdir(), 'rs530-voronoi-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdVoronoiScanlineOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', cp, 'HdVoronoiScanlineOracle'], { stdin: Buffer.from(rows.map(v => v.join(' ')).join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const output = java.stdout.toString().trim().split(/\r?\n/);
            expect(output.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) expect(draw(row), row.join(' ')).toBe(output[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    15000,
    'gl'
);
