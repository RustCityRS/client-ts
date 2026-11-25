import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';

// wh
export default class TextureOpBoxBlur extends TextureOp {
    private verticalRadius = 1; // wh.N:I
    private horizontalRadius = 1; // wh.V:I

    // wh.<init>()V
    constructor() {
        super(1, false);
    }

    // wh.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.horizontalRadius = requireNonNull(packet).g1();
        else if (code === 1) this.verticalRadius = requireNonNull(packet).g1();
        else if (code === 2) this.monochrome = requireNonNull(packet).g1() === 1;
    }

    // wh.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const count = (this.verticalRadius * 2 + 1) | 0;
            const verticalWeight = intDivide(65536, count);
            const horizontalWeight = intDivide(65536, (this.horizontalRadius * 2 + 1) | 0);
            const rows = new Array<Int32Array | null>(count).fill(null);
            for (let y = (row - this.verticalRadius) | 0; y <= ((row + this.verticalRadius) | 0); y = (y + 1) | 0) {
                let sum = 0;
                const source = this.getChildMonochromeOutput(0, TextureOp.heightMask & y);
                for (let i = -this.horizontalRadius; i <= this.horizontalRadius; i++) {
                    sum = (sum + arrayAtI32(source, TextureOp.widthMask & i)) | 0;
                }
                const blurred = new Int32Array(TextureOp.width);
                for (let x = 0; x < TextureOp.width; x++) {
                    arrayPutI32(blurred, x, Math.imul(sum, horizontalWeight) >> 16);
                    sum = (sum - arrayAtI32(source, TextureOp.widthMask & (x - this.horizontalRadius))) | 0;
                    sum = (sum + arrayAtI32(source, (x + 1 + this.horizontalRadius) & TextureOp.widthMask)) | 0;
                }
                arrayPutObj(rows, (y - row + this.verticalRadius) | 0, blurred);
            }
            for (let x = 0; x < TextureOp.width; x++) {
                let sum = 0;
                for (let i = 0; i < count; i++) sum = (sum + arrayAtI32(arrayAtObj(rows, i), x)) | 0;
                arrayPutI32(output, x, Math.imul(sum, verticalWeight) >> 16);
            }
        }
        return output;
    }

    // wh.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const count = (this.verticalRadius * 2 + 1) | 0;
            const verticalWeight = intDivide(65536, count);
            const horizontalWeight = intDivide(65536, (this.horizontalRadius * 2 + 1) | 0);
            const rows = new Array<ColourImageRow | null>(count).fill(null);
            for (let y = (row - this.verticalRadius) | 0; y <= ((row + this.verticalRadius) | 0); y = (y + 1) | 0) {
                const source = this.getChildColourOutput(y & TextureOp.heightMask, 0);
                const blurred = [new Int32Array(TextureOp.width), new Int32Array(TextureOp.width), new Int32Array(TextureOp.width)];
                let rs = 0,
                    gs = 0,
                    bs = 0;
                const g = arrayAtObj(source, 1),
                    r = arrayAtObj(source, 0),
                    b = arrayAtObj(source, 2);
                for (let i = -this.horizontalRadius; i <= this.horizontalRadius; i++) {
                    const sample = TextureOp.widthMask & i;
                    rs = (rs + arrayAtI32(r, sample)) | 0;
                    gs = (gs + arrayAtI32(g, sample)) | 0;
                    bs = (bs + arrayAtI32(b, sample)) | 0;
                }
                for (let x = 0; x < TextureOp.width; x++) {
                    arrayPutI32(blurred[0], x, Math.imul(rs, horizontalWeight) >> 16);
                    arrayPutI32(blurred[1], x, Math.imul(gs, horizontalWeight) >> 16);
                    arrayPutI32(blurred[2], x, Math.imul(bs, horizontalWeight) >> 16);
                    let sample = (x - this.horizontalRadius) & TextureOp.widthMask;
                    gs = (gs - arrayAtI32(g, sample)) | 0;
                    rs = (rs - arrayAtI32(r, sample)) | 0;
                    bs = (bs - arrayAtI32(b, sample)) | 0;
                    sample = (x + 1 + this.horizontalRadius) & TextureOp.widthMask;
                    bs = (bs + arrayAtI32(b, sample)) | 0;
                    gs = (gs + arrayAtI32(g, sample)) | 0;
                    rs = (rs + arrayAtI32(r, sample)) | 0;
                }
                arrayPutObj(rows, (y - row + this.verticalRadius) | 0, blurred);
            }
            const r = arrayAtObj(output, 0),
                g = arrayAtObj(output, 1),
                b = arrayAtObj(output, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                let rs = 0,
                    gs = 0,
                    bs = 0;
                for (let i = 0; i < count; i++) {
                    const blurred = arrayAtObj(rows, i);
                    bs = (bs + arrayAtI32(arrayAtObj(blurred, 2), x)) | 0;
                    rs = (rs + arrayAtI32(arrayAtObj(blurred, 0), x)) | 0;
                    gs = (gs + arrayAtI32(arrayAtObj(blurred, 1), x)) | 0;
                }
                arrayPutI32(r, x, Math.imul(verticalWeight, rs) >> 16);
                arrayPutI32(g, x, Math.imul(gs, verticalWeight) >> 16);
                arrayPutI32(b, x, Math.imul(verticalWeight, bs) >> 16);
            }
        }
        return output;
    }
}
