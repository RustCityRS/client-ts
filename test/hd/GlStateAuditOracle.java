import java.awt.*;
import java.lang.reflect.*;
import java.nio.file.Path;
import javax.media.opengl.*;

/**
 * Runs gamepack materials and tf.h on the headless responder by default.
 * Pass the output directory as the first argument. Add the original windows-amd64 native
 * directory as the second argument to record the same calls on the hardware JOGL driver.
 */
public final class GlStateAuditOracle {
    static int integer(GL gl, int pname) {
        int[] value = {-1};
        gl.glGetIntegerv(pname, value, 0);
        return value[0];
    }

    static void materials(GlRecorder recorder, GL gl, GL device) throws ReflectiveOperationException {
        tf.t = gl;
        Method caps = tf.class.getDeclaredMethod("m");
        caps.setAccessible(true);
        if ((int)caps.invoke(null) != 0) throw new AssertionError("530 capability probe failed");
        od.c = true;
        // Real cubemap generator makes three textures, each with six populated 64x64 alpha faces.
        vm cubemaps = new vm();
        cubemaps.b();
        cubemaps.a(2);
        recorder.mark("cubemap-bound");
        if (device != null) {
            int active = integer(device, 34016);
            device.glActiveTexture(33985);
            System.out.println("unit " + active + ", unit1 cube " + integer(device, 34068));
            device.glActiveTexture(active);
        }
        cubemaps.a();
        // Exercise the jar's 2D fallback on hardware that also supports its native 3D path.
        if (Boolean.getBoolean("gltrace.forceSlices")) tf.r = false;
        lm.c();
        bb.M = 37; qc.cb = -128; sj.D = 92; ej.X = 512; uj.H = 256;
        rd water = new rd();
        water.b();
        mk.a(0x204080, 0.5f, 0.75f, 0.25f);
        water.a(0);
        recorder.mark("water-local-66");
        water.a();
        // tf.h saves both selectors, copies FRONT_LEFT into BACK_LEFT, then restores the saved pair.
        gl.glDrawBuffer(1028); // GL_FRONT
        gl.glReadBuffer(1026); // GL_BACK_LEFT
        tf.J = tf.A = 32;
        tf.h();
        if (integer(gl, 3073) != 1028 || integer(gl, 3074) != 1026) throw new AssertionError("tf.h did not restore read/draw buffers");
        recorder.mark("buffers-restored");
    }

    public static void main(String[] args) throws Exception {
        try (GlRecorder recorder = new GlRecorder(Path.of(args[0]))) {
            if (args.length == 1) {
                materials(recorder, recorder.gl(), null);
                return;
            }
            Path natives = Path.of(args[1]).toAbsolutePath();
            System.loadLibrary("jawt");
            System.load(natives.resolve("jogl.dll").toString());
            System.load(natives.resolve("jogl_awt.dll").toString());
            Frame frame = new Frame();
            try {
                Canvas canvas = new Canvas();
                canvas.setPreferredSize(new Dimension(64, 64));
                frame.add(canvas);
                frame.pack(); // Creates the heavyweight peer. The frame stays hidden.
                GLDrawable drawable = GLDrawableFactory.getFactory().getGLDrawable(canvas, new GLCapabilities(), null);
                drawable.setRealized(true);
                GLContext context = drawable.createContext(null);
                try {
                    if (context.makeCurrent() == 0) throw new IllegalStateException("Could not make the hidden JOGL surface current");
                    GL device = context.getGL();
                    System.out.println(device.glGetString(7937));
                    GL gl = recorder.gl((p, method, values) -> {
                        try { return method.invoke(device, values); }
                        catch (InvocationTargetException e) { throw e.getCause(); }
                    });
                    materials(recorder, gl, device);
                } finally {
                    if (GLContext.getCurrent() == context) context.release();
                    context.destroy();
                    drawable.setRealized(false);
                }
            } finally { frame.dispose(); }
        }
    }
}
