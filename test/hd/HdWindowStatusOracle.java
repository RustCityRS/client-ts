import java.awt.Frame;
import java.lang.reflect.Field;
import java.util.HexFormat;

// Native display creation belongs to the host. le.a(0) only checks the Frame reference for null.
public class HdWindowStatusOracle {
    static Frame frameReference() throws Exception {
        Class<?> type = Class.forName("sun.misc.Unsafe");
        Field singleton = type.getDeclaredField("theUnsafe");
        singleton.setAccessible(true);
        return (Frame) type.getMethod("allocateInstance", Class.class).invoke(singleton.get(null), Frame.class);
    }

    public static void main(String[] args) throws Exception {
        Frame frame = frameReference();
        ag.P = new i(128);
        ag.P.a(new int[]{530, -243, 0x7fffffff, 0}, false);
        for (int mask = 0; mask < 8; mask++) {
            tf.w = (mask & 1) != 0;
            jk.y = (mask & 2) != 0;
            fh.Y = (mask & 4) == 0 ? null : frame;
            dl.d = 765 + (mask * 61);
            uj.B = 503 + (mask * 79);
            pa.N = mask % 3;
            int start = ag.P.T;
            ej.i(-3);
            int mode = le.a(0);
            le.k = true;
            int guarded = le.a(1);
            System.out.println(mode + " " + HexFormat.of().formatHex(ag.P.y, start, ag.P.T) + " " + guarded + " " + le.k);
        }
    }
}
