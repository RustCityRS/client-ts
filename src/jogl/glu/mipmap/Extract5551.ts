import type ByteBuffer from '#/util/nio/ByteBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtF32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import type Extract from './Extract';
import Mipmap from './Mipmap';

// com.sun.opengl.impl.mipmap.Extract5551: the Extract for GL_UNSIGNED_SHORT_5_5_5_1 (RGBA in bits 15-11, 10-6, 5-1, 0).
// (sic) extract masks G with 0x00f0 >> 6 and B with 0x0f00 >> 1, and leaves A as the unshifted,
// undivided 0xf000 bits; shove packs all four channels correctly (A is (int)(a + 0.5f) & 1).
// extract reads a short at the buffer's position in its byte order (advancing it), swapped when isSwap; shove writes
// the packed short at `index` of a ShortBuffer view made at the buffer's current position.
export default class Extract5551 implements Extract {
    // com.sun.opengl.impl.mipmap.Extract5551.$assertionsDisabled:Z
    // <clinit> sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$Extract5551 cache); true on the client JVM (no -ea).
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.Extract5551.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.Extract5551.extract(ZLjava/nio/ByteBuffer;[F)V
    extract(isSwap: boolean, packedPixel: ByteBuffer | null, extractComponents: Float32Array | null): void {
        const f = Math.fround;
        let ushort = 0;
        if (isSwap) {
            ushort = 0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(requireNonNull(packedPixel).getShort());
        } else {
            ushort = 0x0000ffff & requireNonNull(packedPixel).getShort();
        }
        arrayPutF32(extractComponents, 0, f(f((ushort & 0xf800) >> 11) / 31));
        arrayPutF32(extractComponents, 1, f(f((ushort & 0x00f0) >> 6) / 31));
        arrayPutF32(extractComponents, 2, f(f((ushort & 0x0f00) >> 1) / 31));
        arrayPutF32(extractComponents, 3, f(ushort & 0xf000));
    }

    // com.sun.opengl.impl.mipmap.Extract5551.shove([FILjava/nio/ByteBuffer;)V
    shove(shoveComponents: Float32Array | null, index: number, packedPixel: ByteBuffer | null): void {
        const f = Math.fround;
        if (!Extract5551.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 0) && arrayAtF32(shoveComponents, 0) <= 1)) throw new JavaError('AssertionError');
        if (!Extract5551.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 1) && arrayAtF32(shoveComponents, 1) <= 1)) throw new JavaError('AssertionError');
        if (!Extract5551.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 2) && arrayAtF32(shoveComponents, 2) <= 1)) throw new JavaError('AssertionError');
        if (!Extract5551.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 3) && arrayAtF32(shoveComponents, 3) <= 1)) throw new JavaError('AssertionError');

        let ushort = (doubleToInt(f(f(arrayAtF32(shoveComponents, 0) * 31) + 0.5)) << 11) & 0xf800;
        ushort |= (doubleToInt(f(f(arrayAtF32(shoveComponents, 1) * 31) + 0.5)) << 6) & 0x07c0;
        ushort |= (doubleToInt(f(f(arrayAtF32(shoveComponents, 2) * 31) + 0.5)) << 1) & 0x003e;
        ushort |= doubleToInt(f(arrayAtF32(shoveComponents, 3) + 0.5)) & 0x0001;
        requireNonNull(packedPixel)
            .asShortBuffer()
            .put(index, (ushort << 16) >> 16);
    }
}
