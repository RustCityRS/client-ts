import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

// Differential oracle for the revision 530 scene graph (the TS class `world`, src/dash3d/world.ts). It is compiled
// into the jar's unnamed package (javac -cp client.jar), so it calls the package-private statics directly and can
// subclass ug and implement pc.
//
// Reads one operation per line on stdin and prints exactly one result line per operation: the result (or the Java
// exception), then '|' and the ordered log of every call the scene graph made into the test models (TM) and the
// texture provider (TP). world.test.ts runs the same script through the TS port and compares the lines.
// Run: javac -cp client.jar -d out WorldOracle.java && java -cp client.jar:out WorldOracle
class WorldOracle {
    static final StringBuilder log = new StringBuilder();

    static void call(String token) {
        log.append(' ').append(token);
    }

    // A test model. Its id fixes everything else: unlit when id % 3 == 0 (lit copies get id + 1000 and are lit), and
    // its lowest point is -32768 (none) when id % 7 == 0, else -((id * 37) % 400).
    static final class TM extends ug {
        final int id;
        final boolean unlit;
        final int minY;

        TM(int id) {
            this.id = id;
            this.unlit = id < 1000 && id % 3 == 0;
            this.minY = id % 7 == 0 ? -32768 : -((id * 37) % 400);
        }

        void a(int yaw, int sinPitch, int cosPitch, int sinYaw, int cosYaw, int x, int y, int z, long typecode, int level, ue particles) {
            call("D" + id + "," + yaw + "," + sinPitch + "," + cosPitch + "," + sinYaw + "," + cosYaw + "," + x + "," + y + "," + z + "," + typecode + "," + level + "," + (particles == null ? 0 : 1));
        }

        int b() {
            call("B" + id);
            return minY;
        }

        void a(int arg0, int arg1, int arg2, int arg3, int arg4) {
            call("U" + id + "," + arg0 + "," + arg1 + "," + arg2 + "," + arg3 + "," + arg4);
        }

        boolean a() {
            call("A" + id);
            return unlit;
        }

        ug a(int lx, int ly, int lz) {
            call("L" + id + "," + lx + "," + ly + "," + lz);
            return new TM(id + 1000);
        }

        void a(ug other, int ox, int oy, int oz, boolean hide) {
            call("M" + id + "," + ((TM) other).id + "," + ox + "," + oy + "," + oz + "," + (hide ? 1 : 0));
        }
    }

    static int texel(int id, int index) {
        return (id * 0x45d9f3b + index * 0x119de1f3) ^ (index >>> 3);
    }

    // The texture provider: even ids are 64x64, ids with id % 5 == 4 have no texels.
    static final class TP implements pc {
        public boolean a(int id, int dummy) {
            call("Ls" + id);
            return id % 2 == 0;
        }

        public boolean b(int dummy, int id) {
            call("Av" + id);
            return true;
        }

        public int[] c(int dummy, int id) {
            call("Gp" + id);
            return pixels(id);
        }

        public boolean a(int id, byte dummy) {
            call("Ld" + id);
            return true;
        }

        public int[] a(int id, float brightness, int dummy) {
            call("P" + id);
            return pixels(id);
        }

        public int a(byte dummy, int id) {
            call("V" + id);
            return (id * 911) & 0xffff;
        }

        public boolean d(int dummy, int id) {
            call("O" + id);
            return id % 3 != 0;
        }

        static int[] pixels(int id) {
            if (id % 5 == 4) return null;
            int[] texels = new int[id % 2 == 0 ? 4096 : 16384];
            for (int i = 0; i < texels.length; i++) texels[i] = texel(id, i);
            return texels;
        }
    }

    static ug model(int id) {
        return id < 0 ? null : new TM(id);
    }

    static String mid(ug model) {
        return model == null ? "-" : Integer.toString(((TM) model).id);
    }

    static String desc(Object o) {
        if (o == null) return "null";
        if (o instanceof hk) {
            hk w = (hk) o;
            return "W" + w.f + "," + w.h + "," + w.l + "," + w.m + "," + mid(w.i) + "," + mid(w.c) + "," + w.k + "," + w.j;
        }
        if (o instanceof nf) {
            nf d = (nf) o;
            return "N" + d.a + "," + d.d + "," + d.e + "," + d.b + "," + mid(d.i) + "," + mid(d.k) + "," + d.m + "," + d.g + "," + d.h + "," + d.l;
        }
        if (o instanceof pk) {
            pk g = (pk) o;
            return "G" + g.e + "," + g.g + "," + g.l + "," + g.a + "," + mid(g.d);
        }
        if (o instanceof mh) {
            mh s = (mh) o;
            return "O" + s.e + "," + s.l + "," + s.i + "," + s.a + "," + s.d + "," + mid(s.k) + "," + mid(s.b) + "," + mid(s.f);
        }
        if (o instanceof ec) {
            ec s = (ec) o;
            return "S" + s.u + "," + s.w + "," + s.c + "," + s.t + "," + s.s + "," + s.f + "," + s.a + "," + s.m + "," + s.n + "," + s.y + "," + s.r + "," + s.l + "," + mid(s.z);
        }
        if (o instanceof jg) {
            jg c = (jg) o;
            return "C" + c.d + "," + c.r + "," + c.m + "," + c.h + "," + c.A + "," + c.n + "," + c.c + "," + c.g + "," + c.i + "," + c.o + "," + c.a + "," + c.u + "," + c.e + "," + c.s + "," + c.f + "," + c.b + "," + c.j + "," + c.y;
        }
        throw new IllegalStateException("desc " + o.getClass());
    }

    static String square(ra r) {
        if (r == null) return "n";
        StringBuilder sb = new StringBuilder();
        sb.append(r.K).append(',').append(r.N).append(',').append(r.w).append(',').append(r.v).append(',').append(r.t).append(',').append(r.P);
        for (int i = 0; i < 5; i++) sb.append(',').append(r.A[i]);
        sb.append(',').append(r.B ? 1 : 0).append(r.J ? 1 : 0).append(r.E ? 1 : 0);
        sb.append(',').append(r.D).append(',').append(r.I).append(',').append(r.U).append(',').append(r.G);
        sb.append(",g").append(r.x == null ? "-" : r.x.m + "/" + r.x.a);
        sb.append(",q").append(r.F == null ? "-" : r.F.f + "/" + r.F.c + "/" + r.F.i + "/" + r.F.h + "/" + r.F.l + "/" + r.F.m + "/" + (r.F.d ? 1 : 0));
        sb.append(',').append(desc(r.z)).append(',').append(desc(r.C)).append(',').append(desc(r.u)).append(',').append(desc(r.y));
        sb.append(",H[");
        for (int i = 0; i < 5; i++) sb.append(desc(r.H[i])).append(';');
        sb.append(']');
        sb.append(",L").append(r.L == null ? "-" : r.L.K + "/" + r.L.w + "/" + r.L.v + (r.L.F != null ? "q" : "") + (r.L.x != null ? "k" : ""));
        return sb.toString();
    }

    static int squaresHash(ra[][][] squares) {
        if (squares == null) return -1;
        StringBuilder sb = new StringBuilder();
        for (int level = 0; level < squares.length; level++)
            for (int x = 0; x < squares[level].length; x++)
                for (int z = 0; z < squares[level][x].length; z++) sb.append(square(squares[level][x][z])).append('\n');
        return sb.toString().hashCode();
    }

    static int hash(int[] values) {
        if (values == null) return -1;
        int h = 0;
        for (int v : values) h = 31 * h + v;
        return h;
    }

    static int hash(int[][] values) {
        if (values == null) return -1;
        int h = 0;
        for (int[] row : values) h = 31 * h + hash(row);
        return h;
    }

    static int hash(int[][][] values) {
        if (values == null) return -1;
        int h = 0;
        for (int[][] plane : values) h = 31 * h + hash(plane);
        return h;
    }

    static int hash(boolean[][] values) {
        if (values == null) return -1;
        int h = 0;
        for (boolean[] row : values) for (boolean v : row) h = 31 * h + (v ? 1 : 0);
        return h;
    }

    static String statics() {
        StringBuilder sb = new StringBuilder();
        sb.append(af.O).append(' ').append(ah.i).append(' ').append(la.kb);
        sb.append(" e").append(lk.q).append(',').append(ea.l).append(',').append(rg.t).append(',').append(hh.Z).append(',').append(gf.W);
        sb.append(" b").append(ia.r).append(',').append(lh.f).append(',').append(pg.E).append(',').append(jl.k);
        sb.append(" c").append(tb.j).append(',').append(qf.a).append(',').append(wa.g).append(',').append(ph.n);
        sb.append(" p").append(o.O ? 1 : 0).append(',').append(ak.j).append(',').append(oh.k).append(',').append(rc.b).append(',').append(si.t).append(',').append(hl.Y);
        sb.append(" l").append(ki.W).append(',').append(l.r).append(',').append(kl.Bb == null ? "n" : kl.Bb == na.G ? "m" : kl.Bb == vf.V ? "u" : "?");
        sb.append(',').append(ve.q == null ? "n" : ve.q == lf.g ? "m" : ve.q == nh.S ? "u" : "?");
        sb.append(" s").append(bf.u).append(',').append(tg.x).append(',').append(qi.Y);
        sb.append(" o").append(mc.P).append(',').append(rj.s);
        for (int i = 0; i < mc.P && ll.c != null && i < ll.c.length; i++) sb.append(' ').append(desc(ll.c[i]));
        sb.append(" a");
        for (int i = 0; i < rj.s; i++) {
            int index = -1;
            for (int j = 0; j < mc.P; j++) if (ll.c[j] == uf.v[i]) index = j;
            sb.append(',').append(index);
        }
        sb.append(" h").append(hash(tj.j)).append(',').append(hash(client.hb)).append(',').append(hash(il.P)).append(',').append(hash(ke.o));
        sb.append(',').append(hash(lf.g)).append(',').append(hash(nh.S));
        sb.append(" d");
        if (pa.xb != null) for (int i = 0; i <= ah.i && i < pa.xb.length; i++) sb.append(desc(pa.xb[i])).append(';');
        sb.append(" v");
        if (dg.v != null) for (int i = 0; i < dg.v.length; i++) sb.append(dg.v[i] == null ? "-" : "s").append(dg.v[i] == null ? "" : Integer.toString(dg.v[i].l));
        sb.append(" x").append(dc.e).append(',').append(dc.j ? 1 : 0);
        sb.append(" q").append(v.F.c.g == v.F.c ? "empty" : "busy");
        return sb.toString();
    }

    static int[] ints(int[] a, int from, int count) {
        int[] out = new int[count];
        System.arraycopy(a, from, out, 0, count);
        return out;
    }

    static byte[][][] roofs;
    static int[] r2d = new int[64 * 64];

    public static void main(String[] argv) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII));
        StringBuilder out = new StringBuilder();
        for (String line; (line = in.readLine()) != null;) {
            if (line.isEmpty()) continue;
            String[] f = line.split(" ");
            String op = f[0];
            long[] a = new long[f.length - 1];
            for (int i = 1; i < f.length; i++) a[i - 1] = Long.parseLong(f[i]);
            int[] n = new int[a.length];
            for (int i = 0; i < a.length; i++) n[i] = (int) a[i];
            log.setLength(0);
            String result;
            try {
                result = run(op, n, a);
            } catch (ArrayIndexOutOfBoundsException e) {
                result = "aioobe";
            } catch (NullPointerException e) {
                result = "npe";
            } catch (NegativeArraySizeException e) {
                result = "nase";
            } catch (ArithmeticException e) {
                result = "arith";
            } catch (ClassCastException e) {
                result = "cce";
            }
            out.append(result).append('|').append(log).append('\n');
            if (out.length() > 1 << 20) {
                System.out.print(out);
                out.setLength(0);
            }
        }
        System.out.print(out);
        System.out.flush();
    }

    static String run(String op, int[] n, long[] a) {
        switch (op) {
            case "fb": {
                int width = n[0], height = n[1];
                td.g = new int[width * height];
                td.c = width;
                td.i = height;
                td.e = 0;
                td.b = 0;
                td.h = width;
                td.d = height;
                dc.d();
                int[] colours = new int[65536];
                for (int i = 0; i < colours.length; i++) colours[i] = (i * 0x9e3779b1) ^ (i << 7);
                dc.o = colours;
                dc.r = new TP();
                return "ok";
            }
            case "tex":
                lf.j = n[0] != 0;
                return "ok";
            case "init":
                mc.a(n[0], n[1], n[2], n[3], n[4] != 0);
                return "ok";
            case "hm": {
                int seed = n[0];
                for (int level = 0; level < lf.g.length; level++)
                    for (int x = 0; x < lf.g[level].length; x++)
                        for (int z = 0; z < lf.g[level][x].length; z++) lf.g[level][x][z] = -(((x * 13 + z * 7 + seed) % 5) * 40) - level * 240;
                if (nh.S != null)
                    for (int x = 0; x < nh.S[0].length; x++)
                        for (int z = 0; z < nh.S[0][x].length; z++) nh.S[0][x][z] = -(((x * 11 + z * 5 + seed) % 4) * 30) + 100;
                return "ok";
            }
            case "roofs": {
                roofs = new byte[n[0]][n[1]][n[2]];
                for (int level = 0; level < n[0]; level++)
                    for (int x = 0; x < n[1]; x++)
                        for (int z = 0; z < n[2]; z++) roofs[level][x][z] = (byte) (((x * 7 + z * 3 + level) % 5) - 1);
                return "ok";
            }
            case "reset":
                ng.e();
                return "ok";
            case "under":
                wd.a(n[0] != 0);
                return "ok";
            case "fbl":
                cf.a(n[0]);
                return "ok";
            case "push":
                fa.a(n[0], n[1]);
                return "ok";
            case "occ":
                og.a(n[0], n[1], n[2], n[3], n[4], n[5], n[6]);
                return "ok";
            case "ground":
                uk.a(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], n[10], n[11], n[12], n[13], n[14], n[15], n[16], n[17], n[18], n[19]);
                return "ok";
            case "gd":
                vf.a(n[0], n[1], n[2], n[3], model(n[4]), a[5], n[6] != 0);
                return "ok";
            case "obj":
                d.a(n[0], n[1], n[2], n[3], model(n[4]), a[5], model(n[6]), model(n[7]));
                return "ok";
            case "wall":
                ae.a(n[0], n[1], n[2], n[3], model(n[4]), model(n[5]), n[6], n[7], a[8]);
                return "ok";
            case "decor":
                ed.a(n[0], n[1], n[2], n[3], model(n[4]), model(n[5]), n[6], n[7], n[8], n[9], a[10]);
                return "ok";
            case "scen":
                return Boolean.toString(oe.a(n[0], n[1], n[2], n[3], n[4], n[5], model(n[6]), n[7], a[8]));
            case "dyn":
                return Boolean.toString(ob.a(n[0], n[1], n[2], n[3], n[4], model(n[5]), n[6], a[7], n[8] != 0));
            case "dyn2":
                return Boolean.toString(pa.a(n[0], n[1], n[2], n[3], model(n[4]), n[5], a[6], n[7], n[8], n[9], n[10]));
            case "spr":
                return Boolean.toString(bc.a(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7], model(n[8]), n[9], n[10] != 0, a[11]));
            case "rmspr":
                q.a();
                return "ok";
            case "movedecor":
                al.a(n[0], n[1], n[2], n[3]);
                return "ok";
            case "delwall":
                return desc(wb.a(n[0], n[1], n[2]));
            case "deldecor":
                return desc(le.a(n[0], n[1], n[2]));
            case "delloc":
                return desc(gl.a(n[0], n[1], n[2]));
            case "delgd":
                return desc(de.a(n[0], n[1], n[2]));
            case "delobj":
                return desc(bk.d(n[0], n[1], n[2]));
            case "getwall":
                return desc(oe.a(n[0], n[1], n[2]));
            case "getdecor":
                return desc(la.a(n[0], n[1], n[2]));
            case "getgd":
                return desc(pg.a(n[0], n[1], n[2]));
            case "getscene":
                return desc(qa.a(n[0], n[1], n[2]));
            case "walltype":
                return Long.toString(ke.b(n[0], n[1], n[2]));
            case "decortype":
                return Long.toString(gk.a(n[0], n[1], n[2]));
            case "scenetype":
                return Long.toString(j.a(n[0], n[1], n[2]));
            case "gdtype":
                return Long.toString(dd.a(n[0], n[1], n[2]));
            case "hastc":
                return Boolean.toString(je.a(n[0], n[1], n[2], a[3]));
            case "sharelight":
                mk.a(n[0], n[1], n[2]);
                return "ok";
            case "wtm":
                return Integer.toString(ob.a(n[0], -13520));
            case "tlc":
                return Integer.toString(nf.a(n[0], n[1]));
            case "tri":
                return Boolean.toString(le.a(n[0], n[1], n[2], n[3], n[4], n[5], n[6], n[7]));
            case "r2d":
                java.util.Arrays.fill(r2d, 5);
                try {
                    vg.a(r2d, n[3], n[4], n[0], n[1], n[2]);
                } finally {
                    call("r" + hash(r2d));
                }
                return "ok";
            case "r2dnull":
                vg.a(null, n[3], n[4], n[0], n[1], n[2]);
                return "ok";
            case "pick":
                sc.a(n[0], n[1], n[2]);
                return "ok";
            case "draw": {
                java.util.Arrays.fill(td.g, 0);
                int[][] hide = hideAreas(n[10]);
                try {
                    qc.a(n[0], n[1], n[2], n[3], n[4], n[5] != 0 ? roofs : null, hide[0], hide[1], hide[2], hide[3], hide[4], n[6], (byte) n[7], n[8], n[9]);
                } finally {
                    call("fb" + hash(td.g));
                }
                return "ok";
            }
            case "col":
                return Boolean.toString(q.a(n[0], n[1], n[2], n[3], n[4]));
            case "occluded":
                return Boolean.toString(tj.a(n[0], n[1], n[2]));
            case "gocc":
                return Boolean.toString(bh.a(n[0], n[1], n[2]));
            case "wocc":
                return Boolean.toString(wk.a(n[0], n[1], n[2], n[3]));
            case "socc":
                return Boolean.toString(cf.a(n[0], n[1], n[2], n[3]));
            case "lvis":
                return Boolean.toString(pe.a(n[0], n[1], n[2], n[3], n[4], n[5]));
            case "calc":
                ke.a();
                return "ok";
            case "fill": {
                ra square = kl.Bb[n[0]][n[1]][n[2]];
                p.a(square, n[3] != 0);
                return "ok";
            }
            case "dump":
                return "sq=" + squaresHash(na.G) + " uw=" + squaresHash(vf.V) + " " + statics();
            case "square":
                return square(kl.Bb[n[0]][n[1]][n[2]]);
            default:
                throw new IllegalStateException("unknown op " + op);
        }
    }

    // The five hidden-roof area arrays world.draw takes (y, min x, max x, max z, min z), by variant.
    static int[][] hideAreas(int variant) {
        if (variant == 0) return new int[5][];
        if (variant == 1) {
            return new int[][] {
                {-1000000, -200, -1000000},
                {0, 256, 0},
                {0, 900, 0},
                {0, 1200, 0},
                {0, 128, 0}
            };
        }
        return new int[][] {
            {-100, 50},
            {640, -5000},
            {1600, 5000},
            {1800, 5000},
            {256, -5000}
        };
    }
}
