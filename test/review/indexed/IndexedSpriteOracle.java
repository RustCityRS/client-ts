import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

// Differential oracle for si (AbstractIndexedSprite) and ch (SoftwareIndexedSprite). It drives the real client.jar
// classes: the package-private constructor, fields and instance methods directly (the oracle is compiled into the
// default package next to client.jar), the private palette ch.z and the four private static plot routines through
// reflection. ch has no od.a wrappers, so exceptions arrive unwrapped.
//
// Reads one operation per line on stdin and prints one line per operation on stdout:
//   <index> <op> <result> <framebuffer> <sprite>
// result is ok, aioobe, npe, arith or neg. A Java exception leaves whatever the method wrote before it threw, so
// the framebuffer and sprite state after a throwing operation are compared too.
//
// Usage: javac -cp client.jar -d <dir> IndexedSpriteOracle.java
//        java -Djava.awt.headless=true -cp client.jar<sep><dir> IndexedSpriteOracle < script
public class IndexedSpriteOracle {
    static ch sprite;
    static Field palette;
    static Method plot;
    static Method plotAlpha;
    static Method plotScale;
    static Method plotScaleTinted;

    static int pattern(int i, int seed) {
        return (i * 0x2545F491) ^ (seed * 0x27D4EB2F);
    }

    static String ints(int[] a) {
        if (a == null) return "null";
        int h = 1;
        for (int v : a) h = h * 31 + v;
        return a.length + ":" + h;
    }

    static String bytes(byte[] a) {
        if (a == null) return "null";
        int h = 1;
        for (byte v : a) h = h * 31 + (v & 255);
        return a.length + ":" + h;
    }

    static String spriteState() throws Exception {
        if (sprite == null) return "none";
        return sprite.b + "," + sprite.c + "," + sprite.j + "," + sprite.l + "," + sprite.n + "," + sprite.o + " " + bytes(sprite.y) + " " + ints((int[]) palette.get(sprite));
    }

    static String classify(Throwable t) {
        while (t instanceof InvocationTargetException) t = t.getCause();
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ArithmeticException) return "arith";
        if (t instanceof NegativeArraySizeException) return "neg";
        throw new RuntimeException("unexpected exception", t);
    }

    static Method declared(String name, Class<?>... args) throws Exception {
        Method m = ch.class.getDeclaredMethod(name, args);
        m.setAccessible(true);
        return m;
    }

    public static void main(String[] args) throws Exception {
        palette = ch.class.getDeclaredField("z");
        palette.setAccessible(true);
        Class<?> I = int.class;
        plot = declared("a", int[].class, byte[].class, int[].class, I, I, I, I, I, I, I);
        plotAlpha = declared("b", int[].class, byte[].class, int[].class, I, I, I, I, I, I, I);
        plotScale = declared("a", int[].class, byte[].class, int[].class, I, I, I, I, I, I, I, I, I);
        plotScaleTinted = declared("a", int[].class, byte[].class, int[].class, I, I, I, I, I, I, I, I, I, I);

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.ISO_8859_1));
        StringBuilder out = new StringBuilder();
        String line;
        int index = 0;
        while ((line = in.readLine()) != null) {
            if (line.isEmpty()) continue;
            String[] f = line.split(" ");
            int[] v = new int[f.length];
            for (int i = 1; i < f.length; i++) v[i] = Integer.parseInt(f[i]);
            String result = "ok";
            try {
                switch (f[0]) {
                    case "pix": {
                        int[] buf = null;
                        if (v[1] >= 0) {
                            buf = new int[v[1]];
                            for (int i = 0; i < v[1]; i++) buf[i] = pattern(i, v[4]);
                        }
                        td.g = buf;
                        td.c = v[2];
                        td.i = v[3];
                        break;
                    }
                    case "clip":
                        td.e = v[1];
                        td.b = v[2];
                        td.h = v[3];
                        td.d = v[4];
                        break;
                    case "spr": {
                        byte[] pixels = null;
                        if (v[7] >= 0) {
                            pixels = new byte[v[7]];
                            for (int i = 0; i < v[7]; i++) {
                                int value = (pattern(i, v[8]) >>> 8) % (v[9] + 1);
                                if ((pattern(i, v[8] ^ 0x55) >>> 29) == 0) value = 0;
                                pixels[i] = (byte) value;
                            }
                        }
                        int[] pal = null;
                        if (v[10] >= 0) {
                            pal = new int[v[10]];
                            for (int i = 0; i < v[10]; i++) pal[i] = pattern(i, v[11]);
                        }
                        sprite = new ch(v[1], v[2], v[3], v[4], v[5], v[6], pixels, pal);
                        break;
                    }
                    case "geom":
                        sprite.b = v[1];
                        sprite.c = v[2];
                        sprite.j = v[3];
                        sprite.l = v[4];
                        sprite.n = v[5];
                        sprite.o = v[6];
                        break;
                    case "draw":
                        sprite.a(v[1], v[2]);
                        break;
                    case "alpha":
                        sprite.a(v[1], v[2], v[3]);
                        break;
                    case "scale":
                        sprite.a(v[1], v[2], v[3], v[4]);
                        break;
                    case "tint":
                        sprite.a(v[1], v[2], v[3], v[4], v[5]);
                        break;
                    case "trim":
                        sprite.a();
                        break;
                    case "rot":
                        sprite.b();
                        break;
                    case "rgb":
                        sprite.b(v[1], v[2], v[3]);
                        break;
                    case "splot":
                        plot.invoke(null, td.g, sprite.y, palette.get(sprite), v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
                        break;
                    case "salpha":
                        plotAlpha.invoke(null, td.g, sprite.y, palette.get(sprite), v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
                        break;
                    case "sscale":
                        plotScale.invoke(null, td.g, sprite.y, palette.get(sprite), v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9]);
                        break;
                    case "stint":
                        plotScaleTinted.invoke(null, td.g, sprite.y, palette.get(sprite), v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10]);
                        break;
                    default:
                        throw new IllegalStateException("bad op " + f[0]);
                }
            } catch (IllegalStateException e) {
                throw e;
            } catch (Throwable t) {
                result = classify(t);
            }
            out.append(index++).append(' ').append(f[0]).append(' ').append(result).append(' ').append(ints(td.g)).append(' ').append(spriteState()).append('\n');
            if (out.length() > 1 << 16) {
                System.out.print(out);
                out.setLength(0);
            }
        }
        System.out.print(out);
        System.out.flush();
    }
}
