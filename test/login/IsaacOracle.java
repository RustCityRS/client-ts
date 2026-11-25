import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

class IsaacOracle {
    static final Class<?> type;
    static {
        try { type = Class.forName("ij"); }
        catch (ClassNotFoundException e) { throw new ExceptionInInitializerError(e); }
    }

    static Field field(String name) throws Exception {
        var field = type.getDeclaredField(name);
        field.setAccessible(true);
        return field;
    }

    static Method method(String name, Class<?> parameter) throws Exception {
        var method = type.getDeclaredMethod(name, parameter);
        method.setAccessible(true);
        return method;
    }

    static void snapshot(DataOutputStream out, Object cipher) throws Exception {
        for (String name : new String[]{"c", "m", "n", "h"}) {
            out.writeInt(field(name).getInt(cipher));
        }
        for (String name : new String[]{"f", "k"}) {
            for (int value : (int[]) field(name).get(cipher)) out.writeInt(value);
        }
    }

    public static void main(String[] args) throws Exception {
        var in = new DataInputStream(System.in);
        var out = new DataOutputStream(new BufferedOutputStream(System.out));
        var construct = type.getDeclaredConstructor(int[].class);
        construct.setAccessible(true);
        var next = method("b", byte.class);
        var generate = method("a", int.class);
        var initialize = method("b", int.class);
        var noSeed = type.getDeclaredConstructor();
        noSeed.setAccessible(true);
        var bare = noSeed.newInstance();
        for (String name : new String[]{"c", "m", "n", "h"}) out.writeInt(field(name).getInt(bare));
        for (String name : new String[]{"f", "k"}) out.writeInt(field(name).get(bare) == null ? 0 : 1);
        int cases = in.readInt();
        for (int i = 0; i < cases; i++) {
            int[] seed = new int[in.readInt()];
            for (int j = 0; j < seed.length; j++) seed[j] = in.readInt();
            Object cipher = construct.newInstance((Object) seed);
            snapshot(out, cipher);
            for (int count : new int[]{1, 254, 1, 1, 255, 1}) {
                for (int j = 0; j < count; j++) out.writeInt((int)next.invoke(cipher, (byte)124));
                snapshot(out, cipher);
            }
            // Invoke both private routines directly against the already-used instance.
            // The counters and current result position matter independently of its stream.
            generate.invoke(cipher, 1);
            snapshot(out, cipher);
            initialize.invoke(cipher, -22820);
            snapshot(out, cipher);
            field("c").setInt(cipher, 0);
            field("h").setInt(cipher, Integer.MAX_VALUE);
            field("m").setInt(cipher, Integer.MIN_VALUE);
            field("n").setInt(cipher, Integer.MAX_VALUE);
            out.writeInt((int)next.invoke(cipher, (byte)107));
            snapshot(out, cipher);

        }
        try {
            construct.newInstance((Object)new int[257]);
            throw new AssertionError("Expected oversized seed to fail");
        } catch (InvocationTargetException expected) {}
        out.flush();
    }
}
