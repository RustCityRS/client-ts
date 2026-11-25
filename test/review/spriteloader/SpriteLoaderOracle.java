import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;

// Differential oracle for the SpriteLoader logical class (the archive-8 sprite decoder og.a, the staging statics
// lc.q/ad.g/lh.g/qj.B/ff.s/jh.l/df.H/ke.m/vg.hb/tb.d/c.v, the builders df.d/ed.a/oc.a/p.a/pk.b/qd.b/vi.e/ud.a/rk.b/
// uk.b/tf.a, mk.c, the loaders ja.a/hl.a/gi.a/ha.a/ii.a/lc.a/ml.a/nh.a/oh.a/qc.a/sj.a/u.a/wb.a and wh.b).
//
// Compile it next to client.jar (javac -cp client.jar -d <dir>) and run it with "-cp client.jar<sep><dir>": it lives
// in the gamepack's runtime package and calls the obfuscated statics directly, passing each dummy argument a value
// one of the real call sites passes. Private sprite/font fields are read by reflection.
//
// Reads one operation per line on stdin and prints one line per operation:
//   <index> <op> <result> <value> <staging>
// result is ok, aioobe, npe, arith, neg or rt (a plain RuntimeException). od.a wraps most of these methods'
// exceptions in g; classify unwraps it. A throwing operation still reports the staging statics it left behind.
public class SpriteLoaderOracle {
    static final HashMap<Integer, byte[]> indexes = new HashMap<>();
    static final HashMap<Long, byte[]> groups = new HashMap<>();
    static final HashMap<Integer, al> archives = new HashMap<>();
    static Field chPalette;
    static Field mbC, mbH, mbK, mbP, mbR, mbY, mbBb, mbCb, mbHb, fgWb;

    // ud is the JS5 resource provider that al reads from; this one serves the containers the script supplied.
    static final class Provider extends ud {
        final int archive;

        Provider(int archive) {
            this.archive = archive;
        }

        byte[] a(int unused, int group) {
            return groups.get(((long) archive << 32) | group);
        }

        void b(int unused, int group) {
        }

        db b(int unused) {
            byte[] index = indexes.get(archive);
            return index == null ? null : new db(index, q.a(0, index, index.length));
        }

        int c(int group, int unused) {
            return 100;
        }
    }

    static byte[] bytes(String tok) {
        return tok.equals("n") ? null : Base64.getDecoder().decode(tok.substring(1));
    }

    static String ints(int[] a) {
        if (a == null) return "null";
        int h = 1;
        for (int v : a) h = h * 31 + v;
        return a.length + ":" + h;
    }

    static int planeHash(byte[] p) {
        int h = p.length;
        for (byte v : p) h = h * 31 + (v & 255);
        return h;
    }

    static String bytes(byte[] a) {
        return a == null ? "null" : String.valueOf(planeHash(a));
    }

    static String planes(byte[][] a) {
        if (a == null) return "null";
        int h = 1;
        for (byte[] p : a) h = h * 31 + (p == null ? 7 : planeHash(p));
        return a.length + ":" + h;
    }

    static String bools(boolean[] a) {
        if (a == null) return "null";
        int h = 1;
        for (boolean v : a) h = h * 31 + (v ? 2 : 1);
        return a.length + ":" + h;
    }

    static String staging() {
        return lc.q + "," + ad.g + "," + lh.g + " " + ints(qj.B) + " " + ints(ff.s) + " " + ints(jh.l) + " " + ints(df.H) + " "
            + ints(ke.m) + " " + planes(vg.hb) + " " + planes(tb.d) + " " + bools(c.v);
    }

    static String digest(Object o) throws Exception {
        if (o == null) return "null";
        if (o instanceof Boolean || o instanceof Integer) return o.toString();
        if (o instanceof Object[]) {
            StringBuilder b = new StringBuilder("[");
            Object[] a = (Object[]) o;
            for (int i = 0; i < a.length; i++) {
                if (i > 0) b.append(';');
                b.append(digest(a[i]));
            }
            return b.append(']').toString();
        }
        if (o instanceof rh) {
            rh s = (rh) o;
            return (o instanceof vh ? "vh:" : "rh:") + s.A + "," + s.B + "," + s.C + "," + s.D + "," + s.F + "," + s.O + "," + ints(s.I);
        }
        if (o instanceof ch) {
            ch s = (ch) o;
            return "ch:" + s.b + "," + s.c + "," + s.j + "," + s.l + "," + s.n + "," + s.o + "," + bytes(s.y) + "," + ints((int[]) chPalette.get(s));
        }
        if (o instanceof fg) {
            return "fg:" + mbC.getInt(o) + "," + mbHb.getInt(o) + "," + mbBb.getInt(o) + "," + ints((int[]) mbH.get(o)) + "," + ints((int[]) mbK.get(o)) + ","
                + ints((int[]) mbP.get(o)) + "," + ints((int[]) mbCb.get(o)) + "," + ints((int[]) mbY.get(o)) + "," + bytes((byte[]) mbR.get(o)) + ","
                + planes((byte[][]) fgWb.get(o));
        }
        throw new RuntimeException("unexpected value " + o.getClass());
    }

    static String classify(Throwable t) {
        if (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ArithmeticException) return "arith";
        if (t instanceof NegativeArraySizeException) return "neg";
        if (t.getClass() == RuntimeException.class) return "rt";
        throw new RuntimeException("unexpected exception", t);
    }

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static al archive(String tok) {
        return tok.equals("n") ? null : archives.get(Integer.parseInt(tok));
    }

    static Object run(String[] a) throws Exception {
        switch (a[0]) {
            case "idx":
                indexes.put(Integer.parseInt(a[1]), bytes(a[2]));
                return null;
            case "grp":
                groups.put(((long) Integer.parseInt(a[1]) << 32) | Integer.parseInt(a[2]), bytes(a[3]));
                return null;
            case "arch": {
                int id = Integer.parseInt(a[1]);
                archives.put(id, new al(new Provider(id), a[2].equals("1"), a[3].equals("1")));
                return null;
            }
            case "dec":
                og.a((byte) 55, bytes(a[1]));
                return null;
            case "clear":
                mk.c(false);
                return null;
            case "total":
                return wh.b(true);
            case "drop":
                switch (a[1]) {
                    case "q": lc.q = Integer.parseInt(a[2]); break;
                    case "X": qj.B = null; break;
                    case "Y": ff.s = null; break;
                    case "W": jh.l = null; break;
                    case "H": df.H = null; break;
                    case "P": ke.m = null; break;
                    case "pix": vg.hb = null; break;
                    case "alp": tb.d = null; break;
                    case "has": c.v = null; break;
                    case "pix0": vg.hb[0] = null; break;
                    case "alp0": tb.d[0] = null; break;
                    case "pal1": ke.m = new int[1]; break;
                    default: throw new RuntimeException("bad drop " + a[1]);
                }
                return null;
            case "build":
                switch (a[1]) {
                    case "df": return df.d((byte) 73);
                    case "ed": return ed.a(17100);
                    case "oc": return oc.a((byte) -62);
                    case "p": return p.a((byte) -10);
                    case "pk": return pk.b(255);
                    case "qd": return qd.b(86);
                    case "vi": return vi.e(74);
                    case "ud": return ud.a((byte) 57);
                    case "rk": return rk.b((byte) 120);
                    case "uk": return uk.b(Integer.parseInt(a[2]));
                    case "tf": return tf.a(bytes(a[2]), 174);
                    default: throw new RuntimeException("bad build " + a[1]);
                }
            case "ldr": {
                al arch = archive(a[2]);
                int x = Integer.parseInt(a[3]);
                int y = a.length > 4 ? Integer.parseInt(a[4]) : 0;
                switch (a[1]) {
                    case "ja": return ja.a((byte) -77, x, y, arch);
                    case "hl": return hl.a(arch, x, 101);
                    case "gi": return gi.a(x, arch, false, y);
                    case "ha": return ha.a(true, x, arch, y);
                    case "ii": return ii.a(-54, x, arch);
                    case "lc": return lc.a(arch, -110, x);
                    case "ml": return ml.a(arch, -13886, x, y);
                    case "nh": return nh.a(x, arch, 2048, y);
                    case "oh": return oh.a(x, arch, (byte) 75, y);
                    case "qc": return qc.a(x, arch, y, 3576);
                    case "sj": return sj.a(x, (byte) 113, arch);
                    case "u": return u.a(x, arch, 106);
                    case "wb": return wb.a(x, y, -1006411924, arch);
                    default: throw new RuntimeException("bad loader " + a[1]);
                }
            }
            default:
                throw new RuntimeException("bad op " + a[0]);
        }
    }

    public static void main(String[] args) throws Exception {
        chPalette = field(ch.class, "z");
        mbC = field(mb.class, "C");
        mbH = field(mb.class, "H");
        mbK = field(mb.class, "K");
        mbP = field(mb.class, "P");
        mbR = field(mb.class, "R");
        mbY = field(mb.class, "Y");
        mbBb = field(mb.class, "bb");
        mbCb = field(mb.class, "cb");
        mbHb = field(mb.class, "hb");
        fgWb = field(fg.class, "wb");

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.ISO_8859_1));
        StringBuilder out = new StringBuilder();
        String line;
        int index = 0;
        while ((line = in.readLine()) != null) {
            if (line.isEmpty()) continue;
            String[] a = line.split(" ");
            String result = "ok";
            String value = "-";
            try {
                value = digest(run(a));
            } catch (Throwable t) {
                result = classify(t);
            }
            out.append(index++).append(' ').append(a[0]).append(' ').append(result).append(' ').append(value).append(' ').append(staging()).append('\n');
        }
        System.out.print(out);
    }
}
