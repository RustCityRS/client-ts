import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import JagString from '#/datastruct/JagString.js';
import PacketT from '#/io/PacketT.js';
import { bitCount, floorMod, isPowerOfTwo } from '#/util/IntUtils.js';
import { gamepackPath } from './reference.js';

test('Java bit counts, power-of-two test, signed remainders, byte characters and pjstrLength agree at integer boundaries', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-intutils-'));
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'IntUtilsOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const jar = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'IntUtilsOracle']);
        expect(jar.exitCode, jar.stderr.toString()).toBe(0);
        const lines = jar.stdout.toString().trimEnd().split(/\r?\n/);
        const values = [0, 1, 2, 3, 4, 7, 8, 15, 16, 31, 32, 255, 256, 512, 65535, 65536, 0x55555555, 0xaaaaaaaa | 0, 2147483647, -2147483648, -1, -2, -7, -31, -255, -65536];
        let row = 0;
        for (const value of values)
            for (const divisor of values) {
                const s = new JagString();
                s.length = value;
                let remainder: string;
                try {
                    remainder = String(floorMod(value, divisor));
                } catch {
                    remainder = 'error';
                }
                expect([isPowerOfTwo(value), bitCount(value), remainder, PacketT.pjstrLength(s)].join('|'), [value, divisor].join('/')).toBe(lines[row++]);
            }
        for (let c = -2; c <= 258; c++) {
            let result: string;
            try {
                const s = JagString.fromCharCode(c);
                result = s.length + '|' + s.charAt(0);
            } catch {
                result = 'error';
            }
            expect(result, String(c)).toBe(lines[row++]);
        }
        expect(row).toBe(lines.length);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
