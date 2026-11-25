import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

// Differential oracle for the scene entities of client.jar: ac (MapSpotAnim), hl (ClientProj), ig (ClientObj), pb
// (ClientPlayer) and bk (ClientNpc), i.e. their ug overrides a(IIIII)V (update), b()I (getMinY) and
// a(IIIIIIIIJILue;)V (draw), the private model getters ac.b(B)Lnd; and hl.a(I)Lnd; and pb's private hint-arrow draw
// a(IIIBIIIILue;IIIIILnd;)V. Compiled with javac next to client.jar (same unnamed runtime package), so package-private
// members are used directly; private members go through reflection.
//
// argv[0] is the 530 cache directory. Every archive the entity draws read (0 frames, 1 bases, 2 config, 7 models,
// 18 npc, 19 obj, 20 seq, 21 spot, 22 varbit) is a real al over a ud that serves the sector files, and the config
// loaders are initialised with the client's own calls (client.java's id.a/qj.a/bj.a/hf.a/oa.a/nf.a/mi.a block, with
// the same dummy constants), so the real gamepack classes decode and build every model.
//
// stdin is the script (one operation per line); stdout has exactly one line per operation: the result (ok or the Java
// exception, unwrapping the obfuscator's g wrapper), any return value, then " | " and a dump of the entity the
// operation touched (every instance field of the entity's class chain, ob first, sorted by name; ci slots and the
// cl appearance expanded). test/review/provider-entities.test.ts runs the same script through the TS port.
class ProviderEntitiesOracle {
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

    // Fake textures, identical to provider-entities.test.ts (and model-lit's): ids divisible by 3 are 128x128.
    static final HashMap<Integer, int[]> texels = new HashMap<>();

    static int[] texels(int id) {
        return texels.computeIfAbsent(id, t -> {
            int[] p = new int[t % 3 == 0 ? 16384 : 4096];
            for (int i = 0; i < p.length; i++) {
                int v = (i + 1) * 0x9E3779B1 ^ t * 0x85EBCA6B;
                v ^= v >>> 13;
                v *= 0x5BD1E995;
                v ^= v >>> 15;
                p[i] = i % 11 == 0 ? 0 : v & 0xFFFFFF;
            }
            return p;
        });
    }

    static class Textures implements pc {
        public boolean a(int id, int dummy) { return id % 3 != 0; }
        public boolean b(int dummy, int id) { return id % 7 != 3; }
        public int[] c(int dummy, int id) { return texels(id); }
        public boolean a(int id, byte dummy) { return true; }
        public int[] a(int id, float brightness, int dummy) { return id % 5 == 4 ? null : texels(id); }
        public int a(byte dummy, int id) { return id * 0x1F3D + 0x123 & 0xFFFF; }
        public boolean d(int dummy, int id) { return (id & 1) == 0; }
    }

    // fc's instance fields (as model-lit), then nd.j.
    static final String[] FC_FIELDS = {
        "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "D", "E", "F", "G", "H",
        "I", "J", "K", "L", "M", "N", "Q", "R", "S", "U", "Y", "Z"
    };

    static final int W = 320, H = 240;
    static int[] px, bg;
    static final ug[] E = new ug[32];
    static final int[][][][] terrains = new int[3][][][];
    static final byte[][][][] maplFlags = new byte[2][][][];
    static final HashMap<Integer, nd> lit = new HashMap<>();
    static Field[] fcFields;
    static Field ndJ;
    static Method acModel, hlModel, pbArrow;

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Field find(Object o, String name) throws Exception {
        for (Class<?> c = o.getClass(); c != null; c = c.getSuperclass()) {
            try {
                Field f = c.getDeclaredField(name);
                if (Modifier.isStatic(f.getModifiers())) continue;
                f.setAccessible(true);
                return f;
            } catch (NoSuchFieldException e) {
                // keep looking in the superclass
            }
        }
        throw new IllegalArgumentException("no field " + name);
    }

    static int hash(int[] v) {
        int h = 1;
        for (int e : v) h = 31 * h + e;
        return h;
    }

    static String value(Object v) throws Exception {
        if (v == null) return "null";
        if (v instanceof int[] a) return a.length + ":" + hash(a);
        if (v instanceof short[] a) {
            int h = 1;
            for (short e : a) h = 31 * h + e;
            return a.length + ":" + h;
        }
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
        if (v instanceof int[][] a) {
            int h = 1;
            for (int[] row : a) h = 31 * h + (row == null ? 0 : 31 * row.length + hash(row));
            return a.length + ":" + h;
        }
        if (v instanceof ci[] a) {
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) {
                if (i > 0) sb.append(';');
                ci s = a[i];
                if (s == null) sb.append('-');
                else sb.append(s.e).append(',').append(s.n).append(',').append(s.a).append(',').append(s.d).append(',').append(s.f).append(',').append(s.j);
            }
            return sb.append(']').toString();
        }
        if (v instanceof cl) return "cl{" + fields(v, new Class<?>[] {cl.class}) + "}";
        if (v instanceof Boolean b) return b ? "1" : "0";
        if (v instanceof Double d) return "d" + Long.toHexString(Double.doubleToLongBits(d));
        if (v instanceof Integer || v instanceof Long || v instanceof Short || v instanceof Byte) return v.toString();
        return "obj";
    }

    // The instance fields of each class in the chain, each class sorted by field name.
    static String fields(Object o, Class<?>[] chain) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (Class<?> c : chain) {
            Field[] fs = c.getDeclaredFields();
            Arrays.sort(fs, (a, b) -> a.getName().compareTo(b.getName()));
            for (Field f : fs) {
                if (Modifier.isStatic(f.getModifiers())) continue;
                f.setAccessible(true);
                if (sb.length() > 0) sb.append(' ');
                sb.append(c.getName()).append('.').append(f.getName()).append('=').append(value(f.get(o)));
            }
        }
        return sb.toString();
    }

    static String dump(ug e) throws Exception {
        if (e == null) return "empty";
        if (e instanceof pb) return "pb " + fields(e, new Class<?>[] {ob.class, pb.class});
        if (e instanceof bk) return "bk " + fields(e, new Class<?>[] {ob.class, bk.class});
        return e.getClass().getName() + " " + fields(e, new Class<?>[] {e.getClass()});
    }

    static String model(nd m) throws Exception {
        if (m == null) return "nullmodel";
        if (!(m instanceof fc)) return "other";
        StringBuilder sb = new StringBuilder("fc");
        for (int i = 0; i < FC_FIELDS.length; i++) sb.append(' ').append(FC_FIELDS[i]).append('=').append(value(fcFields[i].get(m)));
        return sb.append(" j=").append(ndJ.getBoolean(m) ? 1 : 0).toString();
    }

    static String code(Throwable t) {
        while (t instanceof InvocationTargetException w && w.getCause() != null) t = w.getCause();
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
        String[] p = s.split(",");
        int[] r = new int[p.length];
        for (int i = 0; i < p.length; i++) r[i] = Integer.parseInt(p[i]);
        return r;
    }

    // A lit model for attachments and hint-arrow bases: cb.a(Lal;II)Lcb; then cb.b(IIIII)Lnd;, cached by id.
    static nd lit(int id) {
        if (id < 0) return null;
        return lit.computeIfAbsent(id, k -> cb.a(rk.k, k, 0).b(64, 768, -50, -10, -50));
    }

    static void fill(int seed) {
        for (int i = 0; i < px.length; i++) px[i] = i * 0x2545F491 ^ seed * 0x27D4EB2F;
        bg = px.clone();
    }

    static String drawState(ug e) throws Exception {
        int changed = 0;
        for (int i = 0; i < px.length; i++) if (px[i] != bg[i]) changed++;
        StringBuilder sb = new StringBuilder();
        sb.append(" fb=").append(hash(px)).append(" px=").append(changed);
        sb.append(" picked=").append(dd.r);
        long[] w = pf.W;
        if (w == null) sb.append(":null");
        else {
            int h = 1;
            for (int i = 0; i < dd.r && i < w.length; i++) h = 31 * h + Long.hashCode(w[i]);
            sb.append(':').append(h);
        }
        sb.append(" trans=").append(dc.e);
        sb.append(" tilt=").append(tj.b).append(',').append(ug.a).append(',').append(ph.l);
        int ballast = -1;
        if (oh.g != null) {
            ballast = 0;
            for (byte[] b : oh.g) if (b != null) ballast++;
        }
        sb.append(" pad=").append(vg.Q).append(',').append(ballast);
        sb.append(" sh=").append(ml.w.b((byte) -14)).append(" pm=").append(uf.a(false)).append(" ha=").append(te.a.b((byte) -14));
        sb.append(" miny=").append(e.b());
        return sb.toString();
    }

    static String init() {
        StringBuilder sb = new StringBuilder();
        sb.append("Q=").append(m.Q ? 1 : 0).append(" jl.c=").append(jl.c).append(" ah.f=").append(ah.f).append(" hh.kb=").append(hh.kb);
        sb.append(" oi.e=").append(oi.e).append(" vg.Q=").append(vg.Q).append(" oh.g=").append(oh.g == null ? "null" : String.valueOf(oh.g.length));
        sb.append(" hk.e=").append(hk.e).append(" vj.t=").append(vj.t).append(" te.g=").append(te.g == null ? "null" : "obj");
        sb.append(" ve.t=").append(ve.t.length).append(" uc.l=").append(uc.l.length).append(" tf.J=").append(tf.J.length);
        sb.append(" vj.d=").append(vj.d.length).append(" tilt=").append(tj.b).append(',').append(ug.a).append(',').append(ph.l);
        sb.append(" ve.q=").append(ve.q == null ? "null" : "obj").append(" tb.t=").append(tb.t == null ? "null" : String.valueOf(tb.t.length));
        sb.append(" dc.a=").append(dc.a ? 1 : 0).append(" rf.x=").append(rf.x).append(" lf.g=").append(lf.g == null ? "null" : "obj");
        return sb.toString();
    }

    static String run(String[] t, int[] n) throws Exception {
        switch (t[0]) {
            case "init": return init();
            case "cls": fill(n[1]); return "";
            case "pick":
                oc.m = n[1] != 0;
                rg.g = n[2];
                ud.d = n[3];
                dd.r = n[4];
                return "";
            case "shadows": m.Q = n[1] != 0; return "";
            case "level": ah.f = n[1]; return "";
            case "terrain": ve.q = lf.g = n[1] < 0 ? null : terrains[n[1]]; return "";
            case "ground": lf.g = n[1] < 0 ? null : terrains[n[1]]; return "";
            case "mapl": tb.t = n[1] < 0 ? null : maplFlags[n[1]]; return "";
            case "loop": hh.kb = n[1]; return "";
            case "modewhat": oi.e = n[1]; return "";
            case "ballast":
                oh.g = n[1] < 0 ? null : new byte[n[1]][];
                vg.Q = n[2];
                return "";
            case "base": hk.e = n[1]; vj.t = n[2]; return "";
            case "varp": vj.d[n[1]] = n[2]; return "";
            case "tween": qf.b = n[1] != 0; return "";
            case "recol":
                if (n[1] == 0) {
                    ij.j = ie.J;
                    sa.u = ik.Z;
                    wg.b = lh.e;
                    m.C = pk.c;
                } else {
                    wg.b = gj.U;
                    ij.j = gk.o;
                    sa.u = uh.Y;
                    m.C = gk.b;
                }
                return "";
            case "local": te.g = n[1] < 0 ? null : (pb) E[n[1]]; return "";
            case "hint": {
                if (n[2] < 0) {
                    ve.t[n[1]] = null;
                    return "";
                }
                kf h = new kf();
                h.j = n[2];
                h.a = n[3];
                h.i = n[4];
                h.e = n[5];
                h.h = n[6];
                ve.t[n[1]] = h;
                return "";
            }
            case "npcat": uc.l[n[1]] = n[2] < 0 ? null : (bk) E[n[2]]; return "";
            case "plat": tf.J[n[1]] = n[2] < 0 ? null : (pb) E[n[2]]; return "";
            case "spothill": bf.b(-17177, n[1]).f = n[2] != 0; return "";
            case "spot": E[n[1]] = new ac(n[2], n[3], n[4], n[5], n[6], n[7], n[8]); return " | " + dump(E[n[1]]);
            case "proj": E[n[1]] = new hl(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], n[10], n[11], n[12]); return " | " + dump(E[n[1]]);
            case "obj": {
                ig o = new ig();
                o.m = n[2];
                o.p = n[3];
                E[n[1]] = o;
                return " | " + dump(o);
            }
            case "player": E[n[1]] = new pb(); return " | " + dump(E[n[1]]);
            case "npc": E[n[1]] = new bk(); return " | " + dump(E[n[1]]);
            case "appear": {
                pb p = (pb) E[n[1]];
                if (p.pc == null) p.pc = new cl();
                p.U = n[3];
                p.pc.a(n[2] != 0, ints(t[5]), n[3], ints(t[6]), -9, n[4]);
                return " | " + dump(p);
            }
            case "npctype": {
                bk b = (bk) E[n[1]];
                b.a((byte) -51, n[2] < 0 ? null : uk.a(n[2], 91));
                return " | " + dump(b);
            }
            case "set": {
                ug e = E[n[1]];
                Field f = find(e, t[2]);
                if (f.getType() == boolean.class) f.setBoolean(e, n[3] != 0);
                else f.setInt(e, n[3]);
                return " | " + dump(e);
            }
            case "slot": {
                ob a = (ob) E[n[1]];
                if (n[3] < 0) a.pb[n[2]] = null;
                else {
                    ci s = new ci();
                    s.e = n[3];
                    s.n = n[4];
                    s.a = n[5];
                    s.d = n[6];
                    s.f = n[7];
                    s.j = n[8];
                    a.pb[n[2]] = s;
                }
                return " | " + dump(a);
            }
            case "attach": {
                ob a = (ob) E[n[1]];
                a.nb = n[2] == 0 ? lit(n[3]) : n[2] == 1 ? new Object() : n[2] == 3 ? new ml(n[3], n[4], n[5], n[6], n[7], n[8], -1, false, null) : null;
                return " | " + dump(a);
            }
            case "adv": {
                ug e = E[n[1]];
                if (e instanceof ac a) a.a(n[2], -121);
                else ((hl) e).a((byte) 28, n[2]);
                return " | " + dump(e);
            }
            case "target": ((hl) E[n[1]]).a((byte) -85, n[2], n[3], n[4], n[5]); return " | " + dump(E[n[1]]);
            case "draw": {
                ug e = E[n[1]];
                bg = px.clone();
                e.a(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], Long.parseLong(t[10]), n[11], n[12] != 0 ? new ue() : null);
                return drawState(e) + " | " + dump(e);
            }
            case "update": E[n[1]].a(n[2], n[3], n[4], n[5], n[6]); return " | " + dump(E[n[1]]);
            case "miny": return " " + E[n[1]].b();
            case "model": {
                ug e = E[n[1]];
                nd m = e instanceof ac ? (nd) acModel.invoke(e, (byte) -25) : (nd) hlModel.invoke(e, 2047);
                return " " + model(m) + " | " + dump(e);
            }
            case "arrow": {
                pb p = (pb) E[n[1]];
                bg = px.clone();
                pbArrow.invoke(p, n[2], n[3], n[4], (byte) 16, n[5], n[6], n[7], n[8], null, n[9], n[10], n[11], n[12], n[13], lit(n[14]));
                return drawState(p) + " | " + dump(p);
            }
            case "dump": return " | " + dump(E[n[1]]);
            default: throw new IllegalArgumentException("unknown op " + t[0]);
        }
    }

    public static void main(String[] args) throws Exception {
        String dir = args[0];
        fcFields = new Field[FC_FIELDS.length];
        for (int i = 0; i < FC_FIELDS.length; i++) fcFields[i] = field(fc.class, FC_FIELDS[i]);
        ndJ = field(nd.class, "j");
        acModel = ac.class.getDeclaredMethod("b", byte.class);
        acModel.setAccessible(true);
        hlModel = hl.class.getDeclaredMethod("a", int.class);
        hlModel.setAccessible(true);
        pbArrow = pb.class.getDeclaredMethod("a", int.class, int.class, int.class, byte.class, int.class, int.class, int.class, int.class, ue.class,
            int.class, int.class, int.class, int.class, int.class, nd.class);
        pbArrow.setAccessible(true);

        // Terrain: 0 flat at 0, 1 rolling hills, 2 steep slopes; flags: 0 clear, 1 bridges on every third tile.
        for (int k = 0; k < 3; k++) {
            terrains[k] = new int[4][105][105];
            for (int p = 0; p < 4; p++) for (int x = 0; x < 105; x++) for (int z = 0; z < 105; z++) {
                if (k == 1) terrains[k][p][x][z] = -((x * 37 + z * 91) % 400) - ((x * z) % 97) * 3 - p * 50;
                if (k == 2) terrains[k][p][x][z] = (p * 131 + x * 7 - z * 11) * 41;
            }
        }
        for (int k = 0; k < 2; k++) {
            maplFlags[k] = new byte[4][104][104];
            if (k == 1) for (int p = 0; p < 4; p++) for (int x = 0; x < 104; x++) for (int z = 0; z < 104; z++) if ((x + z) % 3 == 0) maplFlags[k][p][x][z] = 2;
        }

        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII));
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");
        boolean setup = false;
        for (String line; (line = reader.readLine()) != null;) {
            if (!setup && !line.equals("init")) {
                // The archives and the client's config-loader initialisation (client.java, the id.a .. mi.a block).
                al frames = new al(new Provider(dir, 0), false, false);
                al bases = new al(new Provider(dir, 1), false, false);
                al config = new al(new Provider(dir, 2), false, false);
                al models = new al(new Provider(dir, 7), false, false);
                al npcs = new al(new Provider(dir, 18), false, false);
                al objs = new al(new Provider(dir, 19), false, false);
                al seqs = new al(new Provider(dir, 20), false, false);
                al spots = new al(new Provider(dir, 21), false, false);
                al varbits = new al(new Provider(dir, 22), false, false);
                al locs = new al(new Provider(dir, 16), false, false);
                rk.k = models;
                id.a(config, (byte) 69, models);
                qj.a(-2, npcs, models);
                bj.a(objs, -128, true, null, models);
                hf.a(seqs, bases, -124, frames);
                sb.a(models, (byte) 58, locs, true);
                oa.a(49, config);
                nf.a(models, spots, true);
                mi.a(415013098, varbits);
                // client.java: the recolour palettes and the RS recolour tables (jl.c == 0).
                rc.h = de.v = la.Z = al.q = new short[256];
                ij.j = ie.J;
                sa.u = ik.Z;
                wg.b = lh.e;
                m.C = pk.c;
                // A 320x240 framebuffer with Pix3D clipped to it, brightness 0.8 without dc.a(F)'s random jitter, and
                // the fake textures.
                px = new int[W * H];
                td.a(px, W, H);
                dc.d();
                field(dc.class, "i").setFloat(null, 0.8F);
                Method colours = dc.class.getDeclaredMethod("b", int.class, int.class);
                colours.setAccessible(true);
                colours.invoke(null, 0, 512);
                dc.r = new Textures();
                fill(0);
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
                extra = run(t, n);
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Throwable e) {
                result = code(e);
                // The entity the failed op touched is still dumped, so the state at the throw is compared.
                // A failed draw also reports the framebuffer and statics it left behind.
                if (isEntityOp(t[0]) && n[1] >= 0 && n[1] < E.length) {
                    extra = (t[0].equals("draw") || t[0].equals("arrow")) && E[n[1]] != null ? drawState(E[n[1]]) : "";
                    extra += " | " + dump(E[n[1]]);
                }
            }
            out.println(result + extra);
        }
        out.flush();
    }

    static boolean isEntityOp(String op) {
        return List.of("spot", "proj", "obj", "player", "npc", "appear", "npctype", "set", "slot", "attach", "adv", "target", "draw", "update", "model", "arrow").contains(op);
    }
}
