import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.io.PrintStream;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.IdentityHashMap;

// Differential oracle for the animation classes of client.jar: hf (AnimFrameSet), of (AnimFrame) and ok (AnimBase),
// plus the statics the member map places on them (gb.a get, bh.a Load, gl.x cache, uk.d/ef.K archives, of.a unload).
// Compiled with javac next to client.jar (same unnamed package), so package-private members are used directly.
//
// stdin (DataInputStream):
//   bases archive:  int len, reference table; then for each group of the table: int len, raw group
//   frames archive: the same
//   int n, then n group ids: for each, gb.a(group) twice, then bh.a(bases, true, frames, group)
//   int n, then n edge cases: int baseLen (-1 no base object, -2 ok(id, null)), base bytes, int baseId,
//                             int frameLen (-1 null bytes), frame bytes
//   then of.a() (unload) runs, and int n more edge cases follow.
// stdout: one line per group and per edge case.
class AnimOracle {
    static class Provider extends ud {
        db index;
        byte[][] groups;

        Provider(DataInputStream in) throws Exception {
            byte[] ref = in.readNBytes(in.readInt());
            index = new db(ref, q.a(0, ref, ref.length));
            groups = new byte[index.e][];
            for (int group : index.d) groups[group] = in.readNBytes(in.readInt());
        }

        db b(int ignored) { return index; }
        byte[] a(int mode, int group) { return groups[group]; }
        void b(int ignored, int group) {}
        int c(int group, int ignored) { return 100; }
    }

    static int h;

    static void mix(int v) { h = h * 31 + v; }
    static void mix(short[] a) { mix(a.length); for (short v : a) mix(v); }
    static void mix(byte[] a) { mix(a.length); for (byte v : a) mix(v); }
    static void mix(boolean[] a) { mix(a.length); for (boolean v : a) mix(v ? 1 : 0); }
    static void mix(int[] a) {
        if (a == null) { mix(-1); return; }
        mix(a.length);
        for (int v : a) mix(v);
    }

    // Hash of every field of every frame of the set, and of each distinct base the first time a frame uses it.
    // A frame whose base object was already seen mixes the index of the first frame that used it (pins the dedupe).
    static String set(hf set) {
        if (set == null) return "null";
        h = 0;
        int frames = 0, bases = 0;
        IdentityHashMap<ok, Integer> seen = new IdentityHashMap<>();
        mix(set.E.length);
        for (int i = 0; i < set.E.length; i++) {
            of f = set.E[i];
            if (f == null) { mix(-7); continue; }
            frames++;
            mix(f.b); mix(f.f ? 1 : 0); mix(f.m ? 1 : 0);
            mix(f.i); mix(f.h); mix(f.j); mix(f.p); mix(f.e); mix(f.n);
            mix(set.a((byte) 98, i) ? 1 : 0); mix(set.a(1, i) ? 1 : 0);
            Integer first = seen.get(f.l);
            if (first != null) { mix(first); continue; }
            seen.put(f.l, i);
            bases++;
            ok b = f.l;
            mix(-1); mix(b.B); mix(b.y); mix(b.E); mix(b.H); mix(b.w);
            mix(b.v.length);
            for (int[] labels : b.v) mix(labels);
        }
        return set.E.length + " " + frames + " " + bases + " " + h;
    }

    // The od.a wrappers (stripped in the port) rethrow as g(cause, context): report the cause.
    static String ex(Throwable t) {
        while (t instanceof g wrapped && wrapped.a != null) t = wrapped.a;
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NegativeArraySizeException) return "negsize";
        if (t.getClass() == RuntimeException.class) return "runtime";
        return "error:" + t;
    }

    static String value(Object v) {
        if (v == null) return "null";
        if (v instanceof ok) return "base";
        StringBuilder sb = new StringBuilder("[");
        if (v instanceof short[] a) { for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i]); return sb.append(']').toString(); }
        if (v instanceof byte[] a) { for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i]); return sb.append(']').toString(); }
        if (v instanceof int[] a) { for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i]); return sb.append(']').toString(); }
        if (v instanceof boolean[] a) { for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(a[i]); return sb.append(']').toString(); }
        if (v instanceof int[][] a) { for (int i = 0; i < a.length; i++) sb.append(i > 0 ? "," : "").append(value(a[i])); return sb.append(']').toString(); }
        return v.toString();
    }

    // Instance fields declared by the class itself, sorted by obfuscated name.
    static String fields(Object o) throws Exception {
        Field[] fs = o.getClass().getDeclaredFields();
        java.util.Arrays.sort(fs, (a, b) -> a.getName().compareTo(b.getName()));
        StringBuilder sb = new StringBuilder();
        for (Field f : fs) {
            if (Modifier.isStatic(f.getModifiers())) continue;
            f.setAccessible(true);
            if (sb.length() > 0) sb.append(' ');
            sb.append(f.getName()).append('=').append(value(f.get(o)));
        }
        return sb.toString();
    }

    static void edges(DataInputStream in, PrintStream out) throws Exception {
        for (int n = in.readInt(); n > 0; n--) {
            int baseLen = in.readInt();
            byte[] baseBytes = baseLen >= 0 ? in.readNBytes(baseLen) : null;
            int baseId = in.readInt();
            int frameLen = in.readInt();
            byte[] frameBytes = frameLen >= 0 ? in.readNBytes(frameLen) : null;
            ok base = null;
            String baseOut;
            if (baseLen == -1) {
                baseOut = "null";
            } else {
                try {
                    base = new ok(baseId, baseBytes);
                    baseOut = fields(base);
                } catch (Throwable t) {
                    baseOut = ex(t);
                }
            }
            String frameOut;
            try {
                frameOut = fields(new of(frameBytes, base));
            } catch (Throwable t) {
                frameOut = ex(t);
            }
            out.println(baseOut + " | " + frameOut);
        }
    }

    public static void main(String[] args) throws Exception {
        DataInputStream in = new DataInputStream(new BufferedInputStream(System.in));
        PrintStream out = new PrintStream(new java.io.BufferedOutputStream(System.out), false, "UTF-8");
        uk.d = new al(new Provider(in), false, false);
        ef.K = new al(new Provider(in), false, false);
        for (int n = in.readInt(); n > 0; n--) {
            int group = in.readInt();
            String first, again, flagged;
            hf loaded = null;
            try {
                loaded = gb.a(100, group);
                first = set(loaded);
            } catch (Throwable t) {
                first = ex(t);
            }
            try {
                hf second = gb.a(100, group);
                again = second == null ? "null" : String.valueOf(second == loaded);
            } catch (Throwable t) {
                again = ex(t);
            }
            try {
                flagged = set(bh.a(uk.d, true, ef.K, -128, group));
            } catch (Throwable t) {
                flagged = ex(t);
            }
            out.println("g " + group + " " + first + " | " + again + " | " + flagged);
        }
        edges(in, out);
        of.a();
        edges(in, out);
        out.flush();
    }
}
