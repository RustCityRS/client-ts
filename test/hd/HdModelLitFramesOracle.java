import java.io.PrintWriter;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/** Original ak frame selection on an HD model assembled from player torso, arms and legs. */
public final class HdModelLitFramesOracle {
    private record Frame(cl set, int file) {}

    private static Frame frame(Map<Integer, cl> sets, int packed) {
        if (packed < 0) return new Frame(null, -1);
        int group = packed >>> 16;
        return new Frame(sets.computeIfAbsent(group, g -> new cl(re.B, ud.J, g, false)), packed & 65535);
    }

    static String digest(Object array) throws Exception {
        if (array == null) return "-";
        int count = Array.getLength(array);
        ByteBuffer data = ByteBuffer.allocate(count * 4);
        for (int i = 0; i < count; i++) data.putInt(Array.getInt(array, i));
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data.array()));
    }

    static void softwareMesh(PrintWriter out, String label, w model) throws Exception {
        StringBuilder row = new StringBuilder(label).append(' ').append(model.P);
        for (String name : new String[]{"J","H","T","Z","A","L","W","y","U","t","bb"}) {
            Field f = w.class.getDeclaredField(name);
            f.setAccessible(true);
            row.append(' ').append(digest(f.get(model)));
        }
        out.println(row);
    }

    static void software(PrintWriter out, Map<Integer, cl> sets, int[] basis) throws Exception {
        gb[] parts = {gb.a(vl.g,292,0),gb.a(vl.g,151,0),gb.a(vl.g,40250,0)};
        w model = new w(new gb(parts,3),64,768,-50,-10,-50);
        softwareMesh(out,"source",model);
        int[] walk = client.a(819,(byte)-20).g;
        Frame first = frame(sets,walk[0]), next = frame(sets,walk[1]);
        for (int mask : new int[]{1,2,3}) {
            model.a(first.set,first.file,next.set,next.file,2,7,mask,true,mask == 1 ? null : basis);
            softwareMesh(out,"masked " + mask,model);
        }
        w joined = (w)model.a(new w(gb.a(vl.g,292,0),64,768,-50,-10,-50));
        softwareMesh(out,"joined",joined);
        for (int type = 0; type <= 9; type++) {
            String outcome = "ok";
            try { joined.a(type,11,23,7); joined.f(); }
            catch (NullPointerException missing) { outcome = "null"; }
            softwareMesh(out,"all " + type + " " + outcome,joined);
        }
        model.a(7,3,-1,4);
        model.f();
        softwareMesh(out,"relit",model);
        Method triangle = w.class.getDeclaredMethod("a",int.class,int.class,int.class,int.class,int.class,int.class,int.class,int.class);
        triangle.setAccessible(true);
        for (int y : new int[]{1,2,3,8,9,10}) for (int x : new int[]{-5,-4,0,6,7})
            out.println("hit " + x + " " + y + " " + triangle.invoke(model,x,y,2,9,2,-4,6,-1));
        int[] pixels = new int[320 * 240];
        kb.a(pixels,320,240);
        hf.a();
        for (int i = 0; i < hf.a.length; i++) hf.a[i] = (i * 0x8357 + 0x23b1) & 0xffffff;
        // The headless fixture originally booted the title in HD; select the normal SD viewport now.
        w.o();
        for (int z : new int[]{40,50,70,130,290,620}) {
            Arrays.fill(pixels,0);
            model.a(384,0,65536,0,65536,0,47,z,0L,0,null);
            out.println("world " + z + " " + digest(pixels) + " " + Arrays.stream(pixels).filter(v -> v != 0).count());
        }
        for (int zoom : new int[]{0,100,384,1024}) {
            Arrays.fill(pixels,0);
            model.b(0,384,0,0,0,47,300,zoom);
            out.println("ortho " + zoom + " " + digest(pixels) + " " + Arrays.stream(pixels).filter(v -> v != 0).count());
        }
    }

    private static void compare(Path commands, Path output) throws Exception {
        Map<Integer, cl> sets = new HashMap<>();
        boolean[] punchMask = client.a(422, (byte)-20).n;
        int[] basis = {0, 0, 32768, 0, 32768, 0, -32768, 0, 0, 3, -2, 5, -5, 2, -3};
        od.c = true;
        try (PrintWriter out = new PrintWriter(Files.newBufferedWriter(output))) {
            for (String line : Files.readAllLines(commands)) {
                String[] values = line.split(" ");
                String label = values[0];
                boolean split = values[1].equals("split");
                Frame a = frame(sets, Integer.parseInt(values[2])), b = frame(sets, Integer.parseInt(values[3]));
                Frame c = frame(sets, Integer.parseInt(values[4])), d = frame(sets, Integer.parseInt(values[5]));
                int part = Integer.parseInt(values[6]);
                boolean useMatrix = Boolean.parseBoolean(values[7]), useMask = Boolean.parseBoolean(values[8]);
                boolean normals = Boolean.parseBoolean(values[9]), discard = Boolean.parseBoolean(values[10]);
                td model = new td(new gb(new gb[]{gb.a(vl.g, 292, 0), gb.a(vl.g, 151, 0), gb.a(vl.g, 40250, 0)}, 3), 64, 768, false);
                model.o();
                if (discard) model.a(false, false, false, false, false, true, false);
                HdGlModelAnimationOracle.snapshot(out, label, "before", model);
                if (split) model.a(a.set, a.file, b.set, b.file, 2, 7, c.set, c.file, d.set, d.file, 3, 8, useMask ? punchMask : null, normals);
                else model.a(a.set, a.file, b.set, b.file, 2, 7, part, normals, useMatrix ? basis : null);
                HdGlModelAnimationOracle.snapshot(out, label, "after", model);
            }
            software(out,sets,basis);
        }
    }

    public static void main(String[] args) throws Exception {
        HdGlModelAnimationOracle.withArchives(args, () -> compare(Path.of(args[2]), Path.of(args[3])));
    }
}
