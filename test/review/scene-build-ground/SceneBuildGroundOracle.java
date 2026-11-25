import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.Random;
import jdk.internal.org.objectweb.asm.ClassReader;
import jdk.internal.org.objectweb.asm.ClassWriter;
import jdk.internal.org.objectweb.asm.Opcodes;
import jdk.internal.org.objectweb.asm.tree.ClassNode;
import jdk.internal.org.objectweb.asm.tree.InsnList;
import jdk.internal.org.objectweb.asm.tree.MethodInsnNode;
import jdk.internal.org.objectweb.asm.tree.MethodNode;
import jdk.internal.org.objectweb.asm.tree.VarInsnNode;

// Differential oracle for the native scene build of client.jar: the whole map build of gj.e on the real gamepack
// classes, ending in al.a(I[Lke;Z)V (ClientBuild.FinishBuild in src/client/ClientBuild.ts) and the scene draw.
// Compiled into the jar's unnamed package (javac -cp client.jar), so it calls the package-private statics directly.
//
// "patch <dir>" writes a copy of uk.class whose uk.a(IIIIIIIIIIIIIIIIIIII)V (world.SetGround) first calls ground(...)
// with its twenty arguments (the method itself then runs unchanged); the run puts <dir> ahead of the jar.
// "<cache dir>" runs the script on stdin. Every archive the build reads (0 frames, 1 bases, 2 config for FloType/FluType,
// 5 maps, 7 models, 8 sprites, 9 textures, 16 locs, 20 seqs, 22 varbits, 26 materials) is a real al over a ud that serves
// the groups straight from the sector files, the textures a real kg; land squares come from al.a(III)[B and loc squares
// through the XTEA keys of al.a(BI[II)[B, exactly as gj.e loads them. The statics start from their <clinit> values.
//
// Output: for every script line a header "@<index> <line>", the lines the operation prints, then "= <result>" (ok or the
// Java exception, the od.a wrapper g unwrapped to its cause). scene-build-ground.test.ts runs the same script through the
// TS port and compares the lines.
public class SceneBuildGroundOracle {
    static final String GROUND = "(" + "I".repeat(20) + ")V";
    // cb's instance fields in declaration order.
    static final String[] CB_FIELDS = {
        "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "E", "F",
        "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "W", "X", "Z", "ab", "bb", "db", "eb",
        "fb", "gb", "hb"
    };
    // fc's instance fields in declaration order, then nd.j.
    static final String[] FC_FIELDS = {
        "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "D", "E", "F", "G", "H",
        "I", "J", "K", "L", "M", "N", "Q", "R", "S", "U", "Y", "Z"
    };
    // ml's instance fields.
    static final String[] ML_FIELDS = {"A", "B", "D", "F", "G", "I", "K", "L", "M", "O", "P", "R", "j", "o", "q", "s", "y"};
    // The four Lumbridge squares (m49_49, m49_50, m50_49, m50_50); each loc group is the land group + 1.
    static final int[] LAND = {254, 256, 380, 382};
    // Land-only squares (no loc keys needed) with the floors Lumbridge lacks: m42_68 (dark underlays), m46_79 (dark
    // overlays), m34_66 (overlays with a secondary minimap colour) and m51_150 (the one floor whose secondary colour is 0).
    static final int[] EXTRA = {3587, 1218, 1898, 1212};
    static final int[][] KEYS = {
        {-1653558720, 2119901478, -1449369788, -1829505468}, {1150282919, 572626783, -257791473, 2031745700},
        {183396243, -461663209, -212681663, -266126212}, {0, 0, 0, 0}
    };

    // ---- the SetGround trace ----

    static PrintStream out;
    static boolean tracing;

    public static void ground(int a, int b, int c, int d, int e, int f, int g, int h, int i, int j, int k, int l, int m, int n, int o, int p, int q,
        int r, int s, int t) {
        if (!tracing) return;
        StringBuilder sb = new StringBuilder("G");
        for (int v : new int[] {a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t}) sb.append(' ').append(v);
        out.println(sb);
    }

    static void patch(Path dir) throws Exception {
        ClassNode node = new ClassNode();
        try (InputStream stream = SceneBuildGroundOracle.class.getResourceAsStream("/uk.class")) {
            new ClassReader(stream).accept(node, 0);
        }
        MethodNode target = node.methods.stream().filter(m -> m.name.equals("a") && m.desc.equals(GROUND)).findFirst().orElseThrow();
        InsnList prefix = new InsnList();
        for (int i = 0; i < 20; i++) prefix.add(new VarInsnNode(Opcodes.ILOAD, i));
        prefix.add(new MethodInsnNode(Opcodes.INVOKESTATIC, "SceneBuildGroundOracle", "ground", GROUND, false));
        target.instructions.insert(prefix);
        ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        node.accept(writer);
        Files.write(dir.resolve("uk.class"), writer.toByteArray());
    }

    // ---- cache access (SceneBuildLocsOracle.Provider) ----

    static class Provider extends ud {
        final String dir;
        final int archive;
        final db index;

        Provider(String dir, int archive) throws Exception {
            this.dir = dir;
            this.archive = archive;
            byte[] ref = container(readGroup(dir, 255, archive));
            index = new db(ref, q.a(0, ref, ref.length));
        }

        db b(int ignored) { return index; }

        byte[] a(int mode, int group) {
            try {
                return container(readGroup(dir, archive, group));
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        void b(int ignored, int group) {}

        int c(int group, int ignored) { return 100; }
    }

    static byte[] readGroup(String dir, int archive, int group) throws Exception {
        byte[] entry = new byte[6];
        try (RandomAccessFile idx = new RandomAccessFile(dir + "/main_file_cache.idx" + archive, "r")) {
            idx.seek(group * 6L);
            idx.readFully(entry);
        }
        int size = (entry[0] & 255) << 16 | (entry[1] & 255) << 8 | entry[2] & 255;
        int sector = (entry[3] & 255) << 16 | (entry[4] & 255) << 8 | entry[5] & 255;
        byte[] out = new byte[size];
        byte[] header = new byte[8];
        try (RandomAccessFile dat = new RandomAccessFile(dir + "/main_file_cache.dat2", "r")) {
            for (int offset = 0; offset < size; offset += 512) {
                dat.seek(sector * 520L);
                dat.readFully(header);
                int g = (header[0] & 255) << 8 | header[1] & 255;
                int part = (header[2] & 255) << 8 | header[3] & 255;
                if (g != group || part != offset >> 9 || (header[7] & 255) != archive) throw new IllegalStateException("bad sector " + archive + "/" + group);
                sector = (header[4] & 255) << 16 | (header[5] & 255) << 8 | header[6] & 255;
                dat.readFully(out, offset, Math.min(512, size - offset));
            }
        }
        return out;
    }

    static byte[] container(byte[] raw) {
        int length = (raw[1] & 255) << 24 | (raw[2] & 255) << 16 | (raw[3] & 255) << 8 | raw[4] & 255;
        return Arrays.copyOf(raw, (raw[0] == 0 ? 5 : 9) + length);
    }

    static al archive(String dir, int id) throws Exception {
        return new al(new Provider(dir, id), false, true);
    }

    // ---- reflection ----

    static Field[] cbFields, fcFields, mlFields;
    static Field ndJ, faH, faM, faD, faO, haJ, haL, haH, keFlags, rng, dcI;

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static void checkFields(Class<?> c, String[] expected) {
        HashSet<String> have = new HashSet<>();
        for (Field f : c.getDeclaredFields()) if (!Modifier.isStatic(f.getModifiers())) have.add(f.getName());
        if (!have.equals(new HashSet<>(Arrays.asList(expected)))) throw new IllegalStateException(c.getName() + " fields " + have);
    }

    // ---- identity and values (SceneBuildLocsOracle) ----

    static IdentityHashMap<Object, Integer> ids = new IdentityHashMap<>();

    static int id(Object v) {
        Integer i = ids.get(v);
        if (i == null) {
            i = ids.size();
            ids.put(v, i);
        }
        return i;
    }

    static int hash(int[] a) {
        int h = 1;
        for (int v : a) h = 31 * h + v;
        return h;
    }

    static int faHash(Object e) throws Exception {
        int h = 1;
        h = 31 * h + faH.getInt(e);
        h = 31 * h + faM.getInt(e);
        h = 31 * h + faD.getInt(e);
        h = 31 * h + faO.getInt(e);
        return h;
    }

    static int haHash(Object e) throws Exception {
        int h = 1;
        h = 31 * h + haJ.getInt(e);
        h = 31 * h + haL.getInt(e);
        h = 31 * h + haH.getInt(e);
        return h;
    }

    static String value(Object v) throws Exception {
        if (v == null) return "null";
        if (v instanceof Boolean b) return b ? "1" : "0";
        if (!v.getClass().isArray()) return v.toString();
        String t = "#" + id(v) + ":";
        if (v instanceof int[] a) return t + a.length + ":" + hash(a);
        if (v instanceof short[] a) {
            int[] w = new int[a.length];
            for (int i = 0; i < a.length; i++) w[i] = a[i];
            return t + a.length + ":" + hash(w);
        }
        if (v instanceof byte[] a) {
            int[] w = new int[a.length];
            for (int i = 0; i < a.length; i++) w[i] = a[i];
            return t + a.length + ":" + hash(w);
        }
        if (v instanceof int[][] a) {
            int h = 1;
            for (int[] row : a) h = 31 * h + (row == null ? 0 : 31 * row.length + hash(row));
            return t + a.length + ":" + h;
        }
        if (v instanceof fa[] a) {
            int h = 1;
            for (fa e : a) h = 31 * h + (e == null ? 0 : faHash(e));
            return t + a.length + ":" + h;
        }
        if (v instanceof ha[] a) {
            int h = 1;
            for (ha e : a) h = 31 * h + (e == null ? 0 : haHash(e));
            return t + a.length + ":" + h;
        }
        throw new IllegalStateException("unexpected " + v.getClass());
    }

    static String cls(Object m) {
        if (m instanceof cb) return "cb";
        if (m instanceof fc) return "fc";
        if (m instanceof ml) return "ml";
        return "other:" + m.getClass().getName();
    }

    static final ArrayList<Object> referenced = new ArrayList<>();

    static String mref(ug m) {
        if (m == null) return "-";
        referenced.add(m);
        return cls(m) + "#" + id(m);
    }

    static String model(Object m) throws Exception {
        StringBuilder sb = new StringBuilder();
        if (m instanceof cb) {
            for (int i = 0; i < cbFields.length; i++) sb.append(' ').append(CB_FIELDS[i]).append('=').append(value(cbFields[i].get(m)));
        } else if (m instanceof fc) {
            for (int i = 0; i < fcFields.length; i++) sb.append(' ').append(FC_FIELDS[i]).append('=').append(value(fcFields[i].get(m)));
            sb.append(" j=").append(value(ndJ.get(m)));
        } else if (m instanceof ml) {
            for (int i = 0; i < mlFields.length; i++) {
                Object v = mlFields[i].get(m);
                sb.append(' ').append(ML_FIELDS[i]).append('=').append(v instanceof ek s ? "seq" + s.f : value(v));
            }
        }
        return sb.toString();
    }

    // ---- squares (SceneBuildLocsOracle.desc/square, with every field of the ground) ----

    static String desc(Object o) throws Exception {
        if (o == null) return "-";
        if (o instanceof hk w) return "W#" + id(w) + ":" + w.f + "," + w.h + "," + w.l + "," + w.m + "," + mref(w.i) + "," + mref(w.c) + "," + w.k + "," + w.j;
        if (o instanceof nf d) return "N#" + id(d) + ":" + d.a + "," + d.d + "," + d.e + "," + d.b + "," + mref(d.i) + "," + mref(d.k) + "," + d.m + "," + d.g + "," + d.h + "," + d.l;
        if (o instanceof pk g) return "G#" + id(g) + ":" + g.e + "," + g.g + "," + g.l + "," + g.a + "," + mref(g.d);
        if (o instanceof mh s) return "O#" + id(s) + ":" + s.e + "," + s.l + "," + s.i + "," + s.a + "," + s.d + "," + mref(s.k) + "," + mref(s.b) + "," + mref(s.f);
        if (o instanceof ec s) {
            return "S#" + id(s) + ":" + s.u + "," + s.w + "," + s.c + "," + s.t + "," + s.s + "," + s.f + "," + s.a + "," + s.m + "," + s.n + "," + s.y + "," + s.r + "," + s.l + "," + mref(s.z);
        }
        if (o instanceof kb k) {
            return "kb#" + id(k) + ":" + k.a + "," + value(k.b) + "," + value(k.c) + "," + value(k.d) + "," + value(k.e) + "," + value(k.g) + "," + (k.h ? 1 : 0) + ","
                + value(k.j) + "," + value(k.k) + "," + k.l + "," + k.m + "," + k.n + "," + value(k.o) + "," + value(k.p) + "," + value(k.s);
        }
        if (o instanceof ma m) return "ma#" + id(m) + ":" + m.c + "," + (m.d ? 1 : 0) + "," + m.f + "," + m.h + "," + m.i + "," + m.l + "," + m.m;
        throw new IllegalStateException("desc " + o.getClass());
    }

    static String square(ra r, boolean nested) throws Exception {
        if (r == null) return "n";
        StringBuilder sb = new StringBuilder();
        sb.append('#').append(id(r)).append(':').append(r.K).append(',').append(r.N).append(',').append(r.w).append(',').append(r.v);
        sb.append(",t").append(r.t).append(",P").append(r.P).append(",A");
        for (int i = 0; i < r.A.length; i++) sb.append(i == 0 ? "" : "/").append(r.A[i]);
        sb.append(',').append(r.B ? 1 : 0).append(r.J ? 1 : 0).append(r.E ? 1 : 0);
        sb.append(',').append(r.D).append(',').append(r.I).append(',').append(r.U).append(',').append(r.G);
        sb.append(',').append(desc(r.x)).append(',').append(desc(r.F));
        sb.append(',').append(desc(r.z)).append(',').append(desc(r.C)).append(',').append(desc(r.u)).append(',').append(desc(r.y));
        sb.append(",H").append(r.H.length).append('[');
        for (int i = 0; i < r.H.length; i++) sb.append(desc(r.H[i])).append(';');
        sb.append("],L");
        if (r.L == null) sb.append('-');
        else if (nested) sb.append('(').append(square(r.L, false)).append(')');
        else sb.append('#').append(id(r.L));
        sb.append(",k").append(r.k).append(r.g == null ? "" : "g").append(r.p == null ? "" : "p");
        return sb.toString();
    }

    // ---- grids ----

    static String rows(int[][] a) {
        StringBuilder sb = new StringBuilder();
        sb.append(a.length);
        for (int[] row : a) sb.append(',').append(row == null ? "n" : row.length + ":" + hash(row));
        return sb.toString();
    }

    static int hash3(byte[][][] a) {
        int h = 1;
        for (byte[][] plane : a) for (byte[] row : plane) for (byte v : row) h = 31 * h + v;
        return h;
    }

    static int hash3(int[][][] a) {
        int h = 1;
        for (int[][] plane : a) for (int[] row : plane) h = 31 * h + hash(row);
        return h;
    }

    // Per level: n for a nulled level, else the hash of its cells.
    static String levels(byte[][][] a) {
        if (a == null) return "N";
        StringBuilder sb = new StringBuilder();
        sb.append(a.length);
        for (byte[][] plane : a) {
            if (plane == null) {
                sb.append(",n");
                continue;
            }
            int h = 1;
            for (byte[] row : plane) for (byte v : row) h = 31 * h + v;
            sb.append(',').append(h);
        }
        return sb.toString();
    }

    static String levels(int[][][] a) {
        if (a == null) return "N";
        StringBuilder sb = new StringBuilder();
        sb.append(a.length);
        for (int[][] plane : a) {
            if (plane == null) {
                sb.append(",n");
                continue;
            }
            int h = 1;
            for (int[] row : plane) h = 31 * h + hash(row);
            sb.append(',').append(h);
        }
        return sb.toString();
    }

    // ---- the build state ----

    static ke[] clip = new ke[4];
    static byte[][] land = new byte[8][], locs = new byte[4][];
    static ArrayList<Object> preModels = new ArrayList<>();
    static HashMap<Integer, String> printedModels = new HashMap<>();
    static int[] frame = new int[512 * 334];

    static void seed(long seed) throws Exception {
        ((Random) rng.get(null)).setSeed(seed);
    }

    static int squareX(int i) { return (49 + (i >> 1 & 1)) * 64 - 3160; }

    static int squareZ(int i) { return (49 + (i & 1)) * 64 - 3160; }

    static void setup(String dir) throws Exception {
        // Classes whose <clinit> draws Math.random are initialised before any seed (the TS modules load at import).
        for (String c : new String[] {"ok", "ki", "si", "cg"}) Class.forName(c, true, SceneBuildGroundOracle.class.getClassLoader());
        al models = archive(dir, 7);
        gd.U = archive(dir, 16);
        ik.Y = models;
        ok.z = true;
        ag.i = archive(dir, 20);
        ma.g = archive(dir, 22);
        aj.ec = archive(dir, 2);
        ik.V = archive(dir, 2);
        ef.K = archive(dir, 0);
        uk.d = archive(dir, 1);
        dc.r = new kg(archive(dir, 9), archive(dir, 26), archive(dir, 8), 20, false);
        al maps = archive(dir, 5);
        StringBuilder sb = new StringBuilder("I");
        for (int i = 0; i < 4; i++) {
            land[i] = maps.a(-809612665, 0, LAND[i]);
            locs[i] = maps.a((byte) 79, 0, KEYS[i], LAND[i] + 1);
            sb.append(' ').append(land[i].length).append(':').append(Arrays.hashCode(land[i])).append(',').append(locs[i].length).append(':').append(Arrays.hashCode(locs[i]));
        }
        for (int i = 0; i < 4; i++) {
            land[4 + i] = maps.a(-809612665, 0, EXTRA[i]);
            sb.append(' ').append(land[4 + i].length).append(':').append(Arrays.hashCode(land[4 + i]));
        }
        out.println(sb);
        seed(53002);
        dc.a(0.8f);
        out.println("B " + Float.floatToRawIntBits(dcI.getFloat(null)) + " " + hash(dc.o));
    }

    static void world(boolean under) throws Exception {
        mc.a(4, 104, 104, 25, under);
        aj.a(under, -122);
        tb.t = new byte[4][104][104];
        for (int i = 0; i < 4; i++) clip[i] = new ke(104, 104);
        ids = new IdentityHashMap<>();
        printedModels.clear();
        preModels.clear();
    }

    // The models the squares of both layers reference, in square order.
    static ArrayList<Object> sceneModels() throws Exception {
        referenced.clear();
        for (ra[][][] layer : new ra[][][][] {na.G, vf.V}) {
            if (layer == null) continue;
            for (ra[][] plane : layer) for (ra[] row : plane) for (ra r : row) if (r != null) square(r, true);
        }
        ArrayList<Object> models = new ArrayList<>(referenced);
        referenced.clear();
        return models;
    }

    static void printModels(String tag, ArrayList<Object> models) throws Exception {
        IdentityHashMap<Object, Boolean> seen = new IdentityHashMap<>();
        for (Object m : models) {
            if (seen.put(m, Boolean.TRUE) != null) continue;
            int i = id(m);
            String dump = model(m);
            if (!dump.equals(printedModels.get(i))) {
                out.println(tag + cls(m) + "#" + i + "=" + dump);
                printedModels.put(i, dump);
            }
        }
    }

    static void pre() throws Exception {
        preModels = sceneModels();
        printModels("X", preModels);
    }

    static void dump() throws Exception {
        out.println("Z " + je.Z + " " + ki.X + " " + si.u + " " + mc.P + " " + ag.l + " " + hash(ff.J) + " " + hash(gk.e) + " " + sb.h + " " + (rj.l ? 1 : 0));
        out.println("F " + levels(qe.V) + " " + levels(ka.m) + " " + levels(ib.jb) + " " + levels(lg.A) + " " + levels(ke.E) + " " + levels(ti.db));
        out.println("L " + hash3(tb.t) + " " + hash3(vb.c) + " " + (ve.q == lf.g ? "M" : ve.q == nh.S ? "U" : "?") + " " + (kl.Bb == na.G ? "M" : kl.Bb == vf.V ? "U" : "?"));
        for (int l = 0; l < lf.g.length; l++) out.println("H" + l + " " + rows(lf.g[l]));
        if (nh.S != null) out.println("W0 " + rows(nh.S[0]));
        for (int l = 0; l < 4; l++) out.println("C" + l + " " + rows((int[][]) keFlags.get(clip[l])));
        for (int i = 0; i < mc.P; i++) {
            jg o = ll.c[i];
            out.println("Q" + i + " " + o.a + "," + o.b + "," + o.c + "," + o.d + "," + o.e + "," + o.f + "," + o.g + "," + o.h + "," + o.i + "," + o.j + "," + o.m + ","
                + o.n + "," + o.o + "," + o.r + "," + o.s + "," + o.u + "," + o.y + "," + o.A);
        }
        referenced.clear();
        String[] tags = {"M", "U"};
        ra[][][][] layers = {na.G, vf.V};
        for (int t = 0; t < 2; t++) {
            ra[][][] layer = layers[t];
            if (layer == null) continue;
            for (int l = 0; l < layer.length; l++)
                for (int x = 0; x < layer[l].length; x++)
                    for (int z = 0; z < layer[l][x].length; z++) {
                        ra r = layer[l][x][z];
                        if (r != null) out.println("S" + tags[t] + l + "," + x + "," + z + "=" + square(r, true));
                    }
        }
        ArrayList<Object> models = new ArrayList<>(referenced);
        referenced.clear();
        printModels("X", models);
        printModels("V", preModels);
    }

    static void draw(int[] n) throws Exception {
        Arrays.fill(frame, 0);
        td.a(frame, 512, 334);
        dc.d();
        seed(n[6]);
        qc.a(n[1], n[2], n[3], n[4], n[5], null, null, null, null, null, null, 0, (byte) 0, n[1] >> 7, n[3] >> 7);
        int lit = 0;
        for (int p : frame) if (p != 0) lit++;
        out.println("P " + hash(frame) + " " + lit + " " + ag.l);
        StringBuilder sb = new StringBuilder("R");
        for (int y = 0; y < 334; y++) sb.append(' ').append(hash(Arrays.copyOfRange(frame, y * 512, y * 512 + 512)));
        out.println(sb);
    }

    static String code(Throwable t) {
        while (t instanceof g wrapped && wrapped.a != null) t = wrapped.a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ArithmeticException) return "arith";
        if (t instanceof NegativeArraySizeException) return "nase";
        if (t instanceof ClassCastException) return "cce";
        return "error:" + t;
    }

    static void run(String dir, String[] t, int[] n) throws Exception {
        switch (t[0]) {
            case "setup" -> setup(dir);
            case "seed" -> seed(n[1]);
            case "offs" -> {
                ki.X = n[1];
                si.u = n[2];
            }
            case "world" -> world(n[1] != 0);
            case "land" -> nk.a(squareZ(n[1]), n[2] != 0, 3160, 31375, squareX(n[1]), land[n[1]], 3160, clip);
            case "locs" -> hi.a((byte) -120, squareX(n[1]), clip, locs[n[1]], squareZ(n[1]), n[2] != 0);
            // rland/rlocs level cx cz square scx scz sourceLevel rotation underwater: wj.a's and jh.a's calls for one chunk.
            case "rland" -> lk.a(n[2] * 8, n[6] * 8, n[3] * 8, n[1], land[n[4]], n[8], clip, n[7], 73, n[9] != 0, n[5] * 8);
            case "rlocs" -> ck.a(n[2] * 8, n[5] * 8, clip, (byte) -125, n[8], n[7], locs[n[4]], n[3] * 8, n[9] != 0, n[1], n[6] * 8);
            // clear cx cz level: wj.a's bk.a for a chunk without a template.
            case "clear" -> bk.a(n[1] * 8, 8, n[2] * 8, (byte) 123, 8, n[3]);
            case "vis" -> rj.l = n[1] != 0;
            case "bl" -> sb.h = n[1];
            case "hdt" -> lf.j = n[1] != 0;
            case "pre" -> pre();
            case "finish" -> {
                tracing = true;
                try {
                    al.a(128, clip, n[1] != 0);
                } finally {
                    tracing = false;
                }
            }
            case "dump" -> dump();
            case "fillbase" -> cf.a(je.Z);
            case "draw" -> draw(n);
            default -> throw new IllegalArgumentException("bad op " + t[0]);
        }
    }

    public static void main(String[] argv) throws Exception {
        if (argv[0].equals("patch")) {
            patch(Path.of(argv[1]));
            return;
        }
        checkFields(cb.class, CB_FIELDS);
        checkFields(fc.class, FC_FIELDS);
        checkFields(ml.class, ML_FIELDS);
        cbFields = new Field[CB_FIELDS.length];
        for (int i = 0; i < CB_FIELDS.length; i++) cbFields[i] = field(cb.class, CB_FIELDS[i]);
        fcFields = new Field[FC_FIELDS.length];
        for (int i = 0; i < FC_FIELDS.length; i++) fcFields[i] = field(fc.class, FC_FIELDS[i]);
        mlFields = new Field[ML_FIELDS.length];
        for (int i = 0; i < ML_FIELDS.length; i++) mlFields[i] = field(ml.class, ML_FIELDS[i]);
        ndJ = field(nd.class, "j");
        faH = field(fa.class, "h");
        faM = field(fa.class, "m");
        faD = field(fa.class, "d");
        faO = field(fa.class, "o");
        haJ = field(ha.class, "j");
        haL = field(ha.class, "l");
        haH = field(ha.class, "h");
        keFlags = field(ke.class, "d");
        dcI = field(dc.class, "i");
        rng = field(Class.forName("java.lang.Math$RandomNumberGeneratorHolder"), "randomNumberGenerator");

        String dir = argv[0];
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII), 1 << 20);
        out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");
        int index = 0;
        for (String line; (line = reader.readLine()) != null; index++) {
            String[] t = line.split(" ");
            int[] n = new int[t.length];
            for (int i = 1; i < t.length; i++) n[i] = Integer.parseInt(t[i]);
            out.println("@" + index + " " + line);
            String result;
            try {
                run(dir, t, n);
                result = "ok";
            } catch (IllegalStateException | IllegalArgumentException e) {
                throw e;
            } catch (Throwable e) {
                result = code(e);
            }
            out.println("= " + result);
        }
        out.flush();
    }
}
