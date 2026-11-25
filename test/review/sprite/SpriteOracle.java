import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;

// Differential oracle for vc (AbstractSprite), rh (SoftwareSprite) and vh (SoftwareAlphaSprite). It drives the
// real client.jar classes: package-private members are called directly (the oracle is compiled into the default
// package next to client.jar), the private static blitters through reflection.
//
// Reads one operation per line on stdin and prints one line per operation on stdout:
//   <index> <op> <result> <td state> <sprite state> [extra]
// result is ok, aioobe, npe, ise, arith or nase. A Java exception leaves whatever the method had written before
// it threw, so the state after a throwing operation is compared too. vc.a(IIZII)V, fa.a and the SpriteLoader
// statics wrap RuntimeExceptions as g (field a holds the original); the oracle unwraps it.
//
// Real sprites come from cache archive 8: "idx" and "grp" carry the JS5 containers (base64), "arch" builds an al
// over them, and "cache" decodes a group with the gamepack's own decoder (ja.a + ed.a, ja.a + pk.b, or fa.a), each
// called with a dummy value one of its real call sites passes.
//
// Usage: javac -cp client.jar -d <dir> SpriteOracle.java
//        java -Djava.awt.headless=true -cp client.jar<sep><dir> SpriteOracle < script
public class SpriteOracle {
    static int[] buf;
    static rh sprite;
    static int[] created;
    static byte[] index8;
    static final HashMap<Integer, byte[]> groups8 = new HashMap<>();
    static al archive;

    // ud is the JS5 resource provider that al reads from; this one serves the containers the script supplied.
    static final class Provider extends ud {
        byte[] a(int unused, int group) {
            return groups8.get(group);
        }

        void b(int unused, int group) {
        }

        db b(int unused) {
            return index8 == null ? null : new db(index8, q.a(0, index8, index8.length));
        }

        int c(int group, int unused) {
            return 100;
        }
    }

    static int hash(int[] a) {
        int h = 1;
        for (int v : a) h = h * 31 + v;
        return h;
    }

    static int pattern(int i, int seed) {
        return (i * 0x2545F491) ^ (seed * 0x27D4EB2F);
    }

    // mode 0: rh pixels (1 in 8 transparent). mode 1: vh pixels (also alpha 0 and alpha 255 runs).
    static int[] spritePixels(int length, int seed, int mode) {
        if (length < 0) return null;
        int[] a = new int[length];
        for (int i = 0; i < length; i++) {
            int v = pattern(i, seed);
            if ((v & 0x700) == 0) {
                v = 0;
            } else if (mode == 1) {
                int k = v & 0x3000;
                if (k == 0) v &= 0xFFFFFF;
                else if (k == 0x1000) v |= 0xFF000000;
            }
            a[i] = v;
        }
        return a;
    }

    // Line tables for the masked draws: values in [lo, lo + range).
    static int[] table(int length, int seed, int lo, int range) {
        if (length < 0) return null;
        int[] a = new int[length];
        for (int i = 0; i < length; i++) a[i] = lo + (pattern(i, seed) >>> 8) % range;
        return a;
    }

    static String arrayState(int[] a) {
        if (a == null) return "null";
        String who = a == buf ? "buf:" : a == created ? "spr:" : sprite != null && a == sprite.I ? "cur:" : "other:";
        return who + a.length + ":" + hash(a);
    }

    static String classify(Throwable t) {
        while (t instanceof InvocationTargetException) t = t.getCause();
        if (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof IllegalStateException) return "ise";
        if (t instanceof IllegalArgumentException) return "iae";
        if (t instanceof ArithmeticException) return "arith";
        if (t instanceof NegativeArraySizeException) return "nase";
        throw new RuntimeException("unexpected exception", t);
    }

    static Method declared(Class<?> c, String name, int ints) throws Exception {
        Class<?>[] args = new Class<?>[2 + ints];
        args[0] = int[].class;
        args[1] = int[].class;
        for (int i = 0; i < ints; i++) args[2 + i] = int.class;
        Method m = c.getDeclaredMethod(name, args);
        m.setAccessible(true);
        return m;
    }

    static Object[] staticArgs(int[] n, int ints) {
        Object[] a = new Object[2 + ints];
        a[0] = buf;
        a[1] = sprite == null ? null : sprite.I;
        for (int i = 0; i < ints; i++) a[2 + i] = n[2 + i];
        return a;
    }

    // The integers the rotations derive from Math.sin/Math.cos, over every input they can see, folded into one hash per
    // family. The doubles themselves differ in the last bit between HotSpot's intrinsics and other libms for about
    // 3% of these inputs, so the hash covers the converted values the port uses: kind 0 is rh.a(IIIIII)V,
    // (int) Math.floor(sin((angle & 0xffff) * 9.587379924285257E-5) * scale + 0.5) for all 65536 angles and a spread
    // of scales up to the int limits; kind 1 the masked rotations, (int) (sin(angle / 326.11) * 65536.0) for -50..4149;
    // kind 2 rh.a(IIIIIIDI)V, (int) (sin(m / 1000.0) * 65536.0) for every milliradian in -10..10.
    static final int[] SCALES = {1, 2, 3, 7, 16, 100, 255, 256, 1000, 2048, 4095, 4096, 4097, 8192, 9000, 16384, 65536, 1 << 20, 1 << 24, -1, -4096, Integer.MAX_VALUE, Integer.MIN_VALUE};

    static int trig(int kind) {
        int h = 1;
        int count = kind == 0 ? 65536 : kind == 1 ? 4200 : 20001;
        for (int i = 0; i < count; i++) {
            if (kind == 0) {
                double x = i * 9.587379924285257E-5;
                for (int scale : SCALES) {
                    h = h * 31 + (int) Math.floor(Math.sin(x) * scale + 0.5);
                    h = h * 31 + (int) Math.floor(Math.cos(x) * scale + 0.5);
                }
            } else {
                double x = kind == 1 ? (i - 50) / 326.11 : (i - 10000) / 1000.0;
                h = h * 31 + (int) (Math.sin(x) * 65536.0);
                h = h * 31 + (int) (Math.cos(x) * 65536.0);
            }
        }
        return h;
    }

    public static void main(String[] args) throws Exception {
        Method[] statics = {
            declared(rh.class, "a", 6), // 0 plotQuick
            declared(rh.class, "a", 7), // 1 plot
            declared(rh.class, "a", 8), // 2 tranSprite
            declared(rh.class, "a", 10), // 3 plotScaled
            declared(rh.class, "a", 11), // 4 plotScaledAlpha
            declared(rh.class, "b", 7), // 5 plotMirrored
            declared(vh.class, "b", 8), // 6 tranSprite
            declared(vh.class, "b", 10), // 7 plotScaled
            declared(vh.class, "b", 11), // 8 tranSpriteScaled
            declared(vh.class, "c", 7), // 9 plotHflip
            declared(vh.class, "d", 7) // 10 plot
        };
        int[] staticInts = {6, 7, 8, 10, 11, 7, 8, 10, 11, 7, 7};

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        String line;
        int index = 0;
        while ((line = in.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            String[] f = line.split(" ");
            boolean data = f[0].equals("idx") || f[0].equals("grp");
            int[] n = new int[f.length];
            if (!data) for (int i = 1; i < f.length; i++) n[i] = Integer.parseInt(f[i]);
            String extra = "";
            String result = "ok";
            try {
                switch (f[0]) {
                    case "idx": index8 = Base64.getDecoder().decode(f[1]); break;
                    case "grp": groups8.put(Integer.parseInt(f[1]), Base64.getDecoder().decode(f[2])); break;
                    case "arch": archive = new al(new Provider(), false, true); break;
                    case "cache": {
                        created = null;
                        sprite = null;
                        if (n[1] == 2) {
                            // fa.a(ILal;II)Lrh;: callers pass -119, -121 and -123 (the guard returns null above -117).
                            sprite = fa.a(-119, archive, n[2], n[3]);
                            extra = " " + (sprite != null);
                        } else {
                            // ja.a(BIILal;)Z: fa.a passes -26 (44 % ((b - 24) / 40) throws for -15..63).
                            boolean loaded = ja.a((byte) -26, n[3], n[2], archive);
                            extra = " " + loaded;
                            if (loaded) {
                                if (n[1] == 0) {
                                    // ed.a(I)[Lrh;: returns null unless the dummy is 17100.
                                    rh[] all = ed.a(17100);
                                    sprite = all[n[4] % all.length];
                                    extra += " " + all.length;
                                } else {
                                    // pk.b(I)Lrh;: the dummy only feeds a junk computation; gi.a passes 255.
                                    sprite = pk.b(255);
                                }
                            }
                        }
                        created = sprite == null ? null : sprite.I;
                        break;
                    }
                    case "trig": extra = " " + trig(n[1]); break;
                    case "clipmask": td.a(table(n[1], n[2], n[3], n[4]), table(n[5], n[6], n[7], n[8])); break;
                    case "noclipmask": td.d(); break;
                    case "fb": {
                        buf = n[1] < 0 ? null : new int[n[1]];
                        if (buf != null) for (int i = 0; i < buf.length; i++) buf[i] = pattern(i, n[4]);
                        td.a(buf, n[2], n[3]);
                        break;
                    }
                    case "fill":
                        if (buf != null) for (int i = 0; i < buf.length; i++) buf[i] = pattern(i, n[1]);
                        break;
                    case "setclip": td.b(n[1], n[2], n[3], n[4]); break;
                    case "rawclip": td.e = n[1]; td.b = n[2]; td.h = n[3]; td.d = n[4]; break;
                    case "target": td.a(buf, n[1], n[2]); break;
                    case "new": {
                        created = spritePixels(n[8], n[9], n[1]);
                        sprite = n[1] == 0 ? new rh(n[2], n[3], n[4], n[5], n[6], n[7], created) : new vh(n[2], n[3], n[4], n[5], n[6], n[7], created);
                        break;
                    }
                    case "newwh": {
                        created = null;
                        sprite = null;
                        sprite = new rh(n[1], n[2]);
                        created = sprite.I;
                        int[] p = spritePixels(created.length, n[3], 0);
                        System.arraycopy(p, 0, created, 0, p.length);
                        break;
                    }
                    case "draw": sprite.c(n[1], n[2]); break;
                    case "opaque": sprite.a(n[1], n[2]); break;
                    case "alpha": sprite.a(n[1], n[2], n[3]); break;
                    case "hfd": sprite.b(n[1], n[2]); break;
                    case "scaled": sprite.a(n[1], n[2], n[3], n[4]); break;
                    case "scaleda": sprite.a(n[1], n[2], n[3], n[4], n[5]); break;
                    case "rot": sprite.a(n[1], n[2], n[3], n[4], n[5], n[6]); break;
                    // vc.a(IIZII)V: both call sites in lf.a pass true (false only sets F = -92 first).
                    case "rotc": sprite.a(n[1], n[2], true, n[3], n[4]); break;
                    case "rotd": sprite.a(n[1], n[2], n[3], n[4], n[5], n[6], n[7] / 1000.0, n[8]); break;
                    case "rotm":
                    case "rotmo": {
                        int[] starts = table(n[9], n[10], n[11], n[12]);
                        int[] widths = table(n[13], n[14], n[15], n[16]);
                        if (f[0].equals("rotm")) sprite.a(n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8], starts, widths);
                        else sprite.b(n[1], n[2], n[3], n[4], n[5], n[6], n[7], n[8], starts, widths);
                        break;
                    }
                    case "masked": {
                        int[] starts = table(n[3], n[4], n[5], n[6]);
                        int[] widths = table(n[7], n[8], n[9], n[10]);
                        sprite.a(n[1], n[2], starts, widths);
                        break;
                    }
                    case "argb": {
                        int[] a = sprite.a();
                        extra = " " + a.length + ":" + hash(a);
                        break;
                    }
                    case "bind": sprite.b(); break;
                    case "trim": sprite.c(); break;
                    case "trimp": sprite.c(n[1]); break;
                    case "outline": sprite.d(n[1]); break;
                    case "shadow": sprite.e(n[1]); break;
                    case "vflip": sprite.d(); break;
                    case "hflip": sprite.e(); break;
                    case "rgb": sprite.b(n[1], n[2], n[3]); break;
                    case "static": {
                        int which = n[1];
                        statics[which].invoke(null, staticArgs(n, staticInts[which]));
                        break;
                    }
                    default:
                        throw new RuntimeException("unknown op " + f[0]);
                }
            } catch (Throwable t) {
                result = classify(t);
            }
            out.append(index++).append(' ').append(f[0]).append(' ').append(result).append(' ');
            out.append(td.c).append(' ').append(td.i).append(' ').append(arrayState(td.g)).append(' ');
            out.append(td.e).append(' ').append(td.b).append(' ').append(td.h).append(' ').append(td.d).append(' ');
            out.append(td.f == null ? "null" : td.f.length + ":" + hash(td.f)).append(' ');
            out.append(td.a == null ? "null" : td.a.length + ":" + hash(td.a)).append(' ');
            if (sprite == null) {
                out.append("nosprite");
            } else {
                out.append(sprite instanceof vh ? "vh " : "rh ");
                out.append(sprite.O).append(' ').append(sprite.D).append(' ').append(sprite.F).append(' ').append(sprite.C).append(' ');
                out.append(sprite.B).append(' ').append(sprite.A).append(' ').append(arrayState(sprite.I));
            }
            out.append(extra).append('\n');
        }
        System.out.print(out);
        System.out.flush();
    }
}
