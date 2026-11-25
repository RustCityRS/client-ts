import { requireNonNull } from '#/util/JavaArray';
import { unzlibSync } from 'fflate';
import { progressFontCells } from './ProgressFontAtlas';

// The subset of java.awt.Canvas, Image, Graphics and FontMetrics used before the client fonts load.
export interface ProgressFont {
    family: string;
    bold: boolean;
    size: number;
}
export interface ProgressFontMetrics {
    stringWidth(text: string): number;
}
export interface ProgressImage {
    getGraphics(): ProgressGraphics;
}
export interface ProgressGraphics {
    setColor(rgb: number): void;
    drawRect(x: number, y: number, width: number, height: number): void;
    fillRect(x: number, y: number, width: number, height: number): void;
    setFont(font: ProgressFont): void;
    drawString(text: string, x: number, y: number): void;
    drawImage(image: ProgressImage, x: number, y: number): void;
}
export interface ProgressCanvas extends ProgressImage {
    getFontMetrics(font: ProgressFont): ProgressFontMetrics;
    createImage(width: number, height: number): ProgressImage | null;
    repaint(): void;
}

function cssFont(font: ProgressFont): string {
    return (font.bold ? 'bold ' : '') + font.size + 'px ' + font.family + ', Arial, sans-serif';
}

interface Glyph {
    advance: number;
    // x, y and width of each opaque horizontal span, relative to the AWT baseline.
    spans: number[];
}
let glyphs: Glyph[] | null = null;

function awtGlyphs(font: ProgressFont): Glyph[] | null {
    if (font.family !== 'Helvetica' || !font.bold || font.size !== 13) return null;
    if (glyphs !== null) return glyphs;
    const data = unzlibSync(Uint8Array.from(atob(progressFontCells), c => c.charCodeAt(0)));
    glyphs = [];
    let pos = 0;
    for (let code = 0; code < 256; code++) {
        const advance = data[pos++];
        const left = (data[pos++] << 24) >> 24,
            top = (data[pos++] << 24) >> 24;
        const width = data[pos++],
            height = data[pos++];
        const spans: number[] = [];
        for (let row = 0; row < height; row++) {
            const mask = (data[pos++] << 8) | data[pos++];
            let x = 0;
            while (x < width) {
                if ((mask & (1 << x)) === 0) {
                    x++;
                    continue;
                }
                const start = x++;
                while (x < width && (mask & (1 << x)) !== 0) x++;
                spans.push(left + start, top + row, x - start);
            }
        }
        glyphs.push({ advance, spans });
    }
    return glyphs;
}

class CanvasImage implements ProgressImage {
    constructor(readonly canvas: HTMLCanvasElement) {}

    getGraphics(): ProgressGraphics {
        const ctx = requireNonNull(this.canvas.getContext('2d'));
        let colour = '#000000',
            font = '',
            cells: Glyph[] | null = null;
        return {
            setColor(rgb) {
                colour = '#' + (rgb & 0xffffff).toString(16).padStart(6, '0');
            },
            drawRect(x, y, w, h) {
                ctx.fillStyle = colour;
                ctx.fillRect(x, y, w + 1, 1);
                ctx.fillRect(x, y + 1, 1, h);
                ctx.fillRect(x + 1, y + h, w, 1);
                ctx.fillRect(x + w, y + 1, 1, h - 1);
            },
            fillRect(x, y, w, h) {
                if (w <= 0 || h <= 0) return;
                ctx.fillStyle = colour;
                ctx.fillRect(x, y, w, h);
            },
            setFont(value) {
                cells = awtGlyphs(value);
                font = cssFont(value);
            },
            drawString(text, x, y) {
                ctx.fillStyle = colour;
                if (cells !== null) {
                    // JagString supplies ISO-8859-1 code units, as in java.awt.Graphics.drawString.
                    for (let i = 0; i < text.length; i++) {
                        const { advance, spans } = cells[text.charCodeAt(i)];
                        for (let j = 0; j < spans.length; j += 3) ctx.fillRect(x + spans[j], y + spans[j + 1], spans[j + 2], 1);
                        x += advance;
                    }
                    return;
                }
                ctx.font = font;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
                ctx.fillText(text, x, y);
            },
            drawImage(image, x, y) {
                ctx.drawImage((image as CanvasImage).canvas, x, y);
            }
        };
    }
}

export class BrowserProgressCanvas extends CanvasImage implements ProgressCanvas {
    constructor(
        canvas: HTMLCanvasElement,
        readonly repaint: () => void
    ) {
        super(canvas);
    }

    getFontMetrics(font: ProgressFont): ProgressFontMetrics {
        const cells = awtGlyphs(font);
        if (cells !== null)
            return {
                stringWidth(text) {
                    let width = 0;
                    for (let i = 0; i < text.length; i++) width = (width + cells[text.charCodeAt(i)].advance) | 0;
                    return width;
                }
            };
        const ctx = requireNonNull(this.canvas.getContext('2d'));
        const style = cssFont(font);
        return {
            stringWidth(text) {
                ctx.save();
                ctx.font = style;
                const width = Math.round(ctx.measureText(text).width) | 0;
                ctx.restore();
                return width;
            }
        };
    }

    createImage(width: number, height: number): ProgressImage {
        const image = this.canvas.ownerDocument.createElement('canvas');
        image.width = width;
        image.height = height;
        // Component.createImage(w,h) creates an opaque image in the component's colour model.
        const ctx = requireNonNull(image.getContext('2d'));
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        return new CanvasImage(image);
    }
}
