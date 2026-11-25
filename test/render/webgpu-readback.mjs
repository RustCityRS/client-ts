import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { create, globals } from 'webgpu';
import { compareFramebuffers, readWebGpuFramebuffer } from './Framebuffer.ts';
import { gamepackPath } from '../reference.ts';
const readbackPatternWgsl = readFileSync(new URL('../../src/gl/driver/shaders/readbackPattern.wgsl', import.meta.url), 'utf8');

Object.assign(globalThis, globals);
const gpu = create([]);
const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
assert.ok(adapter, 'The 530 GPU comparison requires a WebGPU adapter');
const device = await adapter.requestDevice();
const temp = mkdtempSync(join(tmpdir(), '530-gpu-readback-'));
try {
    const shader = device.createShaderModule({ code: readbackPatternWgsl });
    const pipeline = await device.createComputePipelineAsync({ layout: 'auto', compute: { module: shader, entryPoint: 'main' } });
    const dir = fileURLToPath(new URL('.', import.meta.url));
    execFileSync('javac', ['-cp', gamepackPath, '-d', temp, join(dir, 'FramebufferOracle.java')]);
    const sizes = [
        [1, 1],
        [7, 9],
        [63, 5],
        [64, 5],
        [65, 5],
        [127, 7],
        [128, 7],
        [129, 7],
        [765, 503]
    ];
    const commands = sizes.flatMap(([w, h]) => [`new ${w} ${h} ${0xa9876543 | 0}`, `fill 1 1 13 3 ${0xce234567 | 0}`]);
    const reference = execFileSync('java', ['-cp', temp + delimiter + gamepackPath, 'FramebufferOracle'], {
        input: commands.join('\n') + '\n',
        maxBuffer: 16 * 1024 * 1024
    });
    let cursor = 0,
        compared = 0;
    for (const [width, height] of sizes) {
        const count = width * height,
            pitch = width + 3,
            start = 3;
        cursor += count * 4; // The second JAR frame includes the clipped td.d fill.
        const pixels = Int32Array.from({ length: count }, (_, i) => reference.readInt32LE(cursor + i * 4));
        cursor += count * 4;
        const cpu = { width, height, pitch: width, pixels };
        const buffer = device.createBuffer({ size: (start + pitch * height) * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
        const texture = device.createTexture({ size: { width, height }, format: 'r32uint', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC });
        const params = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        try {
            device.queue.writeBuffer(params, 0, Uint32Array.of(width, height, pitch, start));
            const group = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: params } },
                    { binding: 1, resource: { buffer } },
                    { binding: 2, resource: texture.createView() }
                ]
            });
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginComputePass();
            pass.setPipeline(pipeline);
            pass.setBindGroup(0, group);
            pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
            pass.end();
            device.queue.submit([encoder.finish()]);
            const raw = { buffer, width, height, pitch, offset: start * 4 };
            compareFramebuffers(cpu, await readWebGpuFramebuffer(device, raw));
            compareFramebuffers(cpu, await readWebGpuFramebuffer(device, { texture }));
            compared += count * 8;

            const last = (start + (height - 1) * pitch + width - 1) * 4;
            device.queue.writeBuffer(buffer, last, Int32Array.of(pixels[count - 1] ^ 0x80000000));
            const damaged = await readWebGpuFramebuffer(device, raw);
            assert.throws(
                () => compareFramebuffers(cpu, damaged),
                error => error.message.startsWith(`Pixel (${width - 1}, ${height - 1})`)
            );
            await assert.rejects(readWebGpuFramebuffer(device, { ...raw, offset: 1 }), /invalid byte range/);
            if (width === 1) {
                texture.destroy();
                await assert.rejects(readWebGpuFramebuffer(device, { texture }), /WebGPU framebuffer copy failed/);
            }
        } finally {
            params.destroy();
            texture.destroy();
            buffer.destroy();
        }
    }
    assert.equal(cursor, reference.byteLength);
    console.log(`530 WebGPU readback matched ${compared.toLocaleString('en-US')} bytes from packed buffers and r32uint textures across ${sizes.length} sizes.`);
    console.log([adapter.info.vendor, adapter.info.architecture, adapter.info.description].filter(Boolean).join(' '));
} finally {
    device.destroy();
    rmSync(temp, { recursive: true, force: true });
}
