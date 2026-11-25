import java.lang.reflect.*;
import java.nio.ByteBuffer;
import java.util.*;

// Runs the original renderer members the HD window-mode switch (pm.a(ZIZIZII)V) and the shared rebuild (lb.a(Z)V)
// call, on the real classes of one gamepack, and prints every static or field they touch afterwards. modeswitch-apis.test.ts
// prints the same lines from the TS port. Pure reflection, so one source runs against either jar:
//   java -cp <dir>:runescape_gl.jar:jogl.jar HdModeSwitchApisOracle hd
//   java -cp <dir>:client.jar HdModeSwitchApisOracle sd
// Classes are initialized by their first reflective use, as the client's first use would; a few instances whose
// constructors need a cache (nk/kg, bj/ra, ...) are allocated without a constructor and given exactly the fields the
// member under test reads. Exceptions are reported by class (NegativeArraySize, NPE, AIOOBE), never swallowed silently.
class HdModeSwitchApisOracle {
    static boolean hd;
    static Object unsafe;
    static Method allocate;
    static final List<String> gl = new ArrayList<>();
    static int nextName;

    static Class<?> k(String name) throws Exception { return Class.forName(name); }

    static Field field(String owner, String name) throws Exception {
        Field f = k(owner).getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Object sget(String owner, String name) throws Exception { return field(owner, name).get(null); }
    static void sset(String owner, String name, Object value) throws Exception { field(owner, name).set(null, value); }
    static Object iget(Object o, String owner, String name) throws Exception { return field(owner, name).get(o); }
    static void iset(Object o, String owner, String name, Object value) throws Exception { field(owner, name).set(o, value); }

    static Object alloc(Class<?> type) throws Exception { return allocate.invoke(unsafe, type); }
    static Object alloc(String owner) throws Exception { return alloc(k(owner)); }

    static Method method(String owner, String name, Class<?>... params) throws Exception {
        Method m = k(owner).getDeclaredMethod(name, params);
        m.setAccessible(true);
        return m;
    }

    // Invokes and returns null, or the exception tag of what the method threw.
    static String call(Method m, Object target, Object... args) throws Exception {
        try {
            m.invoke(target, args);
            return null;
        } catch (InvocationTargetException e) {
            return tag(e.getCause());
        }
    }

    static String tag(Throwable t) {
        if (t instanceof NegativeArraySizeException) return "NegativeArraySize";
        if (t instanceof NullPointerException) return "NPE";
        if (t instanceof ArrayIndexOutOfBoundsException) return "AIOOBE";
        throw new RuntimeException("unexpected " + t, t);
    }

    // int[] / int[][] / byte[] / Object[] / Object[][] / Object[][][]: shape, non-null count and whether any int or
    // byte is non-zero.
    static String arr(Object a) {
        if (a == null) return "null";
        if (a instanceof int[] ints) {
            boolean dirty = false;
            for (int v : ints) dirty |= v != 0;
            return "I" + ints.length + (dirty ? "!" : "");
        }
        if (a instanceof byte[] bytes) {
            boolean dirty = false;
            for (byte v : bytes) dirty |= v != 0;
            return "B" + bytes.length + (dirty ? "!" : "");
        }
        if (a instanceof int[][] rows) {
            StringBuilder sb = new StringBuilder("I" + rows.length + "x");
            Set<String> cols = new TreeSet<>();
            boolean dirty = false;
            for (int[] row : rows) {
                if (row == null) { cols.add("null"); continue; }
                cols.add(String.valueOf(row.length));
                for (int v : row) dirty |= v != 0;
            }
            return sb.append(String.join("/", cols)).append(dirty ? "!" : "").toString();
        }
        Object[] objects = (Object[]) a;
        int nonNull = 0;
        for (Object o : objects) if (o != null) nonNull++;
        return "L" + objects.length + ":" + nonNull;
    }

    // Element-level summary of an object array of any depth: dims and non-null leaf count.
    static String deep(Object a) {
        if (a == null) return "null";
        List<Integer> dims = new ArrayList<>();
        Object probe = a;
        while (probe != null && probe.getClass().isArray()) {
            int n = Array.getLength(probe);
            dims.add(n);
            probe = n > 0 ? Array.get(probe, 0) : null;
        }
        return dims.toString().replace(" ", "") + ":" + leaves(a);
    }

    static int leaves(Object a) {
        if (a == null) return 0;
        if (!a.getClass().isArray()) return 1;
        int count = 0;
        for (int i = 0; i < Array.getLength(a); i++) count += leaves(Array.get(a, i));
        return count;
    }

    static String ident(Object now, Object before) {
        if (now == null) return "-";
        return now == before ? "s" : "n";
    }

    // Writes 1 into the first element of every array so a retained array would show as dirty.
    static void mark(Object a) {
        if (a instanceof int[] ints && ints.length > 0) ints[0] = 1;
        if (a instanceof int[][] rows && rows.length > 0 && rows[0] != null && rows[0].length > 0) rows[0][0] = 1;
    }

    // ---- ModelLitImpl: HD w.m()V / w.o()V; SD fc.<clinit> ----

    static String[] modelFields() {
        return hd ? new String[] {"w", "Ob", "Db", "Bb", "Sb", "yb", "Hb", "vb"}
                  : new String[] {"fc", "Gb", "gb", "sb", "ib", "lb", "kb", "ub"};
    }

    static Object[] modelArrays() throws Exception {
        String[] f = modelFields();
        Object[] out = new Object[6];
        for (int i = 0; i < 6; i++) out[i] = sget(f[0], f[i + 2]);
        return out;
    }

    static String modelState(String step, Object[] before) throws Exception {
        String[] f = modelFields();
        Object[] now = modelArrays();
        StringBuilder sb = new StringBuilder("model " + step + " q=" + sget(f[0], f[1]));
        String[] keys = {"d", "i", "c", "f", "xc", "xf"};
        for (int i = 0; i < 6; i++) sb.append(' ').append(keys[i]).append('=').append(arr(now[i]));
        sb.append(" ids=");
        for (int i = 0; i < 6; i++) sb.append(before == null ? (now[i] == null ? "-" : "n") : ident(now[i], before[i]));
        return sb.toString();
    }

    static void model() throws Exception {
        System.out.println(modelState("clinit", null));
        if (!hd) return;
        Method m = method("w", "m"), o = method("w", "o");
        String[] steps = {"m", "m", "o", "o", "m", "o"};
        for (String step : steps) {
            Object[] before = modelArrays();
            for (Object a : before) mark(a);
            String thrown = call(step.equals("m") ? m : o, null);
            if (thrown != null) throw new RuntimeException(step + " threw " + thrown);
            System.out.println(modelState(step, before));
        }
    }

    // ---- TextureCache: HD nk.k(II)V / nk.b(I)V; SD kg.a(I)V ----

    static String tcOwner() { return hd ? "nk" : "kg"; }
    static String lruOwner() { return hd ? "gn" : "vj"; }

    static Object newLru(int capacity) throws Exception {
        Constructor<?> c = k(lruOwner()).getDeclaredConstructor(int.class);
        c.setAccessible(true);
        return c.newInstance(capacity);
    }

    static void put(Object lru, long key) throws Exception {
        if (hd) {
            Constructor<?> c = k("rg").getDeclaredConstructor();
            c.setAccessible(true);
            // gn.a(Lrg;JB)V; -118 is a call-site byte (nk), whose -76 % ((b + 5) / 35) trap does not divide by zero.
            method("gn", "a", k("rg"), long.class, byte.class).invoke(lru, c.newInstance(), key, (byte) -118);
        } else {
            Constructor<?> c = k("ei").getDeclaredConstructor();
            c.setAccessible(true);
            // vj.a(JILei;)V: the int is the obfuscated 0 the remaining count is compared with.
            method("vj", "a", long.class, int.class, k("ei")).invoke(lru, key, 0, c.newInstance());
        }
    }

    static String lru(Object lru) throws Exception {
        if (lru == null) return "null";
        int size = (Integer) iget(lru, lruOwner(), hd ? "r" : "m");
        int remaining = (Integer) iget(lru, lruOwner(), hd ? "u" : "n");
        Object table = iget(lru, lruOwner(), hd ? "q" : "j");
        Object[] buckets = (Object[]) iget(table, hd ? "sc" : "nc", hd ? "c" : "n");
        String link = hd ? "d" : "g", linkOwner = hd ? "ab" : "jf";
        int entries = 0;
        for (Object sentinel : buckets) {
            for (Object node = iget(sentinel, linkOwner, link); node != sentinel; node = iget(node, linkOwner, link)) entries++;
        }
        Object head = hd ? method("gn", "a", int.class).invoke(lru, 0) : method("vj", "a", int.class).invoke(lru, 3);
        return "[size=" + size + " rem=" + remaining + " buckets=" + buckets.length + " entries=" + entries
            + " head=" + (head == null ? "null" : "set") + "]";
    }

    static String tcState(String step, Object cache, Object primaryBefore, Object secondaryBefore) throws Exception {
        String o = tcOwner();
        Object primary = iget(cache, o, hd ? "P" : "k");
        Object secondary = iget(cache, o, hd ? "G" : "J");
        return "tc " + step + " cap=" + iget(cache, o, hd ? "J" : "q")
            + " P=" + ident(primary, primaryBefore) + lru(primary)
            + " G=" + ident(secondary, secondaryBefore) + lru(secondary);
    }

    static void textureCache() throws Exception {
        String o = tcOwner();
        Object cache = alloc(o);
        iset(cache, o, hd ? "J" : "q", 7);
        iset(cache, o, hd ? "P" : "k", newLru(7));
        iset(cache, o, hd ? "G" : "J", null);
        Object p = iget(cache, o, hd ? "P" : "k");
        put(p, 1);
        put(p, 2);
        System.out.println(tcState("start", cache, p, null));
        if (hd) {
            Method setCapacity = method("nk", "k", int.class, int.class);
            sset("tf", "w", false);
            if (call(setCapacity, cache, 200, -1) != null) throw new RuntimeException("k");
            System.out.println(tcState("cap200-sw", cache, p, null));
            Object p1 = iget(cache, o, "P"), g1 = iget(cache, o, "G");
            sset("tf", "w", true);
            if (call(setCapacity, cache, 20, -1) != null) throw new RuntimeException("k");
            System.out.println(tcState("cap20-gl", cache, p1, g1));
            sset("tf", "w", false);
        } else {
            // No SD setCapacity: give kg the state HD reaches after nk.k(20, -1) with GL active.
            iset(cache, o, "q", 20);
            iset(cache, o, "k", newLru(20));
            iset(cache, o, "J", newLru(20));
        }
        Object p2 = iget(cache, o, hd ? "P" : "k"), g2 = iget(cache, o, hd ? "G" : "J");
        put(p2, 1); put(p2, 2); put(g2, 3); put(g2, 4); put(g2, 5);
        System.out.println(tcState("filled", cache, p2, g2));
        Method clear = hd ? method("nk", "b", int.class) : method("kg", "a", int.class);
        if (call(clear, cache, 0) != null) throw new RuntimeException("clear");
        System.out.println(tcState("clear", cache, p2, g2));
        iset(cache, o, hd ? "G" : "J", null);
        put(p2, 9);
        if (call(clear, cache, 0) != null) throw new RuntimeException("clear");
        System.out.println(tcState("clear-noG", cache, p2, null));
    }

    // ---- TerrainBatch: HD hg.a()V ----

    static String tbState(String step) throws Exception {
        StringBuilder sb = new StringBuilder("tb " + step);
        for (String f : new String[] {"U", "K", "Q", "J"}) sb.append(' ').append(f).append('=').append(sget("hg", f) == null ? "null" : "set");
        return sb.toString();
    }

    static void terrainBatch() throws Exception {
        if (!hd) return;
        System.out.println(tbState("clinit"));
        Constructor<?> packet = k("wa").getDeclaredConstructor(int.class);
        packet.setAccessible(true);
        sset("hg", "U", packet.newInstance(4));
        sset("hg", "K", packet.newInstance(8));
        sset("hg", "Q", ByteBuffer.allocateDirect(4));
        sset("hg", "J", ByteBuffer.allocateDirect(8));
        System.out.println(tbState("set"));
        if (call(method("hg", "a"), null) != null) throw new RuntimeException("hg.a");
        System.out.println(tbState("unload"));
    }

    // ---- world.ResetMap: SD ng.e()V / HD fc.a()V ----

    static String[] worldNames() {
        // main, maxX, maxZ, underwater, numOccluders, occluders, dynamicSprites, dynamicCount, spriteBuffer, kb, R
        return hd ? new String[] {"pm.cb", "ma.i", "hk.Y", "wh.c", "cd.s", "hc.O", "tk.D", "bl.T", "c.bb", "client.kb", "pk.R"}
                  : new String[] {"na.G", "tg.x", "qi.Y", "vf.V", "mc.P", "ll.c", "pa.xb", "ah.i", "dg.v"};
    }

    static Field wf(int i) throws Exception {
        String[] n = worldNames()[i].split("\\.");
        return field(n[0], n[1]);
    }

    static Object wget(int i) throws Exception { return wf(i).get(null); }
    static void wset(int i, Object v) throws Exception { wf(i).set(null, v); }

    static Class<?> leaf(Class<?> type) {
        while (type.isArray()) type = type.getComponentType();
        return type;
    }

    // An array of the field's type with the given dims, every leaf filled with an allocated element.
    static Object filled(int i, int... dims) throws Exception {
        Class<?> type = wf(i).getType();
        Object a = Array.newInstance(leaf(type), dims);
        fill(a, leaf(type), dims.length);
        return a;
    }

    static void fill(Object a, Class<?> leaf, int depth) throws Exception {
        for (int j = 0; j < Array.getLength(a); j++) {
            if (depth == 1) Array.set(a, j, alloc(leaf));
            else fill(Array.get(a, j), leaf, depth - 1);
        }
    }

    static Object partly(int i, int length, int count) throws Exception {
        Object a = Array.newInstance(leaf(wf(i).getType()), length);
        for (int j = 0; j < count; j++) Array.set(a, j, alloc(leaf(wf(i).getType())));
        return a;
    }

    static String worldState(String step, String thrown) throws Exception {
        StringBuilder sb = new StringBuilder("world " + step + (thrown == null ? "" : " threw " + thrown));
        sb.append(" main=").append(deep(wget(0))).append(" under=").append(deep(wget(3)));
        sb.append(" numOcc=").append(wget(4)).append(" occ=").append(deep(wget(5)));
        sb.append(" dyn=").append(deep(wget(6))).append(" dynCount=").append(wget(7)).append(" buf=").append(deep(wget(8)));
        if (hd) sb.append(" kb=").append(wget(9) == null ? "null" : "set").append(" R=").append(wget(10) == null ? "null" : "set");
        return sb.toString();
    }

    static void world() throws Exception {
        Method reset = hd ? method("fc", "a") : method("ng", "e");
        if (hd) System.out.println("world clinit kb=" + (wget(9) == null ? "null" : "set") + " R=" + (wget(10) == null ? "null" : "set"));
        // A: every array present, the tile loops bounded below the array sizes.
        wset(0, filled(0, 2, 4, 5)); wset(1, 3); wset(2, 4); wset(3, filled(3, 1, 4, 5));
        wset(4, 5); wset(5, partly(5, 10, 7)); wset(6, partly(6, 10, 6)); wset(7, 4); wset(8, partly(8, 3, 3));
        if (hd) { wset(9, Array.newInstance(wf(9).getType().getComponentType(), 4)); wset(10, Array.newInstance(wf(10).getType().getComponentType(), 1)); }
        System.out.println(worldState("A-before", null));
        System.out.println(worldState("A", call(reset, null)));
        // B: every array null.
        for (int i : new int[] {0, 3, 5, 6, 8}) wset(i, null);
        wset(4, 9); wset(7, 9);
        if (hd) { wset(9, Array.newInstance(wf(9).getType().getComponentType(), 4)); wset(10, Array.newInstance(wf(10).getType().getComponentType(), 1)); }
        System.out.println(worldState("B", call(reset, null)));
        // C: maxTileX beyond the main layer's rows: the first loop throws before the batch rows are nulled.
        wset(0, filled(0, 1, 2, 2)); wset(1, 3); wset(2, 2); wset(3, filled(3, 1, 2, 2));
        if (hd) { wset(9, Array.newInstance(wf(9).getType().getComponentType(), 4)); wset(10, Array.newInstance(wf(10).getType().getComponentType(), 1)); }
        System.out.println(worldState("C", call(reset, null)));
        // D: the underwater layer is the short one: the main rows clear, kb nulls, then the second loop throws.
        wset(0, filled(0, 1, 3, 2)); wset(1, 3); wset(2, 2); wset(3, filled(3, 1, 2, 2));
        if (hd) { wset(9, Array.newInstance(wf(9).getType().getComponentType(), 4)); wset(10, Array.newInstance(wf(10).getType().getComponentType(), 1)); }
        System.out.println(worldState("D", call(reset, null)));
    }

    // ---- GroundShadows: HD tj.a()V / tj.a(II)V (with wm.<init>()V and ek.<init>(III)V) ----

    static String pix8(Object p) throws Exception {
        if (p == null) return "null";
        String o = hd ? "ok" : "si";
        String e = hd ? "ek" : "ch";
        // width, height, cropW, cropH, xOffset, yOffset
        String[] f = hd ? new String[] {"a", "k", "l", "i", "m", "d"} : new String[] {"l", "n", "o", "c", "b", "j"};
        return "{w=" + iget(p, o, f[0]) + " h=" + iget(p, o, f[1]) + " cw=" + iget(p, o, f[2]) + " ch=" + iget(p, o, f[3])
            + " x=" + iget(p, o, f[4]) + " y=" + iget(p, o, f[5]) + " px=" + arr(iget(p, e, hd ? "o" : "y"))
            + " pal=" + arr(iget(p, e, hd ? "n" : "z")) + "}";
    }

    static String blocks(Object b) throws Exception {
        if (b == null) return "null";
        StringBuilder sb = new StringBuilder("[");
        Object[] rows = (Object[]) b;
        for (int x = 0; x < rows.length; x++) {
            if (x > 0) sb.append(';');
            Object[] row = (Object[]) rows[x];
            for (int z = 0; z < row.length; z++) {
                if (z > 0) sb.append(',');
                Object w = row[z];
                sb.append(w == null ? "null" : iget(w, "wm", "b") + "/" + iget(w, "wm", "h") + "/" + iget(w, "wm", "d"));
            }
        }
        return sb.append(']').toString();
    }

    static String gsState(String step, String thrown) throws Exception {
        return "gs " + step + (thrown == null ? "" : " threw " + thrown) + " e=" + sget("tj", "e") + " c=" + sget("tj", "c")
            + " a=" + pix8(sget("tj", "a")) + " d=" + arr(sget("tj", "d")) + " b=" + blocks(sget("tj", "b"))
            + " mem=" + sget("fa", "a") + " bound=" + sget("tf", "s");
    }

    static void flushGl() {
        for (String s : gl) System.out.println("gl " + s);
        gl.clear();
    }

    static Object proxyGl() throws Exception {
        Class<?> type = k("javax.media.opengl.GL");
        return Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[] {type}, (proxy, m, args) -> {
            StringBuilder sb = new StringBuilder(m.getName()).append('(');
            for (int i = 0; args != null && i < args.length; i++) {
                if (i > 0) sb.append(',');
                Object a = args[i];
                sb.append(a instanceof int[] ints ? "I[" + ints.length + "]" : String.valueOf(a));
            }
            gl.add(sb.append(')').toString());
            if (m.getName().equals("glGenTextures")) {
                int n = (Integer) args[0];
                int[] names = (int[]) args[1];
                int offset = (Integer) args[2];
                for (int i = 0; i < n; i++) names[offset + i] = nextName++;
            }
            Class<?> r = m.getReturnType();
            if (r == boolean.class) return false;
            if (r == int.class) return 0;
            if (r == void.class) return null;
            throw new RuntimeException("unexpected GL call " + m);
        });
    }

    static void groundShadows() throws Exception {
        if (!hd) return;
        Method init = method("tj", "a", int.class, int.class), unload = method("tj", "a");
        System.out.println(gsState("clinit", null));
        nextName = 1000;
        sset("tf", "t", proxyGl());
        sset("tf", "s", -1);
        sset("tj", "d", Array.newInstance(k("ek"), 2));
        int[][] sizes = {{104, 104}, {0, 0}, {1, 9}, {-9, 104}, {-9, -9}, {2147483647, 8}, {16, 8}};
        for (int[] size : sizes) {
            String thrown = call(init, null, size[0], size[1]);
            System.out.println(gsState("init " + size[0] + "x" + size[1], thrown));
            flushGl();
        }
        System.out.println(gsState("unload", call(unload, null)));
        // A null GL: the first block throws at glGenTextures, after the grid exists.
        sset("tf", "t", null);
        System.out.println(gsState("init-nogl 16x8", call(init, null, 16, 8)));
        System.out.println(gsState("unload", call(unload, null)));
    }

    // ---- Pix8: HD ek.<init>(III)V; both jars' 8-argument constructor ----

    static void pix8s() throws Exception {
        String e = hd ? "ek" : "ch";
        Constructor<?> eight = k(e).getDeclaredConstructor(int.class, int.class, int.class, int.class, int.class, int.class, byte[].class, int[].class);
        eight.setAccessible(true);
        System.out.println("pix8 ctor8 " + pix8(eight.newInstance(3, 4, 1, 2, 5, 6, new byte[30], new int[2])));
        if (!hd) return;
        Constructor<?> three = k("ek").getDeclaredConstructor(int.class, int.class, int.class);
        three.setAccessible(true);
        int[][] cases = {{5, 7, 3}, {0, 0, 0}, {1, 1, 256}, {-1, 5, 0}, {3, 4, -1}, {65536, 65536, 0}, {-3, -4, 2}};
        for (int[] c : cases) {
            String key = "pix8 ctor3 " + c[0] + "," + c[1] + "," + c[2] + " ";
            try {
                System.out.println(key + pix8(three.newInstance(c[0], c[1], c[2])));
            } catch (InvocationTargetException ex) {
                System.out.println(key + "threw " + tag(ex.getCause()));
            }
        }
    }

    // ---- GlModel: HD td.v()V (with td.<init>()V) ----

    static final String[] TEMP = {"bb", "jb", "mb", "nb", "ob", "pb"};

    static String models(String step, Object[] before) throws Exception {
        StringBuilder sb = new StringBuilder("glmodel " + step);
        Object[] now = new Object[6];
        for (int i = 0; i < 6; i++) now[i] = sget("td", TEMP[i]);
        Set<Object> distinct = Collections.newSetFromMap(new IdentityHashMap<>());
        for (int i = 0; i < 6; i++) {
            Object m = now[i];
            sb.append(' ').append(TEMP[i]).append('=');
            if (m == null) { sb.append("null"); continue; }
            distinct.add(m);
            sb.append(before == null ? "n" : ident(m, before[i])).append('{')
                .append(iget(m, "td", "u")).append(',').append(iget(m, "td", "I")).append(',').append(iget(m, "td", "S")).append(',')
                .append(iget(m, "td", "V")).append(',').append(iget(m, "td", "kb")).append(',').append(iget(m, "td", "lb")).append(',')
                .append(iget(m, "ak", "s")).append('}');
        }
        return sb.append(" distinct=").append(distinct.size()).toString();
    }

    static void glModel() throws Exception {
        if (!hd) return;
        System.out.println(models("clinit", null));
        Object[] before = new Object[6];
        for (int i = 0; i < 6; i++) {
            before[i] = sget("td", TEMP[i]);
            iset(before[i], "td", "I", 5);
            iset(before[i], "td", "lb", 9);
            iset(before[i], "td", "u", true);
            iset(before[i], "ak", "s", true);
        }
        if (call(method("td", "v"), null) != null) throw new RuntimeException("td.v");
        System.out.println(models("reset", before));
        Object[] again = new Object[6];
        for (int i = 0; i < 6; i++) again[i] = sget("td", TEMP[i]);
        if (call(method("td", "v"), null) != null) throw new RuntimeException("td.v");
        System.out.println(models("reset2", again));
    }

    // ---- PointLightManager: HD jf.<clinit> values of the two statics lb.a(Z)V clears ----

    static void pointLights() throws Exception {
        if (!hd) return;
        System.out.println("plm clinit a=" + arr(sget("jf", "a")) + " l=" + sget("jf", "l"));
    }

    public static void main(String[] args) throws Exception {
        hd = args[0].equals("hd");
        Class<?> u = Class.forName("sun.misc.Unsafe");
        Field singleton = u.getDeclaredField("theUnsafe");
        singleton.setAccessible(true);
        unsafe = singleton.get(null);
        allocate = u.getMethod("allocateInstance", Class.class);
        model();
        textureCache();
        terrainBatch();
        world();
        groundShadows();
        pix8s();
        glModel();
        pointLights();
    }
}
