import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.List;

// Differential oracle for the scene-graph entity classes of client.jar: kb (Ground), ra (Square), ma (QuickGround)
// and the no-argument entities ec/hk/nf/pk/mh/jg (Sprite/Wall/Decor/GroundDecor/GroundObject/Occlude), plus kb's
// statics (f/i/q/r/t/u/v) and kb.a()V (Ground.unload).
//
// The oracle is compiled into the default package next to client.jar, so the package-private constructors and statics
// are used directly (new kb(...), kb.f[...]); only the private kb.i/kb.t tables and the instance-field dump go through
// reflection. None of kb.<init>, ra.<init>, ma.<init> or the no-argument constructors has a dummy argument or an
// exception table; a g wrapper (field a = the original exception) is unwrapped anyway.
//
// Reads one operation per line on stdin and prints exactly one result line per operation on stdout:
//   kb a1 .. a19        new kb(a1..a19): "<fields> | <statics>" or "<exception> | <statics>"
//   ra level x z        new ra(level, x, z): its fields, jf's inherited fields included (prefixed "jf.")
//   ma a1 .. a6 flag    new ma(a1..a6, flag == 1)
//   new <cls>           a no-argument constructor (ec, hk, nf, pk, mh, jg)
//   poke <s> <i> <v>    kb.<s>[i] = v for s in f/q/r/u/v (what world.drawTileOverlay does), then the statics
//   unload              kb.a(), then the statics
//   statics             kb's statics
//
// Values: a null reference prints "null"; an int "I:n"; a long "J:n"; a boolean "Z:b"; an int[] "[I:[a,b,..]"; an
// Object[] "[L:[null|<class>,..]"; any other object its class name. Statics are printed in the order
// f i q r t u v, each array with "#<id>", the order in which the oracle first saw that array object (so a constructor
// that replaced or aliased one of the shared tables would show).
//
// Usage: javac -cp client.jar -d <dir> SceneEntitiesOracle.java
//        java -Djava.awt.headless=true -cp client.jar<sep><dir> SceneEntitiesOracle < script
public class SceneEntitiesOracle {
    static final IdentityHashMap<Object, Integer> ids = new IdentityHashMap<>();
    static Field kbI;
    static Field kbT;

    static int id(Object o) {
        Integer id = ids.get(o);
        if (id == null) {
            id = ids.size();
            ids.put(o, id);
        }
        return id;
    }

    static String ints(int[] a) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < a.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(a[i]);
        }
        return sb.append(']').toString();
    }

    static String value(Object v) {
        if (v == null) return "null";
        if (v instanceof Integer) return "I:" + v;
        if (v instanceof Long) return "J:" + v;
        if (v instanceof Boolean) return "Z:" + v;
        if (v instanceof int[]) return "[I:" + ints((int[]) v);
        if (v instanceof Object[]) {
            Object[] a = (Object[]) v;
            StringBuilder sb = new StringBuilder("[L:[");
            for (int i = 0; i < a.length; i++) {
                if (i > 0) sb.append(',');
                sb.append(a[i] == null ? "null" : a[i].getClass().getName());
            }
            return sb.append("]").toString();
        }
        return v.getClass().getName();
    }

    static void instanceFields(Class<?> c, String prefix, Object o, List<String> out) throws Exception {
        Field[] fs = c.getDeclaredFields();
        Arrays.sort(fs, (a, b) -> a.getName().compareTo(b.getName()));
        for (Field f : fs) {
            if (Modifier.isStatic(f.getModifiers())) continue;
            f.setAccessible(true);
            out.add(prefix + f.getName() + "=" + value(f.get(o)));
        }
    }

    static String fields(Object o) throws Exception {
        List<String> out = new ArrayList<>();
        instanceFields(o.getClass(), "", o, out);
        Class<?> sup = o.getClass().getSuperclass();
        if (sup != Object.class) instanceFields(sup, sup.getName() + ".", o, out);
        return String.join(" ", out);
    }

    static String table(String name, int[] a) {
        if (a == null) return name + "=null";
        return name + "=#" + id(a) + value(a);
    }

    static String table2(String name, int[][] a) {
        if (a == null) return name + "=null";
        StringBuilder sb = new StringBuilder(name).append("=#").append(id(a)).append('[');
        for (int i = 0; i < a.length; i++) {
            if (i > 0) sb.append(',');
            if (a[i] == null) sb.append("null");
            else sb.append('#').append(id(a[i])).append(ints(a[i]));
        }
        return sb.append(']').toString();
    }

    static String statics() throws Exception {
        return String.join(" ",
            table("f", kb.f),
            table2("i", (int[][]) kbI.get(null)),
            table("q", kb.q),
            table("r", kb.r),
            table2("t", (int[][]) kbT.get(null)),
            table("u", kb.u),
            table("v", kb.v));
    }

    static String error(Throwable t) {
        while (t instanceof InvocationTargetException) t = t.getCause();
        if (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof NegativeArraySizeException) return "nase";
        if (t instanceof ArithmeticException) return "arith";
        throw new RuntimeException("unexpected exception", t);
    }

    static Object construct(String cls) {
        switch (cls) {
            case "ec": return new ec();
            case "hk": return new hk();
            case "nf": return new nf();
            case "pk": return new pk();
            case "mh": return new mh();
            case "jg": return new jg();
            default: throw new IllegalArgumentException(cls);
        }
    }

    static int[] staticArray(String s) {
        switch (s) {
            case "f": return kb.f;
            case "q": return kb.q;
            case "r": return kb.r;
            case "u": return kb.u;
            case "v": return kb.v;
            default: throw new IllegalArgumentException(s);
        }
    }

    public static void main(String[] args) throws Exception {
        kbI = kb.class.getDeclaredField("i");
        kbI.setAccessible(true);
        kbT = kb.class.getDeclaredField("t");
        kbT.setAccessible(true);

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = in.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            String[] p = line.split(" ");
            String result;
            switch (p[0]) {
                case "kb": {
                    int[] a = new int[20];
                    for (int i = 1; i <= 19; i++) a[i] = Integer.parseInt(p[i]);
                    String r;
                    try {
                        r = fields(new kb(a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], a[12], a[13], a[14], a[15], a[16], a[17], a[18], a[19]));
                    } catch (RuntimeException e) {
                        r = error(e);
                    }
                    result = r + " | " + statics();
                    break;
                }
                case "ra": {
                    String r;
                    try {
                        r = fields(new ra(Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3])));
                    } catch (RuntimeException e) {
                        r = error(e);
                    }
                    result = r;
                    break;
                }
                case "ma": {
                    int[] a = new int[7];
                    for (int i = 1; i <= 6; i++) a[i] = Integer.parseInt(p[i]);
                    String r;
                    try {
                        r = fields(new ma(a[1], a[2], a[3], a[4], a[5], a[6], p[7].equals("1")));
                    } catch (RuntimeException e) {
                        r = error(e);
                    }
                    result = r;
                    break;
                }
                case "new": {
                    String r;
                    try {
                        r = fields(construct(p[1]));
                    } catch (RuntimeException e) {
                        r = error(e);
                    }
                    result = r;
                    break;
                }
                case "poke": {
                    String r = "ok";
                    try {
                        staticArray(p[1])[Integer.parseInt(p[2])] = Integer.parseInt(p[3]);
                    } catch (RuntimeException e) {
                        r = error(e);
                    }
                    result = r + " | " + statics();
                    break;
                }
                case "unload": {
                    String r = "ok";
                    try {
                        kb.a();
                    } catch (RuntimeException e) {
                        r = error(e);
                    }
                    result = r + " | " + statics();
                    break;
                }
                case "statics":
                    result = statics();
                    break;
                default:
                    throw new IllegalArgumentException("unknown op " + line);
            }
            out.append(result).append('\n');
        }
        System.out.print(out);
        System.out.flush();
    }
}
