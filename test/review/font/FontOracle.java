import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.Random;

// Java oracle for the Font unit: mb (Font), fg (SoftwareFont), ik.a(II)Lfg; with its cache fa.p, sb.a(Lal;IIILal;)Lmb;
// and the ag.k name icons. Compile it next to client.jar (javac -cp client.jar -d <dir>) and run it with
// "-cp client.jar<sep><dir>": it then lives in the gamepack's runtime package and calls the obfuscated members
// directly, reading private state by reflection. font.test.ts generates the script, feeds it on stdin, runs the
// same script through the TS port and compares the output line by line. Every script line prints exactly one line.
//
// Token encodings: text "n" = null, "t<base64>" = id built by setting id.A/id.c directly (so byte 0 is allowed);
// int[] "n" | "i<a,b,...>"; byte[] "n" | "b<base64>"; byte[][] "n" | "m<entry,...>" with entry "n" | "b<base64>";
// id[] "n" | "L<entry,...>" with entry "n" | "s<capacity>.<base64>".
// Dummy arguments: ik.a takes -1328 (its guard value) and sb.a takes 0 (its guard stores a static otherwise).
public class FontOracle {
    static final StringBuilder log = new StringBuilder();
    static final mb[] fonts = new mb[64];
    static final ArrayList<Object> seen = new ArrayList<>();
    static final HashMap<Integer, byte[]> indexes = new HashMap<>();
    static final HashMap<Long, byte[]> groups = new HashMap<>();
    static final HashMap<Integer, al> archives = new HashMap<>();
    static si[][] iconSets;
    static int[] pixels = new int[0];
    static final Random random = new Random(0L);

    static final class Sprite extends si {
        final int idx;

        Sprite(int idx, int w, int h) {
            this.idx = idx;
            this.o = w;
            this.c = h;
        }

        void a(int x, int y) {
            log.append('d').append(idx).append(',').append(x).append(',').append(y).append(';');
        }

        void a(int x, int y, int alpha) {
            log.append('a').append(idx).append(',').append(x).append(',').append(y).append(',').append(alpha).append(';');
        }
    }

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

    static si[][] makeIconSets() {
        return new si[][] {
            null,
            {new Sprite(0, 5, 7), new Sprite(1, 0, 3), null},
            {new Sprite(0, 13, 11), new Sprite(1, 8, 8), new Sprite(2, 1, 1), new Sprite(3, 20, 4), new Sprite(4, -3, 2)},
            {}
        };
    }

    static byte[] b64(String s) {
        return Base64.getDecoder().decode(s);
    }

    static id text(String tok) {
        if (tok.equals("n")) return null;
        byte[] b = b64(tok.substring(1));
        id s = new id();
        s.A = b;
        s.c = b.length;
        return s;
    }

    static int[] ints(String tok) {
        if (tok.equals("n")) return null;
        String body = tok.substring(1);
        if (body.isEmpty()) return new int[0];
        String[] parts = body.split(",", -1);
        int[] out = new int[parts.length];
        for (int i = 0; i < parts.length; i++) out[i] = Integer.parseInt(parts[i]);
        return out;
    }

    static byte[] bytes(String tok) {
        return tok.equals("n") ? null : b64(tok.substring(1));
    }

    static byte[][] masks(String tok) {
        if (tok.equals("n")) return null;
        String body = tok.substring(1);
        if (body.isEmpty()) return new byte[0][];
        String[] parts = body.split(",", -1);
        byte[][] out = new byte[parts.length][];
        for (int i = 0; i < parts.length; i++) out[i] = parts[i].equals("n") ? null : b64(parts[i].substring(1));
        return out;
    }

    static id[] lines(String tok) {
        if (tok.equals("n")) return null;
        String body = tok.substring(1);
        if (body.isEmpty()) return new id[0];
        String[] parts = body.split(",", -1);
        id[] out = new id[parts.length];
        for (int i = 0; i < parts.length; i++) {
            if (parts[i].equals("n")) continue;
            int dot = parts[i].indexOf('.');
            int cap = Integer.parseInt(parts[i].substring(1, dot));
            byte[] b = b64(parts[i].substring(dot + 1));
            id s = new id();
            s.A = new byte[cap];
            System.arraycopy(b, 0, s.A, 0, b.length);
            s.c = b.length;
            out[i] = s;
        }
        return out;
    }

    static int hash(int[] a) {
        if (a == null) return 7;
        int h = a.length;
        for (int v : a) h = h * 31 + v;
        return h;
    }

    static int hashBytes(byte[] a) {
        if (a == null) return 7;
        int h = a.length;
        for (byte v : a) h = h * 31 + v;
        return h;
    }

    static int hashMasks(byte[][] a) {
        if (a == null) return 7;
        int h = a.length;
        for (byte[] m : a) h = h * 31 + hashBytes(m);
        return h;
    }

    static String str(id s) {
        if (s == null) return "n";
        StringBuilder sb = new StringBuilder();
        int n = s.c;
        for (int i = 0; i < n; i++) {
            if (i > 0) sb.append('.');
            sb.append(s.A[i] & 255);
        }
        return "[" + sb + "]";
    }

    static int strHash(id s) {
        if (s == null) return 7;
        int h = s.c;
        for (int i = 0; i < s.c; i++) h = h * 31 + (s.A[i] & 255);
        return h;
    }

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    // The constant tag and entity strings, in mb.<clinit> order.
    static final String[] CONSTS = {"A", "O", "N", "U", "T", "V", "D", "Q", "E", "G", "W", "B", "S", "J", "gb", "fb", "db", "eb", "Z", "ab", "I", "X", "F", "jb", "kb"};

    static final String[] STATICS = {"lb", "ob", "pb", "qb", "sb", "rb", "tb", "mb", "nb", "ub"};

    static String statics() throws Exception {
        StringBuilder sb = new StringBuilder();
        for (String s : STATICS) sb.append(field(mb.class, s).getInt(null)).append(',');
        id[] vb = (id[]) field(mb.class, "vb").get(null);
        int h = vb.length;
        for (id s : vb) h = h * 31 + strHash(s);
        sb.append(h).append(',').append(strHash((id) field(mb.class, "L").get(null)));
        return sb.toString();
    }

    static String iconSetId(Object icons) {
        if (icons == null) return "n";
        for (int i = 1; i < iconSets.length; i++) if (iconSets[i] == icons) return Integer.toString(i);
        return "?";
    }

    static String fontLine(mb f) throws Exception {
        if (f == null) return "null";
        StringBuilder sb = new StringBuilder("F");
        sb.append(' ').append(f.C);
        sb.append(' ').append(field(mb.class, "hb").getInt(f));
        sb.append(' ').append(field(mb.class, "bb").getInt(f));
        sb.append(' ').append(hash((int[]) field(mb.class, "Y").get(f)));
        sb.append(' ').append(hashBytes((byte[]) field(mb.class, "R").get(f)));
        sb.append(' ').append(hash((int[]) field(mb.class, "P").get(f)));
        sb.append(' ').append(hash((int[]) field(mb.class, "K").get(f)));
        sb.append(' ').append(hash((int[]) field(mb.class, "cb").get(f)));
        sb.append(' ').append(hash((int[]) field(mb.class, "H").get(f)));
        sb.append(' ').append(hashMasks((byte[][]) field(fg.class, "wb").get(f)));
        sb.append(' ').append(iconSetId(field(mb.class, "ib").get(f)));
        sb.append(' ').append(hash((int[]) field(mb.class, "M").get(f)));
        return sb.toString();
    }

    static String err(Throwable t) {
        // od.a wraps a RuntimeException in g (the obfuscator's catch/rethrow, stripped from the port); classify the cause.
        while (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof NullPointerException) return "NPE";
        if (t instanceof ArrayIndexOutOfBoundsException || t instanceof NegativeArraySizeException || t instanceof StringIndexOutOfBoundsException) return "IDX";
        if (t instanceof IllegalArgumentException) return "IAE";
        if (t instanceof ArithmeticException) return "ARITH";
        return t.getClass().getName();
    }

    static String drawn(String res) throws Exception {
        return res + " S" + statics() + " P" + hash(pixels) + " L" + log;
    }

    static String run(String[] a) throws Exception {
        switch (a[0]) {
            case "idx":
                indexes.put(Integer.parseInt(a[1]), bytes(a[2]));
                return "ok";
            case "grp":
                groups.put(((long) Integer.parseInt(a[1]) << 32) | Integer.parseInt(a[2]), bytes(a[3]));
                return "ok";
            case "arch": {
                int archive = Integer.parseInt(a[1]);
                archives.put(archive, new al(new Provider(archive), a[2].equals("1"), a[3].equals("1")));
                return "ok";
            }
            case "synth":
                fonts[Integer.parseInt(a[1])] = null;
                fonts[Integer.parseInt(a[1])] = new fg(bytes(a[2]), ints(a[3]), ints(a[4]), ints(a[5]), ints(a[6]), masks(a[7]));
                return fontLine(fonts[Integer.parseInt(a[1])]);
            case "metrics":
                fonts[Integer.parseInt(a[1])] = null;
                fonts[Integer.parseInt(a[1])] = new fg(bytes(a[2]));
                return fontLine(fonts[Integer.parseInt(a[1])]);
            case "load": {
                al sprites = a[2].equals("n") ? null : archives.get(Integer.parseInt(a[2]));
                al metrics = a[5].equals("n") ? null : archives.get(Integer.parseInt(a[5]));
                mb f = sb.a(sprites, Integer.parseInt(a[3]), Integer.parseInt(a[4]), 0, metrics);
                fonts[Integer.parseInt(a[1])] = f;
                return fontLine(f);
            }
            case "fm": {
                fg f = ik.a(-1328, Integer.parseInt(a[2]));
                fonts[Integer.parseInt(a[1])] = f;
                int k = -1;
                for (int i = 0; i < seen.size(); i++) if (seen.get(i) == f) k = i;
                if (k == -1) {
                    k = seen.size();
                    seen.add(f);
                }
                return "#" + k + " " + fontLine(f);
            }
            case "fmreset":
                fa.p = new ve(Integer.parseInt(a[1]));
                return "ok";
            case "fmarchive":
                nf.j = a[1].equals("n") ? null : archives.get(Integer.parseInt(a[1]));
                return "ok";
            case "nameicons":
                ag.k = iconSets[Integer.parseInt(a[1])];
                return "ok";
            case "icons":
                fonts[Integer.parseInt(a[1])].a(iconSets[Integer.parseInt(a[2])], ints(a[3]));
                return "ok " + fontLine(fonts[Integer.parseInt(a[1])]);
            case "pix": {
                int w = Integer.parseInt(a[1]), h = Integer.parseInt(a[2]), seed = Integer.parseInt(a[3]);
                pixels = new int[w * h];
                for (int i = 0; i < pixels.length; i++) pixels[i] = ((i * 0x9E3779B1) ^ seed) & 0xFFFFFF;
                td.a(pixels, w, h);
                return "ok";
            }
            case "clip":
                td.b(Integer.parseInt(a[1]), Integer.parseInt(a[2]), Integer.parseInt(a[3]), Integer.parseInt(a[4]));
                return "ok " + td.e + "," + td.b + "," + td.h + "," + td.d;
            case "cliprst":
                td.c();
                return "ok " + td.e + "," + td.b + "," + td.h + "," + td.d;
            case "mask":
                td.a(ints(a[1]), ints(a[2]));
                return "ok";
            case "nomask":
                td.d();
                return "ok";
            case "escape":
                return drawn(str(mb.c(text(a[1]))));
            case "consts": {
                StringBuilder sb = new StringBuilder("C");
                for (String name : CONSTS) sb.append(' ').append(str((id) field(mb.class, name).get(null)));
                return sb.toString();
            }
            case "cacheinfo":
                return "c " + field(ve.class, "a").getInt(fa.p) + " " + field(ve.class, "p").getInt(fa.p);
            default:
                break;
        }

        mb f = fonts[Integer.parseInt(a[1])];
        fg g = (fg) f;
        log.setLength(0);
        String res;
        try {
            switch (a[0]) {
                case "left":
                    f.b(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]));
                    res = "v";
                    break;
                case "centre":
                    f.a(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]));
                    res = "v";
                    break;
                case "right":
                    f.c(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]));
                    res = "v";
                    break;
                case "para":
                    res = Integer.toString(f.a(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]), i(a[9]), i(a[10]), i(a[11])));
                    break;
                case "paraA":
                    res = Integer.toString(f.a(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]), i(a[9]), i(a[10]), i(a[11]), i(a[12])));
                    break;
                case "wave":
                    f.b(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]));
                    res = "v";
                    break;
                case "wave2":
                    f.a(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]));
                    res = "v";
                    break;
                case "shake":
                    f.a(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]));
                    res = "v";
                    break;
                case "rand":
                    res = Integer.toString(f.a(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), a[7].equals("n") ? null : random, i(a[8])));
                    break;
                case "randA": {
                    int[] bounds = ints(a[13]);
                    res = f.a(text(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]), i(a[9]), i(a[10]), a[11].equals("n") ? null : random, i(a[12]), bounds)
                        + ":" + (bounds == null ? "n" : bounds[0] + "," + bounds[1] + "," + bounds[2] + "," + bounds[3]);
                    break;
                }
                case "width":
                    res = Integer.toString(f.b(text(a[2])));
                    break;
                case "lines":
                    res = Integer.toString(f.a(text(a[2]), i(a[3])));
                    break;
                case "pwidth":
                    res = Integer.toString(f.b(text(a[2]), i(a[3])));
                    break;
                case "split": {
                    id[] out = lines(a[4]);
                    StringBuilder sb = new StringBuilder();
                    try {
                        sb.append(f.a(text(a[2]), ints(a[3]), out));
                    } catch (Throwable t) {
                        sb.append(err(t));
                    }
                    if (out != null) for (id s : out) sb.append(':').append(str(s));
                    res = sb.toString();
                    break;
                }
                case "glyph":
                    g.a(i(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), a[8].equals("1"));
                    res = "v";
                    break;
                case "glyphA":
                    g.a(i(a[2]), i(a[3]), i(a[4]), i(a[5]), i(a[6]), i(a[7]), i(a[8]), a[9].equals("1"));
                    res = "v";
                    break;
                default:
                    throw new IllegalStateException("unknown op " + a[0]);
            }
        } catch (IllegalStateException e) {
            throw e;
        } catch (Throwable t) {
            res = err(t);
        }
        return drawn(res);
    }

    static int i(String s) {
        return Integer.parseInt(s);
    }

    public static void main(String[] args) throws Exception {
        iconSets = makeIconSets();
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "ISO-8859-1"), 1 << 20);
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = in.readLine()) != null) {
            if (line.isEmpty()) continue;
            String res;
            try {
                res = run(line.split(" ", -1));
            } catch (IllegalStateException e) {
                throw e;
            } catch (Throwable t) {
                res = "ERR " + err(t);
            }
            out.append(res).append('\n');
        }
        System.out.print(out);
        System.out.flush();
    }
}
