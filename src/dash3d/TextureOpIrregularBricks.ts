import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import ArrayUtils from '#/util/ArrayUtils';
import { intDivide } from '#/util/IntUtils';
import { arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import JavaRandom from '#/util/JavaRandom';
import TextureOp from './TextureOp';
import { loadClient, loadLocalisedText, loadObjType } from '#/util/GamepackClasses';

// wb
export default class TextureOpIrregularBricks extends TextureOp {
    // HD ol.h(I)V
    static releaseTextureOpIrregularBricksStatics(guard: number): void {
        try {
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'countColourMillions');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchConlost');
            if (guard !== -9) {
                return;
            }
            const Client = loadClient();
            releaseReferences(Client, 'binaryArchive');
            releaseReferences(LocalisedText, 'englishAlreadyIgnored', 'alreadyIgnored');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ol.F(' + guard + ')');
        }
    }

    private colourVariation = 1024; // wb.O:I
    private bevelPixels = 0; // wb.P:I
    private bevelMode = 0; // wb.R:I
    private bevelVariation = 1024; // wb.U:I
    private minHeight = 409; // wb.W:I
    private maxWidth = 2048; // wb.X:I
    private seed = 0; // wb.Z:I
    private maxHeight = 819; // wb.eb:I
    private minWidth = 1024; // wb.gb:I
    private bevel = 1024; // wb.hb:I

    // wb.<init>()V
    constructor() {
        super(0, true);
    }

    // wb.b(I)V
    override postDecode(): void {}

    // wb.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        switch (code) {
            case 0:
                this.seed = requireNonNull(packet).g1();
                break;
            case 1:
                this.minWidth = requireNonNull(packet).g2();
                break;
            case 2:
                this.maxWidth = requireNonNull(packet).g2();
                break;
            case 3:
                this.minHeight = requireNonNull(packet).g2();
                break;
            case 4:
                this.maxHeight = requireNonNull(packet).g2();
                break;
            case 5:
                this.bevel = requireNonNull(packet).g2();
                break;
            case 6:
                this.bevelMode = requireNonNull(packet).g1();
                break;
            case 7:
                this.bevelVariation = requireNonNull(packet).g2();
                break;
            case 8:
                this.colourVariation = requireNonNull(packet).g2();
                break;
        }
    }

    // wb.a(ZIIII[[ILjava/util/Random;)V
    private drawBrick(y: number, x: number, width: number, height: number, pixels: (Int32Array | null)[] | null, random: JavaRandom): void {
        const colour = this.colourVariation > 0 ? 4096 - TextureOp.nextInt(random, this.colourVariation) : 4096;
        const range = Math.imul(this.bevelVariation, this.bevelPixels) >> 12;
        const bevel = this.bevelPixels - (range > 0 ? TextureOp.nextInt(random, range) : 0);
        if (x >= TextureOp.width) x -= TextureOp.width;
        if (bevel <= 0) {
            if (x + width <= TextureOp.width) {
                for (let j = 0; j < height; j++) ArrayUtils.fillInts(arrayAtObj(pixels, y + j), x, width, colour);
            } else {
                const span = TextureOp.width - x;
                for (let j = 0; j < height; j++) {
                    const dst = arrayAtObj(pixels, y + j);
                    ArrayUtils.fillInts(dst, x, span, colour);
                    ArrayUtils.fillInts(dst, 0, width - span, colour);
                }
            }
            return;
        }
        if (height <= 0 || width <= 0) return;
        const bevelX = Math.min((width / 2) | 0, bevel),
            bevelY = Math.min((height / 2) | 0, bevel);
        const middleX = x + bevelX,
            middleWidth = width - 2 * bevelX;
        for (let j = 0; j < height; j++) {
            const dst = arrayAtObj(pixels, y + j);
            const inset = j < bevelY ? j : height - j - 1;
            const edge = inset < bevelY;
            const shaded = edge ? intDivide(Math.imul(colour, inset), bevelY) : colour;
            for (let k = 0; k < bevelX; k++) {
                let value = intDivide(Math.imul(colour, k), bevelX);
                if (edge) value = this.bevelMode === 0 ? Math.imul(value, shaded) >> 12 : Math.min(value, shaded);
                arrayPutI32(dst, (x + width - k - 1) & TextureOp.widthMask, value);
                arrayPutI32(dst, (x + k) & TextureOp.widthMask, value);
            }
            if (middleWidth + middleX <= TextureOp.width) ArrayUtils.fillInts(dst, middleX, middleWidth, shaded);
            else {
                const span = TextureOp.width - middleX;
                ArrayUtils.fillInts(dst, middleX, span, shaded);
                ArrayUtils.fillInts(dst, 0, middleWidth - span, shaded);
            }
        }
    }

    // wb.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const out = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const pixels = requireNonNull(this.monochromeImageCache).getAll();
            let shift = 0,
                previousOffset = 0,
                start = 0,
                previousIndex = 0;
            let finished = true,
                first = true,
                previousCount = 0,
                offset = 0,
                count = 0;
            const minW = Math.imul(this.minWidth, TextureOp.width) >> 12;
            const minH = Math.imul(TextureOp.height, this.minHeight) >> 12;
            const maxH = Math.imul(TextureOp.height, this.maxHeight) >> 12;
            const maxW = Math.imul(TextureOp.width, this.maxWidth) >> 12;
            if (maxH <= 1) return arrayAtObj(pixels, row);
            this.bevelPixels = Math.imul(this.bevel, (TextureOp.width / 8) | 0) >> 12;
            const capacity = (intDivide(TextureOp.width, minW) + 1) | 0;
            let previous = Array.from(new Array(capacity), () => new Int32Array(3));
            const random = new JavaRandom(BigInt(this.seed));
            let current = Array.from(new Array(capacity), () => new Int32Array(3));
            while (true) {
                let width = (TextureOp.nextInt(random, maxW - minW) + minW) | 0;
                let end = (start + width) | 0;
                let height = (TextureOp.nextInt(random, maxH - minH) + minH) | 0;
                if (end > TextureOp.width) {
                    width = TextureOp.width - start;
                    end = TextureOp.width;
                }
                let y = 0;
                if (!first) {
                    let last = previousIndex,
                        steps = 0;
                    y = arrayAtObj(previous, previousIndex)[2];
                    let relativeEnd = end + shift;
                    if (relativeEnd < 0) relativeEnd += TextureOp.width;
                    if (relativeEnd > TextureOp.width) relativeEnd -= TextureOp.width;
                    while (relativeEnd < arrayAtObj(previous, last)[0] || arrayAtObj(previous, last)[1] < relativeEnd) {
                        steps++;
                        if (++last >= previousCount) last = 0;
                    }
                    if (last !== previousIndex) {
                        let relativeStart = shift + start;
                        if (relativeStart < 0) relativeStart += TextureOp.width;
                        if (relativeStart > TextureOp.width) relativeStart -= TextureOp.width;
                        for (let i = 1; i <= steps; i++) y = Math.max(y, arrayAtObj(previous, (previousIndex + i) % previousCount)[2]);
                        for (let i = 0; i <= steps; i++) {
                            const span = arrayAtObj(previous, (i + previousIndex) % previousCount);
                            const top = span[2];
                            if (top !== y) {
                                let left: number, right: number;
                                if (relativeStart >= relativeEnd) {
                                    if (span[0] === 0) {
                                        left = 0;
                                        right = Math.min(relativeEnd, span[1]);
                                    } else {
                                        left = Math.max(relativeStart, span[0]);
                                        right = TextureOp.width;
                                    }
                                } else {
                                    left = Math.max(relativeStart, span[0]);
                                    right = Math.min(relativeEnd, span[1]);
                                }
                                this.drawBrick(top, left + previousOffset, right - left, y - top, pixels, random);
                            }
                        }
                    }
                    previousIndex = last;
                }
                if (TextureOp.height >= y + height) finished = false;
                else height = TextureOp.height - y;
                if (end === TextureOp.width) {
                    this.drawBrick(y, offset + start, width, height, pixels, random);
                    if (finished) break;
                    previousOffset = offset;
                    previousIndex = 0;
                    const span = arrayAtObj(current, count++);
                    previousCount = count;
                    span[1] = end;
                    span[0] = start;
                    count = 0;
                    finished = true;
                    span[2] = height + y;
                    first = false;
                    [previous, current] = [current, previous];
                    offset = TextureOp.nextInt(random, TextureOp.width);
                    start = 0;
                    shift = offset - previousOffset;
                    let relative = shift;
                    if (relative < 0) relative += TextureOp.width;
                    if (relative > TextureOp.width) relative -= TextureOp.width;
                    while (arrayAtObj(previous, previousIndex)[0] > relative || relative > arrayAtObj(previous, previousIndex)[1]) {
                        if (++previousIndex >= previousCount) previousIndex = 0;
                    }
                } else {
                    const span = arrayAtObj(current, count++);
                    span[2] = height + y;
                    span[0] = start;
                    span[1] = end;
                    this.drawBrick(y, offset + start, width, height, pixels, random);
                    start = end;
                }
            }
        }
        return out;
    }
}
