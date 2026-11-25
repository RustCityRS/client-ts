import java.lang.reflect.*;
import java.lang.invoke.MethodType;
import java.nio.*;
import java.nio.file.*;
import java.util.*;
import javax.media.opengl.*;
import javax.media.opengl.glu.GLU;

/** Drives real tf/rd methods and JOGL's packaged mipmap implementation in one context. */
public final class GlRecorderOracle {
    static Object field(String name) throws Exception {
        Field field = tf.class.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(null);
    }

    static void mipmaps(int size) {
        ByteBuffer rgba = ByteBuffer.allocateDirect(size * size * 4);
        for (int y = 0; y < size; y++) for (int x = 0; x < size; x++) {
            rgba.put((byte)(x * 11 + y * 23)).put((byte)(x ^ y)).put((byte)(x * y)).put((byte)(255 - y));
        }
        rgba.flip();
        int result = new GLU().gluBuild2DMipmaps(3553, 6408, size, size, 6408, 5121, rgba);
        if (result != 0 || rgba.position() != 0) throw new AssertionError("GLU mipmap " + result + ", " + rgba);
    }

    // Exercise every overload present in the shrunk JOGL interface, in stable JVM-signature order.
    static void surface(GL gl) throws Exception {
        Method[] methods = GL.class.getDeclaredMethods();
        Arrays.sort(methods, Comparator.comparing(m -> m.getName() + MethodType.methodType(m.getReturnType(), m.getParameterTypes()).descriptorString()));
        for (Method method : methods) {
            Class<?>[] params = method.getParameterTypes();
            Object[] args = new Object[params.length];
            for (int i = 0; i < params.length; i++) {
                Class<?> type = params[i];
                if (type == int.class) args[i] = 1;
                else if (type == long.class) args[i] = -4294967297L;
                else if (type == float.class) args[i] = -0.25f;
                else if (type == double.class) args[i] = 1.25d;
                else if (type == boolean.class) args[i] = true;
                else if (type == byte.class) args[i] = (byte)-93;
                else if (type == String.class) args[i] = "% \u0394\ud83d\ude42\ud800A\udc00";
                else if (type == int[].class) { int[] values = new int[17]; Arrays.fill(values, 551); args[i] = values; }
                else if (type == float[].class) { float[] values = new float[17]; Arrays.fill(values, -0.0f); args[i] = values; }
                else if (type == FloatBuffer.class) args[i] = FloatBuffer.wrap(new float[]{0.25f, 0.5f, 1, -0.0f});
                else if (type == Buffer.class) args[i] = ShortBuffer.wrap(new short[]{-1, 0, 0x1234, 0x4567}).position(1).limit(3);
                else throw new AssertionError(type);
            }
            try { method.invoke(gl, args); }
            catch (InvocationTargetException e) { throw new AssertionError(method.toString(), e.getCause()); }
        }
    }

    static void roundTrip(GL gl, GLDrawable drawable) {
        int[] ids = {-1, -1, -1, -1};
        gl.glGenTextures(2, ids, 1);
        gl.glBindTexture(3553, ids[2]);
        gl.glClearColor(-0.0f, 0.5f, -1.5f, 1);
        gl.glClearDepth(0.25);
        gl.glColor3ub((byte)-128, (byte)0, (byte)127);
        gl.glDepthMask(false);
        gl.glVertexPointer(3, 5126, 12, 4294967300L);
        gl.glLightfv(16384, 4608, new float[]{42, -0.0f, 0.25f, 0.5f, 1, 77}, 1);
        int[] units = {-9, -9, -9};
        gl.glGetIntegerv(34018, units, 1);
        ByteBuffer buffer = ByteBuffer.allocateDirect(8);
        buffer.put(new byte[]{-1, 1, 2, 3, 4, 5, 6, -2}).position(1).limit(7);
        gl.glBufferDataARB(34962, 6, buffer, 35044);
        gl.glDeleteTextures(1, ids, 1);
        drawable.swapBuffers();
        gl.glBindTexture(3553, ids[2]);
        gl.glBindTexture(3553, 811);
        gl.glGetString(7936);
        gl.glGetString(7939);
        gl.glGetString(-1);
        gl.isExtensionAvailable("GL_VERSION_4_6");
        gl.glColor4fv(new float[]{0.25f, -0.0f}, 0);
        gl.glProgramStringARB(34336, 34933, 6, "a\t% é");
        int[] partial = {0};
        try { gl.glGetIntegerv(3386, partial, 0); throw new AssertionError("Expected viewport output overrun"); }
        catch (IndexOutOfBoundsException expected) { if (partial[0] != 32768) throw new AssertionError("partial result"); }
        try { gl.glGenTextures(3, partial, 0); throw new AssertionError("Expected JOGL range check"); }
        catch (IndexOutOfBoundsException expected) {}
        try { gl.glLightfv(16384, 4608, new float[0], 0); throw new AssertionError("Expected JOGL offset check"); }
        catch (GLException expected) {}
        for (int target : new int[]{32867, 32868, 34075, 32880}) {
            gl.glTexImage3D(target, 1, 6408, 16, 8, 4, 0, 6408, 5121, null);
            for (int pname : new int[]{4096, 4097, 32881, -1}) gl.glGetTexLevelParameteriv(target, 1, pname, partial, 0);
        }
        drawable.swapBuffers();
    }

    static void ambient(GLContext first, GLDrawable drawable) {
        GL a = first.getGL();
        float[] expected = {0.2f, 0.2f, 0.2f, 1f};
        float[] out = new float[4];
        a.glGetFloatv(2899, out, 0);
        if (!Arrays.equals(out, expected)) throw new AssertionError("initial ambient");
        int[] buffers = new int[2];
        a.glDrawBuffer(1028);
        a.glReadBuffer(1026);
        float[] source = {77, 0.375f, -0.5f, 1.25f, -0.0f, 88};
        a.glLightModelfv(2899, source, 1);
        Arrays.fill(source, 0);
        GLContext second = drawable.createContext(null);
        if (second.makeCurrent() != 2) throw new AssertionError("second context");
        GL b = second.getGL();
        b.glGetIntegerv(3073, buffers, 0);
        b.glGetIntegerv(3074, buffers, 1);
        if (!Arrays.equals(buffers, new int[]{1029, 1029})) throw new AssertionError("buffers leaked to second context");
        b.glGetFloatv(2899, out, 0);
        if (!Arrays.equals(out, expected)) throw new AssertionError("ambient leaked to second context");
        b.glLightModelfv(2899, new float[]{1, 1, 0, 1}, 0);
        if (first.makeCurrent() != 1) throw new AssertionError("restored context");
        a.glGetIntegerv(3073, buffers, 0);
        a.glGetIntegerv(3074, buffers, 1);
        if (!Arrays.equals(buffers, new int[]{1028, 1026})) throw new AssertionError("first context lost its buffers");
        FloatBuffer words = FloatBuffer.allocate(6).position(2);
        a.glGetFloatv(2899, words);
        if (words.position() != 2 || !Arrays.equals(words.array(), new float[]{0, 0, 0.375f, -0.5f, 1.25f, -0.0f}))
            throw new AssertionError("first context lost its ambient");
        second.destroy();
    }

    public static void main(String[] args) throws Exception {
        GlRecorder recorder = new GlRecorder(Path.of(args[0]));
        GL gl = recorder.gl();
        GLDrawable drawable = recorder.drawable(null);
        if (!args[1].equals("jar")) {
            GLCapabilities caps = new GLCapabilities();
            caps.setSampleBuffers(true);
            caps.setNumSamples(2);
            drawable = recorder.factory().getGLDrawable(new java.awt.Canvas(), caps, null);
            GLContext context = drawable.createContext(null);
            if (context.makeCurrent() != 0) throw new AssertionError("Unrealized drawable");
            drawable.setRealized(true);
            if (context.makeCurrent() != 2) throw new AssertionError("First context activation");
            if (args[1].equals("roundtrip")) {
                roundTrip(context.getGL(), drawable);
            } else if (args[1].equals("surface")) {
                surface(context.getGL());
                drawable.swapBuffers();
            } else if (args[1].equals("ambient")) {
                ambient(context, drawable);
            } else {
                for (int size : new int[]{128, 64}) {
                    mipmaps(size);
                    drawable.swapBuffers();
                }
            }
            context.release();
            context.destroy();
            if (context.makeCurrent() != 0) throw new AssertionError("Destroyed context");
        } else {
            GLContext context = recorder.context(gl);
            if (context.makeCurrent() != 2 || context.makeCurrent() != 1) throw new AssertionError("context");
            tf.t = context.getGL();
            Method probe = tf.class.getDeclaredMethod("m");
            probe.setAccessible(true);
            int result = (int)probe.invoke(null);
            System.out.println(result + " " + tf.e + " " + field("v") + " " + field("D") + " " + field("B")
                + " " + field("l") + " " + tf.n + " " + tf.r + " " + field("u") + " " + tf.y + " " + tf.C
                + " " + field("F") + " " + tf.H);
            lm.f = 9401;
            lm.b = new int[64];
            for (int i = 0; i < 64; i++) lm.b[i] = 8100 + i;
            lm.e = true;
            bb.M = 37; qc.cb = -128; sj.D = 92; ej.X = 512; uj.H = 256;
            mk.a(0x204080, 0.5f, 0.75f, 0.25f);
            rd program = new rd();
            program.b();
            program.a(0);
            program.a();
            drawable.swapBuffers();
            mipmaps(128);
            drawable.swapBuffers();
            mipmaps(64);
            drawable.swapBuffers();
            context.release();
            context.destroy();
        }
        recorder.close();
    }
}
