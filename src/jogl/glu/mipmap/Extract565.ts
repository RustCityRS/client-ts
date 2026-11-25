import type ByteBuffer from '#/util/nio/ByteBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtF32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import type Extract from './Extract';
import Mipmap from './Mipmap';

// com.sun.opengl.impl.mipmap.Extract565: the Extract for GL_UNSIGNED_SHORT_5_6_5 (RGB in bits 15-11, 10-5, 4-0).
// extract reads a short at the buffer's position in its byte order (advancing it), swapped when isSwap; shove writes
// the packed short at `index` of a ShortBuffer view made at the buffer's current position.
export default class Extract565 implements Extract {
    // com.sun.opengl.impl.mipmap.Extract565.$assertionsDisabled:Z
    // <clinit> sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$Extract565 cache); true on the client JVM (no -ea).
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.Extract565.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.Extract565.extract(ZLjava/nio/ByteBuffer;[F)V
    extract(isSwap: boolean, packedPixel: ByteBuffer | null, extractComponents: Float32Array | null): void {
        const f = Math.fround;
        let ushort = 0;
        if (isSwap) {
            ushort = 0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(requireNonNull(packedPixel).getShort());
        } else {
            ushort = 0x0000ffff & requireNonNull(packedPixel).getShort();
        }
        arrayPutF32(extractComponents, 0, f(f((ushort & 0xf800) >> 11) / 31));
        arrayPutF32(extractComponents, 1, f(f((ushort & 0x07e0) >> 5) / 63));
        arrayPutF32(extractComponents, 2, f(f(ushort & 0x001f) / 31));
    }

    // com.sun.opengl.impl.mipmap.Extract565.shove([FILjava/nio/ByteBuffer;)V
    shove(shoveComponents: Float32Array | null, index: number, packedPixel: ByteBuffer | null): void {
        const f = Math.fround;
        if (!Extract565.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 0) && arrayAtF32(shoveComponents, 0) <= 1)) throw new JavaError('AssertionError');
        if (!Extract565.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 1) && arrayAtF32(shoveComponents, 1) <= 1)) throw new JavaError('AssertionError');
        if (!Extract565.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 2) && arrayAtF32(shoveComponents, 2) <= 1)) throw new JavaError('AssertionError');

        let ushort = (doubleToInt(f(f(arrayAtF32(shoveComponents, 0) * 31) + 0.5)) << 11) & 0xf800;
        ushort |= (doubleToInt(f(f(arrayAtF32(shoveComponents, 1) * 63) + 0.5)) << 5) & 0x07e0;
        ushort |= doubleToInt(f(f(arrayAtF32(shoveComponents, 2) * 31) + 0.5)) & 0x001f;
        requireNonNull(packedPixel)
            .asShortBuffer()
            .put(index, (ushort << 16) >> 16);
    }
}
