import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.invoke.MethodType;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.math.BigInteger;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Set;
import java.util.TreeSet;

class PacketOracle {
    static final HexFormat hex = HexFormat.of();
    static final ClassLoader loader = ClassLoader.getSystemClassLoader();

    static Field field(Class<?> owner, String name) throws Exception {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Method method(Class<?> owner, String name, Class<?>... params) throws Exception {
        Method m = owner.getDeclaredMethod(name, params);
        m.setAccessible(true);
        return m;
    }

    static Object arg(Class<?> type, String token) throws Exception {
        if (type == int.class) return Integer.valueOf(token);
        if (type == byte.class) return Byte.valueOf(token);
        if (type == boolean.class) return Boolean.valueOf(token);
        if (type == long.class) return Long.valueOf(token);
        if (type == BigInteger.class) return new BigInteger(token);
        if (type == byte[].class) return hex.parseHex(token);
        if (type == int[].class) return Arrays.stream(token.split(",")).mapToInt(Integer::parseInt).toArray();
        if (type.getName().equals("id")) {
            byte[] chars = hex.parseHex(token);
            return method(Class.forName("ea"), "a", byte[].class, int.class, int.class, int.class).invoke(null, chars, 0, chars.length, 0);
        }
        throw new AssertionError(type);
    }

    static String show(Object value) throws Exception {
        if (value != null && value.getClass().getName().equals("id")) {
            byte[] bytes = (byte[]) field(value.getClass(), "A").get(value);
            return "str=" + field(value.getClass(), "c").getInt(value) + ":" + hex.formatHex(bytes);
        }
        return String.valueOf(value);
    }

    static void nodeTrace() throws Exception {
        Class<?> jf = Class.forName("jf");
        Constructor<?> init = jf.getDeclaredConstructor();
        init.setAccessible(true);
        Object[] nodes = {init.newInstance(), init.newInstance(), init.newInstance()};
        Field prev = field(jf, "p"), next = field(jf, "g"), key = field(jf, "k");
        Method linked = method(jf, "a", byte.class), unlink = method(jf, "b", byte.class);
        for (int i = 0; i < 3; i++) {
            prev.set(nodes[i], nodes[(i + 2) % 3]);
            next.set(nodes[i], nodes[(i + 1) % 3]);
            key.setLong(nodes[i], Long.MIN_VALUE + i);
        }
        StringBuilder trace = new StringBuilder();
        for (int i : new int[]{-1, 1, 1, 0, 2}) {
            if (i >= 0) unlink.invoke(nodes[i], (byte)-118);
            for (Object node : nodes) {
                trace.append(linked.invoke(node, (byte)-83)).append(",").append(key.getLong(node)).append(",")
                     .append(Arrays.asList(nodes).indexOf(next.get(node))).append(",").append(Arrays.asList(nodes).indexOf(prev.get(node))).append(" ");
            }
        }
        System.out.println(trace.toString().trim());
    }

    static void poolTrace(Class<?> gd) throws Exception {
        Constructor<?> allocate = gd.getDeclaredConstructor(int.class);
        allocate.setAccessible(true);
        String[][] fields = {{"wg","e","j","a"}, {"wk","r","lc","C"}, {"nb","b","ek","q"}};
        int[] sizes = {100, 5000, 30000};
        for (int i=0; i<sizes.length; i++) {
            Field pool = field(Class.forName(fields[i][0]), fields[i][1]);
            Field count = field(Class.forName(fields[i][2]), fields[i][3]);
            byte[] marker = {(byte)145};
            byte[][] slots = {null, marker};
            pool.set(null, slots);
            count.setInt(null, 2);
            for (int j=0; j<3; j++) {
                Object packet = allocate.newInstance(sizes[i]);
                byte[] data = (byte[]) field(gd, "fb").get(packet);
                String result;
                try { result = String.valueOf(method(gd, "f", byte.class).invoke(packet, (byte)-113)); }
                catch (InvocationTargetException ex) { result = "exception"; }
                System.out.println((data == null ? -1 : data.length) + " " + (data == marker) + " " +
                    result + " " + field(gd, "yb").getInt(packet) + " " + count.getInt(null) + " " + (slots[1] == null));
            }
            count.setInt(null, 3);
            try { allocate.newInstance(sizes[i]); throw new AssertionError(); } catch (InvocationTargetException expected) {}
            System.out.println("exception " + count.getInt(null));
            count.setInt(null, 0);
        }
    }

    public static void main(String[] args) throws Exception {
        Class<?> gd = Class.forName("gd");
        Set<String> inventory = new TreeSet<>();
        for (Method m : gd.getDeclaredMethods()) {
            if (!Modifier.isStatic(m.getModifiers())) {
                inventory.add(m.getName() + MethodType.methodType(m.getReturnType(), m.getParameterTypes()).descriptorString());
            }
        }
        System.out.println(String.join(" ", inventory));
        nodeTrace();
        poolTrace(gd);
        Constructor<?> wrap = gd.getDeclaredConstructor(byte[].class);
        wrap.setAccessible(true);
        Field cursor = field(gd, "yb");
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            String[] parts = line.split("\\t", -1);
            String name = parts[0].substring(0, parts[0].indexOf('('));
            String descriptor = parts[0].substring(name.length());
            MethodType signature = MethodType.fromMethodDescriptorString(descriptor, loader);
            Method m = method(gd, name, signature.parameterArray());
            byte[] bytes = hex.parseHex(parts[1]);
            Object packet = wrap.newInstance(bytes);
            cursor.setInt(packet, Integer.parseInt(parts[2]));
            Object[] argv = new Object[signature.parameterCount()];
            for (int i = 0; i < argv.length; i++) argv[i] = arg(signature.parameterType(i), parts[i + 3]);
            String result;
            try {
                result = show(m.invoke(packet, argv));
            } catch (InvocationTargetException ex) {
                result = "exception";
            }
            StringBuilder record = new StringBuilder(result).append(" ").append(cursor.getInt(packet)).append(" ").append(hex.formatHex(bytes));
            for (Object item : argv) if (item instanceof byte[]) record.append(" ").append(hex.formatHex((byte[]) item));
            System.out.println(record);
        }
    }
}
