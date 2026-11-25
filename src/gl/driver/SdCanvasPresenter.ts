/// <reference types="@webgpu/types" />
import { sdCanvasPresentWgsl } from '#/gl/driver/shaders/sdCanvasPresent.wgsl';

export interface SdCanvasRectangle {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

type CanvasContext = Pick<GPUCanvasContext, 'configure' | 'getCurrentTexture' | 'unconfigure'>;

// The AWT screen keeps earlier draws outside the Graphics clip. A browser swapchain
// cannot guarantee that, so keep one window-sized front texture and copy it to the canvas.
export default class SdCanvasPresenter {
    private readonly device: GPUDevice;
    private readonly context: CanvasContext;
    private readonly pipeline: GPURenderPipeline;
    private front?: { texture: GPUTexture; view: GPUTextureView };
    private binding?: { source: GPUBuffer; group: GPUBindGroup };
    private released = false;

    constructor(device: GPUDevice, context: CanvasContext, format: GPUTextureFormat) {
        this.device = device;
        this.context = context;
        const module = device.createShaderModule({ label: '530 SD direct colour model', code: sdCanvasPresentWgsl });
        this.pipeline = device.createRenderPipeline({
            label: '530 SD canvas drawImage',
            layout: 'auto',
            vertex: { module, entryPoint: 'vertex' },
            fragment: { module, entryPoint: 'fragment', targets: [{ format }] }
        });
        context.configure({ device, format, alphaMode: 'opaque', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST });
    }

    // The source is a row-major PixScreen at (0, 0). With no clip list, draw the
    // whole image. An explicitly empty list just presents the previous window contents.
    present(packed: GPUBuffer, width: number, height: number, rectangles?: readonly SdCanvasRectangle[], frameEncoder?: GPUCommandEncoder): void {
        if (this.released) throw new Error('530 SD canvas presenter has been released');
        const canvas = this.context.getCurrentTexture();
        let front = this.front;
        let resized = false;
        if (!front || front.texture.width !== canvas.width || front.texture.height !== canvas.height) {
            front?.texture.destroy();
            const texture = this.device.createTexture({
                label: '530 SD AWT screen',
                size: [canvas.width, canvas.height],
                format: canvas.format,
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
            });
            this.front = front = { texture, view: texture.createView() };
            resized = true;
        }
        let binding = this.binding;
        if (!binding || binding.source !== packed) {
            const group = this.device.createBindGroup({
                layout: this.pipeline.getBindGroupLayout(0),
                entries: [{ binding: 0, resource: { buffer: packed } }]
            });
            this.binding = binding = { source: packed, group };
        }

        const encoder = frameEncoder ?? this.device.createCommandEncoder({ label: '530 SD canvas presentation' });
        const imageWidth = Math.min(width, canvas.width);
        const imageHeight = Math.min(height, canvas.height);
        if (resized || rectangles === undefined || rectangles.length !== 0) {
            const pass = encoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: front.view,
                        loadOp: resized ? 'clear' : 'load',
                        clearValue: [0, 0, 0, 1],
                        storeOp: 'store'
                    }
                ]
            });
            pass.setPipeline(this.pipeline);
            pass.setBindGroup(0, binding.group);
            // firstInstance passes the source stride without a uniform update per draw.
            if (rectangles === undefined) {
                if (imageWidth > 0 && imageHeight > 0) {
                    pass.setScissorRect(0, 0, imageWidth, imageHeight);
                    pass.draw(3, 1, 0, width);
                }
            } else {
                for (const rect of rectangles) {
                    const left = Math.max(0, rect.x);
                    const top = Math.max(0, rect.y);
                    const right = Math.min(imageWidth, rect.x + rect.width);
                    const bottom = Math.min(imageHeight, rect.y + rect.height);
                    if (right > left && bottom > top) {
                        pass.setScissorRect(left, top, right - left, bottom - top);
                        pass.draw(3, 1, 0, width);
                    }
                }
            }
            pass.end();
        }
        encoder.copyTextureToTexture({ texture: front.texture }, { texture: canvas }, [canvas.width, canvas.height]);
        if (frameEncoder === undefined) this.device.queue.submit([encoder.finish()]);
    }

    release(): void {
        if (this.released) return;
        this.released = true;
        this.context.unconfigure();
        this.front?.texture.destroy();
        this.front = undefined;
        this.binding = undefined;
    }
}
