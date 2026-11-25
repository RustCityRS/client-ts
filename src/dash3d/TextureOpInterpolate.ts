import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';

// qa
export default class TextureOpInterpolate extends TextureOp {
    // qa.<init>()V
    constructor() {
        super(3, false);
    }

    // qa.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.monochrome = requireNonNull(packet).g1() === 1;
    }

    // qa.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dst = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const a = this.getChildMonochromeOutput(0, row);
            const b = this.getChildMonochromeOutput(1, row);
            const mask = this.getChildMonochromeOutput(2, row);
            for (let x = 0; x < TextureOp.width; x++) {
                const weight = arrayAtI32(mask, x);
                if (weight === 4096) arrayPutI32(dst, x, arrayAtI32(a, x));
                else if (weight === 0) arrayPutI32(dst, x, arrayAtI32(b, x));
                else arrayPutI32(dst, x, (Math.imul(arrayAtI32(a, x), weight) + Math.imul(arrayAtI32(b, x), 4096 - weight)) >> 12);
            }
        }
        return dst;
    }

    // qa.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const dst = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const mask = this.getChildMonochromeOutput(2, row);
            const a = this.getChildColourOutput(row, 0);
            const b = this.getChildColourOutput(row, 1);
            const outR = arrayAtObj(dst, 0),
                outG = arrayAtObj(dst, 1),
                outB = arrayAtObj(dst, 2);
            const ar = arrayAtObj(a, 0),
                ag = arrayAtObj(a, 1),
                ab = arrayAtObj(a, 2);
            const br = arrayAtObj(b, 0),
                bg = arrayAtObj(b, 1),
                bb = arrayAtObj(b, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                const weight = arrayAtI32(mask, x);
                if (weight === 4096) {
                    arrayPutI32(outR, x, arrayAtI32(ar, x));
                    arrayPutI32(outG, x, arrayAtI32(ag, x));
                    arrayPutI32(outB, x, arrayAtI32(ab, x));
                } else if (weight === 0) {
                    arrayPutI32(outR, x, arrayAtI32(br, x));
                    arrayPutI32(outG, x, arrayAtI32(bg, x));
                    arrayPutI32(outB, x, arrayAtI32(bb, x));
                } else {
                    const other = (4096 - weight) | 0;
                    arrayPutI32(outR, x, (Math.imul(other, arrayAtI32(br, x)) + Math.imul(arrayAtI32(ar, x), weight)) >> 12);
                    arrayPutI32(outG, x, (Math.imul(other, arrayAtI32(bg, x)) + Math.imul(weight, arrayAtI32(ag, x))) >> 12);
                    arrayPutI32(outB, x, (Math.imul(weight, arrayAtI32(ab, x)) + Math.imul(other, arrayAtI32(bb, x))) >> 12);
                }
            }
        }
        return dst;
    }
}
