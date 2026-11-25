import { gamepackPath } from './reference.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import Isaac from '../src/io/Isaac.js';

test('ij constructor, initialization, generation and draws match Java at every checkpoint', () => {
    const patterned = (length: number) => Int32Array.from({ length }, (_, i) => Math.imul(i + 1, 0x9e3779b9) ^ (i << 23));
    const seeds = [new Int32Array(0), Int32Array.of(0), Int32Array.of(-1), Int32Array.of(-2147483648, -1, 0, 2147483647), patterned(13), patterned(255), patterned(256)];
    const words = [seeds.length, ...seeds.flatMap(seed => [seed.length, ...seed])];
    const input = Buffer.alloc(words.length * 4);
    words.forEach((word, i) => input.writeInt32BE(word, i * 4));
    const oracle = fileURLToPath(new URL('./login/IsaacOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, oracle], { stdin: input, timeout: 20000 });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    let offset = 0;
    const read = () => {
        const value = java.stdout.readInt32BE(offset);
        offset += 4;
        return value;
    };
    const snapshot = (cipher: Isaac) => {
        expect([cipher['remaining'], cipher['accumulator'], cipher['lastResult'], cipher['counter']]).toEqual(Array.from({ length: 4 }, read));
        expect(cipher['memory']).toEqual(Int32Array.from({ length: 256 }, read));
        expect(cipher['results']).toEqual(Int32Array.from({ length: 256 }, read));
    };
    const bare = Reflect.construct(Isaac, []) as Isaac;
    expect([bare['remaining'], bare['accumulator'], bare['lastResult'], bare['counter'], Number(bare['memory'] !== null), Number(bare['results'] !== null)]).toEqual(Array.from({ length: 6 }, read));
    for (const seed of seeds) {
        const cipher = new Isaac(seed);
        snapshot(cipher);
        for (const count of [1, 254, 1, 1, 255, 1]) {
            expect(Array.from({ length: count }, () => cipher.TakeNextValue())).toEqual(Array.from({ length: count }, read));
            snapshot(cipher);
        }
        cipher['Generate']();
        snapshot(cipher);
        cipher['Init']();
        snapshot(cipher);
        cipher['remaining'] = 0;
        cipher['counter'] = 2147483647;
        cipher['accumulator'] = -2147483648;
        cipher['lastResult'] = 2147483647;
        expect(cipher.TakeNextValue()).toBe(read());
        snapshot(cipher);
    }
    expect(offset).toBe(java.stdout.length);
    expect(() => new Isaac(new Int32Array(257))).toThrow();
});
