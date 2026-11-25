import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { hdGamepackPath, joglPath } from './hd-reference.js';

test('the GL client software display retains GPU updates across redraws and hands its framebuffer back to AWT', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-sd-browser-display-'));
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const compile = Bun.spawnSync(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'SdBrowserDisplayOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'SdBrowserDisplayOracle']);
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const reference = join(dir, 'native.bin');
        writeFileSync(reference, java.stdout);
        const build = await Bun.build({ entrypoints: [join(import.meta.dir, 'sd-browser-display-node.ts')], target: 'node', format: 'esm', outdir: dir, define: { 'process.env.RS530_GAMEPACK_IDENTITY': '"gl"' } });
        expect(build.success, build.logs.map(String).join('\n')).toBe(true);
        const node = Bun.spawnSync(['node', build.outputs[0].path, createRequire(import.meta.url).resolve('webgpu'), reference]);
        expect(node.exitCode, node.stderr.toString() + node.stdout.toString()).toBe(0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
