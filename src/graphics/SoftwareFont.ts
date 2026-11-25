import Client from '#/client/Client';
import { glJar } from '#/client/ClientVariant';
import LRUHashCache from '#/datastruct/LRUHashCache';
import { byteAt } from '#/io/JavaByteArray';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import PixfontGeneric from './PixfontGeneric';
import Pix2D from './Pix2D';

export default class SoftwareFont extends PixfontGeneric {
    // fa.p:Lve;
    static cache: LRUHashCache<SoftwareFont> = new LRUHashCache<SoftwareFont>(4);

    // fg.wb:[[B
    private glyphMasks: (Uint8Array | null)[] | null;

    // fg.<init>([B[I[I[I[I[[B)V
    constructor(data: Uint8Array | null, xOffsets: Int32Array | null, yOffsets: Int32Array | null, widths: Int32Array | null, heights: Int32Array | null, glyphMasks: (Uint8Array | null)[] | null);
    // fg.<init>([B)V
    constructor(data: Uint8Array | null);
    constructor(data: Uint8Array | null, xOffsets?: Int32Array | null, yOffsets?: Int32Array | null, widths?: Int32Array | null, heights?: Int32Array | null, glyphMasks?: (Uint8Array | null)[] | null) {
        if (xOffsets === undefined || yOffsets === undefined || widths === undefined || heights === undefined || glyphMasks === undefined) {
            // fg.<init>([B)V
            super(data);
            this.glyphMasks = new Array<Uint8Array | null>(256).fill(null);
        } else {
            // fg.<init>([B[I[I[I[I[[B)V
            super(data, xOffsets, yOffsets, widths, heights);
            this.glyphMasks = new Array<Uint8Array | null>(256).fill(null);
            this.glyphMasks = glyphMasks;
        }
    }

    // fg.a([I[BIIIIIIII)V
    private static plotLetterTrans(dst: Int32Array | null, mask: Uint8Array | null, colour: number, maskPos: number, dstPos: number, width: number, height: number, dstStep: number, maskStep: number, alpha: number): void {
        if (Pix2D.spanTarget?.glyph(dst, mask, colour, maskPos, dstPos, width, height, dstStep, maskStep, alpha)) return;
        colour = ((Math.imul(colour & 16711935, alpha) & -16711936) + (Math.imul(colour & 65280, alpha) & 16711680)) >> 8;
        alpha = (256 - alpha) | 0;

        for (let y = -height | 0; y < 0; y++) {
            for (let x = -width | 0; x < 0; x++) {
                if (byteAt(mask, maskPos++) !== 0) {
                    const pixel = arrayAtI32(dst, dstPos);
                    arrayPutI32(dst, dstPos++, ((((Math.imul(pixel & 16711935, alpha) & -16711936) + (Math.imul(pixel & 65280, alpha) & 16711680)) >> 8) + colour) | 0);
                } else {
                    dstPos++;
                }
            }

            dstPos = (dstPos + dstStep) | 0;
            maskPos = (maskPos + maskStep) | 0;
        }
    }

    // fg.a([I[BIIIIIII)V
    private static plotLetter(dst: Int32Array | null, mask: Uint8Array | null, colour: number, maskPos: number, dstPos: number, width: number, height: number, dstStep: number, maskStep: number): void {
        if (Pix2D.spanTarget?.glyph(dst, mask, colour, maskPos, dstPos, width, height, dstStep, maskStep)) return;
        const quads = -(width >> 2) | 0;
        width = -(width & 3) | 0;

        for (let y = -height | 0; y < 0; y++) {
            for (let x = quads; x < 0; x++) {
                if (byteAt(mask, maskPos++) !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                if (byteAt(mask, maskPos++) !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                if (byteAt(mask, maskPos++) !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                if (byteAt(mask, maskPos++) !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }
            }

            for (let x = width; x < 0; x++) {
                if (byteAt(mask, maskPos++) !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }
            }

            dstPos = (dstPos + dstStep) | 0;
            maskPos = (maskPos + maskStep) | 0;
        }
    }

    // fg.a(IIIIIIIZ)V
    override drawGlyphAlpha(c: number, x: number, y: number, width: number, height: number, colour: number, alpha: number, _shadow: boolean): void {
        let dstPos = (x + Math.imul(y, Pix2D.width)) | 0;
        let dstStep = (Pix2D.width - width) | 0;
        let maskStep = 0;
        let maskPos = 0;
        if (y < Pix2D.clipMinY) {
            const skip = (Pix2D.clipMinY - y) | 0;
            height = (height - skip) | 0;
            y = Pix2D.clipMinY;
            maskPos = (maskPos + Math.imul(skip, width)) | 0;
            dstPos = (dstPos + Math.imul(skip, Pix2D.width)) | 0;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (height - (y + height - Pix2D.clipMaxY)) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const skip = (Pix2D.clipMinX - x) | 0;
            width = (width - skip) | 0;
            x = Pix2D.clipMinX;
            maskPos = (maskPos + skip) | 0;
            dstPos = (dstPos + skip) | 0;
            maskStep = (maskStep + skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            const skip = (x + width - Pix2D.clipMaxX) | 0;
            width = (width - skip) | 0;
            maskStep = (maskStep + skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (width > 0 && height > 0) {
            SoftwareFont.plotLetterTrans(Pix2D.pixels, arrayAtObj(this.glyphMasks, c), colour, maskPos, dstPos, width, height, dstStep, maskStep, alpha);
        }
    }

    // fg.a(IIIIIIZ)V
    override drawGlyph(c: number, x: number, y: number, width: number, height: number, colour: number, _shadow: boolean): void {
        let dstPos = (x + Math.imul(y, Pix2D.width)) | 0;
        let dstStep = (Pix2D.width - width) | 0;
        let maskStep = 0;
        let maskPos = 0;
        if (y < Pix2D.clipMinY) {
            const skip = (Pix2D.clipMinY - y) | 0;
            height = (height - skip) | 0;
            y = Pix2D.clipMinY;
            maskPos = (maskPos + Math.imul(skip, width)) | 0;
            dstPos = (dstPos + Math.imul(skip, Pix2D.width)) | 0;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (height - (y + height - Pix2D.clipMaxY)) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const skip = (Pix2D.clipMinX - x) | 0;
            width = (width - skip) | 0;
            x = Pix2D.clipMinX;
            maskPos = (maskPos + skip) | 0;
            dstPos = (dstPos + skip) | 0;
            maskStep = (maskStep + skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            const skip = (x + width - Pix2D.clipMaxX) | 0;
            width = (width - skip) | 0;
            maskStep = (maskStep + skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (width > 0 && height > 0) {
            if (Pix2D.maskOffsets !== null) {
                SoftwareFont.plotLetterClipped(Pix2D.pixels, arrayAtObj(this.glyphMasks, c), x, y, width, height, colour, maskPos, dstPos, dstStep, maskStep, Pix2D.maskOffsets, Pix2D.maskLengths);
            } else {
                SoftwareFont.plotLetter(Pix2D.pixels, arrayAtObj(this.glyphMasks, c), colour, maskPos, dstPos, width, height, dstStep, maskStep);
            }
        }
    }

    // fg.a([I[BIIIIIIIII[I[I)V
    private static plotLetterClipped(
        _dst: Int32Array | null,
        mask: Uint8Array | null,
        x: number,
        y: number,
        width: number,
        height: number,
        colour: number,
        maskPos: number,
        dstPos: number,
        dstStep: number,
        maskStep: number,
        maskOffsets: Int32Array | null,
        maskLengths: Int32Array | null
    ): void {
        // dst is unused: Java writes through td.g directly.
        const clipX = (x - Pix2D.clipMinX) | 0;
        const clipY = (y - Pix2D.clipMinY) | 0;

        for (let row = clipY; row < ((clipY + height) | 0); row++) {
            const start = arrayAtI32(maskOffsets, row);
            let length = arrayAtI32(maskLengths, row);
            let remaining = width;
            if (clipX > start) {
                const skip = (clipX - start) | 0;
                if (skip >= length) {
                    maskPos = (maskPos + width + maskStep) | 0;
                    dstPos = (dstPos + width + dstStep) | 0;
                    continue;
                }

                length = (length - skip) | 0;
            } else {
                const skip = (start - clipX) | 0;
                if (skip >= width) {
                    maskPos = (maskPos + width + maskStep) | 0;
                    dstPos = (dstPos + width + dstStep) | 0;
                    continue;
                }

                maskPos = (maskPos + skip) | 0;
                remaining = (remaining - skip) | 0;
                dstPos = (dstPos + skip) | 0;
            }

            let tail = 0;
            if (remaining < length) {
                length = remaining;
            } else {
                tail = (remaining - length) | 0;
            }

            if (Pix2D.spanTarget?.glyph(Pix2D.pixels, mask, colour, maskPos, dstPos, length, 1, 0, 0)) {
                maskPos = (maskPos + length + tail + maskStep) | 0;
                dstPos = (dstPos + length + tail + dstStep) | 0;
                continue;
            }
            for (let i = -length | 0; i < 0; i++) {
                if (byteAt(mask, maskPos++) !== 0) {
                    arrayPutI32(Pix2D.pixels, dstPos++, colour);
                } else {
                    dstPos++;
                }
            }

            maskPos = (maskPos + tail + maskStep) | 0;
            dstPos = (dstPos + tail + dstStep) | 0;
        }
    }

    // SD ik.a(II)Lfg; with guard -1328, HD li.a(II)Ldd; with guard -28922.
    static getFontMetrics(id: number): SoftwareFont {
        try {
            let font = SoftwareFont.cache.Find(BigInt(id));
            if (font !== null) return font;
            const data = requireNonNull(Client.fontMetricsArchive).GetFile(0, id);
            font = new SoftwareFont(data);
            font.setNameIcons(PixfontGeneric.nameIcons, null);
            SoftwareFont.cache.Put(BigInt(id), font);
            return font;
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'li.A(-28922,' + id + ')');
        }
    }
}
