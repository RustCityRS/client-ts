import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;

/** Original bi scanlines with a sentinel destination, including the prefix written before a fault. */
public final class HdPerlinScanlineOracle {
    private static void field(bi op, String name, Object value) throws Exception {
        Field field = bi.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(op, value);
    }

    public static void main(String[] args) throws Exception {
        Method noise = bi.class.getDeclaredMethod("a", int.class, int.class, int.class, int.class,
            int.class, int.class, int.class);
        noise.setAccessible(true);
        int[] fade = a.b;
        for (int octaves : new int[]{1, 2, 3, 4}) {
            for (boolean bias : new boolean[]{false, true}) {
                for (int width : new int[]{0, 1, 8, 15}) {
                    for (int length : new int[]{0, 2, width}) {
                        bi op = new bi();
                        op.X = 5;
                        op.eb = 13;
                        op.Z = octaves;
                        op.kb = bias;
                        field(op, "lb", new short[]{1538, -327, 8, 153});
                        field(op, "ib", new short[]{1, 2, 4, 8});
                        byte[] permutation = new byte[512];
                        for (int i = 0; i < permutation.length; i++) permutation[i] = (byte)(89 * i + 113);
                        field(op, "ab", permutation);
                        pe.r = width;
                        fb.h = new int[]{1749};
                        nk.d = new int[width];
                        for (int x = 0; x < width; x++) nk.d[x] = (x << 12) / width;
                        int[] dst = new int[length];
                        Arrays.fill(dst, 777);
                        String fault = "ok";
                        try { op.a(true, 0, dst); }
                        catch (ld ex) { fault = fault(ex); }
                        System.out.println(fault + " " + Arrays.toString(dst));
                    }
                }
            }
        }
        // The first permutation entry exists. Both the fade load and the second permutation
        // load would fault, at different indices. Java performs the fade load first.
        bi op = new bi();
        field(op, "ab", new byte[]{2});
        a.b = new int[0];
        try {
            noise.invoke(op, 7, 0, 0, 2, 122, 2, 0);
            throw new AssertionError("expected a fade-table fault");
        } catch (InvocationTargetException ex) {
            System.out.println(fault((ld)ex.getCause()));
        } finally {
            a.b = fade;
        }
    }

    private static String fault(ld ex) {
        if (ex.f instanceof ArrayIndexOutOfBoundsException) return "index " + ex.f.getMessage().split(" ")[1];
        throw ex;
    }
}
