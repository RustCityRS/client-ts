import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Differential oracle for the native loc placement of client.jar: nc.a(ZIIIIIIIZLke;I)V (ClientBuild.AddLoc in
// src/client/ClientBuild.ts). Compiled into the jar's unnamed package (javac -cp client.jar), so it calls the
// package-private statics directly; private fields go through reflection.
//
// argv[0] is the 530 cache directory. Every archive the placement reads (5 maps for the real heightmaps, 7 models, 16
// locs, 20 seqs, 22 varbits) is a real al over a ud that serves the groups straight from the sector files, so the jar's
// own JS5 decompression, definition decoders, model builders, lighting and hill skew run. The statics start from their
// <clinit> values (a fresh JVM). Textures are the fake pc of ProviderConfigOracle (the lighting only asks isAvailable).
//
// stdin is the script, one operation per line; stdout has exactly one line per operation:
//   <result>|<state diff>
// <result> is ok or the Java exception (the od.a wrapper g unwrapped to its cause). The state diff lists, whenever it
// changed since the previous line: je.Z (minusedlevel); every non-null square of the main and underwater layers with
// every field, entity and sprite (the linked square nested), entities and models as identity refs; the full dump of
// every model a changed square (or g.j) references when it is new or its fields changed (cb/fc: every instance field,
// arrays as identity:length:hash; ml: every field); every changed cell of ke.E (m_shadow), ti.db (m_mapo), tb.t (m_mapl)
// and the four collision maps' ke.d flags; the area-sound emitters (ik) appended to nc.j; the loc, mc1, mc2, mc3, seq and
// varbit caches (size, remaining, capacity, key order, value identities), g.j and its model, ll.j. Objects and arrays
// carry identity ids (#n) in first-dump order, reset at every world reset, so sharing (one Sprite on every tile it
// spans, a cached model reused, CopyForShareLight sharing arrays with the cached unlit model) is compared too.
// scene-build-locs.test.ts runs the same script through the TS port and compares the lines.
class SceneBuildLocsOracle {
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

    // The ud of ProviderConfigOracle: one archive served from the sector files.
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

    // The JS5 sector-file reader of test/cachefile.ts (readGroup).
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

    // The JS5 container without the two-byte version trailer the sector files keep after it.
    static byte[] container(byte[] raw) {
        int length = (raw[1] & 255) << 24 | (raw[2] & 255) << 16 | (raw[3] & 255) << 8 | raw[4] & 255;
        return Arrays.copyOf(raw, (raw[0] == 0 ? 5 : 9) + length);
    }

    // Fake textures, identical to ProviderConfigOracle.Textures and the TS side.
    static class Textures implements pc {
        public boolean a(int id, int dummy) { return true; }
        public boolean b(int dummy, int id) { return id % 7 != 3; }
        public int[] c(int dummy, int id) { return null; }
        public boolean a(int id, byte dummy) { return true; }
        public int[] a(int id, float brightness, int dummy) { return null; }
        public int a(byte dummy, int id) { return id * 0x1F3D + 0x123 & 0xFFFF; }
        public boolean d(int dummy, int id) { return (id & 1) == 0; }
    }

    static Field[] cbFields, fcFields, mlFields;
    static Field ndJ, faH, faM, faD, faO, haJ, haL, haH;
    static Field veA, veB, veP, tbX, taQ, keFlags;
    static Field rng;

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

    // ---- identity ----

    static IdentityHashMap<Object, Integer> ids = new IdentityHashMap<>();

    static int id(Object v) {
        Integer i = ids.get(v);
        if (i == null) {
            i = ids.size();
            ids.put(v, i);
        }
        return i;
    }

    static String ref(Object v) {
        return v == null ? "-" : "#" + id(v);
    }

    // ---- values and models (ProviderConfigOracle.value/model) ----

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

    // The models referenced by the squares described in this line, in reference order.
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

    // ---- squares (SceneWorldOracle.desc/square with model refs) ----

    static String desc(Object o) {
        if (o == null) return "-";
        if (o instanceof hk w) return "W#" + id(w) + ":" + w.f + "," + w.h + "," + w.l + "," + w.m + "," + mref(w.i) + "," + mref(w.c) + "," + w.k + "," + w.j;
        if (o instanceof nf d) return "N#" + id(d) + ":" + d.a + "," + d.d + "," + d.e + "," + d.b + "," + mref(d.i) + "," + mref(d.k) + "," + d.m + "," + d.g + "," + d.h + "," + d.l;
        if (o instanceof pk g) return "G#" + id(g) + ":" + g.e + "," + g.g + "," + g.l + "," + g.a + "," + mref(g.d);
        if (o instanceof mh s) return "O#" + id(s) + ":" + s.e + "," + s.l + "," + s.i + "," + s.a + "," + s.d + "," + mref(s.k) + "," + mref(s.b) + "," + mref(s.f);
        if (o instanceof ec s) {
            return "S#" + id(s) + ":" + s.u + "," + s.w + "," + s.c + "," + s.t + "," + s.s + "," + s.f + "," + s.a + "," + s.m + "," + s.n + "," + s.y + "," + s.r + "," + s.l + "," + mref(s.z);
        }
        if (o instanceof kb || o instanceof ma) return "ground:" + o.getClass().getName() + "#" + id(o);
        throw new IllegalStateException("desc " + o.getClass());
    }

    static String square(ra r, boolean nested) {
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

    // ---- caches (ProviderConfigOracle.cache) ----

    static String cache(String name, ve c) throws Exception {
        ei sentinel = (ei) tbX.get(veB.get(c));
        int count = 0;
        int kh = 1;
        int vh = 1;
        for (ei n = sentinel.t; n != sentinel; n = n.t) {
            if (!(n instanceof ta)) throw new IllegalStateException("soft node " + n.getClass());
            count++;
            long k = n.k;
            kh = 31 * kh + (int) (k ^ k >>> 32);
            Object v = taQ.get(n);
            vh = 31 * vh + (v == null ? -1 : id(v));
        }
        return " " + name + "=" + count + "/" + veP.getInt(c) + "/" + veA.getInt(c) + ":" + kh + ":" + vh;
    }

    static String refs(Object[] a) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length; i++) sb.append(i == 0 ? "" : ",").append(ref(a[i]));
        return sb.toString();
    }

    // ---- the diffed state ----

    static ke[] clip = new ke[4];
    static int[][][] savedHeights;
    static byte[][][] savedMapl;
    static LinkedHashMap<String, String> prevSquares = new LinkedHashMap<>();
    static HashMap<Integer, String> printedModels = new HashMap<>();
    static byte[][][] prevShadow;
    static int[][][] prevMapo;
    static byte[][][] prevMapl;
    static int[][][] prevClip;
    static int prevMinused = Integer.MIN_VALUE;
    static int prevSounds;
    static String prevCaches = "";

    static void layer(Map<String, String> cur, String tag, ra[][][] squares) {
        if (squares == null) return;
        for (int level = 0; level < squares.length; level++)
            for (int x = 0; x < squares[level].length; x++)
                for (int z = 0; z < squares[level][x].length; z++) {
                    ra r = squares[level][x][z];
                    if (r != null) cur.put(tag + level + "," + x + "," + z, square(r, true));
                }
    }

    static byte[][][] copy(byte[][][] a) {
        if (a == null) return null;
        byte[][][] out = new byte[a.length][][];
        for (int i = 0; i < a.length; i++) {
            out[i] = new byte[a[i].length][];
            for (int j = 0; j < a[i].length; j++) out[i][j] = a[i][j].clone();
        }
        return out;
    }

    static int[][][] copy(int[][][] a) {
        if (a == null) return null;
        int[][][] out = new int[a.length][][];
        for (int i = 0; i < a.length; i++) {
            out[i] = new int[a[i].length][];
            for (int j = 0; j < a[i].length; j++) out[i][j] = a[i][j].clone();
        }
        return out;
    }

    static void gridDiff(StringBuilder sb, String tag, byte[][][] prev, byte[][][] cur) {
        if (cur == null) return;
        for (int l = 0; l < cur.length; l++)
            for (int x = 0; x < cur[l].length; x++)
                for (int z = 0; z < cur[l][x].length; z++) {
                    int was = prev == null || l >= prev.length ? 0 : prev[l][x][z];
                    if (cur[l][x][z] != was) sb.append(' ').append(tag).append(l).append(',').append(x).append(',').append(z).append('=').append(cur[l][x][z]);
                }
    }

    static void gridDiff(StringBuilder sb, String tag, int[][][] prev, int[][][] cur) {
        if (cur == null) return;
        for (int l = 0; l < cur.length; l++)
            for (int x = 0; x < cur[l].length; x++)
                for (int z = 0; z < cur[l][x].length; z++) {
                    int was = prev == null || l >= prev.length ? 0 : prev[l][x][z];
                    if (cur[l][x][z] != was) sb.append(' ').append(tag).append(l).append(',').append(x).append(',').append(z).append('=').append(cur[l][x][z]);
                }
    }

    static int[][][] clipFlags() throws Exception {
        int[][][] out = new int[4][][];
        for (int i = 0; i < 4; i++) out[i] = clip[i] == null ? new int[0][] : (int[][]) keFlags.get(clip[i]);
        return out;
    }

    // One emitter of nc.j.
    static String sound(ik s) {
        return "ik#" + id(s) + ":" + (s.q == null ? "null" : s.q.length + ":" + hash(s.q)) + "," + s.t + "," + s.u + "," + s.v + "," + (s.x == null ? "-" : "loc" + s.x.k)
            + "," + (s.y ? 1 : 0) + "," + ref(s.z) + "," + s.A + "," + s.B + "," + s.C + "," + s.E + "," + ref(s.I) + "," + ref(s.J) + "," + s.K + "," + s.L + "," + s.M + "," + s.N + "," + ref(s.S);
    }

    // models: the models to dump this line (in addition to those the changed squares reference); all: dump every model
    // the squares reference whose fields changed.
    static String diff(boolean all) throws Exception {
        StringBuilder sb = new StringBuilder();
        if (je.Z != prevMinused) sb.append(" Z=").append(je.Z);
        prevMinused = je.Z;

        referenced.clear();
        LinkedHashMap<String, String> cur = new LinkedHashMap<>();
        layer(cur, "M", na.G);
        layer(cur, "U", vf.V);
        ArrayList<Object> allModels = all ? new ArrayList<>(referenced) : null;
        referenced.clear();
        for (Map.Entry<String, String> e : cur.entrySet()) {
            if (!e.getValue().equals(prevSquares.get(e.getKey()))) {
                // Re-describe only to collect this square's model refs (ids are already assigned).
                String[] key = e.getKey().substring(1).split(",");
                ra[][][] layer = e.getKey().charAt(0) == 'M' ? na.G : vf.V;
                square(layer[Integer.parseInt(key[0])][Integer.parseInt(key[1])][Integer.parseInt(key[2])], true);
                sb.append(' ').append(e.getKey()).append('=').append(e.getValue());
            }
        }
        for (String key : prevSquares.keySet()) if (!cur.containsKey(key)) sb.append(' ').append(key).append("=gone");
        prevSquares = cur;

        ArrayList<Object> models = new ArrayList<>(referenced);
        if (all) models.addAll(allModels);
        if (g.j != null && g.j.e != null) models.add(g.j.e);
        for (Object m : models) {
            int i = id(m);
            String dump = model(m);
            if (!dump.equals(printedModels.get(i))) {
                sb.append(" X").append(cls(m)).append('#').append(i).append('=').append(dump);
                printedModels.put(i, dump);
            }
        }

        gridDiff(sb, "s", prevShadow, ke.E);
        prevShadow = copy(ke.E);
        gridDiff(sb, "o", prevMapo, ti.db);
        prevMapo = copy(ti.db);
        gridDiff(sb, "l", prevMapl, tb.t);
        prevMapl = copy(tb.t);
        int[][][] flags = clipFlags();
        gridDiff(sb, "c", prevClip, flags);
        prevClip = copy(flags);

        int count = 0;
        for (jf n = nc.j.c.g; n != nc.j.c; n = n.g) {
            if (count >= prevSounds) sb.append(" B").append(count).append('=').append(sound((ik) n));
            count++;
        }
        if (count != prevSounds) sb.append(" Bn=").append(count);
        prevSounds = count;

        String caches = cache("locs", he.w) + cache("mc1", lj.c) + cache("mc2", vf.T) + cache("mc3", uj.f) + cache("seqs", ga.B) + cache("varbits", cd.d)
            + " gj=" + ref(g.j) + ":" + ref(g.j == null ? null : g.j.e) + " llj=" + refs(ll.j);
        if (!caches.equals(prevCaches)) sb.append(" |").append(caches);
        prevCaches = caches;
        return sb.toString();
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

    static final int[] LAND = {254, 256, 380, 382};

    static String setup(String dir) throws Exception {
        // Classes whose <clinit> draws Math.random are initialised before any seed (the TS modules load at import).
        for (String c : new String[] {"ok", "ki", "si", "cg"}) Class.forName(c, true, SceneBuildLocsOracle.class.getClassLoader());
        al models = new al(new Provider(dir, 7), false, true);
        gd.U = new al(new Provider(dir, 16), false, true);
        ik.Y = models;
        ok.z = true;
        ag.i = new al(new Provider(dir, 20), false, true);
        ma.g = new al(new Provider(dir, 22), false, true);
        dc.r = new Textures();
        al maps = new al(new Provider(dir, 5), false, true);
        // FinishBuildOracle's Lumbridge: the four land squares through the original loader into a 104 x 104 world.
        mc.a(4, 104, 104, 25, false);
        aj.a(false, -122);
        tb.t = new byte[4][104][104];
        for (int i = 0; i < 4; i++) clip[i] = new ke(104, 104);
        for (int i = 0; i < 4; i++) {
            int x = (49 + (i >> 1)) * 64 - 3160, z = (49 + (i & 1)) * 64 - 3160;
            nk.a(z, false, 3160, 31375, x, maps.a(-809612665, 0, LAND[i]), 3160, clip);
        }
        savedHeights = copy(lf.g);
        savedMapl = copy(tb.t);
        return " heights=" + hash3(lf.g) + " mapl=" + hash3(tb.t);
    }

    // A fresh world on the saved heightmaps: mc.a, aj.a, tb.t and the collision maps; under: with the underwater layer
    // selected (its heightmap a fixed slope).
    static void reset(boolean under) throws Exception {
        mc.a(4, 104, 104, 25, under);
        for (int l = 0; l < 4; l++) for (int x = 0; x < 105; x++) System.arraycopy(savedHeights[l][x], 0, lf.g[l][x], 0, 105);
        if (under) {
            for (int x = 0; x < 105; x++) for (int z = 0; z < 105; z++) nh.S[0][x][z] = -((x * 11 + z * 5) % 4) * 30 + 100 - x * 3;
            wd.a(true);
        }
        aj.a(under, -122);
        for (int l = 0; l < 4; l++) for (int x = 0; x < 104; x++) System.arraycopy(savedMapl[l][x], 0, tb.t[l][x], 0, 104);
        for (int i = 0; i < 4; i++) clip[i] = new ke(104, 104);
        ids = new IdentityHashMap<>();
        printedModels.clear();
        prevSquares = new LinkedHashMap<>();
        prevCaches = "";
        // The grids are the baseline of the next diffs; the line prints their hashes instead of every cell.
        prevShadow = copy(ke.E);
        prevMapo = copy(ti.db);
        prevMapl = copy(tb.t);
        prevClip = copy(clipFlags());
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

    static String baseline() throws Exception {
        return " base=" + ke.E.length + ":" + hash3(ke.E) + "," + ti.db.length + ":" + hash3(ti.db) + "," + hash3(tb.t) + "," + hash3(clipFlags()) + "," + hash3(ve.q)
            + "," + hash3(lf.g) + "," + (nh.S == null ? "-" : String.valueOf(hash3(nh.S))) + "," + (kl.Bb == vf.V ? "U" : kl.Bb == na.G ? "M" : "?");
    }

    static String run(String[] t, int[] n) throws Exception {
        switch (t[0]) {
            case "reset":
                reset(n[1] != 0);
                return baseline();
            case "vis":
                rj.l = n[1] != 0;
                return "";
            case "gdec":
                lf.i = n[1] != 0;
                return "";
            case "bl":
                sb.h = n[1];
                return "";
            case "mapl":
                tb.t[n[1]][n[2]][n[3]] = (byte) n[4];
                return "";
            case "loop":
                hh.kb = n[1];
                return "";
            case "var":
                vj.d[n[1]] = n[2];
                return "";
            case "check":
                return "";
            case "add": {
                // add seed underwater level loc heightLevel angle shape x z building collision(-1 = null)
                ((Random) rng.get(null)).setSeed(n[1]);
                nc.a(n[2] != 0, n[3], n[4], n[5], n[6], n[7], n[8], n[9], n[10] != 0, n[11] < 0 ? null : clip[n[11]], 2);
                return "";
            }
            default:
                throw new IllegalArgumentException("bad op " + t[0]);
        }
    }

    public static void main(String[] argv) throws Exception {
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
        veA = field(ve.class, "a");
        veB = field(ve.class, "b");
        veP = field(ve.class, "p");
        tbX = field(tb.class, "x");
        taQ = field(ta.class, "Q");
        keFlags = field(ke.class, "d");
        rng = field(Class.forName("java.lang.Math$RandomNumberGeneratorHolder"), "randomNumberGenerator");

        String dir = argv[0];
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII), 1 << 20);
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");
        for (String line; (line = reader.readLine()) != null;) {
            String[] t = line.split(" ");
            int[] n = new int[t.length];
            for (int i = 1; i < t.length; i++) n[i] = Integer.parseInt(t[i]);
            String result;
            if (t[0].equals("setup")) {
                result = "ok" + setup(dir);
            } else {
                try {
                    result = "ok" + run(t, n);
                } catch (IllegalStateException | IllegalArgumentException e) {
                    throw e;
                } catch (Throwable e) {
                    result = code(e);
                }
            }
            out.println(result + "|" + diff(t[0].equals("check")));
        }
        out.flush();
    }
}
