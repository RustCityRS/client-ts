import java.awt.*;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferInt;
import java.lang.reflect.*;
import java.util.Arrays;

public class WindowModeOracle {
    private static final Method allocate;
    private static final Object unsafe;
    static {
        try {
            Class<?> type = Class.forName("sun.misc.Unsafe");
            Field field = type.getDeclaredField("theUnsafe");
            field.setAccessible(true);
            unsafe = field.get(null);
            allocate = type.getMethod("allocateInstance", Class.class);
        } catch (ReflectiveOperationException ex) {
            throw new ExceptionInInitializerError(ex);
        }
    }

    // AWT's headless toolkit supports lightweight containers and canvases. Give
    // the applet and frame that same initialized container state without a display.
    static <T extends Container> T container(Class<T> type) throws Exception {
        T target = type.cast(allocate.invoke(unsafe, type));
        Panel source = new Panel(null);
        for (Class<?> base = Container.class; base != Object.class; base = base.getSuperclass()) {
            for (Field field : base.getDeclaredFields()) {
                if (Modifier.isStatic(field.getModifiers())) continue;
                field.setAccessible(true);
                field.set(target, field.get(source));
            }
        }
        return target;
    }

    static class TestFrame extends Frame {
        int width, height;
        BufferedImage surface;
        public Insets getInsets() { return new Insets(17, 3, 9, 8); }
        public Dimension getSize() { return new Dimension(width, height); }
        public Graphics getGraphics() { return surface == null ? null : surface.getGraphics(); }
    }

    public static void main(String[] args) throws Exception {
        client applet = container(client.class);
        TestFrame desktop = container(TestFrame.class), full = container(TestFrame.class);
        tj.m = (fb) allocate.invoke(unsafe, fb.class);
        tj.m.o = applet;
        dg.B = applet;
        hd.m = -1;
        for (int host = 0; host < 3; host++) {
            for (int options = 0; options < 16; options++) {
                for (int mode = -1; mode <= 5; mode++) {
                    int width = (options & 1) == 0 ? 1180 : 610, height = (options & 1) == 0 ? 801 : 407;
                    applet.setSize(width, height);
                    desktop.width = width + 10; desktop.height = height + 20;
                    full.width = width + 300; full.height = height + 200;
                    tb.h = host > 0 ? desktop : null;
                    aj.kb = host == 2 ? full : null;
                    Container parent = host == 0 ? applet : host == 1 ? desktop : full;
                    parent.removeAll();
                    Canvas old = new Canvas();
                    pe.S = old;
                    parent.add(old);
                    old.setBounds(10, 20, 30, 40);
                    fb.l = (options & 2) != 0 ? "mac os x" : "windows";
                    aa.h = options % 3;
                    rj.l = (options & 1) != 0;
                    hi.g = wg.g = qd.u = false;
                    uj.j = wd.b = true;
                    vk.rb = oh.j = hi.f = fl.l = pa.rb = sk.N = -44;
                    oa.a = 12345; vc.P = 0;
                    Arrays.fill(sf.m, false);
                    int previous = p.Y;
                    if (mode == 5) ek.c(-84);
                    else ui.a(123, (options & 4) != 0, mode, (options & 8) != 0, 456);
                    System.out.println(String.join(" ", ""+ld.b(107), ""+oa.a, ""+vk.rb, ""+oh.j, ""+hi.f,
                        ""+fl.l, ""+pa.rb, ""+sk.N, ""+pe.S.getX(), ""+pe.S.getY(), ""+pe.S.getWidth(),
                        ""+pe.S.getHeight(), ""+old.getX(), ""+old.getY(), ""+old.getWidth(), ""+old.getHeight(),
                        ""+(p.Y-previous), ""+uj.j, ""+wg.g, ""+qd.u, ""+wd.b, ""+(vc.P!=0), ""+hi.g,
                        ""+Arrays.hashCode(sf.m)));
                }
            }
        }
        for (int options = 0; options < 32; options++) {
            tb.h = desktop;
            aj.kb = (options & 1) == 0 ? null : full;
            TestFrame host = aj.kb == null ? desktop : full;
            host.surface = new BufferedImage(91,79,BufferedImage.TYPE_INT_RGB);
            int[] pixels = ((DataBufferInt)host.surface.getRaster().getDataBuffer()).getData();
            Arrays.fill(pixels, 0xFF445566);
            vk.rb = 79; oh.j = 55;
            pa.rb = (options & 2) == 0 ? -4 : 11;
            sk.N = (options & 4) == 0 ? -7 : 9;
            hi.f = (options & 8) == 0 ? 48 : 99;
            fl.l = (options & 16) == 0 ? 36 : 66;
            bh.a(90);
            System.out.println(Arrays.hashCode(pixels));
        }
    }
}
