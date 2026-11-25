import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.util.Arrays;
import javax.media.opengl.GL;

/** The original gn.a routine selects colours, redraw eligibility and the dj rectangle or line entry point. */
public final class HdWidgetPrimitiveOracle {
    public static void main(String[] args) throws Exception {
        GL gl = HdFrameBoundaryOracle.driver("G");
        HdFrameBoundaryOracle.testGlFault = true;
        HdFrameBoundaryOracle.second = null;
        Field clipRight = dj.class.getDeclaredField("d");
        clipRight.setAccessible(true);
        tf.w = true; tf.J = 41; tf.A = 33; sc.z[0] = true;
        rh.h = new dd(new byte[257]);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            int[] a = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int flags = a[1];
            be c = HdWidgetFrameOracle.component(20, -1, a[0], 5, 4, a[2], a[3], 0xfb8244);
            c.Hb = (flags & 1) != 0; c.zb = (flags & 2) != 0; c.m = (flags & 4) != 0;
            c.Bc = (flags & 8) != 0 ? new int[0] : null;
            og.e = (flags & 16) != 0 ? c : null;
            c.cc = 0x158fee; c.Cb = 0x98765b; c.vb = 0xacbd12;
            c.wb = a[4]; c.Zb = a[5];
            if (c.I == 8) {
                dg.h = (flags & 16) == 0 ? c : null;
                kf.l = pg.V = 5;
                c.Gb = pa.O;
            }
            tf.t = gl; HdWidgetFrameOracle.field("o", false); HdWidgetFrameOracle.field("s", -1);
            HdWidgetFrameOracle.field("l", true); HdWidgetFrameOracle.field("u", true); HdWidgetFrameOracle.field("F", true);
            HdFrameBoundaryOracle.events.clear(); HdFrameBoundaryOracle.index = 0; HdFrameBoundaryOracle.fault = a[6];
            String result = "ok";
            try { gn.a(2, 3, 7, new be[]{c}, 29, -1, 4, 27, (byte)119, 0); }
            catch (AssertionError fatal) { if (fatal != HdFrameBoundaryOracle.serious) throw fatal; result = "Error"; }
            catch (ld error) { result = error.f.getClass().getSimpleName() + " " + error.e; }
            System.out.println(result + "|" + c.Uc + "|" + dj.c + "," + dj.b + "," + clipRight.getInt(null) + "," + dj.e +
                    "|" + String.join(";", HdFrameBoundaryOracle.events));
        }
    }
}
