import { intDivide, intRemainder } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import type { ColourImageRow } from './ColourImageCache';
import TextureOp from './TextureOp';
import { loadClientPlayer, loadSpotType, loadWorld } from '#/util/GamepackClasses';

// sd
export default class TextureOpPolarDistortion extends TextureOp {
    // HD ke.h(I)V
    static releaseTextureOpPolarDistortionStatics(guard: number): void {
        try {
            const ClientPlayer = loadClientPlayer();
            releaseReferences(ClientPlayer, 'nameAffixSlotCounts');
            const world = loadWorld();
            releaseReferences(world, 'minimapShape');
            intRemainder(-20, intDivide((-31 - guard) | 0, 39));
            const SpotType = loadSpotType();
            releaseReferences(SpotType, 'm_pConfigClient');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ke.B(' + guard + ')');
        }
    }

    private magnitude = 32768; // sd.Q:I

    // sd.<init>()V
    constructor() {
        super(3, false);
    }

    // sd.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.magnitude = requireNonNull(packet).g2() << 4;
        else if (code === 1) this.monochrome = requireNonNull(packet).g1() === 1;
    }

    // sd.b(I)V
    override postDecode(): void {
        TextureOp.initTrigTables();
    }

    // sd.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const angles = this.getChildMonochromeOutput(1, row);
            const lengths = this.getChildMonochromeOutput(2, row);
            for (let x = 0; x < TextureOp.width; x++) {
                const angle = (arrayAtI32(angles, x) >> 4) & 255;
                const length = Math.imul(arrayAtI32(lengths, x), this.magnitude) >> 12;
                const dx = Math.imul(arrayAtI32(TextureOp.cosine, angle), length) >> 12;
                const sx = (x + (dx >> 12)) & TextureOp.widthMask;
                const dy = Math.imul(length, arrayAtI32(TextureOp.sinTable, angle)) >> 12;
                const sy = (row + (dy >> 12)) & TextureOp.heightMask;
                const source = this.getChildMonochromeOutput(0, sy);
                arrayPutI32(output, x, arrayAtI32(source, sx));
            }
        }
        return output;
    }

    // sd.a(ZI)[[I
    override getColourOutput(row: number): ColourImageRow | null {
        const output = requireNonNull(this.colourImageCache).get(row);
        if (requireNonNull(this.colourImageCache).invalid) {
            const angles = this.getChildMonochromeOutput(1, row);
            const lengths = this.getChildMonochromeOutput(2, row);
            const r = arrayAtObj(output, 0),
                b = arrayAtObj(output, 2),
                g = arrayAtObj(output, 1);
            for (let x = 0; x < TextureOp.width; x++) {
                const angle = (1046028 & Math.imul(255, arrayAtI32(angles, x))) >> 12;
                const length = Math.imul(this.magnitude, arrayAtI32(lengths, x)) >> 12;
                const dx = Math.imul(length, arrayAtI32(TextureOp.cosine, angle)) >> 12;
                const dy = Math.imul(length, arrayAtI32(TextureOp.sinTable, angle)) >> 12;
                const sx = (x + (dx >> 12)) & TextureOp.widthMask;
                const sy = (row + (dy >> 12)) & TextureOp.heightMask;
                const source = this.getChildColourOutput(sy, 0);
                arrayPutI32(r, x, arrayAtI32(arrayAtObj(source, 0), sx));
                arrayPutI32(g, x, arrayAtI32(arrayAtObj(source, 1), sx));
                arrayPutI32(b, x, arrayAtI32(arrayAtObj(source, 2), sx));
            }
        }
        return output;
    }
}
