import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.HexFormat;

class DiskCacheOracle {
    static Field field(String owner, String name) throws Exception {
        var field = Class.forName(owner).getDeclaredField(name);
        field.setAccessible(true);
        return field;
    }
    static Object create(String name, Class<?>[] types, Object... args) throws Exception {
        var ctor = Class.forName(name).getDeclaredConstructor(types);
        ctor.setAccessible(true);
        return ctor.newInstance(args);
    }
    static Method method(String name, Class<?>... types) throws Exception {
        String[] parts = name.split("\\.");
        var method = Class.forName(parts[0]).getDeclaredMethod(parts[1], types);
        method.setAccessible(true);
        return method;
    }
    static String hash(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
    static Object file(Path path, int read, int write, long limit) throws Exception {
        var f = create("ne", new Class<?>[]{});
        field("ne","a").setLong(f, limit);
        field("ne","c").set(f, path.toFile());
        field("ne","d").set(f, new RandomAccessFile(path.toFile(), "rw"));
        return create("sa", new Class<?>[]{f.getClass(), int.class, int.class}, f, read, write);
    }
    static String state(Object buffer, Path path) throws Exception {
        var s = new java.util.StringJoiner(",");
        for (String name : new String[]{"a","c","d","j","k","l","r","y"}) s.add(field("sa",name).get(buffer).toString());
        for (String name : new String[]{"f","n"}) s.add(hash((byte[])field("sa",name).get(buffer)));
        var file = field("sa","i").get(buffer);
        s.add(Long.toString(field("ne","b").getLong(file)));
        s.add(hash(Files.readAllBytes(path)));
        return s.toString();
    }
    public static void main(String[] args) throws Exception {
        var in = new DataInputStream(new BufferedInputStream(System.in));
        var dir = Path.of(args[0]);
        var dat = Files.createTempFile(dir, "dat", ".tmp");
        var idx = Files.createTempFile(dir, "idx", ".tmp");
        var data = file(dat, in.readInt(), in.readInt(), 8192L);
        var index = file(idx, in.readInt(), in.readInt(), 4096L);
        var i = int.class;
        var store = create("cg", new Class<?>[]{i, data.getClass(), data.getClass(), i}, 7, data, index, 2800);
        var readGroup = method("cg.a", i, i);
        var writeGroup = method("cg.a", i, i, byte[].class, byte.class);
        var seek = method("sa.a", long.class, i);
        var read = method("sa.a", i, byte[].class, byte.class, i);
        var write = method("sa.a", byte.class, i, byte[].class, i);
        var fully = method("sa.a", i, byte[].class);
        var flush = method("sa.d", i);
        var close = method("sa.b", i);
        try {
            System.out.println(store.toString());
            int count = in.readInt();
            for (int n = 0; n < count; n++) {
                int op = in.readInt(), a = in.readInt(), b = in.readInt();
                byte[] bytes = in.readNBytes(in.readInt());
                Object buf = op >= 10 ? index : data;
                String result = "ok";
                try {
                    if (op == 20) {
                        byte[] buffer = a < 0 ? null : new byte[a];
                        if (buffer != null) java.util.Arrays.fill(buffer,(byte)125);
                        field("le","h").set(null,buffer);
                    } else if (op == 21) {
                        var group = (byte[])readGroup.invoke(store,b,a);
                        result = group == null ? "null" : hash(group);
                    } else switch (op % 10) {
                        case 0 -> {
                            var group = (byte[])readGroup.invoke(store, 65280, a);
                            result = group == null ? "null" : hash(group);
                        }
                        case 1 -> result = writeGroup.invoke(store, b, a, bytes, (byte)57).toString();
                        case 2 -> seek.invoke(buf, (long)a, -119);
                        case 3 -> read.invoke(buf, b, bytes, (byte)101, a);
                        case 4 -> write.invoke(buf, (byte)50, a, bytes, b);
                        case 5 -> flush.invoke(buf, -125);
                        case 6 -> fully.invoke(buf, 5, bytes);
                        case 7 -> close.invoke(buf, -2275);
                        case 8,9 -> {
                            var packet=create("gd",new Class<?>[]{byte[].class},bytes);
                            field("gd","yb").setInt(packet,a);
                            field("ei","q").set(null,b==0?null:buf);
                            if(op%10==8)method("tj.a",packet.getClass(),byte.class).invoke(null,packet,(byte)-115);
                            else method("nk.a",i,packet.getClass()).invoke(null,24,packet);
                            result=""+field("gd","yb").getInt(packet);
                        }
                        default -> throw new AssertionError(op);
                    }
                } catch (InvocationTargetException wrapped) {
                    Throwable e = wrapped.getCause();
                    result = e instanceof EOFException ? "eof" : e instanceof IOException ? "io" : "runtime";
                }
                byte[] sector = (byte[])field("le","h").get(null);
                System.out.println(result + ";" + hash(bytes) + ";" + state(data,dat) + ";" + state(index,idx) + ";" + (sector == null ? "-" : hash(sector)));
            }
        } finally {
            for (Object buf : new Object[]{data,index}) {
                var file = field("sa","i").get(buf);
                var raw = (RandomAccessFile)field("ne","d").get(file);
                if (raw != null) raw.close();
            }
            Files.delete(dat);
            Files.delete(idx);
        }
    }
}
