import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;

// Differential oracle for the batch-5 model providers of unit seqplayer: ek's three animate methods (SeqType
// AnimateModel90 a(IILnd;IIZ)Lnd;, AnimateModelWithExtra a(IILnd;II)Lnd;, AnimateModel b(IILnd;II)Lnd;) and cl's three
// model builders (PlayerModel GetTempModel a(IILek;IZ[Lci;IIZLek;I)Lnd;, getKitHeadModel a(Lek;IIIIIBI)Lnd;,
// GetHeadModel a(IILek;II)Lnd;), driven through the real gamepack classes with the real config, model, frame and base
// archives. Compiled with javac next to client.jar (same unnamed package), so package-private members are used directly;
// private fields are read by reflection.
//
// argv[0] is the sector cache directory (CACHE_530). Every archive is a real al over a ud that serves the groups of the
// sector files; the models archive can withhold groups (op "hold"), which is how the loading paths (CheckModel false,
// the cachedModelKey fallback, null returns) are reached, and the frames archive every group divisible by a modulus (op
// "holdf": frame sets that fail to load). Ops "bas" and "seqdef" put synthetic BAS / seq types (over real frames) in the
// type caches for what no type of this cache has (part transforms, 65535 chat frames). stdin is the script, one operation per line; stdout has
// exactly one line per operation: the result (ok or the Java exception, unwrapped from the obfuscator's g), the returned
// model's identity tag and field dump, then the state after the call: the input model of an animate op, the player's
// fields, the identity/LRU state of ten caches, the per-slot scratch statics of cl and ja, the CopyForAnim scratch
// lengths and the animation origin. test/review/provider-seqplayer.test.ts runs the same script through the TS port.
class ProviderSeqPlayerOracle {
    static String dir;
    static final HashMap<Long, byte[]> groupCache = new HashMap<>();

    // The JS5 sector-file reader of test/cachefile.ts (readGroup).
    static byte[] readGroup(int archive, int group) throws Exception {
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

    // The JS5 container without the two-byte version trailer the sector files keep after it; null when the sector
    // files do not hold the group (the same rule as the TS provider).
    static byte[] fetch(int archive, int group) {
        long key = (long) archive << 32 | group;
        if (!groupCache.containsKey(key)) {
            byte[] bytes = null;
            try {
                byte[] raw = readGroup(archive, group);
                if (raw.length >= 5) {
                    int length = (raw[1] & 255) << 24 | (raw[2] & 255) << 16 | (raw[3] & 255) << 8 | raw[4] & 255;
                    int total = (raw[0] == 0 ? 5 : 9) + length;
                    if (length >= 0 && total <= raw.length) bytes = Arrays.copyOf(raw, total);
                }
            } catch (Exception e) {
                bytes = null;
            }
            groupCache.put(key, bytes);
        }
        byte[] bytes = groupCache.get(key);
        return bytes == null ? null : bytes.clone();
    }

    static class Provider extends ud {
        final int archive;
        final db index;
        final HashSet<Integer> withheld = new HashSet<>();
        // Every group divisible by mod is withheld too (0: none).
        int mod;

        Provider(int archive) throws Exception {
            this.archive = archive;
            byte[] ref = fetch(255, archive);
            index = new db(ref, q.a(0, ref, ref.length));
        }

        db b(int ignored) { return index; }
        byte[] a(int mode, int group) { return withheld.contains(group) || mod > 0 && group % mod == 0 ? null : fetch(archive, group); }
        void b(int ignored, int group) {}
        int c(int group, int ignored) { return 100; }
    }

    // Fake textures, identical to provider-seqplayer.test.ts: lighting reaches only pc.b(II)Z (isAvailable).
    static class Textures implements pc {
        public boolean a(int id, int dummy) { return id % 3 != 0; }
        public boolean b(int dummy, int id) { return id % 7 != 3; }
        public int[] c(int dummy, int id) { return null; }
        public boolean a(int id, byte dummy) { return true; }
        public int[] a(int id, float brightness, int dummy) { return null; }
        public int a(byte dummy, int id) { return id * 0x1F3D + 0x123 & 0xFFFF; }
        public boolean d(int dummy, int id) { return (id & 1) == 0; }
    }

    // fc instance fields (declaration order, minus the statics), then nd.j.
    static final String[] FIELDS = {
        "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "D", "E", "F", "G", "H",
        "I", "J", "K", "L", "M", "N", "Q", "R", "S", "U", "Y", "Z"
    };
    // The CopyForAnim scratch arrays (lengths only: their contents are the copied model's, dumped with it).
    static final String[] TEMPS = {"T", "P", "O", "X", "W", "db", "eb", "bb", "ab", "fb", "hb", "Lb", "Nb", "jb", "zb"};

    static Field[] fields, temps;
    static Field ndJ, fcOb, fcKb, fcXb, fcIb, fcK, fcV, fcCb;
    static Field clB, clI, clO, clT, clY, clZ;
    static Field veA, veB, veP, tbX, taQ;
    static Provider modelsProvider, framesProvider;
    static Field ekT;
    static al models;
    static final nd[] slots = new nd[64];
    static final cl[] players = new cl[64];
    static final IdentityHashMap<Object, Integer> tags = new IdentityHashMap<>();

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static int tag(Object o) {
        if (o == null) return 0;
        Integer t = tags.get(o);
        if (t == null) {
            t = tags.size() + 1;
            tags.put(o, t);
        }
        return t;
    }

    static int hash(int[] v) {
        int h = 1;
        for (int e : v) h = 31 * h + e;
        return h;
    }

    static int hash(short[] v) {
        int h = 1;
        for (short e : v) h = 31 * h + e;
        return h;
    }

    static String value(Object v) {
        if (v == null) return "null";
        if (v instanceof int[] a) return a.length + ":" + hash(a);
        if (v instanceof short[] a) return a.length + ":" + hash(a);
        if (v instanceof byte[] a) {
            int h = 1;
            for (byte e : a) h = 31 * h + e;
            return a.length + ":" + h;
        }
        if (v instanceof boolean[] a) {
            int h = 1;
            for (boolean e : a) h = 31 * h + (e ? 1 : 0);
            return a.length + ":" + h;
        }
        if (v instanceof long[] a) {
            int h = 1;
            for (long e : a) h = 31 * h + Long.hashCode(e);
            return a.length + ":" + h;
        }
        if (v instanceof int[][] a) {
            int h = 1;
            for (int[] row : a) h = 31 * h + (row == null ? 0 : 31 * row.length + hash(row));
            return a.length + ":" + h;
        }
        if (v instanceof short[][] a) {
            int h = 1;
            for (short[] row : a) h = 31 * h + (row == null ? 0 : 31 * row.length + hash(row));
            return a.length + ":" + h;
        }
        if (v instanceof Object[] a) {
            int h = 1;
            for (Object e : a) h = 31 * h + tag(e);
            return a.length + ":" + h;
        }
        if (v instanceof Boolean b) return b ? "1" : "0";
        if (v instanceof fc) return "fc";
        return v.toString();
    }

    static String dump(Object model) throws Exception {
        if (model == null) return "nullmodel";
        if (!(model instanceof fc)) return "class:" + model.getClass().getName();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < fields.length; i++) sb.append(FIELDS[i]).append('=').append(value(fields[i].get(model))).append(' ');
        return sb.append("j=").append(value(ndJ.get(model))).toString();
    }

    // The identity of a returned model: its tag, and which CopyForAnim scratch model it is (fc.k actor, fc.V spot,
    // fc.cb loc).
    static String ident(Object r) throws Exception {
        if (r == null) return "null";
        String which = r == fcK.get(null) ? "k" : r == fcV.get(null) ? "V" : r == fcCb.get(null) ? "cb" : "";
        return "#" + tag(r) + which;
    }

    static String origin() throws Exception {
        return " o=" + fcOb.getInt(null) + "," + fcKb.getInt(null) + "," + fcXb.getInt(null) + "," + (fcIb.getBoolean(null) ? 1 : 0);
    }

    static String tempLengths() throws Exception {
        StringBuilder sb = new StringBuilder(" temps");
        for (int i = 0; i < temps.length; i++) {
            Object t = temps[i].get(null);
            sb.append(' ').append(TEMPS[i]).append('=').append(t == null ? "null" : String.valueOf(java.lang.reflect.Array.getLength(t)));
        }
        return sb.toString();
    }

    // capacity:remaining:count:hash of a ve, walking its LRU queue from the eldest entry: every key, the identity tag of
    // its value (-1 for a soft node) and its age.
    static String cache(ve c) throws Exception {
        tb queue = (tb) veB.get(c);
        ei sentinel = (ei) tbX.get(queue);
        int count = 0;
        int h = 1;
        for (ei node = sentinel.t; node != sentinel; node = node.t) {
            h = 31 * h + Long.hashCode(node.k);
            h = 31 * h + (node instanceof ta ? tag(taQ.get(node)) : -1);
            h = 31 * h + Long.hashCode(node.v);
            count++;
        }
        return veA.getInt(c) + ":" + veP.getInt(c) + ":" + count + ":" + h;
    }

    // vk.S body models, gl.u chatheads, uk.k / pb.xc npc models, ga.B seqs, gl.x frame sets, hh.S kits, fa.b objs,
    // ig.n BAS types, gf.Z npc types.
    static String caches() throws Exception {
        return " S=" + cache(vk.S) + " U=" + cache(gl.u) + " Nk=" + cache(uk.k) + " Nh=" + cache(pb.xc) + " seq=" + cache(ga.B)
            + " anim=" + cache(gl.x) + " idk=" + cache(hh.S) + " obj=" + cache(fa.b) + " bas=" + cache(ig.n) + " npc=" + cache(gf.Z);
    }

    // cl's GetTempModel scratch (cf.j, wk.b, ec.x, kj.Y, ob.Hb, jk.r, qj.r) and ja's (sb.b, qh.f, jl.j, pj.A, ge.R, pg.P,
    // tb.y).
    static String scratch() {
        return " cf.j=" + value(cf.j) + " wk.b=" + value(wk.b) + " ec.x=" + value(ec.x) + " kj.Y=" + value(kj.Y) + " ob.Hb=" + value(ob.Hb)
            + " jk.r=" + value(jk.r) + " qj.r=" + value(qj.r) + " sb.b=" + value(sb.b) + " qh.f=" + value(qh.f) + " jl.j=" + value(jl.j)
            + " pj.A=" + value(pj.A) + " ge.R=" + value(ge.R) + " pg.P=" + value(pg.P) + " tb.y=" + value(tb.y);
    }

    static String player(cl p) throws Exception {
        if (p == null) return "nullplayer";
        return "o=" + clO.getLong(p) + " t=" + clT.getLong(p) + " i=" + clI.getInt(p) + " k=" + p.k + " m=" + (p.m ? 1 : 0)
            + " y=" + value(clY.get(p)) + " b=" + value(clB.get(p)) + " z=" + value(clZ.get(p));
    }

    // The statics before the setup below: the recolour tables, the key table, the slot tables, qf.b, every cache and
    // scratch array.
    static String initial() throws Exception {
        return " pk.c=" + value(pk.c) + " gk.b=" + value(gk.b) + " gk.o=" + value(gk.o) + " ik.Z=" + value(ik.Z) + " uh.Y=" + value(uh.Y)
            + " lh.e=" + value(lh.e) + " gj.U=" + value(gj.U) + " ie.J=" + value(ie.J) + " m.C=" + value(m.C) + " sa.u=" + value(sa.u)
            + " wg.b=" + value(wg.b) + " ij.j=" + value(ij.j) + " ja.g=" + value(ja.g) + " kf.p=" + value(kf.p) + " ph.k=" + value(ph.k)
            + " rb.g=" + value(rb.g) + " qf.b=" + (qf.b ? 1 : 0) + caches() + scratch() + tempLengths() + origin();
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

    static int[] ints(String s) {
        if (s.equals("null")) return null;
        if (s.equals("-")) return new int[0];
        String[] p = s.split(",");
        int[] r = new int[p.length];
        for (int i = 0; i < p.length; i++) r[i] = Integer.parseInt(p[i]);
        return r;
    }

    // "null", "-" (no entries) or comma-separated entries: "n" (a null slot) or seq:frame:next:cycle (ci.e, ci.n, ci.a,
    // ci.d).
    static ci[] slotAnims(String s) {
        if (s.equals("null")) return null;
        if (s.equals("-")) return new ci[0];
        String[] p = s.split(",");
        ci[] r = new ci[p.length];
        for (int i = 0; i < p.length; i++) {
            if (p[i].equals("n")) continue;
            String[] f = p[i].split(":");
            ci c = new ci();
            c.e = Integer.parseInt(f[0]);
            c.n = Integer.parseInt(f[1]);
            c.a = Integer.parseInt(f[2]);
            c.d = Integer.parseInt(f[3]);
            r[i] = c;
        }
        return r;
    }

    // "null" or ';'-separated rows: "n" (no transform) or x,y,z,pitch,yaw,roll (mg.B).
    static int[][] transforms(String s) {
        if (s.equals("null")) return null;
        String[] p = s.split(";");
        int[][] r = new int[p.length][];
        for (int i = 0; i < p.length; i++) if (!p[i].equals("n")) r[i] = ints(p[i]);
        return r;
    }

    static ek seq(int id) {
        return id < 0 ? null : tb.b(id, -32);
    }

    static nd model(int slot) {
        return slot < 0 ? null : slots[slot];
    }

    // The two palette sets the client selects from at startup (PlayerModel.recolour*).
    static void palette(int which) {
        if (which == 0) {
            m.C = pk.c;
            sa.u = ik.Z;
            wg.b = lh.e;
            ij.j = ie.J;
        } else {
            m.C = gk.b;
            sa.u = uh.Y;
            wg.b = gj.U;
            ij.j = gk.o;
        }
    }

    static String run(String line, String[] t, int[] n) throws Exception {
        switch (t[0]) {
            case "init": return initial();
            case "tw": qf.b = n[1] != 0; return "";
            case "pal": palette(n[1]); return "";
            case "hold":
                if (n[2] != 0) modelsProvider.withheld.add(n[1]);
                else modelsProvider.withheld.remove(n[1]);
                return "";
            case "cc": pf.f(-19933); return "";
            case "holdf": framesProvider.mod = n[1]; return "";
            case "seqdef": {
                // A synthetic seq over real frames, put in ga.B: frames, delays, chat frames (ek.t), mask, tween,
                // special and the held-item overrides. Reaches what no seq of the cache has (65535 chat frames,
                // colour/transparency frames at the chat tween target, frames of two sets with tweening).
                ek seq = new ek();
                seq.f = n[1];
                seq.g = ints(t[2]);
                seq.F = ints(t[3]);
                ekT.set(seq, ints(t[4]));
                int[] mask = ints(t[5]);
                if (mask != null) {
                    seq.A = new boolean[256];
                    for (int part : mask) seq.A[part] = true;
                }
                seq.C = n[6] != 0;
                seq.L = n[7] != 0;
                seq.I = n[8];
                seq.r = n[9];
                seq.b(107);
                ga.B.a((long) n[1], seq, (byte) -71);
                return "";
            }
            case "bas": {
                // No BAS type of this cache has transforms (opcode 27), so a synthetic one is put in ig.n.
                mg bas = new mg();
                bas.B = transforms(t[2]);
                ig.n.a((long) n[1], bas, (byte) -71);
                return "";
            }
            case "load": {
                slots[n[1]] = null;
                cb unlit = cb.a(models, n[2], 0);
                slots[n[1]] = unlit == null ? null : unlit.b(n[3], n[4], n[5], n[6], n[7]);
                return unlit == null ? " null" : "";
            }
            case "sa": {
                nd r = seq(n[2]).a(n[3], n[4], model(n[1]), n[5], n[6], false);
                return " " + ident(r) + " | " + dump(r);
            }
            case "sb": {
                nd r = seq(n[2]).a(n[3], n[4], model(n[1]), -20002, n[5]);
                return " " + ident(r) + " | " + dump(r);
            }
            case "sc": {
                nd r = seq(n[2]).b(91, n[3], model(n[1]), n[4], n[5]);
                return " " + ident(r) + " | " + dump(r);
            }
            case "new": {
                cl p = new cl();
                players[n[1]] = p;
                p.a(n[2] != 0, ints(t[5]), n[3], ints(t[6]), -9, n[4]);
                return "";
            }
            case "col": players[n[1]].b(1, n[2], n[3]); return "";
            case "kit": players[n[1]].a(8418, n[2], n[3]); return "";
            case "fem": players[n[1]].a(n[2] != 0, (byte) -10); return "";
            case "body": {
                nd r = players[n[1]].a(n[3], n[4], seq(n[5]), n[6], n[7] != 0, slotAnims(t[8]), n[9], n[10], n[11] != 0, seq(n[12]), n[13]);
                if (n[2] >= 0) slots[n[2]] = r;
                return " " + ident(r) + " | " + dump(r);
            }
            case "head": {
                nd r = players[n[1]].a(n[3], n[4], seq(n[5]), n[6], -123);
                if (n[2] >= 0) slots[n[2]] = r;
                return " " + ident(r) + " | " + dump(r);
            }
            case "khead": {
                nd r = players[n[1]].a(seq(n[3]), n[4], n[5], n[6], n[7], n[8], (byte) -119, n[9]);
                if (n[2] >= 0) slots[n[2]] = r;
                return " " + ident(r) + " | " + dump(r);
            }
            case "cdump": {
                StringBuilder sb = new StringBuilder();
                for (ve c : new ve[] {vk.S, gl.u, uk.k, pb.xc}) {
                    tb queue = (tb) veB.get(c);
                    ei sentinel = (ei) tbX.get(queue);
                    sb.append(" |");
                    for (ei node = sentinel.t; node != sentinel; node = node.t) {
                        Object v = node instanceof ta ? taQ.get(node) : null;
                        sb.append(' ').append(node.k).append('=').append(tag(v)).append(':').append(dump(v)).append(';');
                    }
                }
                return sb.toString();
            }
            default: throw new IllegalArgumentException(line);
        }
    }

    // The state printed after an operation, whether it returned or threw.
    static String post(String op, int[] n) throws Exception {
        switch (op) {
            case "sa": case "sb": case "sc":
                return " | in=" + dump(model(n[1])) + tempLengths() + origin() + caches();
            case "new": case "col": case "kit": case "fem":
                return " | " + player(players[n[1]]) + caches();
            case "body": case "head": case "khead":
                return " | " + player(players[n[1]]) + caches() + scratch() + tempLengths() + origin();
            default:
                return "";
        }
    }

    public static void main(String[] argv) throws Exception {
        dir = argv[0];
        fields = new Field[FIELDS.length];
        for (int i = 0; i < FIELDS.length; i++) fields[i] = field(fc.class, FIELDS[i]);
        temps = new Field[TEMPS.length];
        for (int i = 0; i < TEMPS.length; i++) temps[i] = field(fc.class, TEMPS[i]);
        ndJ = field(nd.class, "j");
        fcOb = field(fc.class, "ob");
        fcKb = field(fc.class, "Kb");
        fcXb = field(fc.class, "xb");
        fcIb = field(fc.class, "Ib");
        fcK = field(fc.class, "k");
        fcV = field(fc.class, "V");
        fcCb = field(fc.class, "cb");
        clB = field(cl.class, "b");
        clI = field(cl.class, "i");
        clO = field(cl.class, "o");
        clT = field(cl.class, "t");
        clY = field(cl.class, "y");
        clZ = field(cl.class, "z");
        veA = field(ve.class, "a");
        veB = field(ve.class, "b");
        veP = field(ve.class, "p");
        tbX = field(tb.class, "x");
        taQ = field(ta.class, "Q");
        ekT = field(ek.class, "t");

        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII));
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");
        boolean setup = false;
        for (String line; (line = reader.readLine()) != null;) {
            if (!setup && !line.equals("init")) {
                // The archives: frames 0, bases 1, config 2 (idk group 3, BAS group 32), models 7, npc 18, obj 19, seq 20.
                // Config archives keep their unpacked files; models, frames and bases discard both copies, so a withheld
                // model group is not ready again until it is served.
                framesProvider = new Provider(0);
                al frames = new al(framesProvider, true, true);
                al bases = new al(new Provider(1), true, true);
                al config = new al(new Provider(2), false, false);
                modelsProvider = new Provider(7);
                models = new al(modelsProvider, true, true);
                al npcs = new al(new Provider(18), false, false);
                al objs = new al(new Provider(19), false, false);
                al seqs = new al(new Provider(20), false, false);
                hf.a(seqs, bases, -124, frames);
                id.a(config, (byte) 100, models);
                bj.a(objs, -100, true, null, models);
                qj.a(-2, npcs, models);
                oa.a(49, config);
                dc.r = new Textures();
                setup = true;
            }
            String[] t = line.split(" ");
            int[] n = new int[t.length];
            for (int i = 1; i < t.length; i++) {
                try {
                    n[i] = Integer.parseInt(t[i]);
                } catch (NumberFormatException e) {
                    n[i] = 0;
                }
            }
            String result = "ok";
            String extra = "";
            try {
                extra = run(line, t, n);
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Throwable e) {
                result = code(e);
            }
            out.println(result + extra + post(t[0], n));
        }
        out.flush();
    }
}
