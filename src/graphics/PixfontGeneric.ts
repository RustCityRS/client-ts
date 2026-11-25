import JagString, { fromLiteral } from '#/datastruct/JagString';
import SecondaryNode from '#/datastruct/SecondaryNode';
import { byteAt, putByte } from '#/io/JavaByteArray';
import { JavaError } from '#/util/ClientError';
import { arrayAtI32, arrayAtObj, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import type JavaRandom from '#/util/JavaRandom';
import { glJar } from '#/client/ClientVariant';
import type AbstractIndexedSprite from './AbstractIndexedSprite';
import Pix2D from './Pix2D';
import { loadGlRaster, loadGlRenderer } from '#/util/GamepackClasses';

// tf.w (GlRenderer.active). Only the GL gamepack has the flag; with the software gamepack (glJar false) the GL modules
// are never loaded. GlRenderer and GlRaster are required lazily, as in SpriteLoader, so the SD path never loads them.
function glActive(): boolean {
    return glJar && loadGlRenderer().active;
}

function glRaster(): typeof import('#/gl/GlRaster').default {
    return loadGlRaster();
}

// SD mb / HD rk: the abstract font (NXT pixfont_generic.h). The software subclass is SD fg / HD dd (SoftwareFont); the
// HD jar adds the GL subclass mb (gl/GlFont.ts), chosen by ce.a(I[B)Lrk; while tf.w is set. rk reads tf.w only at the
// strike and underline lines of the two tagged-draw loops, which it draws with GlRaster.hline (dj.a(IIII)V) while
// tf.w is set and with Pix2D.hline (kb.a(IIII)V) otherwise, so with tf.w false the class runs the SD bodies.
// HD names: fields I widths, J paddingBottom, S xOffsets, U heights, V paddingTop, W iconHeights, ab lineHeight,
// db yOffsets, gb kerning, jb advances, nb icons; the tag strings and draw-state statics keep their roles under other
// letters, and the HD <clinit> creates the tag strings in another order (no observable difference).
export default abstract class PixfontGeneric extends SecondaryNode {
    // ag.k:[Lsi;
    static nameIcons: (AbstractIndexedSprite | null)[] | null = null;

    // Static initializer order of mb.<clinit>()V.
    // mb.A:Lid;
    static entityReg: JagString | null = fromLiteral('reg');
    // mb.O:Lid;
    static entityTimes: JagString | null = fromLiteral('times');
    // mb.N:Lid;
    static entityGt: JagString | null = fromLiteral('gt');
    // mb.U:Lid;
    static entityEuro: JagString | null = fromLiteral('euro');
    // mb.T:Lid;
    static entityShy: JagString | null = fromLiteral('shy');
    // mb.V:Lid;
    static entityLt: JagString | null = fromLiteral('lt');
    // mb.D:Lid;
    static tagBreak: JagString | null = fromLiteral('br');
    // mb.Q:Lid;
    static tagColour: JagString | null = fromLiteral('col=');
    // mb.E:Lid;
    static tagColourEnd: JagString | null = fromLiteral(')4col');
    // mb.G:Lid;
    static tagShadow: JagString | null = fromLiteral('shad=');
    // mb.W:Lid;
    static entityNbsp: JagString | null = fromLiteral('nbsp');
    // mb.B:Lid;
    static tagUnderlineEnd: JagString | null = fromLiteral(')4u');
    // mb.S:Lid;
    static tagUnderline: JagString | null = fromLiteral('u=');
    // mb.J:Lid;
    static tagStrike: JagString | null = fromLiteral('str=');
    // mb.gb:Lid;
    static escapedGt: JagString | null = fromLiteral('<gt>');
    // mb.fb:Lid;
    static tagTransEnd: JagString | null = fromLiteral(')4trans');
    // mb.db:Lid;
    static tagStrikeDefault: JagString | null = fromLiteral('str');
    // mb.eb:Lid;
    static escapedLt: JagString | null = fromLiteral('<lt>');
    // mb.Z:Lid;
    static tagImage: JagString | null = fromLiteral('img=');
    // mb.ab:Lid;
    static tagTrans: JagString | null = fromLiteral('trans=');
    // mb.I:Lid;
    static tagUnderlineDefault: JagString | null = fromLiteral('u');
    // mb.X:Lid;
    static tagShadowDefault: JagString | null = fromLiteral('shad');
    // mb.F:Lid;
    static tagStrikeEnd: JagString | null = fromLiteral(')4str');
    // mb.jb:Lid;
    static tagShadowEnd: JagString | null = fromLiteral(')4shad');
    // mb.kb:Lid;
    static entityCopy: JagString | null = fromLiteral('copy');
    // mb.L:Lid;
    static splitBuffer: JagString | null = JagString.allocate(100);
    // mb.mb:I
    static defaultAlpha = 256;
    // mb.lb:I
    static colour = 0;
    // mb.nb:I
    static justifySpacing = 0;
    // mb.pb:I
    static strikeColour = -1;
    // mb.tb:I
    static defaultColour = 0;
    // mb.ob:I
    static alpha = 256;
    // mb.rb:I
    static defaultShadowColour = -1;
    // mb.ub:I
    static justifyRemainder = 0;
    // mb.sb:I
    static underlineColour = -1;
    // mb.vb:[Lid;
    static splitLines: (JagString | null)[] | null = new Array<JagString | null>(100).fill(null);
    // mb.qb:I
    static shadowColour = -1;

    // mb.C:I
    lineHeight = 0;
    // SD mb.H:[I / HD rk.U:[I (package access: HD mb reads it)
    glyphHeights: Int32Array | null = null;
    // mb.K:[I
    private glyphYOffsets: Int32Array | null = null;
    // mb.M:[I
    private iconHeights: Int32Array | null = null;
    // mb.P:[I
    private glyphXOffsets: Int32Array | null = null;
    // mb.R:[B
    private kerning: Uint8Array | null = null;
    // mb.Y:[I
    private glyphAdvances: Int32Array | null = null;
    // mb.bb:I
    private paddingBottom = 0;
    // SD mb.cb:[I / HD rk.I:[I (package access: HD mb reads it)
    glyphWidths: Int32Array | null = null;
    // mb.hb:I
    private paddingTop = 0;
    // mb.ib:[Lsi;
    private icons: (AbstractIndexedSprite | null)[] | null = null;

    // mb.<init>([B[I[I[I[I)V
    constructor(data: Uint8Array | null, xOffsets: Int32Array | null, yOffsets: Int32Array | null, widths: Int32Array | null, heights: Int32Array | null);
    // mb.<init>([B)V
    constructor(data: Uint8Array | null);
    constructor(data: Uint8Array | null, xOffsets?: Int32Array | null, yOffsets?: Int32Array | null, widths?: Int32Array | null, heights?: Int32Array | null) {
        super();
        if (xOffsets === undefined || yOffsets === undefined || widths === undefined || heights === undefined) {
            // mb.<init>([B)V
            this.decodeMetrics(data);
            return;
        }

        // mb.<init>([B[I[I[I[I)V
        this.glyphXOffsets = xOffsets;
        this.glyphYOffsets = yOffsets;
        this.glyphWidths = widths;
        this.glyphHeights = heights;
        this.decodeMetrics(data);
        let minY = 2147483647;
        let maxY = -2147483648;

        for (let i = 0; i < 256; i++) {
            if (arrayAtI32(this.glyphYOffsets, i) < minY && arrayAtI32(this.glyphHeights, i) !== 0) {
                minY = arrayAtI32(this.glyphYOffsets, i);
            }

            if (((arrayAtI32(this.glyphYOffsets, i) + arrayAtI32(this.glyphHeights, i)) | 0) > maxY) {
                maxY = (arrayAtI32(this.glyphYOffsets, i) + arrayAtI32(this.glyphHeights, i)) | 0;
            }
        }

        this.paddingTop = (this.lineHeight - minY) | 0;
        this.paddingBottom = (maxY - this.lineHeight) | 0;
    }

    // mb.a(Lid;I)I
    getParagraphLineCount(text: JagString | null, width: number): number {
        return this.splitParagraph(text, Int32Array.of(width), requireNonNull(PixfontGeneric.splitLines));
    }

    // mb.a([Lsi;[I)V
    setNameIcons(icons: (AbstractIndexedSprite | null)[] | null, heights: Int32Array | null): void {
        if (heights !== null && heights.length !== requireNonNull(icons).length) {
            throw new Error('IllegalArgumentException');
        }

        this.icons = icons;
        this.iconHeights = heights;
    }

    // SD mb.a(IIIIIIIZ)V / HD rk.a(IIIIIIIZ)V
    abstract drawGlyphAlpha(c: number, x: number, y: number, width: number, height: number, colour: number, alpha: number, shadow: boolean): void;

    // mb.b(Lid;I)I
    getParagraphWidth(text: JagString | null, width: number): number {
        const count = this.splitParagraph(text, Int32Array.of(width), requireNonNull(PixfontGeneric.splitLines));
        let max = 0;

        for (let i = 0; i < count; i++) {
            const lineWidth = this.stringWidth(arrayAtObj(requireNonNull(PixfontGeneric.splitLines), i));
            if (lineWidth > max) {
                max = lineWidth;
            }
        }

        return max;
    }

    // mb.a(Lid;IIIIIIIII)I
    drawParagraph(text: JagString | null, x: number, y: number, width: number, height: number, colour: number, shadow: number, alignX: number, alignY: number, lineHeight: number): number {
        return this.drawParagraphAlpha(text, x, y, width, height, colour, shadow, 256, alignX, alignY, lineHeight);
    }

    // mb.a(III)V
    private setDrawStateAlpha(colour: number, shadow: number, alpha: number): void {
        PixfontGeneric.strikeColour = -1;
        PixfontGeneric.underlineColour = -1;
        PixfontGeneric.defaultShadowColour = shadow;
        PixfontGeneric.shadowColour = shadow;
        PixfontGeneric.defaultColour = colour;
        PixfontGeneric.colour = colour;
        PixfontGeneric.defaultAlpha = alpha;
        PixfontGeneric.alpha = alpha;
        PixfontGeneric.justifySpacing = 0;
        PixfontGeneric.justifyRemainder = 0;
    }

    // mb.a(Lid;IIIII)V
    drawCentredWave2(text: JagString | null, x: number, y: number, colour: number, shadow: number, cycle: number): void {
        if (text === null) {
            return;
        }

        this.setDrawState(colour, shadow);
        const length = text.getLength();
        const xOffsets = new Int32Array(length);
        const yOffsets = new Int32Array(length);

        for (let i = 0; i < length; i++) {
            xOffsets[i] = (Math.sin(i / 5.0 + cycle / 5.0) * 5.0) | 0;
            yOffsets[i] = (Math.sin(i / 3.0 + cycle / 5.0) * 5.0) | 0;
        }

        this.drawTaggedOffsets(text, (x - ((this.stringWidth(text) / 2) | 0)) | 0, y, xOffsets, yOffsets);
    }

    // mb.a(Lid;IIII)V
    drawCentred(text: JagString | null, x: number, y: number, colour: number, shadow: number): void {
        if (text === null) {
            return;
        }

        this.setDrawState(colour, shadow);
        this.drawTagged(text, (x - ((this.stringWidth(text) / 2) | 0)) | 0, y);
    }

    // mb.a(Lid;)V
    private parseTag(tag: JagString): void {
        try {
            if (tag.startsWith(requireNonNull(PixfontGeneric.tagColour))) {
                PixfontGeneric.colour = tag.substringFrom(4).parseInt(16);
                return;
            }

            if (tag.equals(requireNonNull(PixfontGeneric.tagColourEnd))) {
                PixfontGeneric.colour = PixfontGeneric.defaultColour;
                return;
            }

            if (tag.startsWith(requireNonNull(PixfontGeneric.tagTrans))) {
                PixfontGeneric.alpha = tag.substringFrom(6).decimal();
                return;
            }

            if (tag.equals(requireNonNull(PixfontGeneric.tagTransEnd))) {
                PixfontGeneric.alpha = PixfontGeneric.defaultAlpha;
                return;
            }

            if (tag.startsWith(requireNonNull(PixfontGeneric.tagStrike))) {
                PixfontGeneric.strikeColour = tag.substringFrom(4).parseInt(16);
                return;
            }

            if (tag.equals(requireNonNull(PixfontGeneric.tagStrikeDefault))) {
                PixfontGeneric.strikeColour = 8388608;
                return;
            }

            if (tag.equals(requireNonNull(PixfontGeneric.tagStrikeEnd))) {
                PixfontGeneric.strikeColour = -1;
                return;
            }

            if (tag.startsWith(requireNonNull(PixfontGeneric.tagUnderline))) {
                PixfontGeneric.underlineColour = tag.substringFrom(2).parseInt(16);
                return;
            }

            if (tag.equals(requireNonNull(PixfontGeneric.tagUnderlineDefault))) {
                PixfontGeneric.underlineColour = 0;
                return;
            }

            if (tag.equals(requireNonNull(PixfontGeneric.tagUnderlineEnd))) {
                PixfontGeneric.underlineColour = -1;
                return;
            }

            if (tag.startsWith(requireNonNull(PixfontGeneric.tagShadow))) {
                PixfontGeneric.shadowColour = tag.substringFrom(5).parseInt(16);
                return;
            }

            if (tag.equals(requireNonNull(PixfontGeneric.tagShadowDefault))) {
                PixfontGeneric.shadowColour = 0;
                return;
            }

            if (tag.equals(requireNonNull(PixfontGeneric.tagShadowEnd))) {
                PixfontGeneric.shadowColour = PixfontGeneric.defaultShadowColour;
                return;
            }

            if (tag.equals(requireNonNull(PixfontGeneric.tagBreak))) {
                this.setDrawStateAlpha(PixfontGeneric.defaultColour, PixfontGeneric.defaultShadowColour, PixfontGeneric.defaultAlpha);
                return;
            }
        } catch (error) {
            // catch (Exception)
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
        }
    }

    // mb.a(Lid;IIIIII)V
    drawCentredShake(text: JagString | null, x: number, y: number, colour: number, shadow: number, cycle: number, shakeCycle: number): void {
        if (text === null) {
            return;
        }

        this.setDrawState(colour, shadow);
        let amplitude = 7.0 - shakeCycle / 8.0;
        if (amplitude < 0.0) {
            amplitude = 0.0;
        }

        const length = text.getLength();
        const yOffsets = new Int32Array(length);

        for (let i = 0; i < length; i++) {
            yOffsets[i] = (Math.sin(i / 1.5 + cycle) * amplitude) | 0;
        }

        this.drawTaggedOffsets(text, (x - ((this.stringWidth(text) / 2) | 0)) | 0, y, null, yOffsets);
    }

    // mb.a(Lid;[I[Lid;)I
    splitParagraph(text: JagString | null, widths: Int32Array | null, lines: (JagString | null)[] | null): number {
        if (text === null) {
            return 0;
        }

        requireNonNull(PixfontGeneric.splitBuffer).setLength(0);
        let width = 0;
        let start = 0;
        let breakIndex = -1;
        let breakWidth = 0;
        let breakSkip = 0;
        let tagStart = -1;
        let prev = 0;
        let count = 0;
        const length = text.getLength();

        for (let i = 0; i < length; i++) {
            let c = text.charAt(i);
            if (c === 60) {
                tagStart = i;
                continue;
            }

            if (c === 62 && tagStart !== -1) {
                const tag = text.substring((tagStart + 1) | 0, i);
                tagStart = -1;
                requireNonNull(PixfontGeneric.splitBuffer).appendChar(60, 111);
                requireNonNull(PixfontGeneric.splitBuffer).append(tag);
                requireNonNull(PixfontGeneric.splitBuffer).appendChar(62, 112);
                if (tag.equals(requireNonNull(PixfontGeneric.tagBreak))) {
                    if (arrayAtObj(lines, count) !== null) {
                        requireNonNull(arrayAtObj(lines, count)).setLength(0);
                        requireNonNull(arrayAtObj(lines, count)).appendRange(start, requireNonNull(PixfontGeneric.splitBuffer), requireNonNull(PixfontGeneric.splitBuffer).getLength());
                    } else {
                        arrayPutObj(lines, count, requireNonNull(PixfontGeneric.splitBuffer).asString().substring(start, requireNonNull(PixfontGeneric.splitBuffer).getLength()));
                    }

                    count++;
                    start = requireNonNull(PixfontGeneric.splitBuffer).getLength();
                    width = 0;
                    breakIndex = -1;
                    prev = 0;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityLt))) {
                    width = (width + this.charAdvance(60)) | 0;
                    if (this.kerning !== null && prev !== 0) {
                        width = (width + ((this.kerning[(prev << 8) + 60] << 24) >> 24)) | 0;
                    }

                    prev = 60;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityGt))) {
                    width = (width + this.charAdvance(62)) | 0;
                    if (this.kerning !== null && prev !== 0) {
                        width = (width + ((this.kerning[(prev << 8) + 62] << 24) >> 24)) | 0;
                    }

                    prev = 62;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityNbsp))) {
                    width = (width + this.charAdvance(160)) | 0;
                    if (this.kerning !== null && prev !== 0) {
                        width = (width + ((this.kerning[(prev << 8) + 160] << 24) >> 24)) | 0;
                    }

                    prev = 160;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityShy))) {
                    width = (width + this.charAdvance(173)) | 0;
                    if (this.kerning !== null && prev !== 0) {
                        width = (width + ((this.kerning[(prev << 8) + 173] << 24) >> 24)) | 0;
                    }

                    prev = 173;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityTimes))) {
                    width = (width + this.charAdvance(215)) | 0;
                    if (this.kerning !== null && prev !== 0) {
                        width = (width + ((this.kerning[(prev << 8) + 215] << 24) >> 24)) | 0;
                    }

                    prev = 215;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityEuro))) {
                    width = (width + this.charAdvance(128)) | 0;
                    if (this.kerning !== null && prev !== 0) {
                        width = (width + ((this.kerning[(prev << 8) + 128] << 24) >> 24)) | 0;
                    }

                    prev = 128;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityCopy))) {
                    width = (width + this.charAdvance(169)) | 0;
                    if (this.kerning !== null && prev !== 0) {
                        width = (width + ((this.kerning[(prev << 8) + 169] << 24) >> 24)) | 0;
                    }

                    prev = 169;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityReg))) {
                    width = (width + this.charAdvance(174)) | 0;
                    if (this.kerning !== null && prev !== 0) {
                        width = (width + ((this.kerning[(prev << 8) + 174] << 24) >> 24)) | 0;
                    }

                    prev = 174;
                } else if (tag.startsWith(requireNonNull(PixfontGeneric.tagImage))) {
                    try {
                        const icon = tag.substringFrom(4).decimal();
                        width = (width + requireNonNull(arrayAtObj(this.icons, icon)).cropW) | 0;
                        prev = 0;
                    } catch (error) {
                        // catch (Exception)
                        if (!(error instanceof Error) || error instanceof JavaError) throw error;
                    }
                }

                c = 0;
            }

            if (tagStart === -1) {
                if (c !== 0) {
                    requireNonNull(PixfontGeneric.splitBuffer).appendChar(c, 127);
                    width = (width + arrayAtI32(this.glyphAdvances, c)) | 0;
                    if (this.kerning !== null && prev !== 0) {
                        width = (width + ((this.kerning[(prev << 8) + c] << 24) >> 24)) | 0;
                    }

                    prev = c;
                }

                if (c === 32) {
                    breakIndex = requireNonNull(PixfontGeneric.splitBuffer).getLength();
                    breakWidth = width;
                    breakSkip = 1;
                }

                if (widths !== null && width > arrayAtI32(widths, count < widths.length ? count : widths.length - 1) && breakIndex >= 0) {
                    if (arrayAtObj(lines, count) !== null) {
                        requireNonNull(arrayAtObj(lines, count)).setLength(0);
                        arrayPutObj(lines, count, requireNonNull(arrayAtObj(lines, count)).appendRange(start, requireNonNull(PixfontGeneric.splitBuffer), (breakIndex - breakSkip) | 0));
                    } else {
                        arrayPutObj(
                            lines,
                            count,
                            requireNonNull(PixfontGeneric.splitBuffer)
                                .asString()
                                .substring(start, (breakIndex - breakSkip) | 0)
                        );
                    }

                    count++;
                    start = breakIndex;
                    breakIndex = -1;
                    width = (width - breakWidth) | 0;
                    prev = 0;
                }

                if (c === 45) {
                    breakIndex = requireNonNull(PixfontGeneric.splitBuffer).getLength();
                    breakWidth = width;
                    breakSkip = 0;
                }
            }
        }

        if (requireNonNull(PixfontGeneric.splitBuffer).getLength() > start) {
            if (arrayAtObj(lines, count) !== null) {
                requireNonNull(arrayAtObj(lines, count)).setLength(0);
                arrayPutObj(lines, count, requireNonNull(arrayAtObj(lines, count)).appendRange(start, requireNonNull(PixfontGeneric.splitBuffer), requireNonNull(PixfontGeneric.splitBuffer).getLength()));
            } else {
                arrayPutObj(lines, count, requireNonNull(PixfontGeneric.splitBuffer).asString().substring(start, requireNonNull(PixfontGeneric.splitBuffer).getLength()));
            }

            count++;
        }

        return count;
    }

    // mb.b(Lid;IIIII)V
    drawCentredWave(text: JagString | null, x: number, y: number, colour: number, shadow: number, cycle: number): void {
        if (text === null) {
            return;
        }

        this.setDrawState(colour, shadow);
        const length = text.getLength();
        const yOffsets = new Int32Array(length);

        for (let i = 0; i < length; i++) {
            yOffsets[i] = (Math.sin(i / 2.0 + cycle / 5.0) * 5.0) | 0;
        }

        this.drawTaggedOffsets(text, (x - ((this.stringWidth(text) / 2) | 0)) | 0, y, null, yOffsets);
    }

    // mb.b(Lid;)I
    stringWidth(text: JagString | null): number {
        if (text === null) {
            return 0;
        }

        let tagStart = -1;
        let prev = 0;
        let width = 0;
        const length = text.getLength();

        for (let i = 0; i < length; i++) {
            let c = text.charAt(i);
            if (c === 60) {
                tagStart = i;
                continue;
            }

            if (c === 62 && tagStart !== -1) {
                const tag = text.substring((tagStart + 1) | 0, i);
                tagStart = -1;
                if (tag.equals(requireNonNull(PixfontGeneric.entityLt))) {
                    c = 60;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityGt))) {
                    c = 62;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityNbsp))) {
                    c = 160;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityShy))) {
                    c = 173;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityTimes))) {
                    c = 215;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityEuro))) {
                    c = 128;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityCopy))) {
                    c = 169;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityReg))) {
                    c = 174;
                } else {
                    if (tag.startsWith(requireNonNull(PixfontGeneric.tagImage))) {
                        try {
                            const icon = tag.substringFrom(4).decimal();
                            width = (width + requireNonNull(arrayAtObj(this.icons, icon)).cropW) | 0;
                            prev = 0;
                        } catch (error) {
                            // catch (Exception)
                            if (!(error instanceof Error) || error instanceof JavaError) throw error;
                        }
                    }

                    continue;
                }
            }

            if (tagStart === -1) {
                width = (width + arrayAtI32(this.glyphAdvances, c)) | 0;
                if (this.kerning !== null && prev !== 0) {
                    width = (width + ((this.kerning[(prev << 8) + c] << 24) >> 24)) | 0;
                }

                prev = c;
            }
        }

        return width;
    }

    // mb.a(Lid;IIIILjava/util/Random;I)I
    drawRandom(text: JagString | null, x: number, y: number, colour: number, shadow: number, random: JavaRandom | null, seed: number): number {
        if (text === null) {
            return 0;
        }

        const rng = requireNonNull(random);
        rng.setSeed(BigInt(seed));
        this.setDrawStateAlpha(colour, shadow, (192 + (rng.nextInt() & 31)) | 0);
        const length = text.getLength();
        const xOffsets = new Int32Array(length);
        let total = 0;

        for (let i = 0; i < length; i++) {
            xOffsets[i] = total;
            if ((rng.nextInt() & 3) === 0) {
                total++;
            }
        }

        this.drawTaggedOffsets(text, x, y, xOffsets, null);
        return total;
    }

    // mb.a(Lid;IIIIIIIIII)I
    drawParagraphAlpha(text: JagString | null, x: number, y: number, width: number, height: number, colour: number, shadow: number, alpha: number, alignX: number, alignY: number, lineHeight: number): number {
        if (text === null) {
            return 0;
        }

        this.setDrawStateAlpha(colour, shadow, alpha);
        if (lineHeight === 0) {
            lineHeight = this.lineHeight;
        }

        let widths: Int32Array | null = Int32Array.of(width);
        if (height < ((this.paddingTop + this.paddingBottom + lineHeight) | 0) && height < ((lineHeight + lineHeight) | 0)) {
            widths = null;
        }

        const count = this.splitParagraph(text, widths, requireNonNull(PixfontGeneric.splitLines));
        if (alignY === 3 && count === 1) {
            alignY = 1;
        }

        let lineY: number;
        if (alignY === 0) {
            lineY = (y + this.paddingTop) | 0;
        } else if (alignY === 1) {
            lineY = (y + this.paddingTop + ((((height - this.paddingTop - this.paddingBottom - Math.imul(count - 1, lineHeight)) | 0) / 2) | 0)) | 0;
        } else if (alignY === 2) {
            lineY = (y + height - this.paddingBottom - Math.imul(count - 1, lineHeight)) | 0;
        } else {
            let spacing = (((height - this.paddingTop - this.paddingBottom - Math.imul(count - 1, lineHeight)) | 0) / ((count + 1) | 0)) | 0;
            if (spacing < 0) {
                spacing = 0;
            }

            lineY = (y + this.paddingTop + spacing) | 0;
            lineHeight = (lineHeight + spacing) | 0;
        }

        for (let i = 0; i < count; i++) {
            if (alignX === 0) {
                this.drawTagged(arrayAtObj(requireNonNull(PixfontGeneric.splitLines), i), x, lineY);
            } else if (alignX === 1) {
                this.drawTagged(arrayAtObj(requireNonNull(PixfontGeneric.splitLines), i), (x + ((((width - this.stringWidth(arrayAtObj(requireNonNull(PixfontGeneric.splitLines), i))) | 0) / 2) | 0)) | 0, lineY);
            } else if (alignX === 2) {
                this.drawTagged(arrayAtObj(requireNonNull(PixfontGeneric.splitLines), i), (x + width - this.stringWidth(arrayAtObj(requireNonNull(PixfontGeneric.splitLines), i))) | 0, lineY);
            } else if (i === count - 1) {
                this.drawTagged(arrayAtObj(requireNonNull(PixfontGeneric.splitLines), i), x, lineY);
            } else {
                this.calculateJustify(arrayAtObj(requireNonNull(PixfontGeneric.splitLines), i), width);
                this.drawTagged(arrayAtObj(requireNonNull(PixfontGeneric.splitLines), i), x, lineY);
                PixfontGeneric.justifySpacing = 0;
            }

            lineY = (lineY + lineHeight) | 0;
        }

        return count;
    }

    // SD mb.a(Lid;II)V / HD rk.a(Lna;II)V
    private drawTagged(text: JagString | null, x: number, y: number): void {
        y = (y - this.lineHeight) | 0;
        let tagStart = -1;
        let prev = 0;
        const str = requireNonNull(text);
        const length = str.getLength();

        for (let i = 0; i < length; i++) {
            let c = str.charAt(i);
            if (c === 60) {
                tagStart = i;
                continue;
            }

            if (c === 62 && tagStart !== -1) {
                const tag = str.substring((tagStart + 1) | 0, i);
                tagStart = -1;
                if (tag.equals(requireNonNull(PixfontGeneric.entityLt))) {
                    c = 60;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityGt))) {
                    c = 62;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityNbsp))) {
                    c = 160;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityShy))) {
                    c = 173;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityTimes))) {
                    c = 215;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityEuro))) {
                    c = 128;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityCopy))) {
                    c = 169;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityReg))) {
                    c = 174;
                } else {
                    if (tag.startsWith(requireNonNull(PixfontGeneric.tagImage))) {
                        try {
                            const icon = tag.substringFrom(4).decimal();
                            const sprite = arrayAtObj(this.icons, icon);
                            const iconHeight = this.iconHeights !== null ? arrayAtI32(this.iconHeights, icon) : requireNonNull(sprite).cropH;
                            if (PixfontGeneric.alpha === 256) {
                                requireNonNull(sprite).draw(x, (y + this.lineHeight - iconHeight) | 0);
                            } else {
                                requireNonNull(sprite).drawAlpha(x, (y + this.lineHeight - iconHeight) | 0, PixfontGeneric.alpha);
                            }

                            x = (x + requireNonNull(sprite).cropW) | 0;
                            prev = 0;
                        } catch (error) {
                            // catch (Exception)
                            if (!(error instanceof Error) || error instanceof JavaError) throw error;
                        }
                    } else {
                        this.parseTag(tag);
                    }

                    continue;
                }
            }

            if (tagStart === -1) {
                if (this.kerning !== null && prev !== 0) {
                    x = (x + ((this.kerning[(prev << 8) + c] << 24) >> 24)) | 0;
                }

                const glyphWidth = arrayAtI32(this.glyphWidths, c);
                const glyphHeight = arrayAtI32(this.glyphHeights, c);
                if (c !== 32) {
                    if (PixfontGeneric.alpha === 256) {
                        if (PixfontGeneric.shadowColour !== -1) {
                            this.drawGlyph(c, (x + arrayAtI32(this.glyphXOffsets, c) + 1) | 0, (y + arrayAtI32(this.glyphYOffsets, c) + 1) | 0, glyphWidth, glyphHeight, PixfontGeneric.shadowColour, true);
                        }

                        this.drawGlyph(c, (x + arrayAtI32(this.glyphXOffsets, c)) | 0, (y + arrayAtI32(this.glyphYOffsets, c)) | 0, glyphWidth, glyphHeight, PixfontGeneric.colour, false);
                    } else {
                        if (PixfontGeneric.shadowColour !== -1) {
                            this.drawGlyphAlpha(c, (x + arrayAtI32(this.glyphXOffsets, c) + 1) | 0, (y + arrayAtI32(this.glyphYOffsets, c) + 1) | 0, glyphWidth, glyphHeight, PixfontGeneric.shadowColour, PixfontGeneric.alpha, true);
                        }

                        this.drawGlyphAlpha(c, (x + arrayAtI32(this.glyphXOffsets, c)) | 0, (y + arrayAtI32(this.glyphYOffsets, c)) | 0, glyphWidth, glyphHeight, PixfontGeneric.colour, PixfontGeneric.alpha, false);
                    }
                } else if (PixfontGeneric.justifySpacing > 0) {
                    PixfontGeneric.justifyRemainder = (PixfontGeneric.justifyRemainder + PixfontGeneric.justifySpacing) | 0;
                    x = (x + (PixfontGeneric.justifyRemainder >> 8)) | 0;
                    PixfontGeneric.justifyRemainder &= 255;
                }

                const advance = arrayAtI32(this.glyphAdvances, c);
                if (PixfontGeneric.strikeColour !== -1) {
                    if (glActive()) {
                        glRaster().hline(x, (y + ((this.lineHeight * 0.7) | 0)) | 0, advance, PixfontGeneric.strikeColour);
                    } else {
                        Pix2D.hline(x, (y + ((this.lineHeight * 0.7) | 0)) | 0, advance, PixfontGeneric.strikeColour);
                    }
                }

                if (PixfontGeneric.underlineColour !== -1) {
                    if (glActive()) {
                        glRaster().hline(x, (y + this.lineHeight + 1) | 0, advance, PixfontGeneric.underlineColour);
                    } else {
                        Pix2D.hline(x, (y + this.lineHeight + 1) | 0, advance, PixfontGeneric.underlineColour);
                    }
                }

                x = (x + advance) | 0;
                prev = c;
            }
        }
    }

    // mb.a(II)V
    private setDrawState(colour: number, shadow: number): void {
        PixfontGeneric.strikeColour = -1;
        PixfontGeneric.underlineColour = -1;
        PixfontGeneric.defaultShadowColour = shadow;
        PixfontGeneric.shadowColour = shadow;
        PixfontGeneric.defaultColour = colour;
        PixfontGeneric.colour = colour;
        PixfontGeneric.defaultAlpha = 256;
        PixfontGeneric.alpha = 256;
        PixfontGeneric.justifySpacing = 0;
        PixfontGeneric.justifyRemainder = 0;
    }

    // mb.a()V. Applet-shutdown unload (client.a(Z)V): nulls mb's own tag strings, the split buffer (L) and the split
    // lines (vb) in the bytecode's store order; any later font use then throws where Java would NPE.
    static unload(): void {
        PixfontGeneric.entityLt = null;
        PixfontGeneric.entityGt = null;
        PixfontGeneric.entityNbsp = null;
        PixfontGeneric.entityShy = null;
        PixfontGeneric.entityTimes = null;
        PixfontGeneric.entityEuro = null;
        PixfontGeneric.entityCopy = null;
        PixfontGeneric.entityReg = null;
        PixfontGeneric.tagImage = null;
        PixfontGeneric.tagBreak = null;
        PixfontGeneric.escapedLt = null;
        PixfontGeneric.escapedGt = null;
        PixfontGeneric.tagColour = null;
        PixfontGeneric.tagColourEnd = null;
        PixfontGeneric.tagTrans = null;
        PixfontGeneric.tagTransEnd = null;
        PixfontGeneric.tagUnderline = null;
        PixfontGeneric.tagUnderlineDefault = null;
        PixfontGeneric.tagUnderlineEnd = null;
        PixfontGeneric.tagShadow = null;
        PixfontGeneric.tagShadowDefault = null;
        PixfontGeneric.tagShadowEnd = null;
        PixfontGeneric.tagStrike = null;
        PixfontGeneric.tagStrikeDefault = null;
        PixfontGeneric.tagStrikeEnd = null;
        PixfontGeneric.splitBuffer = null;
        PixfontGeneric.splitLines = null;
    }

    // mb.a(Lid;IIIIIIIILjava/util/Random;I[I)I
    drawRandomAligned(text: JagString | null, x: number, y: number, width: number, height: number, colour: number, shadow: number, alignX: number, alignY: number, random: JavaRandom | null, seed: number, bounds: Int32Array | null): number {
        if (text === null) {
            return 0;
        }

        const rng = requireNonNull(random);
        rng.setSeed(BigInt(seed));
        this.setDrawStateAlpha(colour, shadow, (192 + (rng.nextInt() & 31)) | 0);
        const length = text.getLength();
        const xOffsets = new Int32Array(length);
        let total = 0;

        for (let i = 0; i < length; i++) {
            xOffsets[i] = total;
            if ((rng.nextInt() & 3) === 0) {
                total++;
            }
        }

        let drawX = x;
        let drawY = (y + this.paddingTop) | 0;
        let textWidth = -1;
        if (alignY === 1) {
            drawY = (drawY + ((((height - this.paddingTop - this.paddingBottom) | 0) / 2) | 0)) | 0;
        } else if (alignY === 2) {
            drawY = (y + height - this.paddingBottom) | 0;
        }

        if (alignX === 1) {
            textWidth = (this.stringWidth(text) + total) | 0;
            drawX = (drawX + ((((width - textWidth) | 0) / 2) | 0)) | 0;
        } else if (alignX === 2) {
            textWidth = (this.stringWidth(text) + total) | 0;
            drawX = (drawX + ((width - textWidth) | 0)) | 0;
        }

        this.drawTaggedOffsets(text, drawX, drawY, xOffsets, null);
        if (bounds !== null) {
            if (textWidth === -1) {
                textWidth = (this.stringWidth(text) + total) | 0;
            }

            arrayPutI32(bounds, 0, drawX);
            arrayPutI32(bounds, 1, (drawY - this.paddingTop) | 0);
            arrayPutI32(bounds, 2, textWidth);
            arrayPutI32(bounds, 3, (this.paddingTop + this.paddingBottom) | 0);
        }

        return total;
    }

    // mb.b(Lid;IIII)V
    drawLeft(text: JagString | null, x: number, y: number, colour: number, shadow: number): void {
        if (text === null) {
            return;
        }

        this.setDrawState(colour, shadow);
        this.drawTagged(text, x, y);
    }

    // mb.c(I)I
    private charAdvance(c: number): number {
        return arrayAtI32(this.glyphAdvances, c & 255);
    }

    // mb.c(Lid;I)V
    private calculateJustify(text: JagString | null, width: number): void {
        let spaces = 0;
        let inTag = false;
        const str = requireNonNull(text);
        const length = str.getLength();

        for (let i = 0; i < length; i++) {
            const c = str.charAt(i);
            if (c === 60) {
                inTag = true;
            } else if (c === 62) {
                inTag = false;
            } else if (!inTag && c === 32) {
                spaces++;
            }
        }

        if (spaces > 0) {
            PixfontGeneric.justifySpacing = (((width - this.stringWidth(str)) << 8) / spaces) | 0;
        }
    }

    // mb.c(Lid;IIII)V
    drawRight(text: JagString | null, x: number, y: number, colour: number, shadow: number): void {
        if (text === null) {
            return;
        }

        this.setDrawState(colour, shadow);
        this.drawTagged(text, (x - this.stringWidth(text)) | 0, y);
    }

    // SD mb.a(IIIIIIZ)V / HD rk.a(IIIIIIZ)V
    abstract drawGlyph(c: number, x: number, y: number, width: number, height: number, colour: number, shadow: boolean): void;

    // mb.c(Lid;)Lid;
    static escape(text: JagString | null): JagString {
        const str = requireNonNull(text);
        const length = str.getLength();
        let extra = 0;

        for (let i = 0; i < length; i++) {
            const c = str.charAt(i);
            if (c === 60 || c === 62) {
                extra = (extra + 3) | 0;
            }
        }

        const result = JagString.allocate((length + extra) | 0);

        for (let i = 0; i < length; i++) {
            const c = str.charAt(i);
            if (c === 60) {
                result.append(requireNonNull(PixfontGeneric.escapedLt));
            } else if (c === 62) {
                result.append(requireNonNull(PixfontGeneric.escapedGt));
            } else {
                result.appendChar(c);
            }
        }

        return result;
    }

    // SD mb.a(Lid;II[I[I)V / HD rk.a(Lna;II[I[I)V
    private drawTaggedOffsets(text: JagString | null, x: number, y: number, xOffsets: Int32Array | null, yOffsets: Int32Array | null): void {
        y = (y - this.lineHeight) | 0;
        let tagStart = -1;
        let prev = 0;
        let index = 0;
        const str = requireNonNull(text);
        const length = str.getLength();

        for (let i = 0; i < length; i++) {
            let c = str.charAt(i);
            if (c === 60) {
                tagStart = i;
                continue;
            }

            if (c === 62 && tagStart !== -1) {
                const tag = str.substring((tagStart + 1) | 0, i);
                tagStart = -1;
                if (tag.equals(requireNonNull(PixfontGeneric.entityLt))) {
                    c = 60;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityGt))) {
                    c = 62;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityNbsp))) {
                    c = 160;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityShy))) {
                    c = 173;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityTimes))) {
                    c = 215;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityEuro))) {
                    c = 128;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityCopy))) {
                    c = 169;
                } else if (tag.equals(requireNonNull(PixfontGeneric.entityReg))) {
                    c = 174;
                } else {
                    if (tag.startsWith(requireNonNull(PixfontGeneric.tagImage))) {
                        try {
                            let xOffset: number;
                            if (xOffsets !== null) {
                                xOffset = arrayAtI32(xOffsets, index);
                            } else {
                                xOffset = 0;
                            }

                            let yOffset: number;
                            if (yOffsets !== null) {
                                yOffset = arrayAtI32(yOffsets, index);
                            } else {
                                yOffset = 0;
                            }

                            index++;
                            const icon = tag.substringFrom(4).decimal();
                            const sprite = arrayAtObj(this.icons, icon);
                            const iconHeight = this.iconHeights !== null ? arrayAtI32(this.iconHeights, icon) : requireNonNull(sprite).cropH;
                            if (PixfontGeneric.alpha === 256) {
                                requireNonNull(sprite).draw((x + xOffset) | 0, (y + this.lineHeight - iconHeight + yOffset) | 0);
                            } else {
                                requireNonNull(sprite).drawAlpha((x + xOffset) | 0, (y + this.lineHeight - iconHeight + yOffset) | 0, PixfontGeneric.alpha);
                            }

                            x = (x + requireNonNull(sprite).cropW) | 0;
                            prev = 0;
                        } catch (error) {
                            // catch (Exception)
                            if (!(error instanceof Error) || error instanceof JavaError) throw error;
                        }
                    } else {
                        this.parseTag(tag);
                    }

                    continue;
                }
            }

            if (tagStart === -1) {
                if (this.kerning !== null && prev !== 0) {
                    x = (x + ((this.kerning[(prev << 8) + c] << 24) >> 24)) | 0;
                }

                const glyphWidth = arrayAtI32(this.glyphWidths, c);
                const glyphHeight = arrayAtI32(this.glyphHeights, c);
                let xOffset: number;
                if (xOffsets !== null) {
                    xOffset = arrayAtI32(xOffsets, index);
                } else {
                    xOffset = 0;
                }

                let yOffset: number;
                if (yOffsets !== null) {
                    yOffset = arrayAtI32(yOffsets, index);
                } else {
                    yOffset = 0;
                }

                index++;
                if (c !== 32) {
                    if (PixfontGeneric.alpha === 256) {
                        if (PixfontGeneric.shadowColour !== -1) {
                            this.drawGlyph(c, (x + arrayAtI32(this.glyphXOffsets, c) + 1 + xOffset) | 0, (y + arrayAtI32(this.glyphYOffsets, c) + 1 + yOffset) | 0, glyphWidth, glyphHeight, PixfontGeneric.shadowColour, true);
                        }

                        this.drawGlyph(c, (x + arrayAtI32(this.glyphXOffsets, c) + xOffset) | 0, (y + arrayAtI32(this.glyphYOffsets, c) + yOffset) | 0, glyphWidth, glyphHeight, PixfontGeneric.colour, false);
                    } else {
                        if (PixfontGeneric.shadowColour !== -1) {
                            this.drawGlyphAlpha(
                                c,
                                (x + arrayAtI32(this.glyphXOffsets, c) + 1 + xOffset) | 0,
                                (y + arrayAtI32(this.glyphYOffsets, c) + 1 + yOffset) | 0,
                                glyphWidth,
                                glyphHeight,
                                PixfontGeneric.shadowColour,
                                PixfontGeneric.alpha,
                                true
                            );
                        }

                        this.drawGlyphAlpha(c, (x + arrayAtI32(this.glyphXOffsets, c) + xOffset) | 0, (y + arrayAtI32(this.glyphYOffsets, c) + yOffset) | 0, glyphWidth, glyphHeight, PixfontGeneric.colour, PixfontGeneric.alpha, false);
                    }
                } else if (PixfontGeneric.justifySpacing > 0) {
                    PixfontGeneric.justifyRemainder = (PixfontGeneric.justifyRemainder + PixfontGeneric.justifySpacing) | 0;
                    x = (x + (PixfontGeneric.justifyRemainder >> 8)) | 0;
                    PixfontGeneric.justifyRemainder &= 255;
                }

                const advance = arrayAtI32(this.glyphAdvances, c);
                if (PixfontGeneric.strikeColour !== -1) {
                    if (glActive()) {
                        glRaster().hline(x, (y + ((this.lineHeight * 0.7) | 0)) | 0, advance, PixfontGeneric.strikeColour);
                    } else {
                        Pix2D.hline(x, (y + ((this.lineHeight * 0.7) | 0)) | 0, advance, PixfontGeneric.strikeColour);
                    }
                }

                if (PixfontGeneric.underlineColour !== -1) {
                    // No +1 here, unlike mb.a(Lid;II)V (in both jars).
                    if (glActive()) {
                        glRaster().hline(x, (y + this.lineHeight) | 0, advance, PixfontGeneric.underlineColour);
                    } else {
                        Pix2D.hline(x, (y + this.lineHeight) | 0, advance, PixfontGeneric.underlineColour);
                    }
                }

                x = (x + advance) | 0;
                prev = c;
            }
        }
    }

    // mb.a([B)V
    private decodeMetrics(data: Uint8Array | null): void {
        this.glyphAdvances = new Int32Array(256);
        const bytes = requireNonNull(data);
        if (bytes.length === 257) {
            for (let i = 0; i < this.glyphAdvances.length; i++) {
                this.glyphAdvances[i] = byteAt(bytes, i) & 255;
            }

            this.lineHeight = byteAt(bytes, 256) & 255;
            return;
        }

        let pos = 0;

        for (let i = 0; i < 256; i++) {
            this.glyphAdvances[i] = byteAt(bytes, pos++) & 255;
        }

        const heights = new Int32Array(256);
        const tops = new Int32Array(256);

        for (let i = 0; i < 256; i++) {
            heights[i] = byteAt(bytes, pos++) & 255;
        }

        for (let i = 0; i < 256; i++) {
            tops[i] = byteAt(bytes, pos++) & 255;
        }

        const leftEdges = new Array<Uint8Array | null>(256).fill(null);

        for (let i = 0; i < 256; i++) {
            leftEdges[i] = new Uint8Array(heights[i]);
            let edge = 0;

            for (let j = 0; j < requireNonNull(leftEdges[i]).length; j++) {
                edge = ((edge + byteAt(bytes, pos++)) << 24) >> 24;
                putByte(leftEdges[i], j, edge);
            }
        }

        const rightEdges = new Array<Uint8Array | null>(256).fill(null);

        for (let i = 0; i < 256; i++) {
            rightEdges[i] = new Uint8Array(heights[i]);
            let edge = 0;

            for (let j = 0; j < requireNonNull(rightEdges[i]).length; j++) {
                edge = ((edge + byteAt(bytes, pos++)) << 24) >> 24;
                putByte(rightEdges[i], j, edge);
            }
        }

        this.kerning = new Uint8Array(65536);

        for (let a = 0; a < 256; a++) {
            if (a !== 32 && a !== 160) {
                for (let b = 0; b < 256; b++) {
                    if (b !== 32 && b !== 160) {
                        this.kerning[(a << 8) + b] = PixfontGeneric.computeKerning(leftEdges, rightEdges, tops, this.glyphAdvances, heights, a, b);
                    }
                }
            }
        }

        this.lineHeight = (tops[32] + heights[32]) | 0;
    }

    // mb.a([[B[[B[I[I[III)I
    private static computeKerning(leftEdges: (Uint8Array | null)[] | null, rightEdges: (Uint8Array | null)[] | null, tops: Int32Array | null, advances: Int32Array | null, heights: Int32Array | null, a: number, b: number): number {
        const topA = arrayAtI32(tops, a);
        const bottomA = (topA + arrayAtI32(heights, a)) | 0;
        const topB = arrayAtI32(tops, b);
        const bottomB = (topB + arrayAtI32(heights, b)) | 0;
        let top = topA;
        if (topB > topA) {
            top = topB;
        }

        let bottom = bottomA;
        if (bottomB < bottomA) {
            bottom = bottomB;
        }

        let kerning = arrayAtI32(advances, a);
        if (arrayAtI32(advances, b) < kerning) {
            kerning = arrayAtI32(advances, b);
        }

        const right = arrayAtObj(rightEdges, a);
        const left = arrayAtObj(leftEdges, b);
        let rightPos = (top - topA) | 0;
        let leftPos = (top - topB) | 0;

        for (let row = top; row < bottom; row++) {
            const gap = (((byteAt(right, rightPos++) << 24) >> 24) + ((byteAt(left, leftPos++) << 24) >> 24)) | 0;
            if (gap < kerning) {
                kerning = gap;
            }
        }

        return -kerning | 0;
    }

    // sb.a(Lal;IIILal;)Lmb; is SpriteLoader.loadFont (moved there so Font has no import of SpriteLoader, which would
    // cycle Font -> SpriteLoader -> SoftwareFont extends Font).
}
