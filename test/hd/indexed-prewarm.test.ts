import { afterAll, beforeAll, expect, test } from 'bun:test';
import { FALLBACK_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import { GLX as E } from '#/gl/driver/GlEnums.js';
import GpuDevice from '#/gl/driver/GpuDevice.js';
import type SurfaceTargets from '#/gl/driver/SurfaceTargets.js';
import { TextureObject } from '#/gl/driver/TextureObject.js';
import WebGpuGL from '#/gl/driver/WebGpuGL.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';

const constants = {
    GPUBufferUsage: { MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64 },
    GPUShaderStage: { VERTEX: 1, FRAGMENT: 2 },
    GPUColorWrite: { RED: 1, GREEN: 2, BLUE: 4, ALL: 15 }
};
const missing = Object.entries(constants).filter(([name]) => !(name in globalThis));
beforeAll(() => {
    for (const [name, value] of missing) Object.defineProperty(globalThis, name, { configurable: true, value });
});
afterAll(() => {
    for (const [name] of missing) Reflect.deleteProperty(globalThis, name);
});

function scene(compile: (n: number) => Promise<object>) {
    const async: GPURenderPipelineDescriptor[] = [],
        sync: GPURenderPipelineDescriptor[] = [],
        used: object[] = [];
    const lost = Promise.withResolvers<GPUDeviceLostInfo>();
    const device = {
        lost: lost.promise,
        limits: { minUniformBufferOffsetAlignment: 256 },
        createShaderModule: (d: GPUShaderModuleDescriptor) => d,
        createBindGroupLayout: (d: GPUBindGroupLayoutDescriptor) => d,
        createPipelineLayout: (d: GPUPipelineLayoutDescriptor) => d,
        createBindGroup: () => ({}),
        createBuffer(d: GPUBufferDescriptor) {
            if (d.mappedAtCreation) throw new Error('queue writes only');
            return { size: d.size };
        },
        createRenderPipeline(d: GPURenderPipelineDescriptor) {
            sync.push(d);
            return d;
        },
        createRenderPipelineAsync(d: GPURenderPipelineDescriptor) {
            async.push(d);
            return compile(async.length);
        }
    };
    const gpu = new GpuDevice(device as unknown as GPUDevice, 'bgra8unorm');
    const pass = {
        setPipeline(p: object) {
            used.push(p);
        },
        setBindGroup() {},
        setVertexBuffer() {},
        setIndexBuffer() {},
        setViewport() {},
        setScissorRect() {},
        drawIndexed() {}
    };
    const target = { width: 80, height: 60, sampleCount: 4, alphaBits: 0, currentPass: () => pass };
    const gl = new WebGpuGL(FALLBACK_CAPS_PROFILE, true, {
        gpu,
        alphaBits: 0,
        targets: () => target as unknown as SurfaceTargets,
        front: () => {
            throw new Error('unexpected front buffer');
        }
    });
    // Native title VBO layout, with client pointers sharing the same interleaved source.
    gl.glViewport(0, 0, 80, 60);
    for (const cap of [E.GL_CULL_FACE, E.GL_DEPTH_TEST, E.GL_LIGHTING, E.GL_COLOR_MATERIAL, E.GL_FOG, E.GL_BLEND, E.GL_ALPHA_TEST]) gl.glEnable(cap);
    gl.glDepthFunc(E.GL_LEQUAL);
    gl.glAlphaFunc(E.GL_GREATER, 0);
    gl.glFogi(E.GL_FOG_MODE, E.GL_LINEAR);
    gl.glBlendFunc(E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA);
    for (const cap of [E.GL_VERTEX_ARRAY, E.GL_COLOR_ARRAY, E.GL_NORMAL_ARRAY, E.GL_TEXTURE_COORD_ARRAY]) gl.glEnableClientState(cap);
    const v = ByteBuffer.allocateDirect(36),
        i = ByteBuffer.allocateDirect(12);
    gl.glVertexPointer(3, E.GL_FLOAT, 36, v);
    v.position(12);
    gl.glColorPointer(4, E.GL_UNSIGNED_BYTE, 36, v);
    v.position(16);
    gl.glNormalPointer(E.GL_FLOAT, 36, v);
    v.position(28);
    gl.glTexCoordPointer(2, E.GL_FLOAT, 36, v);
    return { gl, lost, async, sync, used, draw: () => gl.glDrawElements(E.GL_TRIANGLES, 3, E.GL_UNSIGNED_INT, i) };
}

test('pending first-use draw creates the identical pipeline, and wins the race with compilation', async () => {
    const compiling = Promise.withResolvers<void>(),
        pending = Promise.withResolvers<object>();
    const s = scene(n => {
        if (n !== 5) return Promise.resolve({});
        compiling.resolve();
        return pending.promise;
    });
    const warm = s.gl.prewarmIndexedPipelines(4);
    expect(s.async).toHaveLength(0);
    await compiling.promise;
    s.draw();
    expect(s.sync).toHaveLength(1);
    expect(s.sync[0]).toEqual(s.async[4]);
    expect(s.sync[0].vertex.module).toBe(s.async[4].vertex.module);
    expect(s.sync[0].layout).toBe(s.async[4].layout);
    pending.resolve({});
    await warm;
    s.draw();
    expect(s.used[1]).toBe(s.used[0]);
    expect(s.sync).toHaveLength(1);
    s.gl.glDepthFunc(E.GL_GEQUAL);
    s.draw();
    expect(s.sync).toHaveLength(2);
    expect(s.sync[1].depthStencil?.depthCompare).toBe('greater-equal');
});

test('indexed pipeline cache distinguishes texture targets, base formats, texgen coordinates and texture units', () => {
    const s = scene(async () => ({}));
    const handle = { createView: () => ({}) } as unknown as GPUTexture;
    const sampler = {} as GPUSampler;
    s.gl.realizeTexture = () => handle;
    const targets = [E.GL_TEXTURE_1D, E.GL_TEXTURE_2D, E.GL_TEXTURE_3D, E.GL_TEXTURE_CUBE_MAP] as const;
    const formats = [E.GL_ALPHA, E.GL_RGBA, E.GL_LUMINANCE, E.GL_LUMINANCE_ALPHA] as const;
    const modes = [0, E.GL_OBJECT_LINEAR, E.GL_EYE_LINEAR, E.GL_NORMAL_MAP];
    const used = new Set<object>();
    for (const target of targets) {
        const texture = new TextureObject(1, target);
        texture.sampler = () => sampler;
        for (const format of formats) {
            texture.setImage(0, 0, { width: 1, height: 1, depth: 1, border: 0, internalFormat: format, base: format, data: new Uint8Array(4) });
            for (let unit = 0; unit < 3; unit++) {
                s.gl.effectiveTexture = i => (i === unit ? texture : null);
                const bits = target === E.GL_TEXTURE_2D && format === E.GL_RGBA && unit === 0 ? 192 : 2;
                for (let pattern = 0; pattern < bits; pattern++) {
                    // S, T and R have four encodings. Q accepts disabled, object linear and eye linear.
                    const state = s.gl.state.units[unit];
                    for (let coord = 0; coord < 4; coord++) {
                        const mode = modes[(pattern >> (2 * coord)) & 3];
                        state.genEnabled[coord] = mode !== 0;
                        if (mode !== 0) state.gen[coord].mode = mode;
                    }
                    s.draw();
                    const pipeline = s.used.at(-1);
                    if (pipeline === undefined) throw new Error('Draw did not select a pipeline');
                    expect(used.has(pipeline), [target, format, unit, pattern].join('/')).toBe(false);
                    used.add(pipeline);
                    s.draw();
                    expect(s.used.at(-1)).toBe(pipeline);
                }
            }
        }
    }
    expect(used.size).toBe(286);
    expect(s.sync).toHaveLength(used.size);
});

test('textured draws follow raster and combiner changes on the same vertex layout', () => {
    const s = scene(async () => ({}));
    const gl = s.gl;
    const texture = new TextureObject(1, E.GL_TEXTURE_2D);
    texture.setImage(0, 0, { width: 1, height: 1, depth: 1, border: 0, internalFormat: E.GL_RGBA, base: E.GL_RGBA, data: new Uint8Array(4) });
    const handle = { createView: () => ({}) } as unknown as GPUTexture;
    const sampler = {} as GPUSampler;
    gl.realizeTexture = () => handle;
    gl.effectiveTexture = unit => (unit === 0 ? texture : null);
    texture.sampler = () => sampler;
    s.draw();
    const original = s.used.at(-1);
    const changes = [
        [() => gl.glDepthMask(false), () => gl.glDepthMask(true)],
        [() => gl.glDepthFunc(E.GL_GREATER), () => gl.glDepthFunc(E.GL_LEQUAL)],
        [() => gl.glAlphaFunc(E.GL_GREATER, 0.125), () => gl.glAlphaFunc(E.GL_GREATER, 0)],
        [() => gl.glBlendFunc(E.GL_ONE, E.GL_ONE), () => gl.glBlendFunc(E.GL_SRC_ALPHA, E.GL_ONE_MINUS_SRC_ALPHA)],
        [() => gl.glDisable(E.GL_FOG), () => gl.glEnable(E.GL_FOG)],
        [() => gl.glDisable(E.GL_LIGHTING), () => gl.glEnable(E.GL_LIGHTING)],
        [() => gl.glTexEnvi(E.GL_TEXTURE_ENV, E.GL_TEXTURE_ENV_MODE, E.GL_REPLACE), () => gl.glTexEnvi(E.GL_TEXTURE_ENV, E.GL_TEXTURE_ENV_MODE, E.GL_MODULATE)]
    ];
    for (const [change, restore] of changes) {
        change();
        s.draw();
        const changed = s.used.at(-1);
        expect(changed).not.toBe(original);
        s.draw();
        expect(s.used.at(-1)).toBe(changed);
        restore();
        s.draw();
        expect(s.used.at(-1)).toBe(original);
    }
});

test('indexed vertex input caches each enabled slot list in shader location order', () => {
    const s = scene(async () => ({}));
    const caps = [E.GL_COLOR_ARRAY, E.GL_NORMAL_ARRAY, E.GL_TEXTURE_COORD_ARRAY];
    const firstPass: GPURenderPipelineDescriptor[] = [];
    for (let pass = 0; pass < 2; pass++) {
        for (let mask = 0; mask < 8; mask++) {
            const slots = [0];
            for (const [i, cap] of caps.entries()) {
                if (mask & (1 << i)) {
                    s.gl.glEnableClientState(cap);
                    slots.push(i + 1);
                } else s.gl.glDisableClientState(cap);
            }
            s.draw();
            const pipeline = s.used.at(-1) as GPURenderPipelineDescriptor;
            const locations = Array.from(pipeline.vertex.buffers ?? []).flatMap(b => (b ? Array.from(b.attributes, a => a.shaderLocation) : []));
            expect(locations).toEqual(slots);
            if (pass === 0) firstPass.push(pipeline);
            else expect(pipeline).toBe(firstPass[mask]);
        }
    }
    expect(s.sync).toHaveLength(8);
});

test('completed, rejected and lost warmups leave the first draw available synchronously', async () => {
    const pipelines: object[] = [];
    const ready = scene(async () => {
        const value = {};
        pipelines.push(value);
        return value;
    });
    await ready.gl.prewarmIndexedPipelines(4);
    ready.draw();
    expect(ready.sync).toHaveLength(0);
    expect(ready.used[0]).toBe(pipelines[4]);
    expect(new Set(ready.async.map(d => d.multisample?.count))).toEqual(new Set([4]));

    const rejected = scene(async n => {
        if (n === 5) throw new Error('compiler rejected');
        return {};
    });
    await rejected.gl.prewarmIndexedPipelines(4);
    rejected.draw();
    expect(rejected.sync).toHaveLength(1);
    expect(rejected.sync[0]).toEqual(rejected.async[4]);
    for (const reason of ['dispose', 'lost']) {
        const started = Promise.withResolvers<void>(),
            inFlight = Promise.withResolvers<object>();
        const interrupted = scene(() => {
            started.resolve();
            return inFlight.promise;
        });
        const warm = interrupted.gl.prewarmIndexedPipelines(4);
        await started.promise;
        if (reason === 'dispose') interrupted.gl.dispose();
        else {
            interrupted.lost.resolve({ message: 'device lost' } as GPUDeviceLostInfo);
            await interrupted.lost.promise;
        }
        inFlight.resolve({});
        await warm;
        expect(interrupted.async).toHaveLength(1);
    }
});
