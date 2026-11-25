import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

test('the base texture outputs preserve each gamepack’s guard, cause, diagnostic context and hidden-verb write', () => {
    const work = mkdtempSync(join(tmpdir(), 'rs530-texture-base-'));
    try {
        const compiler = Bun.spawnSync(['javac', '-d', work, join(import.meta.dir, 'TextureBaseOutputOracle.java')]);
        expect(compiler.exitCode, compiler.stderr.toString()).toBe(0);
        for (const [identity, jar] of [
            ['sd', gamepackPath],
            ['gl', hdGamepackPath]
        ]) {
            const cp = [work, jar, joglPath].join(delimiter);
            const original = Bun.spawnSync(['java', '-cp', cp, 'TextureBaseOutputOracle', identity]);
            expect(original.exitCode, original.stderr.toString()).toBe(0);
            const port = Bun.spawnSync([process.execPath, join(import.meta.dir, 'texture-base-output.ts')], { env: { ...process.env, RS530_GAMEPACK_IDENTITY: identity } });
            expect(port.exitCode, port.stderr.toString()).toBe(0);
            const lines = (bytes: Uint8Array) => Buffer.from(bytes).toString('utf8').trimEnd().split(/\r?\n/);
            expect(lines(port.stdout)).toEqual(lines(original.stdout));
        }
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
});
