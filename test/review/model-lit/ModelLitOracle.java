import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.FileDescriptor;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;

// Differential oracle for nd (ModelLit) and fc (ModelLitImpl) of client.jar, with the statics the member map places on
// them (dd.r pickedCount, oc.m checkHover, pf.W pickedTypecodes, ud.d mouseY, rg.g mouseX, a.a quicksort). Compiled
// with javac next to client.jar (same unnamed package), so package-private members are used directly; fc's private
// members are read and (for the quicksort switch fc.Gb) written by reflection.
//
// argv[0] is a binary fixture: the bases archive (archive 1), the frames archive (archive 0) and the models archive
// (archive 7), each as (int len, reference table, int n, n x (int group, int len, group bytes)).
// stdin is the script, one operation per line; stdout has exactly one result line per operation: the result (ok or the
// Java exception the real code raised, unwrapped from the obfuscator's g), any return value, then " | "-separated field
// dumps. test/review/model-lit.test.ts runs the same script through the TS port.
class ModelLitOracle {
    static class Provider extends ud {
        db index;
        byte[][] groups;

        Provider(DataInputStream in) throws Exception {
            byte[] ref = in.readNBytes(in.readInt());
            index = new db(ref, q.a(0, ref, ref.length));
            groups = new byte[index.e][];
            for (int n = in.readInt(); n > 0; n--) {
                int group = in.readInt();
                groups[group] = in.readNBytes(in.readInt());
            }
        }

        db b(int ignored) { return index; }
        byte[] a(int mode, int group) { return groups[group]; }
        void b(int ignored, int group) {}
        int c(int group, int ignored) { return 100; }
    }

    // Fake textures, identical to model-lit.test.ts: ids divisible by 3 are 128x128, the rest 64x64.
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

    // fc instance fields (declaration order, minus the statics).
    static final String[] FIELDS = {
        "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "D", "E", "F", "G", "H",
        "I", "J", "K", "L", "M", "N", "Q", "R", "S", "U", "Y", "Z"
    };
    // fc's draw scratch, printed after every draw.
    static final String[] STATICS = {
        "Jb", "Cb", "Bb", "Fb", "rb", "Mb", "pb", "yb", "ib", "lb", "kb", "ub", "mb", "nb", "vb", "Hb", "tb", "wb", "Ab",
        "Db", "Eb", "qb", "gb", "sb", "Gb"
    };
    // The CopyForAnim scratch arrays (lengths only: their contents are the copied model's, dumped with it).
    static final String[] TEMPS = {"T", "P", "O", "X", "W", "db", "eb", "bb", "ab", "fb", "hb", "Lb", "Nb", "jb", "zb"};

    static Field[] fields;
    static Field ndJ;
    static Field[] statics, temps;
    static Field ob, Kb, xb, Ib, Gb, gb, sb;
    static al bases, frames, models;
    static int[] px;
    static final Textures textures = new Textures();
    static final cb[] unlit = new cb[16];
    static final fc[] lit = new fc[16];
    static final hf[] sets = new hf[64];
    static final int[][][] maps = new int[4][][];

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
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
        if (v instanceof Boolean b) return b ? "1" : "0";
        if (v instanceof fc) return "fc";
        return v.toString();
    }

    static String dump(fc model) throws Exception {
        if (model == null) return "nullmodel";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < fields.length; i++) sb.append(FIELDS[i]).append('=').append(value(fields[i].get(model))).append(' ');
        return sb.append("j=").append(value(ndJ.get(model))).toString();
    }

    static String origin() throws Exception {
        return " o=" + ob.getInt(null) + "," + Kb.getInt(null) + "," + xb.getInt(null) + "," + (Ib.getBoolean(null) ? 1 : 0);
    }

    static String scratch() throws Exception {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < statics.length; i++) sb.append(' ').append(STATICS[i]).append('=').append(value(statics[i].get(null)));
        sb.append(" hclip=").append(dc.j ? 1 : 0).append(" trans=").append(dc.e);
        sb.append(" picked=").append(dd.r);
        long[] w = pf.W;
        if (w == null) {
            sb.append(":null");
        } else {
            int h = 1;
            for (int i = 0; i < dd.r && i < w.length; i++) h = 31 * h + Long.hashCode(w[i]);
            sb.append(':').append(h);
        }
        return sb.append(" fb=").append(hash(px)).append(origin()).toString();
    }

    static String tempLengths() throws Exception {
        StringBuilder sb = new StringBuilder(" temps");
        for (int i = 0; i < temps.length; i++) {
            Object t = temps[i].get(null);
            sb.append(' ').append(TEMPS[i]).append('=').append(t == null ? "null" : String.valueOf(java.lang.reflect.Array.getLength(t)));
        }
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

    static int[] ints(String s) {
        if (s.equals("null")) return null;
        if (s.equals("-")) return new int[0];
        String[] p = s.split(",");
        int[] r = new int[p.length];
        for (int i = 0; i < p.length; i++) r[i] = Integer.parseInt(p[i]);
        return r;
    }

    static boolean[] bools(String s) {
        if (s.equals("null")) return null;
        if (s.equals("-")) return new boolean[0];
        boolean[] r = new boolean[s.length()];
        for (int i = 0; i < r.length; i++) r[i] = s.charAt(i) == '1';
        return r;
    }

    static hf set(int i) {
        return i < 0 ? null : sets[i];
    }

    static int[][] map(int i) {
        return i < 0 ? null : maps[i];
    }

    static cb unlitAt(int i) {
        return i < 0 ? null : unlit[i];
    }

    static void fill(int seed) {
        for (int i = 0; i < px.length; i++) px[i] = i * 0x2545F491 ^ seed * 0x27D4EB2F;
    }

    // a.a(I[III[I)V on a seeded array. Kept out of main() (HotSpot does not compile methods over 8000 bytecodes).
    static String quicksort(int n, int seed) {
        int[] keys = new int[n];
        int[] idx = new int[n];
        for (int i = 0; i < n; i++) {
            int v = i * 0x9E3779B1 ^ seed;
            v ^= v >>> 15;
            keys[i] = (v & 3) == 0 ? v & 7 : v % 1000;
            idx[i] = i;
        }
        a.a(1, keys, n - 1, 0, idx);
        return hash(keys) + " " + hash(idx);
    }

    // The statics this suite reads before touching anything, as the fresh JVM has them.
    static String initial() throws Exception {
        StringBuilder sb = new StringBuilder();
        sb.append(" W=").append(pf.W == null ? "null" : String.valueOf(pf.W.length));
        sb.append(" r=").append(dd.r).append(" m=").append(oc.m ? 1 : 0).append(" d=").append(ud.d).append(" g=").append(rg.g);
        sb.append(tempLengths());
        for (int i = 0; i < statics.length; i++) sb.append(' ').append(STATICS[i]).append('=').append(value(statics[i].get(null)));
        sb.append(origin());
        sb.append(" k=").append(value(field(fc.class, "k").get(null))).append(" V=").append(value(field(fc.class, "V").get(null)));
        sb.append(" cb=").append(value(field(fc.class, "cb").get(null)));
        return sb.toString();
    }

    static String run(String line, String[] t, int[] n) throws Exception {
        String extra = "";
        switch (t[0]) {
            case "init": return initial();
            case "load": {
                unlit[n[1]] = null;
                unlit[n[1]] = cb.a(models, n[2], 0);
                return unlit[n[1]] == null ? " null" : "";
            }
            case "comb": {
                cb[] parts = new cb[t.length - 2];
                for (int i = 0; i < parts.length; i++) parts[i] = unlitAt(n[i + 2]);
                unlit[n[1]] = null;
                unlit[n[1]] = new cb(parts, parts.length);
                return "";
            }
            case "ucopy": unlit[n[1]] = unlitAt(n[2]); return "";
            case "lcopy": lit[n[1]] = lit[n[2]]; return "";
            case "share": unlitAt(n[1]).a((ug) unlitAt(n[2]), n[3], n[4], n[5], n[6] != 0); return "";
            case "light": lit[n[1]] = null; lit[n[1]] = new fc(unlitAt(n[2]), n[3], n[4], n[5], n[6], n[7]); return "";
            case "lightb": lit[n[1]] = null; lit[n[1]] = (fc) unlitAt(n[2]).b(n[3], n[4], n[5], n[6], n[7]); return "";
            case "lightc": lit[n[1]] = null; lit[n[1]] = unlitAt(n[2]).c(n[3], n[4], n[5], n[6], n[7]); return "";
            case "lighta": lit[n[1]] = null; lit[n[1]] = (fc) unlitAt(n[2]).a(n[3], n[4], n[5]); return "";
            case "dump": return "";
            case "set": sets[n[1]] = new hf(frames, bases, n[2], false); return " " + sets[n[1]].E.length;
            case "trans": lit[n[1]].b(n[2], n[3], n[4]); return "";
            case "rot90": lit[n[1]].h(); return "";
            case "rot180": lit[n[1]].c(); return "";
            case "rot270": lit[n[1]].k(); return "";
            case "rotx": lit[n[1]].b(n[2]); return "";
            case "roty": lit[n[1]].c(n[2]); return "";
            case "rotz": lit[n[1]].a(n[2]); return "";
            case "resize": lit[n[1]].c(n[2], n[3], n[4]); return "";
            case "upd": lit[n[1]].a(n[2], n[3], n[4], n[5], n[6]); return "";
            case "all": lit[n[1]].a(n[2], n[3], n[4], n[5]); return origin();
            case "a2": lit[n[1]].a(n[2], ints(t[3]), n[4], n[5], n[6], n[7] != 0); return origin();
            case "a2m": lit[n[1]].a(n[2], ints(t[3]), n[4], n[5], n[6], n[7] != 0, n[8], ints(t[9])); return origin();
            case "begin": return " " + lit[n[1]].f() + origin();
            case "end": lit[n[1]].i(); return "";
            case "anim": lit[n[1]].a(set(n[2]), n[3], set(n[4]), n[5], n[6], n[7], n[8] != 0); return origin();
            case "split":
                lit[n[1]].a(set(n[2]), n[3], set(n[4]), n[5], n[6], n[7], set(n[8]), n[9], set(n[10]), n[11], n[12], n[13], bools(t[14]), n[15] != 0);
                return origin();
            case "animm": lit[n[1]].a(set(n[2]), n[3], set(n[4]), n[5], n[6], n[7], n[8], n[9] != 0, ints(t[10])); return origin();
            case "shadow": lit[n[1]].a(set(n[2]), n[3]); return origin();
            case "copya":
            case "copyb":
            case "copyc": {
                lit[n[1]] = null;
                nd r = t[0].equals("copya") ? lit[n[2]].a(n[3] != 0, n[4] != 0, n[5] != 0)
                    : t[0].equals("copyb") ? lit[n[2]].b(n[3] != 0, n[4] != 0, n[5] != 0)
                    : lit[n[2]].c(n[3] != 0, n[4] != 0, n[5] != 0);
                lit[n[1]] = (fc) r;
                return tempLengths();
            }
            case "hill": {
                fc r = lit[n[2]].a(n[3], n[4], map(n[5]), map(n[6]), n[7], n[8], n[9], n[10] != 0);
                extra = r == lit[n[2]] ? " same" : " new";
                lit[n[1]] = r;
                return extra;
            }
            case "tilt": lit[n[1]].a(map(n[2]), n[3], n[4], n[5], n[6], n[7]); return "";
            case "append": {
                // Both operands are read before the destination slot is cleared (append 6 6 6 doubles slot 6).
                fc src = lit[n[2]];
                fc other = n[3] < 0 ? null : lit[n[3]];
                lit[n[1]] = null;
                lit[n[1]] = (fc) src.a(other);
                return "";
            }
            case "bounds": {
                fc m = lit[n[1]];
                return " " + m.d() + " " + m.e() + " " + m.b() + " " + m.j() + " " + m.l() + " " + m.g();
            }
            case "aabb": lit[n[1]].j = n[2] != 0; return "";
            case "pick": oc.m = n[1] != 0; rg.g = n[2]; ud.d = n[3]; dd.r = n[4]; return "";
            case "pickarr": pf.W = n[1] < 0 ? null : new long[n[1]]; return "";
            case "cls": fill(n[1]); return "";
            case "view":
                td.b(n[1], n[2], n[3], n[4]);
                dc.d();
                if (t.length > 6) dc.c(n[5], n[6]);
                return " " + dc.f + "," + dc.b + "," + dc.p;
            case "ld": dc.a = n[1] != 0; return "";
            case "tp": dc.r = n[1] != 0 ? textures : null; return "";
            case "qsmode":
                Gb.setBoolean(null, n[1] != 0);
                if (n[1] != 0) {
                    gb.set(null, new int[4096]);
                    sb.set(null, new int[4096]);
                }
                return "";
            case "draw":
                lit[n[1]].a(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], Long.parseLong(t[10]), n[11], n[12] != 0 ? new ue() : null);
                return scratch();
            case "obj": lit[n[1]].a(n[2], n[3], n[4], n[5], n[6], n[7], n[8], Long.parseLong(t[9])); return scratch();
            case "ortho": lit[n[1]].b(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9]); return scratch();
            case "qs": return " " + quicksort(n[1], n[2]);
            case "unload": fc.m(); return "";
            default: throw new IllegalArgumentException(line);
        }
    }

    // Which slots an operation's result line dumps (after the call, whether it returned or threw).
    static int[] shows(String op, int[] n) {
        switch (op) {
            case "light": case "lightb": case "lightc": case "lighta": case "dump": case "trans": case "rot90": case "rot180":
            case "rot270": case "rotx": case "roty": case "rotz": case "resize": case "upd": case "all": case "a2": case "a2m":
            case "end": case "anim": case "split": case "animm": case "shadow": case "tilt": case "append": case "bounds":
                return new int[] {n[1]};
            case "copya": case "copyb": case "copyc": case "hill":
                return new int[] {n[1], n[2]};
            default:
                return new int[0];
        }
    }

    public static void main(String[] argv) throws Exception {
        Class<?> fcClass = fc.class;
        fields = new Field[FIELDS.length];
        for (int i = 0; i < FIELDS.length; i++) fields[i] = field(fcClass, FIELDS[i]);
        ndJ = field(nd.class, "j");
        statics = new Field[STATICS.length];
        for (int i = 0; i < STATICS.length; i++) statics[i] = field(fcClass, STATICS[i]);
        temps = new Field[TEMPS.length];
        for (int i = 0; i < TEMPS.length; i++) temps[i] = field(fcClass, TEMPS[i]);
        ob = field(fcClass, "ob");
        Kb = field(fcClass, "Kb");
        xb = field(fcClass, "xb");
        Ib = field(fcClass, "Ib");
        Gb = field(fcClass, "Gb");
        gb = field(fcClass, "gb");
        sb = field(fcClass, "sb");

        try (DataInputStream in = new DataInputStream(new BufferedInputStream(new FileInputStream(argv[0])))) {
            bases = new al(new Provider(in), false, false);
            frames = new al(new Provider(in), false, false);
            models = new al(new Provider(in), false, false);
        }

        // Heightmaps shared with model-lit.test.ts (the ModelUnlit suite's maps).
        maps[0] = new int[104][104];
        maps[1] = new int[104][104];
        maps[2] = new int[3][3];
        for (int x = 0; x < 104; x++) {
            for (int z = 0; z < 104; z++) {
                maps[0][x][z] = -((x * 37 + z * 91) % 400) - (x * z % 97) * 3;
                maps[1][x][z] = -((x * 53 + z * 17) % 700) - 200;
            }
        }
        for (int x = 0; x < 3; x++) for (int z = 0; z < 3; z++) maps[2][x][z] = -x * 40 - z * 7;
        // Flat at -200 with a bump at every even x, odd z.
        maps[3] = new int[104][104];
        for (int x = 0; x < 104; x++) for (int z = 0; z < 104; z++) maps[3][x][z] = (x & 1) == 0 && (z & 1) == 1 ? -230 : -200;

        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII));
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");

        // The first line ("init") prints the fresh statics before the setup below touches Pix3D.
        boolean setup = false;
        for (String line; (line = reader.readLine()) != null;) {
            if (!setup && !line.equals("init")) {
                // A 320x240 framebuffer with Pix3D clipped to it, a fixed colour table (brightness 0.8 without the
                // random jitter of dc.a(F)) and the fake textures.
                px = new int[320 * 240];
                td.a(px, 320, 240);
                dc.d();
                field(dc.class, "i").setFloat(null, 0.8F);
                Method colours = dc.class.getDeclaredMethod("b", int.class, int.class);
                colours.setAccessible(true);
                colours.invoke(null, 0, 512);
                dc.r = textures;
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
            StringBuilder sb = new StringBuilder(result).append(extra);
            for (int s : shows(t[0], n)) sb.append(" | ").append(dump(lit[s]));
            out.println(sb);
        }
        out.flush();
    }
}
