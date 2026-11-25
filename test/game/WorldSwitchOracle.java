import java.applet.Applet;
import java.applet.AppletContext;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Proxy;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

@SuppressWarnings({"removal", "deprecation"})
class WorldSwitchOracle {
    static final HexFormat hex = HexFormat.of();
    static int contextMode;
    static AppletContext context;
    static String events;

    static class Page extends Applet {
        public AppletContext getAppletContext() {
            events += "c";
            if (contextMode == 1) return null;
            if (contextMode == 2) throw new IllegalStateException();
            if (contextMode == 3) throw new AssertionError();
            return context;
        }
    }

    static id text(String bytes) {
        if (bytes.equals("-")) return null;
        id result = new id();
        result.A = bytes.equals(".") ? new byte[0] : hex.parseHex(bytes);
        result.c = result.A.length;
        return result;
    }

    public static void main(String[] args) throws Exception {
        Class<?> type = Class.forName("sun.misc.Unsafe");
        var field = type.getDeclaredField("theUnsafe");
        field.setAccessible(true);
        Object unsafe = field.get(null);
        var allocate = type.getMethod("allocateInstance", Class.class);
        client game = (client) allocate.invoke(unsafe, client.class);
        tj.m = (fb) allocate.invoke(unsafe, fb.class);
        tj.m.o = (Applet) allocate.invoke(unsafe, Page.class);
        context = (AppletContext) Proxy.newProxyInstance(WorldSwitchOracle.class.getClassLoader(),
            new Class[]{AppletContext.class}, (proxy, method, values) -> {
                events += "s" + values[1] + "=" + hex.formatHex(((URL) values[0]).toExternalForm().getBytes(StandardCharsets.UTF_8));
                if (contextMode == 4) throw new IllegalStateException();
                if (contextMode == 5) throw new AssertionError();
                return null;
            });
        var reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        for (String row; (row = reader.readLine()) != null; ) {
            String[] v = row.split(" ");
            fb.f = Integer.parseInt(v[0]);
            d.c = Integer.parseInt(v[1]);
            int flags = Integer.parseInt(v[2]);
            qk world = new qk();
            world.w = Integer.parseInt(v[3]);
            world.D = text(v[4]);
            oj.k = text(v[5]);
            contextMode = Integer.parseInt(v[6]);
            events = "";
            client.L = (flags & 1) != 0;
            lk.z = (flags & 2) != 0;
            uj.l = (flags & 4) != 0;
            s.O = (flags & 8) == 0;
            dg.B = contextMode == 6 ? null : game;
            hl.w = world.w * 11;
            ce.F = 7919 * world.w;
            ph.j = dg.a = 42;
            oc.i = new qk[]{world};
            sd.T = "previous";
            qj.C = 19;
            ag.f = 20;
            aa.a = 21;
            ie.r = 22;
            String result;
            try {
                result = Boolean.toString(fd.a(42, 32));
            } catch (AssertionError e) {
                result = "error";
            } catch (RuntimeException e) {
                result = "exception";
            }
            System.out.println(result + "|" + events + "|" + hex.formatHex(sd.T.getBytes(StandardCharsets.UTF_8)) + "|" +
                qj.C + "|" + ag.f + "|" + aa.a + "|" + ie.r + "|" + hex.formatHex(ce.c(-8969).b(false)));
        }
    }
}
