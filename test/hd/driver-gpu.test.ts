import { expect, test } from 'bun:test';
import { runDriverNode } from './driver-node.js';

// WebGpuGL driver v1 on a real device (HD batch H1, HD_PLAN 4 "Driver v1"): headless Dawn under node. Clear-colour
// frames read back exactly, the scissored clear quad, clears under DepthMask(false), swaps that keep the back buffer,
// presentation into an opaque canvas, texture-object uploads (2D mip chain, 3D LUMINANCE_ALPHA, 1D ALPHA, cube ALPHA),
// VBO renaming on write after use, and the context lifecycle. AA 0/2/4 map to 1/4/4 samples.

const report = await runDriverNode('gpu');

test('node runner completed', () => {
    expect(report.exitCode, report.output).toBe(0);
    expect(report.checks.length).toBeGreaterThan(40);
});

for (const c of report.checks) {
    test(c.name, () => {
        expect(c.ok, c.detail).toBe(true);
    });
}
