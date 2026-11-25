import java.io.*;
import java.nio.*;
import java.nio.file.*;
import java.util.Arrays;

// Renders each row through lf.a, including all cached legacy tooltip texts.
class LegacyWidgetTextOracle {
    static final int W = 256, H = 96;
    static int fontId;
    static mb tooltipFont;

    static String render(int[] values, OutputStream output) throws Exception {
        int type = values[0], id = values[1], flags = values[2], align = values[3], fault = values[4];
        aj c = new aj();
        c.ob = type; c.y = false; c.n = -1; c.Kc = 463; c.C = 93; c.H = 20;
        c.ib = (flags & 4) == 0 ? 11 : 189; c.Mb = (flags & 8) == 0 ? 21 : 68;
        c.G = 2; c.M = 2; c.ab = 3; c.jd = -1; c.bb = align; c.nc = (flags & 32) != 0;
        c.oc = 0xb1f469; c.Ob = new int[]{1, 32, -1, 1000000}; c.Zb = new int[]{4152,996,0,996};
        c.mc = fault == 1 ? -1 : fault == 2 ? 99999 : fontId;
        if (id >= 0) c.gb = ad.a((byte)110, id).gb;
        else c.gb = aj.a(id == -1 ? "Cost %1<br><col=998877>Rune</col><br><br>End" : id == -2 ? "<br>X<br>" : "", (byte)-100);
        c.Vb = new int[][]{{20, 23, 0}};
        if (fault == 3) c.Ob = new int[]{1};
        if (fault == 4) c.Zb = null;
        if (fault == 5) c.gb = null;
        gh.C = (flags & 1) != 0 ? c : null; jf.i = 7; gh.A = (flags & 2) != 0 ? 6 : 7;
        wj.g = fault == 6 ? null : tooltipFont;
        ik.G = 3; hh.kb = 811; vk.db = (flags & 64) == 0 ? 811 : 812;
        Arrays.fill(sf.m, false); Arrays.fill(n.i, false); n.i[3] = (flags & 16) == 0;
        ml.T = (flags & 128) == 0 ? 0 : 2; rk.o = true; ie.F = true;
        int[] pixels = new int[W*H]; Arrays.fill(pixels, 0x274831); td.a(pixels, W, H);
        String result = "ok";
        try { lf.a(0, new aj[]{c}, -1, H - 3, 2, -1, W - 8, 0, true, 4); }
        catch (RuntimeException ex) {
            Throwable cause = ex; while (cause instanceof g wrapped) cause = wrapped.a;
            result = cause.getClass().getSimpleName();
        }
        ByteBuffer raw = ByteBuffer.allocate(pixels.length * 4).order(ByteOrder.LITTLE_ENDIAN);
        raw.asIntBuffer().put(pixels); output.write(raw.array());
        return result + " " + rk.o + " " + sf.m[3] + " " + c.vb + " " + c.R;
    }

    public static void main(String[] args) throws Exception {
        Path cache = Path.of(args[0]);
        try (var sprites = new ProceduralTextureCacheOracle.Disk(cache, 8);
             var metrics = new ProceduralTextureCacheOracle.Disk(cache, 13);
             var interfaces = new ProceduralTextureCacheOracle.Disk(cache, 3);
             var objects = new ProceduralTextureCacheOracle.Disk(cache, 19);
             var output = new BufferedOutputStream(Files.newOutputStream(Path.of(args[1])))) {
            al gfx = new al(sprites, true, true);
            wf.a(new al(metrics, true, true), gfx, true, null, new al(interfaces, true, true));
            bj.a(new al(objects, true, true), -113, true, null, null);
            fontId = gfx.a((byte)95, aj.a("p12_full", (byte)-100));
            aj temp = new aj(); temp.mc = fontId; tooltipFont = temp.a(ag.k, (byte)57);
            if (tooltipFont == null) throw new IllegalStateException("Missing p12_full");
            var input = new BufferedReader(new InputStreamReader(System.in));
            for (String line; (line = input.readLine()) != null;)
                System.out.println(render(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray(), output));
        }
    }
}
