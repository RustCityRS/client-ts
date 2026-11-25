import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import Pix2D from './Pix2D';
import { loadClient, loadClientPlayer, loadJagString, loadLocalisedText, loadNpcType, loadRoofModeStatics } from '#/util/GamepackClasses';

// ---- AWT platform boundary -------------------------------------------------------------------------------------
// oh/ck/wc talk to java.awt (Component, Graphics, Image, ImageProducer, ImageConsumer, ImageObserver, ColorModel).
// These types stand in for the parts of java.awt they call; the browser implementation draws with canvas 2D
// ImageData and putImageData. They are not gamepack classes, so they carry no obfuscated owner. Where the JDK's
// behaviour reaches the client (consumer registration, raster bounds checks, clip intersection) the adapter follows
// the JDK 21 sources (sun.awt.image.ImageRepresentation, sun.java2d.SunGraphics2D, java.awt.Rectangle).

// The two CanvasRenderingContext2D calls the adapter needs.
export type CanvasSurface = {
    createImageData(width: number, height: number): ImageData;
    putImageData(data: ImageData, dx: number, dy: number, dirtyX: number, dirtyY: number, dirtyWidth: number, dirtyHeight: number): void;
};

// java.awt.Shape as Graphics.getClip()/setClip() pass it: the user clip rectangle, or null for no user clip.
export type ClipShape = { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;

// java.awt.image.ImageObserver
export interface ImageObserver {
    imageUpdate(image: AwtImage | null, infoflags: number, x: number, y: number, width: number, height: number): boolean;
}

// java.awt.image.ColorModel
export interface ColorModel {
    // java/awt/image/ColorModel.getRGB(I)I
    getRGB(pixel: number): number;
}

// java.awt.image.ImageConsumer
export interface ImageConsumer {
    setDimensions(width: number, height: number): void;
    setProperties(props: Map<unknown, unknown> | null): void;
    setColorModel(model: ColorModel | null): void;
    setHints(hintflags: number): void;
    setPixels(x: number, y: number, w: number, h: number, model: ColorModel | null, pixels: Int32Array | null, off: number, scansize: number): void;
    imageComplete(status: number): void;
}

// java.awt.image.ImageProducer
export interface ImageProducer {
    addConsumer(consumer: ImageConsumer | null): void;
    isConsumer(consumer: ImageConsumer | null): boolean;
    removeConsumer(consumer: ImageConsumer | null): void;
    startProduction(consumer: ImageConsumer | null): void;
    requestTopDownLeftRightResend(consumer: ImageConsumer | null): void;
}

// java.awt.Image
export interface AwtImage {
    // java/awt/Image.getWidth(Ljava/awt/image/ImageObserver;)I (-1 while unknown)
    getWidth(observer: ImageObserver | null): number;
    // java/awt/Image.getHeight(Ljava/awt/image/ImageObserver;)I (-1 while unknown)
    getHeight(observer: ImageObserver | null): number;
    // First half of drawImage for this image: whether it has pixels to draw (it may start production, as
    // sun.awt.image.ImageRepresentation.drawToBufImage does).
    startDraw(observer: ImageObserver | null): boolean;
    // Browser side of drawImage: canvas ImageData of the whole image whose pixels are current at least inside the
    // given rectangle (image coordinates), or null while the image has no pixels.
    readImageData(surface: CanvasSurface, x: number, y: number, width: number, height: number): ImageData | null;
}

// java.awt.Graphics
export interface AwtGraphics {
    // java/awt/Graphics.getClip()Ljava/awt/Shape;
    getClip(): ClipShape;
    // java/awt/Graphics.clipRect(IIII)V
    clipRect(x: number, y: number, width: number, height: number): void;
    // java/awt/Graphics.drawImage(Ljava/awt/Image;IILjava/awt/image/ImageObserver;)Z
    drawImage(image: AwtImage | null, x: number, y: number, observer: ImageObserver | null): boolean;
    // java/awt/Graphics.setClip(Ljava/awt/Shape;)V
    setClip(clip: ClipShape): void;
}

// java.awt.Component (the java.awt.Canvas pe.S in the client)
export interface AwtComponent extends ImageObserver {
    // java/awt/Component.createImage(Ljava/awt/image/ImageProducer;)Ljava/awt/Image;
    createImage(producer: ImageProducer): AwtImage;
    // java/awt/Component.prepareImage(Ljava/awt/Image;Ljava/awt/image/ImageObserver;)Z
    prepareImage(image: AwtImage | null, observer: ImageObserver | null): boolean;
    // java/awt/Component.getGraphics()Ljava/awt/Graphics;
    getGraphics(): AwtGraphics;
}

// java.awt.image.SinglePixelPackedSampleModel, as DirectColorModel.createCompatibleSampleModel builds it for an
// int framebuffer: one int per pixel, scanline stride = width. The constructor checks what SampleModel checks.
export class SinglePixelPackedSampleModel {
    readonly width: number;
    readonly height: number;
    readonly scanlineStride: number;

    constructor(width: number, height: number) {
        if (width <= 0 || height <= 0) {
            throw new RangeError('Width (' + width + ') and height (' + height + ') must be > 0');
        }
        if (width * height >= 2147483647) {
            throw new RangeError('Dimensions (width=' + width + ' height=' + height + ') are too large');
        }
        this.width = width;
        this.height = height;
        this.scanlineStride = width;
    }
}

// java.awt.image.DirectColorModel(32, 0xff0000, 0xff00, 0xff), the only colour model the client builds: 8-bit
// channel masks and no alpha mask, so getRGB returns the masked channels with alpha 255.
export class DirectColorModel implements ColorModel {
    private readonly redShift: number;
    private readonly greenShift: number;
    private readonly blueShift: number;

    constructor(
        readonly bits: number,
        readonly redMask: number,
        readonly greenMask: number,
        readonly blueMask: number
    ) {
        this.redShift = 31 - Math.clz32(redMask & -redMask);
        this.greenShift = 31 - Math.clz32(greenMask & -greenMask);
        this.blueShift = 31 - Math.clz32(blueMask & -blueMask);
    }

    getRGB(pixel: number): number {
        const red = (pixel & this.redMask) >>> this.redShift;
        const green = (pixel & this.greenMask) >>> this.greenShift;
        const blue = (pixel & this.blueMask) >>> this.blueShift;
        return 0xff000000 | (red << 16) | (green << 8) | blue;
    }

    // java/awt/image/ColorModel.createCompatibleSampleModel(II)Ljava/awt/image/SampleModel;
    createCompatibleSampleModel(width: number, height: number): SinglePixelPackedSampleModel {
        return new SinglePixelPackedSampleModel(width, height);
    }
}

// Writes one ColorModel.getRGB word (0xAARRGGBB) into canvas RGBA bytes.
export function putRgba(target: Uint8ClampedArray, index: number, argb: number): void {
    target[index] = (argb >>> 16) & 0xff;
    target[index + 1] = (argb >>> 8) & 0xff;
    target[index + 2] = argb & 0xff;
    target[index + 3] = (argb >>> 24) & 0xff;
}

const littleEndian = new Uint8Array(Uint32Array.of(1).buffer)[0] === 1;
const imageWords = new WeakMap<ImageData, Uint32Array>();

// Converts the rectangle x, y, width, height of an int raster (scanline stride = image width) into canvas ImageData
// through the colour model, allocating the ImageData on first use.
export function rasterToImageData(surface: CanvasSurface, data: ImageData | null, raster: Int32Array, imageWidth: number, imageHeight: number, model: ColorModel, x: number, y: number, width: number, height: number): ImageData {
    const target = data === null ? surface.createImageData(imageWidth, imageHeight) : data;
    const rgba = target.data;
    // Both gamepacks use this opaque RGB model. Write its RGBA bytes in one store.
    if (
        littleEndian &&
        rgba.BYTES_PER_ELEMENT === 1 &&
        !(rgba.byteOffset & 3) &&
        model instanceof DirectColorModel &&
        model.getRGB === DirectColorModel.prototype.getRGB &&
        model.redMask === 0xff0000 &&
        model.greenMask === 0xff00 &&
        model.blueMask === 0xff
    ) {
        let words = imageWords.get(target);
        if (!words) {
            words = new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.length >>> 2);
            imageWords.set(target, words);
        }
        for (let row = y; row < y + height; row++) {
            const start = row * imageWidth + x;
            const end = start + width;
            for (let pos = start; pos < end; pos++) {
                const rgb = raster[pos];
                words[pos] = 0xff000000 | ((rgb & 0xff) << 16) | (rgb & 0xff00) | ((rgb >>> 16) & 0xff);
            }
        }
        return target;
    }
    for (let row = y; row < y + height; row++) {
        let pos = row * imageWidth + x;
        let index = pos * 4;
        for (let col = 0; col < width; col++) {
            putRgba(rgba, index, model.getRGB(raster[pos++]));
            index += 4;
        }
    }
    return target;
}

// java/lang/System.arraycopy for int[]: every check happens before the first element moves.
function arraycopy(src: Int32Array | null, srcPos: number, dest: Int32Array | null, destPos: number, length: number): void {
    const from = requireNonNull(src);
    const to = requireNonNull(dest);
    if (srcPos < 0 || destPos < 0 || length < 0 || srcPos + length > from.length || destPos + length > to.length) {
        throw new RangeError('arraycopy: last source index ' + (srcPos + length) + ' out of bounds for int[' + from.length + ']');
    }
    to.set(from.subarray(srcPos, srcPos + length), destPos);
}

// ImageConsumer.IMAGEERROR / SINGLEFRAMEDONE / STATICIMAGEDONE
const IMAGEERROR = 1;
const SINGLEFRAMEDONE = 2;
const STATICIMAGEDONE = 3;

// The image Component.createImage(ImageProducer) returns (sun.awt.image.ToolkitImage with its ImageRepresentation):
// the consumer side of ck. Production starts on the first prepareImage (or drawImage) and runs synchronously in the
// caller, as it does in the JDK for a producer image. setPixels stores the words in an int raster the way
// ImageRepresentation does for a DirectColorModel (no clipping; IntegerInterleavedRaster.setDataElements bounds
// checks), and a draw converts them once imageComplete has reported a frame. The adapter sends no ImageObserver
// notifications (ck.imageUpdate only counts calls and returns true).
export class ProducedImage implements AwtImage, ImageConsumer {
    private width = -1;
    private height = -1;
    private cmodel: ColorModel | null = null;
    private raster: Int32Array | null = null;
    private data: ImageData | null = null;
    private consuming = false;
    private allBits = false;
    private frameBits = false;
    private aborted = false;
    private error = false;

    constructor(
        readonly source: ImageProducer,
        private readonly surface: CanvasSurface
    ) {}

    // sun.awt.image.ImageRepresentation.startProduction()
    private startProduction(): void {
        if (!this.consuming) {
            this.consuming = true;
            this.source.startProduction(this);
        }
    }

    // sun.awt.image.ImageRepresentation.prepare(ImageObserver)
    prepare(_observer: ImageObserver | null): boolean {
        if (this.error) {
            return false;
        }
        if (!this.allBits) {
            this.startProduction();
        }
        return this.allBits;
    }

    // sun.awt.image.ImageRepresentation.drawToBufImage: start production if needed, then draw once a frame is complete.
    startDraw(_observer: ImageObserver | null): boolean {
        if (this.error) {
            return false;
        }
        if (!this.allBits && !this.aborted) {
            this.startProduction();
        }
        return (this.allBits || this.frameBits) && this.raster !== null;
    }

    getWidth(_observer: ImageObserver | null): number {
        return this.width;
    }

    getHeight(_observer: ImageObserver | null): number {
        return this.height;
    }

    readImageData(surface: CanvasSurface, x: number, y: number, width: number, height: number): ImageData | null {
        if (this.raster === null || this.cmodel === null) {
            return null;
        }
        this.data = rasterToImageData(surface, this.data, this.raster, this.width, this.height, this.cmodel, x, y, width, height);
        return this.data;
    }

    setDimensions(width: number, height: number): void {
        if (width <= 0 || height <= 0) {
            this.imageComplete(IMAGEERROR);
            return;
        }
        if (this.width !== width || this.height !== height) {
            this.raster = null;
            this.data = null;
        }
        this.width = width;
        this.height = height;
    }

    setProperties(_props: Map<unknown, unknown> | null): void {}

    // sun.awt.image.ImageRepresentation.setColorModel: the first model is kept; a later INT_RGB-masked
    // DirectColorModel replaces it.
    setColorModel(model: ColorModel | null): void {
        if (this.cmodel === null) {
            this.cmodel = model;
        } else if (model instanceof DirectColorModel && model.redMask === 0xff0000 && model.greenMask === 0xff00 && model.blueMask === 0xff) {
            this.cmodel = model;
        }
    }

    setHints(_hintflags: number): void {}

    // sun.awt.image.ImageRepresentation.createBufferedImage: cmodel.createCompatibleWritableRaster(width, height),
    // whose sample model rejects the size as SinglePixelPackedSampleModel does.
    private createBufferedImage(): void {
        const model = new SinglePixelPackedSampleModel(this.width, this.height);
        this.raster = new Int32Array(model.width * model.height);
        this.data = null;
    }

    // sun.awt.image.IntegerInterleavedRaster.setDataElements(IIIILjava/lang/Object;)V
    private setDataElements(x: number, y: number, w: number, h: number, inData: Int32Array): void {
        if (x < 0 || y < 0 || ((x + w) | 0) > this.width || ((y + h) | 0) > this.height) {
            throw new RangeError('Coordinate out of bounds!');
        }
        let yoff = (Math.imul(y, this.width) + x) | 0;
        let off = 0;
        for (let ystart = 0; ystart < h; ystart++) {
            arraycopy(inData, off, this.raster, yoff, w);
            off = (off + w) | 0;
            yoff = (yoff + this.width) | 0;
        }
    }

    // sun.awt.image.ImageRepresentation.setPixels(IIIILjava/awt/image/ColorModel;[III)V for an int DirectColorModel
    // raster. A model other than the announced one is converted through its getRGB into the same raster (ck always
    // passes the model it announced).
    setPixels(x: number, y: number, w: number, h: number, model: ColorModel | null, pixels: Int32Array | null, off: number, scansize: number): void {
        let lineOff = off;
        if (this.raster === null) {
            if (this.cmodel === null) {
                this.cmodel = model;
            }
            this.createBufferedImage();
        }
        const storage = new Int32Array(w);
        if (model === this.cmodel) {
            if (off === 0 && scansize === w) {
                this.setDataElements(x, y, w, h, requireNonNull(pixels));
            } else {
                for (let yoff = y; yoff < ((y + h) | 0); yoff++, lineOff = (lineOff + scansize) | 0) {
                    arraycopy(pixels, lineOff, storage, 0, w);
                    this.setDataElements(x, yoff, w, 1, storage);
                }
            }
        } else {
            const cm = requireNonNull(model);
            for (let yoff = y; yoff < ((y + h) | 0); yoff++, lineOff = (lineOff + scansize) | 0) {
                let poff = lineOff;
                for (let i = 0; i < w; i++) {
                    storage[i] = cm.getRGB(arrayAtI32(pixels, poff++));
                }
                this.setDataElements(x, yoff, w, 1, storage);
            }
        }
    }

    // sun.awt.image.ImageRepresentation.imageComplete(I)V (IMAGEERROR also runs dispose(), which drops the frame bits)
    imageComplete(status: number): void {
        let done: boolean;
        switch (status) {
            case IMAGEERROR:
                this.error = true;
                this.allBits = false;
                this.frameBits = false;
                done = true;
                break;
            case STATICIMAGEDONE:
                this.allBits = true;
                done = true;
                break;
            case SINGLEFRAMEDONE:
                this.frameBits = true;
                done = false;
                break;
            default:
                this.aborted = true;
                done = true;
                break;
        }
        if (done) {
            this.source.removeConsumer(this);
            this.consuming = false;
        }
    }
}

// java.awt.Graphics for a canvas: getClip/clipRect/setClip keep the user clip as SunGraphics2D does (null = none,
// as from Component.getGraphics(); clipRect intersects with java.awt.Rectangle.intersection, which can leave a
// negative size = empty clip), and drawImage puts the visible part of the image with putImageData's dirty
// rectangle, so the canvas receives the exact pixel words (putImageData ignores the canvas clip; the dirty
// rectangle carries it).
export type PresentCanvasImage = (image: AwtImage, x: number, y: number, rect: NonNullable<ClipShape>) => boolean;

export class CanvasGraphics implements AwtGraphics {
    private clip: ClipShape = null;

    constructor(
        readonly surface: CanvasSurface,
        private readonly presentImage?: PresentCanvasImage
    ) {}

    getClip(): ClipShape {
        return this.clip === null ? null : { x: this.clip.x, y: this.clip.y, width: this.clip.width, height: this.clip.height };
    }

    clipRect(x: number, y: number, width: number, height: number): void {
        if (this.clip === null) {
            this.clip = { x, y, width, height };
            return;
        }
        let tx1 = this.clip.x;
        let ty1 = this.clip.y;
        let tx2 = tx1 + this.clip.width;
        let ty2 = ty1 + this.clip.height;
        const rx2 = x + width;
        const ry2 = y + height;
        if (tx1 < x) {
            tx1 = x;
        }
        if (ty1 < y) {
            ty1 = y;
        }
        if (tx2 > rx2) {
            tx2 = rx2;
        }
        if (ty2 > ry2) {
            ty2 = ry2;
        }
        tx2 -= tx1;
        ty2 -= ty1;
        if (tx2 < -2147483648) {
            tx2 = -2147483648;
        }
        if (ty2 < -2147483648) {
            ty2 = -2147483648;
        }
        this.clip = { x: tx1, y: ty1, width: tx2, height: ty2 };
    }

    setClip(clip: ClipShape): void {
        this.clip = clip === null ? null : { x: clip.x, y: clip.y, width: clip.width, height: clip.height };
    }

    drawImage(image: AwtImage | null, x: number, y: number, observer: ImageObserver | null): boolean {
        if (image === null) {
            return true;
        }
        if (!image.startDraw(observer)) {
            return false;
        }
        const width = image.getWidth(observer);
        const height = image.getHeight(observer);
        let left = x;
        let top = y;
        let right = x + width;
        let bottom = y + height;
        if (this.clip !== null) {
            left = Math.max(left, this.clip.x);
            top = Math.max(top, this.clip.y);
            right = Math.min(right, this.clip.x + this.clip.width);
            bottom = Math.min(bottom, this.clip.y + this.clip.height);
        }
        if (left >= right || top >= bottom) {
            return true;
        }
        if (this.presentImage?.(image, x, y, { x: left, y: top, width: right - left, height: bottom - top })) return true;
        const data = image.readImageData(this.surface, left - x, top - y, right - left, bottom - top);
        if (data === null) {
            return false;
        }
        this.surface.putImageData(data, x, y, left - x, top - y, right - left, bottom - top);
        return true;
    }
}

// java.awt.Canvas for a canvas 2D context: createImage(ImageProducer) gives a ProducedImage, prepareImage starts
// its production (sun.awt.SunToolkit.prepareImage: an image that is not a producer image is ready).
export class CanvasComponent implements AwtComponent {
    presentImage?: PresentCanvasImage;
    private readonly presentCurrentImage: PresentCanvasImage = (image, x, y, rect) => this.presentImage?.(image, x, y, rect) ?? false;
    constructor(private drawingSurface: CanvasSurface | null = null) {}

    // A browser canvas acquires its drawing surface when the host mounts it.
    attachSurface(surface: CanvasSurface): void {
        this.drawingSurface = surface;
    }

    get surface(): CanvasSurface {
        return requireNonNull(this.drawingSurface);
    }

    createImage(producer: ImageProducer): AwtImage {
        return new ProducedImage(producer, this.surface);
    }

    prepareImage(image: AwtImage | null, observer: ImageObserver | null): boolean {
        if (!(image instanceof ProducedImage)) {
            return true;
        }
        return image.prepare(observer);
    }

    getGraphics(): AwtGraphics {
        return new CanvasGraphics(this.surface, this.presentCurrentImage);
    }

    // java/awt/Component.imageUpdate: keep watching until ALLBITS (32) or ABORT (128).
    imageUpdate(_image: AwtImage | null, infoflags: number, _x: number, _y: number, _width: number, _height: number): boolean {
        return (infoflags & (32 | 128)) === 0;
    }
}

// ---- oh ----------------------------------------------------------------------------------------------------------

export default abstract class PixScreen {
    // HD vk.a(Z)V
    static releasePixScreenStatics(guard: boolean): void {
        try {
            const RoofModeStatics = loadRoofModeStatics();
            releaseReferences(RoofModeStatics, 'roofMarks');
            const JagString = loadJagString();
            releaseReferences(JagString, 'collationOrder');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanLoadingWorldListData');
            if (guard) {
                PixScreen.releasePixScreenStatics(false);
            }
            const NpcType = loadNpcType();
            releaseReferences(NpcType, 'defaultName');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vk.H(' + guard + ')');
        }
    }

    // oh.b:Ljava/awt/Image;
    image: AwtImage | null = null;
    // oh.e:I
    height = 0;
    // oh.i:I
    width = 0;
    // oh.n:[I
    pixels: Int32Array | null = null;

    // oh.a(IIILjava/awt/Graphics;)V (dummy 1000 stripped: vg and client.d pass 1000)
    abstract draw(x: number, y: number, graphics: AwtGraphics | null): void;

    // oh.a(IILjava/awt/Component;B)V (dummy byte stripped: callers pass -34 and -83)
    abstract init(height: number, width: number, component: AwtComponent | null): void;

    // oh.a(BIIIILjava/awt/Graphics;)V (dummy -6 stripped). Draws the rectangle x, y, width, height of the image at
    // its own position (client.d passes the dirty interface rectangles).
    abstract drawClipped(height: number, width: number, x: number, y: number, graphics: AwtGraphics | null): void;

    // SD oh.a(I)V
    static unload(guard: number): void {
        try {
            releaseReferences(loadClient(), 'activeMapFunctionZ');
            loadClientPlayer().debugBallast = null;
            const text = loadLocalisedText();
            if (guard !== 1000) releaseReferences(text, 'germanIgnoresFull');
            releaseReferences(text, 'germanIgnoresFull');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'oh.L(' + guard + ')');
        }
    }

    // oh.<init>()V
    protected constructor() {}

    // oh.b(I)V (dummy 0 stripped: ph passes 0, oc passes 20 - 20, ck/wc pass 0, so its g = null branch never runs)
    bind(): void {
        Pix2D.setPixels(this.pixels, this.width, this.height);
    }

    // bj.a(IILjava/awt/Component;I)Loh; (dummy stripped: p.run passes -62, so its var0 >= -56 return-null guard never
    // runs). Java loads wc by name (Class.forName("wc").newInstance()) and falls back to new ck() on any Throwable.
    // Both subclasses import this module, so they are loaded with import() at call time (the kl.b(B)Le; Timer.create
    // pattern); that makes the factory async.
    static async create(height: number, component: AwtComponent | null, width: number): Promise<PixScreen> {
        try {
            const { default: BufferedImagePixMap } = await import('./BufferedImagePixMap');
            const pixMap: PixScreen = new BufferedImagePixMap();
            pixMap.init(height, width, component);
            return pixMap;
        } catch {
            const { default: ImageProducerPixMap } = await import('./ImageProducerPixMap');
            const pixMap = new ImageProducerPixMap();
            pixMap.init(height, width, component);
            return pixMap;
        }
    }
}
