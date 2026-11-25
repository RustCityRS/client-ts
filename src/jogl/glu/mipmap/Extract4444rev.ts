import type ByteBuffer from '#/util/nio/ByteBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtF32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import type Extract from './Extract';
import Mipmap from './Mipmap';

// com.sun.opengl.impl.mipmap.Extract4444rev: the Extract for GL_UNSIGNED_SHORT_4_4_4_4_REV (RGBA in bits 3-0, 7-4, 11-8, 15-12).
// extract reads a short at the buffer's position in its byte order (advancing it), swapped when isSwap; shove writes
// the packed short at `index` of a ShortBuffer view made at the buffer's current position.
export default class Extract4444rev implements Extract {
    // com.sun.opengl.impl.mipmap.Extract4444rev.$assertionsDisabled:Z
    // <clinit> sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$Extract4444rev cache); true on the client JVM (no -ea).
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.Extract4444rev.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.Extract4444rev.extract(ZLjava/nio/ByteBuffer;[F)V
    extract(isSwap: boolean, packedPixel: ByteBuffer | null, extractComponents: Float32Array | null): void {
        const f = Math.fround;
        let ushort = 0;
        if (isSwap) {
            ushort = 0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(requireNonNull(packedPixel).getShort());
        } else {
            ushort = 0x0000ffff & requireNonNull(packedPixel).getShort();
        }
        arrayPutF32(extractComponents, 0, f(f(ushort & 0x000f) / 15));
        arrayPutF32(extractComponents, 1, f(f((ushort & 0x00f0) >> 4) / 15));
        arrayPutF32(extractComponents, 2, f(f((ushort & 0x0f00) >> 8) / 15));
        arrayPutF32(extractComponents, 3, f(f((ushort & 0xf000) >> 12) / 15));
    }

    // com.sun.opengl.impl.mipmap.Extract4444rev.shove([FILjava/nio/ByteBuffer;)V
    shove(shoveComponents: Float32Array | null, index: number, packedPixel: ByteBuffer | null): void {
        const f = Math.fround;
        if (!Extract4444rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 0) && arrayAtF32(shoveComponents, 0) <= 1)) throw new JavaError('AssertionError');
        if (!Extract4444rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 1) && arrayAtF32(shoveComponents, 1) <= 1)) throw new JavaError('AssertionError');
        if (!Extract4444rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 2) && arrayAtF32(shoveComponents, 2) <= 1)) throw new JavaError('AssertionError');
        if (!Extract4444rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 3) && arrayAtF32(shoveComponents, 3) <= 1)) throw new JavaError('AssertionError');

        let ushort = doubleToInt(f(f(arrayAtF32(shoveComponents, 0) * 15) + 0.5)) & 0x000f;
        ushort |= (doubleToInt(f(f(arrayAtF32(shoveComponents, 1) * 15) + 0.5)) << 4) & 0x00f0;
        ushort |= (doubleToInt(f(f(arrayAtF32(shoveComponents, 2) * 15) + 0.5)) << 8) & 0x0f00;
        ushort |= (doubleToInt(f(f(arrayAtF32(shoveComponents, 3) * 15) + 0.5)) << 12) & 0xf000;
        requireNonNull(packedPixel)
            .asShortBuffer()
            .put(index, (ushort << 16) >> 16);
    }
}
