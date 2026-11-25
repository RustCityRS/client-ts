import java.awt.Canvas;
import java.awt.Frame;
import java.awt.Insets;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.StringJoiner;

// p.d, p.e and ed.d run untouched. TimerOracle supplies only System time.
// The Canvas and Frame callbacks are real AWT virtual calls from the gamepack.
public class ShellFrameTimingOracle {
    static Method update, draw;
    static Field wall, offset;
    static Shell shell;
    static Surface[] surfaces;
    static Host[] hosts;
    static Insets insets;
    static g original;
    static boolean fired;
    static int trigger, action;
    static long[] initialUpdates, initialDraws;
    static StringJoiner trace;

    static class Shell extends p {
        public void init() {}
        void b(byte n) {}
        void a(boolean b) {}
        void c(int n) {}
        void a(int n) { event(1, "update"); }
        void d(int n) { event(2, "draw"); }
    }
    static class Clock extends e {
        void a(byte n) { event(7, "reset"); }
        int a(byte n, int min, int cycle) { throw new AssertionError(); }
    }
    static class Surface extends Canvas {
        final int id;
        Surface(int id) { this.id = id; super.setVisible(false); }
        public void setSize(int w, int h) {
            event(3, "size" + id + ":" + w + "," + h);
            super.setSize(w, h);
        }
        public void setVisible(boolean visible) {
            event(4, "visible" + id + ":" + visible);
            super.setVisible(visible);
        }
        public void setLocation(int x, int y) {
            event(6, "loc" + id + ":" + x + "," + y);
            super.setLocation(x, y);
        }
        String geometry() { return getWidth()+","+getHeight()+","+isVisible()+","+getX()+","+getY(); }
    }
    static class Host extends Frame {
        int id;
        public Insets getInsets() { event(5, "insets" + id); return insets; }
    }
    static String fields() {
        return ca.c+","+ef.A+","+dd.a+","+ka.k+","+hi.g+","+wg.g+","+qd.u+","+mg.T+
            ","+Arrays.hashCode(ab.T)+","+Arrays.hashCode(tj.c);
    }
    @SuppressWarnings("unchecked")
    static <T extends Throwable> void raise(Throwable error) throws T { throw (T) error; }
    static void event(int stage, String text) {
        trace.add(text+"@"+fields());
        if (stage != trigger || fired) return;
        fired = true;
        switch (action) {
            case 1 -> throw new IllegalStateException("callback");
            case 2 -> throw original;
            case 3 -> throw new AssertionError("callback");
            case 4 -> ShellFrameTimingOracle.<RuntimeException>raise(new IOException("callback"));
            case 5 -> pe.S = surfaces[1];
            case 6 -> pe.S = null;
            case 7 -> tb.h = null;
            case 8 -> aj.kb = hosts[1];
            case 9 -> { tb.h = hosts[1]; aj.kb = null; }
            case 10 -> {
                hi.f = 901; fl.l = 717; pa.rb = Integer.MAX_VALUE - 1; sk.N = Integer.MIN_VALUE + 1;
                insets = new Insets(-31, 98, 0, 0);
            }
            case 11 -> insets = null;
            case 12 -> { tj.c = new long[2]; ed.d(28028); }
            case 13 -> {
                ab.T = new long[]{-991, 551}; tj.c = new long[]{94, -32, 17};
                ca.c = -8; ef.A = 48; mg.T = -97;
            }
            case 14 -> { wg.g = false; qd.u = true; ka.k = Integer.MIN_VALUE; hi.g = false; }
            case 15 -> { pe.S = surfaces[1]; tb.h = null; pa.rb = -811; sk.N = 713; }
        }
    }
    static String error(Throwable e) {
        if (e instanceof g wrapped) return (e == original ? "same:" : "wrapped:") + wrapped.q + "/" + error(wrapped.a);
        if (e instanceof ArrayIndexOutOfBoundsException) return "bounds";
        if (e instanceof ArithmeticException) return "arithmetic";
        if (e instanceof NullPointerException) return "null";
        if (e instanceof Error) return "error";
        return e instanceof IOException ? "checked" : "runtime";
    }
    static long[] ring(int length, int seed, int pos, long prev) {
        if (length < 0) return null;
        long[] a = new long[length];
        for (int i=0; i<a.length; i++) a[i] = (long)(i+1)*seed;
        if (pos >= 0 && pos < a.length) a[pos] = prev;
        return a;
    }
    static String ringText(long[] a) {
        return Arrays.toString(a).replace(" ", "");
    }
    static String run(String line) throws Exception {
        String[] a = line.split(" ");
        int op = Integer.parseInt(a[0]), pos = Integer.parseInt(a[3]), flags = Integer.parseInt(a[8]);
        ka.k = Integer.parseInt(a[4]); HostClockFixture.millis = Long.parseLong(a[5]);
        wall.setLong(null, HostClockFixture.millis);
        offset.setLong(null, Long.parseLong(a[6]));
        long prev = Long.parseLong(a[7]);
        ab.T = initialDraws = ring(Integer.parseInt(a[1]), 31, pos, prev);
        tj.c = initialUpdates = (flags & 16) != 0 ? ab.T : ring(Integer.parseInt(a[2]), -717, pos, prev);
        ca.c = ef.A = pos; dd.a = -31; mg.T = 7; qd.u = (flags & 32) != 0; wg.g = !qd.u; hi.g = (flags & 64) != 0;
        hi.f = 704; fl.l = 537; pa.rb = -11; sk.N = 17;
        insets = new Insets(15, 21, 87, 311);
        surfaces = new Surface[]{new Surface(0), new Surface(1)};
        pe.S = (flags & 4) == 0 ? surfaces[0] : null;
        tb.h = (flags & 1) != 0 ? hosts[0] : null;
        aj.kb = (flags & 2) != 0 ? hosts[1] : null;
        gh.X = (flags & 8) == 0 ? new Clock() : null;
        original = od.a(new IllegalStateException("inner"), "nested");
        trigger = Integer.parseInt(a[9]); action = Integer.parseInt(a[10]); fired = false;
        trace = new StringJoiner(";");
        String outcome = "ok";
        try {
            switch (op) {
                case 0 -> update.invoke(shell, (byte)85);
                case 1 -> draw.invoke(shell, -10911);
                case 2 -> ed.d(28028);
                default -> throw new AssertionError(op);
            }
        } catch (InvocationTargetException e) { outcome = error(e.getCause()); }
          catch (Throwable e) { outcome = error(e); }
        return String.join("|", outcome, trace.toString(), fields(), surfaces[0].geometry(), surfaces[1].geometry(),
            ringText(initialDraws), ringText(initialUpdates), ringText(ab.T), ringText(tj.c),
            (pe.S == null ? "-" : pe.S == surfaces[0] ? "0" : "1"));
    }
    public static void main(String[] args) throws Exception {
        update = p.class.getDeclaredMethod("d", byte.class); update.setAccessible(true);
        draw = p.class.getDeclaredMethod("e", int.class); draw.setAccessible(true);
        wall = eh.class.getDeclaredField("a"); wall.setAccessible(true);
        offset = eh.class.getDeclaredField("b"); offset.setAccessible(true);
        hosts = new Host[]{WindowModeOracle.container(Host.class), WindowModeOracle.container(Host.class)};
        hosts[1].id = 1;
        shell = WindowModeOracle.container(Shell.class);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line=in.readLine()) != null;) System.out.println(run(line));
    }
}
