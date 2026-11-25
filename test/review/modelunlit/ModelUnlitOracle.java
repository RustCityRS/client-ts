import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.FileOutputStream;
import java.io.FileDescriptor;
import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

// Differential oracle for cb (ModelUnlit), fa (PointNormal) and ha (FaceNormal). Everything is reached by reflection
// on the real classes in client.jar (this file runs in the source launcher, a different runtime package from the
// gamepack, so it cannot touch package-private members directly).
//
// Reads one operation per line on stdin and prints exactly one result line per operation on stdout: the result (ok,
// or the Java exception: aioobe/npe/arith/nase/cce), an optional return value, then " | "-separated dumps of the
// models the operation touched. A dump lists every cb instance field in declaration order: arrays as length:hash
// (Java 31*h + v over the signed elements, rows/elements hashed the same way), scalars as their value.
// test/review/model-unlit.test.ts runs the same script through the TS port.
// Run: java -cp client.jar ModelUnlitOracle.java
class ModelUnlitOracle {
    static final String[] FIELDS = {
        "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "A", "B", "C", "E", "F",
        "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "W", "X", "Z", "ab", "bb", "db", "eb",
        "fb", "gb", "hb"
    };

    static Class<?> cb, fa, ha, ug;
    static Field[] fields;
    static Field faH, faM, faD, faO, haJ, haL, haH;
    static Field shareMap, shareTic, shareMap2, sin, cos;
    static final Object[] slots = new Object[16];
    static final int[][][] maps = new int[3][][];

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

    static int hashInts(int[] a) {
        int h = 1;
        for (int v : a) h = 31 * h + v;
        return h;
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

    static String value(Object v) throws Exception {
        if (v == null) return "null";
        if (v instanceof int[]) return ((int[]) v).length + ":" + hashInts((int[]) v);
        if (v instanceof short[]) {
            short[] a = (short[]) v;
            int h = 1;
            for (short s : a) h = 31 * h + s;
            return a.length + ":" + h;
        }
        if (v instanceof byte[]) {
            byte[] a = (byte[]) v;
            int h = 1;
            for (byte b : a) h = 31 * h + b;
            return a.length + ":" + h;
        }
        if (v instanceof int[][]) {
            int[][] a = (int[][]) v;
            int h = 1;
            for (int[] row : a) h = 31 * h + (row == null ? 0 : 31 * row.length + hashInts(row));
            return a.length + ":" + h;
        }
        if (v.getClass().isArray()) {
            int n = Array.getLength(v);
            boolean isFa = v.getClass().getComponentType() == fa;
            int h = 1;
            for (int i = 0; i < n; i++) {
                Object e = Array.get(v, i);
                h = 31 * h + (e == null ? 0 : isFa ? faHash(e) : haHash(e));
            }
            return n + ":" + h;
        }
        if (v instanceof Boolean) return ((Boolean) v) ? "1" : "0";
        return v.toString();
    }

    static String dump(Object model) throws Exception {
        if (model == null) return "nullmodel";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < fields.length; i++) {
            if (i > 0) sb.append(' ');
            sb.append(FIELDS[i]).append('=').append(value(fields[i].get(model)));
        }
        return sb.toString();
    }

    static String statics() throws Exception {
        return "G=" + value(shareMap.get(null)) + " V=" + shareTic.getInt(null) + " Y=" + value(shareMap2.get(null));
    }

    static String code(Throwable t) throws Exception {
        // gd's od.a wrappers (stripped in PacketT) rethrow the packet's exception as g, holding it in g.a.
        if (t.getClass().getName().equals("g")) return code((Throwable) field(t.getClass(), "a").get(t));
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

    public static void main(String[] argv) throws Exception {
        cb = Class.forName("cb");
        fa = Class.forName("fa");
        ha = Class.forName("ha");
        ug = Class.forName("ug");
        fields = new Field[FIELDS.length];
        for (int i = 0; i < FIELDS.length; i++) fields[i] = field(cb, FIELDS[i]);
        faH = field(fa, "h");
        faM = field(fa, "m");
        faD = field(fa, "d");
        faO = field(fa, "o");
        haJ = field(ha, "j");
        haL = field(ha, "l");
        haH = field(ha, "h");
        shareMap = field(cb, "G");
        shareTic = field(cb, "V");
        shareMap2 = field(cb, "Y");
        sin = field(cb, "cb");
        cos = field(cb, "D");

        // Heightmaps shared with model-unlit.test.ts.
        maps[0] = new int[104][104];
        maps[1] = new int[104][104];
        maps[2] = new int[3][3];
        for (int x = 0; x < 104; x++) {
            for (int z = 0; z < 104; z++) {
                maps[0][x][z] = -((x * 37 + z * 91) % 400) - (x * z % 97) * 3;
                maps[1][x][z] = -((x * 53 + z * 17) % 700) - 200;
            }
        }
        for (int x = 0; x < 3; x++) for (int z = 0; z < 3; z++) maps[2][x][z] = -x * 40 - z * 7;

        Class<?> cbArray = Array.newInstance(cb, 0).getClass();
        Constructor<?> ctorEmpty = cb.getDeclaredConstructor();
        Constructor<?> ctorBytes = cb.getDeclaredConstructor(byte[].class);
        Constructor<?> ctorSizes = cb.getDeclaredConstructor(int.class, int.class, int.class);
        Constructor<?> ctorMerge = cb.getDeclaredConstructor(cbArray, int.class);
        Constructor<?> ctorCopy = cb.getDeclaredConstructor(cb, boolean.class, boolean.class, boolean.class, boolean.class);
        for (Constructor<?> c : new Constructor<?>[] {ctorEmpty, ctorBytes, ctorSizes, ctorMerge, ctorCopy}) c.setAccessible(true);

        Method resize = method(cb, "b", int.class, int.class, int.class);
        Method translate = method(cb, "c", int.class, int.class, int.class);
        Method rotate = method(cb, "d", int.class, int.class, int.class);
        Method rot90 = method(cb, "c");
        Method rot180 = method(cb, "f");
        Method rot270 = method(cb, "i");
        Method mirror = method(cb, "d");
        Method rotY = method(cb, "a", int.class);
        Method rotX = method(cb, "b", int.class);
        Method rotZ = method(cb, "c", int.class);
        Method recolour = method(cb, "b", short.class, short.class);
        Method retexture = method(cb, "a", short.class, short.class);
        Method normals = method(cb, "e");
        Method prepare = method(cb, "m");
        Method discard = method(cb, "h");
        Method bounds = method(cb, "k");
        Method minY = method(cb, "b");
        Method isUnlit = method(cb, "a");
        Method addPoint = method(cb, "e", int.class, int.class, int.class);
        Method addFace = method(cb, "a", int.class, int.class, int.class, byte.class, short.class, byte.class);
        Method addFrom = method(cb, "a", cb, int.class, short.class);
        Method hill = method(cb, "a", int.class, int.class, int[][].class, int[][].class, int.class, int.class, int.class, boolean.class, boolean.class);
        Method tilt = method(cb, "a", int[][].class, int.class, int.class, int.class, int.class, int.class);
        Method interp = method(cb, "a", int[][].class, int.class, int.class);
        Method share = method(cb, "g");
        Method mergeNormals = method(cb, "a", ug, int.class, int.class, int.class, boolean.class);
        Method unload = method(cb, "l");

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), false, "UTF-8");
        String line;
        while ((line = in.readLine()) != null) {
            String[] a = line.split(" ");
            int[] n = new int[a.length];
            for (int i = 1; i < a.length; i++) {
                if (!a[0].equals("dec")) n[i] = Integer.parseInt(a[i]);
            }
            String result = "ok";
            String extra = "";
            int[] show = {};
            try {
                switch (a[0]) {
                    case "dec":
                        n[1] = Integer.parseInt(a[1]);
                        slots[n[1]] = null;
                        show = new int[] {n[1]};
                        slots[n[1]] = ctorBytes.newInstance((Object) hex(a[2]));
                        break;
                    case "nullbytes":
                        show = new int[] {n[1]};
                        slots[n[1]] = ctorBytes.newInstance((Object) null);
                        break;
                    case "empty":
                        show = new int[] {n[1]};
                        slots[n[1]] = ctorEmpty.newInstance();
                        break;
                    case "sizes":
                        show = new int[] {n[1]};
                        slots[n[1]] = ctorSizes.newInstance(n[2], n[3], n[4]);
                        break;
                    case "copy":
                        show = new int[] {n[1], n[2]};
                        slots[n[1]] = ctorCopy.newInstance(n[2] < 0 ? null : slots[n[2]], n[3] != 0, n[4] != 0, n[5] != 0, n[6] != 0);
                        break;
                    case "merge": {
                        show = new int[] {n[1]};
                        int count = n[2];
                        Object list = Array.newInstance(cb, a.length - 3);
                        for (int i = 3; i < a.length; i++) Array.set(list, i - 3, n[i] < 0 ? null : slots[n[i]]);
                        slots[n[1]] = ctorMerge.newInstance(list, count);
                        break;
                    }
                    case "share":
                        show = new int[] {n[1], n[2]};
                        slots[n[1]] = share.invoke(slots[n[2]]);
                        break;
                    case "resize": show = new int[] {n[1]}; resize.invoke(slots[n[1]], n[2], n[3], n[4]); break;
                    case "translate": show = new int[] {n[1]}; translate.invoke(slots[n[1]], n[2], n[3], n[4]); break;
                    case "rotate": show = new int[] {n[1]}; rotate.invoke(slots[n[1]], n[2], n[3], n[4]); break;
                    case "rot90": show = new int[] {n[1]}; rot90.invoke(slots[n[1]]); break;
                    case "rot180": show = new int[] {n[1]}; rot180.invoke(slots[n[1]]); break;
                    case "rot270": show = new int[] {n[1]}; rot270.invoke(slots[n[1]]); break;
                    case "mirror": show = new int[] {n[1]}; mirror.invoke(slots[n[1]]); break;
                    case "roty": show = new int[] {n[1]}; rotY.invoke(slots[n[1]], n[2]); break;
                    case "rotx": show = new int[] {n[1]}; rotX.invoke(slots[n[1]], n[2]); break;
                    case "rotz": show = new int[] {n[1]}; rotZ.invoke(slots[n[1]], n[2]); break;
                    case "recolour": show = new int[] {n[1]}; recolour.invoke(slots[n[1]], (short) n[2], (short) n[3]); break;
                    case "retexture": show = new int[] {n[1]}; retexture.invoke(slots[n[1]], (short) n[2], (short) n[3]); break;
                    case "normals": show = new int[] {n[1]}; normals.invoke(slots[n[1]]); break;
                    case "prepare": show = new int[] {n[1]}; prepare.invoke(slots[n[1]]); break;
                    case "discard": show = new int[] {n[1]}; discard.invoke(slots[n[1]]); break;
                    case "bounds": show = new int[] {n[1]}; bounds.invoke(slots[n[1]]); break;
                    case "miny": show = new int[] {n[1]}; extra = " " + minY.invoke(slots[n[1]]); break;
                    case "unlit": extra = " " + isUnlit.invoke(slots[n[1]]); break;
                    case "addpoint": show = new int[] {n[1]}; extra = " " + addPoint.invoke(slots[n[1]], n[2], n[3], n[4]); break;
                    case "addface":
                        show = new int[] {n[1]};
                        extra = " " + addFace.invoke(slots[n[1]], n[2], n[3], n[4], (byte) n[5], (short) n[6], (byte) n[7]);
                        break;
                    case "addfrom":
                        show = new int[] {n[1]};
                        extra = " " + addFrom.invoke(slots[n[1]], slots[n[2]], n[3], (short) n[4]);
                        break;
                    case "hill": {
                        // hill dst src type param mapA mapB x y z copy drop
                        show = new int[] {n[1], n[2]};
                        Object r = hill.invoke(slots[n[2]], n[3], n[4], map(n[5]), map(n[6]), n[7], n[8], n[9], n[10] != 0, n[11] != 0);
                        extra = r == slots[n[2]] ? " same" : " new";
                        slots[n[1]] = r;
                        break;
                    }
                    case "tilt": show = new int[] {n[1]}; tilt.invoke(slots[n[1]], map(n[2]), n[3], n[4], n[5], n[6], n[7]); break;
                    case "interp": extra = " " + interp.invoke(null, map(n[1]), n[2], n[3]); break;
                    case "share-normals": {
                        // share-normals self other dx dy dz flag
                        show = new int[] {n[1], n[2]};
                        Object other = n[2] < 0 ? null : slots[n[2]];
                        mergeNormals.invoke(slots[n[1]], other, n[3], n[4], n[5], n[6] != 0);
                        extra = " " + statics();
                        break;
                    }
                    case "unload": unload.invoke(null); extra = " " + value(sin.get(null)) + " " + value(cos.get(null)); break;
                    default: throw new IllegalArgumentException(line);
                }
            } catch (InvocationTargetException e) {
                Throwable cause = e.getCause();
                // A constructor's own exception (cb(byte[]) on bad data) arrives the same way.
                result = code(cause);
            }
            StringBuilder sb = new StringBuilder(result).append(extra);
            for (int s : show) sb.append(" | ").append(s < 0 ? "nullmodel" : dump(slots[s]));
            out.println(sb);
        }
        out.flush();
    }
}
