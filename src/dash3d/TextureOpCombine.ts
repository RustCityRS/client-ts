import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadClient, loadJagString, loadLocalisedText, loadWorld } from '#/util/GamepackClasses';

// o
export default class TextureOpCombine extends TextureOp {
    // HD pi.f(B)V
    static releaseTextureOpCombineStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'ignoreNames');
            if (guard >= -56) {
                const world = loadWorld();
                world.eyeTileZ = 30;
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanSelfIgnore');
            const JagString = loadJagString();
            releaseReferences(JagString, 'nullString2');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pi.F(' + guard + ')');
        }
    }

    private mode = 6; // o.ab:I

    // o.<init>()V
    constructor() {
        super(2, false);
    }

    // o.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.mode = requireNonNull(packet).g1();
        else if (code === 1) this.monochrome = requireNonNull(packet).g1() === 1;
    }

    // o.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dst = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const first = this.getChildMonochromeOutput(0, row);
            const second = this.getChildMonochromeOutput(1, row);
            const left = glJar ? second : first;
            const right = glJar ? first : second;
            switch (this.mode) {
                case 1:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(dst, x, (arrayAtI32(left, x) + arrayAtI32(right, x)) | 0);
                    }
                    break;
                case 2:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(dst, x, (-arrayAtI32(second, x) + arrayAtI32(first, x)) | 0);
                    }
                    break;
                case 3:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(dst, x, Math.imul(arrayAtI32(left, x), arrayAtI32(right, x)) >> 12);
                    }
                    break;
                case 4:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const secondValue = arrayAtI32(second, x);
                        arrayPutI32(dst, x, secondValue === 0 ? 4096 : ((arrayAtI32(first, x) << 12) / secondValue) | 0);
                    }
                    break;
                case 5:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(dst, x, (4096 - (Math.imul(4096 - arrayAtI32(right, x), 4096 - arrayAtI32(left, x)) >> 12)) | 0);
                    }
                    break;
                case 6:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const secondValue = arrayAtI32(second, x);
                        arrayPutI32(dst, x, secondValue < 2048 ? Math.imul(arrayAtI32(first, x), secondValue) >> 11 : (4096 - (Math.imul(4096 - secondValue, 4096 - arrayAtI32(first, x)) >> 11)) | 0);
                    }
                    break;
                case 7:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const firstValue = arrayAtI32(first, x);
                        arrayPutI32(dst, x, firstValue === 4096 ? 4096 : ((arrayAtI32(second, x) << 12) / ((4096 - firstValue) | 0)) | 0);
                    }
                    break;
                case 8:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const firstValue = arrayAtI32(first, x);
                        arrayPutI32(dst, x, firstValue === 0 ? 0 : (4096 - ((((4096 - arrayAtI32(second, x)) << 12) / firstValue) | 0)) | 0);
                    }
                    break;
                case 9:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const firstValue = arrayAtI32(left, x);
                        const secondValue = arrayAtI32(right, x);
                        arrayPutI32(dst, x, Math.min(firstValue, secondValue));
                    }
                    break;
                case 10:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const firstValue = arrayAtI32(left, x);
                        const secondValue = arrayAtI32(right, x);
                        arrayPutI32(dst, x, Math.max(firstValue, secondValue));
                    }
                    break;
                case 11:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const firstValue = arrayAtI32(first, x);
                        const secondValue = arrayAtI32(second, x);
                        arrayPutI32(dst, x, Math.abs(firstValue - secondValue) | 0);
                    }
                    break;
                case 12:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const firstValue = arrayAtI32(first, x);
                        const secondValue = arrayAtI32(second, x);
                        arrayPutI32(dst, x, (firstValue + secondValue - (Math.imul(firstValue, secondValue) >> 11)) | 0);
                    }
                    break;
            }
        }
        return dst;
    }

    // o.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        if (glJar) return this.getColourOutputHd(row);
        const dst = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const first = this.getChildColourOutput(row, 0);
            const second = this.getChildColourOutput(row, 1);
            const outG = arrayAtObj(dst, 1),
                outR = arrayAtObj(dst, 0);
            const ar = arrayAtObj(first, 0),
                ag = arrayAtObj(first, 1),
                outB = arrayAtObj(dst, 2);
            const ab = arrayAtObj(first, 2),
                bg = arrayAtObj(second, 1),
                br = arrayAtObj(second, 0),
                bb = arrayAtObj(second, 2);
            switch (this.mode) {
                case 1:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(outR, x, (arrayAtI32(br, x) + arrayAtI32(ar, x)) | 0);
                        arrayPutI32(outG, x, (arrayAtI32(bg, x) + arrayAtI32(ag, x)) | 0);
                        arrayPutI32(outB, x, (arrayAtI32(bb, x) + arrayAtI32(ab, x)) | 0);
                    }
                    break;
                case 2:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(outR, x, (arrayAtI32(ar, x) - arrayAtI32(br, x)) | 0);
                        arrayPutI32(outG, x, (arrayAtI32(ag, x) - arrayAtI32(bg, x)) | 0);
                        arrayPutI32(outB, x, (-arrayAtI32(bb, x) + arrayAtI32(ab, x)) | 0);
                    }
                    break;
                case 3:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(outR, x, Math.imul(arrayAtI32(br, x), arrayAtI32(ar, x)) >> 12);
                        arrayPutI32(outG, x, Math.imul(arrayAtI32(ag, x), arrayAtI32(bg, x)) >> 12);
                        arrayPutI32(outB, x, Math.imul(arrayAtI32(ab, x), arrayAtI32(bb, x)) >> 12);
                    }
                    break;
                case 4:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const bbValue = arrayAtI32(bb, x);
                        const bgValue = arrayAtI32(bg, x);
                        const brValue = arrayAtI32(br, x);
                        arrayPutI32(outR, x, brValue === 0 ? 4096 : ((arrayAtI32(ar, x) << 12) / brValue) | 0);
                        arrayPutI32(outG, x, bgValue === 0 ? 4096 : ((arrayAtI32(ag, x) << 12) / bgValue) | 0);
                        arrayPutI32(outB, x, bbValue === 0 ? 4096 : ((arrayAtI32(ab, x) << 12) / bbValue) | 0);
                    }
                    break;
                case 5:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(outR, x, (4096 - (Math.imul(4096 - arrayAtI32(ar, x), 4096 - arrayAtI32(br, x)) >> 12)) | 0);
                        arrayPutI32(outG, x, (4096 - (Math.imul(4096 - arrayAtI32(bg, x), 4096 - arrayAtI32(ag, x)) >> 12)) | 0);
                        arrayPutI32(outB, x, (4096 - (Math.imul(4096 - arrayAtI32(ab, x), 4096 - arrayAtI32(bb, x)) >> 12)) | 0);
                    }
                    break;
                case 6:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const bbValue = arrayAtI32(bb, x);
                        const bgValue = arrayAtI32(bg, x);
                        const brValue = arrayAtI32(br, x);
                        arrayPutI32(outR, x, brValue < 2048 ? Math.imul(arrayAtI32(ar, x), brValue) >> 11 : (4096 - (Math.imul(4096 - brValue, 4096 - arrayAtI32(ar, x)) >> 11)) | 0);
                        arrayPutI32(outG, x, bgValue < 2048 ? Math.imul(arrayAtI32(ag, x), bgValue) >> 11 : (4096 - (Math.imul(4096 - bgValue, 4096 - arrayAtI32(ag, x)) >> 11)) | 0);
                        arrayPutI32(outB, x, bbValue < 2048 ? Math.imul(arrayAtI32(ab, x), bbValue) >> 11 : (4096 - (Math.imul(4096 - bbValue, 4096 - arrayAtI32(ab, x)) >> 11)) | 0);
                    }
                    break;
                case 7:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const abValue = arrayAtI32(ab, x);
                        const arValue = arrayAtI32(ar, x);
                        const agValue = arrayAtI32(ag, x);
                        arrayPutI32(outR, x, arValue === 4096 ? 4096 : ((arrayAtI32(br, x) << 12) / ((4096 - arValue) | 0)) | 0);
                        arrayPutI32(outG, x, agValue === 4096 ? 4096 : ((arrayAtI32(bg, x) << 12) / ((4096 - agValue) | 0)) | 0);
                        arrayPutI32(outB, x, abValue === 4096 ? 4096 : ((arrayAtI32(bb, x) << 12) / ((4096 - abValue) | 0)) | 0);
                    }
                    break;
                case 8:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const agValue = arrayAtI32(ag, x);
                        const arValue = arrayAtI32(ar, x);
                        const abValue = arrayAtI32(ab, x);
                        arrayPutI32(outR, x, arValue === 0 ? 0 : (4096 - ((((4096 - arrayAtI32(br, x)) << 12) / arValue) | 0)) | 0);
                        arrayPutI32(outG, x, agValue === 0 ? 0 : (4096 - ((((4096 - arrayAtI32(bg, x)) << 12) / agValue) | 0)) | 0);
                        arrayPutI32(outB, x, abValue === 0 ? 0 : (4096 - ((((4096 - arrayAtI32(bb, x)) << 12) / abValue) | 0)) | 0);
                    }
                    break;
                case 9:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const brValue = arrayAtI32(br, x);
                        const arValue = arrayAtI32(ar, x);
                        const bgValue = arrayAtI32(bg, x);
                        const agValue = arrayAtI32(ag, x);
                        const abValue = arrayAtI32(ab, x);
                        const bbValue = arrayAtI32(bb, x);
                        arrayPutI32(outR, x, Math.min(arValue, brValue));
                        arrayPutI32(outG, x, Math.min(agValue, bgValue));
                        arrayPutI32(outB, x, Math.min(abValue, bbValue));
                    }
                    break;
                case 10:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const brValue = arrayAtI32(br, x);
                        const bbValue = arrayAtI32(bb, x);
                        const bgValue = arrayAtI32(bg, x);
                        const arValue = arrayAtI32(ar, x);
                        const abValue = arrayAtI32(ab, x);
                        const agValue = arrayAtI32(ag, x);
                        arrayPutI32(outR, x, Math.max(arValue, brValue));
                        arrayPutI32(outG, x, Math.max(agValue, bgValue));
                        arrayPutI32(outB, x, Math.max(abValue, bbValue));
                    }
                    break;
                case 11:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const bgValue = arrayAtI32(bg, x);
                        const arValue = arrayAtI32(ar, x);
                        const abValue = arrayAtI32(ab, x);
                        const bbValue = arrayAtI32(bb, x);
                        const brValue = arrayAtI32(br, x);
                        const agValue = arrayAtI32(ag, x);
                        arrayPutI32(outR, x, Math.abs(arValue - brValue) | 0);
                        arrayPutI32(outG, x, Math.abs(agValue - bgValue) | 0);
                        arrayPutI32(outB, x, Math.abs(abValue - bbValue) | 0);
                    }
                    break;
                case 12:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const bgValue = arrayAtI32(bg, x);
                        const agValue = arrayAtI32(ag, x);
                        const bbValue = arrayAtI32(bb, x);
                        const brValue = arrayAtI32(br, x);
                        const arValue = arrayAtI32(ar, x);
                        const abValue = arrayAtI32(ab, x);
                        arrayPutI32(outR, x, (arValue + brValue - (Math.imul(arValue, brValue) >> 11)) | 0);
                        arrayPutI32(outG, x, (agValue + bgValue - (Math.imul(agValue, bgValue) >> 11)) | 0);
                        arrayPutI32(outB, x, (abValue + bbValue - (Math.imul(abValue, bbValue) >> 11)) | 0);
                    }
                    break;
            }
        }
        return dst;
    }

    // HD pi.b(II)[[I
    private getColourOutputHd(row: number): ColourImageRow | null {
        const dst = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const first = this.getChildColourOutput(row, 0);
            const second = this.getChildColourOutput(row, 1);
            const outR = arrayAtObj(dst, 0),
                outG = arrayAtObj(dst, 1),
                outB = arrayAtObj(dst, 2);
            const ar = arrayAtObj(first, 0),
                ag = arrayAtObj(first, 1),
                ab = arrayAtObj(first, 2);
            const br = arrayAtObj(second, 0),
                bg = arrayAtObj(second, 1),
                bb = arrayAtObj(second, 2);
            switch (this.mode) {
                case 1:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(outR, x, (arrayAtI32(br, x) + arrayAtI32(ar, x)) | 0);
                        arrayPutI32(outG, x, (arrayAtI32(bg, x) + arrayAtI32(ag, x)) | 0);
                        arrayPutI32(outB, x, (arrayAtI32(ab, x) + arrayAtI32(bb, x)) | 0);
                    }
                    break;
                case 2:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(outR, x, (arrayAtI32(ar, x) - arrayAtI32(br, x)) | 0);
                        arrayPutI32(outG, x, (-arrayAtI32(bg, x) + arrayAtI32(ag, x)) | 0);
                        arrayPutI32(outB, x, (-arrayAtI32(bb, x) + arrayAtI32(ab, x)) | 0);
                    }
                    break;
                case 3:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(outR, x, Math.imul(arrayAtI32(br, x), arrayAtI32(ar, x)) >> 12);
                        arrayPutI32(outG, x, Math.imul(arrayAtI32(ag, x), arrayAtI32(bg, x)) >> 12);
                        arrayPutI32(outB, x, Math.imul(arrayAtI32(bb, x), arrayAtI32(ab, x)) >> 12);
                    }
                    break;
                case 4:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const bbValue = arrayAtI32(bb, x);
                        const bgValue = arrayAtI32(bg, x);
                        const brValue = arrayAtI32(br, x);
                        arrayPutI32(outR, x, brValue === 0 ? 4096 : ((arrayAtI32(ar, x) << 12) / brValue) | 0);
                        arrayPutI32(outG, x, bgValue === 0 ? 4096 : ((arrayAtI32(ag, x) << 12) / bgValue) | 0);
                        arrayPutI32(outB, x, bbValue === 0 ? 4096 : ((arrayAtI32(ab, x) << 12) / bbValue) | 0);
                    }
                    break;
                case 5:
                    for (let x = 0; x < TextureOp.width; x++) {
                        arrayPutI32(outR, x, (4096 - (Math.imul(4096 - arrayAtI32(br, x), 4096 - arrayAtI32(ar, x)) >> 12)) | 0);
                        arrayPutI32(outG, x, (4096 - (Math.imul(4096 - arrayAtI32(bg, x), 4096 - arrayAtI32(ag, x)) >> 12)) | 0);
                        arrayPutI32(outB, x, (4096 - (Math.imul(4096 - arrayAtI32(bb, x), 4096 - arrayAtI32(ab, x)) >> 12)) | 0);
                    }
                    break;
                case 6:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const bbValue = arrayAtI32(bb, x);
                        const brValue = arrayAtI32(br, x);
                        const bgValue = arrayAtI32(bg, x);
                        arrayPutI32(outR, x, brValue < 2048 ? Math.imul(arrayAtI32(ar, x), brValue) >> 11 : (4096 - (Math.imul(4096 - brValue, 4096 - arrayAtI32(ar, x)) >> 11)) | 0);
                        arrayPutI32(outG, x, bgValue < 2048 ? Math.imul(arrayAtI32(ag, x), bgValue) >> 11 : (4096 - (Math.imul(4096 - bgValue, 4096 - arrayAtI32(ag, x)) >> 11)) | 0);
                        arrayPutI32(outB, x, bbValue < 2048 ? Math.imul(arrayAtI32(ab, x), bbValue) >> 11 : (4096 - (Math.imul(4096 - bbValue, 4096 - arrayAtI32(ab, x)) >> 11)) | 0);
                    }
                    break;
                case 7:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const abValue = arrayAtI32(ab, x);
                        const arValue = arrayAtI32(ar, x);
                        const agValue = arrayAtI32(ag, x);
                        arrayPutI32(outR, x, arValue === 4096 ? 4096 : ((arrayAtI32(br, x) << 12) / ((4096 - arValue) | 0)) | 0);
                        arrayPutI32(outG, x, agValue === 4096 ? 4096 : ((arrayAtI32(bg, x) << 12) / ((4096 - agValue) | 0)) | 0);
                        arrayPutI32(outB, x, abValue === 4096 ? 4096 : ((arrayAtI32(bb, x) << 12) / ((4096 - abValue) | 0)) | 0);
                    }
                    break;
                case 8:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const arValue = arrayAtI32(ar, x);
                        const agValue = arrayAtI32(ag, x);
                        const abValue = arrayAtI32(ab, x);
                        arrayPutI32(outR, x, arValue === 0 ? 0 : (4096 - ((((4096 - arrayAtI32(br, x)) << 12) / arValue) | 0)) | 0);
                        arrayPutI32(outG, x, agValue === 0 ? 0 : (4096 - ((((4096 - arrayAtI32(bg, x)) << 12) / agValue) | 0)) | 0);
                        arrayPutI32(outB, x, abValue === 0 ? 0 : (4096 - ((((4096 - arrayAtI32(bb, x)) << 12) / abValue) | 0)) | 0);
                    }
                    break;
                case 9:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const abValue = arrayAtI32(ab, x);
                        const bbValue = arrayAtI32(bb, x);
                        const bgValue = arrayAtI32(bg, x);
                        const agValue = arrayAtI32(ag, x);
                        const brValue = arrayAtI32(br, x);
                        const arValue = arrayAtI32(ar, x);
                        arrayPutI32(outR, x, Math.min(arValue, brValue));
                        arrayPutI32(outG, x, Math.min(agValue, bgValue));
                        arrayPutI32(outB, x, Math.min(abValue, bbValue));
                    }
                    break;
                case 10:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const bbValue = arrayAtI32(bb, x);
                        const abValue = arrayAtI32(ab, x);
                        const bgValue = arrayAtI32(bg, x);
                        const arValue = arrayAtI32(ar, x);
                        const agValue = arrayAtI32(ag, x);
                        const brValue = arrayAtI32(br, x);
                        arrayPutI32(outR, x, Math.max(arValue, brValue));
                        arrayPutI32(outG, x, Math.max(agValue, bgValue));
                        arrayPutI32(outB, x, Math.max(abValue, bbValue));
                    }
                    break;
                case 11:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const bgValue = arrayAtI32(bg, x);
                        const brValue = arrayAtI32(br, x);
                        const agValue = arrayAtI32(ag, x);
                        const arValue = arrayAtI32(ar, x);
                        const abValue = arrayAtI32(ab, x);
                        const bbValue = arrayAtI32(bb, x);
                        arrayPutI32(outR, x, Math.abs(arValue - brValue) | 0);
                        arrayPutI32(outG, x, Math.abs(agValue - bgValue) | 0);
                        arrayPutI32(outB, x, Math.abs(abValue - bbValue) | 0);
                    }
                    break;
                case 12:
                    for (let x = 0; x < TextureOp.width; x++) {
                        const arValue = arrayAtI32(ar, x);
                        const bbValue = arrayAtI32(bb, x);
                        const brValue = arrayAtI32(br, x);
                        const bgValue = arrayAtI32(bg, x);
                        const abValue = arrayAtI32(ab, x);
                        const agValue = arrayAtI32(ag, x);
                        arrayPutI32(outR, x, (arValue + brValue - (Math.imul(arValue, brValue) >> 11)) | 0);
                        arrayPutI32(outG, x, (agValue + bgValue - (Math.imul(agValue, bgValue) >> 11)) | 0);
                        arrayPutI32(outB, x, (abValue + bbValue - (Math.imul(abValue, bbValue) >> 11)) | 0);
                    }
                    break;
            }
        }
        return dst;
    }
}
