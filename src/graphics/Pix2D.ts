import Pix3D from '#/dash3d/Pix3D';
import TextureShapeRaster from '#/dash3d/TextureShapeRaster';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';

export default class Pix2D {
    // td.<clinit>()V only stores 0 to b, e, d and h; the initializers below carry it (the rest are JVM defaults).

    static get spanTarget() {
        return Pix3D.spanTarget;
    }

    // td.a:[I
    static maskLengths: Int32Array | null = null;
    // td.b:I
    static clipMinY = 0;
    // td.c:I
    static width = 0;
    // td.d:I
    static clipMaxY = 0;
    // td.e:I
    static clipMinX = 0;
    // td.f:[I
    static maskOffsets: Int32Array | null = null;
    // td.g:[I
    static pixels: Int32Array | null = null;
    // td.h:I
    static clipMaxX = 0;
    // td.i:I
    static height = 0;

    // td.a()V. Applet-shutdown unload (client.a(Z)V): nulls the raster target and the clip mask, in the bytecode's
    // order g, f, a.
    static unload(): void {
        Pix2D.pixels = null;
        Pix2D.maskOffsets = null;
        Pix2D.maskLengths = null;
    }

    // td.a(III[I[I)V
    static fillSpans(x: number, y: number, colour: number, offsets: Int32Array | null, lengths: Int32Array | null): void {
        let rowStart = (x + Math.imul(y, Pix2D.width)) | 0;

        for (let row = 0; row < requireNonNull(offsets).length; row++) {
            let pos = (rowStart + arrayAtI32(offsets, row)) | 0;

            const width = arrayAtI32(lengths, row);
            if (Pix3D.spanTarget?.fill(Pix2D.pixels, pos, width, 1, 0, colour)) {
                rowStart = (rowStart + Pix2D.width) | 0;
                continue;
            }
            for (let i = -width | 0; i < 0; i++) {
                arrayPutI32(Pix2D.pixels, pos++, colour);
            }

            rowStart = (rowStart + Pix2D.width) | 0;
        }
    }

    // td.b()V
    static cls(): void {
        if (Pix3D.spanTarget?.fill(Pix2D.pixels, 0, Pix2D.width, Pix2D.height, Pix2D.width, 0)) return;
        let pos = 0;
        let end = (Math.imul(Pix2D.width, Pix2D.height) - 7) | 0;

        while (pos < end) {
            arrayPutI32(Pix2D.pixels, pos++, 0);
            arrayPutI32(Pix2D.pixels, pos++, 0);
            arrayPutI32(Pix2D.pixels, pos++, 0);
            arrayPutI32(Pix2D.pixels, pos++, 0);
            arrayPutI32(Pix2D.pixels, pos++, 0);
            arrayPutI32(Pix2D.pixels, pos++, 0);
            arrayPutI32(Pix2D.pixels, pos++, 0);
            arrayPutI32(Pix2D.pixels, pos++, 0);
        }

        end = (end + 7) | 0;

        while (pos < end) {
            arrayPutI32(Pix2D.pixels, pos++, 0);
        }
    }

    // td.a(IIII)V
    static intersectClipping(left: number, top: number, right: number, bottom: number): void {
        if (Pix2D.clipMinX < left) {
            Pix2D.clipMinX = left;
        }

        if (Pix2D.clipMinY < top) {
            Pix2D.clipMinY = top;
        }

        if (Pix2D.clipMaxX > right) {
            Pix2D.clipMaxX = right;
        }

        if (Pix2D.clipMaxY > bottom) {
            Pix2D.clipMaxY = bottom;
        }

        Pix2D.clearClipMask();
    }

    // td.a(IIIII)V
    static fillCircleTrans(x: number, y: number, radius: number, colour: number, alpha: number): void {
        if (alpha === 0) {
            return;
        }

        if (alpha === 256) {
            Pix2D.fillCircle(x, y, radius, colour);
            return;
        }

        if (radius < 0) {
            radius = -radius | 0;
        }

        const invAlpha = (256 - alpha) | 0;
        const red = Math.imul((colour >> 16) & 0xff, alpha);
        const green = Math.imul((colour >> 8) & 0xff, alpha);
        const blue = Math.imul(colour & 0xff, alpha);
        let top = (y - radius) | 0;
        if (top < Pix2D.clipMinY) {
            top = Pix2D.clipMinY;
        }

        let bottom = (y + radius + 1) | 0;
        if (bottom > Pix2D.clipMaxY) {
            bottom = Pix2D.clipMaxY;
        }

        let row = top;
        const radiusSq = Math.imul(radius, radius);
        let span = 0;
        let dy = (y - row) | 0;
        let errA = Math.imul(dy, dy);
        let errB = (errA - dy) | 0;
        if (y > bottom) {
            y = bottom;
        }

        while (row < y) {
            while (errB <= radiusSq || errA <= radiusSq) {
                errA = (errA + span + span) | 0;
                errB = (errB + span + (span = (span + 1) | 0)) | 0;
            }

            let left = (x - span + 1) | 0;
            if (left < Pix2D.clipMinX) {
                left = Pix2D.clipMinX;
            }

            let right = (x + span) | 0;
            if (right > Pix2D.clipMaxX) {
                right = Pix2D.clipMaxX;
            }

            let pos = (left + Math.imul(row, Pix2D.width)) | 0;

            if (!Pix3D.spanTarget?.fill(Pix2D.pixels, pos, right - left, 1, 0, colour, alpha, true)) {
                for (let i = left; i < right; i++) {
                    const dstRed = Math.imul((arrayAtI32(Pix2D.pixels, pos) >> 16) & 0xff, invAlpha);
                    const dstGreen = Math.imul((arrayAtI32(Pix2D.pixels, pos) >> 8) & 0xff, invAlpha);
                    const dstBlue = Math.imul(arrayAtI32(Pix2D.pixels, pos) & 0xff, invAlpha);
                    const rgb = ((((red + dstRed) >> 8) << 16) + (((green + dstGreen) >> 8) << 8) + ((blue + dstBlue) >> 8)) | 0;
                    arrayPutI32(Pix2D.pixels, pos++, rgb);
                }
            }

            row++;
            errA = (errA - (dy + (dy = (dy - 1) | 0))) | 0;
            errB = (errB - dy - dy) | 0;
        }

        span = radius;
        dy = -dy | 0;
        errB = (Math.imul(dy, dy) + radiusSq) | 0;
        errA = (errB - span) | 0;
        errB = (errB - dy) | 0;

        while (row < bottom) {
            while (errB > radiusSq && errA > radiusSq) {
                errB = (errB - (span + (span = (span - 1) | 0))) | 0;
                errA = (errA - span - span) | 0;
            }

            let left = (x - span) | 0;
            if (left < Pix2D.clipMinX) {
                left = Pix2D.clipMinX;
            }

            let right = (x + span) | 0;
            if (right > ((Pix2D.clipMaxX - 1) | 0)) {
                right = (Pix2D.clipMaxX - 1) | 0;
            }

            let pos = (left + Math.imul(row, Pix2D.width)) | 0;

            if (!Pix3D.spanTarget?.fill(Pix2D.pixels, pos, right - left + 1, 1, 0, colour, alpha, true)) {
                for (let i = left; i <= right; i = (i + 1) | 0) {
                    const dstRed = Math.imul((arrayAtI32(Pix2D.pixels, pos) >> 16) & 0xff, invAlpha);
                    const dstGreen = Math.imul((arrayAtI32(Pix2D.pixels, pos) >> 8) & 0xff, invAlpha);
                    const dstBlue = Math.imul(arrayAtI32(Pix2D.pixels, pos) & 0xff, invAlpha);
                    const rgb = ((((red + dstRed) >> 8) << 16) + (((green + dstGreen) >> 8) << 8) + ((blue + dstBlue) >> 8)) | 0;
                    arrayPutI32(Pix2D.pixels, pos++, rgb);
                }
            }

            row++;
            errB = (errB + dy + dy) | 0;
            errA = (errA + dy + (dy = (dy + 1) | 0)) | 0;
        }
    }

    // td.b(IIIII)V
    private static hlineTrans(x: number, y: number, width: number, colour: number, alpha: number): void {
        if (y < Pix2D.clipMinY || y >= Pix2D.clipMaxY) {
            return;
        }

        if (x < Pix2D.clipMinX) {
            width = (width - (Pix2D.clipMinX - x)) | 0;
            x = Pix2D.clipMinX;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            width = (Pix2D.clipMaxX - x) | 0;
        }

        if (Pix3D.spanTarget?.fill(Pix2D.pixels, (x + Math.imul(y, Pix2D.width)) | 0, width, 1, 0, colour, alpha, true)) return;
        const invAlpha = (256 - alpha) | 0;
        const red = Math.imul((colour >> 16) & 0xff, alpha);
        const green = Math.imul((colour >> 8) & 0xff, alpha);
        const blue = Math.imul(colour & 0xff, alpha);
        let pos = (x + Math.imul(y, Pix2D.width)) | 0;

        for (let i = 0; i < width; i++) {
            const dstRed = Math.imul((arrayAtI32(Pix2D.pixels, pos) >> 16) & 0xff, invAlpha);
            const dstGreen = Math.imul((arrayAtI32(Pix2D.pixels, pos) >> 8) & 0xff, invAlpha);
            const dstBlue = Math.imul(arrayAtI32(Pix2D.pixels, pos) & 0xff, invAlpha);
            const rgb = ((((red + dstRed) >> 8) << 16) + (((green + dstGreen) >> 8) << 8) + ((blue + dstBlue) >> 8)) | 0;
            arrayPutI32(Pix2D.pixels, pos++, rgb);
        }
    }

    // td.a(III)V
    private static setPixel(x: number, y: number, colour: number): void {
        if (x >= Pix2D.clipMinX && y >= Pix2D.clipMinY && x < Pix2D.clipMaxX && y < Pix2D.clipMaxY) {
            const pos = (x + Math.imul(y, Pix2D.width)) | 0;
            if (!Pix3D.spanTarget?.fill(Pix2D.pixels, pos, 1, 1, 0, colour)) arrayPutI32(Pix2D.pixels, pos, colour);
        }
    }

    // td.a([I)V
    static restoreClipping(clip: Int32Array | null): void {
        Pix2D.clipMinX = arrayAtI32(clip, 0);
        Pix2D.clipMinY = arrayAtI32(clip, 1);
        Pix2D.clipMaxX = arrayAtI32(clip, 2);
        Pix2D.clipMaxY = arrayAtI32(clip, 3);
        Pix2D.clearClipMask();
    }

    // td.a([I[I)V
    static setClipMask(offsets: Int32Array | null, lengths: Int32Array | null): void {
        if (requireNonNull(offsets).length === ((Pix2D.clipMaxY - Pix2D.clipMinY) | 0) && requireNonNull(lengths).length === ((Pix2D.clipMaxY - Pix2D.clipMinY) | 0)) {
            Pix2D.maskOffsets = offsets;
            Pix2D.maskLengths = lengths;
        } else {
            throw new Error('IllegalArgumentException');
        }
    }

    // td.c()V
    static resetClipping(): void {
        Pix2D.clipMinX = 0;
        Pix2D.clipMinY = 0;
        Pix2D.clipMaxX = Pix2D.width;
        Pix2D.clipMaxY = Pix2D.height;
        Pix2D.clearClipMask();
    }

    // td.b([I)V
    static saveClipping(clip: Int32Array | null): void {
        arrayPutI32(clip, 0, Pix2D.clipMinX);
        arrayPutI32(clip, 1, Pix2D.clipMinY);
        arrayPutI32(clip, 2, Pix2D.clipMaxX);
        arrayPutI32(clip, 3, Pix2D.clipMaxY);
    }

    // td.c(IIIII)V
    static drawRect(x: number, y: number, width: number, height: number, colour: number): void {
        Pix2D.hline(x, y, width, colour);
        Pix2D.hline(x, (y + height - 1) | 0, width, colour);
        Pix2D.vline(x, y, height, colour);
        Pix2D.vline((x + width - 1) | 0, y, height, colour);
    }

    // td.a(IIIIII)V
    static drawThickLine(x0: number, y0: number, x1: number, y1: number, colour: number, thickness: number): void {
        const dx = (x1 - x0) | 0;
        const dy = (y1 - y0) | 0;
        const absDx = dx >= 0 ? dx : -dx | 0;
        const absDy = dy >= 0 ? dy : -dy | 0;
        let length = absDx;
        if (length < absDy) {
            length = absDy;
        }

        if (length === 0) {
            return;
        }

        // length != 0 here, so these divisions cannot throw.
        let stepX = ((dx << 16) / length) | 0;
        let stepY = ((dy << 16) / length) | 0;
        if (stepY <= stepX) {
            stepX = -stepX | 0;
        } else {
            stepY = -stepY | 0;
        }

        const offsetX0 = Math.imul(thickness, stepY) >> 17;
        const offsetX1 = (Math.imul(thickness, stepY) + 1) >> 17;
        const offsetY0 = Math.imul(thickness, stepX) >> 17;
        const offsetY1 = (Math.imul(thickness, stepX) + 1) >> 17;
        x0 = (x0 - Pix3D.getOffsetX()) | 0;
        y0 = (y0 - Pix3D.getOffsetY()) | 0;
        const ax = (x0 + offsetX0) | 0;
        const bx = (x0 - offsetX1) | 0;
        const cx = (x0 + dx - offsetX1) | 0;
        const ex = (x0 + dx + offsetX0) | 0;
        const ay = (y0 + offsetY0) | 0;
        const by = (y0 - offsetY1) | 0;
        const cy = (y0 + dy - offsetY1) | 0;
        const ey = (y0 + dy + offsetY0) | 0;
        Pix3D.testHclip(ax, bx, cx);
        Pix3D.flatTriangle(ay, by, cy, ax, bx, cx, colour);
        Pix3D.testHclip(ax, cx, ex);
        Pix3D.flatTriangle(ay, cy, ey, ax, cx, ex, colour);
    }

    // td.d(IIIII)V
    static fillRect(x: number, y: number, width: number, height: number, colour: number): void {
        if (x < Pix2D.clipMinX) {
            width = (width - (Pix2D.clipMinX - x)) | 0;
            x = Pix2D.clipMinX;
        }

        if (y < Pix2D.clipMinY) {
            height = (height - (Pix2D.clipMinY - y)) | 0;
            y = Pix2D.clipMinY;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            width = (Pix2D.clipMaxX - x) | 0;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (Pix2D.clipMaxY - y) | 0;
        }

        const stride = (Pix2D.width - width) | 0;
        let pos = (x + Math.imul(y, Pix2D.width)) | 0;

        if (Pix3D.spanTarget?.fill(Pix2D.pixels, pos, width, height, Pix2D.width, colour)) return;

        const pixels = Pix2D.pixels;
        const end = pos + (height - 1) * Pix2D.width + width;
        if (pixels !== null && width > 0 && height > 0 && Pix2D.width >= width && pos >= 0 && end <= pixels.length && end <= 0x7fffffff) {
            if (stride === 0) pixels.fill(colour, pos, end);
            else for (let row = 0; row < height; row++, pos += Pix2D.width) pixels.fill(colour, pos, pos + width);
            return;
        }

        for (let i = -height | 0; i < 0; i++) {
            for (let j = -width | 0; j < 0; j++) {
                arrayPutI32(Pix2D.pixels, pos++, colour);
            }

            pos = (pos + stride) | 0;
        }
    }

    // td.a([III)V
    static setPixels(pixels: Int32Array | null, width: number, height: number): void {
        Pix2D.pixels = Pix3D.spanTarget === null ? pixels : Pix3D.spanTarget.bind(pixels);
        Pix2D.width = width;
        Pix2D.height = height;
        Pix2D.setClipping(0, 0, width, height);
    }

    // td.b(IIII)V
    static setClipping(left: number, top: number, right: number, bottom: number): void {
        if (left < 0) {
            left = 0;
        }

        if (top < 0) {
            top = 0;
        }

        if (right > Pix2D.width) {
            right = Pix2D.width;
        }

        if (bottom > Pix2D.height) {
            bottom = Pix2D.height;
        }

        Pix2D.clipMinX = left;
        Pix2D.clipMinY = top;
        Pix2D.clipMaxX = right;
        Pix2D.clipMaxY = bottom;
        Pix2D.clearClipMask();
    }

    // td.b(IIIIII)V
    static fillRectTrans(x: number, y: number, width: number, height: number, colour: number, alpha: number): void {
        if (x < Pix2D.clipMinX) {
            width = (width - (Pix2D.clipMinX - x)) | 0;
            x = Pix2D.clipMinX;
        }

        if (y < Pix2D.clipMinY) {
            height = (height - (Pix2D.clipMinY - y)) | 0;
            y = Pix2D.clipMinY;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            width = (Pix2D.clipMaxX - x) | 0;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (Pix2D.clipMaxY - y) | 0;
        }

        if (Pix3D.spanTarget?.fill(Pix2D.pixels, (x + Math.imul(y, Pix2D.width)) | 0, width, height, Pix2D.width, colour, alpha)) return;
        colour = (((Math.imul(colour & 0xff00ff, alpha) >> 8) & 0xff00ff) + ((Math.imul(colour & 0xff00, alpha) >> 8) & 0xff00)) | 0;
        const invAlpha = (256 - alpha) | 0;
        const stride = (Pix2D.width - width) | 0;
        let pos = (x + Math.imul(y, Pix2D.width)) | 0;

        for (let i = 0; i < height; i++) {
            for (let j = -width | 0; j < 0; j++) {
                let rgb = arrayAtI32(Pix2D.pixels, pos);
                rgb = (((Math.imul(rgb & 0xff00ff, invAlpha) >> 8) & 0xff00ff) + ((Math.imul(rgb & 0xff00, invAlpha) >> 8) & 0xff00)) | 0;
                arrayPutI32(Pix2D.pixels, pos++, (colour + rgb) | 0);
            }

            pos = (pos + stride) | 0;
        }
    }

    // td.e(IIIII)V
    private static vlineTrans(x: number, y: number, height: number, colour: number, alpha: number): void {
        if (x < Pix2D.clipMinX || x >= Pix2D.clipMaxX) {
            return;
        }

        if (y < Pix2D.clipMinY) {
            height = (height - (Pix2D.clipMinY - y)) | 0;
            y = Pix2D.clipMinY;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (Pix2D.clipMaxY - y) | 0;
        }

        if (Pix3D.spanTarget?.fill(Pix2D.pixels, (x + Math.imul(y, Pix2D.width)) | 0, 1, height, Pix2D.width, colour, alpha, true)) return;
        const invAlpha = (256 - alpha) | 0;
        const red = Math.imul((colour >> 16) & 0xff, alpha);
        const green = Math.imul((colour >> 8) & 0xff, alpha);
        const blue = Math.imul(colour & 0xff, alpha);
        let pos = (x + Math.imul(y, Pix2D.width)) | 0;

        for (let i = 0; i < height; i++) {
            const dstRed = Math.imul((arrayAtI32(Pix2D.pixels, pos) >> 16) & 0xff, invAlpha);
            const dstGreen = Math.imul((arrayAtI32(Pix2D.pixels, pos) >> 8) & 0xff, invAlpha);
            const dstBlue = Math.imul(arrayAtI32(Pix2D.pixels, pos) & 0xff, invAlpha);
            const rgb = ((((red + dstRed) >> 8) << 16) + (((green + dstGreen) >> 8) << 8) + ((blue + dstBlue) >> 8)) | 0;
            arrayPutI32(Pix2D.pixels, pos, rgb);
            pos = (pos + Pix2D.width) | 0;
        }
    }

    // td.c(IIII)V
    private static fillCircle(x: number, y: number, radius: number, colour: number): void {
        if (radius === 0) {
            Pix2D.setPixel(x, y, colour);
            return;
        }

        if (radius < 0) {
            radius = -radius | 0;
        }

        let top = (y - radius) | 0;
        if (top < Pix2D.clipMinY) {
            top = Pix2D.clipMinY;
        }

        let bottom = (y + radius + 1) | 0;
        if (bottom > Pix2D.clipMaxY) {
            bottom = Pix2D.clipMaxY;
        }

        let row = top;
        const radiusSq = Math.imul(radius, radius);
        let span = 0;
        let dy = (y - row) | 0;
        let errA = Math.imul(dy, dy);
        let errB = (errA - dy) | 0;
        if (y > bottom) {
            y = bottom;
        }

        while (row < y) {
            while (errB <= radiusSq || errA <= radiusSq) {
                errA = (errA + span + span) | 0;
                errB = (errB + span + (span = (span + 1) | 0)) | 0;
            }

            let left = (x - span + 1) | 0;
            if (left < Pix2D.clipMinX) {
                left = Pix2D.clipMinX;
            }

            let right = (x + span) | 0;
            if (right > Pix2D.clipMaxX) {
                right = Pix2D.clipMaxX;
            }

            let pos = (left + Math.imul(row, Pix2D.width)) | 0;

            if (!Pix3D.spanTarget?.fill(Pix2D.pixels, pos, right - left, 1, 0, colour)) {
                for (let i = left; i < right; i++) {
                    arrayPutI32(Pix2D.pixels, pos++, colour);
                }
            }

            row++;
            errA = (errA - (dy + (dy = (dy - 1) | 0))) | 0;
            errB = (errB - dy - dy) | 0;
        }

        span = radius;
        dy = (row - y) | 0;
        errB = (Math.imul(dy, dy) + radiusSq) | 0;
        errA = (errB - span) | 0;
        errB = (errB - dy) | 0;

        while (row < bottom) {
            while (errB > radiusSq && errA > radiusSq) {
                errB = (errB - (span + (span = (span - 1) | 0))) | 0;
                errA = (errA - span - span) | 0;
            }

            let left = (x - span) | 0;
            if (left < Pix2D.clipMinX) {
                left = Pix2D.clipMinX;
            }

            let right = (x + span) | 0;
            if (right > ((Pix2D.clipMaxX - 1) | 0)) {
                right = (Pix2D.clipMaxX - 1) | 0;
            }

            let pos = (left + Math.imul(row, Pix2D.width)) | 0;

            if (!Pix3D.spanTarget?.fill(Pix2D.pixels, pos, right - left + 1, 1, 0, colour)) {
                for (let i = left; i <= right; i = (i + 1) | 0) {
                    arrayPutI32(Pix2D.pixels, pos++, colour);
                }
            }

            row++;
            errB = (errB + dy + dy) | 0;
            errA = (errA + dy + (dy = (dy + 1) | 0)) | 0;
        }
    }

    // td.c(IIIIII)V
    static drawRectTrans(x: number, y: number, width: number, height: number, colour: number, alpha: number): void {
        Pix2D.hlineTrans(x, y, width, colour, alpha);
        Pix2D.hlineTrans(x, (y + height - 1) | 0, width, colour, alpha);
        if (height >= 3) {
            Pix2D.vlineTrans(x, (y + 1) | 0, (height - 2) | 0, colour, alpha);
            Pix2D.vlineTrans((x + width - 1) | 0, (y + 1) | 0, (height - 2) | 0, colour, alpha);
        }
    }

    // td.d(IIII)V
    static hline(x: number, y: number, width: number, colour: number): void {
        if (y < Pix2D.clipMinY || y >= Pix2D.clipMaxY) {
            return;
        }

        if (x < Pix2D.clipMinX) {
            width = (width - (Pix2D.clipMinX - x)) | 0;
            x = Pix2D.clipMinX;
        }

        if (((x + width) | 0) > Pix2D.clipMaxX) {
            width = (Pix2D.clipMaxX - x) | 0;
        }

        const pos = (x + Math.imul(y, Pix2D.width)) | 0;

        if (Pix3D.spanTarget?.fill(Pix2D.pixels, pos, width, 1, 0, colour)) return;
        for (let i = 0; i < width; i++) {
            arrayPutI32(Pix2D.pixels, pos + i, colour);
        }
    }

    // td.f(IIIII)V
    static drawLine2(x: number, y: number, x1: number, y1: number, colour: number): void {
        // Java reuses the end-point parameters as the deltas (var2 -= var0, var3 -= var1).
        let dx = (x1 - x) | 0;
        let dy = (y1 - y) | 0;
        if (dy === 0) {
            if (dx >= 0) {
                Pix2D.hline(x, y, (dx + 1) | 0, colour);
            } else {
                Pix2D.hline((x + dx) | 0, y, (-dx + 1) | 0, colour);
            }
        } else if (dx === 0) {
            if (dy >= 0) {
                Pix2D.vline(x, y, (dy + 1) | 0, colour);
            } else {
                Pix2D.vline(x, (y + dy) | 0, (-dy + 1) | 0, colour);
            }
        } else {
            if (((dx + dy) | 0) < 0) {
                x = (x + dx) | 0;
                dx = -dx | 0;
                y = (y + dy) | 0;
                dy = -dy | 0;
            }

            if (dx > dy) {
                y <<= 16;
                y = (y + 32768) | 0;
                dy <<= 16;
                const step = doubleToInt(Math.floor(dy / dx + 0.5));
                // dx becomes the end column (var2 += var0).
                dx = (dx + x) | 0;
                if (x < Pix2D.clipMinX) {
                    y = (y + Math.imul(step, (Pix2D.clipMinX - x) | 0)) | 0;
                    x = Pix2D.clipMinX;
                }

                if (dx >= Pix2D.clipMaxX) {
                    dx = (Pix2D.clipMaxX - 1) | 0;
                }

                while (x <= dx) {
                    const row = y >> 16;
                    if (row >= Pix2D.clipMinY && row < Pix2D.clipMaxY) {
                        const pos = (x + Math.imul(row, Pix2D.width)) | 0;
                        if (!Pix3D.spanTarget?.fill(Pix2D.pixels, pos, 1, 1, 0, colour)) arrayPutI32(Pix2D.pixels, pos, colour);
                    }

                    y = (y + step) | 0;
                    x = (x + 1) | 0;
                }
            } else {
                x <<= 16;
                x = (x + 32768) | 0;
                dx <<= 16;
                const step = doubleToInt(Math.floor(dx / dy + 0.5));
                // dy becomes the end row (var3 += var1).
                dy = (dy + y) | 0;
                if (y < Pix2D.clipMinY) {
                    x = (x + Math.imul(step, (Pix2D.clipMinY - y) | 0)) | 0;
                    y = Pix2D.clipMinY;
                }

                if (dy >= Pix2D.clipMaxY) {
                    dy = (Pix2D.clipMaxY - 1) | 0;
                }

                while (y <= dy) {
                    const column = x >> 16;
                    if (column >= Pix2D.clipMinX && column < Pix2D.clipMaxX) {
                        const pos = (column + Math.imul(y, Pix2D.width)) | 0;
                        if (!Pix3D.spanTarget?.fill(Pix2D.pixels, pos, 1, 1, 0, colour)) arrayPutI32(Pix2D.pixels, pos, colour);
                    }

                    x = (x + step) | 0;
                    y = (y + 1) | 0;
                }
            }
        }
    }

    // td.e(IIII)V
    static vline(x: number, y: number, height: number, colour: number): void {
        if (x < Pix2D.clipMinX || x >= Pix2D.clipMaxX) {
            return;
        }

        if (y < Pix2D.clipMinY) {
            height = (height - (Pix2D.clipMinY - y)) | 0;
            y = Pix2D.clipMinY;
        }

        if (((y + height) | 0) > Pix2D.clipMaxY) {
            height = (Pix2D.clipMaxY - y) | 0;
        }

        const pos = (x + Math.imul(y, Pix2D.width)) | 0;

        if (Pix3D.spanTarget?.fill(Pix2D.pixels, pos, 1, height, Pix2D.width, colour)) return;
        for (let i = 0; i < height; i++) {
            arrayPutI32(Pix2D.pixels, pos + Math.imul(i, Pix2D.width), colour);
        }
    }

    // td.d()V
    static clearClipMask(): void {
        Pix2D.maskOffsets = null;
        Pix2D.maskLengths = null;
    }

    // ea.a(IIIIII)V
    // The third Java argument is a dummy (every caller passes -30374), stripped with its guard.
    static drawLine(x1: number, colour: number, y0: number, y1: number, x0: number): void {
        const dx = (x1 - x0) | 0;
        const dy = (-y0 + y1) | 0;
        if (dx === 0) {
            if (dy !== 0) {
                TextureShapeRaster.drawVerticalLineClipped(y1, y0, colour, x0);
            }
        } else if (dy === 0) {
            TextureShapeRaster.hline(colour, y0, x0, x1);
        } else {
            // dx != 0 here, so this division cannot throw.
            const slope = ((dy << 12) / dx) | 0;
            const intercept = (-(Math.imul(x0, slope) >> 12) + y0) | 0;
            let startX: number;
            let startY: number;
            if (x0 < TextureShapeRaster.clipMinX) {
                startY = (intercept + (Math.imul(TextureShapeRaster.clipMinX, slope) >> 12)) | 0;
                startX = TextureShapeRaster.clipMinX;
            } else if (TextureShapeRaster.clipMaxX < x0) {
                startX = TextureShapeRaster.clipMaxX;
                startY = (intercept - -(Math.imul(slope, TextureShapeRaster.clipMaxX) >> 12)) | 0;
            } else {
                startX = x0;
                startY = y0;
            }

            let endX: number;
            let endY: number;
            if (TextureShapeRaster.clipMinX <= x1) {
                if (TextureShapeRaster.clipMaxX >= x1) {
                    endX = x1;
                    endY = y1;
                } else {
                    endY = (intercept - -(Math.imul(slope, TextureShapeRaster.clipMaxX) >> 12)) | 0;
                    endX = TextureShapeRaster.clipMaxX;
                }
            } else {
                endY = (intercept + (Math.imul(slope, TextureShapeRaster.clipMinX) >> 12)) | 0;
                endX = TextureShapeRaster.clipMinX;
            }

            if (TextureShapeRaster.clipTop <= startY) {
                if (startY > TextureShapeRaster.clipMaxY) {
                    startX = intDivide((-intercept + TextureShapeRaster.clipMaxY) << 12, slope);
                    startY = TextureShapeRaster.clipMaxY;
                }
            } else {
                startX = intDivide((TextureShapeRaster.clipTop - intercept) << 12, slope);
                startY = TextureShapeRaster.clipTop;
            }

            if (endY >= TextureShapeRaster.clipTop) {
                if (TextureShapeRaster.clipMaxY < endY) {
                    endX = intDivide((TextureShapeRaster.clipMaxY + -intercept) << 12, slope);
                    endY = TextureShapeRaster.clipMaxY;
                }
            } else {
                endX = intDivide((TextureShapeRaster.clipTop + -intercept) << 12, slope);
                endY = TextureShapeRaster.clipTop;
            }

            TextureShapeRaster.drawLine(endY, colour, endX, startY, startX);
        }
    }

    // ef.a(IIIIII)V
    // The fifth Java argument is a dummy (the only caller, ok.a, passes -50), stripped with its
    // guard (>= -36 calls ef.a(BLjava/lang/String;)V).
    // HD cl.a(IIIBII)V returns before touching the raster when the byte is at least -93.
    static fillEllipseClipped(radiusY: number, y: number, x: number, colour: number, radiusX: number, hdGuard = -128): void {
        if (hdGuard >= -93) return;
        let span = 0;
        const radiusXSq = Math.imul(radiusX, radiusX);
        const radiusYSq = Math.imul(radiusY, radiusY);
        let row = radiusY;
        const radiusYSq2 = radiusYSq << 1;
        const radiusY2 = radiusY << 1;
        let errA = (radiusYSq2 + Math.imul(radiusXSq, (-radiusY2 + 1) | 0)) | 0;
        const radiusXSq2 = radiusXSq << 1;
        let errB = (radiusYSq - Math.imul((-1 + radiusY2) | 0, radiusXSq2)) | 0;
        const radiusYSq4 = radiusYSq << 2;
        const radiusXSq4 = radiusXSq << 2;
        let stepA = Math.imul(((span << 1) - -3) | 0, radiusYSq2);
        let rowStepA = Math.imul(radiusXSq4, (-1 + row) | 0);
        if (TextureShapeRaster.clipTop <= y && TextureShapeRaster.clipMaxY >= y) {
            const right = TextureShapeRaster.clamp((radiusX + x) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            const left = TextureShapeRaster.clamp((x - radiusX) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
            TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, y), right, colour);
        }

        let rowStepB = Math.imul(radiusXSq2, (-3 + (row << 1)) | 0);
        let stepB = Math.imul((span + 1) | 0, radiusYSq4);

        while (row > 0) {
            if (errA < 0) {
                do {
                    span = (span + 1) | 0;
                    errB = (errB + stepB) | 0;
                    errA = (errA + stepA) | 0;
                    stepB = (stepB + radiusYSq4) | 0;
                    stepA = (stepA + radiusYSq4) | 0;
                } while (errA < 0);
            }

            if (errB < 0) {
                errA = (errA + stepA) | 0;
                errB = (errB + stepB) | 0;
                span = (span + 1) | 0;
                stepA = (stepA + radiusYSq4) | 0;
                stepB = (stepB + radiusYSq4) | 0;
            }

            row = (row - 1) | 0;
            errB = (errB + -rowStepB) | 0;
            rowStepB = (rowStepB - radiusXSq4) | 0;
            const lower = (row + y) | 0;
            errA = (errA + -rowStepA) | 0;
            const upper = (y + -row) | 0;
            if (TextureShapeRaster.clipTop <= lower && TextureShapeRaster.clipMaxY >= upper) {
                const right = TextureShapeRaster.clamp((span + x) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                const left = TextureShapeRaster.clamp((-span + x) | 0, TextureShapeRaster.clipMaxX, TextureShapeRaster.clipMinX);
                if (TextureShapeRaster.clipTop <= upper) {
                    TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, upper), right, colour);
                }

                if (lower <= TextureShapeRaster.clipMaxY) {
                    TextureShapeRaster.fillRow(left, arrayAtObj(TextureShapeRaster.raster, lower), right, colour);
                }
            }

            rowStepA = (rowStepA - radiusXSq4) | 0;
        }
    }
}
