import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { runDriverNode } from './driver-node.js';

test('WebGPU matches native OpenGL in original surface and underwater material frames', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-water-pixels-'));
    try {
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const replay = resolve(import.meta.dir, '../../tools/hd-replay');
        const files = ['GlRecorder', 'HdMaterialsOracle', 'HdWaterReadback'].map(name => join(import.meta.dir, name + '.java'));
        for (const name of ['GlReplay', 'ReplayTrace', 'NativeInput', 'NativeGlReadback']) files.push(join(replay, name + '.java'));
        const build = Bun.spawnSync(['javac', '--enable-preview', '--release', '21', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...files]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const profile = join(import.meta.dir, 'rtx5070.json');
        const natives = process.env.JOGL_NATIVES_530 || join(dirname(hdGamepackPath), 'natives', 'windows-amd64');
        for (const args of [
            ['-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-cp', cp, 'HdWaterReadback', 'capture', dir, profile],
            [
                '--enable-native-access=ALL-UNNAMED',
                '--add-exports=java.desktop/sun.awt=ALL-UNNAMED',
                '--add-exports=java.desktop/sun.awt.windows=ALL-UNNAMED',
                '-cp',
                cp,
                'HdWaterReadback',
                'replay',
                dir,
                natives,
                resolve(import.meta.dir, './GLTRACE.md')
            ]
        ]) {
            const java = Bun.spawnSync(['java', '--enable-preview', ...args]);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
        }
        const readNative = (name: string) => readFileSync(join(dir, 'water.' + name + '.rgba'));
        expect(readNative('00').equals(readNative('01'))).toBe(false);
        expect(readNative('01').equals(readNative('11'))).toBe(false);
        for (const [first, second] of [
            ['env0-0', 'env1-1'],
            ['env1-1', 'env1-3'],
            ['env3-0', 'env3-96'],
            ['env0-0', 'env3-0'],
            ['env0-0', 'env4-1'],
            ['env0-0', 'env5-1'],
            ['env4-1', 'env5-1']
        ]) {
            const a = readNative(first),
                b = readNative(second);
            let changed = 0;
            for (let i = 0; i < a.length; i += 4) if (a.readUInt32LE(i) !== b.readUInt32LE(i)) changed++;
            console.info(first + ' vs ' + second + ' changed ' + changed + ' original pixels');
            expect(changed, first + ' vs ' + second).toBeGreaterThan(100);
        }
        const report = await runDriverNode('water', [{ name: 'water', trace: join(dir, 'trace.tsv'), blobs: join(dir, 'blobs'), profile, native: dir }]);
        try {
            expect(report.exitCode, report.output).toBe(0);
            expect(report.checks.filter(c => c.name.endsWith(' native RGBA'))).toHaveLength(11);
            expect(report.checks.filter(c => !c.ok)).toEqual([]);
            console.info(
                report.checks
                    .filter(c => c.name.endsWith(' native RGBA'))
                    .map(c => c.name + ' ' + c.detail)
                    .join('\n')
            );
        } finally {
            rmSync(report.dir, { recursive: true, force: true });
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 120000);
