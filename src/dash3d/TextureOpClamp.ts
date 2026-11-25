import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadMinimenu, loadWorld } from '#/util/GamepackClasses';

// nl
export default class TextureOpClamp extends TextureOp {
    // HD aj.h(I)V
    static releaseTextureOpClampStatics(guard: number): void {
        try {
            const world = loadWorld();
            releaseReferences(world, 'hiddenRoofY');
            if (guard !== 11597) {
                return;
            }
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'orange');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'aj.B(' + guard + ')');
        }
    }

    private min = 0; // nl.R:I
    private max = 4096; // nl.V:I

    // nl.<init>()V
    constructor() {
        super(1, false);
    }

    // nl.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.min = requireNonNull(packet).g2();
        else if (code === 1) this.max = requireNonNull(packet).g2();
        else if (code === 2) this.monochrome = requireNonNull(packet).g1() === 1;
    }

    // nl.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const input = this.getChildMonochromeOutput(0, row);
            for (let x = 0; x < TextureOp.width; x++) {
                const v = arrayAtI32(input, x);
                arrayPutI32(output, x, v < this.min ? this.min : v > this.max ? this.max : v);
            }
        }
        return output;
    }

    // SD nl.a(ZI)[[I, HD aj.b(II)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const input = this.getChildColourOutput(row, 0);
            let r: Int32Array | null, g: Int32Array | null, b: Int32Array | null;
            if (glJar) {
                g = arrayAtObj(input, 1);
                b = arrayAtObj(input, 2);
                r = arrayAtObj(input, 0);
            } else {
                r = arrayAtObj(input, 0);
                g = arrayAtObj(input, 1);
                b = arrayAtObj(input, 2);
            }
            const outR = arrayAtObj(output, 0),
                outG = arrayAtObj(output, 1),
                outB = arrayAtObj(output, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                let rv: number, gv: number;
                if (glJar) {
                    gv = arrayAtI32(g, x);
                    rv = arrayAtI32(r, x);
                } else {
                    rv = arrayAtI32(r, x);
                    gv = arrayAtI32(g, x);
                }
                const bv = arrayAtI32(b, x);
                arrayPutI32(outR, x, rv < this.min ? this.min : rv > this.max ? this.max : rv);
                arrayPutI32(outG, x, gv < this.min ? this.min : gv > this.max ? this.max : gv);
                arrayPutI32(outB, x, bv < this.min ? this.min : bv > this.max ? this.max : bv);
            }
        }
        return output;
    }
}
