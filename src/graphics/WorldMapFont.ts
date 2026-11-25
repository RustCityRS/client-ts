import type JagString from '#/datastruct/JagString';
import GameShell from '#/client/GameShell';
import { arrayAt, arrayAtI32, arrayAtI8, arrayPutI32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import { JavaError } from '#/util/ClientError';
import Pix2D from './Pix2D';
import { fontSurface, mapFontCharacters, type MapAwtFont, type MapFontMetrics } from './WorldMapFontSurface';

// eg. The nine leading bytes per glyph hold its bitmap address, dimensions, bearings, advance and line height.
export default class WorldMapFont {
    static charset: string | null = mapFontCharacters; // eg.a:Ljava/lang/String;
    static charsetLength = mapFontCharacters.length; // eg.e:I
    static glyphOffsets: Int32Array | null = new Int32Array(256); // eg.f:[I
    static {
        for (let i = 0; i < 256; i++) {
            const index = mapFontCharacters.indexOf(String.fromCharCode(i));
            arrayPutI32(WorldMapFont.glyphOffsets, i, (index === -1 ? 74 : index) * 9);
        }
    }
    private data: Int8Array | null = new Int8Array(100000); // eg.b:[B
    private antialiased = false; // eg.c:Z
    private cursor = 0; // eg.d:I

    // eg.<init>(IZLjava/awt/Component;)V
    constructor(size: number, bold: boolean, component: object | null) {
        this.cursor = Math.imul(WorldMapFont.charsetLength, 9);
        let font: MapAwtFont = { family: 'Helvetica', size, bold };
        let metrics = fontSurface(component).getFontMetrics(font);
        for (let i = 0; i < WorldMapFont.charsetLength; i++) {
            this.rasterizeGlyph(font, metrics, arrayAt(WorldMapFont.charset, i), i, false);
        }
        if (bold && this.antialiased) {
            this.cursor = Math.imul(WorldMapFont.charsetLength, 9);
            this.antialiased = false;
            font = { family: 'Helvetica', size, bold: false };
            metrics = fontSurface(component).getFontMetrics(font);
            for (let i = 0; i < WorldMapFont.charsetLength; i++) {
                this.rasterizeGlyph(font, metrics, arrayAt(WorldMapFont.charset, i), i, false);
            }
            if (!this.antialiased) {
                this.cursor = Math.imul(WorldMapFont.charsetLength, 9);
                this.antialiased = false;
                for (let i = 0; i < WorldMapFont.charsetLength; i++) {
                    this.rasterizeGlyph(font, metrics, arrayAt(WorldMapFont.charset, i), i, true);
                }
            }
        }
        const packed = new Int8Array(this.cursor);
        for (let i = 0; i < this.cursor; i++) packed[i] = arrayAtI8(this.data, i);
        this.data = packed;
    }

    // eg.a(Ljava/awt/Font;Ljava/awt/FontMetrics;CIZ)V
    private rasterizeGlyph(font: MapAwtFont, metrics: MapFontMetrics, letter: string, index: number, overstrike: boolean): void {
        let width = metrics.charWidth(letter);
        const advance = width;
        if (overstrike) {
            if (letter === '/') overstrike = false;
            if ('ftwvkxyAVW'.includes(letter)) width = (width + 1) | 0;
        }
        const ascent = metrics.getMaxAscent(),
            height = (metrics.getMaxAscent() + metrics.getMaxDescent()) | 0;
        const lineHeight = metrics.getHeight();
        const image = requireNonNull(fontSurface(GameShell.canvas).createImage(width, height));
        const graphics = image.getGraphics();
        graphics.setColor(0);
        graphics.fillRect(0, 0, width, height);
        graphics.setColor(0xffffff);
        graphics.setFont(font);
        graphics.drawString(letter, 0, ascent);
        if (overstrike) graphics.drawString(letter, 1, ascent);
        const pixels = new Int32Array(Math.imul(width, height));
        const grabber = image.createPixelGrabber(pixels);
        try {
            grabber.grabPixels();
        } catch (error) {
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
        }
        image.flush();
        let left = 0,
            top = 0,
            right = width,
            bottom = height;
        topEdge: for (let y = 0; y < height; y++)
            for (let x = 0; x < width; x++) {
                if ((arrayAtI32(pixels, (x + Math.imul(y, width)) | 0) & 0xffffff) !== 0) {
                    top = y;
                    break topEdge;
                }
            }
        leftEdge: for (let x = 0; x < width; x++)
            for (let y = 0; y < height; y++) {
                if ((arrayAtI32(pixels, (x + Math.imul(y, width)) | 0) & 0xffffff) !== 0) {
                    left = x;
                    break leftEdge;
                }
            }
        bottomEdge: for (let y = height - 1; y >= 0; y--)
            for (let x = 0; x < width; x++) {
                if ((arrayAtI32(pixels, (x + Math.imul(y, width)) | 0) & 0xffffff) !== 0) {
                    bottom = y + 1;
                    break bottomEdge;
                }
            }
        rightEdge: for (let x = width - 1; x >= 0; x--)
            for (let y = 0; y < height; y++) {
                if ((arrayAtI32(pixels, (x + Math.imul(y, width)) | 0) & 0xffffff) !== 0) {
                    right = x + 1;
                    break rightEdge;
                }
            }
        const header = Math.imul(index, 9);
        arrayPutI8(this.data, header, (this.cursor / 16384) | 0);
        arrayPutI8(this.data, header + 1, (this.cursor / 128) & 127);
        arrayPutI8(this.data, header + 2, this.cursor & 127);
        arrayPutI8(this.data, header + 3, right - left);
        arrayPutI8(this.data, header + 4, bottom - top);
        arrayPutI8(this.data, header + 5, left);
        arrayPutI8(this.data, header + 6, ascent - top);
        arrayPutI8(this.data, header + 7, advance);
        arrayPutI8(this.data, header + 8, lineHeight);
        for (let y = top; y < bottom; y++)
            for (let x = left; x < right; x++) {
                const coverage = arrayAtI32(pixels, (x + Math.imul(y, width)) | 0) & 255;
                if (coverage > 30 && coverage < 230) this.antialiased = true;
                arrayPutI8(this.data, this.cursor++, coverage);
            }
    }

    // eg.a(Lid;IIIZ)V
    private drawString(text: JagString | null, x: number, y: number, colour: number, shadow: boolean): void {
        if (this.antialiased || colour === 0) shadow = false;
        for (let i = 0; i < requireNonNull(text).length; i++) {
            const offset = arrayAtI32(WorldMapFont.glyphOffsets, requireNonNull(text).charAt(i));
            if (shadow) {
                this.drawGlyph(offset, (x + 1) | 0, y, 1, this.data);
                this.drawGlyph(offset, x, (y + 1) | 0, 1, this.data);
            }
            this.drawGlyph(offset, x, y, colour, this.data);
            x = (x + arrayAtI8(this.data, offset + 7)) | 0;
        }
    }
    // eg.b(Lid;IIIZ)V
    drawStringCentered(text: JagString | null, x: number, y: number, colour: number, shadow: boolean): void {
        const half = (this.stringWidth(text) / 2) | 0,
            baseline = this.getBaseline();
        if (((x - half) | 0) <= Pix2D.clipMaxX && ((x + half) | 0) >= Pix2D.clipMinX && ((y - baseline) | 0) <= Pix2D.clipMaxY && y >= 0) this.drawString(text, (x - half) | 0, y, colour, shadow);
    }
    // eg.a(Lid;)I
    private stringWidth(text: JagString | null): number {
        let width = 0;
        for (let i = 0; i < requireNonNull(text).length; i++) {
            if (requireNonNull(text).charAt(i) === 64 && i + 4 < requireNonNull(text).length && requireNonNull(text).charAt(i + 4) === 64) i += 4;
            else if (requireNonNull(text).charAt(i) === 126 && i + 4 < requireNonNull(text).length && requireNonNull(text).charAt(i + 4) === 126) i += 4;
            else width = (width + arrayAtI8(this.data, arrayAtI32(WorldMapFont.glyphOffsets, requireNonNull(text).charAt(i)) + 7)) | 0;
        }
        return width;
    }
    // eg.a()I
    getLineHeight(): number {
        return arrayAtI8(this.data, 8) - 1;
    }
    // eg.b()I
    getBaseline(): number {
        return arrayAtI8(this.data, 6);
    }

    // eg.a(IIII[B)V
    private drawGlyph(offset: number, x: number, y: number, colour: number, data: Int8Array | null): void {
        x = (x + arrayAtI8(data, offset + 5)) | 0;
        y = (y - arrayAtI8(data, offset + 6)) | 0;
        let width = arrayAtI8(data, offset + 3),
            height = arrayAtI8(data, offset + 4);
        let src = (arrayAtI8(data, offset) * 16384 + arrayAtI8(data, offset + 1) * 128 + arrayAtI8(data, offset + 2)) | 0;
        let dst = (x + Math.imul(y, Pix2D.width)) | 0,
            dstSkip = (Pix2D.width - width) | 0,
            srcSkip = 0;
        if (y < Pix2D.clipMinY) {
            const cut = (Pix2D.clipMinY - y) | 0;
            height = (height - cut) | 0;
            y = Pix2D.clipMinY;
            src = (src + Math.imul(cut, width)) | 0;
            dst = (dst + Math.imul(cut, Pix2D.width)) | 0;
        }
        if (((y + height) | 0) >= Pix2D.clipMaxY) height = (height - (y + height - Pix2D.clipMaxY + 1)) | 0;
        if (x < Pix2D.clipMinX) {
            const cut = (Pix2D.clipMinX - x) | 0;
            width = (width - cut) | 0;
            x = Pix2D.clipMinX;
            src = (src + cut) | 0;
            dst = (dst + cut) | 0;
            srcSkip = (srcSkip + cut) | 0;
            dstSkip = (dstSkip + cut) | 0;
        }
        if (((x + width) | 0) >= Pix2D.clipMaxX) {
            const cut = (x + width - Pix2D.clipMaxX + 1) | 0;
            width = (width - cut) | 0;
            srcSkip = (srcSkip + cut) | 0;
            dstSkip = (dstSkip + cut) | 0;
        }
        if (width > 0 && height > 0) {
            if (this.antialiased) this.blitAlpha(Pix2D.pixels, data, colour, src, dst, width, height, dstSkip, srcSkip);
            else this.blitMono(Pix2D.pixels, data, colour, src, dst, width, height, dstSkip, srcSkip);
        }
    }
    // eg.a([I[BIIIIIII)V
    private blitMono(pixels: Int32Array | null, data: Int8Array | null, colour: number, src: number, dst: number, width: number, height: number, dstSkip: number, srcSkip: number): void {
        for (let row = -height | 0; row < 0; row++) {
            for (let group = -(width >> 2); group < 0; group++) {
                if (arrayAtI8(data, src++) !== 0 && !Pix2D.spanTarget?.paintPixel(pixels, dst, colour)) arrayPutI32(pixels, dst, colour);
                dst = (dst + 1) | 0;
                if (arrayAtI8(data, src++) !== 0 && !Pix2D.spanTarget?.paintPixel(pixels, dst, colour)) arrayPutI32(pixels, dst, colour);
                dst = (dst + 1) | 0;
                if (arrayAtI8(data, src++) !== 0 && !Pix2D.spanTarget?.paintPixel(pixels, dst, colour)) arrayPutI32(pixels, dst, colour);
                dst = (dst + 1) | 0;
                if (arrayAtI8(data, src++) !== 0 && !Pix2D.spanTarget?.paintPixel(pixels, dst, colour)) arrayPutI32(pixels, dst, colour);
                dst = (dst + 1) | 0;
            }
            for (let tail = -(width & 3); tail < 0; tail++) {
                if (arrayAtI8(data, src++) !== 0 && !Pix2D.spanTarget?.paintPixel(pixels, dst, colour)) arrayPutI32(pixels, dst, colour);
                dst = (dst + 1) | 0;
            }
            dst = (dst + dstSkip) | 0;
            src = (src + srcSkip) | 0;
        }
    }
    // eg.b([I[BIIIIIII)V
    private blitAlpha(pixels: Int32Array | null, data: Int8Array | null, colour: number, src: number, dst: number, width: number, height: number, dstSkip: number, srcSkip: number): void {
        for (let row = -height | 0; row < 0; row++) {
            for (let col = -width | 0; col < 0; col++) {
                const alpha = arrayAtI8(data, src++) & 255;
                if (alpha > 30 && !Pix2D.spanTarget?.paintPixel(pixels, dst, colour, alpha >= 230 ? 256 : alpha)) {
                    if (alpha >= 230) arrayPutI32(pixels, dst, colour);
                    else {
                        const old = arrayAtI32(pixels, dst),
                            inverse = 256 - alpha;
                        const rb = (Math.imul(colour & 0xff00ff, alpha) + Math.imul(old & 0xff00ff, inverse)) & 0xff00ff00;
                        const g = (Math.imul(colour & 0xff00, alpha) + Math.imul(old & 0xff00, inverse)) & 0xff0000;
                        arrayPutI32(pixels, dst, (rb + g) >> 8);
                    }
                }
                dst = (dst + 1) | 0;
            }
            dst = (dst + dstSkip) | 0;
            src = (src + srcSkip) | 0;
        }
    }
    // eg.c()V
    static unload(): void {
        WorldMapFont.charset = null;
        WorldMapFont.glyphOffsets = null;
    }
}
