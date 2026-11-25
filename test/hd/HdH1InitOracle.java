import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.Buffer;
import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.media.opengl.GLContext;

/**
 * H1 gate (h1-init.test.ts): Codex's HdInitOracle start, unchanged (its recorder, factory, profile, the undisplayable
 * canvas and then tf.a(Canvas,I)I on the 871x613 display), followed by a dump of the Java-visible state that context
 * creation leaves behind: every tf static, the fa counters, the lm noise statics (slice names, texture names, the
 * volumes' position/limit/capacity and SHA-256), the material table aa.t with every instance field of each renderer
 * (their display-list bases, cube maps, program, ramp textures, planes and the rd noise table), the material statics
 * rd.d, wg.b and pd.b, and the MaterialManager statics dl.c, mh.eb and je.R. h1InitHarness.ts prints the same
 * lines for the TS port. The recorder is closed when HdInitOracle returns, so the dump only reads fields.
 *
 * args: traceDir profile.json samples
 */
public final class HdH1InitOracle {
    static final String[] TF = {"a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u",
        "v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K"};
    // Instance fields of each material renderer, in classfile order.
    static final String[][] MATERIAL_FIELDS = {
        {"vm", "a", "b", "c"}, {"rd", "a", "b", "c", "e"}, {"wg", "a", "c", "d"}, {"pd", "a", "c", "d", "e"}, {"ob", "g", "n"}, {"ue"}
    };

    static Field field(Class<?> owner, String name) throws ReflectiveOperationException {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Object get(String owner, String name) throws ReflectiveOperationException {
        Field f = field(Class.forName(owner), name);
        if (!Modifier.isStatic(f.getModifiers())) throw new AssertionError(owner + "." + name + " is not static");
        return f.get(null);
    }

    static String hex8(float v) {
        return String.format("%08x", Float.floatToRawIntBits(v));
    }

    static String sha(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    static String buffer(Buffer b) throws Exception {
        String head = (b.isDirect() ? "direct" : "heap") + ":" + (b.isReadOnly() ? "ro" : "rw") + ":" + b.position() + ":" + b.limit() + ":" + b.capacity();
        if (b instanceof ByteBuffer bytes) {
            // the bytes 0..limit, as HdInitOracle hashes the noise volumes
            byte[] data = new byte[bytes.limit()];
            for (int i = 0; i < data.length; i++) data[i] = bytes.get(i);
            return "B:" + head + ":" + bytes.order() + ":" + sha(data);
        }
        if (b instanceof FloatBuffer floats) {
            // every element 0..capacity as its raw bits, big endian
            byte[] data = new byte[floats.capacity() * 4];
            for (int i = 0; i < floats.capacity(); i++) {
                int bits = Float.floatToRawIntBits(floats.get(i));
                data[i * 4] = (byte)(bits >>> 24); data[i * 4 + 1] = (byte)(bits >>> 16); data[i * 4 + 2] = (byte)(bits >>> 8); data[i * 4 + 3] = (byte)bits;
            }
            return "F:" + head + ":" + floats.order() + ":" + sha(data);
        }
        return "buffer?" + b.getClass().getName();
    }

    static String value(Object v) throws Exception {
        if (v == null) return "null";
        if (v instanceof String s) return '"' + s.replace("\\", "\\\\").replace("\"", "\\\"") + '"';
        if (v instanceof Float f) return "f:" + hex8(f);
        if (v instanceof Boolean b) return b ? "T" : "F";
        if (v instanceof Integer i) return Integer.toString(i);
        if (v instanceof float[] a) {
            StringBuilder s = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) s.append(i == 0 ? "" : ",").append(hex8(a[i]));
            return s.append(']').toString();
        }
        if (v instanceof int[] a) {
            StringBuilder s = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) s.append(i == 0 ? "" : ",").append(a[i]);
            return s.append(']').toString();
        }
        if (v instanceof Buffer b) return buffer(b);
        if (v instanceof GLContext c) return c == GLContext.getCurrent() ? "context:current" : "context";
        return "set";
    }

    static void print(String name, Object v) throws Exception {
        System.out.println("dump " + name + " " + value(v));
    }

    public static void main(String[] args) throws Exception {
        HdInitOracle.main(new String[]{args[0], args[1], args[2]});
        for (String name : TF) print("tf." + name, get("tf", name));
        for (String name : new String[]{"a", "c", "e", "f"}) print("fa." + name, get("fa", name));
        for (String name : new String[]{"a", "b", "g", "f", "c", "d", "e"}) print("lm." + name, get("lm", name));
        Object[] table = (Object[])get("aa", "t");
        System.out.println("dump aa.t " + (table == null ? "null" : "length " + table.length));
        for (int slot = 0; table != null && slot < table.length; slot++) {
            Object material = table[slot];
            String type = material == null ? "null" : material.getClass().getName();
            System.out.println("dump aa.t[" + slot + "] " + type);
            for (String[] row : MATERIAL_FIELDS) {
                if (!row[0].equals(type)) continue;
                for (int i = 1; i < row.length; i++) {
                    Field f = field(material.getClass(), row[i]);
                    if (Modifier.isStatic(f.getModifiers())) throw new AssertionError(type + "." + row[i] + " is static");
                    print(type + "." + row[i], f.get(material));
                }
            }
        }
        print("rd.d", get("rd", "d"));
        print("wg.b", get("wg", "b"));
        print("pd.b", get("pd", "b"));
        print("dl.c", get("dl", "c"));
        print("mh.eb", get("mh", "eb"));
        print("je.R", get("je", "R"));
    }
}
