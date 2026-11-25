import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import TextureOp from '#/dash3d/TextureOp.js';
import TextureOpPerlinNoise from '#/dash3d/TextureOpPerlinNoise.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function result(fn: () => void): string {
    try {
        fn();
        return 'ok';
    } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        return 'index ' + error.message.split(' ').at(-1);
    }
}

loginFixture(
    import.meta.url,
    'HD Perlin scanline branches and partial writes match bi',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-perlin-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const javac = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'HdPerlinScanlineOracle.java')]);
            expect(javac.exitCode, javac.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-cp', cp, 'HdPerlinScanlineOracle']);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const actual: string[] = [];
            for (const octaves of [1, 2, 3, 4]) {
                for (const bias of [false, true]) {
                    for (const width of [0, 1, 8, 15]) {
                        for (const length of [0, 2, width]) {
                            const op = new TextureOpPerlinNoise();
                            Object.assign(op, { octaves, bias, xScale: 13, yScale: 5, amplitudes: Int16Array.of(1538, -327, 8, 153), frequencies: Int16Array.of(1, 2, 4, 8), permutation: Uint8Array.from({ length: 512 }, (_, i) => 89 * i + 113) });
                            TextureOp.width = width;
                            TextureOp.normalisedY = Int32Array.of(1749);
                            TextureOp.normalisedX = Int32Array.from({ length: width }, (_, x) => ((x << 12) / width) | 0);
                            const dst = new Int32Array(length).fill(777);
                            const fault = result(() => op['renderRow'](dst, 0));
                            actual.push(fault + ' [' + dst.join(', ') + ']');
                        }
                    }
                }
            }
            const op = new TextureOpPerlinNoise();
            op['permutation'] = Uint8Array.of(2);
            TextureOpPerlinNoise.fadeTable = new Int32Array(0);
            actual.push(
                result(() => {
                    op['noiseHd'](7, 0, 0, 2, 2, 0);
                })
            );
            expect(actual).toEqual(java.stdout.toString().trim().split(/\r?\n/));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    15000,
    'gl'
);
