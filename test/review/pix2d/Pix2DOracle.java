import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

// Differential oracle for td (Pix2D) plus the scattered statics ea.a(IIIIII)V (Pix2D.drawLine) and
// ef.a(IIIIII)V (Pix2D.fillEllipseClipped). It drives the real client.jar classes: package-private members are
// called directly (the oracle is compiled into the default package next to client.jar), private members of td
// through reflection.
//
// Reads one operation per line on stdin and prints one line per operation on stdout:
//   <index> <op> <result> <td state> <raster hash> [extra]
// result is ok, aioobe, npe, iae or arith. A Java exception leaves whatever the method had written before it
// threw, so the state after a throwing operation is compared too. The obfuscator wraps RuntimeExceptions in
// ea/ef/aj/ic/va/t/a/al/lk as g (field a holds the original); the oracle unwraps it.
//
// Dummy arguments: ea.a needs var2 == -30374 (else it returns before drawing), ef.a needs var4 < -36 (else it
// calls ef.a(BLjava/lang/String;)V, which calls System.exit), aj.a needs 65535, ic.a 2, va.a -95, t.a 102, a.a 67.
//
// Usage: javac -cp client.jar -d <dir> Pix2DOracle.java
//        java -Djava.awt.headless=true -cp client.jar<sep><dir> Pix2DOracle < script
public class Pix2DOracle {
    static int[] buf;
    static int[] lastOffsets;
    static int[] lastLengths;

    static Method setPixel;
    static Method hlineTrans;
    static Method vlineTrans;
    static Method fillCircle;

    static int hash(int[] a) {
        int h = 1;
        for (int v : a) h = h * 31 + v;
        return h;
    }

    static String pixelState() {
        if (td.g == null) return "null";
        return (td.g == buf ? "buf:" : "other:") + td.g.length + ":" + hash(td.g);
    }

    static String maskState(int[] mask, int[] last) {
        if (mask == null) return "-";
        return (mask == last ? "" : "?") + mask.length;
    }

    static String rasterState() {
        int[][] z = we.z;
        if (z == null) return "null";
        int h = 1;
        for (int[] row : z) h = h * 31 + (row == null ? 0x5bd1e995 : hash(row));
        return z.length + ":" + h;
    }

    static int pattern(int i, int seed) {
        return (i * 0x2545F491) ^ (seed * 0x27D4EB2F);
    }

    static Method declared(Class<?> c, String name, Class<?>... args) throws Exception {
        Method m = c.getDeclaredMethod(name, args);
        m.setAccessible(true);
        return m;
    }

    static String classify(Throwable t) {
        while (t instanceof InvocationTargetException) t = t.getCause();
        if (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof IllegalArgumentException) return "iae";
        if (t instanceof ArithmeticException) return "arith";
        throw new RuntimeException("unexpected exception", t);
    }

    static int[] array(int length, String[] f, int from) {
        if (length < 0) return null;
        int[] a = new int[length];
        for (int i = 0; i < length; i++) a[i] = Integer.parseInt(f[from + i]);
        return a;
    }

    public static void main(String[] args) throws Exception {
        Class<?> I = int.class;
        setPixel = declared(td.class, "a", I, I, I);
        hlineTrans = declared(td.class, "b", I, I, I, I, I);
        vlineTrans = declared(td.class, "e", I, I, I, I, I);
        fillCircle = declared(td.class, "c", I, I, I, I);

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        String line;
        int index = 0;
        while ((line = in.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            String[] f = line.split(" ");
            int[] n = new int[f.length];
            for (int i = 1; i < f.length; i++) {
                if (!f[0].equals("spans")) n[i] = Integer.parseInt(f[i]);
            }
            String extra = "";
            String result = "ok";
            try {
                switch (f[0]) {
                    case "buf": {
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
                    case "intersect": td.a(n[1], n[2], n[3], n[4]); break;
                    case "resetclip": td.c(); break;
                    case "save": {
                        int[] a = n[1] < 0 ? null : new int[n[1]];
                        if (a != null) java.util.Arrays.fill(a, 0x55555555);
                        try {
                            td.b(a);
                        } finally {
                            if (a != null) {
                                StringBuilder s = new StringBuilder(" [");
                                for (int i = 0; i < a.length; i++) s.append(i == 0 ? "" : ",").append(a[i]);
                                extra = s.append(']').toString();
                            }
                        }
                        break;
                    }
                    case "restore": {
                        int[] a = n[1] < 0 ? null : new int[n[1]];
                        if (a != null) for (int i = 0; i < a.length && i < 4; i++) a[i] = n[2 + i];
                        td.a(a);
                        break;
                    }
                    case "mask": {
                        lastOffsets = n[1] < 0 ? null : new int[n[1]];
                        lastLengths = n[2] < 0 ? null : new int[n[2]];
                        td.a(lastOffsets, lastLengths);
                        break;
                    }
                    case "clearmask": td.d(); break;
                    case "cls": td.b(); break;
                    case "spans": {
                        int x = Integer.parseInt(f[1]), y = Integer.parseInt(f[2]), c = Integer.parseInt(f[3]);
                        int no = Integer.parseInt(f[4]), nl = Integer.parseInt(f[5]);
                        int[] off = array(no, f, 6);
                        int[] len = array(nl, f, 6 + Math.max(no, 0));
                        td.a(x, y, c, off, len);
                        break;
                    }
                    case "pixel": setPixel.invoke(null, n[1], n[2], n[3]); break;
                    case "hline": td.d(n[1], n[2], n[3], n[4]); break;
                    case "vline": td.e(n[1], n[2], n[3], n[4]); break;
                    case "hlinet": hlineTrans.invoke(null, n[1], n[2], n[3], n[4], n[5]); break;
                    case "vlinet": vlineTrans.invoke(null, n[1], n[2], n[3], n[4], n[5]); break;
                    case "rect": td.c(n[1], n[2], n[3], n[4], n[5]); break;
                    case "fillrect": td.d(n[1], n[2], n[3], n[4], n[5]); break;
                    case "fillrectt": td.b(n[1], n[2], n[3], n[4], n[5], n[6]); break;
                    case "rectt": td.c(n[1], n[2], n[3], n[4], n[5], n[6]); break;
                    case "circle": fillCircle.invoke(null, n[1], n[2], n[3], n[4]); break;
                    case "circlet": td.a(n[1], n[2], n[3], n[4], n[5]); break;
                    case "line": td.f(n[1], n[2], n[3], n[4], n[5]); break;
                    case "thick":
                        try {
                            td.a(n[1], n[2], n[3], n[4], n[5], n[6]);
                        } finally {
                            extra = " hclip=" + (dc.j ? 1 : 0);
                        }
                        break;
                    case "r3d": dc.d(); break;
                    case "origin": dc.c(n[1], n[2]); break;
                    case "trans": dc.e = n[1]; break;
                    case "raster": {
                        if (n[2] < 0) {
                            we.z = null;
                        } else {
                            we.z = new int[n[2]][n[1]];
                            int k = 0;
                            for (int[] row : we.z) for (int i = 0; i < row.length; i++) row[i] = pattern(k++, n[4]);
                            if (n[3] >= 0 && n[3] < n[2]) we.z[n[3]] = null;
                        }
                        break;
                    }
                    case "rclip": wa.j = n[1]; gg.I = n[2]; ia.m = n[3]; sf.d = n[4]; break;
                    case "drawline": ea.a(n[1], n[2], -30374, n[3], n[4], n[5]); break;
                    case "ellipse": ef.a(n[1], n[2], n[3], n[4], -50, n[5]); break;
                    case "hclamp": extra = " " + aj.a(n[1], n[2], n[3], 65535); break;
                    case "hfill": {
                        int[][] z = we.z;
                        ic.a(2, n[1], z[n[2]], n[3], n[4]);
                        break;
                    }
                    case "hvline": va.a(n[1], n[2], (byte) -95, n[3], n[4]); break;
                    case "hhline": t.a(n[1], (byte) 102, n[2], n[3], n[4]); break;
                    case "hbres": a.a(n[1], (byte) 67, n[2], n[3], n[4], n[5]); break;
                    default: throw new IllegalStateException("unknown op " + f[0]);
                }
            } catch (IllegalStateException e) {
                throw e;
            } catch (Throwable e) {
                result = classify(e);
            }
            out.append(index++).append(' ').append(f[0]).append(' ').append(result)
                .append(' ').append(td.c).append(' ').append(td.i).append(' ').append(pixelState())
                .append(' ').append(td.e).append(' ').append(td.b).append(' ').append(td.h).append(' ').append(td.d)
                .append(' ').append(maskState(td.f, lastOffsets)).append('/').append(maskState(td.a, lastLengths))
                .append(' ').append(rasterState()).append(extra).append('\n');
        }
        System.out.print(out);
        System.out.flush();
    }
}
