import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadLocalisedText } from '#/util/GamepackClasses';

// s
export default class TextureOpColourize extends TextureOp {
    // HD mg.h(I)V
    static releaseTextureOpColourizeStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'chatcol6', 'englishChatcol6');
            if (guard !== -1443422260) {
                return;
            }
            releaseReferences(LocalisedText, 'defaultChatcol6', 'frenchAllocatedMemory');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'mg.U(' + guard + ')');
        }
    }

    private green = 4096; // s.R:I
    private red = 4096; // s.T:I
    private blue = 4096; // s.V:I

    // s.<init>()V
    constructor() {
        super(1, false);
    }

    // s.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.red = requireNonNull(packet).g2();
        else if (code === 1) this.green = requireNonNull(packet).g2();
        else if (code === 2) this.blue = requireNonNull(packet).g2();
    }

    // s.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const dst = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const rgb = this.getChildColourOutput(row, 0);
            const red = arrayAtObj(rgb, 0),
                blue = arrayAtObj(rgb, 2);
            const outG = arrayAtObj(dst, 1),
                outB = arrayAtObj(dst, 2),
                outR = arrayAtObj(dst, 0);
            const green = arrayAtObj(rgb, 1);
            for (let x = 0; x < TextureOp.width; x++) {
                const r = arrayAtI32(red, x),
                    b = arrayAtI32(blue, x),
                    g = arrayAtI32(green, x);
                if (r === b && g === b) {
                    arrayPutI32(outR, x, Math.imul(r, this.red) >> 12);
                    arrayPutI32(outG, x, Math.imul(this.green, b) >> 12);
                    arrayPutI32(outB, x, Math.imul(g, this.blue) >> 12);
                } else {
                    arrayPutI32(outR, x, this.red);
                    arrayPutI32(outG, x, this.green);
                    arrayPutI32(outB, x, this.blue);
                }
            }
        }
        return dst;
    }
}
