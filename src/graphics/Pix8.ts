import { byteAt, putByte } from '#/io/JavaByteArray';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import AbstractIndexedSprite from './AbstractIndexedSprite';
import Pix2D from './Pix2D';

// The two Java constructors: SD ch.<init>(IIIIII[B[I)V / HD ek.<init>(IIIIII[B[I)V (cropW, cropH, xOffset, yOffset,
// width, height, pixels, palette), and the HD-only ek.<init>(III)V (width, height, palette size).
type Pix8Args = [cropW: number, cropH: number, xOffset: number, yOffset: number, width: number, height: number, pixels: Uint8Array | null, palette: Int32Array | null] | [width: number, height: number, paletteSize: number];

// SD ch / HD ek (classmap-hd.json). HD field identities from the two jars' 8-argument constructors, which store
// their arguments in the same order: ek.l cropW (ch/si.o), ek.i cropH (si.c), ek.m xOffset (si.b), ek.d yOffset
// (si.j), ek.a width (si.l), ek.k height (si.n), ek.o pixels (ch.y), ek.n palette (ch.z).
export default class Pix8 extends AbstractIndexedSprite {
    // SD ch.y:[B / HD ek.o:[B
    pixels: Uint8Array | null = null;
    // SD ch.z:[I / HD ek.n:[I
    private palette: Int32Array | null = null;

    constructor(...args: Pix8Args) {
        super();
        if (args.length === 8) {
            // SD ch.<init>(IIIIII[B[I)V / HD ek.<init>(IIIIII[B[I)V
            const [cropW, cropH, xOffset, yOffset, width, height, pixels, palette] = args;
            this.cropW = cropW;
            this.cropH = cropH;
            this.xOffset = xOffset;
            this.yOffset = yOffset;
            this.width = width;
            this.height = height;
            this.pixels = pixels;
            this.palette = palette;
        } else {
            // HD ek.<init>(III)V. No SD counterpart. A blank image (no crop offsets) with a zeroed palette of
            // paletteSize entries; GroundShadows.init (tj.a(II)V) allocates the scene shadow map with it. Java's
            // chained stores (`l = a = width`) store the right-hand field first: width, cropW, height, cropH, yOffset,
            // xOffset, then the two arrays (byte[width * height], then int[paletteSize]).
            const [width, height, paletteSize] = args;
            this.width = width;
            this.cropW = width;
            this.height = height;
            this.cropH = height;
            this.yOffset = 0;
            this.xOffset = 0;
            this.pixels = new Uint8Array(Math.imul(width, height));
            this.palette = new Int32Array(paletteSize);
        }
    }

    // HD ek.a()V. Clear the shadow sprite before rebuilding the map.
    clear(): void {
        Pix2D.spanTarget?.invalidateBytes(this.pixels);
        let i = 0;
        let end = requireNonNull(this.pixels).length - 7;
        while (i < end) {
            putByte(this.pixels, i++, 0);
            putByte(this.pixels, i++, 0);
            putByte(this.pixels, i++, 0);
            putByte(this.pixels, i++, 0);
            putByte(this.pixels, i++, 0);
            putByte(this.pixels, i++, 0);
            putByte(this.pixels, i++, 0);
            putByte(this.pixels, i++, 0);
        }
        end += 7;
        while (i < end) putByte(this.pixels, i++, 0);
    }

    // ch.a(IIII)V
    drawScaled(x: number, y: number, w: number, h: number): void {
        const width = this.width;
        const height = this.height;
        let srcX = 0;
        let srcY = 0;
        const cropW = this.cropW;
        const cropH = this.cropH;
        const stepX = intDivide(cropW << 16, w);
        const stepY = intDivide(cropH << 16, h);
        if (this.xOffset > 0) {
            const skip = intDivide(((this.xOffset << 16) + stepX - 1) | 0, stepX);
            x = (x + skip) | 0;
            srcX = (srcX + (Math.imul(skip, stepX) - (this.xOffset << 16))) | 0;
        }

        if (this.yOffset > 0) {
            const skip = intDivide(((this.yOffset << 16) + stepY - 1) | 0, stepY);
            y = (y + skip) | 0;
            srcY = (srcY + (Math.imul(skip, stepY) - (this.yOffset << 16))) | 0;
        }

        if (width < cropW) {
            w = intDivide(((width << 16) - srcX + stepX - 1) | 0, stepX);
        }

        if (height < cropH) {
            h = intDivide(((height << 16) - srcY + stepY - 1) | 0, stepY);
        }

        let dstOff = (x + Math.imul(y, Pix2D.width)) | 0;
        let dstStep = (Pix2D.width - w) | 0;
        if (((y + h) | 0) > Pix2D.clipMaxY) {
            h = (h - (((y + h) | 0) - Pix2D.clipMaxY)) | 0;
        }

        if (y < Pix2D.clipMinY) {
            const skip = (Pix2D.clipMinY - y) | 0;
            h = (h - skip) | 0;
            dstOff = (dstOff + Math.imul(skip, Pix2D.width)) | 0;
            srcY = (srcY + Math.imul(stepY, skip)) | 0;
        }

        if (((x + w) | 0) > Pix2D.clipMaxX) {
            const skip = (((x + w) | 0) - Pix2D.clipMaxX) | 0;
            w = (w - skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const skip = (Pix2D.clipMinX - x) | 0;
            w = (w - skip) | 0;
            dstOff = (dstOff + skip) | 0;
            srcX = (srcX + Math.imul(stepX, skip)) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        Pix8.plotScale(Pix2D.pixels, this.pixels, this.palette, srcX, srcY, dstOff, dstStep, w, h, stepX, stepY, width);
    }

    // ch.a(IIIII)V
    drawScaledTinted(x: number, y: number, w: number, h: number, colour: number): void {
        const width = this.width;
        const height = this.height;
        let srcX = 0;
        let srcY = 0;
        const cropW = this.cropW;
        const cropH = this.cropH;
        const stepX = intDivide(cropW << 16, w);
        const stepY = intDivide(cropH << 16, h);
        if (this.xOffset > 0) {
            const skip = intDivide(((this.xOffset << 16) + stepX - 1) | 0, stepX);
            x = (x + skip) | 0;
            srcX = (srcX + (Math.imul(skip, stepX) - (this.xOffset << 16))) | 0;
        }

        if (this.yOffset > 0) {
            const skip = intDivide(((this.yOffset << 16) + stepY - 1) | 0, stepY);
            y = (y + skip) | 0;
            srcY = (srcY + (Math.imul(skip, stepY) - (this.yOffset << 16))) | 0;
        }

        if (width < cropW) {
            w = intDivide(((width << 16) - srcX + stepX - 1) | 0, stepX);
        }

        if (height < cropH) {
            h = intDivide(((height << 16) - srcY + stepY - 1) | 0, stepY);
        }

        let dstOff = (x + Math.imul(y, Pix2D.width)) | 0;
        let dstStep = (Pix2D.width - w) | 0;
        if (((y + h) | 0) > Pix2D.clipMaxY) {
            h = (h - (((y + h) | 0) - Pix2D.clipMaxY)) | 0;
        }

        if (y < Pix2D.clipMinY) {
            const skip = (Pix2D.clipMinY - y) | 0;
            h = (h - skip) | 0;
            dstOff = (dstOff + Math.imul(skip, Pix2D.width)) | 0;
            srcY = (srcY + Math.imul(stepY, skip)) | 0;
        }

        if (((x + w) | 0) > Pix2D.clipMaxX) {
            const skip = (((x + w) | 0) - Pix2D.clipMaxX) | 0;
            w = (w - skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const skip = (Pix2D.clipMinX - x) | 0;
            w = (w - skip) | 0;
            dstOff = (dstOff + skip) | 0;
            srcX = (srcX + Math.imul(stepX, skip)) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        Pix8.plotScaleTinted(Pix2D.pixels, this.pixels, this.palette, srcX, srcY, dstOff, dstStep, w, h, stepX, stepY, width, colour);
    }

    // ch.a([I[B[IIIIIIII)V
    // pixel is Java's own register for the index byte: draw passes 0 and the method overwrites it before any read.
    private static plot(dst: Int32Array | null, src: Uint8Array | null, palette: Int32Array | null, pixel: number, srcOff: number, dstOff: number, w: number, h: number, dstStep: number, srcStep: number): void {
        if (Pix2D.spanTarget?.indexed(dst, src, palette, dstOff, w, h, dstStep, srcOff, w + srcStep, 0, 0, 65536, 65536, 0)) return;
        const quads = -(w >> 2) | 0;
        w = -(w & 3) | 0;

        for (let y = -h | 0; y < 0; y++) {
            for (let x = quads; x < 0; x++) {
                pixel = (byteAt(src, srcOff++) << 24) >> 24;
                if (pixel !== 0) {
                    arrayPutI32(dst, dstOff++, arrayAtI32(palette, pixel & 255));
                } else {
                    dstOff++;
                }

                pixel = (byteAt(src, srcOff++) << 24) >> 24;
                if (pixel !== 0) {
                    arrayPutI32(dst, dstOff++, arrayAtI32(palette, pixel & 255));
                } else {
                    dstOff++;
                }

                pixel = (byteAt(src, srcOff++) << 24) >> 24;
                if (pixel !== 0) {
                    arrayPutI32(dst, dstOff++, arrayAtI32(palette, pixel & 255));
                } else {
                    dstOff++;
                }

                pixel = (byteAt(src, srcOff++) << 24) >> 24;
                if (pixel !== 0) {
                    arrayPutI32(dst, dstOff++, arrayAtI32(palette, pixel & 255));
                } else {
                    dstOff++;
                }
            }

            for (let x = w; x < 0; x++) {
                pixel = (byteAt(src, srcOff++) << 24) >> 24;
                if (pixel !== 0) {
                    arrayPutI32(dst, dstOff++, arrayAtI32(palette, pixel & 255));
                } else {
                    dstOff++;
                }
            }

            dstOff = (dstOff + dstStep) | 0;
            srcOff = (srcOff + srcStep) | 0;
        }
    }

    // ch.a(II)V
    override draw(x: number, y: number): void {
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        let dstOff = (x + Math.imul(y, Pix2D.width)) | 0;
        let srcOff = 0;
        let h = this.height;
        let w = this.width;
        let dstStep = (Pix2D.width - w) | 0;
        let srcStep = 0;
        if (y < Pix2D.clipMinY) {
            const skip = (Pix2D.clipMinY - y) | 0;
            h = (h - skip) | 0;
            y = Pix2D.clipMinY;
            srcOff = (srcOff + Math.imul(skip, w)) | 0;
            dstOff = (dstOff + Math.imul(skip, Pix2D.width)) | 0;
        }

        if (((y + h) | 0) > Pix2D.clipMaxY) {
            h = (h - (((y + h) | 0) - Pix2D.clipMaxY)) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const skip = (Pix2D.clipMinX - x) | 0;
            w = (w - skip) | 0;
            x = Pix2D.clipMinX;
            srcOff = (srcOff + skip) | 0;
            dstOff = (dstOff + skip) | 0;
            srcStep = (srcStep + skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (((x + w) | 0) > Pix2D.clipMaxX) {
            const skip = (((x + w) | 0) - Pix2D.clipMaxX) | 0;
            w = (w - skip) | 0;
            srcStep = (srcStep + skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (w <= 0 || h <= 0) {
            return;
        }

        Pix8.plot(Pix2D.pixels, this.pixels, this.palette, 0, srcOff, dstOff, w, h, dstStep, srcStep);
    }

    // ch.a()V
    trim(): void {
        if (this.width === this.cropW && this.height === this.cropH) {
            return;
        }

        const pixels = new Uint8Array(Math.imul(this.cropW, this.cropH));
        let srcOff = 0;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                putByte(pixels, (x + this.xOffset + Math.imul((y + this.yOffset) | 0, this.cropW)) | 0, byteAt(this.pixels, srcOff++));
            }
        }

        this.pixels = pixels;
        this.width = this.cropW;
        this.height = this.cropH;
        this.xOffset = 0;
        this.yOffset = 0;
    }

    // ch.b([I[B[IIIIIIII)V
    private static plotAlpha(dst: Int32Array | null, src: Uint8Array | null, palette: Int32Array | null, srcOff: number, dstOff: number, w: number, h: number, dstStep: number, srcStep: number, alpha: number): void {
        if (Pix2D.spanTarget?.indexed(dst, src, palette, dstOff, w, h, dstStep, srcOff, w + srcStep, 0, 0, 65536, 65536, 1, alpha)) return;
        const invAlpha = (256 - alpha) | 0;

        for (let y = -h | 0; y < 0; y++) {
            for (let x = -w | 0; x < 0; x++) {
                let rgb = (byteAt(src, srcOff++) << 24) >> 24;
                if (rgb !== 0) {
                    rgb = arrayAtI32(palette, rgb & 255);
                    const dstRgb = arrayAtI32(dst, dstOff);
                    arrayPutI32(dst, dstOff++, (((Math.imul(rgb & 16711935, alpha) + Math.imul(dstRgb & 16711935, invAlpha)) & -16711936) + ((Math.imul(rgb & 65280, alpha) + Math.imul(dstRgb & 65280, invAlpha)) & 16711680)) >> 8);
                } else {
                    dstOff++;
                }
            }

            dstOff = (dstOff + dstStep) | 0;
            srcOff = (srcOff + srcStep) | 0;
        }
    }

    // ch.b()V
    rotateClockwise(): void {
        const pixels = new Uint8Array(Math.imul(this.width, this.height));
        let dstOff = 0;

        for (let x = 0; x < this.width; x++) {
            for (let y = (this.height - 1) | 0; y >= 0; y--) {
                putByte(pixels, dstOff++, byteAt(this.pixels, (x + Math.imul(y, this.width)) | 0));
            }
        }

        this.pixels = pixels;
        let tmp = this.yOffset;
        this.yOffset = this.xOffset;
        this.xOffset = (this.cropH - this.height - tmp) | 0;
        tmp = this.height;
        this.height = this.width;
        this.width = tmp;
        tmp = this.cropH;
        this.cropH = this.cropW;
        this.cropW = tmp;
    }

    // ch.a([I[B[IIIIIIIIII)V
    private static plotScale(dst: Int32Array | null, src: Uint8Array | null, palette: Int32Array | null, srcX: number, srcY: number, dstOff: number, dstStep: number, w: number, h: number, stepX: number, stepY: number, srcWidth: number): void {
        if (Pix2D.spanTarget?.indexed(dst, src, palette, dstOff, w, h, dstStep, 0, srcWidth, srcX, srcY, stepX, stepY, 0)) return;
        const startX = srcX;

        for (let y = -h | 0; y < 0; y++) {
            const rowOff = Math.imul(srcY >> 16, srcWidth);

            for (let x = -w | 0; x < 0; x++) {
                const pixel = (byteAt(src, ((srcX >> 16) + rowOff) | 0) << 24) >> 24;
                if (pixel !== 0) {
                    arrayPutI32(dst, dstOff++, arrayAtI32(palette, pixel & 255));
                } else {
                    dstOff++;
                }

                srcX = (srcX + stepX) | 0;
            }

            srcY = (srcY + stepY) | 0;
            srcX = startX;
            dstOff = (dstOff + dstStep) | 0;
        }
    }

    // ch.a([I[B[IIIIIIIIIII)V
    private static plotScaleTinted(
        dst: Int32Array | null,
        src: Uint8Array | null,
        palette: Int32Array | null,
        srcX: number,
        srcY: number,
        dstOff: number,
        dstStep: number,
        w: number,
        h: number,
        stepX: number,
        stepY: number,
        srcWidth: number,
        colour: number
    ): void {
        if (Pix2D.spanTarget?.indexed(dst, src, palette, dstOff, w, h, dstStep, 0, srcWidth, srcX, srcY, stepX, stepY, 2, colour)) return;
        const startX = srcX;
        const tintRed = (colour >> 16) & 255;
        const tintGreen = (colour >> 8) & 255;
        const tintBlue = colour & 255;

        for (let y = -h | 0; y < 0; y++) {
            const rowOff = Math.imul(srcY >> 16, srcWidth);

            for (let x = -w | 0; x < 0; x++) {
                let rgb = (byteAt(src, ((srcX >> 16) + rowOff) | 0) << 24) >> 24;
                if (rgb !== 0) {
                    rgb = arrayAtI32(palette, rgb & 255);
                    const red = (rgb >> 16) & 255;
                    const green = (rgb >> 8) & 255;
                    const blue = rgb & 255;
                    arrayPutI32(dst, dstOff++, (((Math.imul(red, tintRed) >> 8) << 16) + ((Math.imul(green, tintGreen) >> 8) << 8) + (Math.imul(blue, tintBlue) >> 8)) | 0);
                } else {
                    dstOff++;
                }

                srcX = (srcX + stepX) | 0;
            }

            srcY = (srcY + stepY) | 0;
            srcX = startX;
            dstOff = (dstOff + dstStep) | 0;
        }
    }

    // ch.b(III)V
    rgbAdjust(red: number, green: number, blue: number): void {
        Pix2D.spanTarget?.invalidate(this.palette);
        for (let i = 0; i < requireNonNull(this.palette).length; i++) {
            let r = (arrayAtI32(this.palette, i) >> 16) & 255;
            r = (r + red) | 0;
            if (r < 0) {
                r = 0;
            } else if (r > 255) {
                r = 255;
            }

            let g = (arrayAtI32(this.palette, i) >> 8) & 255;
            g = (g + green) | 0;
            if (g < 0) {
                g = 0;
            } else if (g > 255) {
                g = 255;
            }

            let b = arrayAtI32(this.palette, i) & 255;
            b = (b + blue) | 0;
            if (b < 0) {
                b = 0;
            } else if (b > 255) {
                b = 255;
            }

            arrayPutI32(this.palette, i, ((r << 16) + (g << 8) + b) | 0);
        }
    }

    // ch.a(III)V
    override drawAlpha(x: number, y: number, alpha: number): void {
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        let dstOff = (x + Math.imul(y, Pix2D.width)) | 0;
        let srcOff = 0;
        let h = this.height;
        let w = this.width;
        let dstStep = (Pix2D.width - w) | 0;
        let srcStep = 0;
        if (y < Pix2D.clipMinY) {
            const skip = (Pix2D.clipMinY - y) | 0;
            h = (h - skip) | 0;
            y = Pix2D.clipMinY;
            srcOff = (srcOff + Math.imul(skip, w)) | 0;
            dstOff = (dstOff + Math.imul(skip, Pix2D.width)) | 0;
        }

        if (((y + h) | 0) > Pix2D.clipMaxY) {
            h = (h - (((y + h) | 0) - Pix2D.clipMaxY)) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const skip = (Pix2D.clipMinX - x) | 0;
            w = (w - skip) | 0;
            x = Pix2D.clipMinX;
            srcOff = (srcOff + skip) | 0;
            dstOff = (dstOff + skip) | 0;
            srcStep = (srcStep + skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (((x + w) | 0) > Pix2D.clipMaxX) {
            const skip = (((x + w) | 0) - Pix2D.clipMaxX) | 0;
            w = (w - skip) | 0;
            srcStep = (srcStep + skip) | 0;
            dstStep = (dstStep + skip) | 0;
        }

        if (w <= 0 || h <= 0) {
            return;
        }

        Pix8.plotAlpha(Pix2D.pixels, this.pixels, this.palette, srcOff, dstOff, w, h, dstStep, srcStep, alpha);
    }
}
