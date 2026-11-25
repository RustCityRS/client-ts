import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { gamepackPath } from './reference.js';

// The renderer currently hands geometry to MapBuildLoop as one operation.
// Preserve the precise native call boundaries so its cutover can enable the
// first two resets without clearing resources again during a pending build.
test('original map build brackets the scene phases with three cache resets after the archive and model gates', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-gj-reset-'));
    try {
        const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const java = ['java', ...asm, '-cp', dir + delimiter + gamepackPath, 'MapBuildResetOrderOracle'];
        for (const cmd of [
            ['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/MapBuildResetOrderOracle.java')],
            [...java, dir]
        ]) {
            const completed = Bun.spawnSync(cmd);
            expect(completed.exitCode, completed.stderr.toString()).toBe(0);
        }
        const rows: number[][] = [];
        for (const stage of [0, 1, 2])
            for (const dynamic of [0, 1])
                for (const npcs of [0, 1]) {
                    for (const levels of [0, 1])
                        for (const fail of [0, 1, 2, 3]) {
                            for (const mutate of [0, 1, 2, 3]) for (const oldStage of [0, 1, 2]) rows.push([stage, dynamic, npcs, levels, fail, mutate, oldStage]);
                        }
                }
        const response = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
        expect(response.exitCode, response.stderr.toString()).toBe(0);
        const lines = response.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(rows.length);
        for (const [i, [stage, dynamic, npcs, levels, fail, mutate, oldStage]] of rows.entries()) {
            const calls = ['start'];
            let mask = 1;
            if (stage === 1) calls.push('missing');
            else {
                calls.push('models');
                if (stage !== 2) {
                    if (oldStage !== 0) calls.push('message');
                    calls.push('audio', 'reset1');
                    if (fail !== 1) {
                        mask = 0;
                        calls.push('world', 'clip0', 'clip1', 'clip2', 'clip3', 'sounds', 'audio', 'gc', 'keep', 'init');
                        if (!dynamic) {
                            calls.push('land', 'keep', 'locs');
                            if ((npcs && mutate !== 2) || mutate === 3) calls.push('npcs');
                        }
                        if (dynamic || mutate === 1) calls.push('dynamicLand', 'keep', 'dynamicLocs');
                        calls.push('reset2');
                        if (fail !== 2) calls.push('keep', 'finish', 'keep', 'levels', 'base' + (levels ? 0 : 2), 'quit', 'tiles', 'roofs', 'audio', 'correct', 'reset3');
                    }
                }
            }
            expect(lines[i], rows[i].join(' ')).toBe([stage || oldStage, mask, calls.join(',')].join('/'));
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
