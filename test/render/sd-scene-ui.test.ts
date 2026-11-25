import { expect, test } from 'bun:test';
import { join } from 'node:path';

test('SD GPU draws every cached crosshair over the normal and instanced native viewports', () => {
    const file = join(import.meta.dir, '..', 'game', 'native-scene-click.test.ts');
    const run = Bun.spawnSync([process.execPath, 'test', file], {
        env: { ...process.env, RS530_NATIVE_SCENE_GPU: '1', RS530_GAMEPACK_IDENTITY: 'sd' },
        timeout: 120000
    });
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    expect(run.stderr.toString()).toMatch(/^\s*2 pass$/m);
}, 125000);
