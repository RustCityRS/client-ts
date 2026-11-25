import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

/** Exercise the original axis stores and inspect both operands after the first JVM fault. */
public class HdAnimationCopyOracle {
    static Constructor<td> init;
    static Method copy;

    static Field field(String name) throws Exception {
        Field f = td.class.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static String array(Object a) {
        if (a == null) return "-";
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < Array.getLength(a); i++) {
            if (i > 0) out.append(',');
            int value = Array.getInt(a, i);
            out.append(a instanceof byte[] ? value & 255 : value);
        }
        return "[" + out + "]";
    }

    static String snapshot(td model) throws Exception {
        StringBuilder out = new StringBuilder();
        for (String name : new String[]{"H", "eb", "hb", "B", "t"}) {
            out.append(' ').append(array(field(name).get(model)));
        }
        ql positions = (ql) field("Y").get(model);
        ae bounds = (ae) field("U").get(model);
        ql colour = (ql) field("z").get(model);
        return out + " " + (positions == null ? "-" : positions.b) + " "
            + (bounds == null ? "-" : bounds.h) + " " + (colour == null ? "-" : colour.b);
    }

    static String fault(Throwable t) {
        if (t instanceof NullPointerException) return "null";
        if (t instanceof ArrayIndexOutOfBoundsException) return "bounds:" + t.getMessage().split(" ")[1];
        throw new AssertionError(t);
    }

    static void animate(int opcode, int mode) throws Exception {
        td m = init.newInstance();
        int[] x = {Integer.MAX_VALUE, -81203, 12}, y = {4, 91, 5}, z = {-5, -7, Integer.MIN_VALUE};
        if (mode == 1) y = x;
        if (mode == 2) z = y;
        if (mode == 3) y = new int[]{7};
        if (mode == 4) z = null;
        int[] labels = mode == 5 ? null : mode == 6 ? new int[]{} : new int[]{0, 1, mode == 7 ? -1 : 4, 0};
        int[][] groups = {new int[]{1, 0}, mode == 8 ? null : new int[]{2, mode == 9 ? -1 : 1}};
        field("H").set(m, x); field("eb").set(m, y); field("hb").set(m, z);
        field("K").set(m, mode == 10 ? null : groups); field("O").set(m, groups);
        field("B").set(m, new byte[]{-5, 127, -120}); field("t").set(m, new short[]{-10, 8654, -32});
        ql colour = new ql(); colour.b = true; field("z").set(m, colour);
        field("sb").set(null, 32); field("yb").set(null, -63); field("vb").set(null, 100);
        String outcome = "ok";
        try { m.a(opcode, labels, 113, 77, 21, false); }
        catch (RuntimeException e) { outcome = fault(e); }
        System.out.println("a " + opcode + " " + mode + " " + outcome + snapshot(m) + " "
            + field("sb").get(null) + " " + field("yb").get(null) + " " + field("vb").get(null));
    }

    static void copy(int mode, int flags) throws Exception {
        td src = init.newInstance(), dst = init.newInstance(), storage = init.newInstance();
        field("I").set(src, mode == 15 ? 0 : 3); field("lb").set(src, mode == 15 ? 0 : 3);
        int[] x = {9, 10, 11}, y = {20, 21, 22}, z = {31, 32, 33};
        field("H").set(src, mode == 1 ? new int[]{1} : x);
        field("eb").set(src, mode == 2 ? new int[]{2} : mode == 3 ? null : y);
        field("hb").set(src, mode == 4 ? new int[]{3} : z);
        field("H").set(dst, mode == 5 ? y : mode == 6 ? null : new int[]{80, 80, 80});
        field("eb").set(dst, mode == 7 ? new int[]{70} : mode == 8 ? null : new int[]{70, 70, 70});
        field("hb").set(dst, mode == 9 ? new int[]{60} : mode == 5 ? x : new int[]{60, 60, 60});
        field("B").set(src, mode == 10 ? new byte[]{-9} : mode == 11 ? null : new byte[]{-48, 19, 30});
        field("t").set(src, mode == 12 ? new short[]{-32} : mode == 13 ? null : new short[]{281, -182, 1528});
        field("B").set(storage, new byte[]{61, 62, 63}); field("t").set(storage, new short[]{72, 73, 74});
        ql positions = new ql(); positions.b = true; field("Y").set(dst, positions);
        ae bounds = new ae(); bounds.h = true; field("U").set(dst, bounds);
        if (mode == 16) dst = src;
        if (mode == 17) storage = src;
        String outcome = "ok";
        try { copy.invoke(src, (flags & 1) != 0, (flags & 2) != 0, true, mode == 18 ? null : dst, mode == 14 ? null : storage); }
        catch (InvocationTargetException e) { outcome = fault(e.getCause()); }
        System.out.println("c " + mode + " " + flags + " " + outcome + snapshot(dst) + snapshot(src) + snapshot(storage)
            + " " + field("V").get(dst) + " " + field("I").get(dst) + " " + field("lb").get(dst)
            + " " + (field("B").get(dst) == field("B").get(src)) + " " + (field("t").get(dst) == field("t").get(src)));
    }

    public static void main(String[] args) throws Exception {
        init = td.class.getDeclaredConstructor(); init.setAccessible(true);
        copy = td.class.getDeclaredMethod("a", boolean.class, boolean.class, boolean.class, td.class, td.class);
        copy.setAccessible(true);
        for (int op : new int[]{0, 1, 2, 3, 5, 7}) for (int mode = 0; mode <= 10; mode++) animate(op, mode);
        for (int mode = 0; mode <= 18; mode++) for (int flags = 0; flags < 4; flags++) copy(mode, flags);
    }
}
