/// <reference types="@webgpu/types" />
import GpuDevice, { COLOR_FORMAT } from './GpuDevice';

// Presenter: the window side of a GL drawable (HD_PLAN 1.4, 2.4 front-buffer and swap rows). Host code, not a Java
// port.
//
// GL's front buffer belongs to the window, not to a context, so there is one Presenter per surface target (the game
// canvas), shared by every drawable made on it (tf.a(Ljava/awt/Canvas;)V probes the canvas with a throwaway drawable
// before tf.a(Ljava/awt/Canvas;I)I makes the real one). The Presenter keeps the front texture (rgba8unorm, the last
// swapped frame, which glCopyPixels with READ_BUFFER FRONT reads in tf.h()V) and, when the surface has a WebGPU canvas
// context, blits the front texture into the canvas texture on every swap. The canvas is configured with alphaMode
// 'opaque' because glDrawPixels writes destination alpha 0.

// The canvas side of a surface: what GPUCanvasContext offers (tests can pass their own texture provider).
export interface CanvasContextLike {
    configure(configuration: GPUCanvasConfiguration): void;
    getCurrentTexture(): GPUTexture;
}

// What a drawable needs from its target. Sizes are read live: the GL drawable follows the component's size.
export interface WebGpuSurface {
    width(): number;
    height(): number;
    // The canvas context to present into, or null for a headless surface (tests, offscreen oracles).
    canvasContext(): CanvasContextLike | null;
}

interface SizedTarget {
    readonly width: number;
    readonly height: number;
}

interface AwtLikeTarget {
    getSize(): { readonly width: number; readonly height: number };
}

interface ComponentDimensions {
    getWidth(): number;
    getHeight(): number;
}

interface ContextTarget {
    getContext(kind: 'webgpu'): unknown;
}

function hasNumber(o: object, key: string): boolean {
    return typeof (o as Record<string, unknown>)[key] === 'number';
}

// The default surface resolution for a GLDrawableFactory target: a java.awt.Canvas-like object (getSize()), or any
// object with numeric width/height (an HTMLCanvasElement, an OffscreenCanvas, a test stub). A target with
// getContext('webgpu') presents into that context; anything else is headless. Returns null for an unsupported target.
export function defaultSurface(target: object): WebGpuSurface | null {
    let width: () => number;
    let height: () => number;
    const component = target as Partial<ComponentDimensions>;
    if (typeof component.getWidth === 'function' && typeof component.getHeight === 'function') {
        width = component.getWidth.bind(component);
        height = component.getHeight.bind(component);
    } else if (typeof (target as Partial<AwtLikeTarget>).getSize === 'function') {
        const awt = target as AwtLikeTarget;
        width = () => awt.getSize().width;
        height = () => awt.getSize().height;
    } else if (hasNumber(target, 'width') && hasNumber(target, 'height')) {
        const sized = target as SizedTarget;
        width = () => sized.width;
        height = () => sized.height;
    } else {
        return null;
    }
    let context: CanvasContextLike | null | undefined;
    return {
        width,
        height,
        canvasContext: () => {
            if (context === undefined) {
                context = null;
                if (typeof (target as Partial<ContextTarget>).getContext === 'function') {
                    const c = (target as ContextTarget).getContext('webgpu');
                    if (c !== null && typeof c === 'object' && 'configure' in c && 'getCurrentTexture' in c) context = c as CanvasContextLike;
                }
            }
            return context;
        }
    };
}

export default class Presenter {
    readonly gpu: GpuDevice;
    readonly surface: WebGpuSurface;
    front: GPUTexture | null = null;
    private configured: CanvasContextLike | null = null;
    private binding: { front: GPUTexture; pipeline: GPURenderPipeline; group: GPUBindGroup } | null = null;
    // Swaps presented (diagnostics).
    presents = 0;

    constructor(gpu: GpuDevice, surface: WebGpuSurface) {
        this.gpu = gpu;
        this.surface = surface;
    }

    // The front texture at the given size. A resize allocates a new one (the old contents are gone, as a GL window's
    // are after a resize).
    ensureFront(width: number, height: number): GPUTexture {
        const f = this.front;
        if (f !== null && f.width === width && f.height === height) return f;
        if (f !== null) this.gpu.retire(f);
        this.binding = null;
        this.front = this.gpu.device.createTexture({
            label: 'gl-front',
            size: { width, height },
            format: COLOR_FORMAT,
            viewFormats: ['rgba8unorm-srgb'],
            usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
        });
        return this.front;
    }

    // Blits the front texture into the canvas (if the surface has one). Encoded on the frame encoder; the caller
    // submits.
    present(): void {
        this.presents++;
        const front = this.front;
        const context = this.surface.canvasContext();
        if (front === null || context === null) return;
        if (this.configured !== context) {
            context.configure({ device: this.gpu.device, format: this.gpu.canvasFormat, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT });
            this.configured = context;
        }
        const target = context.getCurrentTexture();
        const pipeline = this.gpu.presentPipeline(target.format);
        let binding = this.binding;
        if (binding === null || binding.front !== front || binding.pipeline !== pipeline) {
            const group = this.gpu.device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: front.createView() }] });
            this.binding = binding = { front, pipeline, group };
        }
        this.gpu.endPass();
        const pass = this.gpu.getEncoder().beginRenderPass({
            label: 'gl-present',
            colorAttachments: [{ view: target.createView(), loadOp: 'clear', clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: 'store' }]
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, binding.group);
        pass.setViewport(0, 0, Math.min(front.width, target.width), Math.min(front.height, target.height), 0, 1);
        pass.draw(3);
        pass.end();
    }

    dispose(): void {
        this.binding = null;
        if (this.front !== null) {
            this.gpu.retire(this.front);
            this.front = null;
            this.gpu.flushRetired();
        }
    }
}

const presenters = new WeakMap<object, Presenter>();

// The front buffer belongs to the window and survives individual GL contexts.
// Release it when the browser removes that window's dedicated GPU canvas.
export function releasePresenter(target: object): void {
    const presenter = presenters.get(target);
    if (!presenter) return;
    presenters.delete(target);
    presenter.dispose();
}

// The Presenter of a surface target, created on first use (one per target object and device).
export function presenterFor(gpu: GpuDevice, target: object, surface: WebGpuSurface): Presenter {
    let p = presenters.get(target);
    if (p === undefined || p.gpu !== gpu) {
        p = new Presenter(gpu, surface);
        presenters.set(target, p);
    }
    return p;
}
