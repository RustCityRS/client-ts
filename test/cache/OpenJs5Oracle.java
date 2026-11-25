import java.awt.Canvas;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@SuppressWarnings("removal")
class OpenJs5Oracle {
    static class Page extends java.applet.Applet { public java.awt.Dimension getSize() { return new java.awt.Dimension(765,503); } }
    static final List<String> closed = new ArrayList<>();
    static final List<RandomAccessFile> files = new ArrayList<>();
    static String mode;
    static Path directory;
    static fb other;

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Object get(Object o, String name) throws Exception {
        return field(o.getClass(), name).get(o);
    }

    static ne file(String name) throws Exception {
        ne raw = new ne();
        java.io.File path = directory.resolve(name).toFile();
        RandomAccessFile handle = new RandomAccessFile(path, "rw") {
            public long length() throws IOException {
                if (mode.equals("open-" + name)) throw new IOException("read length");
                if (mode.equals("swap-" + name)) tj.m = other;
                return super.length();
            }
            public void close() throws IOException {
                closed.add(name);
                if (mode.equals("close-" + name)) throw new IOException("close");
                super.close();
            }
        };
        files.add(handle);
        field(ne.class, "d").set(raw, handle);
        field(ne.class, "a").setLong(raw, Long.MAX_VALUE);
        field(ne.class, "c").set(raw, path);
        return raw;
    }

    static int capacity(sa value) throws Exception {
        return value == null ? -1 : ((byte[])get(value,"f")).length;
    }

    static String store(cg value) throws Exception {
        if (value == null) return "-";
        return get(value,"a") + "/" + get(value,"e") + "/" + (get(value,"b") == ik.O) + "/" + capacity((sa)get(value,"k"));
    }

    static void archive(int id, boolean packed, boolean prefetch, boolean unpacked) throws Exception {
        mc before = id < 0 || id >= lj.h.length ? null : lj.h[id];
        try {
            al j = ra.a(packed, prefetch, id, unpacked, 6021);
            mc provider = lj.h[id];
            System.out.println("archive " + id + " " + (get(j,"t") == provider) + " " + (before == provider) + " "
                + get(j,"e") + " " + get(j,"N") + " " + get(provider,"t") + " " + get(provider,"W") + " "
                + (get(provider,"F") == va.O) + " " + store((cg)get(provider,"Q")) + " " + get(provider,"cb"));
        } catch (RuntimeException e) {
            System.out.println("error " + id + " " + (mi.v == null || get(mi.v,"n") == null ? "-" : ((gd)get(mi.v,"n")).yb));
        }
    }

    public static void main(String[] args) throws Exception {
        directory = Path.of(args[0]);
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Object allocator = field(unsafe,"theUnsafe").get(null);
        client game = (client)unsafe.getMethod("allocateInstance", Class.class).invoke(allocator,client.class);
        for (String scenario : Arrays.asList("no-disk","normal","open-i3","open-master","open-uid","close-i2","null-i4",
                                             "swap-dat","swap-i13","swap-master","swap-uid")) {
            mode = scenario;
            closed.clear(); files.clear();
            fb link = tj.m = new fb((Page)unsafe.getMethod("allocateInstance",Class.class).invoke(allocator,Page.class),0,null,0);
            other = null;
            if (mode.startsWith("swap-")) {
                other = (fb)unsafe.getMethod("allocateInstance",Class.class).invoke(allocator,fb.class);
                other.t = file("second-dat");
                other.b = new ne[28];
                for (int i=0;i<28;i++) other.b[i] = file("second-i"+i);
                other.m = file("second-master"); other.h = file("second-uid");
            }
            pe.S = new Canvas();
            d.c = 2;
            ik.O = null; f.g = new sa[28]; q.c = null; va.O = null; ei.q = null; lj.h = new mc[28]; mi.v = null;
            if (!mode.equals("no-disk")) {
                link.t = file("dat");
                link.b = new ne[28];
                for (int i=0;i<28;i++) if (i != 4 || !mode.equals("null-i4")) link.b[i] = file("i"+i);
                link.m = file("master"); link.h = file("uid");
            }
            System.out.println("scenario " + scenario);
            try { game.b((byte)-108); }
            catch (RuntimeException failure) {
                if (!mode.equals("null-i4")) throw failure;
                System.out.println("setup-error");
            }
            List<Integer> buffers = new ArrayList<>();
            for (sa s : f.g) if (s != null) buffers.add(capacity(s));
            System.out.println("files " + capacity(ik.O) + " " + buffers.size() + " " + buffers.stream().allMatch(i -> i == 6000)
                + " " + capacity(q.c) + " " + capacity(ei.q) + " " + store(va.O) + " "
                + (link.t == null) + "/" + (link.b == null) + "/" + (link.m == null) + "/" + (link.h == null));
            if (other != null) System.out.println("second " + (tj.m == other) + "/" + (other.t == null) + "/" +
                    (other.b == null) + "/" + (other.m == null) + "/" + (other.h == null));
            archive(0,true,false,false);
            mi.v = new wi(wk.d,ud.a);
            archive(1,false,true,false);
            byte[] directoryBytes = new byte[5 + 29 * 8];
            for (int i=5;i<directoryBytes.length;i++) directoryBytes[i]=(byte)(i*11);
            fd request=(fd)get(mi.v,"l");
            request.P=new gd(directoryBytes);request.P.yb=directoryBytes.length;request.D=false;mi.v.b(-5);
            for (int id : new int[]{-1,0,0,4,27,28,29}) archive(id,id != 0,id != 4,id != 27);
            game.c(0);
            System.out.println("closed " + String.join(",",closed));
            mode = "cleanup";
            link.a(15);
            for (RandomAccessFile f : files) f.close();
        }
    }
}
