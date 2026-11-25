import type { GL } from './GL';
import GLContext from './GLContext';
import GLException from './GLException';
import Mipmap from '#/jogl/glu/mipmap/Mipmap';
import BufferUtil from '#/jogl/util/BufferUtil';
import type Buffer from '#/util/nio/Buffer';
import ByteBuffer from '#/util/nio/ByteBuffer';
import FloatBuffer from '#/util/nio/FloatBuffer';
import IntBuffer from '#/util/nio/IntBuffer';
import ShortBuffer from '#/util/nio/ShortBuffer';

// javax.media.opengl.glu.GLU as shipped in the 530 HD jogl.jar (JOGL 1.1.x, shrunk by ProGuard): the class keeps
// exactly the four members below, and no constants (javac inlined them).
// runescape_gl.jar uses it once: uh.a(Lve;Lm;IZ)Z pc432-461 runs
//   new GLU().gluBuild2DMipmaps(GL_TEXTURE_2D, GL_RGBA, size, size, GL_RGBA, GL_UNSIGNED_BYTE, ByteBuffer.wrap(rgba))
// with size 128 (or 64 when its boolean argument is set), ignores the result, then sets the texture's MIN/MAG
// filters itself. The mipmap code (glu/mipmap/) issues its own nested GL calls on the current context's GL.
export default class GLU {
    // javax.media.opengl.glu.GLU.<init>()V
    constructor() {}

    // javax.media.opengl.glu.GLU.getCurrentGL()Ljavax/media/opengl/GL;
    static getCurrentGL(): GL {
        const curContext = GLContext.getCurrent();
        if (curContext === null) {
            throw new GLException('No OpenGL context current on this thread');
        }
        return curContext.getGL();
    }

    // javax.media.opengl.glu.GLU.copyToByteBuffer(Ljava/nio/Buffer;)Ljava/nio/ByteBuffer;
    // A null buffer matches no instanceof test, so it ends in the IllegalArgumentException, as in Java.
    private copyToByteBuffer(buf: Buffer | null): ByteBuffer {
        if (buf instanceof ByteBuffer) {
            if (buf.position() === 0) {
                return buf;
            }
            return BufferUtil.copyByteBuffer(buf);
        } else if (buf instanceof ShortBuffer) {
            return BufferUtil.copyShortBufferAsByteBuffer(buf);
        } else if (buf instanceof IntBuffer) {
            return BufferUtil.copyIntBufferAsByteBuffer(buf);
        } else if (buf instanceof FloatBuffer) {
            return BufferUtil.copyFloatBufferAsByteBuffer(buf);
        } else {
            throw new Error('IllegalArgumentException: Unsupported buffer type (must be one of byte, short, int, or float)');
        }
    }

    // javax.media.opengl.glu.GLU.gluBuild2DMipmaps(IIIIIILjava/nio/Buffer;)I
    // The buffer is copied (or checked) before the current GL is looked up, as in Java.
    gluBuild2DMipmaps(target: number, internalFormat: number, width: number, height: number, format: number, type: number, data: Buffer | null): number {
        const buf = this.copyToByteBuffer(data);
        return Mipmap.gluBuild2DMipmaps(GLU.getCurrentGL(), target, internalFormat, width, height, format, type, buf);
    }
}
