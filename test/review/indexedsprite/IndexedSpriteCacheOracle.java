import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

// Differential oracle for si (AbstractIndexedSprite) and ch (SoftwareIndexedSprite), driven with real archive 8
// sprites as well as explicit synthetic ones. It runs the real client.jar classes: the package-private ch
// constructor, the si fields and the ch instance methods directly (the oracle is compiled into the default package
// next to client.jar), the private palette ch.z and the four private static plot routines through reflection.
//
// Real sprites come in as the sprite file bytes of an archive 8 group. They go through the real decoder og.a and one
// of the real ch builders, exactly like the client's loaders: vi.e (ch[]), qd.b (si[]), uk.b(int) (one ch, the int
// indexes df.H) or rk.b (one si). All frames of one group share the decoder's palette array, as in the client.
//
// Dummy arguments: og.a's byte must be >= 25 (55, as ja.a passes), vi.e's int > 18 (74), qd.b's int >= 8 (86) and
// rk.b's byte > 118 (120). Exceptions from od.a-wrapped methods arrive as g; the oracle unwraps g.a. ch itself has
// no od.a wrappers.
//
// Reads one operation per line on stdin and prints one line per operation:
//   <index> <op> <result> <framebuffer> <sprite> [<extra>]
// result is ok, aioobe, npe, arith or neg. A throwing operation keeps whatever it wrote before it threw, so the
// framebuffer and sprite state after it are compared too.
//
// Usage: javac -cp client.jar -d <dir> IndexedSpriteCacheOracle.java
//        java -Djava.awt.headless=true -cp client.jar<sep><dir> IndexedSpriteCacheOracle < script
public class IndexedSpriteCacheOracle {
    static ch sprite;
    static si[] frames;
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

    static String digest(si s) throws Exception {
        if (s == null) return "null";
        ch c = (ch) s;
        return c.b + "," + c.c + "," + c.j + "," + c.l + "," + c.n + "," + c.o + "," + bytes(c.y) + "," + ints((int[]) palette.get(c));
    }

    static String spriteState() throws Exception {
        return sprite == null ? "none" : digest(sprite);
    }

    static byte[] byteToken(String t) {
        if (t.equals("n")) return null;
        return Base64.getDecoder().decode(t.substring(1));
    }

    static int[] intToken(String t) {
        if (t.equals("n")) return null;
        ByteBuffer b = ByteBuffer.wrap(Base64.getDecoder().decode(t.substring(1)));
        int[] out = new int[b.remaining() / 4];
        for (int i = 0; i < out.length; i++) out[i] = b.getInt();
        return out;
    }

    static String classify(Throwable t) {
        while (t instanceof InvocationTargetException) t = t.getCause();
        if (t instanceof g && ((g) t).a != null) t = ((g) t).a;
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

    static String load(String[] f) throws Exception {
        og.a((byte) 55, byteToken(f[1]));
        switch (f[2]) {
            case "vi":
                frames = vi.e(74);
                break;
            case "qd":
                frames = qd.b(86);
                break;
            case "uk":
                frames = new si[] { uk.b(Integer.parseInt(f[3])) };
                break;
            case "rk":
                frames = new si[] { rk.b((byte) 120) };
                break;
            default:
                throw new IllegalStateException("bad builder " + f[2]);
        }
        StringBuilder b = new StringBuilder();
        b.append(frames.length);
        for (si s : frames) b.append(' ').append(digest(s));
        return b.toString();
    }

    public static void main(String[] args) throws Exception {
        palette = ch.class.getDeclaredField("z");
        palette.setAccessible(true);
        Class<?> I = int.class;
        plot = declared("a", int[].class, byte[].class, int[].class, I, I, I, I, I, I, I);
        plotAlpha = declared("b", int[].class, byte[].class, int[].class, I, I, I, I, I, I, I);
        plotScale = declared("a", int[].class, byte[].class, int[].class, I, I, I, I, I, I, I, I, I);
        plotScaleTinted = declared("a", int[].class, byte[].class, int[].class, I, I, I, I, I, I, I, I, I, I);

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.ISO_8859_1), 1 << 20);
        StringBuilder out = new StringBuilder();
        String line;
        int index = 0;
        while ((line = in.readLine()) != null) {
            if (line.isEmpty()) continue;
            String[] f = line.split(" ");
            String op = f[0];
            int[] v = new int[f.length];
            if (!op.equals("spr") && !op.equals("load")) {
                for (int i = 1; i < f.length; i++) v[i] = Integer.parseInt(f[i]);
            }
            String result = "ok";
            String extra = "";
            try {
                switch (op) {
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
                    case "spr":
                        sprite = new ch(Integer.parseInt(f[1]), Integer.parseInt(f[2]), Integer.parseInt(f[3]), Integer.parseInt(f[4]), Integer.parseInt(f[5]),
                            Integer.parseInt(f[6]), byteToken(f[7]), intToken(f[8]));
                        break;
                    case "load":
                        extra = " " + load(f);
                        break;
                    case "sel":
                        sprite = (ch) frames[v[1]];
                        break;
                    case "geom":
                        sprite.b = v[1];
                        sprite.c = v[2];
                        sprite.j = v[3];
                        sprite.l = v[4];
                        sprite.n = v[5];
                        sprite.o = v[6];
                        break;
                    case "fitcrop":
                        // da.a(IB)Lch;: the mapscene loader sets the canvas to the inner size before rotating.
                        sprite.c = sprite.n;
                        sprite.o = sprite.l;
                        break;
                    case "draw":
                        sprite.a(v[1], v[2]);
                        break;
                    case "vdraw": {
                        si base = sprite;
                        base.a(v[1], v[2]);
                        break;
                    }
                    case "alpha":
                        sprite.a(v[1], v[2], v[3]);
                        break;
                    case "valpha": {
                        si base = sprite;
                        base.a(v[1], v[2], v[3]);
                        break;
                    }
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
                        throw new IllegalStateException("bad op " + op);
                }
            } catch (IllegalStateException e) {
                throw e;
            } catch (Throwable t) {
                result = classify(t);
            }
            out.append(index++).append(' ').append(op).append(' ').append(result).append(' ').append(ints(td.g)).append(' ').append(spriteState()).append(extra).append('\n');
            if (out.length() > 1 << 16) {
                System.out.print(out);
                out.setLength(0);
            }
        }
        System.out.print(out);
        System.out.flush();
    }
}
