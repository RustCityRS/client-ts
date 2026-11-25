import type { SdRasterFrame } from './SdRasterSpans';
import { sdRasterShader } from '#/gl/driver/shaders/sdRaster.wgsl';
import { requireNonNull } from '#/util/JavaArray';

const pipelines = new WeakMap<GPUDevice, Promise<GPUComputePipeline>>();

function framebufferSize(frame: SdRasterFrame): number {
    return frame.feedback?.reduce((end, image) => Math.max(end, image.offset * 4 + image.pixels.byteLength), frame.initial.byteLength) ?? frame.initial.byteLength;
}

function scanlinePipeline(device: GPUDevice): Promise<GPUComputePipeline> {
    let pipeline = pipelines.get(device);
    if (pipeline === undefined) {
        const module = device.createShaderModule({ label: '530 dc scanlines', code: sdRasterShader });
        const group = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage', hasDynamicOffset: true } }
            ]
        });
        pipeline = device.createComputePipelineAsync({ layout: device.createPipelineLayout({ bindGroupLayouts: [group] }), compute: { module, entryPoint: 'main' } });
        pipelines.set(device, pipeline);
        pipeline.catch(() => pipelines.delete(device));
    }
    return pipeline;
}

// Scratch for the browser's serialized frame loop. The framebuffer and staging allocation
// also contain the native PixScreen sentinel word following the last visible row.
export class SdWebGpuRaster {
    private target?: GPUBuffer;
    private assets?: GPUBuffer;
    private packedAssetSource?: ArrayBufferLike;
    private packedAssetRevision = -1;
    private packedAssetLength = 0;
    private commands?: GPUBuffer;
    private staging?: GPUBuffer;
    private group?: GPUBindGroup;
    private groupBytes = 0;
    private shader?: GPUComputePipeline;
    private readonly oneOffset = new Uint32Array(1);
    private readonly feedback = new Map<Int32Array, GPUBuffer>();

    constructor(private readonly device: GPUDevice) {}

    private buffer(previous: GPUBuffer | undefined, bytes: number, usage: GPUBufferUsageFlags, label: string): GPUBuffer {
        if (previous && previous.size >= bytes) return previous;
        const buffer = this.device.createBuffer({ label, size: bytes, usage });
        previous?.destroy();
        this.group = undefined;
        return buffer;
    }

    async prepare(): Promise<void> {
        this.shader ??= await scanlinePipeline(this.device);
    }

    // The capture is serialized by the game loop. Queue writes consume the input arrays
    // immediately, so the recorder can reuse them as soon as this method returns.
    drawResident(frame: SdRasterFrame, initialize: boolean, present?: (buffer: GPUBuffer, encoder: GPUCommandEncoder) => void): GPUBuffer {
        const device = this.device,
            shader = this.shader;
        if (!shader) throw new Error('SD scanline pipeline is unprepared');
        const commandBytes = frame.batches.reduce((size, batch) => Math.max(size, batch.byteLength), 4);
        const bytes = framebufferSize(frame);
        const largest = Math.max(bytes, frame.assets.byteLength, commandBytes);
        if (largest > Math.min(device.limits.maxStorageBufferBindingSize, device.limits.maxBufferSize) || frame.height > device.limits.maxComputeWorkgroupsPerDimension) throw new RangeError('SD frame exceeds WebGPU device limits');
        const storage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
        const old = this.target;
        if (!old || old.size < bytes) {
            this.target = device.createBuffer({ label: '530 SD pixels', size: bytes, usage: storage | GPUBufferUsage.COPY_SRC });
            this.group = undefined;
            if (old) {
                if (!initialize) {
                    const copy = device.createCommandEncoder();
                    copy.copyBufferToBuffer(old, 0, this.target, 0, old.size);
                    device.queue.submit([copy.finish()]);
                }
                old.destroy();
            }
        }
        const target = requireNonNull(this.target);
        if (!old || initialize) device.queue.writeBuffer(target, 0, frame.initial.buffer, frame.initial.byteOffset, frame.initial.byteLength);
        if (frame.feedback)
            for (const { offset, pixels } of frame.feedback) {
                device.queue.writeBuffer(target, offset * 4, pixels.buffer, pixels.byteOffset, pixels.byteLength);
            }
        if (frame.batches.length === 0) {
            if (present) {
                const encoder = device.createCommandEncoder();
                present(target, encoder);
                device.queue.submit([encoder.finish()]);
            }
            return target;
        }

        const previousAssets = this.assets;
        const assets = (this.assets = this.buffer(previousAssets, Math.max(4, frame.assets.byteLength), storage, '530 SD palette and texels'));
        const changes = frame.assetChanges;
        let first = 0,
            end = frame.assets.length;
        if (assets === previousAssets && changes && frame.assets.buffer === this.packedAssetSource && changes.revision === this.packedAssetRevision + 1) {
            first = changes.start;
            end = changes.end;
            if (frame.assets.length > this.packedAssetLength) {
                first = Math.min(first, this.packedAssetLength);
                end = frame.assets.length;
            }
        }
        if (first < end) device.queue.writeBuffer(assets, first * 4, frame.assets.buffer, frame.assets.byteOffset + first * 4, (end - first) * 4);
        this.packedAssetSource = changes ? frame.assets.buffer : undefined;
        this.packedAssetRevision = changes?.revision ?? -1;
        this.packedAssetLength = frame.assets.length;
        const align = device.limits.minStorageBufferOffsetAlignment;
        const limit = Math.min(device.limits.maxBufferSize, Math.max(8 * 1024 * 1024, commandBytes));
        let total = commandBytes;
        for (let i = 0; i + 1 < frame.batches.length && total < limit; i++) {
            total += Math.ceil(frame.batches[i].byteLength / align) * align;
        }
        const commands = (this.commands = this.buffer(this.commands, Math.min(total, limit), storage, '530 dc spans'));
        if (!this.group || this.groupBytes !== commandBytes) {
            this.group = device.createBindGroup({
                layout: shader.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: target } },
                    { binding: 1, resource: { buffer: assets } },
                    { binding: 2, resource: { buffer: commands, size: commandBytes } }
                ]
            });
            this.groupBytes = commandBytes;
        }
        let next = 0;
        while (next < frame.batches.length) {
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginComputePass();
            pass.setPipeline(shader);
            let offset = 0;
            let first = frame.batches[next],
                startOffset = 0,
                length = 0;
            do {
                const batch = frame.batches[next++];
                // Resident capture blocks already hold neighbouring batches with the device's
                // required padding. Upload each contiguous block once without making a JS copy.
                if (batch.buffer !== first.buffer || batch.byteOffset - first.byteOffset !== offset - startOffset) {
                    device.queue.writeBuffer(commands, startOffset, first.buffer, first.byteOffset, length);
                    first = batch;
                    startOffset = offset;
                }
                length = offset - startOffset + batch.byteLength;
                this.oneOffset[0] = offset;
                pass.setBindGroup(0, this.group, this.oneOffset, 0, 1);
                pass.dispatchWorkgroups(1, frame.height);
                offset += Math.ceil(batch.byteLength / align) * align;
            } while (next < frame.batches.length && offset + commandBytes <= commands.size);
            device.queue.writeBuffer(commands, startOffset, first.buffer, first.byteOffset, length);
            pass.end();
            if (next === frame.batches.length && frame.feedback)
                for (const { pixels, offset: word } of frame.feedback) {
                    let side = this.feedback.get(pixels);
                    if (!side) {
                        side = device.createBuffer({ label: '530 SD sampled image', size: pixels.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
                        this.feedback.set(pixels, side);
                    }
                    encoder.copyBufferToBuffer(target, word * 4, side, 0, pixels.byteLength);
                }
            if (next === frame.batches.length) present?.(target, encoder);
            device.queue.submit([encoder.finish()]);
        }
        return target;
    }

    private async render(frame: SdRasterFrame): Promise<GPUBuffer> {
        await this.prepare();
        this.device.pushErrorScope('validation');
        let result: { buffer: GPUBuffer } | { failure: unknown };
        try {
            result = { buffer: this.drawResident(frame, true) };
        } catch (failure) {
            result = { failure };
        }
        const error = await this.device.popErrorScope();
        if (error !== null) throw new Error('SD WebGPU rasterization failed: ' + error.message);
        if ('failure' in result) throw result.failure;
        return result.buffer;
    }

    // PixScreen is also the Java backing image: callers can read it or draw only dirty rectangles.
    // Commit these exact words before the original AWT presentation and before the next game tick.
    async update(frame: SdRasterFrame, pixels: Int32Array): Promise<void> {
        if (frame.batches.length === 0) return;
        await this.render(frame);
        await this.syncToCpu(pixels);
    }

    async syncToCpu(pixels: Int32Array): Promise<void> {
        if (!this.target) return;
        let bytes = pixels.byteLength;
        for (const words of this.feedback.keys()) bytes += words.byteLength;
        const staging = (this.staging = this.buffer(this.staging, bytes, GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ, '530 SD framebuffer readback'));
        const encoder = this.device.createCommandEncoder();
        encoder.copyBufferToBuffer(this.target, 0, staging, 0, pixels.byteLength);
        let offset = pixels.byteLength;
        for (const [words, side] of this.feedback) {
            encoder.copyBufferToBuffer(side, 0, staging, offset, words.byteLength);
            offset += words.byteLength;
        }
        this.device.queue.submit([encoder.finish()]);
        await staging.mapAsync(GPUMapMode.READ, 0, bytes);
        try {
            const result = new Int32Array(staging.getMappedRange(0, bytes));
            pixels.set(result.subarray(0, pixels.length));
            let word = pixels.length;
            for (const data of this.feedback.keys()) {
                data.set(result.subarray(word, word + data.length));
                word += data.length;
            }
        } finally {
            staging.unmap();
        }
    }

    // Standalone captures transfer ownership of their packed framebuffer to the caller.
    async take(frame: SdRasterFrame): Promise<GPUBuffer> {
        const target = await this.render(frame);
        this.target = undefined;
        this.group = undefined;
        return target;
    }

    dispose(): void {
        for (const side of this.feedback.values()) side.destroy();
        this.feedback.clear();
        this.target?.destroy();
        this.assets?.destroy();
        this.commands?.destroy();
        this.staging?.destroy();
        this.target = this.assets = this.commands = this.staging = undefined;
        this.packedAssetSource = undefined;
        this.group = undefined;
    }
}

export async function rasterizeSdFrame(device: GPUDevice, frame: SdRasterFrame): Promise<GPUBuffer> {
    const raster = new SdWebGpuRaster(device);
    try {
        return await raster.take(frame);
    } finally {
        raster.dispose();
    }
}
