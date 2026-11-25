import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import { glJar } from '#/client/ClientVariant';
import type PacketT from '#/io/PacketT';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, arrayPutObj, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import type TextureProvider from './TextureProvider';
import TextureOpMonochromeFill from './TextureOpMonochromeFill';
import TextureOpColour from './TextureOpColour';
import TextureOpHorizontalGradient from './TextureOpHorizontalGradient';
import TextureOpVerticalGradient from './TextureOpVerticalGradient';
import TextureOpBricks from './TextureOpBricks';
import TextureOpBoxBlur from './TextureOpBoxBlur';
import TextureOpClamp from './TextureOpClamp';
import TextureOpCombine from './TextureOpCombine';
import TextureOpCurve from './TextureOpCurve';
import TextureOpFlip from './TextureOpFlip';
import TextureOpColourGradient from './TextureOpColourGradient';
import TextureOpColourize from './TextureOpColourize';
import TextureOpWaveform from './TextureOpWaveform';
import TextureOpNoise from './TextureOpNoise';
import TextureOpWeave from './TextureOpWeave';
import TextureOpVoronoiNoise from './TextureOpVoronoiNoise';
import TextureOpHerringbone from './TextureOpHerringbone';
import TextureOpHslAdjust from './TextureOpHslAdjust';
import TextureOpTiledSprite from './TextureOpTiledSprite';
import TextureOpPolarDistortion from './TextureOpPolarDistortion';
import TextureOpTile from './TextureOpTile';
import TextureOpInterpolate from './TextureOpInterpolate';
import TextureOpInvert from './TextureOpInvert';
import TextureOpKaleidoscope from './TextureOpKaleidoscope';
import TextureOpMonochrome from './TextureOpMonochrome';
import TextureOpColourKey from './TextureOpColourKey';
import TextureOpBinary from './TextureOpBinary';
import TextureOpStripes from './TextureOpStripes';
import TextureOpIrregularBricks from './TextureOpIrregularBricks';
import TextureOpShapes from './TextureOpShapes';
import TextureOpRange from './TextureOpRange';
import TextureOpMandelbrot from './TextureOpMandelbrot';
import TextureOpEmboss from './TextureOpEmboss';
import TextureOpNormalMap from './TextureOpNormalMap';
import TextureOpPerlinNoise from './TextureOpPerlinNoise';
import TextureOpEdgeDetector from './TextureOpEdgeDetector';
import TextureOpTexture from './TextureOpTexture';
import TextureOpDiagonalWaves from './TextureOpDiagonalWaves';
import TextureOpLineNoise from './TextureOpLineNoise';
import TextureOpSprite from './TextureOpSprite';
import SeqTypeClass from '#/config/SeqType';
import { loadCookieStatics } from '#/util/GamepackClasses';

function checkRowIndex(row: Int32Array | null, index: number): asserts row is Int32Array {
    arrayAtI32(row, index);
}

export default class ProceduralTexture {
    // HD lc.a(Z)V
    static releaseHdStatics(guard: boolean): void {
        try {
            const SeqType = SeqTypeClass;
            releaseReferences(SeqType, 'm_recentUse');
            if (guard) {
                const CookieStatics = loadCookieStatics();
                releaseReferences(CookieStatics, 'settingsCookieKey');
            }
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'settingsCookieKey');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'lc.A(' + guard + ')');
        }
    }

    static gammaTable: Int32Array | null = new Int32Array(256); // SD kg.x:[I, HD i.ac:[I
    static tableBrightness = -1.0; // SD wf.L:D, HD jh.f:D

    private textureIds: Int32Array | null = null; // SD jd.a:[I, HD lc.k:[I
    private operators: (TextureOp | null)[] | null = null; // SD jd.c:[Lbf;, HD lc.g:[Lj;
    private colour: TextureOp | null = null; // SD jd.f:Lbf;, HD lc.d:Lj;
    private alpha: TextureOp | null = null; // SD jd.h:Lbf;, HD lc.i:Lj;
    private spriteIds: Int32Array | null = null; // SD jd.p:[I, HD lc.b:[I

    // SD jd.<init>()V, HD lc.<init>()V
    constructor();
    // SD jd.<init>(Lgd;)V, HD lc.<init>(Lwa;)V
    constructor(packet: PacketT | null);
    constructor(packet?: PacketT | null) {
        if (packet === undefined) {
            this.textureIds = new Int32Array(0);
            this.spriteIds = new Int32Array(0);
            this.colour = new TextureOpMonochromeFill();
            this.colour.cacheCapacity = 1;
            this.alpha = new TextureOpMonochromeFill();
            this.operators = [this.colour, this.alpha];
            this.alpha.cacheCapacity = 1;
            return;
        }

        let sprites = 0;
        const p = requireNonNull(packet);
        const count = p.g1();
        if (glJar) this.operators = new Array<TextureOp | null>(count).fill(null);
        const connections = new Array<Int32Array | null>(count).fill(null);
        let textures = 0;
        if (!glJar) this.operators = new Array<TextureOp | null>(count).fill(null);
        for (let i = 0; i < count; i++) {
            const op = ProceduralTexture.decodeOp(p);
            if (op.getSpriteId() >= 0) sprites++;
            if (op.getTextureId() >= 0) textures++;
            const inputs = requireNonNull(op.children).length;
            arrayPutObj(connections, i, new Int32Array(inputs));
            for (let j = 0; j < inputs; j++) arrayPutI32(arrayAtObj(connections, i), j, p.g1());
            arrayPutObj(this.operators, i, op);
        }
        if (!glJar) this.textureIds = new Int32Array(textures);
        this.spriteIds = new Int32Array(sprites);
        if (glJar) this.textureIds = new Int32Array(textures);
        textures = 0;
        sprites = 0;
        for (let i = 0; i < count; i++) {
            const op = requireNonNull(arrayAtObj(this.operators, i));
            const inputs = requireNonNull(op.children).length;
            for (let j = 0; j < inputs; j++) {
                arrayPutObj(op.children, j, arrayAtObj(this.operators, arrayAtI32(arrayAtObj(connections, i), j)));
            }
            const sprite = op.getSpriteId();
            const texture = op.getTextureId();
            if (sprite > 0) arrayPutI32(this.spriteIds, sprites++, sprite);
            if (texture > 0) arrayPutI32(this.textureIds, textures++, texture);
            arrayPutObj(connections, i, null);
        }
        this.colour = arrayAtObj(this.operators, p.g1());
        this.alpha = arrayAtObj(this.operators, p.g1());
    }

    // SD la.d(II)Lbf;, HD sc.a(IZ)Lj;
    static createOp(id: number): TextureOp | null {
        if (id !== 0) {
            if (id === 1) return new TextureOpColour();
            if (id === 2) return new TextureOpHorizontalGradient();
            if (id === 3) return new TextureOpVerticalGradient();
            if (id === 4) return new TextureOpBricks();
            if (id === 5) return new TextureOpBoxBlur();
            if (id === 6) return new TextureOpClamp();
            if (id === 7) return new TextureOpCombine();
            if (id === 8) return new TextureOpCurve();
            if (id === 9) return new TextureOpFlip();
            if (id === 10) return new TextureOpColourGradient();
            if (id === 11) return new TextureOpColourize();
            if (id === 12) return new TextureOpWaveform();
            if (id === 13) return new TextureOpNoise();
            if (id === 14) return new TextureOpWeave();
            if (id === 15) return new TextureOpVoronoiNoise();
            if (id === 16) return new TextureOpHerringbone();
            if (id === 17) return new TextureOpHslAdjust();
            if (id === 18) return new TextureOpTiledSprite();
            if (id === 19) return new TextureOpPolarDistortion();
            if (id === 20) return new TextureOpTile();
            if (id === 21) return new TextureOpInterpolate();
            if (id === 22) return new TextureOpInvert();
            if (id === 23) return new TextureOpKaleidoscope();
            if (id === 24) return new TextureOpMonochrome();
            if (id === 25) return new TextureOpColourKey();
            if (id === 26) return new TextureOpBinary();
            if (id === 27) return new TextureOpStripes();
            if (id === 28) return new TextureOpIrregularBricks();
            if (id === 29) return new TextureOpShapes();
            if (id === 30) return new TextureOpRange();
            if (id === 31) return new TextureOpMandelbrot();
            if (id === 32) return new TextureOpEmboss();
            if (id === 33) return new TextureOpNormalMap();
            if (id === 34) return new TextureOpPerlinNoise();
            if (id === 35) return new TextureOpEdgeDetector();
            if (id === 36) return new TextureOpTexture();
            if (id === 37) return new TextureOpDiagonalWaves();
            if (id === 38) return new TextureOpLineNoise();
            if (id === 39) return new TextureOpSprite();
            return null;
        }
        return new TextureOpMonochromeFill();
    }

    // SD ll.a(Lgd;I)Lbf;, HD qk.a(BLwa;)Lj;
    static decodeOp(packet: PacketT | null): TextureOp {
        const p = requireNonNull(packet);
        p.g1();
        const type = p.g1();
        const op = ProceduralTexture.createOp(type);
        // putfield checks its receiver after reading the capacity byte.
        const capacity = p.g1();
        const decoded = requireNonNull(op);
        decoded.cacheCapacity = capacity;
        const count = p.g1();
        for (let i = 0; i < count; i++) {
            const code = p.g1();
            decoded.decode(p, code);
        }
        decoded.postDecode();
        return decoded;
    }

    // SD jd.a(Lpc;BLal;)Z, HD lc.a(ZLm;Lve;)Z
    isReady(provider: TextureProvider | null, sprites: Js5 | null): boolean {
        if (TextureOpSprite.spriteGroupId <= 0) {
            for (let i = 0; i < requireNonNull(this.spriteIds).length; i++) {
                const id = arrayAtI32(this.spriteIds, i);
                if (!requireNonNull(sprites).RequestDownload2(id)) return false;
            }
        } else {
            for (let i = 0; i < requireNonNull(this.spriteIds).length; i++) {
                const group = TextureOpSprite.spriteGroupId;
                const id = arrayAtI32(this.spriteIds, i);
                if (!requireNonNull(sprites).RequestDownload(true, group, id)) return false;
            }
        }
        for (let i = 0; i < requireNonNull(this.textureIds).length; i++) {
            const id = arrayAtI32(this.textureIds, i);
            if (!requireNonNull(provider).isLoaded(id)) return false;
        }
        return true;
    }

    // SD ri.a(ID)V, HD th.a(DI)V
    static setBrightness(brightness: number): void {
        if (ProceduralTexture.tableBrightness !== brightness) {
            for (let i = 0; i < 256; i++) {
                const sample = doubleToInt(Math.pow(i / 255.0, brightness) * 255.0);
                arrayPutI32(ProceduralTexture.gammaTable, i, sample > 255 ? 255 : sample);
            }
            ProceduralTexture.tableBrightness = brightness;
        }
    }

    // jd.a(Lpc;Lal;IZIZDI)[I
    getPixels(provider: TextureProvider | null, sprites: Js5 | null, transpose: boolean, width: number, flipHorizontal: boolean, brightness: number, height: number): Int32Array {
        if (glJar) return this.getPixelsHd(height, transpose, width, brightness, sprites, provider, flipHorizontal);
        ProceduralTexture.setBrightness(brightness);
        TextureOp.textureProvider = provider;
        TextureOpSprite.spriteArchive = sprites;
        TextureOp.setSize(width, height);
        for (let i = 0; i < requireNonNull(this.operators).length; i++) {
            requireNonNull(arrayAtObj(this.operators, i)).initCache(width, height);
        }
        const pixels = new Int32Array(Math.imul(height, width));
        let first: number, end: number, step: number;
        if (!flipHorizontal) {
            step = 1;
            end = width;
            first = 0;
        } else {
            end = -1;
            step = -1;
            first = (width - 1) | 0;
        }
        let dest = 0;
        for (let y = 0; y < height; y++) {
            if (transpose) dest = y;
            let r: Int32Array | null, g: Int32Array | null, b: Int32Array | null;
            if (!requireNonNull(this.colour).monochrome) {
                const channels = requireNonNull(this.colour).getColourOutput(y);
                r = arrayAtObj(channels, 0);
                g = arrayAtObj(channels, 1);
                b = arrayAtObj(channels, 2);
            } else {
                const row = requireNonNull(this.colour).getMonochromeOutput(y);
                b = row;
                r = row;
                g = row;
            }
            for (let x = first; x !== end; x = (x + step) | 0) {
                let red = arrayAtI32(r, x) >> 4;
                if (red > 255) red = 255;
                if (red < 0) red = 0;
                let blue = arrayAtI32(b, x) >> 4;
                if (blue > 255) blue = 255;
                let green = arrayAtI32(g, x) >> 4;
                red = arrayAtI32(ProceduralTexture.gammaTable, red);
                if (green > 255) green = 255;
                if (blue < 0) blue = 0;
                blue = arrayAtI32(ProceduralTexture.gammaTable, blue);
                if (green < 0) green = 0;
                green = arrayAtI32(ProceduralTexture.gammaTable, green);
                arrayPutI32(pixels, dest++, (blue + (green << 8) + (red << 16)) | 0);
                if (transpose) dest = (dest + width - 1) | 0;
            }
        }
        for (let i = 0; i < requireNonNull(this.operators).length; i++) {
            requireNonNull(arrayAtObj(this.operators, i)).clearImageCache();
        }
        return pixels;
    }

    // HD lc.a(IZIDILve;Lm;Z)[I
    private getPixelsHd(height: number, transpose: boolean, width: number, brightness: number, sprites: Js5 | null, provider: TextureProvider | null, flipHorizontal: boolean): Int32Array {
        ProceduralTexture.setBrightness(brightness);
        TextureOp.textureProvider = provider;
        TextureOpSprite.spriteArchive = sprites;
        TextureOp.setSize(width, height);
        for (let i = 0; i < requireNonNull(this.operators).length; i++) {
            requireNonNull(arrayAtObj(this.operators, i)).initCache(width, height);
        }
        const pixels = new Int32Array(Math.imul(height, width));
        let first: number, end: number, step: number;
        if (!flipHorizontal) {
            step = 1;
            first = 0;
            end = width;
        } else {
            step = -1;
            end = -1;
            first = (width - 1) | 0;
        }
        let dest = 0;
        for (let y = 0; y < height; y++) {
            if (transpose) dest = y;
            let redRow: Int32Array | null, blueRow: Int32Array | null, greenRow: Int32Array | null;
            if (requireNonNull(this.colour).monochrome) {
                redRow = requireNonNull(this.colour).getMonochromeOutput(y, 109);
                greenRow = redRow;
                blueRow = redRow;
            } else {
                const channels = requireNonNull(this.colour).getColourOutput(y);
                redRow = arrayAtObj(channels, 0);
                blueRow = arrayAtObj(channels, 2);
                greenRow = arrayAtObj(channels, 1);
            }
            for (let x = first; x !== end; x = (x + step) | 0) {
                let red = arrayAtI32(redRow, x) >> 4;
                if (red > 255) red = 255;
                if (red < 0) red = 0;
                red = arrayAtI32(ProceduralTexture.gammaTable, red);
                let blue = arrayAtI32(blueRow, x) >> 4;
                let green = arrayAtI32(greenRow, x) >> 4;
                if (green > 255) green = 255;
                if (green < 0) green = 0;
                if (blue > 255) blue = 255;
                green = arrayAtI32(ProceduralTexture.gammaTable, green);
                if (blue < 0) blue = 0;
                blue = arrayAtI32(ProceduralTexture.gammaTable, blue);
                arrayPutI32(pixels, dest++, ((red << 16) + (green << 8) + blue) | 0);
                if (transpose) dest = (dest + width - 1) | 0;
            }
        }
        for (let i = 0; i < requireNonNull(this.operators).length; i++) {
            requireNonNull(arrayAtObj(this.operators, i)).clearImageCache();
        }
        return pixels;
    }

    // HD lc.a(IIZLm;DILve;)[B. The colour and alpha graphs produce one RGBA texel per column.
    getPixelsRgba(height: number, width: number, transpose: boolean, provider: TextureProvider | null, brightness: number, sprites: Js5 | null): Uint8Array {
        const pixels = new Uint8Array(Math.imul(4 * width, height));
        ProceduralTexture.setBrightness(brightness);
        TextureOpSprite.spriteArchive = sprites;
        TextureOp.textureProvider = provider;
        TextureOp.setSize(width, height);
        for (let i = 0; i < requireNonNull(this.operators).length; i++) {
            requireNonNull(arrayAtObj(this.operators, i)).initCache(width, height);
        }
        let dest = 0;
        for (let y = 0; y < height; y++) {
            if (transpose) dest = y << 2;
            let redRow: Int32Array | null, greenRow: Int32Array | null, blueRow: Int32Array | null;
            if (requireNonNull(this.colour).monochrome) {
                redRow = requireNonNull(this.colour).getMonochromeOutput(y, -98);
                greenRow = redRow;
                blueRow = redRow;
            } else {
                const channels = requireNonNull(this.colour).getColourOutput(y);
                redRow = arrayAtObj(channels, 0);
                greenRow = arrayAtObj(channels, 1);
                blueRow = arrayAtObj(channels, 2);
            }
            const alphaRow = requireNonNull(this.alpha).monochrome ? requireNonNull(this.alpha).getMonochromeOutput(y, -103) : arrayAtObj(requireNonNull(this.alpha).getColourOutput(y), 0);
            const last = (width - 1) | 0;
            // lc reads all three channels at the highest index before accessing gamma or alpha.
            // Every subsequent index in these same typed rows is smaller and nonnegative.
            if (last < 0) continue;
            checkRowIndex(redRow, last);
            checkRowIndex(greenRow, last);
            checkRowIndex(blueRow, last);
            const gamma = ProceduralTexture.gammaTable;
            for (let x = last; x >= 0; x--) {
                let red = redRow[x] >> 4;
                if (red > 255) red = 255;
                if (red < 0) red = 0;
                let green = greenRow[x] >> 4;
                if (green > 255) green = 255;
                let blue = blueRow[x] >> 4;
                if (blue > 255) blue = 255;
                red = gamma?.[red] ?? arrayAtI32(gamma, red);
                if (blue < 0) blue = 0;
                if (green < 0) green = 0;
                green = gamma?.[green] ?? arrayAtI32(gamma, green);
                blue = gamma?.[blue] ?? arrayAtI32(gamma, blue);
                let alpha: number;
                if (red !== 0 || green !== 0 || blue !== 0) {
                    alpha = (alphaRow?.[x] ?? arrayAtI32(alphaRow, x)) >> 4;
                    if (alpha > 255) alpha = 255;
                    if (alpha < 0) alpha = 0;
                } else {
                    alpha = 0;
                }
                // Both the byte length and the starting offset are multiples of four.
                if (dest < 0 || dest >= pixels.length) arrayPutU8(pixels, dest, red);
                pixels[dest++] = red;
                pixels[dest++] = green;
                pixels[dest++] = blue;
                pixels[dest++] = alpha;
                if (transpose) dest = (dest - 4 + (width << 2)) | 0;
            }
        }
        for (let i = 0; i < requireNonNull(this.operators).length; i++) {
            requireNonNull(arrayAtObj(this.operators, i)).clearImageCache();
        }
        return pixels;
    }
}
