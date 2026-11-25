import { glJar } from '#/client/ClientVariant';
import type PacketT from '#/io/PacketT';
import ArrayUtils from '#/util/ArrayUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';

// bd
export default class TextureOpFlip extends TextureOp {
    private vertical = true; // bd.Q:Z
    private horizontal = true; // bd.R:Z

    // bd.<init>()V
    constructor() {
        super(1, false);
    }

    // bd.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.horizontal = requireNonNull(packet).g1() === 1;
        else if (code === 1) this.vertical = requireNonNull(packet).g1() === 1;
        else if (code === 2) this.monochrome = requireNonNull(packet).g1() === 1;
    }

    // bd.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const input = this.getChildMonochromeOutput(0, this.vertical ? (TextureOp.heightMask - row) | 0 : row);
            if (!this.horizontal) {
                ArrayUtils.copyInts(input, 0, output, 0, TextureOp.width);
                return output;
            }
            for (let x = 0; x < TextureOp.width; x++) {
                arrayPutI32(output, x, arrayAtI32(input, (TextureOp.widthMask - x) | 0));
            }
        }
        return output;
    }

    // SD bd.a(ZI)[[I, HD ej.b(II)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const input = this.getChildColourOutput(this.vertical ? (TextureOp.heightMask - row) | 0 : row, 0);
            let r: Int32Array | null, g: Int32Array | null, b: Int32Array | null;
            let outR: Int32Array | null, outG: Int32Array | null, outB: Int32Array | null;
            if (glJar) {
                r = arrayAtObj(input, 0);
                b = arrayAtObj(input, 2);
                g = arrayAtObj(input, 1);
                outG = arrayAtObj(output, 1);
                outB = arrayAtObj(output, 2);
                outR = arrayAtObj(output, 0);
            } else {
                g = arrayAtObj(input, 1);
                r = arrayAtObj(input, 0);
                b = arrayAtObj(input, 2);
                outG = arrayAtObj(output, 1);
                outR = arrayAtObj(output, 0);
                outB = arrayAtObj(output, 2);
            }
            if (this.horizontal) {
                for (let x = 0; x < TextureOp.width; x++) {
                    arrayPutI32(outR, x, arrayAtI32(r, (TextureOp.widthMask - x) | 0));
                    arrayPutI32(outG, x, arrayAtI32(g, (TextureOp.widthMask - x) | 0));
                    arrayPutI32(outB, x, arrayAtI32(b, (TextureOp.widthMask - x) | 0));
                }
            } else {
                for (let x = 0; x < TextureOp.width; x++) {
                    arrayPutI32(outR, x, arrayAtI32(r, x));
                    arrayPutI32(outG, x, arrayAtI32(g, x));
                    arrayPutI32(outB, x, arrayAtI32(b, x));
                }
            }
        }
        return output;
    }
}
