import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;

// Differential oracle for the SpriteLoader logical class, driven by ../spriteloader.test.ts.
//
// SpriteLoader has no obfuscated class of its own. Its members are statics scattered over the gamepack:
//   staging     lc.q ad.g lh.g qj.B ff.s jh.l df.H ke.m vg.hb tb.d c.v
//   group ids   di.l ef.w gg.E mi.D mj.a (written by ld.a(Lal;I)V at loading stage 40)
//   names       di.c ed.n gi.l me.k
//   HUD arrays  di.m gf.cb gg.H gh.N me.L (written by the stage-80 loader uf.a(Lal;I)V)
//   decoder     og.a(B[B)V, mk.c(Z)V
//   builders    df.d ed.a oc.a p.a pk.b qd.b vi.e ud.a rk.b uk.b tf.a
//   loaders     ja.a hl.a gi.a ha.a ii.a lc.a ml.a nh.a oh.a qc.a sj.a u.a wb.a, and wh.b
//
// Compile next to client.jar (javac -cp client.jar -d <dir>) and run with "-cp client.jar<sep><dir>". The class sits
// in the gamepack's (default) runtime package, so it calls the package-private statics directly. Every dummy argument
// gets a value one of the real call sites passes (see the comments in src/graphics/SpriteLoader.ts). Private
// fields (ch.z, the mb glyph tables, fg.wb) are read by reflection.
//
// One operation per stdin line, one output line per operation:
//   <index> <op> <result> <value> | <staging> | <ids>
// result is ok or the exception class (aioobe, npe, arith, neg, rt). od.a wraps most of these methods' exceptions in
// g; classify unwraps it to the real cause. A throwing operation still reports the statics it left behind.
// Each staging array is printed as <identity><length>:<hash>, where identity is '=' when it is the same object as after
// the previous operation and '*' when it is a different one, so reallocation versus reuse is compared too.
public class SpriteLoaderDiffOracle {
    static final HashMap<Integer, byte[]> indexes = new HashMap<>();
    static final HashMap<Long, byte[]> groups = new HashMap<>();
    static final HashMap<Integer, al> archives = new HashMap<>();
    static Field chZ, mbC, mbH, mbK, mbM, mbP, mbR, mbY, mbBb, mbCb, mbHb, mbIb, fgWb;
    static Object[] previous = new Object[11];

    // ud is the JS5 resource provider al reads from. This one serves the containers the script supplied.
    static final class Provider extends ud {
        final int source;

        Provider(int source) {
            this.source = source;
        }

        byte[] a(int unused, int group) {
            return groups.get(((long) source << 32) | group);
        }

        void b(int unused, int group) {
        }

        db b(int unused) {
            byte[] index = indexes.get(source);
            return index == null ? null : new db(index, q.a(0, index, index.length));
        }

        int c(int group, int unused) {
            return 100;
        }
    }

    static byte[] bytes(String tok) {
        return tok.equals("n") ? null : Base64.getDecoder().decode(tok.substring(1));
    }

    static String b64(byte[] value) {
        return value == null ? "null" : Base64.getEncoder().encodeToString(value);
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

    static String plane(byte[] a) {
        return a == null ? "null" : a.length + ":" + planeHash(a);
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

    static Object[] stagingArrays() {
        return new Object[] {qj.B, ff.s, jh.l, df.H, ke.m, vg.hb, tb.d, c.v};
    }

    static String staging() {
        Object[] now = stagingArrays();
        String[] text = {ints(qj.B), ints(ff.s), ints(jh.l), ints(df.H), ints(ke.m), planes(vg.hb), planes(tb.d), bools(c.v)};
        StringBuilder b = new StringBuilder();
        b.append(lc.q).append(',').append(ad.g).append(',').append(lh.g);
        for (int i = 0; i < now.length; i++) {
            b.append(' ');
            if (now[i] != null) b.append(now[i] == previous[i] ? '=' : '*');
            b.append(text[i]);
        }
        previous = now;
        return b.toString();
    }

    static String ids() {
        return di.l + "," + ef.w + "," + gg.E + "," + mi.D + "," + mj.a;
    }

    // Every SpriteLoader static, for the clinit line and the "statics" op.
    static String statics() throws Exception {
        return "q=" + lc.q + " g=" + ad.g + " h=" + lh.g + " X=" + ints(qj.B) + " Y=" + ints(ff.s) + " W=" + ints(jh.l) + " H=" + ints(df.H)
            + " P=" + ints(ke.m) + " pix=" + planes(vg.hb) + " alp=" + planes(tb.d) + " has=" + bools(c.v) + " ids=" + ids()
            + " names=" + b64(di.c.b(false)) + "," + b64(ed.n.b(false)) + "," + b64(gi.l.b(false)) + "," + b64(me.k.b(false))
            + " cross=" + digest(di.m, null) + " edge=" + digest(gf.cb, null) + " hitbar=" + digest(gg.H, null)
            + " mapfn=" + digest(gh.N, null) + " scroll=" + digest(me.L, null) + " total=" + wh.b(true);
    }

    // planesBefore/paletteBefore: vg.hb and ke.m as they were before a builder ran, to report whether the products
    // share those arrays (ch keeps the plane and the palette, fg keeps the plane array and the four int arrays).
    static String digest(Object o, Object[] before) throws Exception {
        if (o == null) return "null";
        if (o instanceof Boolean || o instanceof Integer) return o.toString();
        if (o instanceof Object[]) {
            StringBuilder b = new StringBuilder("[");
            Object[] a = (Object[]) o;
            for (int i = 0; i < a.length; i++) {
                if (i > 0) b.append(';');
                b.append(digestAt(a[i], before, i));
            }
            return b.append(']').toString();
        }
        return digestAt(o, before, 0);
    }

    static String digestAt(Object o, Object[] before, int frame) throws Exception {
        if (o == null) return "null";
        if (o instanceof rh) {
            rh s = (rh) o;
            return (o instanceof vh ? "vh:" : "rh:") + s.A + "," + s.B + "," + s.C + "," + s.D + "," + s.F + "," + s.O + "," + ints(s.I);
        }
        if (o instanceof ch) {
            ch s = (ch) o;
            int[] palette = (int[]) chZ.get(s);
            String alias = "";
            if (before != null) {
                byte[][] planes = (byte[][]) before[5];
                alias = "," + (planes != null && frame < planes.length && planes[frame] == s.y ? 'P' : '-') + (palette == before[4] ? 'C' : '-');
            }
            return "ch:" + s.b + "," + s.c + "," + s.j + "," + s.l + "," + s.n + "," + s.o + "," + plane(s.y) + "," + ints(palette) + alias;
        }
        if (o instanceof fg) {
            String alias = "";
            if (before != null) {
                alias = "," + (mbP.get(o) == before[0] ? 'X' : '-') + (mbK.get(o) == before[1] ? 'Y' : '-') + (mbCb.get(o) == before[2] ? 'W' : '-')
                    + (mbH.get(o) == before[3] ? 'H' : '-') + (fgWb.get(o) == before[5] ? 'M' : '-');
            }
            return "fg:" + mbC.getInt(o) + "," + mbHb.getInt(o) + "," + mbBb.getInt(o) + "," + ints((int[]) mbH.get(o)) + "," + ints((int[]) mbK.get(o)) + ","
                + ints((int[]) mbM.get(o)) + "," + ints((int[]) mbP.get(o)) + "," + ints((int[]) mbCb.get(o)) + "," + ints((int[]) mbY.get(o)) + ","
                + plane((byte[]) mbR.get(o)) + "," + (mbIb.get(o) == null ? "null" : "icons") + "," + planes((byte[][]) fgWb.get(o)) + alias;
        }
        throw new RuntimeException("unexpected value " + o.getClass());
    }

    static String classify(Throwable t) {
        while (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ArithmeticException) return "arith";
        if (t instanceof NegativeArraySizeException) return "neg";
        if (t.getClass() == RuntimeException.class) return "rt";
        throw new RuntimeException("unexpected exception", t);
    }

    static Field field(Class<?> owner, String name) throws Exception {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static al archive(String tok) {
        return tok.equals("n") ? null : archives.get(Integer.parseInt(tok));
    }

    // al.a(BLid;)I on a name built by aj.a(Ljava/lang/String;B)Lid; (dummies as the call sites pass them).
    static int groupByName(al arch, String name) {
        return arch.a((byte) 106, aj.a(name, (byte) -100));
    }

    static Object loader(String which, al arch, int x, int y) {
        switch (which) {
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
            case "fa": return fa.a(-123, arch, x, y);
            default: throw new IllegalStateException("bad loader " + which);
        }
    }

    // Where each loader takes its group id: in x (the group-first and id-only loaders) or in y (gi, oh and ja take
    // the file first).
    static boolean groupInY(String which) {
        return which.equals("ja") || which.equals("gi") || which.equals("oh");
    }

    static int framebufferHash(int[] buf) {
        int h = 1;
        for (int v : buf) h = h * 31 + v;
        return h;
    }

    // Draws every HUD sprite (draw and drawAlpha) into a fresh w*h td target and hashes it.
    static String drawHud(int w, int h) {
        int[] buf = new int[w * h];
        td.a(buf, w, h);
        Object[][] sets = {di.m, gf.cb, gg.H, gh.N, me.L};
        int k = 0;
        for (Object[] set : sets) {
            if (set == null) continue;
            for (Object s : set) {
                int x = (k * 37) % w - 8;
                int y = (k * 23) % h - 8;
                k++;
                if (s instanceof vc) {
                    ((vc) s).c(x, y);
                    ((vc) s).a(x + 5, y + 3, 128);
                } else if (s instanceof si) {
                    ((si) s).a(x, y);
                    ((si) s).a(x + 5, y + 3, 128);
                }
            }
        }
        return k + ":" + framebufferHash(buf);
    }

    static Object run(String[] a) throws Exception {
        switch (a[0]) {
            case "clinit":
            case "statics":
                return statics();
            case "idx":
                indexes.put(Integer.parseInt(a[1]), bytes(a[2]));
                return null;
            case "grp":
                groups.put(((long) Integer.parseInt(a[1]) << 32) | Integer.parseInt(a[2]), bytes(a[3]));
                return null;
            case "arch": {
                // arch <id> <source> <discardPacked> <discardUnpacked>
                archives.put(Integer.parseInt(a[1]), new al(new Provider(Integer.parseInt(a[2])), a[3].equals("1"), a[4].equals("1")));
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
                    case "has0": c.v[0] = !c.v[0]; break;
                    case "short": {
                        int n = Integer.parseInt(a[2]);
                        qj.B = java.util.Arrays.copyOf(qj.B, n);
                        ff.s = java.util.Arrays.copyOf(ff.s, n);
                        jh.l = java.util.Arrays.copyOf(jh.l, n);
                        df.H = java.util.Arrays.copyOf(df.H, n);
                        break;
                    }
                    default: throw new IllegalStateException("bad drop " + a[1]);
                }
                return null;
            case "build": {
                Object[] before = stagingArrays();
                Object value;
                switch (a[1]) {
                    case "df": value = df.d((byte) 73); break;
                    case "ed": value = ed.a(17100); break;
                    case "oc": value = oc.a((byte) -62); break;
                    case "p": value = p.a((byte) -10); break;
                    case "pk": value = pk.b(255); break;
                    case "qd": value = qd.b(86); break;
                    case "vi": value = vi.e(74); break;
                    case "ud": value = ud.a((byte) 57); break;
                    case "rk": value = rk.b((byte) 120); break;
                    case "uk": value = uk.b(Integer.parseInt(a[2])); break;
                    case "tf": value = tf.a(bytes(a[2]), 174); break;
                    default: throw new IllegalStateException("bad build " + a[1]);
                }
                return new Digested(digest(value, before));
            }
            case "ldr": {
                al arch = archive(a[2]);
                int x = Integer.parseInt(a[3]);
                int y = a.length > 4 ? Integer.parseInt(a[4]) : 0;
                return new Digested(digest(loader(a[1], arch, x, y), null));
            }
            case "ldrn": {
                // ldrn <loader> <archive> <name>: the group id comes from the name, the file is 0.
                al arch = archive(a[2]);
                int id = groupByName(arch, a[3]);
                Object value = groupInY(a[1]) ? loader(a[1], arch, 0, id) : loader(a[1], arch, id, 0);
                return new Digested(id + "=" + digest(value, null));
            }
            case "names": {
                al arch = archive(a[1]);
                ld.a(arch, 52);
                g.a(81, arch);
                pf.a(arch, -26442);
                return new Digested(ce.I + "," + vi.T + "," + bj.i + "," + jk.F + "," + ef.w + "," + bj.k + "," + di.l + "," + vj.s + "," + ij.o + "," + l.I
                    + "," + qe.jb + "," + ej.f + "," + gg.E + "," + q.j + "," + ik.X + "," + mj.a + "," + mi.D + "," + tj.l + "," + ed.a + "," + da.h + "," + wi.i);
            }
            case "stage80": {
                // uf.a(Lal;I)V's sprite loads, in its order, with its arguments. The four Math.random draws come from
                // the script; the font icon registrations (ma.b/wj.g/b.a) are not SpriteLoader's and are left out.
                al arch = archive(a[1]);
                int r7 = Integer.parseInt(a[2]);
                int r5 = Integer.parseInt(a[3]);
                int r8 = Integer.parseInt(a[4]);
                int r6 = Integer.parseInt(a[5]);
                StringBuilder b = new StringBuilder();
                rh[] mapfunction = ha.a(true, jk.F, arch, 0);
                b.append(digest(mapfunction, null)).append('/');
                b.append(digest(nh.a(ef.w, arch, 2048, 0), null)).append('/');
                gg.H = nh.a(bj.k, arch, 2048, 0);
                b.append(digest(nh.a(di.l, arch, 2048, 0), null)).append('/');
                b.append(digest(nh.a(vj.s, arch, 2048, 0), null)).append('/');
                b.append(digest(nh.a(ij.o, arch, 2048, 0), null)).append('/');
                b.append(digest(nh.a(l.I, arch, 2048, 0), null)).append('/');
                b.append(digest(ml.a(arch, -13886, qe.jb, 0), null)).append('/');
                di.m = oh.a(0, arch, (byte) 75, ej.f);
                b.append(digest(oh.a(0, arch, (byte) 70, gg.E), null)).append('/');
                me.L = wb.a(q.j, 0, -1006411924, arch);
                b.append(digest(wb.a(ik.X, 0, -1006411924, arch), null)).append('/');
                rh compass = fa.a(-123, arch, mi.D, 0);
                compass.c();
                b.append(digest(compass, null)).append('/');
                rh[] edges = ha.a(true, tj.l, arch, 0);
                for (int i = 0; i < edges.length; i++) edges[i].c();
                gf.cb = edges;
                for (int i = 0; i < mapfunction.length; i++) mapfunction[i].b(r8 + r5, r6 + r8, r7 + r8);
                gh.N = mapfunction;
                return new Digested(b.toString());
            }
            case "hud":
                return new Digested(digest(di.m, null) + "/" + digest(gf.cb, null) + "/" + digest(gg.H, null) + "/" + digest(gh.N, null) + "/"
                    + digest(me.L, null));
            case "drawhud":
                return new Digested(drawHud(Integer.parseInt(a[1]), Integer.parseInt(a[2])));
            case "font": {
                // font <sprites> <metrics> <group> <file>: sb.a(Lal;IIILal;)Lmb;, the stage-65 font loader.
                Object[] before = stagingArrays();
                return new Digested(digest(sb.a(archive(a[1]), Integer.parseInt(a[3]), Integer.parseInt(a[4]), 0, archive(a[2])), before));
            }
            case "hudset":
                // hudset <field> null: resets one HUD array.
                switch (a[1]) {
                    case "cross": di.m = null; break;
                    case "edge": gf.cb = null; break;
                    case "hitbar": gg.H = null; break;
                    case "mapfn": gh.N = null; break;
                    case "scroll": me.L = null; break;
                    default: throw new IllegalStateException("bad hud " + a[1]);
                }
                return null;
            default:
                throw new IllegalStateException("bad op " + a[0]);
        }
    }

    static final class Digested {
        final String text;

        Digested(String text) {
            this.text = text;
        }
    }

    public static void main(String[] args) throws Exception {
        chZ = field(ch.class, "z");
        mbC = field(mb.class, "C");
        mbH = field(mb.class, "H");
        mbK = field(mb.class, "K");
        mbM = field(mb.class, "M");
        mbP = field(mb.class, "P");
        mbR = field(mb.class, "R");
        mbY = field(mb.class, "Y");
        mbBb = field(mb.class, "bb");
        mbCb = field(mb.class, "cb");
        mbHb = field(mb.class, "hb");
        mbIb = field(mb.class, "ib");
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
                Object v = run(a);
                value = v instanceof Digested ? ((Digested) v).text : v instanceof String ? (String) v : digest(v, null);
            } catch (Throwable t) {
                result = classify(t);
            }
            out.append(index++).append(' ').append(a[0]).append(' ').append(result).append(' ').append(value).append(" | ").append(staging()).append(" | ")
                .append(ids()).append('\n');
        }
        System.out.print(out);
    }
}
