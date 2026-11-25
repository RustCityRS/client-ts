import java.io.*;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.*;
import java.nio.file.*;
import java.util.*;

// Every inventory is decoded by aj from the sector cache. lf, jg, jb, fc and dc are unmodified.
public class InventoryGridOracle {
    static final int WIDTH = 146, HEIGHT = 106;
    static al interfaces;
    static aj container(int key) {
        aj c = new aj();
        c.Kc = key; c.n = -1; c.y = true; c.ob = 0;
        c.ib = 7; c.Mb = 9; c.C = 92; c.H = 59; c.Ac = 19; c.jb = 117;
        return c;
    }

    static String row(int[] args, OutputStream images) throws Exception {
        int group = args[0], file = args[1], layout = args[2], action = args[3], fault = args[4], dy = args[5];
        aj grid = new aj(); grid.Kc = group << 16 | file;
        grid.a(-5, new gd(interfaces.a(-809612665, file, group)));
        if (grid.ob != 2) throw new AssertionError("Not an IF1 inventory");
        grid.ib = 4; grid.Mb = 8; grid.C = grid.G * 32; grid.H = grid.M * 32;
        if (action != 0) {
            int[] objects = {4151, 995, 4152, 303, 1127};
            for (int i = 0; i < grid.Zb.length; i++) if (i % 7 != 6) {
                grid.Zb[i] = objects[i % objects.length] + 1;
                grid.Ob[i] = i == 1 ? 101 : 1;
            }
        }
        int index = layout == 2 || layout == 3 ? 3 : 0;
        aj parent = container((64 << 16) + index);
        aj other = container(-4);
        other.n = -77; other.Ac = 11; other.jb = 145;
        aj[] widgets = new aj[5];
        aj[] source = widgets;
        grid.n = -1;
        va.Z = new nc(8);
        if (layout == 0) { widgets[2] = grid; }
        else {
            grid.n = parent.Kc;
            widgets[index] = parent;
            if (layout == 3) {
                parent.pb = new aj[fault == 9 ? 2 : 5];
                parent.pb[1] = grid;
                if (fault != 9 && fault != 10) parent.pb[index] = other;
            } else { widgets[4] = grid; }
            if (layout == 4) {
                aj host = container(71 << 16); host.Ac = 8;
                fk.ab[12] = widgets; rg.b[12] = true;
                qd mounted = new qd(); mounted.q = 1; mounted.v = 12;
                va.Z.a((byte)-89, mounted, (long)host.Kc);
                widgets = new aj[]{host};
            }
        }
        le.c = action == 2 ? 1 : 0; ti.X = grid.Kc; ph.h = 0;
        m.G = action == 3 ? grid : null; ki.O = 0;
        ec.e = action == 4 ? grid : null; vj.u = 0; ej.b = fault == 13 ? 4 : 5;
        gl.y = 14; bd.S = 20; sj.C = gl.y + dy; pf.Q = bd.S + dy;
        id.p = fault == 12 ? Integer.MIN_VALUE : 3;
        if (fault == 1) grid.yb = new int[1];
        if (fault == 2) grid.Gb = null;
        if (fault == 3) grid.Zb = Arrays.copyOf(grid.Zb, 2);
        if (fault == 4) grid.Ob = Arrays.copyOf(grid.Ob, 2);
        if (fault == 5) { grid.Zb[0] = 0; grid.lb[0] = 900000; }
        if (fault == 6 || fault == 11) grid.Zb[0] = 40001;
        if (fault == 14) { grid.ib = WIDTH + 1; grid.Mb = HEIGHT + 1; }
        rk.o = true; ie.F = true; ml.T = 0;
        ik.G = 2; hh.kb = vk.db = 92;
        sf.m = new boolean[fault == 11 || fault == 17 ? 2 : 100]; n.i = new boolean[100]; n.i[2] = fault != 7;
        gb.r = new ve(100); dc.h = fault == 8;
        int[] pixels = new int[WIDTH * HEIGHT];
        for (int i = 0; i < pixels.length; i++) pixels[i] = (0x506078 + i * 91) & 0xffffff;
        td.a(pixels, WIDTH, HEIGHT);
        if (fault == 16 || fault == 17) {
            Objects.requireNonNull(jg.a(4151,1,grid.e,1,(byte)73,3153952));
            dc.h = true; vk.db = 91;
        }
        if (fault == 15 && layout != 0) {
            other.Kc = parent.Kc;
            if (layout == 3) {
                parent.pb[index] = null;
            } else {
                other.n = -1;
                source[index] = other;
            }
        }
        String result = "ok";
        try { lf.a(0, widgets, -1, HEIGHT - 4, 2, -1, WIDTH - 3, 0, true, 2); }
        catch (RuntimeException error) {
            Throwable t = error;
            while (t instanceof g wrap) t = wrap.a;
            if (t instanceof NullPointerException) result = "null";
            else if (t instanceof IndexOutOfBoundsException) result = "bounds";
            else throw error;
        }
        ByteBuffer frame = ByteBuffer.allocate(pixels.length * 4).order(ByteOrder.LITTLE_ENDIAN);
        frame.asIntBuffer().put(pixels); images.write(frame.array());
        return result + " " + rk.o + " " + dc.h + " " + (sf.m.length > 2 && sf.m[2]) + " " +
            bd.S + " " + parent.Ac + " " + other.Ac + " " + grid.vb + " " + grid.R + " " +
            td.e + " " + td.b + " " + td.h + " " + td.d;
    }
    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args[0]);
        try (var obj = new ProceduralTextureCacheOracle.Disk(dir,19); var models = new ProceduralTextureCacheOracle.Disk(dir,7);
             var sprites = new ProceduralTextureCacheOracle.Disk(dir,8); var metrics = new ProceduralTextureCacheOracle.Disk(dir,13);
             var textures = new ProceduralTextureCacheOracle.Disk(dir,9); var mats = new ProceduralTextureCacheOracle.Disk(dir,26);
             var ifs = new ProceduralTextureCacheOracle.Disk(dir,3); var images = new BufferedOutputStream(Files.newOutputStream(Path.of(args[1])))) {
            al graphics = new al(sprites,true,true), fonts = new al(metrics,true,true), meshes = new al(models,true,true);
            interfaces = new al(ifs,true,true);
            wf.a(fonts, graphics, true, meshes, interfaces);
            fg smallFont = (fg) sb.a(graphics, graphics.a((byte)95,vb.a("p11_full",(byte)99)), 0, 0, fonts);
            bj.a(new al(obj,true,true), -113, true, smallFont, meshes);
            Field model = kl.class.getDeclaredField("xb"); model.setAccessible(true);
            model.setInt(rg.a(40000,-28322),900000);
            dc.r = new kg(new al(textures,false,true), new al(mats,true,true), graphics, 20, false);
            Field gamma = dc.class.getDeclaredField("i"); gamma.setAccessible(true); gamma.setFloat(null, .8f);
            Method palette = dc.class.getDeclaredMethod("b",int.class,int.class); palette.setAccessible(true); palette.invoke(null,0,512);
            BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
            for (String line; (line = in.readLine()) != null;)
                System.out.println(row(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray(), images));
        }
    }
}
