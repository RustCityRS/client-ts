import { expect, spyOn, test } from 'bun:test';
import { FALLBACK_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import { GLX as E } from '#/gl/driver/GlEnums.js';
import { TextureObject } from '#/gl/driver/TextureObject.js';
import GpuDevice from '#/gl/driver/GpuDevice.js';
import type SurfaceTargets from '#/gl/driver/SurfaceTargets.js';
import WebGpuGL from '#/gl/driver/WebGpuGL.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';
import { requireNonNull } from '#/util/JavaArray.js';

interface UniformSlot {
    buffer: GPUBuffer;
    offset: number;
    size: number;
}

// Record the immutable bindings at draw time, then read their modelview[0] word from GPU storage
// at submit time. This detects later draws overwriting an earlier slot before the GPU reads it.
function recordingDevice() {
    const pending: UniformSlot[] = [];
    const submissions: number[][] = [];
    const stores = new Map<GPUBuffer, Uint8Array>();
    let bound: UniformSlot | null = null;

    const device = {
        lost: new Promise(() => {}),
        limits: { minUniformBufferOffsetAlignment: 256 },
        createBuffer(descriptor: GPUBufferDescriptor) {
            // Exercise the real queue.writeBuffer path when mapped upload pages are unavailable.
            if (descriptor.mappedAtCreation) throw new Error('Mapped buffers unavailable');
            const buffer = { size: descriptor.size } as GPUBuffer;
            stores.set(buffer, new Uint8Array(descriptor.size));
            return buffer;
        },
        createShaderModule: () => ({}),
        createBindGroupLayout: () => ({}),
        createPipelineLayout: () => ({}),
        createRenderPipeline: () => ({}),
        createBindGroup: (description: GPUBindGroupDescriptor) => description,
        createCommandEncoder: () => ({ finish: () => ({}) }),
        queue: {
            writeBuffer(buffer: GPUBuffer, offset: number, bytes: ArrayBuffer, start: number, size: number) {
                requireNonNull(stores.get(buffer)).set(new Uint8Array(bytes, start, size), offset);
            },
            submit() {
                submissions.push(
                    pending.splice(0).map(slot => {
                        const bytes = requireNonNull(stores.get(slot.buffer));
                        return new DataView(bytes.buffer).getUint32(slot.offset, true);
                    })
                );
            }
        }
    };
    const gpu = new GpuDevice(device as unknown as GPUDevice, 'bgra8unorm');
    const pass = {
        setBindGroup(index: number, group: { entries: { resource: GPUBufferBinding }[] }, offset: number) {
            if (index !== 1) return;
            const { buffer, size } = group.entries[0].resource;
            bound = { buffer, offset, size: requireNonNull(size) };
        },
        drawIndexed() {
            pending.push(requireNonNull(bound));
        },
        setPipeline() {},
        setVertexBuffer() {},
        setIndexBuffer() {},
        setViewport() {},
        setScissorRect() {}
    };
    const target = {
        width: 80,
        height: 60,
        sampleCount: 1,
        alphaBits: 8,
        currentPass() {
            gpu.getEncoder();
            return pass;
        }
    };
    const gl = new WebGpuGL(FALLBACK_CAPS_PROFILE, true, {
        gpu,
        alphaBits: 8,
        targets: () => target as unknown as SurfaceTargets,
        front() {
            throw new Error('Unexpected front buffer access');
        }
    });
    function bytes(slot: UniformSlot): Uint8Array {
        return requireNonNull(stores.get(slot.buffer)).subarray(slot.offset, slot.offset + slot.size);
    }
    return { gl, gpu, submissions, bytes, lastDraw: () => requireNonNull(pending.at(-1)) };
}

// Compare all shader-visible bytes, including words carried across inactive lights and enabled
// arrays. The control regenerates all fields, even when only the modelview or projection changed.
function compareTransformUpdates(): void {
    const fast = recordingDevice(),
        full = recordingDevice(),
        indices = ByteBuffer.allocateDirect(12);
    const fastSlots: UniformSlot[] = [],
        fullSlots: UniformSlot[] = [];
    for (const { gl } of [fast, full]) {
        gl.glViewport(0, 0, 80, 60);
        gl.glEnableClientState(E.GL_VERTEX_ARRAY);
        gl.glVertexPointer(3, E.GL_FLOAT, 0, ByteBuffer.allocateDirect(12));
        gl.glEnable(E.GL_LIGHTING);
        gl.glEnable(E.GL_LIGHT0);
        const texture = new TextureObject(2, E.GL_TEXTURE_2D);
        texture.setImage(0, 0, { width: 1, height: 1, depth: 1, border: 0, internalFormat: E.GL_RGBA, base: E.GL_RGBA, data: Uint8Array.of(1, 2, 3, 255) });
        const handle = { createView: () => ({}) } as unknown as GPUTexture,
            sampler = {} as GPUSampler;
        gl.effectiveTexture = unit => (unit === 0 ? texture : null);
        gl.realizeTexture = () => handle;
        texture.sampler = () => sampler;
    }
    function draw(change: (gl: WebGpuGL) => void): void {
        for (const device of [fast, full]) {
            change(device.gl);
            if (device === full) device.gl.state.uniformRevision++;
            device.gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices);
            (device === fast ? fastSlots : fullSlots).push(device.lastDraw());
        }
    }
    const fastTextures = spyOn(fast.gl.state, 'textureMatrix');
    draw(() => {});
    const first = fastTextures.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    draw(gl => {
        gl.glPushMatrix();
        gl.glTranslatef(1, -7, 993);
    });
    draw(gl => gl.glRotatef(45, 1, 0, 0));
    draw(gl => {
        gl.glMatrixMode(E.GL_PROJECTION);
        gl.glScalef(-2, 0, 1);
    });
    draw(gl => {
        gl.glLoadIdentity();
        gl.glMatrixMode(E.GL_MODELVIEW);
        gl.glPopMatrix();
    });
    expect(fastTextures.mock.calls.length).toBe(first);
    draw(gl => {
        gl.glMatrixMode(E.GL_TEXTURE);
        gl.glTranslatef(3, 5, -2);
        gl.glMatrixMode(E.GL_MODELVIEW);
    });
    expect(fastTextures.mock.calls.length).toBe(first + 1);
    draw(gl => gl.glColor4f(-0, 1, -0.25, 0.5));
    draw(gl => gl.glLightfv(E.GL_LIGHT0, E.GL_POSITION, Float32Array.of(4, -7, 13, 1), 0));
    draw(gl => gl.glDisable(E.GL_LIGHT0));
    draw(gl => gl.glTranslatef(99, 12, -14));
    draw(gl => {
        gl.glEnable(E.GL_FOG);
        gl.glFogf(E.GL_FOG_END, 81);
    });
    draw(gl => gl.glEnable(E.GL_LIGHT0));
    draw(gl => gl.glDisable(E.GL_LIGHTING));
    draw(gl => gl.glRotatef(182, 0, 1, 0));
    draw(gl => gl.glEnable(E.GL_LIGHTING));
    draw(gl => {
        gl.glMatrixMode(E.GL_PROJECTION);
        gl.glTranslatef(-4, 2, 1);
    });
    // Interrupt a transform refresh after its first matrices have been staged, then retry.
    const rotate = (gl: WebGpuGL) => {
        gl.glMatrixMode(E.GL_MODELVIEW);
        gl.glRotatef(37, 0, 0, 1);
    };
    rotate(fast.gl);
    rotate(full.gl);
    const inverse = spyOn(fast.gl.state, 'modelviewInverse').mockImplementationOnce(() => {
        throw new Error('injected inverse failure');
    });
    expect(() => fast.gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, indices)).toThrow('injected inverse failure');
    inverse.mockRestore();
    const beforeRetry = fastTextures.mock.calls.length;
    draw(() => {});
    expect(fastTextures.mock.calls.length).toBe(beforeRetry + 1);
    fast.gpu.submit();
    full.gpu.submit();
    fastTextures.mockRestore();
    for (const [i, slot] of fastSlots.entries()) {
        expect(Buffer.compare(fast.bytes(slot), full.bytes(fullSlots[i])), 'uniform slot ' + i).toBe(0);
    }
}

function withWebGpuEnums(run: () => void): void {
    // Bun has no WebGPU globals. Scope the enum constants to this synchronous test.
    const constants = {
        GPUBufferUsage: { MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64 },
        GPUShaderStage: { VERTEX: 1, FRAGMENT: 2 },
        GPUColorWrite: { RED: 1, GREEN: 2, BLUE: 4, ALL: 15 }
    };
    const installed = Object.entries(constants).filter(([name]) => !(name in globalThis));
    try {
        for (const [name, value] of installed) Object.defineProperty(globalThis, name, { configurable: true, value });
        run();
    } finally {
        for (const [name] of installed) Reflect.deleteProperty(globalThis, name);
    }
}

test('matrix-only indexed draws retain the exact full uniform block across light, fog and texture changes', () => {
    withWebGpuEnums(compareTransformUpdates);
});

test('indexed draws reuse identical uniform bits until submit and preserve earlier slots through stream rollover', () => {
    withWebGpuEnums(() => {
        const { gl, gpu, submissions, lastDraw } = recordingDevice();
        const staged = spyOn(gpu, 'stageDrawBytes');
        gl.glViewport(0, 0, 80, 60);
        gl.glEnableClientState(E.GL_VERTEX_ARRAY);
        gl.glVertexPointer(3, E.GL_FLOAT, 0, ByteBuffer.allocateDirect(12));

        const triangle = ByteBuffer.allocateDirect(12);
        const matrix = new Float32Array(16);
        matrix[5] = matrix[10] = matrix[15] = 1;
        const words = new Uint32Array(matrix.buffer);
        function draw(word: number, indices = triangle): UniformSlot {
            words[0] = word;
            gl.glLoadMatrixf(matrix, 0);
            gl.glDrawElements(E.GL_TRIANGLES, indices.capacity() / 4, E.GL_UNSIGNED_INT, indices);
            return lastDraw();
        }
        const sameSlot = (a: UniformSlot, b: UniformSlot) => a.buffer === b.buffer && a.offset === b.offset;
        const negativeZero = 0x80000000;
        const nan1 = 0x7fc12345,
            nan2 = 0x7fc12346;
        const zero = draw(0);
        expect(sameSlot(draw(0), zero)).toBe(true);
        const negative = draw(negativeZero);
        expect(sameSlot(negative, zero)).toBe(false);
        const firstNan = draw(nan1);
        expect(sameSlot(firstNan, negative)).toBe(false);
        expect(sameSlot(draw(nan1), firstNan)).toBe(true);
        const secondNan = draw(nan2);
        expect(sameSlot(secondNan, firstNan)).toBe(false);

        gl.glEnable(E.GL_LIGHTING);
        const lit = draw(nan2);
        expect(sameSlot(lit, secondNan)).toBe(false);
        expect(sameSlot(draw(nan2), lit)).toBe(true);
        gl.glDisable(E.GL_LIGHTING);
        expect(sameSlot(draw(nan2), secondNan)).toBe(true);
        // 262,143 zero indices form complete triangles and fill a fresh 1 MiB stream chunk.
        expect(sameSlot(draw(nan2, ByteBuffer.allocateDirect(1024 * 1024 - 4)), secondNan)).toBe(true);
        expect(draw(0).buffer).not.toBe(secondNan.buffer);
        gpu.submit();

        const uploadsBefore = staged.mock.calls.length;
        const nextFrame = draw(0);
        expect(staged.mock.calls.slice(uploadsBefore).some(([buffer, offset, source]) => buffer === nextFrame.buffer && offset === nextFrame.offset && source.byteLength === nextFrame.size)).toBe(true);
        staged.mockRestore();
        expect(sameSlot(draw(0), nextFrame)).toBe(true);
        gpu.submit();
        expect(submissions).toEqual([
            [0, 0, negativeZero, nan1, nan1, nan2, nan2, nan2, nan2, nan2, 0],
            [0, 0]
        ]);

        // The last draw used a client pointer. Both its potentially large NIO array and the
        // index bytes must be collectible as soon as the client replaces its pointers.
        const renderer = gl['indexed'];
        expect(renderer['clientBuffers'].size).toBe(0);
        expect(renderer['indexRange'].data).toBeUndefined();
        const texture = new TextureObject(1, E.GL_TEXTURE_2D);
        texture.setImage(0, 0, { width: 1, height: 1, depth: 1, border: 0, internalFormat: E.GL_RGBA, base: E.GL_RGBA, data: Uint8Array.of(11, 22, 33, 255) });
        const handle = { createView: () => ({}) } as unknown as GPUTexture;
        gl.effectiveTexture = unit => (unit === 0 ? texture : null);
        gl.realizeTexture = () => handle;
        texture.sampler = () => {
            throw new Error('injected sampler failure');
        };
        expect(() => draw(0)).toThrow('injected sampler failure');
        expect(renderer['drawTextures'].every(resource => resource === undefined)).toBe(true);
        expect(renderer['lastInput']).toBeUndefined();
        texture.sampler = () => ({}) as GPUSampler;
        draw(0);
        expect(renderer['drawTextures']).toEqual([undefined, undefined]);
        expect(renderer['clientBuffers'].size).toBe(0);
    });
});
