import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;

// Differential oracle for unit anim of client.jar: hf (AnimFrameSet), of (AnimFrame), ok (AnimBase) and the statics
// the member map places on them: gb.a (get), bh.a (Load), gl.x (frameset cache), uk.d / ef.K (bases / frames archives),
// the of temp tables (of.a/c/d/g/k/o), of.a() (unload) and ok.a(II)I (or). Compiled next to client.jar (same unnamed
// package), so package-private members are used directly; the private of statics and ve.p go through reflection.
//
// args[0]: fixture (DataInputStream): int archiveCount; per archive: int len + JS5 reference table (container),
//          int groupCount, then per group: int id, int len + group container. Each archive is a real al over a
//          provider that serves those bytes (and null for a group marked unavailable).
// stdin:   one op per line; stdout: one line per op (the result, or the root exception under the g wrappers).
//   fields                                  declared fields of hf, of, ok (name:descriptor, s = static)
//   bases <a> | frames <a>                  uk.d / ef.K = archive a (-1 = null)
//   avail <a> <group> <0|1>                 provider of archive a serves / withholds group
//   get <group> <full>                      gb.a(100, group): new | same (identity vs the last set this group got) | null
//                                           (get, load and ctor lines end with " # " and the of temp table hashes)
//   load <basesA> <flag> <framesA> <group> <full>   bh.a(bases, flag, frames, -128, group)
//   ctor <framesA> <basesA> <group> <flag> <full>   new hf(frames, bases, group, flag)
//   acc <idx>                               hf.a(1, idx) (colours) and hf.a((byte) 98, idx) (transparencies) on the
//                                           last set that get/load/ctor produced
//   cache                                   gl.x: ve.p (remaining) and ve.b((byte) -14) (hard count)
//   reset                                   gl.x.a(0)
//   log                                     the provider calls of every archive since the last log, then cleared:
//                                           i = index, g<mode>:<group> = group data, p = prefetch, c = percentage
//   frame <base> <baseId> <frame>           new ok(baseId, base) then new of(frame, ok): base "-" = no ok object,
//                                           "N" = null bytes, "x<hex>" = bytes; frame "N" or "x<hex>". Ends with the
//                                           hash of each of temp table
//   unload                                  of.a()
//   or <a> <b>                              ok.a(a, b)
class ModelAnimOracle {
    static class Provider extends ud {
        final db index;
        final HashMap<Integer, byte[]> groups = new HashMap<>();
        final HashSet<Integer> withheld = new HashSet<>();
        final ArrayList<String> calls = new ArrayList<>();

        Provider(DataInputStream in) throws Exception {
            byte[] ref = in.readNBytes(in.readInt());
            index = new db(ref, q.a(0, ref, ref.length));
            for (int n = in.readInt(); n > 0; n--) {
                int group = in.readInt();
                groups.put(group, in.readNBytes(in.readInt()));
            }
        }

        db b(int ignored) { calls.add("i"); return index; }
        byte[] a(int mode, int group) { calls.add("g" + mode + ":" + group); return withheld.contains(group) ? null : groups.get(group); }
        void b(int ignored, int group) { calls.add("p"); }
        int c(int group, int ignored) { calls.add("c"); return 100; }
    }

    static Provider[] providers;
    static al[] archives;
    static final HashMap<Integer, hf> lastByGroup = new HashMap<>();
    static hf current;

    static al archive(String s) {
        int a = Integer.parseInt(s);
        return a < 0 ? null : archives[a];
    }

    // ---- hashing / formatting (identical in model-anim.test.ts) ----

    static int h;

    static void mix(int v) { h = h * 31 + v; }
    static void mixShorts(short[] a) { mix(a.length); for (short v : a) mix(v); }
    static void mixBytes(byte[] a) { mix(a.length); for (byte v : a) mix(v); }
    static void mixInts(int[] a) {
        if (a == null) { mix(-1); return; }
        mix(a.length);
        for (int v : a) mix(v);
    }
    static void mixBools(boolean[] a) { mix(a.length); for (boolean v : a) mix(v ? 1 : 0); }

    static String list(short[] a) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i]);
        return sb.append(']').toString();
    }
    static String list(byte[] a) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i]);
        return sb.append(']').toString();
    }
    static String list(int[] a) {
        if (a == null) return "null";
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i]);
        return sb.append(']').toString();
    }
    static String list(boolean[] a) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i] ? 1 : 0);
        return sb.append(']').toString();
    }

    static String base(ok b) {
        StringBuilder sb = new StringBuilder();
        sb.append("id=").append(b.B).append(" y=").append(b.y).append(" E=").append(list(b.E)).append(" H=").append(list(b.H));
        sb.append(" w=").append(list(b.w)).append(" v=");
        if (b.v == null) return sb.append("null").toString();
        sb.append('[');
        for (int i = 0; i < b.v.length; i++) sb.append(i > 0 ? "," : "").append(list(b.v[i]));
        return sb.append(']').toString();
    }

    static String frame(of f) {
        return "b=" + f.b + " f=" + (f.f ? 1 : 0) + " m=" + (f.m ? 1 : 0) + " i=" + list(f.i) + " h=" + list(f.h) + " j=" + list(f.j)
                + " p=" + list(f.p) + " e=" + list(f.e) + " n=" + list(f.n);
    }

    static String accessor(hf set, int i) {
        String c, t;
        try { c = set.a(1, i) ? "1" : "0"; } catch (Throwable e) { c = ex(e); }
        try { t = set.a((byte) 98, i) ? "1" : "0"; } catch (Throwable e) { t = ex(e); }
        return c + t;
    }

    // A set: either per-field hashes over every frame (element-wise) or the full element-wise dump.
    static String set(hf set, boolean full) {
        if (set == null) return "null";
        of[] frames = set.E;
        IdentityHashMap<ok, Integer> firstUse = new IdentityHashMap<>();
        List<ok> distinct = new ArrayList<>();
        int nonNull = 0;
        for (int i = 0; i < frames.length; i++) {
            of f = frames[i];
            if (f == null) continue;
            nonNull++;
            if (f.l != null && !firstUse.containsKey(f.l)) {
                firstUse.put(f.l, i);
                distinct.add(f.l);
            }
        }
        StringBuilder sb = new StringBuilder();
        sb.append("set ").append(frames.length).append(' ').append(nonNull).append(' ').append(distinct.size());
        if (full) {
            for (int i = 0; i < frames.length; i++) {
                of f = frames[i];
                sb.append(" | ").append(i).append(':');
                if (f == null) { sb.append("null"); continue; }
                sb.append(frame(f)).append(" acc=").append(accessor(set, i)).append(" l=").append(f.l == null ? -1 : firstUse.get(f.l));
            }
            sb.append(" ||");
            for (int k = 0; k < distinct.size(); k++) sb.append(" | b").append(k).append(':').append(base(distinct.get(k)));
            return sb.toString();
        }
        String[] names = { "sz", "fl", "ti", "tx", "ty", "tz", "po", "fg", "acc", "share" };
        for (int field = 0; field < names.length; field++) {
            h = 0;
            for (int i = 0; i < frames.length; i++) {
                of f = frames[i];
                if (f == null) {
                    if (field == 0) mix(-7);
                    continue;
                }
                switch (field) {
                    case 0 -> mix(f.b);
                    case 1 -> mix((f.f ? 1 : 0) | (f.m ? 2 : 0));
                    case 2 -> mixShorts(f.i);
                    case 3 -> mixShorts(f.h);
                    case 4 -> mixShorts(f.j);
                    case 5 -> mixShorts(f.p);
                    case 6 -> mixShorts(f.e);
                    case 7 -> mixBytes(f.n);
                    case 8 -> { mix(set.a(1, i) ? 1 : 0); mix(set.a((byte) 98, i) ? 1 : 0); }
                    default -> mix(f.l == null ? -1 : firstUse.get(f.l));
                }
            }
            sb.append(' ').append(names[field]).append('=').append(h);
        }
        h = 0;
        for (ok b : distinct) {
            mix(b.B); mix(b.y); mixInts(b.E); mixBools(b.H); mixInts(b.w);
            mix(b.v.length);
            for (int[] row : b.v) mixInts(row);
        }
        sb.append(" base=").append(h);
        return sb.toString();
    }

    // The od.a wrappers (stripped in the port) rethrow as g(cause, context): report the cause.
    static String ex(Throwable t) {
        while (t instanceof g wrapped && wrapped.a != null) t = wrapped.a;
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NegativeArraySizeException) return "negsize";
        if (t instanceof ArithmeticException) return "arith";
        if (t.getClass() == RuntimeException.class) return "runtime";
        return "error:" + t.getClass().getName();
    }

    static Field ofStatic(String name) throws Exception {
        Field f = of.class.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static final String[] TEMPS = { "a", "c", "d", "g", "k", "o" };

    static String temps() throws Exception {
        StringBuilder sb = new StringBuilder("tmp");
        for (String name : TEMPS) {
            Object v = ofStatic(name).get(null);
            sb.append(' ').append(name).append('=');
            if (v == null) { sb.append("null"); continue; }
            h = 0;
            if (v instanceof short[] s) mixShorts(s);
            else mixBytes((byte[]) v);
            sb.append(h);
        }
        return sb.toString();
    }

    static String declared(Class<?> c) {
        Field[] fs = c.getDeclaredFields();
        Arrays.sort(fs, (a, b) -> a.getName().compareTo(b.getName()));
        StringBuilder sb = new StringBuilder(c.getName()).append(':');
        for (Field f : fs) {
            sb.append(' ').append(Modifier.isStatic(f.getModifiers()) ? "s." : "").append(f.getName()).append(':');
            sb.append(f.getType().descriptorString());
        }
        return sb.toString();
    }

    static byte[] bytes(String s) {
        if (s.equals("N")) return null;
        String hex = s.substring(1);
        byte[] out = new byte[hex.length() / 2];
        for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(hex.substring(2 * i, 2 * i + 2), 16);
        return out;
    }

    static String produced(hf set, boolean full) {
        if (set != null) current = set;
        return set(set, full);
    }

    static String run(String[] t) throws Exception {
        switch (t[0]) {
            case "fields":
                return declared(hf.class) + " # " + declared(of.class) + " # " + declared(ok.class);
            case "bases":
                uk.d = archive(t[1]);
                return "ok";
            case "frames":
                ef.K = archive(t[1]);
                return "ok";
            case "avail": {
                Provider p = providers[Integer.parseInt(t[1])];
                int group = Integer.parseInt(t[2]);
                if (t[3].equals("1")) p.withheld.remove(group);
                else p.withheld.add(group);
                return "ok";
            }
            case "get": {
                int group = Integer.parseInt(t[1]);
                hf set = gb.a(100, group);
                if (set == null) return "null";
                hf before = lastByGroup.put(group, set);
                current = set;
                if (before == set) return "same";
                return "new " + set(set, t[2].equals("1"));
            }
            case "load":
                return produced(bh.a(archive(t[1]), t[2].equals("1"), archive(t[3]), -128, Integer.parseInt(t[4])), t[5].equals("1"));
            case "ctor":
                return produced(new hf(archive(t[1]), archive(t[2]), Integer.parseInt(t[3]), t[4].equals("1")), t[5].equals("1"));
            case "acc":
                return current == null ? "noset" : accessor(current, Integer.parseInt(t[1]));
            case "cache": {
                Field p = ve.class.getDeclaredField("p");
                p.setAccessible(true);
                return "p=" + p.getInt(gl.x) + " hard=" + gl.x.b((byte) -14);
            }
            case "reset":
                gl.x.a(0);
                return "ok";
            case "log": {
                StringBuilder sb = new StringBuilder("log");
                for (int a = 0; a < providers.length; a++) {
                    List<String> calls = providers[a].calls;
                    sb.append(' ').append(a).append('=');
                    if (calls.size() <= 24) {
                        sb.append(String.join(",", calls));
                    } else {
                        h = 0;
                        for (String call : calls) mix(call.hashCode());
                        sb.append(calls.size()).append(':').append(h);
                    }
                    calls.clear();
                }
                return sb.toString();
            }
            case "frame": {
                ok base = null;
                String baseOut;
                if (t[1].equals("-")) {
                    baseOut = "nobase";
                } else {
                    try {
                        base = new ok(Integer.parseInt(t[2]), bytes(t[1]));
                        baseOut = base(base);
                    } catch (Throwable e) {
                        baseOut = ex(e);
                    }
                }
                String frameOut;
                try {
                    of f = new of(bytes(t[3]), base);
                    frameOut = frame(f) + " l=" + (f.l == null ? "null" : f.l == base ? "arg" : "other");
                } catch (Throwable e) {
                    frameOut = ex(e);
                }
                return baseOut + " | " + frameOut + " | " + temps();
            }
            case "unload":
                of.a();
                return "ok";
            case "or":
                return String.valueOf(ok.a(Integer.parseInt(t[1]), Integer.parseInt(t[2])));
            default:
                throw new IllegalArgumentException(t[0]);
        }
    }

    public static void main(String[] args) throws Exception {
        DataInputStream fixture = new DataInputStream(new BufferedInputStream(new FileInputStream(args[0])));
        int count = fixture.readInt();
        providers = new Provider[count];
        archives = new al[count];
        for (int i = 0; i < count; i++) {
            providers[i] = new Provider(fixture);
            archives[i] = new al(providers[i], false, false);
        }
        fixture.close();
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
        PrintStream out = new PrintStream(new BufferedOutputStream(System.out, 1 << 16), false, "UTF-8");
        String line;
        while ((line = in.readLine()) != null) {
            if (line.isEmpty()) continue;
            String[] t = line.split(" ");
            String result;
            try {
                result = run(t);
            } catch (Throwable e) {
                result = ex(e);
            }
            // The set ops also report the temp tables: a set that fails part way has already decoded into them.
            if (t[0].equals("get") || t[0].equals("load") || t[0].equals("ctor")) result += " # " + temps();
            out.println(result);
        }
        out.flush();
    }
}
