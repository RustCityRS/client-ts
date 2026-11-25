/// <reference types="@webgpu/types" />
import GpuDevice, { CLEAR_UNIFORM_BYTES, COLOR_FORMAT, DEPTH_FORMAT, type PassOwner } from './GpuDevice';
import DrawPass from './DrawPass';
import StressRenderPass from './StressRenderPass';
import PresentationCamera from './PresentationCamera';

// SurfaceTargets: a GL drawable's back colour buffer and depth buffer on WebGPU (HD_PLAN 2.3 clear row, 2.4 swap and
// MSAA rows). Host code, not a Java port.
//
// - Colour: rgba8unorm with the drawable's sample count (WebGPU allows 1 or 4: AA 0 -> 1, 2 -> 4, 4 -> 4).
//   Swaps resolve into the front texture. A GL back-buffer read allocates a separate snapshot on demand.
//   Depth: depth24plus, same sample count.
// - The drawable's GLCapabilities ask for 0 alpha bits (the jar never sets alpha bits), so the colour buffer has no
//   GL-visible alpha: every write keeps alpha at 1, which is what GL reads for a missing alpha channel.
// - The back buffer is preserved across swaps (GL leaves it undefined; keeping it makes frames deterministic).
// - GL window coordinates are bottom-up; GL window row y is texture row (height - 1 - y), so a GL box (x, y, w, h)
//   becomes the WebGPU rect (x, height - (y + h), w, h).
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

// The WebGPU (top-left origin) rect of a GL (bottom-left origin) box, clipped to the surface; null when empty.
export function glBoxToRect(x: number, y: number, w: number, h: number, surfaceWidth: number, surfaceHeight: number, out?: Rect): Rect | null {
    const x0 = Math.max(0, x);
    const x1 = Math.min(surfaceWidth, x + Math.max(0, w));
    const y0gl = Math.max(0, y);
    const y1gl = Math.min(surfaceHeight, y + Math.max(0, h));
    if (x1 <= x0 || y1gl <= y0gl) return null;
    out ??= { x: 0, y: 0, width: 0, height: 0 };
    out.x = x0;
    out.y = surfaceHeight - y1gl;
    out.width = x1 - x0;
    out.height = y1gl - y0gl;
    return out;
}

export default class SurfaceTargets implements PassOwner {
    readonly gpu: GpuDevice;
    readonly sampleCount: number;
    readonly alphaBits: number;
    width = 0;
    height = 0;
    private back: GPUTexture | null = null;
    private resolveTexture: GPUTexture | null = null;
    private resolveSource: GPUTextureView | null = null;
    private resolvePasses = new WeakMap<GPUTexture, GPURenderPassDescriptor>();
    private depth: GPUTexture | null = null;
    private views: { back: GPUTextureView; depth: GPUTextureView } | null = null;
    private pass: DrawPass | null = null;
    private stressPasses: StressRenderPass[] | null = null;
    private recordedPassCount = 0;
    private readonly bundleLayout: GPURenderBundleEncoderDescriptor;
    private recording = false;
    private replayEpoch = -1;
    private pendingReplays = 0;
    private displayPaced = false;
    presentationCamera: PresentationCamera | null = null;
    worldCameraGroup: GPUBindGroup | null = null;
    private cameraBuffer: GPUBuffer | null = null;
    private cameraGroup: GPUBindGroup | null = null;
    private capturedView = false;
    // Render passes begun (diagnostics: a full clear starts a pass with loadOp 'clear').
    passesBegun = 0;
    clearQuads = 0;

    constructor(gpu: GpuDevice, sampleCount: number, alphaBits: number) {
        this.gpu = gpu;
        this.sampleCount = sampleCount;
        this.alphaBits = alphaBits;
        this.bundleLayout = { colorFormats: [COLOR_FORMAT], depthStencilFormat: DEPTH_FORMAT, sampleCount };
    }

    // (Re)allocates the buffers for the surface size. New buffers start as colour (0, 0, 0, alpha) and depth 1.
    ensureSize(width: number, height: number): void {
        if (this.back !== null && width === this.width && height === this.height) return;
        this.stopStress();
        if (width <= 0 || height <= 0) throw new Error('WebGpuGL: surface has no size');
        this.gpu.endPass();
        for (const t of [this.back, this.resolveTexture, this.depth]) if (t !== null) this.gpu.retire(t);
        const device = this.gpu.device;
        const msaa = this.sampleCount > 1;
        this.back = device.createTexture({
            label: 'gl-back',
            size: { width, height },
            format: COLOR_FORMAT,
            viewFormats: msaa ? ['rgba8unorm-srgb'] : [],
            sampleCount: this.sampleCount,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | (msaa ? 0 : GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST)
        });
        // The JOGL window resolves RGB in linear light. Keep ordinary drawing and blending in the
        // window's byte format, then use sRGB views for the hardware resolve (alpha stays linear).
        this.resolveSource = msaa ? this.back.createView({ format: 'rgba8unorm-srgb' }) : null;
        this.resolveTexture = null;
        this.resolvePasses = new WeakMap();
        this.depth = device.createTexture({
            label: 'gl-depth',
            size: { width, height },
            format: DEPTH_FORMAT,
            sampleCount: this.sampleCount,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
        });
        this.views = { back: this.back.createView(), depth: this.depth.createView() };
        this.width = width;
        this.height = height;
        this.beginPass({ r: 0, g: 0, b: 0, a: this.alphaBits === 0 ? 1 : 0 }, 1);
    }

    private textures(): { back: GPUTexture; depth: GPUTexture } {
        if (this.back === null || this.depth === null) throw new Error('WebGpuGL: drawable has no buffers yet');
        return { back: this.back, depth: this.depth };
    }

    // Starts a render pass on the frame encoder. A null clear value loads the attachment's contents.
    beginPass(color: GPUColorDict | null, depth: number | null): DrawPass {
        const views = this.views;
        if (views === null) throw new Error('WebGpuGL: drawable has no buffers yet');
        const encoder = this.gpu.claimPass(this);
        if (this.pass !== null) {
            this.pass.end();
            this.pass = null;
        }
        const descriptor: GPURenderPassDescriptor = {
            label: 'gl-pass',
            colorAttachments: [
                {
                    view: views.back,
                    loadOp: color === null ? 'load' : 'clear',
                    clearValue: color ?? undefined,
                    storeOp: 'store'
                }
            ],
            depthStencilAttachment: {
                view: views.depth,
                depthLoadOp: depth === null ? 'load' : 'clear',
                depthClearValue: depth ?? undefined,
                depthStoreOp: 'store'
            }
        };
        const native = encoder.beginRenderPass(descriptor);
        if (this.recording && this.stressPasses !== null) {
            const i = this.recordedPassCount++;
            let pass = this.stressPasses[i];
            if (pass) pass.reset(descriptor, native);
            else this.stressPasses[i] = pass = new StressRenderPass(descriptor, native, this.gpu.device, this.bundleLayout);
            this.pass = pass.beginDrawPass();
        } else this.pass = new DrawPass(native);
        this.passesBegun++;
        return this.pass;
    }

    // The open pass, or a new one that loads both attachments.
    currentPass(): DrawPass {
        return this.pass ?? this.beginPass(null, null);
    }

    startStress(): void {
        this.capturedView = false;
        this.worldCameraGroup = null;
        this.recording = true;
        this.stressPasses ??= [];
        this.recordedPassCount = 0;
        this.replayEpoch = this.gpu.epoch;
        // An independent frame must have defined initial colour and depth, even
        // when the game clears only its viewport and blends over the margins.
        this.beginPass({ r: 0, g: 0, b: 0, a: 1 }, 1);
    }

    beginWorldView(x: number, y: number, z: number, pitch: number, yaw: number, cycle: number, now = performance.now()): void {
        if (!this.recording) return;
        // A single camera buffer cannot describe two different viewports in one submission.
        if (this.capturedView) {
            this.stopStress();
            return;
        }
        const camera = (this.presentationCamera ??= new PresentationCamera());
        camera.capture(x, y, z, pitch, yaw, cycle, now);
        this.capturedView = true;
        // A stationary view can use the original model pipelines for every presentation.
        if (!camera.canAdvance) return;
        const device = this.gpu.device;
        if (!this.cameraBuffer) {
            this.cameraBuffer = device.createBuffer({ label: 'stress-camera', size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            this.cameraGroup = device.createBindGroup({ layout: this.gpu.presentationCameraLayout, entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }] });
        }
        device.queue.writeBuffer(this.cameraBuffer, 0, camera.matrix);
        this.worldCameraGroup = this.cameraGroup;
    }

    endWorldView(): void {
        this.worldCameraGroup = null;
    }

    finishStress(displayPaced = false): void {
        if (!this.recording) return;
        this.recording = false;
        this.displayPaced = displayPaced;
        if (this.stressPasses) this.stressPasses.length = this.recordedPassCount;
        // An intermediate submit or destroyed geometry makes this frame unsuitable.
        if (this.gpu.epoch !== this.replayEpoch + 1 || !this.stressPasses?.some(pass => pass.indexed)) this.stopStress();
        else this.replayEpoch = this.gpu.epoch;
    }

    stopStress(): void {
        this.recording = false;
        this.stressPasses = null;
        this.replayEpoch = -1;
        this.endWorldView();
        this.capturedView = false;
        this.presentationCamera?.reset();
    }

    replayStress(present: (reuseFront: boolean) => void, now = performance.now(), gameDrawn = false): boolean {
        if (this.recording || this.gpu.hasUnsubmittedWork) return false;
        if (this.gpu.hasRetiredResources) {
            this.stopStress();
            return false;
        }
        // Completion callbacks can arrive after the next display refresh, especially
        // during a game draw. Allow one more frame in flight on the refresh clock.
        if (this.stressPasses === null || this.pendingReplays >= (this.displayPaced ? 2 : 1) || this.gpu.lost || this.replayEpoch !== this.gpu.epoch) return false;
        const camera = this.presentationCamera;
        const view = this.capturedView && this.cameraBuffer && camera?.canAdvance ? camera.sample(now) : null;
        if (view && this.cameraBuffer) {
            if (gameDrawn && view.every((value, i) => value === (i % 5 === 0 ? 1 : 0))) return false;
            this.gpu.device.queue.writeBuffer(this.cameraBuffer, 0, view);
        } else if (gameDrawn) return false;
        // Without a camera delta the completed source already contains this exact
        // world, HUD and MSAA resolve. Redraw the scene only for an interpolated view.
        const reuseFront = this.capturedView && !camera?.canAdvance;
        if (!reuseFront) {
            const encoder = this.gpu.getEncoder();
            for (const pass of this.stressPasses) pass.encode(encoder.beginRenderPass(pass.descriptor));
        }
        present(reuseFront);
        this.replayEpoch = this.gpu.epoch;
        this.pendingReplays++;
        const complete = () => {
            this.pendingReplays--;
        };
        void this.gpu.device.queue.onSubmittedWorkDone().then(complete, complete);
        return true;
    }

    // PassOwner: ends the open pass (called by GpuDevice before a copy, a submit or another owner's pass).
    endPass(): void {
        if (this.pass !== null) {
            this.pass.end();
            this.pass = null;
        }
        this.gpu.releasePass(this);
    }

    // Frees the buffers (the drawable was unrealized). Encoded work that uses them is submitted first by the retire
    // mechanism: they are destroyed only after the next submit.
    dispose(): void {
        this.stopStress();
        if (this.cameraBuffer) this.gpu.retire(this.cameraBuffer);
        this.cameraBuffer = this.cameraGroup = this.presentationCamera = null;
        if (this.pass !== null) this.gpu.endPass();
        for (const t of [this.back, this.resolveTexture, this.depth]) if (t !== null) this.gpu.retire(t);
        this.back = this.resolveTexture = this.depth = null;
        this.views = this.resolveSource = null;
        this.resolvePasses = new WeakMap();
        this.width = this.height = 0;
    }

    // A clear honouring a scissor rect and the masks (shaders/clear.wgsl).
    clearQuad(rect: Rect, color: Float32Array, depth: number, colorWrite: boolean, depthWrite: boolean): void {
        const pass = this.currentPass();
        const params = new Float32Array(CLEAR_UNIFORM_BYTES / 4);
        params.set(color, 0);
        params[4] = depth;
        const slot = this.gpu.uniform(new Uint8Array(params.buffer));
        pass.setPipeline(this.gpu.clearPipeline(this.sampleCount, colorWrite, depthWrite));
        pass.setBindGroup(0, this.gpu.clearBindGroup(slot.buffer), slot.offset);
        pass.setViewport(0, 0, this.width, this.height, 0, 1);
        pass.setScissorRect(rect.x, rect.y, rect.width, rect.height);
        pass.draw(3);
        // Later draws set their own viewport and scissor; restore the full rect for anything that does not.
        pass.setScissorRect(0, 0, this.width, this.height);
        this.clearQuads++;
    }

    private resolveInto(source: GPUTextureView, target: GPUTexture): void {
        let pass = this.resolvePasses.get(target);
        if (!pass) {
            pass = {
                label: 'gl-resolve',
                colorAttachments: [{ view: source, resolveTarget: target.createView({ format: 'rgba8unorm-srgb' }), loadOp: 'load', storeOp: 'store' }]
            };
            this.resolvePasses.set(target, pass);
        }
        this.gpu.getEncoder().beginRenderPass(pass).end();
    }

    // GL reads of the multisampled back buffer need their own snapshot because the
    // window's front buffer must keep the last swap until the next one.
    resolved(): GPUTexture {
        const { back } = this.textures();
        this.gpu.endPass();
        if (!this.resolveSource) return back;
        this.resolveTexture ??= this.gpu.device.createTexture({
            label: 'gl-back-resolve',
            size: { width: this.width, height: this.height },
            format: COLOR_FORMAT,
            viewFormats: ['rgba8unorm-srgb'],
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
        });
        this.resolveInto(this.resolveSource, this.resolveTexture);
        return this.resolveTexture;
    }

    // A multisampled swap can resolve directly into the persistent front buffer.
    copyTo(front: GPUTexture): void {
        this.gpu.endPass();
        if (this.resolveSource) this.resolveInto(this.resolveSource, front);
        else this.gpu.getEncoder().copyTextureToTexture({ texture: this.textures().back }, { texture: front }, { width: this.width, height: this.height });
    }

    // ----- diagnostics (tests): read the buffers back ------------------------------------------------------------

    // RGBA bytes of the back buffer, top row first (GL row height-1 first). Submits the pending work.
    async readBack(): Promise<Uint8Array> {
        return readTexture(this.gpu, this.resolved(), this.width, this.height);
    }

    // Depth values of the back buffer (sample 0), top row first. Submits the pending work.
    async readDepth(): Promise<Float32Array> {
        const { depth } = this.textures();
        this.gpu.endPass();
        const device = this.gpu.device;
        const count = this.width * this.height;
        const out = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
        const size = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
        device.queue.writeBuffer(size, 0, Uint32Array.of(this.width, this.height, 0, 0));
        const pipeline = this.gpu.depthReadPipeline(this.sampleCount > 1);
        const group = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: depth.createView() },
                { binding: 1, resource: { buffer: out } },
                { binding: 2, resource: { buffer: size } }
            ]
        });
        const encoder = this.gpu.getEncoder();
        const pass = encoder.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, group);
        pass.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8));
        pass.end();
        const staging = device.createBuffer({ size: count * 4, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        encoder.copyBufferToBuffer(out, 0, staging, 0, count * 4);
        this.gpu.retire(out);
        this.gpu.retire(size);
        this.gpu.submit();
        await staging.mapAsync(GPUMapMode.READ);
        const values = new Float32Array(staging.getMappedRange()).slice();
        staging.destroy();
        return values;
    }
}

// RGBA bytes of a single-sample rgba8unorm/bgra8unorm texture, top row first, as stored. Submits the pending work.
export async function readTexture(gpu: GpuDevice, texture: GPUTexture, width: number, height: number): Promise<Uint8Array> {
    gpu.endPass();
    const device = gpu.device;
    const pitch = Math.ceil((width * 4) / 256) * 256;
    const staging = device.createBuffer({ size: pitch * height, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    gpu.getEncoder().copyTextureToBuffer({ texture }, { buffer: staging, bytesPerRow: pitch }, { width, height });
    gpu.submit();
    await staging.mapAsync(GPUMapMode.READ);
    const mapped = new Uint8Array(staging.getMappedRange());
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) out.set(mapped.subarray(y * pitch, y * pitch + width * 4), y * width * 4);
    staging.destroy();
    return out;
}
