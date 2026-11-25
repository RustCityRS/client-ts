import java.awt.Canvas;
import java.awt.Frame;
import java.awt.Graphics;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import javax.media.opengl.GL;
import javax.media.opengl.GLDrawable;

// Unmodified HD client.f(40), tf.d(), tf.n() and tf.b(rgb). Only the platform
// drawable, GL dispatch and the AWT screen are supplied by the fixture.
public final class HdFrameBoundaryOracle {
    static final GlRecorder recorder = GlRecorder.forOracle();
    static final List<String> events = new ArrayList<>();
    static final AssertionError serious = new AssertionError();
    static int fault, index;
    static boolean testGlFault;
    static boolean[] before;
    static GL second;
    static final class Screen extends Canvas {
        public Graphics getGraphics() { events.add("awt"); return null; }
        public void repaint() { events.add("repaint"); }
    }
    static String bits(boolean[] array) {
        if (array == null) return "-";
        StringBuilder s = new StringBuilder();
        for (boolean b : array) s.append(b ? '1' : '0');
        return s.toString();
    }
    static int dirty() {
        int count = 0;
        if (pa.R == null) return -1;
        for (boolean flag : pa.R) if (flag) count++;
        return count;
    }
    static GL driver(String id) {
        return recorder.gl((proxy, method, args) -> {
            String name = method.getName();
            List<String> values = new ArrayList<>();
            if (args != null) for (Object arg : args) {
                if (arg instanceof Float f) values.add(Integer.toHexString(Float.floatToRawIntBits(f)));
                else values.add(String.valueOf(arg));
            }
            events.add(id + "." + name + "(" + String.join(",",values) + ")");
            index++;
            if (testGlFault && index == fault) throw serious;
            if (testGlFault && index == -fault) tf.t = second;
            if (method.getReturnType() == int.class) return 0;
            if (method.getReturnType() == boolean.class) return false;
            return null;
        });
    }
    static GLDrawable drawable() {
        return recorder.drawable((proxy, method, args) -> {
                if (!method.getName().equals("swapBuffers")) throw new AssertionError(method.getName());
                events.add("swap@" + dirty() + "/" + bits(ch.y));
                if (fault == 1) throw new IllegalStateException();
                if (fault == 2) throw serious;
                if (fault == 3) { ch.y = new boolean[]{true,true,true,true}; bn.V = 3; }
                if (fault == 4) { bn.V = 0; }
                if (fault == 5) { ch.y = null; }
                return null;
            });
    }
    public static void main(String[] unused) throws Exception {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Field field = unsafe.getDeclaredField("theUnsafe");
        field.setAccessible(true);
        Object vm = field.get(null);
        client game = (client)unsafe.getMethod("allocateInstance",Class.class).invoke(vm,client.class);
        nk.O = new e();
        fh.Y = (Frame)unsafe.getMethod("allocateInstance",Class.class).invoke(vm,Frame.class);
        Field window = tf.class.getDeclaredField("E");
        window.setAccessible(true);
        Screen screen = new Screen();
        GL first = driver("A");
        second = driver("B");
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            String[] args = line.split(" ");
            boolean frame = args[0].equals("frame");
            testGlFault = !frame;
            fault = Integer.parseInt(args[2]); index = 0; events.clear();
            tf.t = first;
            window.set(null, fault == 6 ? null : drawable());
            cl.bb = false; hi.f = 0L; fh.P = false; ca.ab = true;
            na.h = false; id.f = false; md.W = -1; md.L = screen;
            tl.d = frame ? Integer.parseInt(args[1]) : 1;
            tf.w = !frame || Integer.parseInt(args[3]) != 0;
            bn.V = frame ? Integer.parseInt(args[4]) : 2;
            ch.y = before = new boolean[]{true,false,true,true};
            pa.R = new boolean[frame ? Integer.parseInt(args[5]) : 100];
            String result = "ok";
            try {
                switch (args[0]) {
                    case "frame" -> game.f(40);
                    case "colour" -> tf.b(Integer.parseInt(args[1]));
                    case "depth" -> tf.n();
                    default -> throw new AssertionError(line);
                }
            } catch (Throwable err) {
                if (err == serious) result = "error";
                else {
                    while (err instanceof ld wrapped) err = wrapped.f;
                    if (unused.length > 0) err.printStackTrace(System.err);
                    result = err.getClass().getSimpleName();
                }
            }
            System.out.println(result + "|" + String.join(";",events) + "|" + dirty() + "|" + bits(before) + "|" + bits(ch.y));
        }
    }
}
