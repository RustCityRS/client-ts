import java.awt.Canvas;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.file.Path;
import java.util.Locale;
import javax.media.opengl.*;

/**
 * Drives the original tf (GlRenderer) of runescape_gl.jar through GlRecorder: context creation and its failure
 * paths, the capability probe, the cached state setters, the projections, clears, swap, the front-to-back copy and
 * teardown; the "objects" scenario drives fa (GlCleaner), vi (GlBuffer) and sd (GlSolidTexture) on a recorder GL, and
 * the "points" scenario runs ga.a()V (GlRenderer.initPointParameters) after a successful init.
 * Prints status, the tf statics ("dump"), the fa byte counters, and, for the scenarios with a scripted platform, every
 * drawable and context call ("L"). gl-renderer.test.ts runs glRendererHarness.ts through the same scenarios.
 *
 * args: traceDir profile.json samples scenario
 */
public final class HdRendererOracle {
    static final class Display extends Canvas {
        final boolean displayable;
        Display(boolean displayable) { this.displayable = displayable; setSize(871, 613); }
        public boolean isDisplayable() { return displayable; }
    }

    static final String[] FIELDS = {"a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u",
        "v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K"};

    static Object get(Class<?> owner, String name) throws ReflectiveOperationException {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f.get(null);
    }

    static String value(Object v) {
        if (v == null) return "null";
        if (v instanceof String s) return '"' + s.replace("\\", "\\\\").replace("\"", "\\\"") + '"';
        if (v instanceof Float f) return "f:" + String.format("%08x", Float.floatToRawIntBits(f));
        if (v instanceof Boolean b) return b ? "T" : "F";
        if (v instanceof Integer i) return Integer.toString(i);
        if (v instanceof float[] a) {
            StringBuilder s = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) s.append(i == 0 ? "" : ",").append(String.format("%08x", Float.floatToRawIntBits(a[i])));
            return s.append(']').toString();
        }
        return "set";
    }

    static void dump() throws ReflectiveOperationException {
        StringBuilder s = new StringBuilder("dump");
        for (String name : FIELDS) s.append(' ').append(name).append('=').append(value(get(tf.class, name)));
        s.append(" fa.c=").append(fa.c).append(" clip=").append(tg.c).append(',').append(ub.m).append(',').append(a.g).append(',').append(li.x);
        System.out.println(s);
    }

    static void counters() {
        System.out.println("counters " + fa.a + " " + fa.e + " " + fa.f);
    }

    interface Step { void run() throws Throwable; }

    // A Java exception surfaces as "threw"; the TS port throws its own types at the same points.
    static void attempt(GlRecorder recorder, String label, Step step) throws ReflectiveOperationException {
        recorder.mark(label);
        try {
            step.run();
            System.out.println("ok " + label);
        } catch (Throwable t) {
            System.out.println("threw " + label);
        }
        dump();
    }

    // ---- a scripted platform: every drawable and context call is printed --------------------------------------
    static final class Platform extends GLDrawableFactory {
        final String mode;
        final GL gl;
        int contexts, makeCurrentCalls, swaps;
        Platform(String mode, GL gl) { this.mode = mode; this.gl = gl; }
        public GLDrawable getGLDrawable(Object target, GLCapabilities caps, GLCapabilitiesChooser chooser) {
            System.out.println("L getGLDrawable " + (target == null ? "null" : "canvas") + " "
                + (caps == null ? "null" : (caps.getSampleBuffers() ? "T" : "F") + ":" + caps.getNumSamples()) + " " + (chooser == null ? "null" : "chooser"));
            if (target == null) throw new IllegalArgumentException("Null target");
            return new Surface(this);
        }
    }

    static final class Surface implements GLDrawable {
        final Platform platform;
        Surface(Platform platform) { this.platform = platform; }
        public GLContext createContext(GLContext share) {
            int id = ++platform.contexts;
            System.out.println("L createContext " + id);
            if (platform.mode.equals("createThrows")) throw new GLException("no pixel format");
            return new Context(platform, id);
        }
        public void setRealized(boolean realized) { System.out.println("L setRealized " + (realized ? "T" : "F")); }
        public void swapBuffers() {
            int call = ++platform.swaps;
            if (platform.mode.equals("swapFail") || (platform.mode.equals("swap2") && call <= 2)) {
                System.out.println("L swapBuffers !> GLException");
                throw new GLException("swap");
            }
            System.out.println("L swapBuffers");
        }
    }

    static final class Context extends GLContext {
        final Platform platform;
        final int id;
        boolean created;
        Context(Platform platform, int id) { this.platform = platform; this.id = id; }
        public int makeCurrent() {
            int call = ++platform.makeCurrentCalls;
            if (getCurrent() == this) { System.out.println("L makeCurrent " + id + " => 1"); return 1; }
            setCurrent(null);
            switch (platform.mode) {
                case "mc0" -> { System.out.println("L makeCurrent " + id + " => 0"); return 0; }
                case "mcThrow2" -> {
                    if (call <= 2) { System.out.println("L makeCurrent " + id + " !> GLException"); throw new GLException("busy"); }
                }
                case "mcError" -> { System.out.println("L makeCurrent " + id + " !> Error"); throw new UnsatisfiedLinkError("no natives"); }
                default -> {}
            }
            int result = created ? 1 : 2;
            created = true;
            setCurrent(this);
            System.out.println("L makeCurrent " + id + " => " + result);
            return result;
        }
        public void release() { System.out.println("L release " + id); setCurrent(null); }
        public void destroy() { System.out.println("L destroy " + id); }
        public GL getGL() { System.out.println("L getGL " + id); return platform.gl; }
    }

    static AutoCloseable install(GLDrawableFactory factory) throws ReflectiveOperationException {
        Field field = GLDrawableFactory.class.getDeclaredField("factory");
        field.setAccessible(true);
        Object previous = field.get(null);
        field.set(null, factory);
        return () -> field.set(null, previous);
    }

    static long minimumSleep(String mode) {
        return switch (mode) { case "mc0" -> 6000; case "mcThrow2" -> 2000; case "swapFail" -> 600; case "swap2" -> 200; default -> 0; };
    }

    // ---- the state-cache, projection and teardown sequence run after a successful init ----------------------
    static void ops(GlRecorder recorder, Display screen, int samples) throws Throwable {
        attempt(recorder, "begin2dReplace", () -> tf.a());
        attempt(recorder, "begin2dFont", () -> tf.c());
        attempt(recorder, "begin2dModulate", () -> tf.e());
        attempt(recorder, "begin2dUntextured", () -> tf.i());
        attempt(recorder, "bindTexture2D", () -> { tf.c(tf.z); tf.c(tf.z); tf.c(100000); tf.c(-1); tf.c(-1); tf.c(100001); });
        attempt(recorder, "combineRgb", () -> { for (int m : new int[]{1, 1, 2, 3, 4, 5, 6, 0, 0, -1, 0}) tf.d(m); });
        attempt(recorder, "combineAlpha", () -> { for (int m : new int[]{2, 2, 1, 3, 0, 0, 1}) tf.a(m); });
        attempt(recorder, "toggles", () -> {
            tf.a(true); tf.a(false); tf.a(false); tf.a(true);
            tf.b(false); tf.b(false); tf.b(true);
            tf.c(true); tf.c(false); tf.c(true);
        });
        attempt(recorder, "lightingPreference", () -> { od.c = false; tf.p(); tf.p(); od.c = true; tf.p(); od.c = false; tf.p(); od.c = true; });
        attempt(recorder, "textureMatrix", () -> { tf.b(); tf.a(0.25f, -1.5f, 0.0f); tf.a(1e-3f, 7.0f, -0.0f); tf.b(); tf.b(); tf.a(3.0f, 0.0f, 0.0f); });
        attempt(recorder, "camera", () -> tf.a(0, 0, 512, 334, 256, 167, 0.0f, 0.0f, 512, 512));
        attempt(recorder, "cameraRotated", () -> tf.a(4, 7, 509, 331, 260, 170, 25.5f, -100.25f, 611, 389));
        attempt(recorder, "cameraNegative", () -> tf.a(-30, 900, 17, 3, 5000, -77, -0.0f, 1e-7f, 3, 1000));
        attempt(recorder, "depthBias", () -> {
            tf.a(3000.0f, 12.0f); tf.a(3000.0f, 12.0f); tf.a(3000.0f, 0.0f); tf.a(100.0f, 1e-3f); tf.a(-0.0f, -0.0f);
            tf.a(0.0f, 0.0f); tf.a(Float.NaN, 5.0f); tf.a(Float.NaN, 5.0f); tf.a(2.5f); tf.a(-301.75f);
            System.out.println("get " + value(tf.l()) + " " + value(tf.r()));
        });
        attempt(recorder, "perspective", () -> tf.a(256, 167, 512, 512));
        attempt(recorder, "depthBiasPerspective", () -> { tf.a(3000.0f, 48.0f); tf.a(17.5f, 0.375f); });
        attempt(recorder, "orthographic", () -> tf.a(100, 50, 700, 12, 256, 300));
        attempt(recorder, "orthographicOdd", () -> tf.a(-5, 9999, 1, -4000, 7, 3));
        attempt(recorder, "depthBias2d", () -> { tf.a(); tf.a(3000.0f, 5.0f); System.out.println("get " + value(tf.l()) + " " + value(tf.r())); });
        attempt(recorder, "clear", () -> { tf.b(0xc8c0a8); tf.b(-1); tf.b(0x123456); tf.b(0); tf.n(); tf.g(); tf.q(); });
        attempt(recorder, "copyFrontToBack", () -> { tf.c(tf.z); tf.h(); tf.h(); });
        attempt(recorder, "resize", () -> { tf.a(1024, 768); tf.i(); tf.a(1024, 768); tf.a(300, 200, 400, 400); tf.a(640, 480); tf.a(); });
        attempt(recorder, "swap", () -> tf.d());
        attempt(recorder, "divideByZeroX", () -> tf.a(0, 0, 10, 10, 0, 0, 0.0f, 0.0f, 0, 5));
        attempt(recorder, "divideByZeroY", () -> tf.a(0, 0, 10, 10, 0, 0, 0.0f, 0.0f, 5, 0));
        attempt(recorder, "shutdown", () -> tf.o());
        counters();
        attempt(recorder, "shutdownAgain", () -> tf.o());
        attempt(recorder, "swapWithoutDrawable", () -> tf.d());
        attempt(recorder, "resetCanvas", () -> tf.a(screen));
        attempt(recorder, "resetCanvasUndisplayable", () -> tf.a(new Display(false)));
        attempt(recorder, "resetCanvasNull", () -> tf.a((Canvas)null));
        recorder.mark("reinit");
        System.out.println("status " + tf.a(screen, samples));
        dump();
        attempt(recorder, "cameraAfterReinit", () -> tf.a(0, 0, 512, 334, 256, 167, 0.0f, 0.0f, 512, 512));
        attempt(recorder, "unload", () -> tf.k());
        attempt(recorder, "depthBiasAfterUnload", () -> tf.a(3000.0f, 7.0f));
        attempt(recorder, "begin2dAfterUnload", () -> tf.a());
        recorder.mark("initAfterUnload");
        System.out.println("status " + tf.a(screen, samples));
        dump();
    }


    // ---- fa, vi and sd on a recorder GL installed as tf.t ---------------------------------------------------------
    static final class Material implements pc {
        final int flags;
        Material(int flags) { this.flags = flags; }
        public void a() {}
        public void b() {}
        public void a(int argument) {}
        public int c() { return flags; }
    }

    static void finalize(Object target) throws Throwable {
        Method method = target.getClass().getDeclaredMethod("finalize");
        method.setAccessible(true);
        method.invoke(target);
    }

    static ByteBuffer bytes(int length, int step) {
        byte[] data = new byte[length];
        for (int i = 0; i < length; i++) data[i] = (byte)(i * step);
        return ByteBuffer.wrap(data);
    }

    static vi buffer, streamBuffer;
    static sd texture, texture2;

    static void objects(GlRecorder recorder) throws Throwable {
        tf.t = recorder.gl();
        attempt(recorder, "faQueue", () -> {
            fa.a = 5000; fa.e = 7000; fa.f = 9000;
            for (int i = 0; i < 1003; i++) fa.b(200000 + i, 3, 0);
            fa.b(1, 100, 1);
            for (int i = 0; i < 999; i++) fa.c(300000 + i, 1, 0);
            fa.a(400000, 50, 0); fa.a(400001, 60, 0); fa.a(400002, 70, 7);
            fa.a(500000, 0); fa.a(500001, 0); fa.a(500002, -1);
            fa.c();
        });
        counters();
        attempt(recorder, "faFlushEmpty", () -> fa.c());
        attempt(recorder, "faThreshold", () -> { fa.f = 0x6000000; fa.c(); fa.f = 0x6000001; fa.c(); fa.c(); fa.f = 0; });
        attempt(recorder, "faReset", () -> {
            fa.b(600000, 8, 0); fa.c(600001, 8, 0); fa.a(600002, 8, 0); fa.a(600003, 0);
            fa.b();
            fa.c();
            fa.b(600004, 8, 0); fa.b(600005, 8, 1); fa.c(600006, 4, 1); fa.a(600007, 2, 1); fa.a(600008, 1);
            fa.c();
        });
        counters();
        attempt(recorder, "viCreate", () -> { buffer = new vi(); streamBuffer = new vi(true); });
        counters();
        attempt(recorder, "viUpload", () -> {
            ByteBuffer small = bytes(16, 1), large = bytes(40, 3);
            buffer.c(small); buffer.a(small); buffer.a(large); buffer.a(small); buffer.b(small); buffer.a(); buffer.b();
            streamBuffer.c(small); streamBuffer.b(large); streamBuffer.a(large);
        });
        counters();
        attempt(recorder, "viNull", () -> buffer.a(null));
        attempt(recorder, "viFinalize", () -> { finalize(buffer); finalize(buffer); fa.c(); });
        counters();
        attempt(recorder, "viFinalizeOldGeneration", () -> { fa.b(); finalize(streamBuffer); fa.c(); });
        counters();
        hf.a[1234] = 0x123456;
        hf.a[65535] = 0xfedcba;
        hf.a[0] = -1;
        attempt(recorder, "sdCreate", () -> { texture = new sd(1234); texture2 = new sd(65535); new sd(0); });
        counters();
        attempt(recorder, "sdBind", () -> { dl.c = 0; texture.g((byte)6); texture2.g((byte)6); texture.g((byte)6); });
        attempt(recorder, "sdBindFlags", () -> {
            aa.t = new pc[7];
            aa.t[1] = new Material(4); aa.t[2] = new Material(2); aa.t[4] = new Material(15); aa.t[5] = new Material(1);
            tf.d(3); tf.a(2);
            dl.c = 1; texture2.g((byte)6);
            dl.c = 4; texture.g((byte)6);
            dl.c = 2; texture.g((byte)6);
            tf.d(3); tf.a(2);
            dl.c = 5; texture2.g((byte)6);
            dl.c = 0;
        });
        attempt(recorder, "sdFinalize", () -> { finalize(texture); finalize(texture); fa.c(); });
        counters();
        attempt(recorder, "sdBadColour", () -> new sd(65536));
        attempt(recorder, "sdNoGl", () -> { tf.t = null; new sd(1234); });
    }

    public static void main(String[] args) throws Throwable {
        Locale.setDefault(Locale.ROOT);
        int samples = Integer.parseInt(args[2]);
        String scenario = args[3];
        Display screen = new Display(true);
        try (GlRecorder recorder = new GlRecorder(Path.of(args[0]))) {
            recorder.loadProfile(Path.of(args[1]));
            dump();
            if (scenario.equals("init") || scenario.equals("ops") || scenario.equals("points")) {
                try (AutoCloseable factory = recorder.installFactory()) {
                    System.out.println("status " + tf.a(new Display(false), samples));
                    dump();
                    recorder.mark("init");
                    System.out.println("status " + tf.a(screen, samples));
                    dump();
                    if (scenario.equals("ops")) ops(recorder, screen, samples);
                    if (scenario.equals("points")) {
                        // ga.a()V (GlRenderer.initPointParameters), as lb.a(Z)V calls it once a context is up.
                        attempt(recorder, "pointParameters", () -> ga.a());
                        attempt(recorder, "pointParametersAgain", () -> ga.a());
                    }
                }
                return;
            }
            if (scenario.equals("objects")) {
                objects(recorder);
                return;
            }
            Platform platform = new Platform(scenario, recorder.gl());
            try (AutoCloseable factory = install(platform)) {
                recorder.mark("init");
                long start = System.nanoTime();
                int status = tf.a(scenario.equals("nullCanvas") ? null : screen, samples);
                long elapsed = (System.nanoTime() - start) / 1_000_000;
                System.out.println("status " + status);
                System.out.println("slept " + (elapsed >= minimumSleep(scenario) ? "T" : "F"));
                System.out.println("current " + (GLContext.getCurrent() == null ? "null" : GLContext.getCurrent() == get(tf.class, "p") ? "p" : "other"));
                dump();
                if (status == 0) {
                    attempt(recorder, "shutdown", () -> tf.o());
                    System.out.println("current " + (GLContext.getCurrent() == null ? "null" : "other"));
                }
            }
        }
    }
}
