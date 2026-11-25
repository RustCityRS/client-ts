import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { runDriverNode } from './driver-node.js';

test('WebGPU renders the indexed geometry in the original first HD title scene', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-indexed-title-'));
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const replay = resolve(import.meta.dir, '../../tools/hd-replay');
        const profile = join(import.meta.dir, 'rtx5070.json');
        const natives = process.env.JOGL_NATIVES_530 || join(dirname(hdGamepackPath), 'natives', 'windows-amd64');
        const sources = ['GlRecorder.java', 'HdTitleFrameOracle.java', 'HdIndexedTerrainReadback.java'].map(f => join(import.meta.dir, f));
        for (const file of ['GlReplay', 'ReplayTrace', 'NativeInput', 'NativeGlReadback']) sources.push(join(replay, file + '.java'));
        const build = Bun.spawnSync(['javac', '--enable-preview', '--release', '21', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...sources]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const capture = Bun.spawnSync(['java', '--enable-preview', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-Xmx1536m', '-cp', cp, 'HdTitleFrameOracle', cachePath, dir, profile]);
        expect(capture.exitCode, capture.stderr.toString()).toBe(0);
        const trace = join(dir, 'trace.tsv');
        const native = Bun.spawnSync([
            'java',
            '--enable-preview',
            '--enable-native-access=ALL-UNNAMED',
            '--add-exports=java.desktop/sun.awt=ALL-UNNAMED',
            '--add-exports=java.desktop/sun.awt.windows=ALL-UNNAMED',
            '-Xmx1536m',
            '-cp',
            cp,
            'HdIndexedTerrainReadback',
            trace,
            dir,
            natives,
            resolve(import.meta.dir, './GLTRACE.md')
        ]);
        expect(native.exitCode, native.stderr.toString()).toBe(0);
        const result = await runDriverNode('terrain', [{ name: 'title', trace, blobs: join(dir, 'blobs'), profile, native: dir }]);
        try {
            expect(result.exitCode, result.output).toBe(0);
            expect(result.checks).toHaveLength(12);
            for (const c of result.checks) expect(c.ok, c.name + ' ' + c.detail).toBe(true);
        } finally {
            rmSync(result.dir, { recursive: true, force: true });
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 120000);
