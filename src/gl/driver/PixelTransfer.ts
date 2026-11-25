import { GLX as E, GlUnsupported } from './GlEnums';
import type GlState from './GlState';
import GpuDevice, { COLOR_FORMAT, DEPTH_FORMAT } from './GpuDevice';
import SurfaceTargets, { glBoxToRect } from './SurfaceTargets';
import { pixelTransferWgsl } from '#/gl/driver/shaders/pixelTransfer.wgsl';

// glDrawPixels (dj.a) and glCopyPixels (tf.h) both disable alpha, blend and depth testing. The GL window-space
// raster position and zoom select a rectangle of fragments. GL client-data row zero is the bottom source row;
// framebuffer row zero is stored at the opposite edge in the WebGPU texture.
const pipelines = new WeakMap<GpuDevice, Map<number, GPURenderPipeline>>();

function pipeline(gpu: GpuDevice, samples: number): GPURenderPipeline {
    let cache = pipelines.get(gpu);
    if (cache === undefined) {
        cache = new Map();
        pipelines.set(gpu, cache);
    }
    let result = cache.get(samples);
    if (result === undefined) {
        const shader = gpu.device.createShaderModule({ label: 'gl-pixel-transfer', code: pixelTransferWgsl });
        result = gpu.device.createRenderPipeline({
            label: 'gl-pixel-transfer-' + samples,
            layout: 'auto',
            vertex: { module: shader, entryPoint: 'vs' },
            fragment: { module: shader, entryPoint: 'fs', targets: [{ format: COLOR_FORMAT }] },
            primitive: { topology: 'triangle-list' },
            depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: false, depthCompare: 'always' },
            multisample: { count: samples }
        });
        cache.set(samples, result);
    }
    return result;
}

export function transferPixels(state: GlState, targets: SurfaceTargets, source: GPUTexture, x: number, y: number, width: number, height: number, fromFramebuffer: boolean, opaque: boolean): void {
    if (state.isEnabled(E.GL_BLEND) || state.isEnabled(E.GL_DEPTH_TEST) || state.isEnabled(E.GL_ALPHA_TEST) || state.isEnabled(E.GL_FOG)) throw new GlUnsupported('fragment tests on a pixel transfer are outside the 530 client paths');
    let rect = { x: 0, y: 0, width: targets.width, height: targets.height };
    if (state.isEnabled(E.GL_SCISSOR_TEST)) {
        const [sx, sy, sw, sh] = state.scissor;
        const clipped = glBoxToRect(sx, sy, sw, sh, targets.width, targets.height);
        if (clipped === null) return;
        rect = clipped;
    }
    const params = new Float32Array(12);
    params.set([state.rasterPos[0], state.rasterPos[1], state.pixelZoomX, state.pixelZoomY]);
    new Int32Array(params.buffer, 16).set([x, y, width, height, targets.height, source.height, +fromFramebuffer, +opaque]);
    const gpu = targets.gpu;
    const slot = gpu.uniform(new Uint8Array(params.buffer));
    const pipe = pipeline(gpu, targets.sampleCount);
    const group = gpu.device.createBindGroup({
        layout: pipe.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: source.createView() },
            { binding: 1, resource: { buffer: slot.buffer, offset: slot.offset, size: params.byteLength } }
        ]
    });
    const pass = targets.currentPass();
    pass.setPipeline(pipe);
    pass.setBindGroup(0, group);
    pass.setViewport(0, 0, targets.width, targets.height, 0, 1);
    pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
    pass.draw(3);
}
