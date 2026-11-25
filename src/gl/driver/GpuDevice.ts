/// <reference types="@webgpu/types" />
import clearWgsl from '#/gl/driver/shaders/clear.wgsl' with { type: 'text' };
import depthReadWgsl from '#/gl/driver/shaders/depthRead.wgsl' with { type: 'text' };
import presentWgsl from '#/gl/driver/shaders/present.wgsl' with { type: 'text' };
import { type SamplerKey, samplerDescriptor, samplerKeyString } from './TextureObject';

// GpuDevice: the one GPUDevice of the page (HD_PLAN 1.4 "Device at boot"). Host code, not a Java port.
//
// requestAdapter/requestDevice are async while tf.a(Ljava/awt/Canvas;I)I is synchronous, so the host acquires the
// device before the game loop starts (GpuDevice.acquire) and the JOGL mirror's createContext/makeCurrent then succeed
// synchronously. Without a device the host leaves the WebGPU GLDrawableFactory unregistered and the ported tf.a falls
// back to SD by its own logic.
//
// It also owns what every drawable and GL object on the device shares: the command encoder of the current submission,
// the current render pass (one at a time, with its owner), the submission epoch that buffer renaming keys on, deferred
// destruction of retired GPU resources, a per-submission uniform ring, and the pipeline and sampler caches.
export interface PassOwner {
    // Called when another owner (or a submit) needs the encoder: the owner ends its pass.
    endPass(): void;
}

const UNIFORM_CHUNK = 64 * 1024;
const UNIFORM_ALIGN = 256;
const UPLOAD_PAGE_SIZE = 1024 * 1024;
const MAX_UPLOAD_PAGES = 6;

interface DrawUpload {
    readonly page: GPUBuffer | null;
    bytes: Uint8Array<ArrayBuffer>;
    length: number;
}

export const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
export const COLOR_FORMAT: GPUTextureFormat = 'rgba8unorm';
export const CLEAR_UNIFORM_BYTES = 32;

export default class GpuDevice {
    private static active: GpuDevice | null = null;

    readonly device: GPUDevice;
    readonly canvasFormat: GPUTextureFormat;
    lost = false;
    lostMessage = '';
    // Incremented by every submit. A resource referenced in the current epoch is in the unsubmitted encoder.
    epoch = 0;
    private encoder: GPUCommandEncoder | null = null;
    private passOwner: PassOwner | null = null;
    private readonly retired: (GPUTexture | GPUBuffer)[] = [];
    shadowPass: { encode(encoder: GPUCommandEncoder): void } | null = null;
    private readonly streamBytes = new WeakMap<GPUBuffer, Uint8Array<ArrayBuffer>>();
    private readonly pendingStreams = new Map<GPUBuffer, DrawUpload>();
    private readonly uploadPages = new Set<GPUBuffer>();
    private readonly readyUploads: DrawUpload[] = [];
    private readonly uniformChunks: GPUBuffer[] = [];
    private uniformChunk = 0;
    private uniformOffset = 0;
    private readonly pipelines = new Map<string, GPURenderPipeline>();
    private readonly computePipelines = new Map<string, GPUComputePipeline>();
    private readonly samplers = new Map<string, GPUSampler>();
    private clearLayout: GPUBindGroupLayout | null = null;
    private cameraLayout: GPUBindGroupLayout | null = null;

    get presentationCameraLayout(): GPUBindGroupLayout {
        return (this.cameraLayout ??= this.device.createBindGroupLayout({ entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { minBindingSize: 64 } }] }));
    }
    private readonly clearBindGroups = new Map<GPUBuffer, GPUBindGroup>();

    constructor(device: GPUDevice, canvasFormat: GPUTextureFormat) {
        this.device = device;
        this.canvasFormat = canvasFormat;
        device.lost.then(
            info => {
                this.lost = true;
                this.lostMessage = info.message;
                this.pendingStreams.clear();
                this.releaseUploadPages();
                this.destroyRetired();
            },
            () => {}
        );
    }

    // Boot-time acquisition. Returns null (and installs nothing) when WebGPU or an adapter is unavailable.
    static async acquire(gpu: GPU | null | undefined = (globalThis as { navigator?: { gpu?: GPU } }).navigator?.gpu, options: GPURequestAdapterOptions = { powerPreference: 'high-performance' }): Promise<GpuDevice | null> {
        if (gpu === null || gpu === undefined) return null;
        const adapter = await gpu.requestAdapter(options);
        if (adapter === null) return null;
        const device = await adapter.requestDevice();
        let format: GPUTextureFormat = 'bgra8unorm';
        try {
            format = gpu.getPreferredCanvasFormat();
        } catch {
            // headless GPU objects may not implement it
        }
        return GpuDevice.install(device, format);
    }

    // Installs an already acquired device as the page's device (the host after acquire, tests directly).
    static install(device: GPUDevice, canvasFormat: GPUTextureFormat = 'bgra8unorm'): GpuDevice {
        GpuDevice.uninstall();
        const d = new GpuDevice(device, canvasFormat);
        GpuDevice.active = d;
        return d;
    }

    static current(): GpuDevice | null {
        return GpuDevice.active;
    }

    static uninstall(): void {
        GpuDevice.active?.releaseUploadPages();
        GpuDevice.active = null;
    }

    // ----- encoder, passes, submission ----------------------------------------------------------------------------

    getEncoder(): GPUCommandEncoder {
        if (this.encoder === null) this.encoder = this.device.createCommandEncoder({ label: 'gl-frame-' + this.epoch });
        return this.encoder;
    }

    // Ends the current pass (whoever owns it) so the encoder can take a copy or a new pass.
    endPass(): void {
        const owner = this.passOwner;
        this.passOwner = null;
        if (owner !== null) owner.endPass();
    }

    // Makes `owner` the pass owner, ending another owner's pass first. The owner calls this before beginRenderPass.
    claimPass(owner: PassOwner): GPUCommandEncoder {
        if (this.passOwner !== owner) this.endPass();
        this.passOwner = owner;
        return this.getEncoder();
    }

    releasePass(owner: PassOwner): void {
        if (this.passOwner === owner) this.passOwner = null;
    }

    // Submits everything encoded so far. Retired resources are destroyed after the submit; uniform slots are reused,
    // since queue writes issued after a submit are ordered after its commands.
    submit(): void {
        this.endPass();
        let copies: GPUCommandEncoder | undefined;
        for (const [buffer, upload] of this.pendingStreams) {
            if (upload.page === null) {
                this.device.queue.writeBuffer(buffer, 0, upload.bytes.buffer, 0, upload.length);
            } else {
                upload.page.unmap();
                copies ??= this.device.createCommandEncoder({ label: 'gl-draw-uploads' });
                copies.copyBufferToBuffer(upload.page, 0, buffer, 0, upload.length);
            }
        }
        // The frame is already encoded. Submit all mapped copies ahead of its first vertex/index/uniform read.
        if (this.shadowPass) {
            copies ??= this.device.createCommandEncoder({ label: 'sun-before-world' });
            this.shadowPass.encode(copies);
            this.shadowPass = null;
        }
        if (copies) {
            const commands = [copies.finish()];
            if (this.encoder !== null) commands.push(this.encoder.finish());
            this.device.queue.submit(commands);
            for (const upload of this.pendingStreams.values()) {
                if (upload.page !== null) this.remapUpload(upload, upload.page);
            }
        } else if (this.encoder !== null) {
            this.device.queue.submit([this.encoder.finish()]);
        }
        this.encoder = null;
        this.pendingStreams.clear();
        this.epoch++;
        this.destroyRetired();
        this.uniformChunk = 0;
        this.uniformOffset = 0;
    }

    retire(resource: GPUTexture | GPUBuffer): void {
        if (this.lost) resource.destroy();
        else this.retired.push(resource);
    }

    get hasRetiredResources(): boolean {
        return this.retired.length !== 0;
    }

    get hasUnsubmittedWork(): boolean {
        return this.encoder !== null || this.pendingStreams.size !== 0 || this.uniformOffset !== 0 || this.shadowPass !== null;
    }

    // On leaving HD there may never be another swap. Submit any last users before
    // destroying their resources, including commands still encoded by another drawable.
    flushRetired(): void {
        if (this.retired.length > 0) this.submit();
    }

    private destroyRetired(): void {
        for (const resource of this.retired) resource.destroy();
        this.retired.length = 0;
    }

    private queuedBytes(buffer: GPUBuffer, required: number): Uint8Array<ArrayBuffer> {
        let bytes = this.streamBytes.get(buffer);
        if (!bytes || bytes.length < required) {
            // The GPU stream reserves a whole page. Keep only the prefix actually staged on the CPU.
            const previous = bytes;
            const capacity = Math.min(buffer.size, Math.max(required, previous ? previous.length * 2 : 4096));
            bytes = new Uint8Array(capacity);
            if (previous) bytes.set(previous);
            this.streamBytes.set(buffer, bytes);
        }
        return bytes;
    }

    private mappedUpload(): DrawUpload | undefined {
        const ready = this.readyUploads.pop();
        if (ready) return ready;
        if (this.uploadPages.size >= MAX_UPLOAD_PAGES || this.lost) return;
        let page: GPUBuffer | undefined;
        try {
            page = this.device.createBuffer({ label: 'gl-draw-upload', size: UPLOAD_PAGE_SIZE, usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC, mappedAtCreation: true });
            const bytes = new Uint8Array(page.getMappedRange());
            this.uploadPages.add(page);
            return { page, bytes, length: 0 };
        } catch {
            page?.destroy();
            return;
        }
    }

    private remapUpload(upload: DrawUpload, page: GPUBuffer): void {
        const discard = () => {
            if (this.uploadPages.delete(page)) page.destroy();
        };
        // mapAsync resolves after all copies reading this page complete. A lost or uninstalled device can
        // release it while the promise is pending.
        page.mapAsync(GPUMapMode.WRITE)
            .then(() => {
                if (!this.uploadPages.has(page)) return;
                upload.bytes = new Uint8Array(page.getMappedRange());
                upload.length = 0;
                this.readyUploads.push(upload);
            })
            .catch(discard);
    }

    releaseUploadPages(): void {
        // The device is shared between GL contexts. Preserve pending writes if a context or the registry
        // releases staging while another caller still owns an unsubmitted frame.
        for (const [buffer, upload] of this.pendingStreams) {
            if (upload.page === null) continue;
            const queued = { page: null, bytes: this.queuedBytes(buffer, upload.length), length: upload.length };
            queued.bytes.set(upload.bytes.subarray(0, upload.length));
            this.pendingStreams.set(buffer, queued);
        }
        for (const page of this.uploadPages) page.destroy();
        this.uploadPages.clear();
        this.readyUploads.length = 0;
    }

    // Every transient slice consumed by a draw is written during this submission. Prefer a mapped page
    // for indexed streams; when all pages are in flight, retain the queue-write path for that entire buffer.
    stageDrawBytes(buffer: GPUBuffer, offset: number, source: Uint8Array | Float32Array, preferMapped = false): void {
        let upload = this.pendingStreams.get(buffer);
        const end = offset + source.byteLength;
        if (!upload) {
            if (preferMapped && buffer.size === UPLOAD_PAGE_SIZE) upload = this.mappedUpload();
            upload ??= { page: null, bytes: this.queuedBytes(buffer, end), length: 0 };
            this.pendingStreams.set(buffer, upload);
        } else if (end > upload.bytes.length && upload.page === null) {
            upload.bytes = this.queuedBytes(buffer, end);
        }
        const view = source instanceof Uint8Array ? source : new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
        upload.bytes.set(view, offset);
        upload.length = Math.max(upload.length, end);
    }

    // Client-side JOGL buffers are mutable between draws. Staged bytes are the
    // exact snapshot the earlier draw will consume, even on a mapped upload page.
    matchesDrawBytes(buffer: GPUBuffer, offset: number, source: Uint8Array, start: number, end: number): boolean {
        const upload = this.pendingStreams.get(buffer);
        if (!upload || offset + end - start > upload.length) return false;
        const bytes = upload.bytes;
        for (let i = start; i < end; i++) if (source[i] !== bytes[offset++]) return false;
        return true;
    }

    // A fresh uniform slot holding `bytes` (one slot per encoded use, so no slot is rewritten before its draw runs).
    uniform(bytes: Uint8Array<ArrayBuffer>): { buffer: GPUBuffer; offset: number } {
        const size = (bytes.length + UNIFORM_ALIGN - 1) & ~(UNIFORM_ALIGN - 1);
        if (this.uniformOffset + size > UNIFORM_CHUNK) {
            this.uniformChunk++;
            this.uniformOffset = 0;
        }
        while (this.uniformChunks.length <= this.uniformChunk) {
            this.uniformChunks.push(this.device.createBuffer({ label: 'gl-uniforms', size: UNIFORM_CHUNK, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
        }
        const buffer = this.uniformChunks[this.uniformChunk];
        const offset = this.uniformOffset;
        this.device.queue.writeBuffer(buffer, offset, bytes);
        this.uniformOffset += size;
        return { buffer, offset };
    }

    // ----- caches -------------------------------------------------------------------------------------------------

    sampler(key: SamplerKey): GPUSampler {
        const k = samplerKeyString(key);
        let s = this.samplers.get(k);
        if (s === undefined) {
            s = this.device.createSampler(samplerDescriptor(key));
            this.samplers.set(k, s);
        }
        return s;
    }

    private clearBindGroupLayout(): GPUBindGroupLayout {
        if (this.clearLayout === null) {
            this.clearLayout = this.device.createBindGroupLayout({
                label: 'gl-clear',
                entries: [{ binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: CLEAR_UNIFORM_BYTES } }]
            });
        }
        return this.clearLayout;
    }

    clearBindGroup(buffer: GPUBuffer): GPUBindGroup {
        let g = this.clearBindGroups.get(buffer);
        if (g === undefined) {
            g = this.device.createBindGroup({
                layout: this.clearBindGroupLayout(),
                entries: [{ binding: 0, resource: { buffer, offset: 0, size: CLEAR_UNIFORM_BYTES } }]
            });
            this.clearBindGroups.set(buffer, g);
        }
        return g;
    }

    // The clear-quad pipeline for (sample count, colour write, depth write). See shaders/clear.wgsl.
    clearPipeline(sampleCount: number, colorWrite: boolean, depthWrite: boolean): GPURenderPipeline {
        const key = 'clear:' + sampleCount + ':' + colorWrite + ':' + depthWrite;
        let p = this.pipelines.get(key);
        if (p === undefined) {
            const module = this.device.createShaderModule({ label: 'gl-clear', code: clearWgsl });
            p = this.device.createRenderPipeline({
                label: key,
                layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.clearBindGroupLayout()] }),
                vertex: { module, entryPoint: 'vs' },
                fragment: { module, entryPoint: 'fs', targets: [{ format: COLOR_FORMAT, writeMask: colorWrite ? GPUColorWrite.ALL : 0 }] },
                primitive: { topology: 'triangle-list', cullMode: 'none' },
                depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: depthWrite, depthCompare: 'always' },
                multisample: { count: sampleCount }
            });
            this.pipelines.set(key, p);
        }
        return p;
    }

    presentPipeline(format: GPUTextureFormat): GPURenderPipeline {
        const key = 'present:' + format;
        let p = this.pipelines.get(key);
        if (p === undefined) {
            const module = this.device.createShaderModule({ label: 'gl-present', code: presentWgsl });
            p = this.device.createRenderPipeline({
                label: key,
                layout: 'auto',
                vertex: { module, entryPoint: 'vs' },
                fragment: { module, entryPoint: 'fs', targets: [{ format }] },
                primitive: { topology: 'triangle-list' }
            });
            this.pipelines.set(key, p);
        }
        return p;
    }

    depthReadPipeline(multisampled: boolean): GPUComputePipeline {
        const key = 'depth-read:' + multisampled;
        let p = this.computePipelines.get(key);
        if (p === undefined) {
            const code = multisampled ? depthReadWgsl.replace('texture_depth_2d', 'texture_depth_multisampled_2d') : depthReadWgsl;
            const module = this.device.createShaderModule({ label: key, code });
            p = this.device.createComputePipeline({ label: key, layout: 'auto', compute: { module, entryPoint: 'main' } });
            this.computePipelines.set(key, p);
        }
        return p;
    }
}
