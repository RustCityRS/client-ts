import Pix3D from '#/dash3d/Pix3D';
import SdRasterSpans from '#/dash3d/SdRasterSpans';
import { SdWebGpuRaster } from '#/dash3d/SdWebGpuRaster';
import Pix2D from '#/graphics/Pix2D';
import type PixScreen from '#/graphics/PixScreen';
import type { CanvasComponent, ClipShape, PresentCanvasImage } from '#/graphics/PixScreen';
import type GpuDevice from '#/gl/driver/GpuDevice';
import SdCanvasPresenter from '#/gl/driver/SdCanvasPresenter';
import { requireNonNull } from '#/util/JavaArray';

// A browser SD framebuffer remains GPU-owned between redraws. Capture also stays bound
// between ticks so immediate loading messages are ordered against the last rendered world.
export default class SdBrowserDisplay {
    readonly raster: SdWebGpuRaster;
    private readonly spans: SdRasterSpans;
    private readonly presenter: SdCanvasPresenter;
    private readonly rectangles: NonNullable<ClipShape>[] = [];
    private packed?: GPUBuffer;
    private drawing = false;
    private dirty = false;

    constructor(
        gpu: GpuDevice,
        context: GPUCanvasContext,
        readonly screen: PixScreen,
        readonly component: CanvasComponent
    ) {
        this.raster = new SdWebGpuRaster(gpu.device);
        this.presenter = new SdCanvasPresenter(gpu.device, context, gpu.canvasFormat);
        this.spans = new SdRasterSpans(requireNonNull(screen.pixels), screen.width, screen.height, true);
    }

    async bind(): Promise<void> {
        await this.raster.prepare();
        if (Pix3D.spanTarget !== null) throw new Error('Nested SD WebGPU frame');
        Pix3D.spanTarget = this.spans;
        Pix2D.pixels = this.spans.bind(Pix2D.pixels);
        this.component.presentImage = this.presentImage;
    }

    beginFrame(): void {
        this.drawing = true;
    }

    private readonly presentImage: PresentCanvasImage = (image, x, y, rect) => {
        if (image !== this.screen.image || x !== 0 || y !== 0) return false;
        this.rectangles.push(rect);
        if (!this.drawing) this.finishFrame();
        return true;
    };

    private readonly encodePresentation = (buffer: GPUBuffer, encoder: GPUCommandEncoder): void => {
        this.presenter.present(buffer, this.screen.width, this.screen.height, this.rectangles, encoder);
    };

    private flush(present = false): void {
        const frame = this.spans.finish();
        if (this.packed === undefined || frame.batches.length !== 0) {
            this.packed = this.raster.drawResident(frame, this.packed === undefined, present ? this.encodePresentation : undefined);
            if (frame.batches.length !== 0) this.dirty = true;
        } else if (present) {
            this.presenter.present(this.packed, this.screen.width, this.screen.height, this.rectangles);
        }
        this.spans.reset();
    }

    finishFrame(): void {
        this.drawing = false;
        this.flush(this.rectangles.length > 0);
        this.rectangles.length = 0;
    }

    // Before handing the same Java image back to a CPU consumer, commit both framebuffer
    // words and any native sprites sampled from it. Consecutive GPU draws perform no readback.
    async leave(copy: boolean): Promise<void> {
        try {
            if (copy) {
                this.flush();
                if (this.dirty) await this.raster.syncToCpu(requireNonNull(this.screen.pixels));
            }
        } finally {
            if (Pix3D.spanTarget === this.spans) Pix3D.spanTarget = null;
            if (Pix2D.pixels === this.spans.guardedTarget) Pix2D.pixels = this.screen.pixels;
            if (this.component.presentImage === this.presentImage) this.component.presentImage = undefined;
            this.raster.dispose();
            this.presenter.release();
        }
    }
}
