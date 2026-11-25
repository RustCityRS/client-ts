import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GpuDevice from '#/gl/driver/GpuDevice.js';
import { registerWebGpuDrawableFactory, webGpuCapsProfile, WebGpuDrawable } from '#/gl/driver/WebGpuDrawableFactory.js';
import { requireNonNull } from '#/util/JavaArray.js';

// Headless Dawn uses the same renderer and WebGPU drawable as the browser.
const webgpu = (await import(pathToFileURL(process.argv[2]).href)) as { create(options: string[]): GPU; globals: object };
Object.assign(globalThis, webgpu.globals);
const root = webgpu.create([]);
const adapter = requireNonNull(await root.requestAdapter({ powerPreference: 'high-performance' }));
const device = await adapter.requestDevice();
const errors: string[] = [];
device.addEventListener('uncapturederror', event => errors.push((event as GPUUncapturedErrorEvent).error.message));
const gpu = GpuDevice.install(device, 'bgra8unorm');
registerWebGpuDrawableFactory(webGpuCapsProfile(device.limits), { device: gpu });
const width = 63,
    height = 49;
const canvas = { getSize: () => ({ width, height }), isDisplayable: () => true };
for (const mode of [0, 1, 2]) {
    const status = await GlRenderer.init(canvas, 2 * mode);
    if (status !== 0) throw new Error('GlRenderer.init ' + status);
    const drawable = GlRenderer['drawable'];
    if (!(drawable instanceof WebGpuDrawable)) throw new Error('Expected WebGPU drawable');
    const targets = requireNonNull(drawable.currentTargets());
    for (let scene = 0; scene < 2; scene++) {
        GlRaster.fillRect(0, 0, width, height, scene === 0 ? 0 : 0x285068);
        GlRaster.drawThickLine(7, 7, 55, 33, scene === 0 ? 0xffffff : 0xc5a197, 7);
        if (scene === 1) GlRaster.drawThickLine(8, 38, 46, 4, 0x0905ba, 3);
        writeFileSync(join(process.argv[3], 'webgpu-' + mode + '-' + scene + '.rgba'), await targets.readBack());
    }
    const caps = drawable.capabilities;
    console.log(
        [mode, +GlRenderer.multisampleSupported, +caps.getSampleBuffers(), caps.getNumSamples(), requireNonNull(targets['back']).sampleCount, requireNonNull(targets['depth']).sampleCount, targets['resolveTexture']?.sampleCount ?? 0].join(' ')
    );
    GlRenderer.shutdown();
}
await device.queue.onSubmittedWorkDone();
if (errors.length !== 0) throw new Error(errors.join('\n'));
device.destroy();
process.exit(0);
