import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { runDriverNode } from './driver-node.js';

test('WebGPU presents the nineteen original HD title frames pixel for pixel', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-driver-title-'));
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-d', dir, '-cp', cp, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'HdTitleFrameOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const profile = join(import.meta.dir, 'rtx5070.json');
        const capture = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-Xmx1536m', '-cp', cp, 'HdTitleFrameOracle', cachePath, dir, profile]);
        expect(capture.exitCode, capture.stderr.toString()).toBe(0);
        const report = await runDriverNode('title', [{ name: 'title', trace: join(dir, 'trace.tsv'), blobs: join(dir, 'blobs'), profile }]);
        try {
            expect(report.exitCode, report.output).toBe(0);
            expect(report.checks.length).toBe(21);
            for (const result of report.checks) expect(result.ok, result.name + ' ' + result.detail).toBe(true);
        } finally {
            rmSync(report.dir, { recursive: true, force: true });
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 90000);
