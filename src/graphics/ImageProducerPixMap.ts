import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import PixScreen, { DirectColorModel, type AwtComponent, type AwtGraphics, type AwtImage, type ColorModel, type ImageConsumer, type ImageObserver, type ImageProducer } from './PixScreen';
import { loadClient, loadWorldMap } from '#/util/GamepackClasses';
import { glJar } from '#/client/ClientVariant';

// ck implements java.awt.image.ImageProducer and ImageObserver; their methods keep the JDK names. Java declares
// d, a(IIIII), removeConsumer, isConsumer and addConsumer synchronized; the browser runs them on one thread.
// ck's statics all belong to other classes (membermap), its call counters are artifacts.
export default class ImageProducerPixMap extends PixScreen implements ImageProducer, ImageObserver {
    // HD di.b(I)V
    static releaseImageProducerPixMapStatics(guard: number): void {
        try {
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'labelLines');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ob stays deferred until di.b(I)V in ImageProducerPixMap.releaseImageProducerPixMapStatics.
            const ClientEntity = (require('#/dash3d/ClientEntity') as typeof import('#/dash3d/ClientEntity')).default;
            releaseReferences(ClientEntity, 'shadowModelCache');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD l stays deferred until di.b(I)V in ImageProducerPixMap.releaseImageProducerPixMapStatics.
            const ServerActiveProperties = (require('#/ui/ServerActiveProperties') as typeof import('#/ui/ServerActiveProperties')).default;
            releaseReferences(ServerActiveProperties, 'DEFAULT');
            if (guard !== 27316) {
                const Client = loadClient();
                Client.scrollGrabbed = true;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'di.I(' + guard + ')');
        }
    }

    // ck.q:Ljava/awt/image/ColorModel;
    private colorModel: ColorModel | null = null;
    // ck.A:Ljava/awt/image/ImageConsumer;
    private consumer: ImageConsumer | null = null;

    // ck.imageUpdate(Ljava/awt/Image;IIIII)Z
    imageUpdate(_image: AwtImage | null, _infoflags: number, _x: number, _y: number, _width: number, _height: number): boolean {
        return true;
    }

    // ck.d(I)V. Every caller passes 0; the parameter is kept because it is the x argument of setPixels.
    private sendFrame(x: number): void {
        if (this.consumer === null) {
            return;
        }

        this.consumer.setPixels(x, 0, this.width, this.height, this.colorModel, this.pixels, 0, this.width);
        requireNonNull(this.consumer).imageComplete(2);
    }

    // ck.removeConsumer(Ljava/awt/image/ImageConsumer;)V
    removeConsumer(consumer: ImageConsumer | null): void {
        if (this.consumer === consumer) {
            this.consumer = null;
        }
    }

    // ck.requestTopDownLeftRightResend(Ljava/awt/image/ImageConsumer;)V
    requestTopDownLeftRightResend(_consumer: ImageConsumer | null): void {}

    // ck.a(BIIIILjava/awt/Graphics;)V (dummy -6 stripped, with its a(null, -123) guard)
    drawClipped(height: number, width: number, x: number, y: number, graphics: AwtGraphics | null): void {
        this.sendRegion(height, x, width, y);
        const g = requireNonNull(graphics);
        const clip = g.getClip();
        g.clipRect(x, y, width, height);
        g.drawImage(this.image, 0, 0, this);
        g.setClip(clip);
    }

    // ck.isConsumer(Ljava/awt/image/ImageConsumer;)Z
    isConsumer(consumer: ImageConsumer | null): boolean {
        return consumer === this.consumer;
    }

    // ck.a(IILjava/awt/Component;B)V (dummy stripped: callers pass -83, so the var4 > -16 branch that nulls q never runs)
    init(height: number, width: number, component: AwtComponent | null): void {
        // HD di.a(IZILjava/awt/Component;)V stores the height before allocating.
        if (glJar) this.height = height;
        this.pixels = new Int32Array((1 + Math.imul(width, height)) | 0);
        if (!glJar) this.height = height;
        this.width = width;
        this.colorModel = new DirectColorModel(32, 0xff0000, 0xff00, 0xff);
        this.image = requireNonNull(component).createImage(this);
        this.sendFrame(0);
        requireNonNull(component).prepareImage(this.image, this);
        this.sendFrame(0);
        requireNonNull(component).prepareImage(this.image, this);
        this.sendFrame(0);
        requireNonNull(component).prepareImage(this.image, this);
        this.bind();
    }

    // ck.a(IIIII)V (dummy stripped: its only caller passes -6 ^ 105 = -109, so the var4 >= -33 branch that nulls A
    // never runs)
    private sendRegion(height: number, x: number, width: number, y: number): void {
        if (this.consumer === null) {
            return;
        }

        this.consumer.setPixels(x, y, width, height, this.colorModel, this.pixels, (Math.imul(y, this.width) + x) | 0, this.width);
        requireNonNull(this.consumer).imageComplete(2);
    }

    // ck.addConsumer(Ljava/awt/image/ImageConsumer;)V
    addConsumer(consumer: ImageConsumer | null): void {
        this.consumer = consumer;
        const c = requireNonNull(consumer);
        c.setDimensions(this.width, this.height);
        c.setProperties(null);
        c.setColorModel(this.colorModel);
        c.setHints(14);
    }

    // ck.startProduction(Ljava/awt/image/ImageConsumer;)V
    startProduction(consumer: ImageConsumer | null): void {
        this.addConsumer(consumer);
    }

    // ck.a(IIILjava/awt/Graphics;)V (dummy 1000 stripped, with its drawClipped(-96, ...) guard)
    draw(x: number, y: number, graphics: AwtGraphics | null): void {
        this.sendFrame(0);
        requireNonNull(graphics).drawImage(this.image, x, y, this);
    }

    // ck.<init>()V
    constructor() {
        super();
    }
}
