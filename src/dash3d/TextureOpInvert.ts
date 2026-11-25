import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadClient, loadWorld, loadWorldMapLabels } from '#/util/GamepackClasses';

// pf
export default class TextureOpInvert extends TextureOp {
    // HD tb.i(I)V
    static releaseTextureOpInvertStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'percent5');
            if (guard !== 2) {
                const world = loadWorld();
                world.minLevel = -53;
            }
            const WorldMapLabels = loadWorldMapLabels();
            releaseReferences(WorldMapLabels, 'scene');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'tb.E(' + guard + ')');
        }
    }

    // pf.<init>()V
    constructor() {
        super(1, false);
    }

    // pf.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.monochrome = requireNonNull(packet).g1() === 1;
    }

    // pf.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const input = this.getChildMonochromeOutput(0, row);
            for (let x = 0; x < TextureOp.width; x++) {
                arrayPutI32(output, x, (4096 - arrayAtI32(input, x)) | 0);
            }
        }
        return output;
    }

    // SD pf.a(ZI)[[I, HD tb.b(II)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const input = this.getChildColourOutput(row, 0);
            let r: Int32Array | null, g: Int32Array | null, b: Int32Array | null;
            if (glJar) {
                b = arrayAtObj(input, 2);
                r = arrayAtObj(input, 0);
                g = arrayAtObj(input, 1);
            } else {
                r = arrayAtObj(input, 0);
                g = arrayAtObj(input, 1);
                b = arrayAtObj(input, 2);
            }
            const outR = arrayAtObj(output, 0),
                outG = arrayAtObj(output, 1),
                outB = arrayAtObj(output, 2);
            for (let x = 0; x < TextureOp.width; x++) {
                arrayPutI32(outR, x, (4096 - arrayAtI32(r, x)) | 0);
                arrayPutI32(outG, x, (4096 - arrayAtI32(g, x)) | 0);
                arrayPutI32(outB, x, (4096 - arrayAtI32(b, x)) | 0);
            }
        }
        return output;
    }
}
