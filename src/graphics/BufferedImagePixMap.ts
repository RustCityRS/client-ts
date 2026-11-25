import { requireNonNull } from '#/util/JavaArray';
import PixScreen, { DirectColorModel, rasterToImageData, type AwtComponent, type AwtGraphics, type AwtImage, type CanvasSurface, type ColorModel, type ImageObserver, type SinglePixelPackedSampleModel } from './PixScreen';

// ---- AWT platform boundary (only wc uses these) ------------------------------------------------------------------

// java.awt.image.DataBufferInt([II)V: wraps the int[] without copying, so the image always shows the live pixels.
export class DataBufferInt {
    constructor(
        readonly data: Int32Array,
        readonly size: number
    ) {}
}

// java.awt.image.WritableRaster over a SinglePixelPackedSampleModel and a DataBufferInt.
export class WritableRaster {
    constructor(
        readonly sampleModel: SinglePixelPackedSampleModel,
        readonly dataBuffer: DataBufferInt
    ) {}

    // java/awt/image/Raster.createWritableRaster(Ljava/awt/image/SampleModel;Ljava/awt/image/DataBuffer;Ljava/awt/Point;)Ljava/awt/image/WritableRaster;
    // The integer raster checks that the buffer holds every scanline.
    static create(sampleModel: SinglePixelPackedSampleModel, dataBuffer: DataBufferInt, _location: null): WritableRaster {
        const last = (sampleModel.height - 1) * sampleModel.scanlineStride + sampleModel.width;
        if (last > dataBuffer.data.length) {
            throw new RangeError('Data array too small (should be > ' + (last - 1) + ' )');
        }
        return new WritableRaster(sampleModel, dataBuffer);
    }
}

// java.awt.image.BufferedImage(ColorModel, WritableRaster, boolean, Hashtable) over the shared int[]. A draw converts
// the requested rectangle of the live pixels into canvas ImageData through the colour model.
export class BufferedImage implements AwtImage {
    private data: ImageData | null = null;

    constructor(
        readonly colorModel: ColorModel,
        readonly raster: WritableRaster,
        readonly rasterPremultiplied: boolean,
        readonly properties: Map<unknown, unknown> | null
    ) {}

    getWidth(_observer: ImageObserver | null): number {
        return this.raster.sampleModel.width;
    }

    getHeight(_observer: ImageObserver | null): number {
        return this.raster.sampleModel.height;
    }

    startDraw(_observer: ImageObserver | null): boolean {
        return true;
    }

    readImageData(surface: CanvasSurface, x: number, y: number, width: number, height: number): ImageData {
        const model = this.raster.sampleModel;
        this.data = rasterToImageData(surface, this.data, this.raster.dataBuffer.data, model.width, model.height, this.colorModel, x, y, width, height);
        return this.data;
    }
}

// ---- wc ----------------------------------------------------------------------------------------------------------

// wc has no statics. Its three methods rethrow RuntimeException unchanged (no od.a wrapper).
export default class BufferedImagePixMap extends PixScreen {
    // wc.o:Ljava/awt/Component;
    private component: AwtComponent | null = null;

    // wc.a(IILjava/awt/Component;B)V (dummy stripped: callers pass -34, so the var4 > -16 self-call never runs)
    init(height: number, width: number, component: AwtComponent | null): void {
        this.pixels = new Int32Array((Math.imul(width, height) + 1) | 0);
        this.height = height;
        this.width = width;
        const buffer = new DataBufferInt(this.pixels, this.pixels.length);
        const model = new DirectColorModel(32, 0xff0000, 0xff00, 0xff);
        const raster = WritableRaster.create(model.createCompatibleSampleModel(this.width, this.height), buffer, null);
        this.image = new BufferedImage(model, raster, false, new Map());
        this.component = component;
        this.bind();
    }

    // wc.a(IIILjava/awt/Graphics;)V (dummy 1000 stripped, with its self-call guard)
    draw(x: number, y: number, graphics: AwtGraphics | null): void {
        requireNonNull(graphics).drawImage(this.image, x, y, this.component);
    }

    // wc.<init>()V
    constructor() {
        super();
    }

    // wc.a(BIIIILjava/awt/Graphics;)V (dummy -6 stripped, with its init(-83, -22, null) guard)
    drawClipped(height: number, width: number, x: number, y: number, graphics: AwtGraphics | null): void {
        const g = requireNonNull(graphics);
        const clip = g.getClip();
        g.clipRect(x, y, width, height);
        g.drawImage(this.image, 0, 0, this.component);
        g.setClip(clip);
    }
}
