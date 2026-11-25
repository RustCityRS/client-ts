import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import golden from './title-trace.json';

const phases = ['loader.software', 'mode.hd', 'interface.onload', 'region.build', 'warmup'];

function cacheDigest(directory: string): string {
    const names = ['main_file_cache.dat2', 'main_file_cache.idx255', ...Array.from({ length: 28 }, (_, id) => 'main_file_cache.idx' + id)];
    const manifest = createHash('sha256');
    for (const name of names) {
        const digest = createHash('sha256')
            .update(readFileSync(join(directory, name)))
            .digest('hex');
        manifest.update(digest + '  ' + name + '\n');
    }
    return manifest.digest('hex');
}

function readFrames(directory: string) {
    // Marks are checkpoints, separate from the calls. Each checkpoint starts its own sequence so
    // H2 can compare 2D setup, warmup and early frames independently of H3–H5's region VBO uploads.
    // The full GLTrace keeps the original ids. Only ordered records enter digests (GLTRACE §4 / §17).
    const text = readFileSync(join(directory, 'trace.tsv'), 'utf8');
    const labels = [...phases, ...Array.from({ length: 50 }, (_, i) => 'title.' + i)];
    const checkpoints: Record<string, string> = {};
    const frames: string[] = [];
    let section = -1,
        localFrame = 0,
        sequence = 0;
    let hash = createHash('sha256');
    let count = 0;
    let swaps = 0;
    let elements = 0;
    let lists = 0;
    let buffers = 0;
    let lastCall = '';

    function finishFrame(): void {
        if (section < 0) return;
        const label = labels[section];
        const digest = hash.digest('hex');
        if (section < phases.length) {
            checkpoints[label] = digest;
            if (label === 'loader.software') expect(count).toBe(0);
            if (label === 'region.build') expect(buffers).toBeGreaterThan(0);
            else expect(buffers).toBe(0);
            expect(elements).toBe(0);
            if (label === 'warmup') expect(swaps).toBe(40);
        } else {
            const frame = section - phases.length;
            expect(swaps, 'swaps in title frame ' + frame).toBe(1);
            expect(lastCall).toBe('GLDrawable.swapBuffers');
            expect(lists).toBeGreaterThan(0);
            if (frame < 19) expect(elements).toBe(0);
            else expect(elements).toBeGreaterThan(0);
            frames.push(digest);
        }
        hash = createHash('sha256');
        count = swaps = elements = lists = buffers = localFrame = sequence = 0;
        lastCall = '';
    }

    for (const line of text.split(/\r?\n/)) {
        if (!line || line.startsWith('#')) continue;
        const [id, call, arg] = line.split('\t', 3);
        if (call === '~mark') {
            finishFrame();
            expect(arg).toBe(labels[++section]);
            continue;
        }
        if (/^\d+\.d\d+$/.test(id)) continue;
        if (section < 0) throw new Error('GL call before first checkpoint: ' + line);
        hash.update(localFrame + '.' + sequence + line.slice(id.length) + '\n');
        sequence++;
        count++;
        if (call === 'GLDrawable.swapBuffers') {
            swaps++;
            localFrame++;
            sequence = 0;
        }
        if (call === 'glDrawElements') elements++;
        if (call === 'glCallList') lists++;
        if (call === 'glBufferDataARB') buffers++;
        if (section >= phases.length && call === 'glDrawPixels') throw new Error('unexpected glDrawPixels in the HD login scene');
        lastCall = call;
    }
    finishFrame();
    expect(section).toBe(labels.length - 1);
    return { checkpoints, frames };
}

test('original HD gamepack repeats the cached login interface and 3D title scene for 50 frames', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-title-'));
    try {
        expect(cacheDigest(cachePath), 'reference cache data and sector indices').toBe(golden.cacheManifestSha256);
        const classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
        const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', classpath, '-d', dir, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'HdTitleFrameOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const runs: ReturnType<typeof readFrames>[] = [];
        for (const name of ['first', 'second']) {
            const output = join(dir, name);
            const oracle = Bun.spawnSync([
                'java',
                '--add-opens=java.base/java.lang=ALL-UNNAMED',
                '-Djava.awt.headless=true',
                '-Dgltrace.stacks=false',
                '-Xmx1536m',
                '-cp',
                classpath,
                'HdTitleFrameOracle',
                cachePath,
                output,
                join(import.meta.dir, 'rtx5070.json')
            ]);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            expect(oracle.stdout.toString().trim().split(/\r?\n/)).toEqual(['title 744 434 765 503', 'viewport 19 31 flames 0 0', 'groups ui/maps/models/sprites/scripts/fonts 832 3 325 32 2063 18']);
            const hashes = readFrames(output);
            expect(hashes).toEqual({ checkpoints: golden.checkpoints, frames: golden.frames });
            runs.push(hashes);
        }
        expect(runs[1]).toEqual(runs[0]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 120000);
