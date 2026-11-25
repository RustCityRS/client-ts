import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;

// Differential oracle for the config model providers of client.jar: kl (ObjType) a(ZZ)Lcb; wear mesh, a(ZI)Lcb; head
// mesh, a(B)Lfc; inventory model and a(Lek;IIIII)Lnd; cached lit model; ja (NpcType) a([Lci;ILek;IIIBIILek;)Lnd; temp
// model with slot, primary and secondary animations and a(Lek;IIII)Lnd; head model; jb (LocType) the two Lwj; getters
// a([[IIIIZB[[ILch;IIZ)Lwj; / a(IIIIII[[IIZIBLch;[[ILek;)Lwj; and the private a(III)Lcb; builder they share; li
// (SpotType) a(IBII)Lnd;; and wj (LocEntity) with its member-map static g.j and jb's scratch ll.j. Compiled with javac
// next to client.jar (same unnamed runtime package), so package-private members are used directly; private fields go
// through reflection.
//
// argv[0] is the 530 cache directory (main_file_cache.dat2 / .idx*). Every archive the providers read (0 frames, 1
// bases, 2 config (BAS), 7 models, 16 locs, 18 npcs, 19 objs, 20 seqs, 21 spots, 22 varbits) is a real al over a ud
// that serves the group straight from the sector files, so the gamepack's own JS5 decompression and definition
// decoders run. The statics start from their <clinit> values (a fresh JVM); the first script line ("init") prints them.
//
// stdin is the script (one operation per line); stdout has exactly one line per operation: the result (ok or the Java
// exception, unwrapping the obfuscator's g wrapper), then " | "-separated: the returned model (or entity) with every
// instance field, the entries most recently used in the family's model caches, and the state every op can touch (each
// cache's size, remaining slots, key order and value identities; the CopyForAnim scratch models fc.k/fc.V/fc.cb; g.j
// and its model; ll.j; ja's 14-slot animation scratch). Every array and model carries an identity tag (#n, numbered
// in first-dump order within the line), so sharing between a returned model, the cache entries and the scratch models
// is compared as well as the contents. test/review/provider-config.test.ts runs the same script through the TS port.
class ProviderConfigOracle {
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

    // Fake textures, identical to provider-config.test.ts: only pc.b(II)Z (isAvailable) is reached by the lighting.
    static class Textures implements pc {
        public boolean a(int id, int dummy) { return true; }
        public boolean b(int dummy, int id) { return id % 7 != 3; }
        public int[] c(int dummy, int id) { return null; }
        public boolean a(int id, byte dummy) { return true; }
        public int[] a(int id, float brightness, int dummy) { return null; }
        public int a(byte dummy, int id) { return id * 0x1F3D + 0x123 & 0xFFFF; }
        public boolean d(int dummy, int id) { return (id & 1) == 0; }
    }

    static Field[] cbFields, fcFields;
    static Field ndJ, faH, faM, faD, faO, haJ, haL, haH;
    static Field veA, veB, veP, tbX, taQ;
    static Field fcK, fcV, fcCb;
    static Field klK, jaAb, jbC;
    static final Textures textures = new Textures();
    static final int[][][] maps = new int[5][][];
    static IdentityHashMap<Object, Integer> ids = new IdentityHashMap<>();

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
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

    static int hash(int[] a) {
        int h = 1;
        for (int v : a) h = 31 * h + v;
        return h;
    }

    static int tagId(Object v) {
        Integer id = ids.get(v);
        if (id == null) {
            id = ids.size();
            ids.put(v, id);
        }
        return id;
    }

    static String tag(Object v) {
        return "#" + tagId(v) + ":";
    }

    static String value(Object v) throws Exception {
        if (v == null) return "null";
        if (v instanceof Boolean b) return b ? "1" : "0";
        if (!v.getClass().isArray()) return v.toString();
        String t = tag(v);
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

    // A returned or cached model: "null", or its class, identity tag and every instance field.
    static String model(Object m) throws Exception {
        if (m == null) return "null";
        StringBuilder sb = new StringBuilder();
        if (m instanceof cb) {
            sb.append("cb").append(tag(m));
            for (int i = 0; i < cbFields.length; i++) sb.append(' ').append(CB_FIELDS[i]).append('=').append(value(cbFields[i].get(m)));
        } else if (m instanceof fc) {
            sb.append("fc").append(tag(m));
            for (int i = 0; i < fcFields.length; i++) sb.append(' ').append(FC_FIELDS[i]).append('=').append(value(fcFields[i].get(m)));
            sb.append(" j=").append(value(ndJ.get(m)));
        } else {
            sb.append("other:").append(m.getClass().getName());
        }
        return sb.toString();
    }

    static String ref(Object v) {
        return v == null ? "null" : "#" + tagId(v);
    }

    static List<ei> nodes(ve c) throws Exception {
        ei sentinel = (ei) tbX.get(veB.get(c));
        List<ei> out = new ArrayList<>();
        for (ei n = sentinel.t; n != sentinel; n = n.t) out.add(n);
        return out;
    }

    static Object nodeValue(ei n) throws Exception {
        if (!(n instanceof ta)) throw new IllegalStateException("soft node " + n.getClass());
        return taQ.get(n);
    }

    // A cache: entries/remaining/capacity, the hash of its keys in LRU order and of its values' identity tags.
    static String cache(String name, ve c) throws Exception {
        List<ei> list = nodes(c);
        int kh = 1;
        int vh = 1;
        for (ei n : list) {
            long k = n.k;
            kh = 31 * kh + (int) (k ^ k >>> 32);
            Object v = nodeValue(n);
            vh = 31 * vh + (v == null ? -1 : tagId(v));
        }
        return " " + name + "=" + list.size() + "/" + veP.getInt(c) + "/" + veA.getInt(c) + ":" + kh + ":" + vh;
    }

    // The last count entries of a model cache, oldest first, each with its key and full dump.
    static String tail(String name, ve c, int count) throws Exception {
        List<ei> list = nodes(c);
        StringBuilder sb = new StringBuilder();
        for (int i = Math.max(0, list.size() - count); i < list.size(); i++) {
            ei n = list.get(i);
            sb.append(" | ").append(name).append('[').append(n.k).append("] ").append(model(nodeValue(n)));
        }
        return sb.toString();
    }

    static String ints(int[] a) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length; i++) sb.append(i == 0 ? "" : ",").append(a[i]);
        return sb.toString();
    }

    static String refs(Object[] a) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < a.length; i++) sb.append(i == 0 ? "" : ",").append(ref(a[i]));
        return sb.toString();
    }

    // Everything any op can touch, in a fixed order.
    static String state() throws Exception {
        StringBuilder o = new StringBuilder(" | state");
        o.append(cache("objs", fa.b)).append(cache("objModels", ra.M)).append(cache("objSprites", gb.r));
        o.append(cache("npcs", gf.Z)).append(cache("npcModels", uk.k)).append(cache("npcHeads", pb.xc));
        o.append(cache("locs", he.w)).append(cache("mc1", lj.c)).append(cache("mc2", vf.T)).append(cache("mc3", uj.f));
        o.append(cache("spots", r.V)).append(cache("spotModels", m.O));
        o.append(cache("seqs", ga.B)).append(cache("framesets", gl.x)).append(cache("bas", ig.n)).append(cache("varbits", cd.d));
        o.append(" temps=").append(ref(fcK.get(null))).append(',').append(ref(fcV.get(null))).append(',').append(ref(fcCb.get(null)));
        o.append(" gj=").append(ref(g.j)).append(':').append(ref(g.j == null ? null : g.j.e));
        o.append(" llj=").append(refs(ll.j));
        o.append(" sbb=").append(refs(sb.b)).append(" qhf=").append(refs(qh.f)).append(" pja=").append(refs(pj.A));
        o.append(" jlj=").append(ints(jl.j)).append(" geR=").append(ints(ge.R)).append(" pgP=").append(ints(pg.P)).append(" tby=").append(ints(tb.y));
        o.append(" tween=").append(qf.b ? 1 : 0);
        o.append(" pal=").append(value(al.q)).append(',').append(value(la.Z)).append(',').append(value(de.v));
        o.append(" var=").append(hash(vj.d));
        return o.toString();
    }

    static String code(Throwable t) {
        while (t instanceof InvocationTargetException ite) t = ite.getCause();
        while (t instanceof g wrapped && wrapped.a != null) t = wrapped.a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ArithmeticException) return "arith";
        if (t instanceof NegativeArraySizeException) return "nase";
        if (t instanceof ClassCastException) return "cce";
        return "error:" + t;
    }

    static void checkFields(Class<?> c, String[] expected) {
        HashSet<String> have = new HashSet<>();
        for (Field f : c.getDeclaredFields()) if (!Modifier.isStatic(f.getModifiers())) have.add(f.getName());
        if (!have.equals(new HashSet<>(Arrays.asList(expected)))) throw new IllegalStateException(c.getName() + " fields " + have);
    }

    // Heightmaps shared with provider-config.test.ts.
    static void makeMaps() {
        maps[0] = new int[104][104];
        maps[1] = new int[104][104];
        for (int x = 0; x < 104; x++) {
            for (int z = 0; z < 104; z++) {
                maps[0][x][z] = -((x * 37 + z * 91) % 400) - (x * z % 97) * 3;
                maps[1][x][z] = -((x * 53 + z * 17) % 700) - 200;
            }
        }
        maps[2] = new int[3][3];
        for (int x = 0; x < 3; x++) for (int z = 0; z < 3; z++) maps[2][x][z] = -x * 40 - z * 7;
        // Flat at -200 with a bump at every even x, odd z.
        maps[3] = new int[104][104];
        for (int x = 0; x < 104; x++) for (int z = 0; z < 104; z++) maps[3][x][z] = (x & 1) == 0 && (z & 1) == 1 ? -230 : -200;
        // Flat at -200.
        maps[4] = new int[104][104];
        for (int x = 0; x < 104; x++) Arrays.fill(maps[4][x], -200);
    }

    static int[][] map(int i) {
        return i < 0 ? null : maps[i];
    }

    static ek seq(int id) {
        return id < 0 ? null : tb.b(id, -32);
    }

    // A synthetic palette: entry i of a short[256] or the bytes of a type palette.
    static short palEntry(int seed, int i) {
        return (short) (i * seed * 2654435761L >>> 13);
    }

    static byte typePalEntry(int seed, int i) {
        return (byte) (i * 97 + seed * 31);
    }

    public static void main(String[] argv) throws Exception {
        checkFields(cb.class, CB_FIELDS);
        checkFields(fc.class, FC_FIELDS);
        checkFields(wj.class, new String[] {"e"});
        cbFields = new Field[CB_FIELDS.length];
        for (int i = 0; i < CB_FIELDS.length; i++) cbFields[i] = field(cb.class, CB_FIELDS[i]);
        fcFields = new Field[FC_FIELDS.length];
        for (int i = 0; i < FC_FIELDS.length; i++) fcFields[i] = field(fc.class, FC_FIELDS[i]);
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
        fcK = field(fc.class, "k");
        fcV = field(fc.class, "V");
        fcCb = field(fc.class, "cb");
        klK = field(kl.class, "K");
        jaAb = field(ja.class, "ab");
        jbC = field(jb.class, "C");
        makeMaps();

        String dir = argv[0];
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII), 1 << 20);
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");
        for (String line; (line = reader.readLine()) != null;) {
            ids = new IdentityHashMap<>();
            String[] t = line.split(" ");
            int[] n = new int[t.length];
            for (int i = 1; i < t.length; i++) n[i] = Integer.parseInt(t[i]);
            String result;
            try {
                result = "ok" + run(dir, t[0], n);
            } catch (IllegalStateException | IllegalArgumentException e) {
                throw e;
            } catch (Throwable e) {
                result = code(e);
            }
            out.println(result + state());
        }
        out.flush();
    }

    // The archives as the loader stages hand them to the providers' init methods.
    static void open(String dir) throws Exception {
        al models = new al(new Provider(dir, 7), false, true);
        wd.i = new al(new Provider(dir, 19), false, true);
        nf.c = models;
        bb.b = true;
        gd.U = new al(new Provider(dir, 16), false, true);
        ik.Y = models;
        ok.z = true;
        mf.k = new al(new Provider(dir, 18), false, true);
        nl.Y = models;
        ig.s = new al(new Provider(dir, 21), false, true);
        ec.j = models;
        ag.i = new al(new Provider(dir, 20), false, true);
        uk.d = new al(new Provider(dir, 1), false, true);
        ef.K = new al(new Provider(dir, 0), false, true);
        s.S = new al(new Provider(dir, 2), false, true);
        ma.g = new al(new Provider(dir, 22), false, true);
        dc.r = textures;
    }

    static String run(String dir, String op, int[] n) throws Exception {
        switch (op) {
            case "init":
                return "";
            case "open":
                open(dir);
                return "";
            case "tex":
                dc.r = n[1] != 0 ? textures : null;
                return "";
            case "tween":
                qf.b = n[1] != 0;
                return "";
            case "var":
                vj.d[n[1]] = n[2];
                return "";
            case "pal": {
                // pal <0 obj al.q | 1 npc la.Z | 2 loc de.v> <seed; 0 = zeros>
                short[] p = n[1] == 0 ? al.q : n[1] == 1 ? la.Z : de.v;
                for (int i = 0; i < 256; i++) p[i] = n[2] == 0 ? 0 : palEntry(n[2], i);
                return "";
            }
            case "tpal": {
                // tpal <0 obj | 1 npc | 2 loc> id length seed: the type's recolour palette (length -1 = null)
                byte[] p = null;
                if (n[3] >= 0) {
                    p = new byte[n[3]];
                    for (int i = 0; i < p.length; i++) p[i] = typePalEntry(n[4], i);
                }
                if (n[1] == 0) klK.set(rg.a(n[2], -28322), p);
                else if (n[1] == 1) jaAb.set(uk.a(n[2], -10), p);
                else jbC.set(ke.a(11525, n[2]), p);
                return "";
            }
            case "bas": {
                // bas key length [slot a b c d e f]*: a synthetic BAS with per-slot transforms put into ig.n
                mg b = new mg();
                b.B = new int[n[2]][];
                for (int i = 3; i + 6 < n.length; i += 7) b.B[n[i]] = new int[] {n[i + 1], n[i + 2], n[i + 3], n[i + 4], n[i + 5], n[i + 6]};
                ig.n.a((long) n[1], b, (byte) -71);
                return "";
            }
            case "nbas":
                uk.a(n[1], -10).q = n[2];
                return "";
            case "entity": {
                wj w = new wj();
                return " " + model(w.e) + " " + (w == g.j ? "shared" : "new");
            }
            case "ow": {
                // ow id female: the wear mesh (the caller's first argument is the constant false)
                kl t = rg.a(n[1], -28322);
                return " | " + model(t.a(false, n[2] != 0)) + tail("objModels", ra.M, 1);
            }
            case "oh": {
                // oh id female file
                kl t = rg.a(n[1], -28322);
                return " | " + model(t.a(n[2] != 0, n[3])) + tail("objModels", ra.M, 1);
            }
            case "oi": {
                // oi id dummy: the inventory model
                kl t = rg.a(n[1], -28322);
                return " | " + model(t.a((byte) n[2])) + tail("objModels", ra.M, 1);
            }
            case "ol": {
                // ol id seq frame count cycle next
                kl t = rg.a(n[1], -28322);
                return " | " + model(t.a(seq(n[2]), n[3], -93, n[4], n[5], n[6])) + tail("objModels", ra.M, 2);
            }
            case "n": {
                // n id seq frame next cycle seq2 frame2 next2 cycle2 dummy slotsLength [slot seq frame next cycle]*
                ja t = uk.a(n[1], -10);
                ci[] slots = null;
                if (n[11] >= 0) {
                    slots = new ci[n[11]];
                    for (int i = 12; i + 4 < n.length; i += 5) {
                        ci c = new ci();
                        c.e = n[i + 1];
                        c.n = n[i + 2];
                        c.a = n[i + 3];
                        c.d = n[i + 4];
                        slots[n[i]] = c;
                    }
                }
                nd r = t.a(slots, n[3], seq(n[2]), n[9], n[4], n[5], (byte) n[10], n[8], n[7], seq(n[6]));
                return " | " + model(r) + " | ib=" + value(fieldValue(t, "ib")) + tail("npcModels", uk.k, 2);
            }
            case "nh": {
                // nh id seq frame next cycle dummy
                ja t = uk.a(n[1], -10);
                return " | " + model(t.a(seq(n[2]), n[4], n[6], n[3], n[5])) + tail("npcHeads", pb.xc, 2);
            }
            case "l": {
                // l id shape angle share x y z map1 map7 dummy
                jb t = ke.a(11525, n[1]);
                wj w = t.a(map(n[8]), n[2], n[3], n[6], n[4] != 0, (byte) n[10], map(n[9]), null, n[7], n[5], false);
                return " " + entity(w) + tail("mc1", lj.c, 4) + tail("mc2", vf.T, 1);
            }
            case "lt": {
                // lt id shape angle seq frame next cycle x y z map7 map13 dummy
                jb t = ke.a(11525, n[1]);
                wj w = t.a(n[9], n[2], n[6], n[7], n[10], n[8], map(n[11]), n[3], false, n[5], (byte) n[13], null, map(n[12]), seq(n[4]));
                return " " + entity(w) + tail("mc1", lj.c, 4) + tail("mc3", uj.f, 1);
            }
            case "sp": {
                // sp id frame next cycle dummy
                li t = bf.b(-17177, n[1]);
                return " | " + model(t.a(n[3], (byte) n[5], n[4], n[2])) + tail("spotModels", m.O, 1);
            }
            default:
                throw new IllegalArgumentException("bad op " + op);
        }
    }

    static String entity(wj w) throws Exception {
        if (w == null) return "nullentity | -";
        return (w == g.j ? "shared" : "other") + " | " + model(w.e);
    }

    static Object fieldValue(Object o, String name) throws Exception {
        return field(o.getClass(), name).get(o);
    }
}
