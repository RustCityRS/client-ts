import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function observe([match, slot, length, alias, index, count]: number[]): string {
    const dest = new ModelUnlit();
    let source = new ModelUnlit();
    const arrays: (Int32Array | Int16Array | null)[] = [
        Int32Array.of(7, 17, 17, 43, 53),
        Int32Array.of(29, 31, 29, 47, 53),
        Int32Array.of(-41, -41, match === 1 ? -41 : 11, 47, 53),
        Int32Array.of(9, 11, 13, 19, 23),
        Int16Array.of(5, 7, 9, 11, 13),
        Int32Array.of(8, 17, 37, 17, 59),
        Int32Array.of(6, 29, 39, 29, 61),
        Int32Array.of(4, -41, 43, -41, 67),
        Int32Array.of(15, 25, 35, 45, 55)
    ];
    if (slot >= 0 && slot < arrays.length) arrays[slot] = length < 0 ? null : (arrays[slot]?.slice(0, length) ?? null);
    if (alias === 1) arrays[1] = arrays[0];
    if (alias === 2) arrays[5] = arrays[0];
    if (alias === 3) arrays[6] = arrays[0];
    if (alias === 4) arrays[8] = arrays[0];
    const fields = ['pointX', 'pointY', 'pointZ', 'vertexLabel', 'pointPartMask', 'pointX', 'pointY', 'pointZ', 'vertexLabel'] as const;
    for (const [i, field] of fields.entries()) Object.assign(i < 5 ? dest : source, { [field]: arrays[i] });
    dest.numPoints = count;
    if (alias === 5) source = dest;
    let result: string;
    try {
        result = String(Reflect.apply(dest['AddPointFromModel'], dest, [slot === 9 ? null : source, index, -32767]));
    } catch (error) {
        if (error instanceof TypeError) result = 'null';
        else if (error instanceof RangeError) result = 'bounds:' + error.message.split(' ').at(-1);
        else throw error;
    }
    return [
        result,
        dest.numPoints,
        ...fields.map((field, i) => {
            const array = (i < 5 ? dest : source)[field];
            return array === null ? 'null' : '[' + array.join(', ') + ']';
        })
    ].join('|');
}

test('adding unlit vertices preserves both gamepacks’ ordered search, first failed index, aliases and partial stores', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-unlit-point-'));
    try {
        const vectors: number[][] = [];
        for (const match of [0, 1]) {
            for (let slot = 0; slot < 9; slot++) for (const length of [-1, 0, 1, 2, 3, 4]) vectors.push([match, slot, length, 0, 1, 3]);
            for (const alias of [0, 1, 2, 3, 4, 5])
                for (const index of [-1, 0, 1, 3, 5]) {
                    for (const count of [-1, 0, 2, 3, 5, 7]) vectors.push([match, -1, 0, alias, index, count]);
                }
            vectors.push([match, 9, 0, 0, 1, 3]);
        }
        const build = Bun.spawnSync(['javac', '-d', dir, join(import.meta.dir, 'modelunlit/AddPointFromModelOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const actual = vectors.map(observe);
        for (const [identity, jar] of [
            ['sd', gamepackPath],
            ['gl', hdGamepackPath]
        ]) {
            const run = Bun.spawnSync(['java', '-XX:-OmitStackTraceInFastThrow', '-cp', [dir, jar, joglPath].join(delimiter), 'AddPointFromModelOracle', identity], { stdin: Buffer.from(vectors.join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const rows = run.stdout.toString().trimEnd().split(/\r?\n/);
            expect(rows.length).toBe(vectors.length);
            for (const [i, expected] of rows.entries()) expect(actual[i], identity + ' ' + vectors[i]).toBe(expected);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 15000);
