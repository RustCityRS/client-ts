import { expect } from 'bun:test';
import { delimiter, join } from 'node:path';
import GroundDecor from '#/dash3d/GroundDecor.js';
import LocEntity from '#/dash3d/LocEntity.js';
import Square from '#/dash3d/Square.js';
import { arrayAtI32, arrayAtObj, arrayPutI32 } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function hash(values: ArrayLike<unknown>): number {
    let sum = 1;
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        sum = (Math.imul(31, sum) + (value === null ? 0 : Number(value))) | 0;
    }
    return sum;
}

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' Square allocates distinct five-slot sprite arrays and preserves every neighboring tile on failed stores',
        async () => {
            const actual: number[] = [];
            const decor = new GroundDecor();
            actual.push(Object.keys(decor).length);
            if (identity === 'gl') actual.push(Number(decor.depthOffset));
            const entity = new LocEntity();
            actual.push(Object.keys(entity).length);
            if (identity === 'gl') actual.push(entity.shadow === null ? -1 : 1);
            const tiles: Square[] = [];
            const saved: Int32Array[] = [];
            const arrays = new Set<object>();
            for (let i = 0; i < 385; i++) {
                const tile = new Square(i - 193, 0x7fffffff - i, -0x80000000 + i);
                tiles.push(tile);
                const flags = tile.spriteSpan;
                saved.push(flags);
                actual.push(tile.level, tile.originalLevel, tile.x, tile.z, tile.spriteSpans);
                actual.push(tile.sprites.length, hash(tile.sprites), flags.length, hash(flags));
                arrays.add(tile.sprites);
                arrays.add(flags);
                for (let j = 0; j < flags.length; j++) arrayPutI32(flags, j, (Math.imul(i, -1640531527) + j) | 0);
            }
            actual.push(arrays.size);
            for (let i = 0; i < tiles.length; i++) {
                const flags = saved[i];
                for (const index of [-1, 5]) {
                    expect(() => arrayAtI32(flags, index)).toThrow(new RangeError('array index ' + index));
                    expect(() => arrayPutI32(flags, index, 0x6aa55aa6)).toThrow(new RangeError('array index ' + index));
                    actual.push(index, index);
                }
                if (i % 17 === 0) {
                    tiles[i].spriteSpan = new Int32Array(5);
                    flags[2] ^= -1;
                }
            }
            for (let i = 0; i < tiles.length; i++) actual.push(...saved[i], ...tiles[i].spriteSpan);
            for (const readFirst of [false, true]) {
                const tile = new Square(0, 0, 0);
                const oldObjects = readFirst ? tile.sprites : null;
                const oldFlags = readFirst ? tile.spriteSpan : null;
                Reflect.set(tile, 'sprites', null);
                Reflect.set(tile, 'spriteSpan', null);
                expect(() => arrayAtObj(tile.sprites, -1)).toThrow(new TypeError('Null array'));
                expect(() => arrayPutI32(tile.spriteSpan, 5, 7)).toThrow(new TypeError('Null array'));
                actual.push(-1, -1);
                const substitute = [null];
                const flags = Int32Array.of(17);
                tile.sprites = substitute;
                tile.spriteSpan = flags;
                actual.push(tile.sprites === substitute && tile.spriteSpan === flags ? 1 : 0, oldObjects?.length ?? -1);
                if (oldFlags !== null) oldFlags[0] = 42;
                actual.push(tile.spriteSpan[0]);
            }

            const source = join(import.meta.dir, 'SquareSpanOracle.java');
            const classPath = identity === 'gl' ? [hdGamepackPath, joglPath].join(delimiter) : gamepackPath;
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', classPath, source, identity]);
            if (java.exitCode !== 0) throw new Error(java.stderr.toString());
            const output = Buffer.alloc(actual.length * 4);
            actual.forEach((value, index) => output.writeInt32BE(value, index * 4));
            expect(Buffer.compare(java.stdout, output)).toBe(0);
        },
        20000,
        identity
    );
}
