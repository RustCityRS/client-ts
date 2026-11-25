import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;

// Differential oracle for the scene-graph entity classes of client.jar: kb (Ground), ra (Square), ma (QuickGround)
// and the no-argument entities ec/hk/nf/pk/mh/jg (Sprite/Wall/Decor/GroundDecor/GroundObject/Occlude). Everything is
// reached by reflection (this file runs in the source launcher, so it cannot touch package-private members directly).
//
// Reads one operation per line on stdin and prints exactly one result line per operation on stdout:
//   kb a1 .. a19     construct kb, print its fields (obfuscated names, sorted) or the exception
//   ra l x z         construct ra, print its fields
//   ma a1 .. a6 b    construct ma, print its fields
//   new <cls>        construct a no-argument entity, print its fields
//   unload           call kb.a()V, then print kb's statics
//   statics          print kb's statics
// Run: java -Djava.awt.headless=true -cp client.jar EntitiesOracle.java
class EntitiesOracle {
    static String value(Object v) {
        if (v == null) return "null";
        if (v instanceof int[]) {
            int[] a = (int[]) v;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) {
                if (i > 0) sb.append(',');
                sb.append(a[i]);
            }
            return sb.append(']').toString();
        }
        if (v instanceof int[][]) {
            int[][] a = (int[][]) v;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) {
                if (i > 0) sb.append(',');
                sb.append(value(a[i]));
            }
            return sb.append(']').toString();
        }
        if (v instanceof Object[]) {
            Object[] a = (Object[]) v;
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < a.length; i++) {
                if (i > 0) sb.append(',');
                sb.append(a[i] == null ? "null" : "obj");
            }
            return sb.append(']').toString();
        }
        if (v instanceof Integer || v instanceof Long || v instanceof Boolean) return v.toString();
        return "obj";
    }

    // Instance fields declared by the class itself (not jf's), sorted by obfuscated name.
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

    static String kbStatics(Class<?> kb) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (String name : new String[] {"f", "i", "q", "r", "t", "u", "v"}) {
            Field f = kb.getDeclaredField(name);
            f.setAccessible(true);
            if (sb.length() > 0) sb.append(' ');
            sb.append(name).append('=').append(value(f.get(null)));
        }
        return sb.toString();
    }

    static String error(Throwable t) {
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof NegativeArraySizeException) return "nase";
        if (t instanceof ArithmeticException) return "arith";
        return "error:" + t;
    }

    static Class<?>[] ints(int n) {
        Class<?>[] c = new Class<?>[n];
        java.util.Arrays.fill(c, int.class);
        return c;
    }

    public static void main(String[] argv) throws Exception {
        Class<?> kb = Class.forName("kb");
        Class<?> ra = Class.forName("ra");
        Class<?> ma = Class.forName("ma");
        Constructor<?> kbNew = kb.getDeclaredConstructor(ints(19));
        kbNew.setAccessible(true);
        Constructor<?> raNew = ra.getDeclaredConstructor(ints(3));
        raNew.setAccessible(true);
        Class<?>[] maArgs = {int.class, int.class, int.class, int.class, int.class, int.class, boolean.class};
        Constructor<?> maNew = ma.getDeclaredConstructor(maArgs);
        maNew.setAccessible(true);
        Method kbUnload = kb.getDeclaredMethod("a");
        kbUnload.setAccessible(true);

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        String line;
        while ((line = in.readLine()) != null) {
            if (line.isEmpty()) continue;
            String[] p = line.split(" ");
            String result;
            try {
                switch (p[0]) {
                    case "kb": {
                        Object[] a = new Object[19];
                        for (int i = 0; i < 19; i++) a[i] = Integer.parseInt(p[i + 1]);
                        result = fields(kbNew.newInstance(a));
                        break;
                    }
                    case "ra":
                        result = fields(raNew.newInstance(Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3])));
                        break;
                    case "ma": {
                        Object[] a = new Object[7];
                        for (int i = 0; i < 6; i++) a[i] = Integer.parseInt(p[i + 1]);
                        a[6] = p[7].equals("1");
                        result = fields(maNew.newInstance(a));
                        break;
                    }
                    case "new": {
                        Constructor<?> c = Class.forName(p[1]).getDeclaredConstructor();
                        c.setAccessible(true);
                        result = fields(c.newInstance());
                        break;
                    }
                    case "unload":
                        kbUnload.invoke(null);
                        result = kbStatics(kb);
                        break;
                    case "statics":
                        result = kbStatics(kb);
                        break;
                    default:
                        result = "error:unknown op";
                }
            } catch (InvocationTargetException e) {
                result = error(e.getCause());
            }
            out.append(result).append('\n');
        }
        System.out.print(out);
        System.out.flush();
    }
}
