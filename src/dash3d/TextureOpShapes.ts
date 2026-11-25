import { isJavaRuntimeException } from '#/util/JavaException';
import { glJar } from '#/client/ClientVariant';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import type TextureShape from './TextureShape';
import TextureShapeBezier from './TextureShapeBezier';
import TextureShapeEllipse from './TextureShapeEllipse';
import TextureShapeLine from './TextureShapeLine';
import TextureShapeRaster from './TextureShapeRaster';
import TextureShapeRect from './TextureShapeRect';
import { loadClient, loadGameWorld, loadLocalisedText, loadLogin, loadMinimenu, loadWorldMap } from '#/util/GamepackClasses';

// gj
export default class TextureOpShapes extends TextureOp {
    // HD si.h(I)V
    static releaseTextureOpShapesStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanContinue');
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'upperOverlayIds');
            if (guard !== 0) {
                return;
            }
            const GameWorld = loadGameWorld();
            releaseReferences(GameWorld, 'worldListBuffer');
            const Client = loadClient();
            releaseReferences(Client, 'grandExchangeOffers');
            releaseReferences(LocalisedText, 'englishTake');
            const Login = loadLogin();
            releaseReferences(Login, 'suggestedNames');
            releaseReferences(LocalisedText, 'take', 'loadingPercentStart');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'amber');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'si.E(' + guard + ')');
        }
    }

    private shapes: (TextureShape | null)[] | null = null; // gj.cb:[Lu;

    // gj.<init>()V
    constructor() {
        super(0, true);
    }

    // gj.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) {
            const source = requireNonNull(packet);
            this.shapes = new Array<TextureShape | null>(source.g1()).fill(null);
            for (let i = 0; i < this.shapes.length; i++) {
                switch (source.g1()) {
                    case 0:
                        this.shapes[i] = TextureShapeLine.decode(source);
                        break;
                    case 1:
                        this.shapes[i] = TextureShapeBezier.decode(source);
                        break;
                    case 2:
                        this.shapes[i] = TextureShapeRect.decode(source);
                        break;
                    case 3:
                        this.shapes[i] = TextureShapeEllipse.decode(source);
                        break;
                }
            }
        } else if (code === 1) {
            this.monochrome = requireNonNull(packet).g1() === 1;
        }
    }

    // gj.a([[II)V
    private drawShapes(canvas: (Int32Array | null)[] | null, clipMinX: number): void {
        const width = TextureOp.width,
            height = TextureOp.height;
        TextureShapeRaster.bindCanvas(canvas);
        TextureShapeRaster.setClip(TextureOp.widthMask, 0, glJar ? 0 : clipMinX, TextureOp.heightMask);
        if (this.shapes !== null) {
            for (let i = 0; i < requireNonNull(this.shapes).length; i++) {
                const shape = requireNonNull(arrayAtObj(this.shapes, i));
                const fill = shape.fillColour,
                    outline = shape.outlineColour;
                if (fill < 0) {
                    if (outline >= 0) shape.outline(width, height);
                } else if (outline < 0) {
                    shape.fill(width, height);
                } else {
                    shape.fillAndOutline(height, width);
                }
            }
        }
    }

    // gj.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) this.drawShapes(requireNonNull(this.monochromeImageCache).getAll(), 0);
        return output;
    }

    // gj.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const height = TextureOp.height,
                width = TextureOp.width;
            let pixels = glJar ? null : requireNonNull(this.colourImageCache).getAll();
            if (width < 0 || height < 0) throw new RangeError('NegativeArraySizeException');
            const canvas = Array.from({ length: height }, () => new Int32Array(width));
            if (glJar) pixels = requireNonNull(this.colourImageCache).getAll();
            this.drawShapes(canvas, 0);
            for (let y = 0; y < TextureOp.height; y++) {
                const packed = arrayAtObj(canvas, y);
                const channels = arrayAtObj(pixels, y);
                const r = arrayAtObj(channels, 0),
                    g = arrayAtObj(channels, 1),
                    b = arrayAtObj(channels, 2);
                for (let x = 0; x < TextureOp.width; x++) {
                    const pixel = arrayAtI32(packed, x);
                    arrayPutI32(b, x, 4080 & (pixel << 4));
                    arrayPutI32(g, x, (pixel >> 4) & 4080);
                    arrayPutI32(r, x, (0xff0000 & pixel) >> 12);
                }
            }
        }
        return output;
    }
}
