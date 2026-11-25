import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from './hd-reference.js';

test('SD canvas swaps and AWT dirty rectangles reproduce the displays of both original PixScreens', async () => {
    // Each line is source size, window size, pattern seed, rectangle count (-1 = full), then XYWH rectangles.
    const frames = [
        [257, 9, 257, 9, 1, -1],
        [257, 9, 257, 9, 2, 3, -5, -1, 15, 3, 6, 1, 55, 5, 249, 8, 12, 2],
        [257, 9, 257, 9, 3, 0],
        [257, 9, 257, 9, 4, 4, 0, 0, 0, 8, 6, 6, 8, -1, -20, -2, 2, 3, 257, 0, 20, 9],
        [132, 5, 257, 9, 5, -1],
        [257, 9, 67, 7, 6, 1, 62, 3, 10, 3],
        [33, 4, 67, 7, 7, -1],
        [3, 1, 1, 1, 8, 0],
        [3, 1, 1, 1, 9, -1]
    ];
    const dir = mkdtempSync(join(tmpdir(), 'rs530-sd-canvas-'));
    try {
        const commands = frames.map(frame => frame.join(' ')).join('\n') + '\n';
        const input = join(dir, 'frames.txt');
        const expected = join(dir, 'display.bin');
        writeFileSync(input, commands);
        const javac = Bun.spawnSync(['javac', '-d', dir, join(import.meta.dir, 'SdCanvasPresentOracle.java')]);
        expect(javac.exitCode, javac.stderr.toString()).toBe(0);
        let display: Buffer | undefined;
        for (const [mode, jar] of [
            ['sd', gamepackPath],
            ['hd', hdGamepackPath]
        ]) {
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', [dir, jar, joglPath].join(delimiter), 'SdCanvasPresentOracle', mode], {
                stdin: Buffer.from(commands)
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            expect(java.stdout.length).toBe(frames.reduce((n, frame) => n + frame[2] * frame[3] * 4, 0));
            if (display) expect(Buffer.compare(display, java.stdout)).toBe(0);
            display = java.stdout;
        }
        if (!display) throw new Error('Missing Java canvas reference');
        writeFileSync(expected, display);
        const build = await Bun.build({ entrypoints: [join(import.meta.dir, 'sd-canvas-presenter-node.mjs')], target: 'node', format: 'esm', outdir: dir });
        if (!build.success) throw new Error(build.logs.join('\n'));
        const node = Bun.spawnSync(['node', build.outputs[0].path, input, expected, createRequire(import.meta.url).resolve('webgpu')]);
        expect(node.exitCode, node.stderr.toString() + node.stdout.toString()).toBe(0);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
