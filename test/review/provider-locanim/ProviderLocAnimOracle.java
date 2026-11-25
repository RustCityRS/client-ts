import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.Random;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.ClassReader;
import jdk.internal.org.objectweb.asm.ClassVisitor;
import jdk.internal.org.objectweb.asm.ClassWriter;
import jdk.internal.org.objectweb.asm.MethodVisitor;
import jdk.internal.org.objectweb.asm.Opcodes;

// Differential oracle for unit locanim: ml (ClientLocAnim: the constructor, the ug overrides a(IIIII)V, b()I and
// a(IIIIIIIIJILue;)V, b(B)Lug; and the private a(ZI)Lug; and a(BII)V) and the four aj (IfType) renderer methods a(I)Z,
// a(Lcl;IIZIZLek;)Lnd;, b(ZI)Lvc; and c(ZI)Lvc;. Compiled with javac next to client.jar (same unnamed runtime package),
// so package-private members are used directly; private members go through reflection.
//
// Two runs: `ProviderLocAnimOracle <client.jar> <outdir>` rewrites ml.class into <outdir> with its single
// INVOKESTATIC sf.a(Lek;IIIZI)V (the frame-sound trigger at javap offset 0x116 of ml.a(BII)V) redirected to
// ProviderLocAnimOracle.sound, which records the call instead of queueing a sound (the TS test replaces
// Client.TriggerSeqSound the same way). `ProviderLocAnimOracle <cache dir>` then runs the script with <outdir> ahead of
// client.jar on the class path.
//
// Every archive the unit reads (0 frames, 1 bases, 2 config, 3 interfaces, 7 models, 8 sprites, 13 font metrics,
// 16 locs, 18 npcs, 19 objs, 20 seqs, 22 varbits) is a real al over a ud that serves the cache's sector files, and the
// config loaders are initialised with the client's own calls (client.java:1931-1941, same dummy constants), so the real
// gamepack classes decode every definition and build every model and sprite.
//
// stdin is the script (one operation per line); stdout has exactly one line per operation: the result (ok or the Java
// exception, unwrapping the obfuscator's g wrapper), any return value, the sound-trigger calls the operation made, and
// a dump of the state it touched. test/review/provider-locanim.test.ts runs the same script through the TS port.
class ProviderLocAnimOracle {
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

    // Fake textures, identical to provider-locanim.test.ts (and model-lit's): ids divisible by 3 are 128x128.
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

    // An entity that is not an ml, for the constructor's `var9 instanceof ml` test.
    static final class Foreign extends ug {
        void a(int a, int b, int c, int d, int e, int f, int g, int h, long i, int j, ue k) {}
        int b() { return 0; }
        void a(int a, int b, int c, int d, int e) {}
    }

    // ---- the sound hook ----

    static final ArrayList<String> sounds = new ArrayList<>();

    // Replaces sf.a(Lek;IIIZI)V in ml: seq, fine z (ml's var3), the dummy (-107), fine x (ml's var2), local, frame.
    public static void sound(ek seq, int z, int dummy, int x, boolean local, int frame) {
        sounds.add((seq == null ? "null" : String.valueOf(seq.f)) + "," + z + "," + x + "," + (local ? 1 : 0) + "," + frame + (dummy == -107 ? "" : ",dummy" + dummy));
    }

    static void prepare(Path gamepack, Path out) throws Exception {
        try (JarFile jar = new JarFile(gamepack.toFile())) {
            ClassReader reader = new ClassReader(jar.getInputStream(jar.getJarEntry("ml.class")));
            ClassWriter writer = new ClassWriter(0);
            int[] calls = {0};
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] ex) {
                    MethodVisitor visitor = super.visitMethod(access, name, desc, sig, ex);
                    return new MethodVisitor(Opcodes.ASM8, visitor) {
                        public void visitMethodInsn(int op, String owner, String method, String type, boolean iface) {
                            if (op == Opcodes.INVOKESTATIC && owner.equals("sf") && method.equals("a") && type.equals("(Lek;IIIZI)V")) {
                                if (!name.equals("a") || !desc.equals("(BII)V")) throw new AssertionError("sf.a outside ml.a(BII)V");
                                super.visitMethodInsn(op, "ProviderLocAnimOracle", "sound", type, false);
                                calls[0]++;
                            } else {
                                super.visitMethodInsn(op, owner, method, type, iface);
                            }
                        }
                    };
                }
            }, 0);
            if (calls[0] != 1) throw new AssertionError("sf.a calls in ml: " + calls[0]);
            Files.write(out.resolve("ml.class"), writer.toByteArray());
        }
    }

    // ---- dumps ----

    // fc's instance fields (as model-lit), then nd.j.
    static final String[] FC_FIELDS = {
        "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "D", "E", "F", "G", "H",
        "I", "J", "K", "L", "M", "N", "Q", "R", "S", "U", "Y", "Z"
    };
    // ml's instance fields, sorted by name.
    static final String[] ML_FIELDS = {"A", "B", "D", "F", "G", "I", "K", "L", "M", "O", "P", "R", "j", "o", "q", "s", "y"};

    static final int W = 320, H = 240;
    static int[] px, bg;
    static final ml[] E = new ml[64];
    static final cl[] P = new cl[8];
    static aj C;
    static final int[][][][] terrains = new int[3][][][];
    static final IdentityHashMap<Object, Integer> tags = new IdentityHashMap<>();
    static Field[] fcFields, mlFields;
    static Field ndJ, ajO, ajZb, veP, rng;
    static Method mlBuild;

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static int tag(Object o) {
        if (o == null) return 0;
        return tags.computeIfAbsent(o, k -> tags.size() + 1);
    }

    static int hash(int[] v) {
        int h = 1;
        for (int e : v) h = 31 * h + e;
        return h;
    }

    static String value(Object v) {
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
        if (v instanceof Boolean b) return b ? "1" : "0";
        if (v instanceof Integer || v instanceof Long || v instanceof Short || v instanceof Byte) return v.toString();
        return "obj";
    }

    static String model(Object m) throws Exception {
        if (m == null) return "nullmodel";
        if (!(m instanceof fc)) return m.getClass().getName() + "#" + tag(m);
        StringBuilder sb = new StringBuilder("fc#").append(tag(m));
        for (int i = 0; i < FC_FIELDS.length; i++) sb.append(' ').append(FC_FIELDS[i]).append('=').append(value(fcFields[i].get(m)));
        return sb.append(" j=").append(ndJ.getBoolean(m) ? 1 : 0).toString();
    }

    static String sprite(vc s) {
        if (s == null) return "nullsprite";
        StringBuilder sb = new StringBuilder(s.getClass().getName()).append('#').append(tag(s));
        sb.append(' ').append(s.B).append('x').append(s.A).append(" off=").append(s.F).append(',').append(s.C).append(" crop=").append(s.O).append(',').append(s.D);
        if (s instanceof rh r) sb.append(" px=").append(value(r.I));
        return sb.toString();
    }

    static String entity(ml e) throws Exception {
        if (e == null) return "empty";
        StringBuilder sb = new StringBuilder("ml");
        for (int i = 0; i < ML_FIELDS.length; i++) {
            Object v = mlFields[i].get(e);
            sb.append(' ').append(ML_FIELDS[i]).append('=').append(v instanceof ek s ? "seq" + s.f : value(v));
        }
        return sb.toString();
    }

    static String component(aj c) throws Exception {
        if (c == null) return "nullcomponent";
        return "aj " + c.Kc + " t=" + c.ob + " md=" + c.md + " w=" + c.w + " zb=" + ajZb.getInt(c) + " O=" + ajO.getInt(c) + " kc=" + c.kc + " mb=" + c.mb + " lc=" + c.lc
            + " Kb=" + value(c.Kb) + " fb=" + value(c.fb) + " tc=" + c.tc + " Dc=" + c.Dc + " Xb=" + value(c.Xb) + " lb=" + value(c.lb) + " s=" + value(c.s) + " ud=" + value(c.ud);
    }

    static String ifState() throws Exception {
        return " rk=" + (rk.o ? 1 : 0) + " ms=" + veP.getInt(gf.S) + " ss=" + veP.getInt(bj.b);
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
        if (s.equals("empty")) return new int[0];
        String[] p = s.split(",");
        int[] r = new int[p.length];
        for (int i = 0; i < p.length; i++) r[i] = Integer.parseInt(p[i]);
        return r;
    }

    static void fill(int seed) {
        for (int i = 0; i < px.length; i++) px[i] = i * 0x2545F491 ^ seed * 0x27D4EB2F;
        bg = px.clone();
    }

    static String drawState() {
        int changed = 0;
        for (int i = 0; i < px.length; i++) if (px[i] != bg[i]) changed++;
        return " fb=" + hash(px) + " px=" + changed + " trans=" + dc.e;
    }

    static String init() throws Exception {
        return "kb=" + hh.kb + " jl.c=" + jl.c + " rf.x=" + rf.x + " qf.b=" + (qf.b ? 1 : 0) + " ve.q=" + (ve.q == null ? "null" : "obj") + " lf.g=" + (lf.g == null ? "null" : "obj")
            + " al.R=" + (al.R == null ? "null" : "obj") + " vj.d=" + vj.d.length + ":" + hash(vj.d) + " ms=" + veP.getInt(gf.S) + " ss=" + veP.getInt(bj.b) + " rk=" + (rk.o ? 1 : 0)
            + " pal=" + (m.C == null ? "null" : "obj") + "," + (sa.u == null ? "null" : "obj") + "," + (wg.b == null ? "null" : "obj") + "," + (ij.j == null ? "null" : "obj");
    }

    static ek seq(int id) {
        return id < 0 ? null : tb.b(id, -32);
    }

    static String run(String[] t, int[] n) throws Exception {
        switch (t[0]) {
            case "init": return " " + init();
            case "cls": fill(n[1]); return "";
            case "seed": ((Random) rng.get(null)).setSeed(Long.parseLong(t[1])); return "";
            case "cycle": hh.kb = n[1]; return "";
            case "variant": jl.c = n[1]; return "";
            case "shadows": rf.x = n[1]; return "";
            case "tween": qf.b = n[1] != 0; return "";
            case "varp": vj.d[n[1]] = n[2]; return "";
            case "hm":
                ve.q = n[1] < 0 ? null : terrains[n[1]];
                lf.g = n[2] < 0 ? null : terrains[n[2]];
                return "";
            case "loc": {
                ug prev = n[10] == 999 ? new Foreign() : n[10] < 0 ? null : E[n[10]];
                E[n[1]] = null;
                E[n[1]] = new ml(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9] != 0, prev);
                return " | " + entity(E[n[1]]);
            }
            case "tick": E[n[1]].a(n[2], n[3], n[4], n[5], n[6]); return " | " + entity(E[n[1]]);
            case "model": {
                ug m = E[n[1]].b((byte) 35);
                return " " + model(m) + " | " + entity(E[n[1]]);
            }
            case "build": {
                ug m = (ug) mlBuild.invoke(E[n[1]], n[2] != 0, 0);
                return " " + model(m) + " | " + entity(E[n[1]]);
            }
            case "miny": return " " + E[n[1]].b() + " | " + entity(E[n[1]]);
            case "draw": {
                ml e = E[n[1]];
                e.a(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], Long.parseLong(t[10]), n[11], n[12] != 0 ? new ue() : null);
                return drawState() + " | " + entity(e);
            }
            case "dump": return " | " + entity(E[n[1]]);
            case "objmodel": field(kl.class, "xb").setInt(rg.a(n[1], -28322), n[2]); return "";
            case "player": {
                cl p = new cl();
                p.a(n[2] != 0, ints(t[4]), n[3], ints(t[5]), -9, n[6]);
                P[n[1]] = p;
                return "";
            }
            case "if": {
                C = null;
                boolean open = qg.a(n[1] >>> 16, false);
                aj[] group = fk.ab[n[1] >>> 16];
                C = group == null ? null : group[n[1] & 65535];
                return " " + (open ? 1 : 0) + " " + component(C);
            }
            case "set": {
                String f = t[1];
                if (f.equals("O")) ajO.setInt(C, n[2]);
                else if (f.equals("zb")) ajZb.setInt(C, n[2]);
                else if (f.equals("lb") || f.equals("s") || f.equals("ud")) field(aj.class, f).set(C, ints(t[2]));
                else {
                    Field fl = field(aj.class, f);
                    if (fl.getType() == boolean.class) fl.setBoolean(C, n[2] != 0);
                    else fl.setInt(C, n[2]);
                }
                return " " + component(C);
            }
            case "mask": {
                boolean r = C.a(22710);
                return " " + (r ? 1 : 0) + " s=" + value(C.s) + " ud=" + value(C.ud) + ifState();
            }
            case "gm": {
                rk.o = n[7] != 0;
                nd m = C.a(n[1] < 0 ? null : P[n[1]], n[2], n[3], n[4] != 0, n[5], n[6] != 0, seq(n[8]));
                return " " + model(m) + ifState();
            }
            case "inv": {
                rk.o = n[2] != 0;
                vc s = C.b(true, n[1]);
                return " " + sprite(s) + ifState();
            }
            case "gfx": {
                rk.o = n[2] != 0;
                vc s = C.c(n[1] != 0, n[3]);
                return " " + sprite(s) + ifState();
            }
            default: throw new IllegalArgumentException("unknown op " + t[0]);
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 2) {
            prepare(Path.of(args[0]), Path.of(args[1]));
            return;
        }
        String dir = args[0];
        fcFields = new Field[FC_FIELDS.length];
        for (int i = 0; i < FC_FIELDS.length; i++) fcFields[i] = field(fc.class, FC_FIELDS[i]);
        mlFields = new Field[ML_FIELDS.length];
        for (int i = 0; i < ML_FIELDS.length; i++) mlFields[i] = field(ml.class, ML_FIELDS[i]);
        ndJ = field(nd.class, "j");
        ajO = field(aj.class, "O");
        ajZb = field(aj.class, "zb");
        veP = field(ve.class, "p");
        rng = field(Class.forName("java.lang.Math$RandomNumberGeneratorHolder"), "randomNumberGenerator");
        mlBuild = ml.class.getDeclaredMethod("a", boolean.class, int.class);
        mlBuild.setAccessible(true);

        // Terrain 0 flat at 0, 1 rolling hills, 2 steep slopes (four levels of 105 x 105 corners each).
        for (int k = 0; k < 3; k++) {
            terrains[k] = new int[4][105][105];
            for (int p = 0; p < 4; p++) for (int x = 0; x < 105; x++) for (int z = 0; z < 105; z++) {
                if (k == 1) terrains[k][p][x][z] = -((x * 37 + z * 91) % 400) - ((x * z) % 97) * 3 - p * 50;
                if (k == 2) terrains[k][p][x][z] = (p * 131 + x * 7 - z * 11) * 41;
            }
        }

        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII));
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");
        boolean setup = false;
        for (String line; (line = reader.readLine()) != null;) {
            if (!setup && !line.equals("init")) {
                // The archives and the client's config-loader initialisation (client.java:1931-1941).
                al frames = new al(new Provider(dir, 0), false, false);
                al bases = new al(new Provider(dir, 1), false, false);
                al config = new al(new Provider(dir, 2), false, false);
                al interfaces = new al(new Provider(dir, 3), false, false);
                al models = new al(new Provider(dir, 7), false, false);
                al sprites = new al(new Provider(dir, 8), false, false);
                al metrics = new al(new Provider(dir, 13), false, false);
                al locs = new al(new Provider(dir, 16), false, false);
                al npcs = new al(new Provider(dir, 18), false, false);
                al objs = new al(new Provider(dir, 19), false, false);
                al seqs = new al(new Provider(dir, 20), false, false);
                al varbits = new al(new Provider(dir, 22), false, false);
                rk.k = models;
                id.a(config, (byte) 69, models);
                sb.a(models, (byte) 58, locs, true);
                qj.a(-2, npcs, models);
                bj.a(objs, -128, true, null, models);
                hf.a(seqs, bases, -124, frames);
                oa.a(49, config);
                mi.a(415013098, varbits);
                tk.a(config, (byte) -20);
                wf.a(metrics, sprites, true, models, interfaces);
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
            sounds.clear();
            String result = "ok";
            String extra = "";
            try {
                extra = run(t, n);
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Throwable e) {
                result = code(e);
                // The state at the throw is still compared.
                if (t[0].equals("loc") || t[0].equals("tick") || t[0].equals("model") || t[0].equals("build") || t[0].equals("draw") || t[0].equals("miny")) extra = " | " + entity(E[n[1]]);
                else if (t[0].equals("mask") || t[0].equals("gm") || t[0].equals("inv") || t[0].equals("gfx")) extra = " " + component(C) + ifState();
            }
            out.println(result + extra + " snd=" + String.join(";", sounds));
        }
        out.flush();
    }
}
