import { inflateSync } from 'fflate';
import { requireNonNull } from '#/util/JavaArray';
import { worldMapFontCells } from './WorldMapFontAtlas';

export const mapFontCharacters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"£$%^&*()-_=+[{]};:\'@#~,<.>/?\\| ÄËÏÖÜäëïöüÿßÁÀÉÈÍÌÓÒÚÙáàéèíìóòúùÂÊÎÔÛâêîôûÆæ';

export interface MapAwtFont {
    family: 'Helvetica';
    size: number;
    bold: boolean;
}
export interface MapFontMetrics {
    charWidth(letter: string): number;
    getMaxAscent(): number;
    getMaxDescent(): number;
    getHeight(): number;
}
export interface MapFontImage {
    getGraphics(): {
        setColor(rgb: number): void;
        fillRect(x: number, y: number, width: number, height: number): void;
        setFont(font: MapAwtFont): void;
        drawString(letter: string, x: number, y: number): void;
    };
    createPixelGrabber(target: Int32Array): { grabPixels(): void };
    flush(): void;
}
export interface MapFontSurface {
    getFontMetrics(font: MapAwtFont): MapFontMetrics;
    createImage(width: number, height: number): MapFontImage | null;
}

interface Cell {
    advance: number;
    single: Uint8Array;
    double: Uint8Array;
}
interface Face {
    ascent: number;
    descent: number;
    height: number;
    cells: Map<string, Cell>;
}
// eg / fd keep only their packed glyphs. The AWT font is local to the constructor.
const faces = new WeakMap<MapAwtFont, Face>();

function face(font: MapAwtFont): Face {
    const cached = faces.get(font);
    if (cached) return cached;
    const packed = worldMapFontCells[font.size * 2 + Number(font.bold)];
    if (packed === undefined) throw new RangeError('No AWT glyph samples for Helvetica ' + font.size);
    const bytes = inflateSync(Uint8Array.from(atob(packed), ch => ch.charCodeAt(0)));
    const result: Face = { ascent: bytes[0], descent: bytes[1], height: bytes[2], cells: new Map() };
    let pos = 3;
    for (const letter of mapFontCharacters) {
        const advance = bytes[pos++],
            length = (advance + 1) * (result.ascent + result.descent);
        result.cells.set(letter, { advance, single: bytes.subarray(pos, pos + length), double: bytes.subarray(pos + length, pos + 2 * length) });
        pos += length * 2;
    }
    faces.set(font, result);
    return result;
}

// Component.getFontMetrics, offscreen Graphics.drawString and PixelGrabber are native AWT operations.
// Use the sampled Windows AWT cells so browser font selection, hinting and antialiasing cannot change the map.
export const mapFontSurface: MapFontSurface = {
    getFontMetrics(font) {
        const f = face(font);
        return { charWidth: letter => requireNonNull(f.cells.get(letter)).advance, getMaxAscent: () => f.ascent, getMaxDescent: () => f.descent, getHeight: () => f.height };
    },
    createImage(width, height) {
        let selected: MapAwtFont | null = null;
        const pixels = new Int32Array(width * height);
        return {
            getGraphics() {
                let colour = 0;
                return {
                    setColor(rgb) {
                        colour = rgb;
                    },
                    fillRect(x, y, w, h) {
                        for (let row = y; row < y + h; row++) pixels.fill(colour, row * width + x, row * width + x + w);
                    },
                    setFont(font) {
                        selected = font;
                    },
                    drawString(letter, x, baseline) {
                        const f = face(requireNonNull(selected)),
                            cell = requireNonNull(f.cells.get(letter));
                        const mask = x === 1 ? cell.double : cell.single;
                        for (let row = 0; row < height; row++)
                            for (let col = 0; col < width; col++) {
                                const coverage = mask[(row - baseline + f.ascent) * (cell.advance + 1) + col];
                                pixels[row * width + col] = coverage * 0x010101;
                            }
                    }
                };
            },
            createPixelGrabber(target) {
                return {
                    grabPixels() {
                        target.set(pixels);
                    }
                };
            },
            flush() {}
        };
    }
};

export function fontSurface(component: object | null): MapFontSurface {
    const canvas = requireNonNull(component);
    return 'getFontMetrics' in canvas ? (canvas as MapFontSurface) : mapFontSurface;
}
