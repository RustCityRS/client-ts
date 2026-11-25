import type ByteBuffer from '#/util/nio/ByteBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtF32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import type Extract from './Extract';
import Mipmap from './Mipmap';

// com.sun.opengl.impl.mipmap.Extract2101010rev: the Extract for GL_UNSIGNED_INT_2_10_10_10_REV (RGBA in bits 9-0, 19-10, 29-20, 31-30).
// extract reads an int at the buffer's position in its byte order (advancing it), swapped when isSwap, into a Java
// long (sign-extended: the bigint below); shove packs into a long and writes its low int at `index` of an IntBuffer
// view made at the buffer's current position.
export default class Extract2101010rev implements Extract {
    // com.sun.opengl.impl.mipmap.Extract2101010rev.$assertionsDisabled:Z
    // <clinit> sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$Extract2101010rev cache); true on the client JVM (no -ea).
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.Extract2101010rev.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.Extract2101010rev.extract(ZLjava/nio/ByteBuffer;[F)V
    extract(isSwap: boolean, packedPixel: ByteBuffer | null, extractComponents: Float32Array | null): void {
        const f = Math.fround;
        let uint = 0n;
        if (isSwap) {
            uint = BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(requireNonNull(packedPixel).getInt()));
        } else {
            uint = BigInt(-1 & requireNonNull(packedPixel).getInt());
        }
        arrayPutF32(extractComponents, 0, f(f(Number(uint & 1023n)) / 1023));
        arrayPutF32(extractComponents, 1, f(f(Number((uint & 1047552n) >> 10n)) / 1023));
        arrayPutF32(extractComponents, 2, f(f(Number((uint & 1072693248n) >> 20n)) / 1023));
        arrayPutF32(extractComponents, 3, f(f(Number((uint & -1073741824n) >> 30n)) / 3));
    }

    // com.sun.opengl.impl.mipmap.Extract2101010rev.shove([FILjava/nio/ByteBuffer;)V
    shove(shoveComponents: Float32Array | null, index: number, packedPixel: ByteBuffer | null): void {
        const f = Math.fround;
        if (!Extract2101010rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 0) && arrayAtF32(shoveComponents, 0) <= 1)) throw new JavaError('AssertionError');
        if (!Extract2101010rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 1) && arrayAtF32(shoveComponents, 1) <= 1)) throw new JavaError('AssertionError');
        if (!Extract2101010rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 2) && arrayAtF32(shoveComponents, 2) <= 1)) throw new JavaError('AssertionError');
        if (!Extract2101010rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 3) && arrayAtF32(shoveComponents, 3) <= 1)) throw new JavaError('AssertionError');

        let uint = BigInt(doubleToInt(f(f(arrayAtF32(shoveComponents, 0) * 1023) + 0.5)) & 0x03ff);
        uint |= BigInt((doubleToInt(f(f(arrayAtF32(shoveComponents, 1) * 1023) + 0.5)) << 10) & 0x000ffc00);
        uint |= BigInt((doubleToInt(f(f(arrayAtF32(shoveComponents, 2) * 1023) + 0.5)) << 20) & 0x3ff00000);
        uint |= BigInt((doubleToInt(f(f(arrayAtF32(shoveComponents, 3) * 3) + 0.5)) << 30) & -1073741824);
        requireNonNull(packedPixel)
            .asIntBuffer()
            .put(index, Number(BigInt.asIntN(32, uint)));
    }
}
