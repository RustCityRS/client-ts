import java.io.*;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// The real-data half of minimap-builder.test.ts: ph.a(IZ)Z, fd.a(ILaj;III)V and ke.a(ILaj;III)V on the real gamepack
// classes, over real cache archives (served from the sector files like ProviderConfigOracle.Provider) and a Lumbridge
// world the test built with the native ClientBuild loaders and replays here through the same world calls (mc.a, uk.a,
// ae.a, oe.a, vf.a). The fixture file (written by the test) holds those world calls, the tb.t level flags and the hc.c
// collision flags. Each stdin line is one op; each prints one result line (see minimap-builder.test.ts for the ops).
//
// Run "MinimapRealOracle instrument <jar> <dir>" first: it writes fd, hd and ph to <dir> with their calls to wa.a
// (DrawDot), hd.a (DrawArrow) and ig.a (DrawDetail) redirected through the logging wrappers below, which then make
// the original call. Only the call target changes; the arguments and the code around them are the jar's.
public class MinimapRealOracle {
    static final String[] NAMES = {"alice", "bob", "Carol", "dave1", "e_f", "zz", "Zezima", "mod_ash"};
    static final int W = 765, H = 503;
    static final ud EMPTY = new ud() {
        db b(int n) { return null; }
        byte[] a(int m, int g) { return null; }
        void b(int n, int g) {}
        int c(int g, int n) { return 0; }
    };

    static Random math;
    static String cache;
    static al config, interfaces, models, sprites, fonts, locs, npcs, varbits, worldmap, empty;
    static kc labels;
    static int[] frame;
    static oh screen;
    static final Map<Integer, aj> comps = new HashMap<>();
    static final StringBuilder calls = new StringBuilder();
    static int details, detailsFalse;
    static DataInputStream fixture;

    // ---- instrumentation ----

    static void instrument(Path jar, Path dir) throws Exception {
        try (JarFile source = new JarFile(jar.toFile())) {
            rewrite(source, dir, "fd", "a", "(ILaj;III)V");
            rewrite(source, dir, "hd", "a", "(Laj;IIIIII)V");
            rewrite(source, dir, "ph", "a", "(IZ)Z");
        }
    }

    static void rewrite(JarFile source, Path dir, String cls, String method, String descriptor) throws Exception {
        ClassReader reader = new ClassReader(source.getInputStream(source.getJarEntry(cls + ".class")));
        ClassWriter writer = new ClassWriter(0);
        int[] redirected = {0};
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            public MethodVisitor visitMethod(int flags, String name, String desc, String sig, String[] ex) {
                MethodVisitor mv = super.visitMethod(flags, name, desc, sig, ex);
                if (!name.equals(method) || !desc.equals(descriptor)) return mv;
                return new MethodVisitor(Opcodes.ASM8, mv) {
                    public void visitMethodInsn(int op, String owner, String name, String desc, boolean iface) {
                        String probe = switch (owner + "." + name + desc) {
                            case "wa.a(Laj;ILvc;ZIII)V" -> "dot";
                            case "hd.a(Laj;IIIIII)V" -> "arrow";
                            case "ig.a(IIIIIIII)Z" -> "detail";
                            default -> null;
                        };
                        if (probe != null) redirected[0]++;
                        super.visitMethodInsn(op, probe == null ? owner : "MinimapRealOracle", probe == null ? name : probe, desc, iface);
                    }
                };
            }
        }, 0);
        if (redirected[0] == 0) throw new IllegalStateException("nothing redirected in " + cls);
        Files.write(dir.resolve(cls + ".class"), writer.toByteArray());
    }

    // wa.a(Laj;ILvc;ZIII)V: component, x, sprite, draw, dx, y, dz.
    public static void dot(aj c, int x, vc sprite, boolean draw, int dx, int y, int dz) {
        calls.append('D').append(tag(sprite)).append(',').append(x).append(',').append(dx).append(',').append(y).append(',')
            .append(dz).append(',').append(draw ? 1 : 0).append(comps.containsValue(c) ? "" : "!").append(';');
        wa.a(c, x, sprite, draw, dx, y, dz);
    }

    // hd.a(Laj;IIIIII)V: component, dx, dz, y, x, marker, and fd's dummy (arg ^ 52 = 20).
    public static void arrow(aj c, int dx, int dz, int y, int x, int marker, int dummy) {
        if (dummy != 20) throw new AssertionError("hd.a dummy " + dummy);
        calls.append('A').append(dx).append(',').append(dz).append(',').append(y).append(',').append(x).append(',')
            .append(marker).append(comps.containsValue(c) ? "" : "!").append(';');
        hd.a(c, dx, dz, y, x, marker, dummy);
    }

    // ig.a(IIIIIIII)Z, ph.a's DrawDetail: counted, with its false returns.
    public static boolean detail(int z, int offsetX, int active, int level, int dummy, int x, int offsetZ, int wall) {
        if (dummy != -710) throw new AssertionError("ig.a dummy " + dummy);
        details++;
        boolean drawn = ig.a(z, offsetX, active, level, dummy, x, offsetZ, wall);
        if (!drawn) detailsFalse++;
        return drawn;
    }

    static String tag(vc s) {
        if (s == null) return "n";
        if (gh.N != null) for (int i = 0; i < gh.N.length; i++) if (gh.N[i] == s) return "f" + i;
        if (ll.r != null) for (int i = 0; i < ll.r.length; i++) if (ll.r[i] == s) return "d" + i;
        if (cf.e != null) for (int i = 0; i < cf.e.length; i++) if (cf.e[i] == s) return "m" + i;
        if (s == fe.Y) return "F";
        return "?";
    }

    // ---- cache ----

    static class Provider extends ud {
        final int archive;
        final db index;

        Provider(int archive) throws Exception {
            this.archive = archive;
            byte[] ref = container(readGroup(255, archive));
            index = new db(ref, q.a(0, ref, ref.length));
        }

        db b(int ignored) { return index; }

        byte[] a(int mode, int group) {
            try {
                return container(readGroup(archive, group));
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        void b(int ignored, int group) {}

        int c(int group, int ignored) { return 100; }
    }

    // The JS5 sector-file reader of test/cachefile.ts (readGroup).
    static byte[] readGroup(int archive, int group) throws Exception {
        byte[] entry = new byte[6];
        try (RandomAccessFile idx = new RandomAccessFile(cache + "/main_file_cache.idx" + archive, "r")) {
            idx.seek(group * 6L);
            idx.readFully(entry);
        }
        int size = (entry[0] & 255) << 16 | (entry[1] & 255) << 8 | entry[2] & 255;
        int sector = (entry[3] & 255) << 16 | (entry[4] & 255) << 8 | entry[5] & 255;
        byte[] out = new byte[size];
        byte[] header = new byte[8];
        try (RandomAccessFile dat = new RandomAccessFile(cache + "/main_file_cache.dat2", "r")) {
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

    static al archive(int id) throws Exception {
        return new al(new Provider(id), false, true);
    }

    // The scene models the replayed world holds; the minimap never draws them.
    static final class Model extends ug {
        void a(int yaw, int sinPitch, int cosPitch, int sinYaw, int cosYaw, int x, int y, int z, long typecode, int level, ue particles) {}
        int b() { return 0; }
        void a(int a0, int a1, int a2, int a3, int a4) {}
    }

    // ---- hashing ----

    static int hash(int[] a) {
        if (a == null) return 0;
        int h = 1;
        for (int v : a) h = 31 * h + v;
        return h;
    }

    static int hash(boolean[] a) {
        int h = 1;
        for (boolean v : a) h = 31 * h + (v ? 1 : 0);
        return h;
    }

    static int lh(long v) {
        return (int) (v ^ (v >>> 32));
    }

    static String sprite(vc v) {
        if (v == null) return "n";
        if (!(v instanceof rh)) return "o";
        return v.O + "x" + v.D + ":" + hash(((rh) v).I);
    }

    static String sprites(vc[] a) {
        if (a == null) return "n";
        StringBuilder b = new StringBuilder().append(a.length).append('[');
        int h = 1;
        for (vc v : a) h = 31 * h + sprite(v).hashCode();
        return b.append(h).append(']').toString();
    }

    static String pix() {
        return hash(frame) + "|" + hash(ce.T) + "|" + td.e + "," + td.b + "," + td.h + "," + td.d + "|" + (td.f == null) + (td.a == null);
    }

    static String image(vc v, vc prevW, vc prevK) {
        if (v == null) return "n";
        if (!(v instanceof rh)) return "o";
        int[] p = ((rh) v).I;
        StringBuilder b = new StringBuilder();
        b.append(v == prevW ? "w" : "").append(v == prevK ? "k" : "").append(hash(p));
        // 8 bands of 64 rows, so a mismatch shows where it is.
        if (p.length == 512 * 512) {
            for (int band = 0; band < 8; band++) b.append(band == 0 ? ":" : ",").append(hash(Arrays.copyOfRange(p, band * 64 * 512, (band + 1) * 64 * 512)));
        }
        return b.toString();
    }

    static String status(RuntimeException ex) {
        Throwable t = ex;
        while (t instanceof g w) t = w.a;
        if (t instanceof NullPointerException) return "null";
        if (t instanceof ArrayIndexOutOfBoundsException) return "bounds";
        if (t instanceof ClassCastException) return "cast";
        if (t instanceof ArithmeticException) return "division";
        if (t instanceof IllegalArgumentException) return "illegal";
        if (t instanceof IllegalStateException) return "state";
        throw ex;
    }

    static id name(int i) {
        return vb.a(NAMES[i], (byte) 99);
    }

    // ---- ops ----

    static String init(int msiSeed, int spriteSeed) throws Exception {
        config = archive(2);
        interfaces = archive(3);
        models = archive(7);
        sprites = archive(8);
        fonts = archive(13);
        locs = archive(16);
        npcs = archive(18);
        varbits = archive(22);
        worldmap = archive(23);
        empty = new al(EMPTY, true, true);
        sb.a(models, (byte) 58, locs, true);
        math.setSeed(msiSeed);
        kh.a(sprites, config, (byte) -103);
        qj.a(-2, npcs, models);
        mi.a(415013098, varbits);
        wf.a(fonts, sprites, true, models, interfaces);
        ld.a(sprites, 52);
        si.a((byte) 114, sprites, fonts);
        math.setSeed(spriteSeed);
        uf.a(sprites, -7058);
        labels = ii.a(12447, vb.a("main_labels", (byte) 99), worldmap);
        screen = new oh() {
            void a(int a, int b, int c, java.awt.Graphics g) {}
            void a(int a, int b, java.awt.Component c, byte d) {}
            void a(byte a, int b, int c, int d, int e, java.awt.Graphics g) {}
        };
        screen.n = new int[W * H];
        screen.e = H;
        screen.i = W;
        rg.s = screen;
        frame = new int[W * H];
        return " " + gl.D + "," + hj.h + "," + pj.E + " " + jk.F + "," + gg.E + "," + mi.D + " " + sprites(gh.N) + " " + sprites(ll.r) + " " + sprite(fe.Y) + " "
            + sprite(ff.u) + " " + sprites(cf.e) + " " + sprites(gf.cb) + " " + labels.h;
    }

    static String world() throws IOException {
        mc.a(4, 104, 104, 25, false);
        int grounds = fixture.readInt();
        for (int i = 0; i < grounds; i++) {
            int l = fixture.readInt(), x = fixture.readInt(), z = fixture.readInt(), shape = fixture.readInt(), rot = fixture.readInt();
            int under = fixture.readInt(), over = fixture.readInt();
            uk.a(l, x, z, shape, rot, -1, 0, 0, 0, 0, under, under, under, under, over, over, over, over, under, over);
        }
        int count = fixture.readInt();
        for (int i = 0; i < count; i++) {
            int kind = fixture.readInt(), l = fixture.readInt(), x = fixture.readInt(), z = fixture.readInt();
            int sizeX = fixture.readInt(), sizeZ = fixture.readInt(), aux = fixture.readInt();
            long typecode = fixture.readLong();
            switch (kind) {
                case 0 -> ae.a(l, x, z, 0, new Model(), aux >> 8 != 0 ? new Model() : null, aux & 255, aux >> 8, typecode);
                case 1 -> oe.a(l, x, z, 0, sizeX, sizeZ, new Model(), aux, typecode);
                case 2 -> vf.a(l, x, z, 0, new Model(), typecode, aux != 0);
                default -> throw new IllegalStateException("kind " + kind);
            }
        }
        tb.t = new byte[4][104][104];
        for (int l = 0; l < 4; l++) for (int x = 0; x < 104; x++) fixture.readFully(tb.t[l][x]);
        hc.c = new ke[4];
        for (int l = 0; l < 4; l++) {
            ke m = new ke(104, 104);
            for (int x = 0; x < 104; x++) for (int z = 0; z < 104; z++) m.d[x][z] = fixture.readInt();
            hc.c[l] = m;
        }
        // A digest of every square the minimap reads.
        int h = 1, squares = 0;
        for (int l = 0; l < 4; l++) for (int x = 0; x < 104; x++) for (int z = 0; z < 104; z++) {
            ra s = kl.Bb[l][x][z];
            if (s == null) {
                h = 31 * h;
                continue;
            }
            squares++;
            h = 31 * h + (s.F == null ? -1 : s.F.m);
            h = 31 * h + (s.x == null ? -1 : s.x.m * 7 + s.x.a);
            h = 31 * h + (s.x == null ? -1 : s.x.l);
            h = 31 * h + (s.x == null ? -1 : s.x.n);
            h = 31 * h + (s.z == null ? -1 : lh(s.z.f));
            h = 31 * h + (s.u == null ? -1 : lh(s.u.e));
            h = 31 * h + s.t;
            for (int i = 0; i < s.t; i++) h = 31 * (31 * (31 * h + lh(s.H[i].u)) + s.H[i].a) + s.H[i].m;
        }
        return " " + grounds + " " + count + " " + squares + " " + h;
    }

    static String mask(int id) {
        aj c = ad.a((byte) 110, id);
        comps.put(id, c);
        c.C = c.G;
        c.H = c.M;
        boolean ok = c.a(22710);
        return " " + ok + " " + c.C + "x" + c.H + " " + hash(c.s) + " " + hash(c.ud);
    }

    static String build(int level, int playerLevel, int seed, int mode) {
        ah.f = playerLevel;
        if ((mode & 2) != 0) {
            ek.w = null;
            ob.Kb = null;
        }
        mj.d = (mode & 1) != 0 ? empty : sprites;
        if ((mode & 1) != 0) mk.A.a(0);
        vc prevW = ek.w, prevK = ob.Kb;
        details = detailsFalse = 0;
        math.setSeed(seed);
        String st;
        try {
            st = String.valueOf(ph.a(level, true));
        } catch (RuntimeException ex) {
            st = status(ex);
        }
        int next = (int) (Math.random() * 2147483647.0);
        return " " + st + "|" + qk.C + "|" + hash(ec.o) + "|" + hash(ba.h) + "|" + hash(oh.m) + "|" + image(ek.w, prevW, prevK) + "|"
            + image(ob.Kb, prevW, prevK) + "|" + (td.g == screen.n) + "," + td.c + "," + td.i + "|" + next + "|" + details + "," + detailsFalse;
    }

    static String run(String[] t, int[] n) throws Exception {
        switch (t[0]) {
            case "init": return init(n[1], n[2]);
            case "world": return world();
            case "mask": return mask(n[1]);
            case "build": return build(n[1], n[2], n[3], n[4]);
            case "frame":
                for (int i = 0; i < frame.length; i++) frame[i] = (i * 0x9E3779B1) ^ n[1];
                td.a(frame, W, H);
                Arrays.fill(ce.T, false);
                return "";
            case "cam": df.B = n[1]; ag.e = n[2]; kk.db = n[3]; ki.R = n[4]; return "";
            case "self":
                if (n[1] < 0) {
                    te.g = null;
                    return "";
                }
                te.g = new pb();
                te.g.Z = n[1];
                te.g.S = n[2];
                te.g.Bc = n[3];
                return "";
            case "base": hk.e = n[1]; vj.t = n[2]; return "";
            case "labels": ug.d = n[1] == 0 ? null : labels; return "";
            case "lflag": labels.f[n[1]] = (byte) n[2]; return "";
            case "npcs": uc.l = new bk[32768]; ed.d = n[1]; return "";
            case "npc": {
                fi.n[n[1]] = n[2];
                if (n[3] == -2) {
                    uc.l[n[2]] = null;
                    return "";
                }
                bk npc = new bk();
                npc.Z = n[4];
                npc.S = n[5];
                if (n[3] >= 0) npc.mc = uk.a(n[3], -10);
                uc.l[n[2]] = npc;
                return "";
            }
            case "icon": uk.a(n[1], -10).u = n[2]; return "";
            case "players": tf.J = new pb[2048]; fe.R = n[1]; return "";
            case "player": {
                ad.h[n[1]] = n[2];
                if (n[6] == -2) {
                    tf.J[n[2]] = null;
                    return "";
                }
                pb p = new pb();
                p.Z = n[3];
                p.S = n[4];
                p.Bc = n[5];
                p.Gc = n[6] < 0 ? null : name(n[6]);
                p.pc = n[7] != 0 ? new cl() : null;
                tf.J[n[2]] = p;
                return "";
            }
            case "friends": sj.L = n[1]; return "";
            case "friend": jd.m[n[1]] = name(n[2]).b((byte) -16); jf.b[n[1]] = n[3]; return "";
            case "clan": jl.b = new rf[n[2]]; uh.N = n[1]; return "";
            case "member": {
                rf m = new rf();
                m.k = name(n[2]).b((byte) -16);
                jl.b[n[1]] = m;
                return "";
            }
            case "arrow": {
                if (n[2] < 0) {
                    ve.t[n[1]] = null;
                    return "";
                }
                kf a = new kf();
                a.j = n[2];
                a.a = n[3];
                a.o = n[4];
                a.i = n[5];
                a.e = n[6];
                ve.t[n[1]] = a;
                return "";
            }
            case "loop": hh.kb = n[1]; return "";
            case "dest": gl.z = n[1]; ic.T = n[2]; return "";
            case "objs": b.H = new gk[4][104][104]; ah.f = n[1]; return "";
            case "obj": b.H[ah.f][n[1]][n[2]] = new gk(); return "";
            case "var": vj.d[n[1]] = n[2]; return "";
            case "draw": {
                calls.setLength(0);
                String st = "ok";
                try {
                    fd.a(n[2], comps.get(n[1]), n[4], 32, n[3]);
                } catch (RuntimeException ex) {
                    st = status(ex);
                }
                return " " + st + "|" + pix() + "|" + calls;
            }
            case "compass": {
                String st = "ok";
                try {
                    ke.a(n[4], comps.get(n[1]), n[5], n[2], n[3]);
                } catch (RuntimeException ex) {
                    st = status(ex);
                }
                return " " + st + "|" + pix();
            }
            default: throw new IllegalStateException("unknown op " + t[0]);
        }
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) {
            instrument(Path.of(args[1]), Path.of(args[2]));
            return;
        }
        Field rng = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        rng.setAccessible(true);
        math = (Random) rng.get(null);
        // The four <clinit>s that draw from Math.random run now, so none of them lands inside a seeded run.
        for (String c : new String[] {"cg", "ki", "ok", "si"}) Class.forName(c);
        cache = args[1];
        fixture = new DataInputStream(new BufferedInputStream(new FileInputStream(args[0])));
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII), 1 << 20);
        PrintStream out = new PrintStream(new BufferedOutputStream(new FileOutputStream(FileDescriptor.out), 1 << 16), false, "UTF-8");
        for (String line; (line = in.readLine()) != null;) {
            String[] t = line.split(" ");
            int[] n = new int[t.length];
            for (int i = 1; i < t.length; i++) n[i] = Integer.parseInt(t[i]);
            String result;
            try {
                result = "ok" + run(t, n);
            } catch (RuntimeException ex) {
                result = status(ex);
            }
            out.println(result);
        }
        out.flush();
    }
}
