import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import GameShell from '#/client/GameShell.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import Preferences from '#/ui/Preferences.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'graphics options select the JAR antialiasing capability and resolve the native edges',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-antialias-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync([
                'javac',
                '--enable-preview',
                '--release',
                '21',
                '-encoding',
                'UTF-8',
                '-cp',
                cp,
                '-d',
                dir,
                resolve(import.meta.dir, '../../tools/hd-replay/NativeGlReadback.java'),
                join(import.meta.dir, 'HdAntiAliasingOracle.java')
            ]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', '--enable-preview', '--enable-native-access=ALL-UNNAMED', '--add-exports=java.desktop/sun.awt=ALL-UNNAMED', '--add-exports=java.desktop/sun.awt.windows=ALL-UNNAMED', '-cp', cp, 'HdAntiAliasingOracle'];
            const control = Bun.spawnSync([...java, 'controls']);
            expect(control.exitCode, control.stderr.toString()).toBe(0);
            const script = new ClientScript();
            script.opcodes = Int32Array.of(6121, 0, 6016, 6116, 21);
            script.intOperands = new Int32Array(5);
            const runner = new ScriptRunner(
                () => script,
                error => {
                    throw error;
                }
            );
            const hook = new HookReq();
            hook.args = [86000];
            const actual: string[] = [];
            for (const active of [false, true])
                for (const supported of [false, true])
                    for (const invalid of [false, true])
                        for (const value of [-1, 0, 1, 2, 3]) {
                            GlRenderer.active = active;
                            GlRenderer.multisampleSupported = supported;
                            GameShell.canvasInvalid = invalid;
                            script.intOperands[1] = value;
                            ScriptRunner.intStack.fill(-701);
                            await runner.ExecuteScript(hook, 100);
                            actual.push([ScriptRunner.intStack[0], ScriptRunner.intStack[1], Preferences.currentAntiAliasingMode, GameShell.canvasInvalid].join(' '));
                        }
            expect(actual).toEqual(control.stdout.toString().trim().split(/\r?\n/));

            const natives = process.env.JOGL_NATIVES_530 || join(dirname(hdGamepackPath), 'natives', 'windows-amd64');
            const native = Bun.spawnSync([...java, dir, natives]);
            expect(native.exitCode, native.stderr.toString()).toBe(0);
            // selection, original 6121, GL_SAMPLE_BUFFERS, GL_SAMPLES
            expect(native.stdout.toString().trim().split(/\r?\n/)).toEqual(['0 1 0 0', '1 1 1 2', '2 1 1 4']);
            const built = await Bun.build({ entrypoints: [join(import.meta.dir, 'antialias-device.ts')], target: 'node', format: 'esm', outdir: dir });
            expect(built.success, built.logs.map(log => log.message).join('\n')).toBe(true);
            const gpu = Bun.spawnSync(['node', built.outputs[0].path, createRequire(import.meta.url).resolve('webgpu'), dir]);
            expect(gpu.exitCode, gpu.stderr.toString()).toBe(0);
            // selection, extension, requested buffers/samples, actual GPU colour/depth/resolve texture sample counts.
            expect(gpu.stdout.toString().trim().split(/\r?\n/)).toEqual(['0 1 0 2 1 1 0', '1 1 1 2 4 4 1', '2 1 1 4 4 4 1']);
            for (const scene of [0, 1]) {
                const image = (backend: string, mode: number) => readFileSync(join(dir, backend + '-' + mode + '-' + scene + '.rgba'));
                for (const mode of [0, 2]) {
                    const nativePixels = image('native', mode);
                    expect(nativePixels.length).toBe(63 * 49 * 4);
                    expect(image('webgpu', mode).equals(nativePixels), 'original RGBA scene ' + scene + ', mode ' + mode).toBe(true);
                }
                // The browser's supported counts are 1 and 4; a JOGL 2-sample request also selects the 4-sample target.
                expect(image('webgpu', 1).equals(image('native', 2))).toBe(true);
                if (scene === 0) {
                    const shades = (data: Buffer) => [...new Set(data.filter((_, i) => i % 4 === 0))].sort((a, b) => a - b);
                    expect(shades(image('native', 0))).toEqual([0, 255]);
                    expect(shades(image('native', 1))).toEqual([0, 188, 255]);
                    expect(shades(image('native', 2))).toEqual([0, 137, 188, 225, 255]);
                }
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000,
    'gl'
);
