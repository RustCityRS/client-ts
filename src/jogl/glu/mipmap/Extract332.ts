import type ByteBuffer from '#/util/nio/ByteBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtF32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import type Extract from './Extract';

// com.sun.opengl.impl.mipmap.Extract332: the Extract for GL_UNSIGNED_BYTE_3_3_2 (RGB in bits 7-5, 4-2, 1-0).
// extract reads one byte at the buffer's position (advancing it); shove writes one byte at an absolute index.
export default class Extract332 implements Extract {
    // com.sun.opengl.impl.mipmap.Extract332.$assertionsDisabled:Z
    // <clinit> sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$Extract332 cache). The client JVM runs without -ea, so it is true and the
    // assert statements never evaluate their conditions.
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.Extract332.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.Extract332.extract(ZLjava/nio/ByteBuffer;[F)V
    extract(_isSwap: boolean, packedPixel: ByteBuffer | null, extractComponents: Float32Array | null): void {
        const f = Math.fround;
        const ubyte = requireNonNull(packedPixel).get();

        // 11100000 == 0xe0
        // 00011100 == 0x1c
        // 00000011 == 0x03
        arrayPutF32(extractComponents, 0, f(f((ubyte & 0xe0) >> 5) / 7));
        arrayPutF32(extractComponents, 1, f(f((ubyte & 0x1c) >> 2) / 7));
        arrayPutF32(extractComponents, 2, f(f(ubyte & 0x03) / 3));
    }

    // com.sun.opengl.impl.mipmap.Extract332.shove([FILjava/nio/ByteBuffer;)V
    shove(shoveComponents: Float32Array | null, index: number, packedPixel: ByteBuffer | null): void {
        const f = Math.fround;
        // 11100000 00011100 00000011
        if (!Extract332.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 0) && arrayAtF32(shoveComponents, 0) <= 1)) throw new JavaError('AssertionError');
        if (!Extract332.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 1) && arrayAtF32(shoveComponents, 1) <= 1)) throw new JavaError('AssertionError');
        if (!Extract332.$assertionsDisabled && !(0 <= arrayAtF32(shoveComponents, 2) && arrayAtF32(shoveComponents, 2) <= 1)) throw new JavaError('AssertionError');

        let b = (((doubleToInt(f(f(arrayAtF32(shoveComponents, 0) * 7) + 0.5)) << 5) & 0x000000e0) << 24) >> 24;
        b = ((b | ((((doubleToInt(f(f(arrayAtF32(shoveComponents, 1) * 7) + 0.5)) << 2) & 0x0000001c) << 24) >> 24)) << 24) >> 24;
        b = ((b | (((doubleToInt(f(f(arrayAtF32(shoveComponents, 2) * 3) + 0.5)) & 0x00000003) << 24) >> 24)) << 24) >> 24;
        requireNonNull(packedPixel).put(index, b);
    }
}
