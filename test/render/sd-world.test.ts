import { expect, test } from 'bun:test';
import { join } from 'node:path';

test('SD WebGPU shades every pixel of both original JAR Lumbridge viewports', () => {
    const file = join(import.meta.dir, '..', 'finish-build.test.ts');
    const run = Bun.spawnSync([process.execPath, 'test', file], {
        env: { ...process.env, RS530_SD_GPU_WORLD: '1', RS530_LOGIN_FIXTURE: file, RS530_GAMEPACK_IDENTITY: 'sd' },
        timeout: 90000
    });
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    expect(run.stderr.toString()).toMatch(/^\s*1 pass$/m);
}, 95000);
