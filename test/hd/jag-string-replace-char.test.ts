import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import JagString from '#/datastruct/JagString.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { loginFixture } from '../login-fixture.js';

loginFixture(
    import.meta.url,
    'HD JagString conversion throws the original wrapped RuntimeException',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-gl-string-context-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'JagStringReplaceCharOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-cp', cp, 'JagStringReplaceCharOracle', 'toString']);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            let context;
            try {
                new JagString().toString();
            } catch (error) {
                if (!(error instanceof WrappedException) || error.cause?.constructor !== Error || error.cause.message !== '') throw error;
                context = error.context;
            }
            expect(context).toBe(oracle.stdout.toString().trimEnd());
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);

test('HD renderer name character substitution matches na.c including fresh buffers and faults', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-gl-string-'));
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'JagStringReplaceCharOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const inputs: string[] = [];
        const actual: string[] = [];
        for (const [capacity, length] of [
            [256, 256],
            [260, 64],
            [0, 0],
            [-1, 0],
            [-1, 1],
            [7, 8],
            [8, -1]
        ]) {
            const bytes = capacity < 0 ? null : Uint8Array.from({ length: capacity }, (_, i) => i);
            for (const to of [-257, 0, 32, 47, 255, 256, 2147483647]) {
                for (const from of [-2147483648, -1, 0, 32, 47, 128, 255, 303]) {
                    const s = new JagString();
                    s.bytes = bytes;
                    s.length = length;
                    inputs.push([capacity, length, to, from].join(' '));
                    try {
                        const result = s.replaceChar(to, from);
                        expect(result).not.toBe(s);
                        expect(result.bytes).not.toBe(bytes);
                        actual.push(result.length + ':' + Buffer.from(requireNonNull(result.bytes)).toString('hex'));
                    } catch (error) {
                        if (!(error instanceof WrappedException)) throw error;
                        let exception: string;
                        if (error.cause instanceof TypeError) exception = 'NullPointerException';
                        else if (error.cause instanceof RangeError) exception = error.cause.message.startsWith('byte array index ') ? 'ArrayIndexOutOfBoundsException' : 'NegativeArraySizeException';
                        else throw error;
                        actual.push(exception + ' ' + error.context);
                    }
                }
            }
            if (bytes !== null) expect(bytes).toEqual(Uint8Array.from({ length: capacity }, (_, i) => i));
        }
        const oracle = Bun.spawnSync(['java', '-cp', cp, 'JagStringReplaceCharOracle'], { stdin: Buffer.from(inputs.join('\n') + '\n') });
        expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
        expect(actual).toEqual(oracle.stdout.toString().trimEnd().split(/\r?\n/));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
