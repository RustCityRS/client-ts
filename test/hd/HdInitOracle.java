import java.awt.Canvas;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.StringJoiner;
import javax.media.opengl.GLContext;

/** Calls the original client bootstrap with only its AWT display and JOGL driver supplied by the host. */
public final class HdInitOracle {
    static final class Display extends Canvas {
        public boolean isDisplayable() { return true; }
    }

    static Object field(Class<?> owner, String name) throws ReflectiveOperationException {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f.get(null);
    }

    static String volume(String name) throws Exception {
        ByteBuffer copy = ((ByteBuffer)field(lm.class, name)).duplicate();
        copy.position(0);
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        hash.update(copy);
        return HexFormat.of().formatHex(hash.digest());
    }

    // td.a(ZZZZZ) is the game's dynamic vertex uploader. Supply its two UVs
    // and its attribute descriptor, then let it choose vi or the client buffer.
    static void dynamicModel() throws Exception {
        var constructor = td.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        td model = constructor.newInstance();
        ql uv = new ql();
        float[] u = {0.25f, -2.0f};
        float[] v = {-0.5f, 1.0f};
        set(model, "S", 2);
        set(model, "C", uv);
        set(model, "J", u);
        set(model, "gb", v);
        var upload = td.class.getDeclaredMethod("a", boolean.class, boolean.class, boolean.class, boolean.class, boolean.class);
        upload.setAccessible(true);
        for (int i = 0; i < 2; i++) {
            upload.invoke(model, true, false, false, false, true);
            if (!uv.b || uv.m != 8 || uv.a != 0) throw new AssertionError("UV descriptor");
            if (tf.G) {
                if (uv.e == null || uv.f != null) throw new AssertionError("missing stream VBO");
            } else {
                if (uv.e != null || uv.f == null || !uv.f.isDirect()) throw new AssertionError("missing client buffer");
                byte[] bytes = new byte[uv.f.remaining()];
                uv.f.duplicate().get(bytes);
                System.out.println("client UV " + HexFormat.of().formatHex(bytes));
            }
            u[0] = 1.5f;
            v[1] = -4.0f;
        }
    }

    private static void set(td model, String name, Object value) throws ReflectiveOperationException {
        Field f = td.class.getDeclaredField(name);
        f.setAccessible(true);
        f.set(model, value);
    }

    public static void main(String[] args) throws Exception {
        int samples = Integer.parseInt(args[2]);
        Display screen = new Display();
        screen.setSize(871, 613);
        try (GlRecorder recorder = new GlRecorder(Path.of(args[0])); AutoCloseable factory = recorder.installFactory()) {
            recorder.loadProfile(Path.of(args[1]));
            if (tf.a(new Canvas(), samples) != -1 || tf.w || GLContext.getCurrent() != null)
                throw new AssertionError("undisplayable canvas initialized a context");
            int status = tf.a(screen, samples);
            System.out.println("status " + status);
            if (status != 0) throw new AssertionError("tf.a returned " + status);
            GLContext current = GLContext.getCurrent();
            System.out.println("context " + tf.w + " " + (tf.t != null) + " " + (current != null && field(tf.class, "p") == current)
                + " " + (field(tf.class, "E") != null) + " " + tf.J + " " + tf.A);
            System.out.println("caps " + tf.C + " " + tf.r + " " + tf.K + " " + tf.H + " " + tf.y + " " + tf.e + " " + tf.G);
            StringJoiner materials = new StringJoiner(" ");
            for (pc material : aa.t) materials.add(material == null ? "-" : material.getClass().getName());
            System.out.println("materials " + materials);
            System.out.println("noise " + volume("d") + " " + volume("c"));
            if (args.length > 3 && args[3].equals("model")) {
                recorder.mark("dynamic-model");
                dynamicModel();
            }
        }
    }
}
