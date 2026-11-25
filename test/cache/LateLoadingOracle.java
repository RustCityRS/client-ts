import java.io.*;
import java.lang.reflect.*;
import java.util.*;

class LateLoadingOracle {
    static final int[] ids = {3, 5, 6, 8, 10, 12, 13, 23, 26};
    static final String[] slots = {"dd.l", "re.d", "al.l", "h.i", "ek.D", "il.B", "nf.j", "aa.d", "wh.X"};
    static final Map<Integer, byte[]> tables = new HashMap<>();
    static final Map<al, Input> providers = new IdentityHashMap<>();
    static final List<String> events = new ArrayList<>();
    static final id prefix = ml.k, percent = me.x, huffman = mc.v, details = ck.G;
    static final byte[] word = {0,0,0,0,1,1}, bad = {0,0,0,0,1,-1}, area = new byte[18];
    static String mode;
    static int target;
    static boolean changed;

    static int slot(int id) {
        for (int i = 0; i < ids.length; i++) if (id == ids[i]) return i;
        throw new AssertionError(id);
    }
    static void bind(int id, al ref) { LoadingOracle.Stage70.set(slots[slot(id)], ref); }
    static al archive(int id, String tag) {
        Input input = new Input(id, tag);
        al ref = new al(input, false, true);
        providers.put(ref, input);
        return ref;
    }
    static class Input extends ud {
        final int id;
        final String tag;
        final db table;
        Input(int id, String tag) {
            this.id = id;
            this.tag = tag;
            byte[] bytes = tables.get(id);
            this.table = new db(bytes, q.a(0, bytes, bytes.length));
        }
        db b(int dummy) {
            events.add("i"+tag);
            if (id == target) {
                if (mode.equals("throwIndex")) throw new IllegalStateException();
                if (mode.equals("pendingIndex")) return null;
                if (mode.equals("replaceIndex") && !changed) {
                    changed = true;
                    bind(id, archive(id, "r"+id));
                }
            }
            return table;
        }
        byte[] a(int priority, int group) {
            events.add("g"+tag+"/"+group);
            if (id == target) {
                if (mode.equals("replaceGroup") && !changed) {
                    changed = true;
                    bind(id, archive(id, "r"+id));
                }
                if (mode.equals("rename")) {
                    mc.v = ck.G = vb.a("missing", (byte)100);
                }
                if (mode.equals("bad")) return bad;
                if (mode.equals("waiting") || mode.equals("replaceGroup") && id != 10 && id != 23) return null;
                if (mode.equals("laterNull")) { il.B = null; return null; }
            }
            return id == 23 ? area : word;
        }
        int c(int group, int dummy) {
            events.add("p"+tag+"/"+group);
            ml.k = vb.a("new prefix", (byte)100);
            me.x = vb.a("tail", (byte)100);
            return tag.startsWith("r") ? 86 : -53;
        }
        void b(int dummy, int group) { throw new AssertionError(); }
    }

    public static void main(String[] args) throws Exception {
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (int id : ids) tables.put(id, Base64.getDecoder().decode(in.readLine()));
        area[4] = 13;
        Class<?> u = Class.forName("sun.misc.Unsafe");
        var uf = u.getDeclaredField("theUnsafe"); uf.setAccessible(true);
        client app = (client)u.getMethod("allocateInstance", Class.class).invoke(uf.get(null), client.class);
        Method load = client.class.getDeclaredMethod("f", byte.class); load.setAccessible(true);
        for (String line; (line = in.readLine()) != null;) {
            String[] fields = line.split(" ");
            bh.b = Integer.parseInt(fields[0]); mode = fields[1]; target = Integer.parseInt(fields[2]);
            changed = false;
            providers.clear();
            for (int id : ids) bind(id, id == target && mode.equals("null") ? null : archive(id, "a"+id));
            ml.k = prefix; me.x = percent; mc.v = huffman; ck.G = details;
            we.y = true; ga.D = 19; ie.A = vb.a("seed", (byte)100); ah.n = -19; qf.f = false;
            wi.i = 0; tj.m = null; ej.p = null;
            dd codec = mf.e = new dd(new byte[]{1});
            vb.d = mode.equals("noIcons") ? null : new rh[3];
            he.y = null; oe.y = new rh[2]; gl.w = new boolean[4];
            ba.d.b((byte)126);
            ba.d.a(new gh(mc.v, mc.v, 0, 0, 0, true, 0), false);
            events.clear();
            String result = "ok";
            try { load.invoke(app, (byte)110); }
            catch (InvocationTargetException e) {
                Throwable cause = e.getCause();
                while (cause instanceof g wrapped && wrapped.a != null) cause = wrapped.a;
                if (!(cause instanceof RuntimeException)) throw e;
                result = "exception";
            }
            StringJoiner names = new StringJoiner(",");
            for (int id : ids) {
                al ref = (al)LoadingOracle.Stage70.get(slots[slot(id)]);
                if (ref == null) names.add("null");
                else {
                    Input input = providers.get(ref);
                    names.add(input.tag + (input.table.f == null ? "-" : "f") + (input.table.m == null ? "-" : "g"));
                }
            }
            gh first = (gh)ba.d.d(0);
            System.out.println(String.join("|", line, result, String.join(",", events), names.toString(),
                bh.b+","+ga.D+","+Base64.getEncoder().encodeToString(ie.A.b(false)), ah.n+","+qf.f+","+(ej.p!=null)+","+(codec!=mf.e),
                (he.y==null?"null":providers.get(he.y).tag)+","+(oe.y==null?-1:oe.y.length)+","+gl.w.length+","+
                (first==null?"none":Base64.getEncoder().encodeToString(first.T.b(false)))));
        }
    }
}
