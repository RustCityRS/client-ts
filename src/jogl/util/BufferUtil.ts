import ByteBuffer from '#/util/nio/ByteBuffer';
import ByteOrder from '#/util/nio/ByteOrder';
import type FloatBuffer from '#/util/nio/FloatBuffer';
import type IntBuffer from '#/util/nio/IntBuffer';
import type ShortBuffer from '#/util/nio/ShortBuffer';

// com.sun.opengl.util.BufferUtil as shipped in the 530 HD jogl.jar (shrunk by ProGuard to the five members below).
// GLU.copyToByteBuffer(Ljava/nio/Buffer;)Ljava/nio/ByteBuffer; is the only caller: it copies a ByteBuffer whose
// position is not 0, or any Short/Int/FloatBuffer, into a new native-order direct ByteBuffer before mipmapping.
// The client passes ByteBuffer.wrap(byte[]) at position 0, so it never gets here; the port is complete anyway.
export default class BufferUtil {
    // com.sun.opengl.util.BufferUtil.<init>() was removed by ProGuard; the class is static-only.
    private constructor() {}

    // com.sun.opengl.util.BufferUtil.newByteBuffer(I)Ljava/nio/ByteBuffer;
    static newByteBuffer(numElements: number): ByteBuffer {
        const bb = ByteBuffer.allocateDirect(numElements);
        bb.order(ByteOrder.nativeOrder());
        return bb;
    }

    // com.sun.opengl.util.BufferUtil.copyByteBuffer(Ljava/nio/ByteBuffer;)Ljava/nio/ByteBuffer;
    static copyByteBuffer(orig: ByteBuffer): ByteBuffer {
        const dest = BufferUtil.newByteBuffer(orig.remaining());
        orig.mark();
        dest.put(orig);
        orig.reset();
        dest.rewind();
        return dest;
    }

    // com.sun.opengl.util.BufferUtil.copyFloatBufferAsByteBuffer(Ljava/nio/FloatBuffer;)Ljava/nio/ByteBuffer;
    static copyFloatBufferAsByteBuffer(orig: FloatBuffer): ByteBuffer {
        const dest = BufferUtil.newByteBuffer(Math.imul(orig.remaining(), 4));
        orig.mark();
        dest.asFloatBuffer().put(orig);
        orig.reset();
        dest.rewind();
        return dest;
    }

    // com.sun.opengl.util.BufferUtil.copyIntBufferAsByteBuffer(Ljava/nio/IntBuffer;)Ljava/nio/ByteBuffer;
    static copyIntBufferAsByteBuffer(orig: IntBuffer): ByteBuffer {
        const dest = BufferUtil.newByteBuffer(Math.imul(orig.remaining(), 4));
        orig.mark();
        dest.asIntBuffer().put(orig);
        orig.reset();
        dest.rewind();
        return dest;
    }

    // com.sun.opengl.util.BufferUtil.copyShortBufferAsByteBuffer(Ljava/nio/ShortBuffer;)Ljava/nio/ByteBuffer;
    static copyShortBufferAsByteBuffer(orig: ShortBuffer): ByteBuffer {
        const dest = BufferUtil.newByteBuffer(Math.imul(orig.remaining(), 2));
        orig.mark();
        dest.asShortBuffer().put(orig);
        orig.reset();
        dest.rewind();
        return dest;
    }
}
