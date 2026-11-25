import java.awt.Canvas;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.ByteBuffer;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;

/** Exercise td's real constructor, face runs, expanded normals/UVs and the two packed buffer builders. */
public class HdGlModelOracle {
    static final class Finished extends Error {}
    static Object get(td model, String name) throws Exception {
        Field f = td.class.getDeclaredField(name); f.setAccessible(true); return f.get(model);
    }
    static String hash(Object data) {
        if (data == null) return "-";
        if (data instanceof int[] a) return String.valueOf(Arrays.hashCode(a));
        if (data instanceof short[] a) return String.valueOf(Arrays.hashCode(a));
        if (data instanceof byte[] a) return String.valueOf(Arrays.hashCode(a));
        if (data instanceof float[] a) {
            int hash = 1;
            for (float value : a) hash = hash * 31 + Float.floatToRawIntBits(value);
            return String.valueOf(hash);
        }
        return String.valueOf(Arrays.deepHashCode((int[][]) data));
    }
    static String bytes(ql stream) throws Exception {
        if (stream == null) return "-";
        ByteBuffer copy = stream.f.duplicate(); copy.position(0);
        MessageDigest digest = MessageDigest.getInstance("SHA-256"); digest.update(copy);
        return stream.a + "," + stream.m + "," + stream.b + "," + HexFormat.of().formatHex(digest.digest());
    }
    static void run(int[] ids) throws Exception {
        tf.C = false; tf.G = false;
        mk.a = new float[]{-50,-60,-50,0};
        for (int i=0; i<hf.a.length; i++) hf.a[i] = i * 109123 & 0xffffff;
        Method vertices = td.class.getDeclaredMethod("a",boolean.class,boolean.class,boolean.class,boolean.class,boolean.class);
        Method elements = td.class.getDeclaredMethod("q");
        vertices.setAccessible(true); elements.setAccessible(true);
        for (int id : ids) for (int state = 0; state < 4; state++) {
            od.c = (state & 1) != 0; tf.f = (state & 2) != 0;
            gb source = gb.a(vl.g,id,0);
            if (source == null) throw new AssertionError("missing model " + id);
            td model = new td(source,64,768,(id & 1) != 0);
            model.o();
            StringBuilder line = new StringBuilder("mesh " + id + "/" + state + " " + model.I + " " + get(model,"S") + " " + get(model,"lb"));
            for (String name : "H eb hb X N v L W ab J gb t B w P Q M Z K O R y".split(" ")) line.append(' ').append(hash(get(model,name)));
            vertices.invoke(model,false,true,true,od.c,true);
            elements.invoke(model);
            for (String name : "Y z A C fb".split(" ")) line.append(' ').append(bytes((ql)get(model,name)));
            System.out.println(line);
        }
    }
    static void cachedItems() throws Exception {
        tf.w = true;
        tf.f = false;
        for (int id : new int[]{592, 1155}) {
            h item = fk.a(id, (byte)109);
            td model = (td)item.a(113, 0, 0, null, 1, 0);
            boolean reused = model == item.a(113, 0, 0, null, 1, 0);
            System.out.println("item " + id + " " + reused + " " + (get(model, "J") == null)
                + " " + (get(model, "gb") == null) + " " + bytes((ql)get(model, "C")));
        }
    }

    // Keep the material boundary visible while the complete constructor and lighting still read the real archive.
    static void draws(Path directory) throws Exception {
        tf.c(-1);
        cb.b(0, 0, 0);
        tg.c = -382; ub.m = 383; a.g = -251; li.x = 252;
        m textures = hf.e;
        gb unlit = gb.a(vl.g, 2, 0);
        td populated = new td(unlit, 64, 768, false);
        var emptyConstructor = td.class.getDeclaredConstructor();
        emptyConstructor.setAccessible(true);
        td empty = emptyConstructor.newInstance();
        for (td receiver : new td[]{empty, populated}) for (th other : new th[]{null, unlit}) {
            try {
                receiver.a(other, 0, 0, 0, false);
                System.out.println("merge ok");
            } catch (ClassCastException | NullPointerException fault) {
                System.out.println("merge " + fault.getClass().getSimpleName());
            }
        }
        try (GlRecorder gl = new GlRecorder(directory)) {
            tf.t = gl.gl();
            hf.e = (m) Proxy.newProxyInstance(m.class.getClassLoader(), new Class<?>[]{m.class}, (p, method, args) -> {
                if (method.getReturnType() == void.class) {
                    gl.mark("texture." + args[0] + "." + args[1]);
                    return null;
                }
                return method.invoke(textures, args);
            });
            for (int id : new int[]{0, 2, 115, 543, 4500}) for (int state = 0; state < 8; state++) {
                od.c = (state & 1) != 0;
                tf.C = (state & 2) != 0;
                tf.G = (state & 4) != 0 && tf.C;
                tf.f = false;
                td.v();
                td base = new td(gb.a(vl.g, id, 0), 64, 768, (id & 1) != 0);
                base.o();
                gl.mark("base." + id + "." + state);
                tf.c(7);
                base.a(17, 44, -108, 152, -11, 72, 605, 1L);
                td actor = (td) base.c(false, false, false);
                if (actor.d()) {
                    int[] labels = {0, 2, 5, 1};
                    actor.a(0, labels, 12, -20, 3, true);
                    actor.a(2, labels, 1013, 750, 1536, true);
                    actor.a(1, labels, -15, 31, 4, true);
                    actor.f();
                }
                gl.mark("actor." + id + "." + state);
                actor.a(83, 0, 65536, 0, 65536, 15, -13, 640, 0L, 0, null);
            }
        } finally { hf.e = textures; }
    }
    public static void main(String[] args) throws Exception {
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765,503);
        try (GlRecorder gl = new GlRecorder(null); AutoCloseable factory=gl.installFactory()) {
            gl.loadProfile(Path.of(args[1]));
            try {
                HdTitleFrameOracle.run(Path.of(args[0]),canvas,frame->{},phase->{
                    if (!phase.equals("interface.onload")) return;
                    try {
                        run(Arrays.stream(args[2].split(",")).mapToInt(Integer::parseInt).toArray());
                        cachedItems();
                        draws(Path.of(args[3]));
                    }
                    catch (Exception e) { throw new IllegalStateException(e); }
                    throw new Finished();
                });
            } catch (Finished done) {}
        }
    }
}
