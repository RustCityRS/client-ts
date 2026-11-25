import java.io.*;
import java.lang.reflect.*;

class PacketBitOracle {
    static Field field(Class<?> owner, String name) throws Exception {
        var field = owner.getDeclaredField(name);
        field.setAccessible(true);
        return field;
    }

    static Method method(Class<?> owner, String name, Class<?>... parameters) throws Exception {
        var method = owner.getDeclaredMethod(name, parameters);
        method.setAccessible(true);
        return method;
    }

    public static void main(String[] args) throws Exception {
        var in = new DataInputStream(new BufferedInputStream(System.in));
        var out = new DataOutputStream(new BufferedOutputStream(System.out));
        var be = Class.forName("be");
        var gd = Class.forName("gd");
        var i = int.class;
        var ctor = be.getDeclaredConstructor(i);
        ctor.setAccessible(true);
        var packet = ctor.newInstance(600);
        byte[] bytes = (byte[])field(gd, "fb").get(packet);
        byte[] dest = new byte[320];
        var pos = field(gd, "yb");
        var bitPos = field(be, "Db");
        var cipherField = field(be, "Jb");
        var remaining = field(Class.forName("ij"), "c");
        var seed = method(be, "a", int[].class, i);
        var pIsaac = method(be, "k", i, i);
        var gIsaac = method(be, "n", i);
        var bulk = method(be, "a", byte[].class, i, i, i);
        var accessBits = method(be, "m", i);
        var accessBytes = method(be, "o", i);
        var bits = method(be, "h", byte.class, i);
        var available = method(be, "l", i, i);
        int count = in.readInt();
        for (int n = 0; n < count; n++) {
            int op = in.readInt(), a = in.readInt(), b = in.readInt();
            int value = 0, failed = 0;
            try {
                switch (op) {
                    case 0 -> {} // Constructor state.
                    case 1 -> pos.setInt(packet, a);
                    case 2 -> bitPos.setInt(packet, a);
                    case 3 -> seed.invoke(packet, new int[]{1, -1, Integer.MIN_VALUE, Integer.MAX_VALUE}, -35);
                    case 4 -> pIsaac.invoke(packet, 2, a);
                    case 5 -> value = (int)gIsaac.invoke(packet, -23542);
                    case 6 -> bulk.invoke(packet, dest, -1476, a, b);
                    case 7 -> accessBits.invoke(packet, 111);
                    case 8 -> accessBytes.invoke(packet, 0);
                    case 9 -> value = (int)bits.invoke(packet, (byte)9, a);
                    case 10 -> value = (int)available.invoke(packet, a, 66);
                    default -> throw new AssertionError(op);
                }
            } catch (InvocationTargetException expected) {
                failed = 1;
            }
            out.writeInt(failed);
            out.writeInt(value);
            out.writeInt(pos.getInt(packet));
            out.writeInt(bitPos.getInt(packet));
            Object cipher = cipherField.get(packet);
            out.writeInt(cipher == null ? -1 : remaining.getInt(cipher));
            out.write(bytes);
            out.write(dest);
        }
        out.flush();
    }
}
