import java.io.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.zip.CRC32;

class ScriptLoaderOracle {
    static Field field(String name) throws Exception {
        String[] path = name.split("\\.");
        var field = Class.forName(path[0]).getDeclaredField(path[1]);
        field.setAccessible(true);
        return field;
    }
    static Constructor<?> ctor(String owner, Class<?>... parameters) throws Exception {
        var constructor = Class.forName(owner).getDeclaredConstructor(parameters);
        constructor.setAccessible(true);
        return constructor;
    }
    static Method method(String owner, String name, Class<?>... parameters) throws Exception {
        var method = Class.forName(owner).getDeclaredMethod(name, parameters);
        method.setAccessible(true);
        return method;
    }
    static void string(DataOutputStream out, Object value) throws Exception {
        if (value == null) { out.writeInt(-1); return; }
        out.writeInt(field("id.c").getInt(value));
        var bytes = (byte[])field("id.A").get(value);
        out.writeInt(bytes.length);
        out.write(bytes);
    }
    static void script(DataOutputStream out, Object value) throws Exception {
        string(out, field("m.J").get(value));
        for (String name : new String[]{"E","I","K","R"}) out.writeInt(field("m." + name).getInt(value));
        int[] opcodes = (int[])field("m.D").get(value);
        out.writeInt(opcodes == null ? -1 : opcodes.length);
        if (opcodes != null) {
            var operands = (int[])field("m.F").get(value);
            var strings = (Object[])field("m.B").get(value);
            for (int i = 0; i < opcodes.length; i++) {
                out.writeInt(opcodes[i]);
                out.writeInt(operands[i]);
                string(out, strings[i]);
            }
        } else if (field("m.F").get(value) != null || field("m.B").get(value) != null) throw new AssertionError();
        Object[] tables = (Object[])field("m.N").get(value);
        out.writeInt(tables == null ? -1 : tables.length);
        if (tables == null) return;
        for (var table : tables) {
            Object[] buckets = (Object[])field("nc.n").get(table);
            out.writeInt(field("nc.e").getInt(table));
            for (var bucket : buckets) {
                for (var node = field("jf.g").get(bucket); node != bucket; node = field("jf.g").get(node)) {
                    out.writeInt(1);
                    out.writeInt((int)field("jf.k").getLong(node));
                    out.writeInt(field("oe.v").getInt(node));
                }
                out.writeInt(0);
            }
        }
    }
    public static void main(String[] args) throws Exception {
        var in = new DataInputStream(new BufferedInputStream(System.in));
        var out = new DataOutputStream(new BufferedOutputStream(System.out));
        var convert = method("aj", "a", String.class, byte.class);
        int strings = in.readInt();
        for (int i = 0; i < strings; i++) {
            var chars = new char[in.readInt()];
            for (int j = 0; j < chars.length; j++) chars[j] = in.readChar();
            string(out, convert.invoke(null, new String(chars), (byte)-64));
        }
        var pow2 = method("ti", "c", int.class, int.class);
        for (int i = in.readInt(); i > 0; i--) out.writeInt((int)pow2.invoke(null, 113, in.readInt()));
        script(out, ctor("m").newInstance());
        var frame = ctor("qf").newInstance();
        out.writeInt(field("qf.i").getInt(frame));
        for (String name : new String[]{"d", "g", "k"}) out.writeInt(field("qf." + name).get(frame) == null ? 0 : 1);

        // Populate the already-decoded file slots of a real archive. Calls still run
        // through j.a, al.a, gd, nc, oe and the original sf.g eviction policy.
        int groups = in.readInt();
        var files = new Object[groups][];
        var sizes = new int[groups];
        for (int i = 0; i < groups; i++) {
            int size = in.readInt();
            if (size >= 0) {
                files[i] = new Object[]{in.readNBytes(size)};
                sizes[i] = 1;
            }
        }
        byte[] empty = {0,0,0,0,4,5,0,0,0};
        var crc = new CRC32();
        crc.update(empty);
        var index = ctor("db", byte[].class, int.class).newInstance(empty, (int)crc.getValue());
        field("db.j").set(index, sizes);
        var archive = ctor("al", Class.forName("ud"), boolean.class, boolean.class).newInstance(null, false, false);
        field("al.x").set(archive, index);
        field("al.O").set(archive, files);
        field("il.B").set(null, archive);
        var load = method("j", "a", int.class, int.class);
        var ids = new IdentityHashMap<Object,Integer>();
        int operations = in.readInt();
        for (int i = 0; i < operations; i++) {
            int id = in.readInt();
            Object object;
            try { object = load.invoke(null, id, -100); }
            catch (InvocationTargetException failed) { out.writeInt(-2); continue; }
            if (object == null) { out.writeInt(-1); continue; }
            var identity = ids.get(object);
            if (identity == null) {
                identity = ids.size();
                ids.put(object, identity);
            }
            out.writeInt(identity);
            if (i < 5) script(out, object);
        }
        out.flush();
    }
}
