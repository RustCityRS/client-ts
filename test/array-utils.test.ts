import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ArrayUtils from '#/util/ArrayUtils.js';
import { gamepackPath } from './reference.js';

test('all cc copies and fills match Java for overlap, integer overflow, null and partial stores', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-arrays-'));
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'ArrayUtilsOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const ref = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'ArrayUtilsOracle']);
        expect(ref.exitCode, ref.stderr.toString()).toBe(0);
        const lines = ref.stdout.toString().trimEnd().split(/\r?\n/);
        const ranges = [
            [0, 0, 0],
            [0, 0, 16],
            [0, 2, 12],
            [3, 0, 13],
            [2, 3, 7],
            [2, 5, 8],
            [2, 5, 9],
            [0, 9, 8],
            [12, 9, 8],
            [-1, 0, 1],
            [0, -1, 1],
            [5, 5, -1],
            [2147483647, 0, 7],
            [0, 1, -2147483648],
            [15, 14, 2]
        ];
        let row = 0;
        function compare<T extends ArrayLike<unknown>>(kind: number, allocate: (salt: number) => T, op: (s: T | null, a: number, d: T | null, b: number, n: number) => T | null | void) {
            for (let shape = 0; shape < 5; shape++)
                for (const [a, b, n] of ranges) {
                    const s = shape > 2 ? null : allocate(1),
                        d = shape === 1 ? s : shape === 2 || shape === 4 ? null : allocate(31);
                    let error = 'ok',
                        copy: T | null | void = null;
                    try {
                        copy = op(s, a, d, b, n);
                    } catch (e) {
                        error = e instanceof TypeError ? 'null' : 'bounds';
                    }
                    const values = (arr: T | null | void) => (arr == null ? '-' : Array.from(arr, String).join(','));
                    expect([error, values(s), values(d), values(copy)].join('|'), [kind, shape, a, b, n].join('/')).toBe(lines[row++]);
                }
        }
        const ints = (salt: number): Int32Array => Int32Array.from({ length: 16 }, (_, i) => i + salt);
        compare(0, s => Uint8Array.from(ints(s)), ArrayUtils.copyBytes);
        compare(1, s => Int16Array.from(ints(s)), ArrayUtils.copyShorts);
        compare(2, s => BigInt64Array.from(ints(s), n => -(1n << 63n) + BigInt(n)), ArrayUtils.copyLongs);
        compare(3, s => Array.from(ints(s), (n, i) => (i % 4 === 0 ? null : 'v' + n)), ArrayUtils.copyObjects);
        compare(4, ints, ArrayUtils.copyInts);
        compare(5, ints, (_s, _a, d, b, n) => ArrayUtils.clearInts(d, b, n));
        compare(6, ints, (_s, _a, d, b, n) => ArrayUtils.fillInts(d, b, n, -123));
        compare(7, ints, s => {
            const copy = ArrayUtils.copyOf(s);
            if (copy) copy[7] = -99;
            return copy;
        });
        expect(row).toBe(lines.length);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
