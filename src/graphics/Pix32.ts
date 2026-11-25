import { SdSpriteMode } from '#/dash3d/SdRasterSpans';

import { JavaError } from '#/util/ClientError';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import AbstractSprite from './AbstractSprite';
import Pix2D from './Pix2D';

// rh: the software 32-bit sprite. Pixel value 0 is transparent.
//
// The Java blitters are private statics. TypeScript inherits static members, so a private static here would
// clash with SoftwareAlphaSprite's own private statics of the same name (plot, tranSprite, plotScaled; the
// names are fixed by the batch API sheet). Those three are protected, and the subclass statics override them;
// every call names its class explicitly, as Java binds private statics at compile time.
export default class Pix32 extends AbstractSprite {
    // rh.I:[I
    pixels: Int32Array | null = null;

    // fa.a(ILal;II)Lrh; is SpriteLoader.loadSoftwareSprite (moved there so SoftwareSprite has no import of SpriteLoader,
    // which would cycle SoftwareSprite -> SpriteLoader -> SoftwareAlphaSprite extends SoftwareSprite).

    // rh.c(II)V
    override draw(x: number, y: number): void {
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        let dstPos = (x + Math.imul(y, Pix2D.width)) | 0;
        let srcPos = 0;
        let height = this.height;
        let width = this.width;
        let dstStep = (Pix2D.width - width) | 0;
        let srcStep = 0;
        if (y < Pix2D.clipMinY) {
            const cut = (Pix2D.clipMinY - y) | 0;
            height = (height - cut) | 0;
            y = Pix2D.clipMinY;
            srcPos = (srcPos + Math.imul(cut, width)) | 0;
            dstPos = (dstPos + Math.imul(cut, Pix2D.width)) | 0;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (height - (y + height - Pix2D.clipMaxY)) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const cut = (Pix2D.clipMinX - x) | 0;
            width = (width - cut) | 0;
            x = Pix2D.clipMinX;
            srcPos = (srcPos + cut) | 0;
            dstPos = (dstPos + cut) | 0;
            srcStep = (srcStep + cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            const cut = (x + width - Pix2D.clipMaxX) | 0;
            width = (width - cut) | 0;
            srcStep = (srcStep + cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (width <= 0 || height <= 0) {
            return;
        }

        Pix32.plot(Pix2D.pixels, this.pixels, 0, srcPos, dstPos, width, height, dstStep, srcStep);
    }

    // rh.a([I[IIIIIIIIIIII)V
    private static plotScaledAlpha(
        dst: Int32Array | null,
        src: Int32Array | null,
        colour: number,
        srcX: number,
        srcY: number,
        dstPos: number,
        dstStep: number,
        width: number,
        height: number,
        stepX: number,
        stepY: number,
        srcWidth: number,
        alpha: number
    ): void {
        if (Pix2D.spanTarget?.scaled(dst, src, dstPos, width, height, dstStep, srcX, srcY, stepX, stepY, srcWidth, SdSpriteMode.Opacity, alpha)) return;
        const invAlpha = (256 - alpha) | 0;
        const startX = srcX;

        for (let row = -height | 0; row < 0; row++) {
            const rowPos = Math.imul(srcY >> 16, srcWidth);

            for (let col = -width | 0; col < 0; col++) {
                colour = arrayAtI32(src, ((srcX >> 16) + rowPos) | 0);
                if (colour !== 0) {
                    const dstColour = arrayAtI32(dst, dstPos);
                    arrayPutI32(dst, dstPos++, (((Math.imul(colour & 16711935, alpha) + Math.imul(dstColour & 16711935, invAlpha)) & -16711936) + ((Math.imul(colour & 65280, alpha) + Math.imul(dstColour & 65280, invAlpha)) & 16711680)) >> 8);
                } else {
                    dstPos++;
                }

                srcX = (srcX + stepX) | 0;
            }

            srcY = (srcY + stepY) | 0;
            srcX = startX;
            dstPos = (dstPos + dstStep) | 0;
        }
    }

    // rh.a()[I
    toArgb(): Int32Array {
        const argb = new Int32Array(Math.imul(this.cropW, this.cropH));

        for (let row = 0; row < this.height; row++) {
            let srcPos = Math.imul(row, this.width);
            let dstPos = (this.xOffset + Math.imul((row + this.yOffset) | 0, this.cropW)) | 0;

            for (let col = 0; col < this.width; col++) {
                const rgb = arrayAtI32(this.pixels, srcPos++);
                arrayPutI32(argb, dstPos++, rgb !== 0 ? -16777216 | rgb : 0);
            }
        }

        return argb;
    }

    // rh.b(II)V
    override drawHFlip(x: number, y: number): void {
        x = (x + (this.cropW - this.width - this.xOffset)) | 0;
        y = (y + this.yOffset) | 0;
        let dstPos = (x + Math.imul(y, Pix2D.width)) | 0;
        let srcPos = (this.width - 1) | 0;
        let height = this.height;
        let width = this.width;
        let dstStep = (Pix2D.width - width) | 0;
        let srcStep = (width + width) | 0;
        if (y < Pix2D.clipMinY) {
            const cut = (Pix2D.clipMinY - y) | 0;
            height = (height - cut) | 0;
            y = Pix2D.clipMinY;
            srcPos = (srcPos + Math.imul(cut, width)) | 0;
            dstPos = (dstPos + Math.imul(cut, Pix2D.width)) | 0;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (height - (y + height - Pix2D.clipMaxY)) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const cut = (Pix2D.clipMinX - x) | 0;
            width = (width - cut) | 0;
            x = Pix2D.clipMinX;
            srcPos = (srcPos - cut) | 0;
            dstPos = (dstPos + cut) | 0;
            srcStep = (srcStep - cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            const cut = (x + width - Pix2D.clipMaxX) | 0;
            width = (width - cut) | 0;
            srcStep = (srcStep - cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (width <= 0 || height <= 0) {
            return;
        }

        Pix32.plotMirrored(Pix2D.pixels, this.pixels, 0, srcPos, dstPos, width, height, dstStep, srcStep);
    }

    // rh.a([I[IIIIIII)V
    private static plotQuick(dst: Int32Array | null, src: Int32Array | null, srcPos: number, dstPos: number, width: number, height: number, dstStep: number, srcStep: number): void {
        if (Pix2D.spanTarget?.blit(dst, src, dstPos, srcPos, width, height, dstStep, srcStep, 1)) return;

        for (let row = -height | 0; row < 0; row++) {
            let end = (dstPos + width - 3) | 0;

            while (dstPos < end) {
                arrayPutI32(dst, dstPos++, arrayAtI32(src, srcPos++));
                arrayPutI32(dst, dstPos++, arrayAtI32(src, srcPos++));
                arrayPutI32(dst, dstPos++, arrayAtI32(src, srcPos++));
                arrayPutI32(dst, dstPos++, arrayAtI32(src, srcPos++));
            }

            end = (end + 3) | 0;

            while (dstPos < end) {
                arrayPutI32(dst, dstPos++, arrayAtI32(src, srcPos++));
            }

            dstPos = (dstPos + dstStep) | 0;
            srcPos = (srcPos + srcStep) | 0;
        }
    }

    // rh.b()V
    bind(): void {
        Pix2D.setPixels(this.pixels, this.width, this.height);
    }

    // rh.c()V
    trim(): void {
        if (this.width === this.cropW && this.height === this.cropH) {
            return;
        }

        const pixels = new Int32Array(Math.imul(this.cropW, this.cropH));

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                arrayPutI32(pixels, (Math.imul((y + this.yOffset) | 0, this.cropW) + x + this.xOffset) | 0, arrayAtI32(this.pixels, (Math.imul(y, this.width) + x) | 0));
            }
        }

        this.pixels = pixels;
        this.width = this.cropW;
        this.height = this.cropH;
        this.xOffset = 0;
        this.yOffset = 0;
    }

    // rh.c(I)V
    trimPadded(padding: number): void {
        if (this.width === this.cropW && this.height === this.cropH) {
            return;
        }

        let left = padding;
        if (left > this.xOffset) {
            left = this.xOffset;
        }

        let right = padding;
        if (((right + this.xOffset + this.width) | 0) > this.cropW) {
            right = (this.cropW - this.xOffset - this.width) | 0;
        }

        let top = padding;
        if (top > this.yOffset) {
            top = this.yOffset;
        }

        let bottom = padding;
        if (((bottom + this.yOffset + this.height) | 0) > this.cropH) {
            bottom = (this.cropH - this.yOffset - this.height) | 0;
        }

        const width = (this.width + left + right) | 0;
        const height = (this.height + top + bottom) | 0;
        const pixels = new Int32Array(Math.imul(width, height));

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                arrayPutI32(pixels, (Math.imul((y + top) | 0, width) + x + left) | 0, arrayAtI32(this.pixels, (Math.imul(y, this.width) + x) | 0));
            }
        }

        this.pixels = pixels;
        this.width = width;
        this.height = height;
        this.xOffset = (this.xOffset - left) | 0;
        this.yOffset = (this.yOffset - top) | 0;
    }

    // rh.a([I[IIIIIIII)V
    protected static plot(dst: Int32Array | null, src: Int32Array | null, colour: number, srcPos: number, dstPos: number, width: number, height: number, dstStep: number, srcStep: number): void {
        if (Pix2D.spanTarget?.blit(dst, src, dstPos, srcPos, width, height, dstStep, srcStep, 0)) return;

        const quads = -(width >> 2) | 0;
        width = -(width & 3) | 0;

        for (let row = -height | 0; row < 0; row++) {
            for (let col = quads; col < 0; col++) {
                colour = arrayAtI32(src, srcPos++);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                colour = arrayAtI32(src, srcPos++);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                colour = arrayAtI32(src, srcPos++);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                colour = arrayAtI32(src, srcPos++);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }
            }

            for (let col = width; col < 0; col++) {
                colour = arrayAtI32(src, srcPos++);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }
            }

            dstPos = (dstPos + dstStep) | 0;
            srcPos = (srcPos + srcStep) | 0;
        }
    }

    // rh.d(I)V
    outline(colour: number): void {
        const pixels = new Int32Array(Math.imul(this.width, this.height));
        let pos = 0;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let rgb = arrayAtI32(this.pixels, pos);
                if (rgb === 0) {
                    if (x > 0 && arrayAtI32(this.pixels, (pos - 1) | 0) !== 0) {
                        rgb = colour;
                    } else if (y > 0 && arrayAtI32(this.pixels, (pos - this.width) | 0) !== 0) {
                        rgb = colour;
                    } else if (x < ((this.width - 1) | 0) && arrayAtI32(this.pixels, (pos + 1) | 0) !== 0) {
                        rgb = colour;
                    } else if (y < ((this.height - 1) | 0) && arrayAtI32(this.pixels, (pos + this.width) | 0) !== 0) {
                        rgb = colour;
                    }
                }

                arrayPutI32(pixels, pos++, rgb);
            }
        }

        this.pixels = pixels;
    }

    // rh.e(I)V
    shadow(colour: number): void {
        Pix2D.spanTarget?.invalidate(this.pixels);
        for (let y = (this.height - 1) | 0; y > 0; y--) {
            const rowPos = Math.imul(y, this.width);

            for (let x = (this.width - 1) | 0; x > 0; x--) {
                if (arrayAtI32(this.pixels, (x + rowPos) | 0) === 0 && arrayAtI32(this.pixels, (x + rowPos - 1 - this.width) | 0) !== 0) {
                    arrayPutI32(this.pixels, (x + rowPos) | 0, colour);
                }
            }
        }
    }

    // rh.a([I[IIIIIIIII)V
    protected static tranSprite(dst: Int32Array | null, src: Int32Array | null, colour: number, srcPos: number, dstPos: number, width: number, height: number, dstStep: number, srcStep: number, alpha: number): void {
        if (Pix2D.spanTarget?.blit(dst, src, dstPos, srcPos, width, height, dstStep, srcStep, SdSpriteMode.Opacity, alpha)) return;
        const invAlpha = (256 - alpha) | 0;

        for (let row = -height | 0; row < 0; row++) {
            for (let col = -width | 0; col < 0; col++) {
                colour = arrayAtI32(src, srcPos++);
                if (colour !== 0) {
                    const dstColour = arrayAtI32(dst, dstPos);
                    arrayPutI32(dst, dstPos++, (((Math.imul(colour & 16711935, alpha) + Math.imul(dstColour & 16711935, invAlpha)) & -16711936) + ((Math.imul(colour & 65280, alpha) + Math.imul(dstColour & 65280, invAlpha)) & 16711680)) >> 8);
                } else {
                    dstPos++;
                }
            }

            dstPos = (dstPos + dstStep) | 0;
            srcPos = (srcPos + srcStep) | 0;
        }
    }

    // rh.d()V
    vflip(): void {
        const pixels = new Int32Array(Math.imul(this.width, this.height));
        let pos = 0;

        for (let y = (this.height - 1) | 0; y >= 0; y--) {
            for (let x = 0; x < this.width; x++) {
                arrayPutI32(pixels, pos++, arrayAtI32(this.pixels, (x + Math.imul(y, this.width)) | 0));
            }
        }

        this.pixels = pixels;
        this.yOffset = (this.cropH - this.height - this.yOffset) | 0;
    }

    // rh.a(II)V
    override drawOpaque(x: number, y: number): void {
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        let dstPos = (x + Math.imul(y, Pix2D.width)) | 0;
        let srcPos = 0;
        let height = this.height;
        let width = this.width;
        let dstStep = (Pix2D.width - width) | 0;
        let srcStep = 0;
        if (y < Pix2D.clipMinY) {
            const cut = (Pix2D.clipMinY - y) | 0;
            height = (height - cut) | 0;
            y = Pix2D.clipMinY;
            srcPos = (srcPos + Math.imul(cut, width)) | 0;
            dstPos = (dstPos + Math.imul(cut, Pix2D.width)) | 0;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (height - (y + height - Pix2D.clipMaxY)) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const cut = (Pix2D.clipMinX - x) | 0;
            width = (width - cut) | 0;
            x = Pix2D.clipMinX;
            srcPos = (srcPos + cut) | 0;
            dstPos = (dstPos + cut) | 0;
            srcStep = (srcStep + cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            const cut = (x + width - Pix2D.clipMaxX) | 0;
            width = (width - cut) | 0;
            srcStep = (srcStep + cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (width <= 0 || height <= 0) {
            return;
        }

        Pix32.plotQuick(Pix2D.pixels, this.pixels, srcPos, dstPos, width, height, dstStep, srcStep);
    }

    // rh.a(IIIIIIDI)V
    drawRotatedRadians(x: number, y: number, width: number, height: number, anchorX: number, anchorY: number, angle: number, zoom: number): void {
        try {
            const centreX = ((-width | 0) / 2) | 0;
            const centreY = ((-height | 0) / 2) | 0;
            let sin = doubleToInt(Math.sin(angle) * 65536.0);
            let cos = doubleToInt(Math.cos(angle) * 65536.0);
            sin = Math.imul(sin, zoom) >> 8;
            cos = Math.imul(cos, zoom) >> 8;
            let leftX = ((anchorX << 16) + Math.imul(centreY, sin) + Math.imul(centreX, cos)) | 0;
            let leftY = ((anchorY << 16) + (Math.imul(centreY, cos) - Math.imul(centreX, sin))) | 0;
            let leftOff = (x + Math.imul(y, Pix2D.width)) | 0;

            for (let row = 0; row < height; row++) {
                let dstPos = leftOff;
                let srcX = leftX;
                let srcY = leftY;

                if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, width, 0, srcX, srcY, cos, -sin | 0, this.width, 0)) {
                    leftX = (leftX + sin) | 0;
                    leftY = (leftY + cos) | 0;
                    leftOff = (leftOff + Pix2D.width) | 0;
                    continue;
                }
                for (let col = -width | 0; col < 0; col++) {
                    const rgb = arrayAtI32(this.pixels, ((srcX >> 16) + Math.imul(srcY >> 16, this.width)) | 0);
                    if (rgb !== 0) {
                        arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                    } else {
                        dstPos++;
                    }

                    srcX = (srcX + cos) | 0;
                    srcY = (srcY - sin) | 0;
                }

                leftX = (leftX + sin) | 0;
                leftY = (leftY + cos) | 0;
                leftOff = (leftOff + Pix2D.width) | 0;
            }
        } catch (error) {
            // catch (Exception)
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
        }
    }

    // rh.a([I[IIIIIIIIIII)V
    protected static plotScaled(dst: Int32Array | null, src: Int32Array | null, colour: number, srcX: number, srcY: number, dstPos: number, dstStep: number, width: number, height: number, stepX: number, stepY: number, srcWidth: number): void {
        if (Pix2D.spanTarget?.scaled(dst, src, dstPos, width, height, dstStep, srcX, srcY, stepX, stepY, srcWidth, SdSpriteMode.ColourKey)) return;
        const startX = srcX;

        for (let row = -height | 0; row < 0; row++) {
            const rowPos = Math.imul(srcY >> 16, srcWidth);

            for (let col = -width | 0; col < 0; col++) {
                colour = arrayAtI32(src, ((srcX >> 16) + rowPos) | 0);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                srcX = (srcX + stepX) | 0;
            }

            srcY = (srcY + stepY) | 0;
            srcX = startX;
            dstPos = (dstPos + dstStep) | 0;
        }
    }

    // rh.a(IIIIIIII[I[I)V
    drawRotatedMasked(x: number, y: number, width: number, height: number, anchorX: number, anchorY: number, angle: number, zoom: number, lineStarts: Int32Array | null, lineWidths: Int32Array | null): void {
        try {
            const centreX = ((-width | 0) / 2) | 0;
            const centreY = ((-height | 0) / 2) | 0;
            let sin = doubleToInt(Math.sin(angle / 326.11) * 65536.0);
            let cos = doubleToInt(Math.cos(angle / 326.11) * 65536.0);
            sin = Math.imul(sin, zoom) >> 8;
            cos = Math.imul(cos, zoom) >> 8;
            let leftX = ((anchorX << 16) + Math.imul(centreY, sin) + Math.imul(centreX, cos)) | 0;
            let leftY = ((anchorY << 16) + (Math.imul(centreY, cos) - Math.imul(centreX, sin))) | 0;
            let leftOff = (x + Math.imul(y, Pix2D.width)) | 0;

            for (let row = 0; row < height; row++) {
                const start = arrayAtI32(lineStarts, row);
                let dstPos = (leftOff + start) | 0;
                let srcX = (leftX + Math.imul(cos, start)) | 0;
                let srcY = (leftY - Math.imul(sin, start)) | 0;

                const count = arrayAtI32(lineWidths, row);
                if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, count, 0, srcX, srcY, cos, -sin | 0, this.width, 0)) {
                    leftX = (leftX + sin) | 0;
                    leftY = (leftY + cos) | 0;
                    leftOff = (leftOff + Pix2D.width) | 0;
                    continue;
                }
                for (let col = -count | 0; col < 0; col++) {
                    const rgb = arrayAtI32(this.pixels, ((srcX >> 16) + Math.imul(srcY >> 16, this.width)) | 0);
                    if (rgb !== 0) {
                        arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                    } else {
                        dstPos++;
                    }

                    srcX = (srcX + cos) | 0;
                    srcY = (srcY - sin) | 0;
                }

                leftX = (leftX + sin) | 0;
                leftY = (leftY + cos) | 0;
                leftOff = (leftOff + Pix2D.width) | 0;
            }
        } catch (error) {
            // catch (Exception)
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
        }
    }

    // rh.a(IIII)V
    override drawScaled(x: number, y: number, width: number, height: number): void {
        if (width <= 0 || height <= 0) {
            return;
        }

        const srcWidth = this.width;
        const srcHeight = this.height;
        let srcX = 0;
        let srcY = 0;
        const cropW = this.cropW;
        const cropH = this.cropH;
        const stepX = intDivide(cropW << 16, width);
        const stepY = intDivide(cropH << 16, height);
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

        if (srcWidth < cropW) {
            width = intDivide(((srcWidth << 16) - srcX + stepX - 1) | 0, stepX);
        }

        if (srcHeight < cropH) {
            height = intDivide(((srcHeight << 16) - srcY + stepY - 1) | 0, stepY);
        }

        let dstPos = (x + Math.imul(y, Pix2D.width)) | 0;
        let dstStep = (Pix2D.width - width) | 0;
        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (height - (y + height - Pix2D.clipMaxY)) | 0;
        }

        if (y < Pix2D.clipMinY) {
            const cut = (Pix2D.clipMinY - y) | 0;
            height = (height - cut) | 0;
            dstPos = (dstPos + Math.imul(cut, Pix2D.width)) | 0;
            srcY = (srcY + Math.imul(stepY, cut)) | 0;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            const cut = (x + width - Pix2D.clipMaxX) | 0;
            width = (width - cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const cut = (Pix2D.clipMinX - x) | 0;
            width = (width - cut) | 0;
            dstPos = (dstPos + cut) | 0;
            srcX = (srcX + Math.imul(stepX, cut)) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        Pix32.plotScaled(Pix2D.pixels, this.pixels, 0, srcX, srcY, dstPos, dstStep, width, height, stepX, stepY, srcWidth);
    }

    // rh.b(III)V
    rgbAdjust(red: number, green: number, blue: number): void {
        Pix2D.spanTarget?.invalidate(this.pixels);
        for (let i = 0; i < requireNonNull(this.pixels).length; i++) {
            const rgb = arrayAtI32(this.pixels, i);
            if (rgb !== 0) {
                let r = (rgb >> 16) & 0xff;
                r = (r + red) | 0;
                if (r < 1) {
                    r = 1;
                } else if (r > 255) {
                    r = 255;
                }

                let g = (rgb >> 8) & 0xff;
                g = (g + green) | 0;
                if (g < 1) {
                    g = 1;
                } else if (g > 255) {
                    g = 255;
                }

                let b = rgb & 0xff;
                b = (b + blue) | 0;
                if (b < 1) {
                    b = 1;
                } else if (b > 255) {
                    b = 255;
                }

                arrayPutI32(this.pixels, i, (r << 16) + (g << 8) + b);
            }
        }
    }

    // rh.e()V
    hflip(): void {
        const pixels = new Int32Array(Math.imul(this.width, this.height));
        let pos = 0;

        for (let y = 0; y < this.height; y++) {
            for (let x = (this.width - 1) | 0; x >= 0; x--) {
                arrayPutI32(pixels, pos++, arrayAtI32(this.pixels, (x + Math.imul(y, this.width)) | 0));
            }
        }

        this.pixels = pixels;
        this.xOffset = (this.cropW - this.width - this.xOffset) | 0;
    }

    // rh.a(IIIII)V
    override drawScaledAlpha(x: number, y: number, width: number, height: number, alpha: number): void {
        if (width <= 0 || height <= 0) {
            return;
        }

        const srcWidth = this.width;
        const srcHeight = this.height;
        let srcX = 0;
        let srcY = 0;
        const cropW = this.cropW;
        const cropH = this.cropH;
        const stepX = intDivide(cropW << 16, width);
        const stepY = intDivide(cropH << 16, height);
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

        if (srcWidth < cropW) {
            width = intDivide(((srcWidth << 16) - srcX + stepX - 1) | 0, stepX);
        }

        if (srcHeight < cropH) {
            height = intDivide(((srcHeight << 16) - srcY + stepY - 1) | 0, stepY);
        }

        let dstPos = (x + Math.imul(y, Pix2D.width)) | 0;
        let dstStep = (Pix2D.width - width) | 0;
        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (height - (y + height - Pix2D.clipMaxY)) | 0;
        }

        if (y < Pix2D.clipMinY) {
            const cut = (Pix2D.clipMinY - y) | 0;
            height = (height - cut) | 0;
            dstPos = (dstPos + Math.imul(cut, Pix2D.width)) | 0;
            srcY = (srcY + Math.imul(stepY, cut)) | 0;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            const cut = (x + width - Pix2D.clipMaxX) | 0;
            width = (width - cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const cut = (Pix2D.clipMinX - x) | 0;
            width = (width - cut) | 0;
            dstPos = (dstPos + cut) | 0;
            srcX = (srcX + Math.imul(stepX, cut)) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        Pix32.plotScaledAlpha(Pix2D.pixels, this.pixels, 0, srcX, srcY, dstPos, dstStep, width, height, stepX, stepY, srcWidth, alpha);
    }

    // rh.b(IIIIIIII[I[I)V
    drawRotatedMaskedOpaque(x: number, y: number, width: number, height: number, anchorX: number, anchorY: number, angle: number, zoom: number, lineStarts: Int32Array | null, lineWidths: Int32Array | null): void {
        try {
            const centreX = ((-width | 0) / 2) | 0;
            const centreY = ((-height | 0) / 2) | 0;
            let sin = doubleToInt(Math.sin(angle / 326.11) * 65536.0);
            let cos = doubleToInt(Math.cos(angle / 326.11) * 65536.0);
            sin = Math.imul(sin, zoom) >> 8;
            cos = Math.imul(cos, zoom) >> 8;
            let leftX = ((anchorX << 16) + Math.imul(centreY, sin) + Math.imul(centreX, cos)) | 0;
            let leftY = ((anchorY << 16) + (Math.imul(centreY, cos) - Math.imul(centreX, sin))) | 0;
            let leftOff = (x + Math.imul(y, Pix2D.width)) | 0;

            for (let row = 0; row < height; row++) {
                const start = arrayAtI32(lineStarts, row);
                let dstPos = (leftOff + start) | 0;
                let srcX = (leftX + Math.imul(cos, start)) | 0;
                let srcY = (leftY - Math.imul(sin, start)) | 0;

                const count = arrayAtI32(lineWidths, row);
                if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, count, 0, srcX, srcY, cos, -sin | 0, this.width, 1)) {
                    leftX = (leftX + sin) | 0;
                    leftY = (leftY + cos) | 0;
                    leftOff = (leftOff + Pix2D.width) | 0;
                    continue;
                }
                for (let col = -count | 0; col < 0; col++) {
                    arrayPutI32(Pix2D.pixels, dstPos++, arrayAtI32(this.pixels, ((srcX >> 16) + Math.imul(srcY >> 16, this.width)) | 0));
                    srcX = (srcX + cos) | 0;
                    srcY = (srcY - sin) | 0;
                }

                leftX = (leftX + sin) | 0;
                leftY = (leftY + cos) | 0;
                leftOff = (leftOff + Pix2D.width) | 0;
            }
        } catch (error) {
            // catch (Exception)
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
        }
    }

    // rh.a(III)V
    override drawAlpha(x: number, y: number, alpha: number): void {
        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        let dstPos = (x + Math.imul(y, Pix2D.width)) | 0;
        let srcPos = 0;
        let height = this.height;
        let width = this.width;
        let dstStep = (Pix2D.width - width) | 0;
        let srcStep = 0;
        if (y < Pix2D.clipMinY) {
            const cut = (Pix2D.clipMinY - y) | 0;
            height = (height - cut) | 0;
            y = Pix2D.clipMinY;
            srcPos = (srcPos + Math.imul(cut, width)) | 0;
            dstPos = (dstPos + Math.imul(cut, Pix2D.width)) | 0;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (height - (y + height - Pix2D.clipMaxY)) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const cut = (Pix2D.clipMinX - x) | 0;
            width = (width - cut) | 0;
            x = Pix2D.clipMinX;
            srcPos = (srcPos + cut) | 0;
            dstPos = (dstPos + cut) | 0;
            srcStep = (srcStep + cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            const cut = (x + width - Pix2D.clipMaxX) | 0;
            width = (width - cut) | 0;
            srcStep = (srcStep + cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (width <= 0 || height <= 0) {
            return;
        }

        Pix32.tranSprite(Pix2D.pixels, this.pixels, 0, srcPos, dstPos, width, height, dstStep, srcStep, alpha);
    }

    // rh.<init>(IIIIII[I)V
    constructor(cropW: number, cropH: number, xOffset: number, yOffset: number, width: number, height: number, pixels: Int32Array | null);
    // rh.<init>(II)V
    constructor(width: number, height: number);
    constructor(arg0: number, arg1: number, xOffset?: number, yOffset?: number, width?: number, height?: number, pixels?: Int32Array | null) {
        super();
        if (xOffset === undefined || yOffset === undefined || width === undefined || height === undefined || pixels === undefined) {
            // rh.<init>(II)V
            this.pixels = new Int32Array(Math.imul(arg0, arg1));
            this.cropW = arg0;
            this.width = arg0;
            this.cropH = arg1;
            this.height = arg1;
            this.yOffset = 0;
            this.xOffset = 0;
        } else {
            // rh.<init>(IIIIII[I)V
            this.cropW = arg0;
            this.cropH = arg1;
            this.xOffset = xOffset;
            this.yOffset = yOffset;
            this.width = width;
            this.height = height;
            this.pixels = pixels;
        }
    }

    // rh.a(II[I[I)V
    drawMasked(x: number, y: number, lineStarts: Int32Array | null, lineWidths: Int32Array | null): void {
        if (((Pix2D.clipMaxY - Pix2D.clipMinY) | 0) !== requireNonNull(lineStarts).length) {
            throw new Error('IllegalStateException');
        }

        x = (x + this.xOffset) | 0;
        y = (y + this.yOffset) | 0;
        let srcPos = 0;
        let height = this.height;
        let width = this.width;
        let dstStep = (Pix2D.width - width) | 0;
        let srcStep = 0;
        let dstPos = (x + Math.imul(y, Pix2D.width)) | 0;
        if (y < Pix2D.clipMinY) {
            const cut = (Pix2D.clipMinY - y) | 0;
            height = (height - cut) | 0;
            y = Pix2D.clipMinY;
            srcPos = (srcPos + Math.imul(cut, width)) | 0;
            dstPos = (dstPos + Math.imul(cut, Pix2D.width)) | 0;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (height - (y + height - Pix2D.clipMaxY)) | 0;
        }

        if (x < Pix2D.clipMinX) {
            const cut = (Pix2D.clipMinX - x) | 0;
            width = (width - cut) | 0;
            x = Pix2D.clipMinX;
            srcPos = (srcPos + cut) | 0;
            dstPos = (dstPos + cut) | 0;
            srcStep = (srcStep + cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            const cut = (x + width - Pix2D.clipMaxX) | 0;
            width = (width - cut) | 0;
            srcStep = (srcStep + cut) | 0;
            dstStep = (dstStep + cut) | 0;
        }

        if (width <= 0 || height <= 0) {
            return;
        }

        const left = (x - Pix2D.clipMinX) | 0;
        const top = (y - Pix2D.clipMinY) | 0;

        for (let row = top; row < ((top + height) | 0); row++) {
            const start = arrayAtI32(lineStarts, row);
            let length = arrayAtI32(lineWidths, row);
            let visible = width;
            if (left > start) {
                const cut = (left - start) | 0;
                if (cut >= length) {
                    srcPos = (srcPos + (width + srcStep)) | 0;
                    dstPos = (dstPos + (width + dstStep)) | 0;
                    continue;
                }

                length = (length - cut) | 0;
            } else {
                const cut = (start - left) | 0;
                if (cut >= width) {
                    srcPos = (srcPos + (width + srcStep)) | 0;
                    dstPos = (dstPos + (width + dstStep)) | 0;
                    continue;
                }

                srcPos = (srcPos + cut) | 0;
                visible = (visible - cut) | 0;
                dstPos = (dstPos + cut) | 0;
            }

            let skip = 0;
            if (visible < length) {
                length = visible;
            } else {
                skip = (visible - length) | 0;
            }

            if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, length, srcPos, 0, 0, 65536, 0, 0, 0)) {
                srcPos = (srcPos + length + skip + srcStep) | 0;
                dstPos = (dstPos + length + skip + dstStep) | 0;
                continue;
            }

            for (let col = -length | 0; col < 0; col++) {
                const rgb = arrayAtI32(this.pixels, srcPos++);
                if (rgb !== 0) {
                    arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                } else {
                    dstPos++;
                }
            }

            srcPos = (srcPos + (skip + srcStep)) | 0;
            dstPos = (dstPos + (skip + dstStep)) | 0;
        }
    }

    // rh.b([I[IIIIIIII)V
    private static plotMirrored(dst: Int32Array | null, src: Int32Array | null, colour: number, srcPos: number, dstPos: number, width: number, height: number, dstStep: number, srcStep: number): void {
        if (Pix2D.spanTarget?.blit(dst, src, dstPos, srcPos, width, height, dstStep, srcStep, SdSpriteMode.ColourKey, 256, true)) return;
        const quads = -(width >> 2) | 0;
        width = -(width & 3) | 0;

        for (let row = -height | 0; row < 0; row++) {
            for (let col = quads; col < 0; col++) {
                colour = arrayAtI32(src, srcPos--);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                colour = arrayAtI32(src, srcPos--);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                colour = arrayAtI32(src, srcPos--);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }

                colour = arrayAtI32(src, srcPos--);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }
            }

            for (let col = width; col < 0; col++) {
                colour = arrayAtI32(src, srcPos--);
                if (colour !== 0) {
                    arrayPutI32(dst, dstPos++, colour);
                } else {
                    dstPos++;
                }
            }

            dstPos = (dstPos + dstStep) | 0;
            srcPos = (srcPos + srcStep) | 0;
        }
    }

    // rh.a(IIIIII)V
    override drawRotated(anchorX: number, anchorY: number, x: number, y: number, angle: number, scale: number): void {
        if (scale === 0) {
            return;
        }

        anchorX = (anchorX - (this.xOffset << 4)) | 0;
        anchorY = (anchorY - (this.yOffset << 4)) | 0;
        const radians = (angle & 65535) * 9.587379924285257e-5;
        const sin = doubleToInt(Math.floor(Math.sin(radians) * scale + 0.5));
        const cos = doubleToInt(Math.floor(Math.cos(radians) * scale + 0.5));
        const x0 = (Math.imul(-anchorX, cos) + Math.imul(-anchorY, sin)) | 0;
        const y0 = (Math.imul(anchorX, sin) + Math.imul(-anchorY, cos)) | 0;
        const x1 = (Math.imul((this.width << 4) - anchorX, cos) + Math.imul(-anchorY, sin)) | 0;
        const y1 = (Math.imul(-((this.width << 4) - anchorX), sin) + Math.imul(-anchorY, cos)) | 0;
        const x2 = (Math.imul(-anchorX, cos) + Math.imul((this.height << 4) - anchorY, sin)) | 0;
        const y2 = (Math.imul(anchorX, sin) + Math.imul((this.height << 4) - anchorY, cos)) | 0;
        const x3 = (Math.imul((this.width << 4) - anchorX, cos) + Math.imul((this.height << 4) - anchorY, sin)) | 0;
        const y3 = (Math.imul(-((this.width << 4) - anchorX), sin) + Math.imul((this.height << 4) - anchorY, cos)) | 0;
        let minX: number;
        let maxX: number;
        if (x0 < x1) {
            minX = x0;
            maxX = x1;
        } else {
            minX = x1;
            maxX = x0;
        }

        if (x2 < minX) {
            minX = x2;
        }

        if (x3 < minX) {
            minX = x3;
        }

        if (x2 > maxX) {
            maxX = x2;
        }

        if (x3 > maxX) {
            maxX = x3;
        }

        let minY: number;
        let maxY: number;
        if (y0 < y1) {
            minY = y0;
            maxY = y1;
        } else {
            minY = y1;
            maxY = y0;
        }

        if (y2 < minY) {
            minY = y2;
        }

        if (y3 < minY) {
            minY = y3;
        }

        if (y2 > maxY) {
            maxY = y2;
        }

        if (y3 > maxY) {
            maxY = y3;
        }

        minX >>= 12;
        maxX = (maxX + 4095) >> 12;
        minY >>= 12;
        maxY = (maxY + 4095) >> 12;
        minX = (minX + x) | 0;
        maxX = (maxX + x) | 0;
        minY = (minY + y) | 0;
        maxY = (maxY + y) | 0;
        minX >>= 4;
        maxX = (maxX + 15) >> 4;
        minY >>= 4;
        maxY = (maxY + 15) >> 4;
        if (minX < Pix2D.clipMinX) {
            minX = Pix2D.clipMinX;
        }

        if (maxX > Pix2D.clipMaxX) {
            maxX = Pix2D.clipMaxX;
        }

        if (minY < Pix2D.clipMinY) {
            minY = Pix2D.clipMinY;
        }

        if (maxY > Pix2D.clipMaxY) {
            maxY = Pix2D.clipMaxY;
        }

        const columns = (minX - maxX) | 0;
        if (columns >= 0) {
            return;
        }

        const rows = (minY - maxY) | 0;
        if (rows >= 0) {
            return;
        }

        let dstOff = (Math.imul(minY, Pix2D.width) + minX) | 0;
        const inverse = 1.6777216e7 / scale;
        const sinStep = doubleToInt(Math.floor(Math.sin(radians) * inverse + 0.5));
        const cosStep = doubleToInt(Math.floor(Math.cos(radians) * inverse + 0.5));
        const startX = ((minX << 4) + 8 - x) | 0;
        const startY = ((minY << 4) + 8 - y) | 0;
        let rowX = ((anchorX << 8) - (Math.imul(startY, sinStep) >> 4)) | 0;
        let rowY = ((anchorY << 8) + (Math.imul(startY, cosStep) >> 4)) | 0;
        if (cosStep === 0) {
            if (sinStep === 0) {
                for (let row = rows; row < 0; dstOff = (dstOff + Pix2D.width) | 0) {
                    let dstPos = dstOff;
                    const srcX = rowX;
                    const srcY = rowY;
                    let count = columns;
                    if (srcX >= 0 && srcY >= 0 && ((srcX - (this.width << 12)) | 0) < 0 && ((srcY - (this.height << 12)) | 0) < 0) {
                        if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, -count, 0, srcX, srcY, cosStep, sinStep, this.width, SdSpriteMode.ColourKey, 256, 12)) count = 0;
                        for (; count < 0; count++) {
                            const rgb = arrayAtI32(this.pixels, (Math.imul(srcY >> 12, this.width) + (srcX >> 12)) | 0);
                            if (rgb !== 0) {
                                arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                            } else {
                                dstPos++;
                            }
                        }
                    }

                    row++;
                }
            } else if (sinStep < 0) {
                for (let row = rows; row < 0; dstOff = (dstOff + Pix2D.width) | 0) {
                    let dstPos = dstOff;
                    const srcX = rowX;
                    let srcY = (rowY + (Math.imul(startX, sinStep) >> 4)) | 0;
                    let count = columns;
                    if (srcX >= 0 && ((srcX - (this.width << 12)) | 0) < 0) {
                        let skip: number;
                        if ((skip = (srcY - (this.height << 12)) | 0) >= 0) {
                            skip = intDivide((sinStep - skip) | 0, sinStep);
                            count = (count + skip) | 0;
                            srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                            dstPos = (dstPos + skip) | 0;
                        }

                        if ((skip = intDivide((srcY - sinStep) | 0, sinStep)) > count) {
                            count = skip;
                        }

                        if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, -count, 0, srcX, srcY, cosStep, sinStep, this.width, SdSpriteMode.ColourKey, 256, 12)) count = 0;
                        while (count < 0) {
                            const rgb = arrayAtI32(this.pixels, (Math.imul(srcY >> 12, this.width) + (srcX >> 12)) | 0);
                            if (rgb !== 0) {
                                arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                            } else {
                                dstPos++;
                            }

                            srcY = (srcY + sinStep) | 0;
                            count++;
                        }
                    }

                    row++;
                    rowX = (rowX - sinStep) | 0;
                }
            } else {
                for (let row = rows; row < 0; dstOff = (dstOff + Pix2D.width) | 0) {
                    let dstPos = dstOff;
                    const srcX = rowX;
                    let srcY = (rowY + (Math.imul(startX, sinStep) >> 4)) | 0;
                    let count = columns;
                    if (srcX >= 0 && ((srcX - (this.width << 12)) | 0) < 0) {
                        if (srcY < 0) {
                            const skip = intDivide((sinStep - 1 - srcY) | 0, sinStep);
                            count = (count + skip) | 0;
                            srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                            dstPos = (dstPos + skip) | 0;
                        }

                        let end: number;
                        if ((end = intDivide((1 + srcY - (this.height << 12) - sinStep) | 0, sinStep)) > count) {
                            count = end;
                        }

                        if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, -count, 0, srcX, srcY, cosStep, sinStep, this.width, SdSpriteMode.ColourKey, 256, 12)) count = 0;
                        while (count < 0) {
                            const rgb = arrayAtI32(this.pixels, (Math.imul(srcY >> 12, this.width) + (srcX >> 12)) | 0);
                            if (rgb !== 0) {
                                arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                            } else {
                                dstPos++;
                            }

                            srcY = (srcY + sinStep) | 0;
                            count++;
                        }
                    }

                    row++;
                    rowX = (rowX - sinStep) | 0;
                }
            }
        } else if (cosStep < 0) {
            if (sinStep === 0) {
                for (let row = rows; row < 0; dstOff = (dstOff + Pix2D.width) | 0) {
                    let dstPos = dstOff;
                    let srcX = (rowX + (Math.imul(startX, cosStep) >> 4)) | 0;
                    const srcY = rowY;
                    let count = columns;
                    if (srcY >= 0 && ((srcY - (this.height << 12)) | 0) < 0) {
                        let skip: number;
                        if ((skip = (srcX - (this.width << 12)) | 0) >= 0) {
                            skip = intDivide((cosStep - skip) | 0, cosStep);
                            count = (count + skip) | 0;
                            srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                            dstPos = (dstPos + skip) | 0;
                        }

                        if ((skip = intDivide((srcX - cosStep) | 0, cosStep)) > count) {
                            count = skip;
                        }

                        if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, -count, 0, srcX, srcY, cosStep, sinStep, this.width, SdSpriteMode.ColourKey, 256, 12)) count = 0;
                        while (count < 0) {
                            const rgb = arrayAtI32(this.pixels, (Math.imul(srcY >> 12, this.width) + (srcX >> 12)) | 0);
                            if (rgb !== 0) {
                                arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                            } else {
                                dstPos++;
                            }

                            srcX = (srcX + cosStep) | 0;
                            count++;
                        }
                    }

                    row++;
                    rowY = (rowY + cosStep) | 0;
                }
            } else if (sinStep < 0) {
                for (let row = rows; row < 0; dstOff = (dstOff + Pix2D.width) | 0) {
                    let dstPos = dstOff;
                    let srcX = (rowX + (Math.imul(startX, cosStep) >> 4)) | 0;
                    let srcY = (rowY + (Math.imul(startX, sinStep) >> 4)) | 0;
                    let count = columns;
                    let skip: number;
                    if ((skip = (srcX - (this.width << 12)) | 0) >= 0) {
                        skip = intDivide((cosStep - skip) | 0, cosStep);
                        count = (count + skip) | 0;
                        srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                        srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                        dstPos = (dstPos + skip) | 0;
                    }

                    if ((skip = intDivide((srcX - cosStep) | 0, cosStep)) > count) {
                        count = skip;
                    }

                    if ((skip = (srcY - (this.height << 12)) | 0) >= 0) {
                        skip = intDivide((sinStep - skip) | 0, sinStep);
                        count = (count + skip) | 0;
                        srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                        srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                        dstPos = (dstPos + skip) | 0;
                    }

                    if ((skip = intDivide((srcY - sinStep) | 0, sinStep)) > count) {
                        count = skip;
                    }

                    if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, -count, 0, srcX, srcY, cosStep, sinStep, this.width, SdSpriteMode.ColourKey, 256, 12)) count = 0;
                    while (count < 0) {
                        const rgb = arrayAtI32(this.pixels, (Math.imul(srcY >> 12, this.width) + (srcX >> 12)) | 0);
                        if (rgb !== 0) {
                            arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                        } else {
                            dstPos++;
                        }

                        srcX = (srcX + cosStep) | 0;
                        srcY = (srcY + sinStep) | 0;
                        count++;
                    }

                    row++;
                    rowX = (rowX - sinStep) | 0;
                    rowY = (rowY + cosStep) | 0;
                }
            } else {
                for (let row = rows; row < 0; dstOff = (dstOff + Pix2D.width) | 0) {
                    let dstPos = dstOff;
                    let srcX = (rowX + (Math.imul(startX, cosStep) >> 4)) | 0;
                    let srcY = (rowY + (Math.imul(startX, sinStep) >> 4)) | 0;
                    let count = columns;
                    let skip: number;
                    if ((skip = (srcX - (this.width << 12)) | 0) >= 0) {
                        skip = intDivide((cosStep - skip) | 0, cosStep);
                        count = (count + skip) | 0;
                        srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                        srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                        dstPos = (dstPos + skip) | 0;
                    }

                    if ((skip = intDivide((srcX - cosStep) | 0, cosStep)) > count) {
                        count = skip;
                    }

                    if (srcY < 0) {
                        skip = intDivide((sinStep - 1 - srcY) | 0, sinStep);
                        count = (count + skip) | 0;
                        srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                        srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                        dstPos = (dstPos + skip) | 0;
                    }

                    if ((skip = intDivide((1 + srcY - (this.height << 12) - sinStep) | 0, sinStep)) > count) {
                        count = skip;
                    }

                    if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, -count, 0, srcX, srcY, cosStep, sinStep, this.width, SdSpriteMode.ColourKey, 256, 12)) count = 0;
                    while (count < 0) {
                        const rgb = arrayAtI32(this.pixels, (Math.imul(srcY >> 12, this.width) + (srcX >> 12)) | 0);
                        if (rgb !== 0) {
                            arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                        } else {
                            dstPos++;
                        }

                        srcX = (srcX + cosStep) | 0;
                        srcY = (srcY + sinStep) | 0;
                        count++;
                    }

                    row++;
                    rowX = (rowX - sinStep) | 0;
                    rowY = (rowY + cosStep) | 0;
                }
            }
        } else if (sinStep === 0) {
            for (let row = rows; row < 0; dstOff = (dstOff + Pix2D.width) | 0) {
                let dstPos = dstOff;
                let srcX = (rowX + (Math.imul(startX, cosStep) >> 4)) | 0;
                const srcY = rowY;
                let count = columns;
                if (srcY >= 0 && ((srcY - (this.height << 12)) | 0) < 0) {
                    if (srcX < 0) {
                        const skip = intDivide((cosStep - 1 - srcX) | 0, cosStep);
                        count = (count + skip) | 0;
                        srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                        dstPos = (dstPos + skip) | 0;
                    }

                    let end: number;
                    if ((end = intDivide((1 + srcX - (this.width << 12) - cosStep) | 0, cosStep)) > count) {
                        count = end;
                    }

                    if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, -count, 0, srcX, srcY, cosStep, sinStep, this.width, SdSpriteMode.ColourKey, 256, 12)) count = 0;
                    while (count < 0) {
                        const rgb = arrayAtI32(this.pixels, (Math.imul(srcY >> 12, this.width) + (srcX >> 12)) | 0);
                        if (rgb !== 0) {
                            arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                        } else {
                            dstPos++;
                        }

                        srcX = (srcX + cosStep) | 0;
                        count++;
                    }
                }

                row++;
                rowY = (rowY + cosStep) | 0;
            }
        } else if (sinStep < 0) {
            for (let row = rows; row < 0; dstOff = (dstOff + Pix2D.width) | 0) {
                let dstPos = dstOff;
                let srcX = (rowX + (Math.imul(startX, cosStep) >> 4)) | 0;
                let srcY = (rowY + (Math.imul(startX, sinStep) >> 4)) | 0;
                let count = columns;
                if (srcX < 0) {
                    const skip = intDivide((cosStep - 1 - srcX) | 0, cosStep);
                    count = (count + skip) | 0;
                    srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                    srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                    dstPos = (dstPos + skip) | 0;
                }

                let skip: number;
                if ((skip = intDivide((1 + srcX - (this.width << 12) - cosStep) | 0, cosStep)) > count) {
                    count = skip;
                }

                if ((skip = (srcY - (this.height << 12)) | 0) >= 0) {
                    skip = intDivide((sinStep - skip) | 0, sinStep);
                    count = (count + skip) | 0;
                    srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                    srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                    dstPos = (dstPos + skip) | 0;
                }

                if ((skip = intDivide((srcY - sinStep) | 0, sinStep)) > count) {
                    count = skip;
                }

                if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, -count, 0, srcX, srcY, cosStep, sinStep, this.width, SdSpriteMode.ColourKey, 256, 12)) count = 0;
                while (count < 0) {
                    const rgb = arrayAtI32(this.pixels, (Math.imul(srcY >> 12, this.width) + (srcX >> 12)) | 0);
                    if (rgb !== 0) {
                        arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                    } else {
                        dstPos++;
                    }

                    srcX = (srcX + cosStep) | 0;
                    srcY = (srcY + sinStep) | 0;
                    count++;
                }

                row++;
                rowX = (rowX - sinStep) | 0;
                rowY = (rowY + cosStep) | 0;
            }
        } else {
            for (let row = rows; row < 0; dstOff = (dstOff + Pix2D.width) | 0) {
                let dstPos = dstOff;
                let srcX = (rowX + (Math.imul(startX, cosStep) >> 4)) | 0;
                let srcY = (rowY + (Math.imul(startX, sinStep) >> 4)) | 0;
                let count = columns;
                if (srcX < 0) {
                    const skip = intDivide((cosStep - 1 - srcX) | 0, cosStep);
                    count = (count + skip) | 0;
                    srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                    srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                    dstPos = (dstPos + skip) | 0;
                }

                let skip: number;
                if ((skip = intDivide((1 + srcX - (this.width << 12) - cosStep) | 0, cosStep)) > count) {
                    count = skip;
                }

                if (srcY < 0) {
                    skip = intDivide((sinStep - 1 - srcY) | 0, sinStep);
                    count = (count + skip) | 0;
                    srcX = (srcX + Math.imul(cosStep, skip)) | 0;
                    srcY = (srcY + Math.imul(sinStep, skip)) | 0;
                    dstPos = (dstPos + skip) | 0;
                }

                if ((skip = intDivide((1 + srcY - (this.height << 12) - sinStep) | 0, sinStep)) > count) {
                    count = skip;
                }

                if (Pix2D.spanTarget?.spriteSpan(Pix2D.pixels, this.pixels, dstPos, -count, 0, srcX, srcY, cosStep, sinStep, this.width, SdSpriteMode.ColourKey, 256, 12)) count = 0;
                while (count < 0) {
                    const rgb = arrayAtI32(this.pixels, (Math.imul(srcY >> 12, this.width) + (srcX >> 12)) | 0);
                    if (rgb !== 0) {
                        arrayPutI32(Pix2D.pixels, dstPos++, rgb);
                    } else {
                        dstPos++;
                    }

                    srcX = (srcX + cosStep) | 0;
                    srcY = (srcY + sinStep) | 0;
                    count++;
                }

                row++;
                rowX = (rowX - sinStep) | 0;
                rowY = (rowY + cosStep) | 0;
            }
        }
    }
}
