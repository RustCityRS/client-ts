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
import java.util.WeakHashMap;

// Differential oracle for the software texture cache of client.jar: kg (TextureCache, the only pc TextureProvider:
// the constructor over the textures/materials/sprites archives, every pc method, GetTexture b(BI)Lqi;, ClearCache
// a(I)V, RunAnims b(IB)V, the low-memory setter a(IZ)V and the vj LRU it keeps) and qi (Texture: the decode, the
// readiness check, the uncached 1.0 texels, Construct at a brightness with the 3x3 smoothing, the used flag and
// RunAnim through the shared scratch array nk.N). Compiled with javac next to client.jar (same unnamed runtime
// package), so package-private members are used directly; private fields go through reflection.
//
// argv[0] is the 530 cache directory (main_file_cache.dat2 / .idx*). Archives 9 (texture programs), 26 (texture
// metadata) and 8 (sprites) are real al instances over a ud that serves the group straight from the sector files, so
// the gamepack's own JS5 code, jd programs, procedural operators and sprite decoders run. Synthetic archives (script
// op "syn") serve given group files through the same al. Any served group can be withheld ("hold"), which makes the
// provider answer null as a not-yet-downloaded group does. The statics start from their <clinit> values (a fresh
// JVM); the first script line ("init") prints them.
//
// stdin is the script (one operation per line); stdout has exactly one line per operation: the result (ok or the Java
// exception, unwrapping the obfuscator's g wrapper), then " | " and the state every op can touch: the LRU (vj.k) in
// queue (eviction) order with each node's key, identity, used flag, brightness bits and texel identity, the same table
// in hash order, and the texture statics (kg.x gamma table, wf.L, the bf size statics, gj.P, jf.o and nk.N). Arrays,
// textures and caches carry identity tags (#n, numbered in first-print order over the whole run, so a cache hit
// returning the same array, a rebuild, an eviction and RunAnim's swap with nk.N are compared as identities). "dump"
// and "anim" also print every cached texture's texels in full (length and two hashes), and "dump" the remaining
// procedural statics. test/review/texture-cache.test.ts runs the same script through the TS port.
class TextureCacheOracle {
    // kg's and qi's instance fields (the TS port maps each one; see texture-cache.test.ts).
    static final String[] KG_FIELDS = {"a", "c", "d", "g", "h", "i", "k", "m", "n", "p", "q", "t", "C", "E", "G", "J"};
    static final String[] QI_FIELDS = {"D", "I", "K", "N", "O", "P", "Q", "T"};

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

    // An uncompressed JS5 container around data.
    static byte[] store(byte[] data) {
        byte[] out = new byte[5 + data.length];
        out[1] = (byte) (data.length >>> 24);
        out[2] = (byte) (data.length >>> 16);
        out[3] = (byte) (data.length >>> 8);
        out[4] = (byte) data.length;
        System.arraycopy(data, 0, out, 5, data.length);
        return out;
    }

    // A protocol-5 index without names: the given groups (ascending), each holding file 0 only.
    static byte[] indexOf(int[] groups) {
        int n = groups.length;
        byte[] out = new byte[4 + n * 2 + n * 4 + n * 4 + n * 2 + n * 2];
        int pos = 0;
        out[pos++] = 5;
        out[pos++] = 0;
        out[pos++] = (byte) (n >> 8);
        out[pos++] = (byte) n;
        int last = 0;
        for (int g : groups) {
            int delta = g - last;
            last = g;
            out[pos++] = (byte) (delta >> 8);
            out[pos++] = (byte) delta;
        }
        pos += n * 4; // crcs (unchecked by al)
        pos += n * 4; // versions
        for (int i = 0; i < n; i++) {
            out[pos++] = 0;
            out[pos++] = 1;
        }
        pos += n * 2; // file id deltas: 0
        return out;
    }

    // One archive's provider: the sector files (real) or script-given files (synthetic); held groups answer null.
    static class Provider extends ud {
        final String dir;
        final int archive;
        final db index;
        final HashMap<Integer, byte[]> files;
        final HashSet<Integer> held = new HashSet<>();

        Provider(String dir, int archive) throws Exception {
            this.dir = dir;
            this.archive = archive;
            this.files = null;
            byte[] ref = container(readGroup(dir, 255, archive));
            index = new db(ref, q.a(0, ref, ref.length));
        }

        Provider(int[] groups, HashMap<Integer, byte[]> files) {
            this.dir = null;
            this.archive = -1;
            this.files = files;
            byte[] ref = store(indexOf(groups));
            index = new db(ref, q.a(0, ref, ref.length));
        }

        db b(int ignored) { return index; }

        byte[] a(int mode, int group) {
            if (held.contains(group)) return null;
            if (files != null) {
                byte[] f = files.get(group);
                return f == null ? null : store(f);
            }
            try {
                return container(readGroup(dir, archive, group));
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        void b(int ignored, int group) {}

        int c(int group, int ignored) { return 100; }
    }

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

    static Field kgA, kgC, kgD, kgG_, kgH, kgI, kgK, kgM, kgN, kgP, kgQ, kgT, kgCC, kgE, kgG, kgJ;
    static Field qiD, qiI, qiK, qiN, qiO, qiQ, qiT;
    static Field vjE, vjL, vjM, vjN, tbX;

    // Identity tags, numbered in first-print order over the whole run. Arrays and these classes keep Object's identity
    // equals/hashCode, so a WeakHashMap is an identity map that lets unreachable texels go.
    static final WeakHashMap<Object, Integer> tags = new WeakHashMap<>();
    static int nextTag;

    static int tagId(Object v) {
        Integer id = tags.get(v);
        if (id == null) {
            id = nextTag++;
            tags.put(v, id);
        }
        return id;
    }

    static int hash(int[] a) {
        int h = 1;
        for (int v : a) h = 31 * h + v;
        return h;
    }

    static int fnv(int[] a) {
        int h = 0x811c9dc5;
        for (int v : a) h = (h ^ v) * 0x01000193;
        return h;
    }

    // "#tag:length:hash:fnv", or "null".
    static String arr(int[] a) {
        if (a == null) return "null";
        return "#" + tagId(a) + ":" + a.length + ":" + hash(a) + ":" + fnv(a);
    }

    // "#tag:length", or "null" (identity only).
    static String ref(Object a) {
        if (a == null) return "null";
        if (a instanceof int[]) return "#" + tagId(a) + ":" + ((int[]) a).length;
        return "#" + tagId(a);
    }

    static String bools(boolean[] a) {
        StringBuilder s = new StringBuilder();
        for (boolean b : a) s.append(b ? '1' : '0');
        return s.toString();
    }

    static String bytes(byte[] a) {
        int[] w = new int[a.length];
        for (int i = 0; i < a.length; i++) w[i] = a[i];
        return a.length + ":" + hash(w);
    }

    static String shorts(short[] a) {
        int[] w = new int[a.length];
        for (int i = 0; i < a.length; i++) w[i] = a[i];
        return a.length + ":" + hash(w);
    }

    static String code(Throwable t) {
        while (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ArithmeticException) return "arith";
        if (t instanceof NegativeArraySizeException) return "nase";
        if (t instanceof ClassCastException) return "cce";
        return "error:" + t;
    }

    static String dir;
    static final al[] real = new al[3];
    static final Provider[] realProviders = new Provider[3];
    static final HashMap<Integer, al> synthetic = new HashMap<>();
    static final HashMap<Integer, Provider> syntheticProviders = new HashMap<>();
    static final ArrayList<kg> caches = new ArrayList<>();
    static kg cache;

    static void reopen() throws Exception {
        int[] ids = {9, 26, 8};
        for (int i = 0; i < 3; i++) {
            realProviders[i] = new Provider(dir, ids[i]);
            real[i] = new al(realProviders[i], false, true);
        }
    }

    // Archive codes: 9/26/8 the real archives, 100+k synthetic archive k, -1 null.
    static al archive(int code) {
        if (code == 9) return real[0];
        if (code == 26) return real[1];
        if (code == 8) return real[2];
        if (code >= 100) return synthetic.get(code - 100);
        if (code == -1) return null;
        throw new IllegalArgumentException("archive " + code);
    }

    static Provider provider(int code) {
        if (code == 9) return realProviders[0];
        if (code == 26) return realProviders[1];
        if (code == 8) return realProviders[2];
        return syntheticProviders.get(code - 100);
    }

    static String archiveName(Object a) {
        if (a == null) return "null";
        for (int i = 0; i < 3; i++) if (a == real[i]) return new String[] {"T", "M", "S"}[i];
        for (java.util.Map.Entry<Integer, al> e : synthetic.entrySet()) if (a == e.getValue()) return "syn" + e.getKey();
        return "other";
    }

    static String providerName(Object p) {
        if (p == null) return "null";
        for (int i = 0; i < caches.size(); i++) if (p == caches.get(i)) return "kg" + i;
        return "other";
    }

    static String meta(kg k) throws Exception {
        StringBuilder s = new StringBuilder();
        s.append(" h=").append(bools((boolean[]) kgH.get(k)));
        s.append(" p=").append(bools((boolean[]) kgP.get(k)));
        s.append(" a=").append(bools((boolean[]) kgA.get(k)));
        s.append(" E=").append(bools((boolean[]) kgE.get(k)));
        s.append(" i=").append(bools((boolean[]) kgI.get(k)));
        s.append(" d=").append(bytes((byte[]) kgD.get(k)));
        s.append(" m=").append(bytes((byte[]) kgM.get(k)));
        s.append(" g=").append(bytes((byte[]) kgG_.get(k)));
        s.append(" c=").append(bytes((byte[]) kgC.get(k)));
        s.append(" t=").append(shorts((short[]) kgT.get(k)));
        s.append(" G=").append(kgG.getBoolean(k) ? 1 : 0).append(" q=").append(kgQ.getInt(k));
        s.append(" J=").append(ref(kgJ.get(k))).append(" n=").append(archiveName(kgN.get(k))).append(" C=").append(archiveName(kgCC.get(k)));
        vj t = (vj) kgK.get(k);
        s.append(" k=").append(vjN.getInt(t)).append('/').append(vjM.getInt(t));
        return s.toString();
    }

    static long key(jf n) {
        return n.k;
    }

    // One texture: key, identity, used flag, brightness bits, smooth/transpose, scroll x,y, texels (full or identity).
    static String texture(ei node, boolean full) throws Exception {
        if (!(node instanceof qi)) return key(node) + ":" + ref(node) + ":foreign";
        qi t = (qi) node;
        int[] o = (int[]) qiO.get(t);
        return key(t) + ":" + ref(t) + ":" + (t.P ? 1 : 0) + ":" + Float.floatToIntBits(qiN.getFloat(t)) + ":"
            + (qiQ.getBoolean(t) ? 1 : 0) + (qiI.getBoolean(t) ? 1 : 0) + ":" + qiT.getInt(t) + "," + qiK.getInt(t) + ":"
            + (full ? arr(o) : ref(o));
    }

    static ArrayList<ei> queue(vj table) throws Exception {
        ei sentinel = (ei) tbX.get(vjL.get(table));
        ArrayList<ei> out = new ArrayList<>();
        for (ei n = sentinel.t; n != sentinel; n = n.t) out.add(n);
        return out;
    }

    static String lru(boolean full) throws Exception {
        if (cache == null) return "nocache";
        vj table = (vj) kgK.get(cache);
        StringBuilder s = new StringBuilder();
        ArrayList<ei> q = queue(table);
        s.append("lru=").append(q.size()).append('/').append(vjN.getInt(table)).append('/').append(vjM.getInt(table));
        if (full) {
            s.append(" [");
            for (ei n : q) s.append(texture(n, true)).append(';');
            s.append(']');
        } else {
            int h = 1;
            for (ei n : q) h = 31 * h + texture(n, false).hashCode();
            s.append(':').append(h);
        }
        // Hash-table order (vj.a(I)Ljf; then vj.a(B)Ljf;, the walk RunAnims makes).
        StringBuilder order = new StringBuilder();
        int count = 0;
        for (jf n = table.a(3); n != null; n = table.a((byte) 88)) {
            count++;
            order.append(key(n)).append(ref(n)).append(',');
        }
        s.append(" ht=").append(count).append(':').append(full ? order.toString() : Integer.toString(order.toString().hashCode()));
        vj second = (vj) kgJ.get(cache);
        s.append(" J=").append(ref(second));
        if (second != null) s.append(':').append(queue(second).size()).append('/').append(vjN.getInt(second)).append('/').append(vjM.getInt(second));
        return s.toString();
    }

    // The statics the texture cache and its procedural programs write on every call.
    static String statics() {
        StringBuilder s = new StringBuilder();
        s.append("x=").append(kg.x == null ? "null" : ref(kg.x) + ":" + hash(kg.x));
        s.append(" L=").append(Double.doubleToLongBits(wf.L));
        s.append(" size=").append(hf.I).append(',').append(g.k).append(',').append(kl.Eb).append(',').append(vi.hb).append(',').append(j.b);
        s.append(" nx=").append(arr(vg.U)).append(" ny=").append(arr(cf.h));
        s.append(" P=").append(providerName(gj.P)).append(" o=").append(archiveName(jf.o));
        s.append(" N=").append(ref(nk.N));
        return s.toString();
    }

    // Every other static the procedural operators keep (dump and init only).
    static String moreStatics() throws Exception {
        StringBuilder s = new StringBuilder();
        s.append(" sin=").append(arr(h.e)).append(" cos=").append(arr(c.t));
        vj perm = vb.e;
        s.append(" perm=").append(perm == null ? "null" : ref(perm) + ":" + queue(perm).size() + "/" + vjN.getInt(perm) + "/" + vjM.getInt(perm));
        s.append(" kal=").append(kk.cb).append(',').append(ik.ab);
        s.append(" vor=").append(b.O).append(',').append(bh.i).append(',').append(u.k).append(',').append(jk.G);
        s.append(" raster=");
        if (we.z == null) s.append("null");
        else {
            int hh = 1;
            for (int[] row : we.z) hh = 31 * hh + (row == null ? 0 : 31 * row.length + hash(row));
            s.append(ref(we.z)).append(':').append(we.z.length).append(':').append(hh);
        }
        s.append(" clip=").append(wa.j).append(',').append(gg.I).append(',').append(ia.m).append(',').append(sf.d);
        s.append(" circle=").append(arr(vg.Y)).append(" group=").append(hg.a);
        s.append(" N=").append(arr(nk.N));
        return s.toString();
    }

    static String state() throws Exception {
        return " | " + lru(false) + " | " + statics();
    }

    static byte[] hex(String s) {
        byte[] out = new byte[s.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return out;
    }

    static String run(String[] t, int[] n) throws Exception {
        switch (t[0]) {
            case "init": {
                // The <clinit> values both sides start from, and the read-only tables the operators use.
                int[] emboss = new int[je.Q.length];
                for (int i = 0; i < emboss.length; i++) emboss[i] = je.Q[i];
                return " " + statics() + moreStatics() + " emboss=" + emboss.length + ":" + hash(emboss) + " fade=" + arr(kj.W)
                    + " sentinels=" + (lh.c != null ? 1 : 0) + (ri.R != null ? 1 : 0);
            }
            case "reopen":
                reopen();
                return "";
            case "syn": {
                // syn <k> <group>:<hex or -> ...: archive k with file 0 of each group ("-": indexed, never served).
                HashMap<Integer, byte[]> files = new HashMap<>();
                int[] groups = new int[t.length - 2];
                for (int i = 2; i < t.length; i++) {
                    String[] parts = t[i].split(":", -1);
                    groups[i - 2] = Integer.parseInt(parts[0]);
                    if (!parts[1].equals("-")) files.put(groups[i - 2], hex(parts[1]));
                }
                Provider p = new Provider(groups, files);
                syntheticProviders.put(n[1], p);
                synthetic.put(n[1], new al(p, false, true));
                return "";
            }
            case "flags": {
                // A fresh al over the same provider with the given discard flags.
                al a = new al(provider(n[1]), n[2] != 0, n[3] != 0);
                if (n[1] == 9) real[0] = a;
                else if (n[1] == 26) real[1] = a;
                else if (n[1] == 8) real[2] = a;
                else synthetic.put(n[1] - 100, a);
                return "";
            }
            case "hold": {
                Provider p = provider(n[1]);
                if (n[3] != 0) p.held.add(n[2]);
                else p.held.remove(n[2]);
                return "";
            }
            case "new": {
                cache = null;
                kg k = new kg(archive(n[1]), archive(n[2]), archive(n[3]), n[4], n[5] != 0);
                caches.add(k);
                cache = k;
                return " kg" + (caches.size() - 1) + meta(k);
            }
            case "colour":
                return " " + cache.a((byte) -120, n[1]);
            case "colour2":
                // The other pc.a(BI)I call-site constants: -124 (lj), -118 (ug, al), -125 (sb), -121 (dc.b).
                return " " + cache.a((byte) n[2], n[1]);
            case "small":
                return " " + (cache.a(n[1], 0) ? 1 : 0);
            case "avail":
                return " " + (cache.b(0, n[1]) ? 1 : 0);
            case "solid":
                return " " + (cache.d(0, n[1]) ? 1 : 0);
            case "loaded":
                return " " + (cache.a(n[1], (byte) -95) ? 1 : 0);
            case "pix":
                return " " + arr(cache.c(117, n[1]));
            case "data":
                return " " + arr(cache.a(n[1], Float.intBitsToFloat(n[2]), 15964));
            case "anim": {
                cache.b(n[1], (byte) -33);
                StringBuilder s = new StringBuilder(" ");
                for (ei node : queue((vj) kgK.get(cache))) s.append(texture(node, true)).append(';');
                return s.append(" N=").append(arr(nk.N)).toString();
            }
            case "low":
                cache.a(-85, n[1] != 0);
                return "";
            case "clear":
                cache.a(0);
                return "";
            case "foreign":
                // A non-qi node in the LRU: GetTexture's and RunAnims' checkcasts.
                ((vj) kgK.get(cache)).a((long) n[1], 0, new ei());
                return "";
            case "second": {
                // kg.J is never set in the SD client; give it a vj holding n[2] plain nodes, so ClearCache's reset of it runs.
                vj second = new vj(n[1]);
                for (int i = 0; i < n[2]; i++) second.a((long) i, 0, new ei());
                kgJ.set(cache, second);
                return "";
            }
            case "inject": {
                // A texture decoded from group n[1] of the cache's own textures archive, put under key n[2].
                al textures = (al) kgN.get(cache);
                qi texture = new qi(new gd(textures.a(-809612665, 0, n[1])));
                ((vj) kgK.get(cache)).a((long) n[2], 0, texture);
                return " " + ref(texture);
            }
            case "dump":
                return " " + lru(true) + " |" + moreStatics();
            default:
                throw new IllegalArgumentException("bad op " + t[0]);
        }
    }

    public static void main(String[] argv) throws Exception {
        checkFields(kg.class, KG_FIELDS);
        checkFields(qi.class, QI_FIELDS);
        kgA = field(kg.class, "a");
        kgC = field(kg.class, "c");
        kgD = field(kg.class, "d");
        kgG_ = field(kg.class, "g");
        kgH = field(kg.class, "h");
        kgI = field(kg.class, "i");
        kgK = field(kg.class, "k");
        kgM = field(kg.class, "m");
        kgN = field(kg.class, "n");
        kgP = field(kg.class, "p");
        kgQ = field(kg.class, "q");
        kgT = field(kg.class, "t");
        kgCC = field(kg.class, "C");
        kgE = field(kg.class, "E");
        kgG = field(kg.class, "G");
        kgJ = field(kg.class, "J");
        qiD = field(qi.class, "D");
        qiI = field(qi.class, "I");
        qiK = field(qi.class, "K");
        qiN = field(qi.class, "N");
        qiO = field(qi.class, "O");
        qiQ = field(qi.class, "Q");
        qiT = field(qi.class, "T");
        vjE = field(vj.class, "e");
        vjL = field(vj.class, "l");
        vjM = field(vj.class, "m");
        vjN = field(vj.class, "n");
        tbX = field(tb.class, "x");

        dir = argv[0];
        reopen();
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII), 1 << 20);
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");
        for (String line; (line = reader.readLine()) != null;) {
            String[] t = line.split(" ");
            int[] n = new int[t.length];
            if (!t[0].equals("syn")) for (int i = 1; i < t.length; i++) n[i] = Integer.parseInt(t[i]);
            else n[1] = Integer.parseInt(t[1]);
            String result;
            try {
                result = "ok" + run(t, n);
            } catch (IllegalStateException | IllegalArgumentException e) {
                throw e;
            } catch (Throwable e) {
                result = code(e);
            }
            out.println(result + state());
        }
        out.flush();
    }
}
