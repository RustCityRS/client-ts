import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.InvocationTargetException;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.zip.CRC32;
import java.util.HexFormat;

class CacheStorageOracle {
    private static Constructor<?> constructor(String owner, Class<?>... params) throws Exception {
        Constructor<?> ctor = Class.forName(owner).getDeclaredConstructor(params);
        ctor.setAccessible(true);
        return ctor;
    }

    private static Method method(String owner, String name, Class<?>... params) throws Exception {
        Method m = Class.forName(owner).getDeclaredMethod(name, params);
        m.setAccessible(true);
        return m;
    }

    private static Field field(String owner, String name) throws Exception {
        Field f = Class.forName(owner).getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    private static void record(Method m, Object receiver, Object... args) throws Exception {
        try {
            Object result = m.invoke(receiver, args);
            System.out.println(result instanceof byte[] bytes ? HexFormat.of().formatHex(bytes) : "ok");
        } catch (InvocationTargetException e) {
            if (!(e.getCause() instanceof RuntimeException)) throw e;
            System.out.println("rejected");
        }
    }

    private static void hashTables() throws Exception {
        Constructor<?> table = constructor("mf", int[].class);
        Method get = method("mf", "a", int.class, int.class);
        Field entries = field("mf", "f");
        int[][] cases = {
            {}, {-1}, {7, 23, -9, 39, 7, -1, Integer.MIN_VALUE, Integer.MAX_VALUE}, new int[101]
        };
        for (int i = 0; i < cases[3].length; i++) cases[3][i] = i % 7 == 0 ? -1 : (i << 10) - 1;
        for (int[] keys : cases) {
            Object instance = table.newInstance((Object)keys);
            System.out.println(Arrays.toString((int[])entries.get(instance)));
            int[] queries = Arrays.copyOf(keys, keys.length + 4);
            System.arraycopy(new int[]{-1, 0, 7, 120}, 0, queries, keys.length, 4);
            int[] ids = new int[queries.length];
            for (int i = 0; i < queries.length; i++) ids[i] = (int)get.invoke(instance, -125, queries[i]);
            System.out.println(Arrays.toString(ids));
        }
    }

    private static void storage() throws Exception {
        Method pack = method("mc", "a", byte[].class, int.class, boolean.class);
        Method unpack = method("gg", "a", boolean.class, Object.class, byte.class);
        Field disabled = field("pj", "P");
        for (boolean heapOnly : new boolean[]{false, true}) {
            disabled.setBoolean(null, heapOnly);
            for (int size : new int[]{0, 1, 136, 137, 257}) {
                for (boolean copyIn : new boolean[]{false, true}) {
                    for (boolean copyOut : new boolean[]{false, true}) {
                        byte[] src = new byte[size];
                        for (int i = 0; i < size; i++) src[i] = (byte)(37 * i + 5);
                        Object packed = pack.invoke(null, src, 136, copyIn);
                        if (size > 0) src[size - 1] ^= 0x55;
                        byte[] first = (byte[])unpack.invoke(null, copyOut, packed, (byte)-100);
                        if (size > 0) first[0] ^= (byte)0x80;
                        byte[] second = (byte[])unpack.invoke(null, false, packed, (byte)-121);
                        System.out.printf("%s %s %s %s %s %d %d%n",
                            packed instanceof byte[], packed == src, first == src, first == second, second == src,
                            Arrays.hashCode(first), Arrays.hashCode(second));
                    }
                }
            }
        }
        disabled.setBoolean(null, false);
        System.out.println(pack.invoke(null, null, 136, true) == null);
        System.out.println(unpack.invoke(null, false, null, (byte)-100) == null);
        Object direct = constructor("md").newInstance();
        Method replace = method("md", "a", byte.class, byte[].class);
        Method read = method("md", "b", byte.class);
        record(read, direct, (byte)112);
        record(unpack, null, false, new Object(), (byte)-100);
        Method copy = method("gi", "a", byte[].class, int.class);
        for (byte[] bytes : new byte[][]{null, {}, {4,8,15}}) {
            for (int offset : new int[]{Integer.MIN_VALUE,-1,0,1,Integer.MAX_VALUE}) record(copy, null, bytes, offset);
        }
        byte[] original = {1, 2, 3};
        replace.invoke(direct, (byte)60, original);
        Arrays.fill(original, (byte)9);
        byte[] first = (byte[])read.invoke(direct, (byte)112);
        first[0] = 12;
        System.out.println(HexFormat.of().formatHex((byte[])read.invoke(direct, (byte)112)));
        replace.invoke(direct, (byte)60, new byte[]{-1, -2});
        System.out.println(HexFormat.of().formatHex((byte[])read.invoke(direct, (byte)112)));
        ByteBuffer buffer = (ByteBuffer)field("md","k").get(direct);
        System.out.println(buffer.position() + " " + buffer.limit() + " " + buffer.capacity());
        record(replace, direct, (byte)60, null);
        System.out.println(field("md","k").get(direct) == buffer);
        buffer.limit(1).position(1);
        record(read, direct, (byte)112);
        System.out.println(buffer.position() + " " + buffer.limit() + " " + buffer.capacity());
    }

    private static void arrayCopies() throws Exception {
        Method copy = method("cc", "a", byte[].class, int.class, byte[].class, int.class, int.class);
        int[][] layouts = {{0, 0, 0}, {0, 0, 16}, {0, 2, 5}, {0, 3, 17}, {3, 0, 17}, {8, 8, 0},
            {2, 3, 0}, {0, 4, 8}, {0, 4, 16}, {0, 31, 4}, {30, 0, 4}, {32, 32, 1}, {-1, 2, 3}, {4, 0, -1}};
        for (boolean same : new boolean[]{false, true}) {
            for (int[] layout : layouts) {
                byte[] src = new byte[32], dst = same ? src : new byte[32];
                for (int i = 0; i < src.length; i++) src[i] = (byte)(5 + 3*i);
                boolean error = false;
                try {
                    copy.invoke(null, src, layout[0], dst, layout[1], layout[2]);
                } catch (InvocationTargetException ex) {
                    if (!(ex.getCause() instanceof ArrayIndexOutOfBoundsException)) throw ex;
                    error = true;
                }
                System.out.printf("%s %s%n", error, HexFormat.of().formatHex(dst));
            }
        }
    }

    private static void archives() throws Exception {
        // One group, one file. The provider is primed like al.b(II)V after a disk read.
        byte[] reference = {0,0,0,0,18, 5,0,0,1,0,0, 0,0,0,0, 0,0,0,0, 0,1,0,0};
        CRC32 crc = new CRC32();
        crc.update(reference);
        Object index = constructor("db", byte[].class, int.class).newInstance(reference, (int)crc.getValue());
        Constructor<?> archive = constructor("al", Class.forName("ud"), boolean.class, boolean.class);
        Method readFile = method("al", "a", int.class, int.class, int.class);
        Method pack = method("mc", "a", byte[].class, int.class, boolean.class);
        for (int archiveId : new int[]{0, 2, 5}) {
            boolean discardPacked = archiveId != 0, discardUnpacked = archiveId != 2;
            for (int size : new int[]{1, 130, 131, 132, 136, 137}) {
                Object instance = archive.newInstance(null, discardPacked, discardUnpacked);
                field("al", "x").set(instance, index);
                field("al", "O").set(instance, new Object[1][]);
                byte[] bytes = new byte[size + 7];
                ByteBuffer.wrap(bytes).put((byte)0).putInt(size);
                for (int i = 0; i < size; i++) bytes[5 + i] = (byte)(i * 13 + 1);
                Object[] packed = {discardPacked ? bytes : pack.invoke(null, bytes, 136, false)};
                field("al", "w").set(instance, packed);
                byte[] result = (byte[])readFile.invoke(instance, -809612665, 0, 0);
                result[0] ^= (byte)0x80;
                Object[] files = ((Object[][])field("al", "O").get(instance))[0];
                boolean resident = files != null && files[0] != null;
                if (packed[0] == null) packed[0] = bytes;
                byte[] second = (byte[])readFile.invoke(instance, -809612665, 0, 0);
                System.out.printf("%s %s %d%n", resident, result == second, Arrays.hashCode(second));
            }
        }
    }

    public static void main(String[] args) throws Exception {
        hashTables();
        storage();
        archives();
        arrayCopies();
    }
}
