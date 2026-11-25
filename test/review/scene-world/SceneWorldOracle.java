import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
import java.util.Map;

// Differential oracle for the STATE half of the revision 530 scene graph: the TS class `world`
// (src/dash3d/world.ts) and its entities Square/Sprite/Occlude/Wall/Decor/GroundDecor/GroundObject/Ground/QuickGround
// (ra/ec/jg/hk/nf/pk/mh/kb/ma). Compiled into the jar's unnamed package (javac -cp client.jar), so it calls the
// package-private statics directly and subclasses ug.
//
// Reads one operation per line on stdin and prints exactly one line per operation:
//   <result>|<model calls>|<state diff>
// <result> is the return value (an entity is printed in full with its identity id), "ok" for void, or the Java
// exception (aioobe/npe/nase/arith; a g wrapper is unwrapped to its cause, though none of these routines has one).
// <model calls> is the ordered log of every call the scene graph made into the test models (TM).
// <state diff> is the change in the canonical state since the previous operation: every non-null square of the main
// and underwater layers (all fields, the ground and quick ground, every entity and every sprite with all their fields,
// the linked square nested), every occluder slot, active-occluder slot and dynamic-sprite slot, and one line of the
// remaining statics (sizes, array identities and content hashes). Each entry is printed as key=value whenever its value
// differs from the previous operation's (key=gone when it disappeared), so equal output means the whole state was equal
// after every operation. Objects and arrays get identity ids (#n) in the order they are first seen, so aliasing and
// object identity (the same Sprite on every tile it spans, a Del* returning the very entity it unlinked) are compared.
// scene-world.test.ts runs the same script through the TS port and compares the lines.
//
// Usage: javac -cp client.jar -d <dir> SceneWorldOracle.java
//        java -Djava.awt.headless=true -cp client.jar<sep><dir> SceneWorldOracle < script
class SceneWorldOracle {
    static final StringBuilder log = new StringBuilder();

    static void call(String token) {
        log.append(' ').append(token);
    }

    // A test model; its id fixes its behaviour: unlit when id < 1000 and id % 3 == 0 (light() returns a lit copy with id
    // + 1000), and getMinY is -32768 (none) when id % 7 == 0, positive when id % 11 == 0, else -((id * 37) % 400).
    static final class TM extends ug {
        final int id;

        TM(int id) {
            this.id = id;
        }

        void a(int yaw, int sinPitch, int cosPitch, int sinYaw, int cosYaw, int x, int y, int z, long typecode, int level, ue particles) {
            call("D" + id);
        }

        int b() {
            call("B" + id);
            if (id % 7 == 0) return -32768;
            if (id % 11 == 0) return 50 + id % 13;
            return -((id * 37) % 400);
        }

        void a(int arg0, int arg1, int arg2, int arg3, int arg4) {
            call("U" + id);
        }

        boolean a() {
            call("A" + id);
            return id < 1000 && id % 3 == 0;
        }

        ug a(int lx, int ly, int lz) {
            call("L" + id + "," + lx + "," + ly + "," + lz);
            return new TM(id + 1000);
        }

        void a(ug other, int ox, int oy, int oz, boolean hide) {
            call("M" + id + "," + ((TM) other).id + "," + ox + "," + oy + "," + oz + "," + (hide ? 1 : 0));
        }
    }

    static ug model(int id) {
        return id < 0 ? null : new TM(id);
    }

    static String mid(ug m) {
        return m == null ? "-" : "m" + ((TM) m).id;
    }

    // ---- identity ----

    static final IdentityHashMap<Object, Integer> ids = new IdentityHashMap<>();
    // Every sprite in the order it was first seen (delspr picks from it).
    static final ArrayList<ec> seenSprites = new ArrayList<>();

    static int id(Object o) {
        Integer i = ids.get(o);
        if (i == null) {
            i = ids.size();
            ids.put(o, i);
            if (o instanceof ec) seenSprites.add((ec) o);
        }
        return i;
    }

    static String ref(Object o) {
        return o == null ? "-" : "#" + id(o);
    }

    // ---- canonical descriptions ----

    static String hash(int[] a) {
        if (a == null) return "n";
        int h = 0;
        for (int v : a) h = 31 * h + v;
        return a.length + "~" + h;
    }

    static int hash2(int[][] a) {
        if (a == null) return -1;
        int h = 0;
        for (int[] row : a) {
            int r = 0;
            for (int v : row) r = 31 * r + v;
            h = 31 * h + r;
        }
        return h;
    }

    static int hash3(int[][][] a) {
        if (a == null) return -1;
        int h = 0;
        for (int[][] plane : a) h = 31 * h + hash2(plane);
        return h;
    }

    static int hash3(byte[][][] a) {
        if (a == null) return -1;
        int h = 0;
        for (byte[][] plane : a)
            for (byte[] row : plane)
                for (byte v : row) h = 31 * h + v;
        return h;
    }

    static int hash2(boolean[][] a) {
        if (a == null) return -1;
        int h = 0;
        for (boolean[] row : a)
            for (boolean v : row) h = 31 * h + (v ? 1 : 0);
        return h;
    }

    static String dims(Object[] a) {
        if (a == null) return "";
        StringBuilder sb = new StringBuilder("[").append(a.length);
        Object inner = a.length > 0 ? a[0] : null;
        while (inner != null) {
            if (inner instanceof Object[]) {
                Object[] x = (Object[]) inner;
                sb.append('x').append(x.length);
                inner = x.length > 0 ? x[0] : null;
            } else {
                if (inner instanceof int[]) sb.append('x').append(((int[]) inner).length);
                else if (inner instanceof byte[]) sb.append('x').append(((byte[]) inner).length);
                else if (inner instanceof boolean[]) sb.append('x').append(((boolean[]) inner).length);
                break;
            }
        }
        return sb.append(']').toString();
    }

    static String desc(Object o) {
        if (o == null) return "-";
        if (o instanceof hk) {
            hk w = (hk) o;
            return "W#" + id(w) + ":" + w.f + "," + w.h + "," + w.l + "," + w.m + "," + mid(w.i) + "," + mid(w.c) + "," + w.k + "," + w.j;
        }
        if (o instanceof nf) {
            nf d = (nf) o;
            return "N#" + id(d) + ":" + d.a + "," + d.d + "," + d.e + "," + d.b + "," + mid(d.i) + "," + mid(d.k) + "," + d.m + "," + d.g + "," + d.h + "," + d.l;
        }
        if (o instanceof pk) {
            pk g = (pk) o;
            return "G#" + id(g) + ":" + g.e + "," + g.g + "," + g.l + "," + g.a + "," + mid(g.d);
        }
        if (o instanceof mh) {
            mh s = (mh) o;
            return "O#" + id(s) + ":" + s.e + "," + s.l + "," + s.i + "," + s.a + "," + s.d + "," + mid(s.k) + "," + mid(s.b) + "," + mid(s.f);
        }
        if (o instanceof ec) {
            ec s = (ec) o;
            return "S#" + id(s) + ":" + s.u + "," + s.w + "," + s.c + "," + s.t + "," + s.s + "," + s.f + "," + s.a + "," + s.m + "," + s.n + "," + s.y + "," + s.r + "," + s.l + "," + mid(s.z);
        }
        if (o instanceof jg) {
            jg c = (jg) o;
            return "C#" + id(c) + ":" + c.d + "," + c.r + "," + c.m + "," + c.h + "," + c.A + "," + c.n + "," + c.c + "," + c.g + "," + c.i + "," + c.o + "," + c.a + "," + c.u + "," + c.e + "," + c.s + "," + c.f + "," + c.b + "," + c.j + "," + c.y;
        }
        if (o instanceof kb) {
            kb k = (kb) o;
            return "K#" + id(k) + ":" + k.m + "/" + k.a + "/" + (k.h ? 1 : 0) + "/" + k.l + "/" + k.n + "/" + hash(k.d) + "/" + hash(k.c) + "/" + hash(k.s) + "/" + hash(k.o) + "/" + hash(k.b) + "/" + hash(k.j) + "/" + hash(k.e) + "/" + hash(k.g) + "/" + hash(k.p) + "/" + hash(k.k);
        }
        if (o instanceof ma) {
            ma q = (ma) o;
            return "Q#" + id(q) + ":" + q.f + "," + q.c + "," + q.i + "," + q.h + "," + q.l + "," + q.m + "," + (q.d ? 1 : 0);
        }
        throw new IllegalStateException("desc " + o.getClass());
    }

    static String square(ra r, boolean nested) {
        if (r == null) return "n";
        StringBuilder sb = new StringBuilder();
        sb.append('#').append(id(r)).append(':').append(r.K).append(',').append(r.N).append(',').append(r.w).append(',').append(r.v);
        sb.append(",t").append(r.t).append(",P").append(r.P).append(",A");
        for (int i = 0; i < r.A.length; i++) sb.append(i == 0 ? "" : "/").append(r.A[i]);
        sb.append(',').append(r.B ? 1 : 0).append(r.J ? 1 : 0).append(r.E ? 1 : 0);
        sb.append(',').append(r.D).append(',').append(r.I).append(',').append(r.U).append(',').append(r.G);
        sb.append(',').append(desc(r.x)).append(',').append(desc(r.F));
        sb.append(',').append(desc(r.z)).append(',').append(desc(r.C)).append(',').append(desc(r.u)).append(',').append(desc(r.y));
        sb.append(",H").append(r.H.length).append('[');
        for (int i = 0; i < r.H.length; i++) sb.append(desc(r.H[i])).append(';');
        sb.append("],L");
        if (r.L == null) sb.append('-');
        else if (nested) sb.append('(').append(square(r.L, false)).append(')');
        else sb.append('#').append(id(r.L));
        sb.append(",k").append(r.k).append(r.g == null ? "" : "g").append(r.p == null ? "" : "p");
        return sb.toString();
    }

    static String statics() {
        StringBuilder sb = new StringBuilder();
        sb.append(tg.x).append(',').append(qi.Y).append(',').append(bf.u).append(',').append(ki.W).append(',').append(l.r);
        sb.append(" sq").append(ref(kl.Bb)).append(" G").append(ref(na.G)).append(dims(na.G)).append(" V").append(ref(vf.V)).append(dims(vf.V));
        sb.append(" hm").append(ref(ve.q)).append(" g").append(ref(lf.g)).append(dims(lf.g)).append(':').append(hash3(lf.g));
        sb.append(" S").append(ref(nh.S)).append(dims(nh.S)).append(':').append(hash3(nh.S));
        sb.append(" o").append(ref(ke.o)).append(dims(ke.o)).append(':').append(hash2(ke.o));
        sb.append(" P").append(ref(il.P)).append(dims(il.P)).append(':').append(hash3(il.P));
        sb.append(" c").append(ref(vb.c)).append(dims(vb.c)).append(':').append(hash3(vb.c));
        sb.append(" j").append(ref(tj.j)).append(dims(tj.j)).append(':').append(hash2(tj.j));
        sb.append(" hb").append(ref(client.hb)).append(dims(client.hb)).append(':').append(hash2(client.hb));
        sb.append(" occ").append(ref(ll.c)).append(ll.c == null ? "" : "[" + ll.c.length + "]").append(" n").append(mc.P);
        sb.append(" act").append(ref(uf.v)).append(uf.v == null ? "" : "[" + uf.v.length + "]").append(" n").append(rj.s);
        sb.append(" dyn").append(ref(pa.xb)).append(pa.xb == null ? "" : "[" + pa.xb.length + "]").append(" n").append(ah.i);
        sb.append(" sb").append(ref(dg.v));
        if (dg.v != null) {
            int count = 0;
            for (ec s : dg.v) if (s != null) count++;
            sb.append('[').append(dg.v.length).append(']').append(count);
        }
        sb.append(" f").append(af.O).append(',').append(la.kb).append(',').append(o.O ? 1 : 0).append(',').append(ak.j).append(',').append(oh.k).append(',').append(rc.b).append(',').append(si.t).append(',').append(hl.Y);
        return sb.toString();
    }

    // The canonical state as key -> value, in a fixed traversal order (which also fixes the order ids are handed out).
    static LinkedHashMap<String, String> state() {
        LinkedHashMap<String, String> cur = new LinkedHashMap<>();
        layer(cur, "M", na.G);
        layer(cur, "U", vf.V);
        if (ll.c != null) for (int i = 0; i < ll.c.length; i++) if (ll.c[i] != null) cur.put("C" + i, desc(ll.c[i]));
        if (uf.v != null) for (int i = 0; i < uf.v.length; i++) if (uf.v[i] != null) cur.put("A" + i, desc(uf.v[i]));
        if (pa.xb != null) for (int i = 0; i < pa.xb.length; i++) if (pa.xb[i] != null) cur.put("D" + i, desc(pa.xb[i]));
        cur.put("T", statics());
        return cur;
    }

    static void layer(Map<String, String> cur, String tag, ra[][][] squares) {
        if (squares == null) return;
        for (int level = 0; level < squares.length; level++)
            for (int x = 0; x < squares[level].length; x++)
                for (int z = 0; z < squares[level][x].length; z++) {
                    ra r = squares[level][x][z];
                    if (r != null) cur.put(tag + level + "," + x + "," + z, square(r, true));
                }
    }

    static LinkedHashMap<String, String> previous = new LinkedHashMap<>();

    static String diff() {
        LinkedHashMap<String, String> cur = state();
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : cur.entrySet()) {
            if (!e.getValue().equals(previous.get(e.getKey()))) sb.append(' ').append(e.getKey()).append('=').append(e.getValue());
        }
        for (String key : previous.keySet()) if (!cur.containsKey(key)) sb.append(' ').append(key).append("=gone");
        previous = cur;
        return sb.toString();
    }

    static String error(Throwable t) {
        if (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof NegativeArraySizeException) return "nase";
        if (t instanceof ArithmeticException) return "arith";
        return "ex:" + t.getClass().getName();
    }

    public static void main(String[] argv) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII));
        StringBuilder out = new StringBuilder();
        for (String line; (line = in.readLine()) != null;) {
            if (line.isEmpty()) continue;
            String[] f = line.split(" ");
            long[] a = new long[f.length - 1];
            for (int i = 1; i < f.length; i++) a[i - 1] = Long.parseLong(f[i]);
            int[] n = new int[a.length];
            for (int i = 0; i < a.length; i++) n[i] = (int) a[i];
            log.setLength(0);
            String result;
            try {
                result = run(f[0], n, a);
            } catch (RuntimeException e) {
                result = error(e);
            }
            out.append(result).append('|').append(log).append('|').append(diff()).append('\n');
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
            case "init":
                mc.a(n[0], n[1], n[2], n[3], n[4] != 0);
                return "ok";
            case "hm": {
                // Fixture: deterministic heights in both heightmaps (ShareLightLoc reads them).
                int seed = n[0];
                if (lf.g != null)
                    for (int level = 0; level < lf.g.length; level++)
                        for (int x = 0; x < lf.g[level].length; x++)
                            for (int z = 0; z < lf.g[level][x].length; z++) lf.g[level][x][z] = -(((x * 13 + z * 7 + seed) % 5) * 40) - level * 240;
                if (nh.S != null)
                    for (int x = 0; x < nh.S[0].length; x++)
                        for (int z = 0; z < nh.S[0][x].length; z++) nh.S[0][x][z] = -(((x * 11 + z * 5 + seed) % 4) * 30) + 100;
                return "ok";
            }
            case "wsk":
                // Fixture: the map loader's water sprite key for a tile.
                ke.o[n[0]][n[1]] = n[2];
                return "ok";
            case "under":
                wd.a(n[0] != 0);
                return "ok";
            case "reset":
                ng.e();
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
            case "fillspr": {
                // n[0] temporary 1x1 sprites on level n[1], one per tile in x-major order, wrapping over the map.
                int trues = 0;
                for (int i = 0; i < n[0]; i++) {
                    int x = i % tg.x;
                    int z = (i / tg.x) % qi.Y;
                    if (bc.a(n[1], x, z, 1, 1, x * 128 + 64, z * 128 + 64, -i, model(i + 100000), i & 2047, true, ((long) i << 32) | 0x40000000L)) trues++;
                }
                return Integer.toString(trues);
            }
            case "rmspr":
                q.a();
                return "ok";
            case "delspr": {
                // n >= 0: the (n mod count)-th sprite ever seen; n < 0: counted from the most recently seen one.
                if (seenSprites.isEmpty()) return "nosprite";
                int index = n[0] < 0 ? seenSprites.size() + n[0] : n[0] % seenSprites.size();
                if (index < 0) return "nosprite";
                bd.a(seenSprites.get(index));
                return "ok";
            }
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
            default:
                throw new IllegalStateException("unknown op " + op);
        }
    }
}
