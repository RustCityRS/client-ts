import type ByteBuffer from '#/util/nio/ByteBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtF32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import type Extract from './Extract';
import Mipmap from './Mipmap';

// com.sun.opengl.impl.mipmap.Extract8888rev: the Extract for GL_UNSIGNED_INT_8_8_8_8_REV (RGBA in bits 7-0, 15-8, 23-16, 31-24).
// extract reads an int at the buffer's position in its byte order (advancing it), swapped when isSwap, into a Java
// long (sign-extended: the bigint below); shove packs into a long and writes its low int at `index` of an IntBuffer
// view made at the buffer's current position.
export default class Extract8888rev implements Extract {
    // com.sun.opengl.impl.mipmap.Extract8888rev.$assertionsDisabled:Z
    // <clinit> sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$Extract8888rev cache); true on the client JVM (no -ea).
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.Extract8888rev.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.Extract8888rev.extract(ZLjava/nio/ByteBuffer;[F)V
    extract(isSwap: boolean, packedPixel: ByteBuffer | null, extractComponents: Float32Array | null): void {
        const f = Math.fround;
        let uint = 0n;
        if (isSwap) {
            uint = BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(requireNonNull(packedPixel).getInt()));
        } else {
            uint = BigInt(-1 & requireNonNull(packedPixel).getInt());
        }
        arrayPutF32(extractComponents, 0, f(f(Number(uint & 255n)) / 255));
        arrayPutF32(extractComponents, 1, f(f(Number((uint & 65280n) >> 8n)) / 255));
        arrayPutF32(extractComponents, 2, f(f(Number((uint & 16711680n) >> 16n)) / 255));
        arrayPutF32(extractComponents, 3, f(f(Number((uint & -16777216n) >> 24n)) / 255));
    }

    // com.sun.opengl.impl.mipmap.Extract8888rev.shove([FILjava/nio/ByteBuffer;)V
    shove(shoveComponents: Float32Array | null, index: number, packedPixel: ByteBuffer | null): void {
        const f = Math.fround;
        if (!Extract8888rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 0) && arrayAtF32(shoveComponents, 0) <= 1)) throw new JavaError('AssertionError');
        if (!Extract8888rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 1) && arrayAtF32(shoveComponents, 1) <= 1)) throw new JavaError('AssertionError');
        if (!Extract8888rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 2) && arrayAtF32(shoveComponents, 2) <= 1)) throw new JavaError('AssertionError');
        if (!Extract8888rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 3) && arrayAtF32(shoveComponents, 3) <= 1)) throw new JavaError('AssertionError');

        let uint = BigInt(doubleToInt(f(f(arrayAtF32(shoveComponents, 0) * 255) + 0.5)) & 0x00ff);
        uint |= BigInt((doubleToInt(f(f(arrayAtF32(shoveComponents, 1) * 255) + 0.5)) << 8) & 0xff00);
        uint |= BigInt((doubleToInt(f(f(arrayAtF32(shoveComponents, 2) * 255) + 0.5)) << 16) & 0x00ff0000);
        uint |= BigInt((doubleToInt(f(f(arrayAtF32(shoveComponents, 3) * 255) + 0.5)) << 24) & -16777216);
        requireNonNull(packedPixel)
            .asIntBuffer()
            .put(index, Number(BigInt.asIntN(32, uint)));
    }
}
