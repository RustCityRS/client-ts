/** Packed td.g pixel words. A GPU readback can have trailing padding on each row. */
export interface Framebuffer {
    width: number;
    height: number;
    pitch: number;
    pixels: Int32Array;
}

function activeWords(width: number, height: number, pitch: number, name: string): number {
    if (![width, height, pitch].every(Number.isSafeInteger) || width < 0 || height < 0 || pitch < width) throw new RangeError(name + ' has invalid framebuffer dimensions');
    const used = height === 0 || width === 0 ? 0 : (height - 1) * pitch + width;
    if (!Number.isSafeInteger(used * 4)) throw new RangeError(name + ' exceeds the byte address range');
    return used;
}

function validate(frame: Framebuffer, name: string): void {
    if (frame.pixels.length < activeWords(frame.width, frame.height, frame.pitch, name)) throw new RangeError(name + ' is missing active pixels');
}

function hex(pixel: number): string {
    return '0x' + (pixel >>> 0).toString(16).padStart(8, '0');
}

export function compareFramebuffers(reference: Framebuffer, actual: Framebuffer): void {
    validate(reference, 'reference');
    validate(actual, 'readback');
    if (reference.width !== actual.width || reference.height !== actual.height) {
        throw new Error(`Framebuffer dimensions differ, expected ${reference.width}×${reference.height}, received ${actual.width}×${actual.height}`);
    }
    for (let y = 0; y < reference.height; y++) {
        for (let x = 0; x < reference.width; x++) {
            const expected = reference.pixels[y * reference.pitch + x];
            const received = actual.pixels[y * actual.pitch + x];
            if (expected !== received) throw new Error(`Pixel (${x}, ${y}) expected ${hex(expected)}, received ${hex(received)}`);
        }
    }
}

/** Raw 530 td.g pixel words before conversion to a display format. Pitch is in words, offset in bytes. */
export type WebGpuFramebuffer = { buffer: GPUBuffer; width: number; height: number; pitch: number; offset?: number } | { texture: GPUTexture };

export async function readWebGpuFramebuffer(device: GPUDevice, source: WebGpuFramebuffer): Promise<Framebuffer> {
    let width: number, height: number, pitch: number;
    if ('texture' in source) {
        const texture = source.texture;
        if (texture.format !== 'r32uint' || texture.dimension !== '2d' || texture.depthOrArrayLayers !== 1 || texture.sampleCount !== 1) {
            throw new RangeError('Expected a single-sampled 2D r32uint framebuffer');
        }
        if (!(texture.usage & GPUTextureUsage.COPY_SRC)) throw new Error('Framebuffer texture requires COPY_SRC');
        width = texture.width;
        height = texture.height;
        pitch = Math.ceil(width / 64) * 64; // copyTextureToBuffer aligns each row to 256 bytes.
    } else {
        ({ width, height, pitch } = source);
        if (!(source.buffer.usage & GPUBufferUsage.COPY_SRC)) throw new Error('Framebuffer buffer requires COPY_SRC');
    }
    const bytes = activeWords(width, height, pitch, 'GPU target') * 4;
    const offset = 'buffer' in source ? (source.offset ?? 0) : 0;
    if ('buffer' in source && (!Number.isSafeInteger(offset) || offset < 0 || offset % 4 !== 0 || bytes > source.buffer.size - offset)) {
        throw new RangeError('Framebuffer buffer has an invalid byte range');
    }
    if (bytes === 0) return { width, height, pitch, pixels: new Int32Array() };

    let staging: GPUBuffer | undefined;
    try {
        device.pushErrorScope('validation');
        let submission: { buffer: GPUBuffer } | { cause: unknown };
        try {
            staging = device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
            const encoder = device.createCommandEncoder();
            if ('texture' in source) {
                encoder.copyTextureToBuffer({ texture: source.texture }, { buffer: staging, bytesPerRow: pitch * 4 }, { width, height });
            } else {
                encoder.copyBufferToBuffer(source.buffer, offset, staging, 0, bytes);
            }
            device.queue.submit([encoder.finish()]);
            submission = { buffer: staging };
        } catch (cause) {
            submission = { cause };
        }
        const error = await device.popErrorScope();
        if (error !== null) throw new Error('WebGPU framebuffer copy failed: ' + error.message);
        if ('cause' in submission) throw submission.cause;
        await submission.buffer.mapAsync(GPUMapMode.READ);
        const pixels = new Int32Array(submission.buffer.getMappedRange()).slice();
        return { width, height, pitch, pixels };
    } finally {
        staging?.destroy(); // Also unmaps after copying into the owning Int32Array.
    }
}
