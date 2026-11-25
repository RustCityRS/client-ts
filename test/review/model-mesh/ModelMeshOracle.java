import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;

// Differential oracle for the mesh unit: cb (ModelUnlit), fa (PointNormal) and ha (FaceNormal) of client.jar, with
// cb's statics (G/Y share maps, V share tic, cb/D sin and cos, a(Lal;II)Lcb; Load, a([[III)I interpolateHeight, l()V
// unload) and the cb -> fc lighting entry points (c(IIIII)Lfc;, b(IIIII)Lnd;, a(III)Lug;). Compiled with javac next to
// client.jar (same unnamed runtime package), so package-private members are called directly; cb's private members
// (two constructors, five methods, seventeen fields) go through reflection.
//
// argv[0] is the 530 cache directory (main_file_cache.dat2 / .idx*). The models archive is a real al over a ud that
// serves archive 7 straight from the sector files, so cb.a(Lal;II)Lcb; runs the gamepack's own JS5 decompression.
//
// stdin is the script (one operation per line); stdout has exactly one line per operation: the result (ok or the Java
// exception, unwrapping the obfuscator's g wrapper), any return value, then " | "-separated dumps of the models the
// operation touched. A dump lists every instance field of the class in declaration order. Every array carries an
// identity tag (#n, numbered in first-dump order since the last "ids" op), so the aliasing between models (copy
// flags, CopyForShareLight, HillSkewCopy, the arrays fc borrows from cb) is compared as well as the contents. Arrays
// are length:hash (31*h + v over the signed elements; fa/ha elements hashed over their fields) or, in the "full" ops,
// every element. test/review/model-mesh.test.ts runs the same script through the TS port.
class ModelMeshOracle {
    // cb's instance fields in declaration order.
    static final String[] CB_FIELDS = {
        "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "E", "F",
        "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "W", "X", "Z", "ab", "bb", "db", "eb",
        "fb", "gb", "hb"
    };
    // fc's instance fields in declaration order, then nd.j.
    static final String[] FC_FIELDS = {
        "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "D", "E", "F", "G", "H",
        "I", "J", "K", "L", "M", "N", "Q", "R", "S", "U", "Y", "Z"
    };

    static class Provider extends ud {
        final String dir;
        final int archive;
        final db index;

        Provider(String dir, int archive) throws Exception {
            this.dir = dir;
            this.archive = archive;
            byte[] ref = container(readGroup(dir, 255, archive));
            index = new db(ref, q.a(0, ref, ref.length));
        }

        db b(int ignored) { return index; }

        byte[] a(int mode, int group) {
            try {
                return container(readGroup(dir, archive, group));
            } catch (Exception e) {
                throw new IllegalStateException(e);
            }
        }

        void b(int ignored, int group) {}

        int c(int group, int ignored) { return 100; }
    }

    // The JS5 sector-file reader of test/cachefile.ts (readGroup).
    static byte[] readGroup(String dir, int archive, int group) throws Exception {
        byte[] entry = new byte[6];
        try (RandomAccessFile idx = new RandomAccessFile(dir + "/main_file_cache.idx" + archive, "r")) {
            idx.seek(group * 6L);
            idx.readFully(entry);
        }
        int size = (entry[0] & 255) << 16 | (entry[1] & 255) << 8 | entry[2] & 255;
        int sector = (entry[3] & 255) << 16 | (entry[4] & 255) << 8 | entry[5] & 255;
        byte[] out = new byte[size];
        byte[] header = new byte[8];
        try (RandomAccessFile dat = new RandomAccessFile(dir + "/main_file_cache.dat2", "r")) {
            for (int offset = 0; offset < size; offset += 512) {
                dat.seek(sector * 520L);
                dat.readFully(header);
                int g = (header[0] & 255) << 8 | header[1] & 255;
                int part = (header[2] & 255) << 8 | header[3] & 255;
                if (g != group || part != offset >> 9 || (header[7] & 255) != archive) throw new IllegalStateException("bad sector " + archive + "/" + group);
                sector = (header[4] & 255) << 16 | (header[5] & 255) << 8 | header[6] & 255;
                dat.readFully(out, offset, Math.min(512, size - offset));
            }
        }
        return out;
    }

    // The JS5 container without the two-byte version trailer the sector files keep after it.
    static byte[] container(byte[] raw) {
        int length = (raw[1] & 255) << 24 | (raw[2] & 255) << 16 | (raw[3] & 255) << 8 | raw[4] & 255;
        return Arrays.copyOf(raw, (raw[0] == 0 ? 5 : 9) + length);
    }

    // Fake textures, identical to model-mesh.test.ts: only pc.b(II)Z (isAvailable) is reached by the lighting.
    static class Textures implements pc {
        public boolean a(int id, int dummy) { return true; }
        public boolean b(int dummy, int id) { return id % 7 != 3; }
        public int[] c(int dummy, int id) { return null; }
        public boolean a(int id, byte dummy) { return true; }
        public int[] a(int id, float brightness, int dummy) { return null; }
        public int a(byte dummy, int id) { return id * 0x1F3D + 0x123 & 0xFFFF; }
        public boolean d(int dummy, int id) { return (id & 1) == 0; }
    }

    static Field[] cbFields, fcFields;
    static Field ndJ, faH, faM, faD, faO, haJ, haL, haH, cbT, cbQ;
    static Field shareMap, shareTic, shareMap2, sinF, cosF;
    static Constructor<?> ctorEmpty, ctorBytes;
    static Method interp, tilt, bounds, rotX, rotZ, addFrom;
    static al models;
    static final cb[] slots = new cb[32];
    static final Object[] lit = new Object[8];
    static final int[][][] maps = new int[5][][];
    static IdentityHashMap<Object, Integer> ids = new IdentityHashMap<>();

    static Field field(Class<?> c, String name) throws Exception {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Method method(Class<?> c, String name, Class<?>... params) throws Exception {
        Method m = c.getDeclaredMethod(name, params);
        m.setAccessible(true);
        return m;
    }

    static int faHash(Object e) throws Exception {
        int h = 1;
        h = 31 * h + faH.getInt(e);
        h = 31 * h + faM.getInt(e);
        h = 31 * h + faD.getInt(e);
        h = 31 * h + faO.getInt(e);
        return h;
    }

    static int haHash(Object e) throws Exception {
        int h = 1;
        h = 31 * h + haJ.getInt(e);
        h = 31 * h + haL.getInt(e);
        h = 31 * h + haH.getInt(e);
        return h;
    }

    static int hash(int[] a) {
        int h = 1;
        for (int v : a) h = 31 * h + v;
        return h;
    }

    static String list(int[] a) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < a.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(a[i]);
        }
        return sb.append(']').toString();
    }

    static String tag(Object v) {
        Integer id = ids.get(v);
        if (id == null) {
            id = ids.size();
            ids.put(v, id);
        }
        return "#" + id + ":";
    }

    static String value(Object v, boolean full) throws Exception {
        if (v == null) return "null";
        if (v instanceof Boolean b) return b ? "1" : "0";
        if (!v.getClass().isArray()) return v.toString();
        String t = tag(v);
        if (v instanceof int[] a) return t + (full ? list(a) : a.length + ":" + hash(a));
        if (v instanceof short[] a) {
            int[] w = new int[a.length];
            for (int i = 0; i < a.length; i++) w[i] = a[i];
            return t + (full ? list(w) : a.length + ":" + hash(w));
        }
        if (v instanceof byte[] a) {
            int[] w = new int[a.length];
            for (int i = 0; i < a.length; i++) w[i] = a[i];
            return t + (full ? list(w) : a.length + ":" + hash(w));
        }
        if (v instanceof int[][] a) {
            if (full) {
                StringBuilder sb = new StringBuilder(t).append('[');
                for (int i = 0; i < a.length; i++) sb.append(i > 0 ? ";" : "").append(a[i] == null ? "null" : list(a[i]));
                return sb.append(']').toString();
            }
            int h = 1;
            for (int[] row : a) h = 31 * h + (row == null ? 0 : 31 * row.length + hash(row));
            return t + a.length + ":" + h;
        }
        if (v instanceof fa[] a) {
            if (full) {
                StringBuilder sb = new StringBuilder(t).append('[');
                for (int i = 0; i < a.length; i++) {
                    if (i > 0) sb.append(';');
                    if (a[i] == null) sb.append("null");
                    else sb.append(faH.getInt(a[i])).append(',').append(faM.getInt(a[i])).append(',').append(faD.getInt(a[i])).append(',').append(faO.getInt(a[i]));
                }
                return sb.append(']').toString();
            }
            int h = 1;
            for (fa e : a) h = 31 * h + (e == null ? 0 : faHash(e));
            return t + a.length + ":" + h;
        }
        if (v instanceof ha[] a) {
            if (full) {
                StringBuilder sb = new StringBuilder(t).append('[');
                for (int i = 0; i < a.length; i++) {
                    if (i > 0) sb.append(';');
                    if (a[i] == null) sb.append("null");
                    else sb.append(haJ.getInt(a[i])).append(',').append(haL.getInt(a[i])).append(',').append(haH.getInt(a[i]));
                }
                return sb.append(']').toString();
            }
            int h = 1;
            for (ha e : a) h = 31 * h + (e == null ? 0 : haHash(e));
            return t + a.length + ":" + h;
        }
        throw new IllegalStateException("unexpected " + v.getClass());
    }

    static String dump(cb model, boolean full) throws Exception {
        if (model == null) return "nullmodel";
        StringBuilder sb = new StringBuilder("cb");
        for (int i = 0; i < cbFields.length; i++) sb.append(' ').append(CB_FIELDS[i]).append('=').append(value(cbFields[i].get(model), full));
        return sb.toString();
    }

    static String dumpLit(Object model, boolean full) throws Exception {
        if (model == null) return "nulllit";
        StringBuilder sb = new StringBuilder(model.getClass().getName());
        for (int i = 0; i < fcFields.length; i++) sb.append(' ').append(FC_FIELDS[i]).append('=').append(value(fcFields[i].get(model), full));
        return sb.append(" j=").append(value(ndJ.get(model), full)).toString();
    }

    static String statics() throws Exception {
        return " G=" + value(shareMap.get(null), false) + " V=" + shareTic.getInt(null) + " Y=" + value(shareMap2.get(null), false);
    }

    static String code(Throwable t) throws Exception {
        while (t instanceof InvocationTargetException ite) t = ite.getCause();
        while (t instanceof g wrapped && wrapped.a != null) t = wrapped.a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ArithmeticException) return "arith";
        if (t instanceof NegativeArraySizeException) return "nase";
        if (t instanceof ClassCastException) return "cce";
        return "error:" + t;
    }

    static byte[] hex(String s) {
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) b[i] = (byte) Integer.parseInt(s.substring(i * 2, i * 2 + 2), 16);
        return b;
    }

    static int[][] map(int i) {
        return i < 0 ? null : maps[i];
    }

    static void checkFields(Class<?> c, String[] expected) {
        HashSet<String> have = new HashSet<>();
        for (Field f : c.getDeclaredFields()) if (!Modifier.isStatic(f.getModifiers())) have.add(f.getName());
        if (!have.equals(new HashSet<>(Arrays.asList(expected)))) throw new IllegalStateException(c.getName() + " fields " + have);
    }

    // Heightmaps shared with model-mesh.test.ts: two 104x104 maps, a 3x3 map, a map with a null row and a ragged map.
    static void makeMaps() {
        maps[0] = new int[104][104];
        maps[1] = new int[104][104];
        for (int x = 0; x < 104; x++) {
            for (int z = 0; z < 104; z++) {
                maps[0][x][z] = -((x * 37 + z * 91) % 400) - (x * z % 97) * 3;
                maps[1][x][z] = -((x * 53 + z * 17) % 700) - 200;
            }
        }
        maps[2] = new int[3][3];
        for (int x = 0; x < 3; x++) for (int z = 0; z < 3; z++) maps[2][x][z] = -x * 40 - z * 7;
        maps[3] = new int[8][];
        for (int x = 0; x < 8; x++) if (x != 5) maps[3][x] = new int[] {-x * 9, -x * 9 - 1, -x * 9 - 2, -x * 9 - 3, -x * 9 - 4, -x * 9 - 5, -x * 9 - 6, -x * 9 - 7};
        maps[4] = new int[6][];
        for (int x = 0; x < 6; x++) {
            maps[4][x] = new int[x < 3 ? 6 : 2];
            for (int z = 0; z < maps[4][x].length; z++) maps[4][x][z] = -x * 31 - z * 5;
        }
    }

    public static void main(String[] argv) throws Exception {
        checkFields(cb.class, CB_FIELDS);
        checkFields(fc.class, FC_FIELDS);
        cbFields = new Field[CB_FIELDS.length];
        for (int i = 0; i < CB_FIELDS.length; i++) cbFields[i] = field(cb.class, CB_FIELDS[i]);
        fcFields = new Field[FC_FIELDS.length];
        for (int i = 0; i < FC_FIELDS.length; i++) fcFields[i] = field(fc.class, FC_FIELDS[i]);
        ndJ = field(nd.class, "j");
        faH = field(fa.class, "h");
        faM = field(fa.class, "m");
        faD = field(fa.class, "d");
        faO = field(fa.class, "o");
        haJ = field(ha.class, "j");
        haL = field(ha.class, "l");
        haH = field(ha.class, "h");
        cbT = field(cb.class, "t");
        cbQ = field(cb.class, "q");
        shareMap = field(cb.class, "G");
        shareTic = field(cb.class, "V");
        shareMap2 = field(cb.class, "Y");
        sinF = field(cb.class, "cb");
        cosF = field(cb.class, "D");
        ctorEmpty = cb.class.getDeclaredConstructor();
        ctorBytes = cb.class.getDeclaredConstructor(byte[].class);
        ctorEmpty.setAccessible(true);
        ctorBytes.setAccessible(true);
        interp = method(cb.class, "a", int[][].class, int.class, int.class);
        tilt = method(cb.class, "a", int[][].class, int.class, int.class, int.class, int.class, int.class);
        bounds = method(cb.class, "k");
        rotX = method(cb.class, "b", int.class);
        rotZ = method(cb.class, "c", int.class);
        addFrom = method(cb.class, "a", cb.class, int.class, short.class);
        makeMaps();
        models = new al(new Provider(argv[0], 7), false, true);
        dc.r = new Textures();

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.US_ASCII), 1 << 20);
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");
        for (String line; (line = in.readLine()) != null;) out.println(run(line));
        out.flush();
    }

    static String run(String line) throws Exception {
        String[] a = line.split(" ");
        String op = a[0];
        int[] n = new int[a.length];
        if (!op.equals("dec")) for (int i = 1; i < a.length; i++) n[i] = Integer.parseInt(a[i]);
        else n[1] = Integer.parseInt(a[1]);
        String result = "ok";
        String extra = "";
        int[] show = {};
        int[] showLit = {};
        boolean full = false;
        try {
            switch (op) {
                case "ids": ids = new IdentityHashMap<>(); break;
                case "tables": {
                    int[] s = (int[]) sinF.get(null);
                    int[] c = (int[]) cosF.get(null);
                    extra = " " + s.length + ":" + hash(s) + " " + c.length + ":" + hash(c);
                    break;
                }
                case "load":
                    show = new int[] {n[1]};
                    slots[n[1]] = null;
                    slots[n[1]] = cb.a(n[2] == -9 ? null : models, n[3], n[4]);
                    break;
                case "dec":
                    show = new int[] {n[1]};
                    slots[n[1]] = null;
                    slots[n[1]] = (cb) ctorBytes.newInstance((Object) (a.length < 3 ? new byte[0] : hex(a[2])));
                    break;
                case "nullbytes":
                    show = new int[] {n[1]};
                    slots[n[1]] = null;
                    slots[n[1]] = (cb) ctorBytes.newInstance((Object) null);
                    break;
                case "empty": show = new int[] {n[1]}; slots[n[1]] = (cb) ctorEmpty.newInstance(); break;
                case "sizes": show = new int[] {n[1]}; slots[n[1]] = null; slots[n[1]] = new cb(n[2], n[3], n[4]); break;
                case "copy":
                    show = new int[] {n[1], n[2]};
                    slots[n[1]] = new cb(n[2] < 0 ? null : slots[n[2]], n[3] != 0, n[4] != 0, n[5] != 0, n[6] != 0);
                    break;
                case "merge": {
                    show = new int[] {n[1]};
                    cb[] list = n[2] == -9 ? null : new cb[a.length - 4];
                    for (int i = 4; i < a.length; i++) list[i - 4] = n[i] < 0 ? null : slots[n[i]];
                    slots[n[1]] = null;
                    slots[n[1]] = new cb(list, n[3]);
                    break;
                }
                case "share": show = new int[] {n[1], n[2]}; slots[n[1]] = slots[n[2]].g(); break;
                case "resize": show = new int[] {n[1]}; slots[n[1]].b(n[2], n[3], n[4]); break;
                case "translate": show = new int[] {n[1]}; slots[n[1]].c(n[2], n[3], n[4]); break;
                case "rotate": show = new int[] {n[1]}; slots[n[1]].d(n[2], n[3], n[4]); break;
                case "rot90": show = new int[] {n[1]}; slots[n[1]].c(); break;
                case "rot180": show = new int[] {n[1]}; slots[n[1]].f(); break;
                case "rot270": show = new int[] {n[1]}; slots[n[1]].i(); break;
                case "mirror": show = new int[] {n[1]}; slots[n[1]].d(); break;
                case "roty": show = new int[] {n[1]}; slots[n[1]].a(n[2]); break;
                case "rotx": show = new int[] {n[1]}; rotX.invoke(slots[n[1]], n[2]); break;
                case "rotz": show = new int[] {n[1]}; rotZ.invoke(slots[n[1]], n[2]); break;
                case "recolour": show = new int[] {n[1]}; slots[n[1]].b((short) n[2], (short) n[3]); break;
                case "retexture": show = new int[] {n[1]}; slots[n[1]].a((short) n[2], (short) n[3]); break;
                case "normals": show = new int[] {n[1]}; slots[n[1]].e(); break;
                case "prepare": show = new int[] {n[1]}; slots[n[1]].m(); break;
                case "discard": show = new int[] {n[1]}; slots[n[1]].h(); break;
                case "bounds": show = new int[] {n[1]}; bounds.invoke(slots[n[1]]); break;
                case "miny": show = new int[] {n[1]}; extra = " " + slots[n[1]].b(); break;
                case "unlit": extra = " " + slots[n[1]].a(); break;
                case "update": show = new int[] {n[1]}; slots[n[1]].a(n[2], n[3], n[4], n[5], n[6]); break;
                case "draw": show = new int[] {n[1]}; slots[n[1]].a(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], (long) n[10], n[11], null); break;
                case "addpoint": show = new int[] {n[1]}; extra = " " + slots[n[1]].e(n[2], n[3], n[4]); break;
                case "addface":
                    show = new int[] {n[1]};
                    extra = " " + slots[n[1]].a(n[2], n[3], n[4], (byte) n[5], (short) n[6], (byte) n[7]);
                    break;
                case "addfrom":
                    show = new int[] {n[1]};
                    extra = " " + addFrom.invoke(slots[n[1]], n[2] < 0 ? null : slots[n[2]], n[3], (short) n[4]);
                    break;
                case "hill": {
                    // hill dst src type param mapA mapB x y z copy drop
                    show = new int[] {n[1], n[2]};
                    cb r = slots[n[2]].a(n[3], n[4], map(n[5]), map(n[6]), n[7], n[8], n[9], n[10] != 0, n[11] != 0);
                    extra = r == slots[n[2]] ? " same" : " new";
                    slots[n[1]] = r;
                    break;
                }
                case "tilt": show = new int[] {n[1]}; tilt.invoke(slots[n[1]], map(n[2]), n[3], n[4], n[5], n[6], n[7]); break;
                case "interp": extra = " " + interp.invoke(null, map(n[1]), n[2], n[3]); break;
                case "share-normals": {
                    // share-normals self other dx dy dz flag; other -1 = null, -2 - L = lit model L (not a cb).
                    show = n[2] >= 0 ? new int[] {n[1], n[2]} : new int[] {n[1]};
                    ug other = n[2] >= 0 ? slots[n[2]] : n[2] == -1 ? null : (ug) lit[-2 - n[2]];
                    slots[n[1]].a(other, n[3], n[4], n[5], n[6] != 0);
                    extra = statics();
                    break;
                }
                case "setamb":
                    show = new int[] {n[1]};
                    cbT.setShort(slots[n[1]], (short) n[2]);
                    cbQ.setShort(slots[n[1]], (short) n[3]);
                    break;
                case "lit":
                    show = new int[] {n[2]};
                    showLit = new int[] {n[1]};
                    lit[n[1]] = null;
                    lit[n[1]] = slots[n[2]].c(n[3], n[4], n[5], n[6], n[7]);
                    break;
                case "litnd":
                    show = new int[] {n[2]};
                    showLit = new int[] {n[1]};
                    lit[n[1]] = null;
                    lit[n[1]] = slots[n[2]].b(n[3], n[4], n[5], n[6], n[7]);
                    break;
                case "litsrc":
                    show = new int[] {n[2]};
                    showLit = new int[] {n[1]};
                    lit[n[1]] = null;
                    lit[n[1]] = slots[n[2]].a(n[3], n[4], n[5]);
                    break;
                case "dump": show = new int[] {n[1]}; break;
                case "dumplit": showLit = new int[] {n[1]}; break;
                case "full": show = new int[] {n[1]}; full = true; break;
                case "fulllit": showLit = new int[] {n[1]}; full = true; break;
                case "unload": cb.l(); extra = " " + value(sinF.get(null), false) + " " + value(cosF.get(null), false) + statics(); break;
                default: throw new IllegalArgumentException(line);
            }
        } catch (InvocationTargetException | RuntimeException e) {
            if (e instanceof IllegalArgumentException && !(e instanceof NumberFormatException) && e.getMessage() != null && e.getMessage().equals(line)) throw e;
            result = code(e);
        }
        StringBuilder sb = new StringBuilder(result).append(extra);
        for (int s : show) sb.append(" | ").append(s < 0 ? "nullmodel" : dump(slots[s], full));
        for (int s : showLit) sb.append(" | ").append(dumpLit(lit[s], full));
        return sb.toString();
    }
}
