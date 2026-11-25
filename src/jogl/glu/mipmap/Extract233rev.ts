import type ByteBuffer from '#/util/nio/ByteBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtF32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import type Extract from './Extract';

// com.sun.opengl.impl.mipmap.Extract233rev: the Extract for GL_UNSIGNED_BYTE_2_3_3_REV (RGB in bits 2-0, 5-3, 7-6).
// extract reads one byte at the buffer's position; shove positions the buffer at index and writes one byte (unlike
// Extract332's absolute put, it leaves the position at index + 1).
export default class Extract233rev implements Extract {
    // com.sun.opengl.impl.mipmap.Extract233rev.$assertionsDisabled:Z
    // <clinit> sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$Extract233rev cache); true on the client JVM (no -ea).
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.Extract233rev.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.Extract233rev.extract(ZLjava/nio/ByteBuffer;[F)V
    extract(_isSwap: boolean, packedPixel: ByteBuffer | null, extractComponents: Float32Array | null): void {
        const f = Math.fround;
        // 11100000 == 0xe0
        // 00011100 == 0x1c
        // 00000011 == 0x03
        const ubyte = requireNonNull(packedPixel).get();
        arrayPutF32(extractComponents, 0, f(f(ubyte & 0x07) / 7));
        arrayPutF32(extractComponents, 1, f(f((ubyte & 0x38) >> 3) / 7));
        arrayPutF32(extractComponents, 2, f(f((ubyte & 0xc0) >> 6) / 3));
    }

    // com.sun.opengl.impl.mipmap.Extract233rev.shove([FILjava/nio/ByteBuffer;)V
    shove(shoveComponents: Float32Array | null, index: number, packedPixel: ByteBuffer | null): void {
        const f = Math.fround;
        // 0x07 0x38 0xc0
        if (!Extract233rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 0) && arrayAtF32(shoveComponents, 0) <= 1)) throw new JavaError('AssertionError');
        if (!Extract233rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 1) && arrayAtF32(shoveComponents, 1) <= 1)) throw new JavaError('AssertionError');
        if (!Extract233rev.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 2) && arrayAtF32(shoveComponents, 2) <= 1)) throw new JavaError('AssertionError');

        let b = ((doubleToInt(f(f(arrayAtF32(shoveComponents, 0) * 7) + 0.5)) & 0x00000007) << 24) >> 24;
        b = ((b | ((((doubleToInt(f(f(arrayAtF32(shoveComponents, 1) * 7) + 0.5)) << 3) & 0x00000038) << 24) >> 24)) << 24) >> 24;
        b = ((b | ((((doubleToInt(f(f(arrayAtF32(shoveComponents, 2) * 3) + 0.5)) << 6) & 0x000000c0) << 24) >> 24)) << 24) >> 24;
        const buffer = requireNonNull(packedPixel);
        buffer.position(index);
        buffer.put(b);
    }
}
