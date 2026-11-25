import java.awt.Canvas;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Rectangle;
import java.awt.Shape;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.nio.charset.StandardCharsets;

// Differential oracle for oh (PixMap), ck (ImageProducerPixMap), wc (BufferedImagePixMap) and the factory
// bj.a(IILjava/awt/Component;I)Loh; (PixMap.create). It drives the real client.jar classes (compiled into the default
// package next to client.jar, so package-private members are called directly; ck.A through reflection) on a headless
// java.awt.Canvas, and draws into the Graphics of a TYPE_INT_ARGB BufferedImage that stands for the screen.
//
// Reads one operation per line on stdin and prints one line per operation:
//   <index> <op> <result> <pixmap state> <td state> <screen hash> <graphics clip>
// result is ok or the simple name of the Java exception. The obfuscator wraps RuntimeExceptions thrown in bj.a and
// in ck's methods as g (od.a keeps the original in g.a, one level deep); the oracle unwraps it. wc rethrows unchanged.
//
// Operations:
//   make <bj|ck|wc> <height> <width> [null]  bj = the factory; ck/wc = new + init (cur is set before init, so the
//                                            state a throwing init leaves behind is reported); null = no Component
//   fill <seed>                              write a pattern into cur.n (the array td is bound to)
//   draw <x> <y> / drawnull <x> <y>          oh.a(IIILjava/awt/Graphics;)V with the screen Graphics / null
//   clip <h> <w> <x> <y> / clipnull ...      oh.a(BIIIILjava/awt/Graphics;)V with the screen Graphics / null
//   gset/grect <x> <y> <w> <h>, gnone, newg  Graphics.setClip / clipRect / setClip(null) / a fresh Graphics
//   bind                                     oh.b(I)V
//   rebind <w> <h>                           td.a([III)V with a fresh array
//   pclip <l> <t> <r> <b>                    td.b(IIII)V
//   reset                                    fill the screen with the sentinel
//
// Dummy arguments: bj.a needs var0 < -56, ck.a(IILjava/awt/Component;B)V and wc's need var4 <= -16, the draws 1000
// and -6, oh.b 0 (the values the client passes: p.run -62, bj.a -34 / -83, client.d / vg 1000 and -6, ph/oc 0).
//
// Usage: javac -cp client.jar -d <dir> PixMapOracle.java
//        java -Djava.awt.headless=true -cp client.jar<sep><dir> PixMapOracle < script
public class PixMapOracle {
    static final int SW = 120;
    static final int SH = 90;
    static final int SENTINEL = 0x11223344;

    static BufferedImage screen = new BufferedImage(SW, SH, BufferedImage.TYPE_INT_ARGB);
    static Graphics g;
    static Canvas canvas = new Canvas();
    static oh cur;
    static Field consumer;

    static int hash(int[] a) {
        int h = 1;
        for (int v : a) h = h * 31 + v;
        return h;
    }

    static int pattern(int i, int seed) {
        return (i * 0x2545F491) ^ (seed * 0x27D4EB2F);
    }

    static String classify(Throwable t) {
        while (t instanceof InvocationTargetException) t = t.getCause();
        if (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        return t.getClass().getSimpleName();
    }

    static String screenState() {
        int[] px = new int[SW * SH];
        screen.getRGB(0, 0, SW, SH, px, 0, SW);
        return Integer.toString(hash(px));
    }

    static String clipState() {
        Shape clip = g.getClip();
        if (clip == null) return "noclip";
        Rectangle r = clip.getBounds();
        return r.x + "," + r.y + "," + r.width + "," + r.height;
    }

    static String pixMapState() throws Exception {
        if (cur == null) return "nocur";
        String cons = "-";
        if (cur instanceof ck) cons = consumer.get(cur) != null ? "consumer" : "noconsumer";
        return cur.getClass().getName() + ":" + (cur.n == null ? "null" : Integer.toString(cur.n.length)) + ":" + cur.e + ":" + cur.i + ":" + cons
            + ":" + (cur.b == null ? "noimage" : "image");
    }

    static String pix2dState() {
        String pixels = td.g == null ? "null" : (cur != null && td.g == cur.n ? "own:" : "other:") + td.g.length + ":" + hash(td.g);
        return pixels + ":" + td.c + ":" + td.i + ":" + td.e + ":" + td.b + ":" + td.h + ":" + td.d;
    }

    static void reset() {
        for (int y = 0; y < SH; y++) {
            for (int x = 0; x < SW; x++) screen.setRGB(x, y, SENTINEL);
        }
    }

    public static void main(String[] args) throws Exception {
        consumer = ck.class.getDeclaredField("A");
        consumer.setAccessible(true);
        reset();
        g = screen.createGraphics();

        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        StringBuilder out = new StringBuilder();
        String line;
        int index = 0;
        while ((line = in.readLine()) != null) {
            line = line.trim();
            if (line.isEmpty()) continue;
            String[] p = line.split(" ");
            String op = p[0];
            String result = "ok";
            try {
                switch (op) {
                    case "make": {
                        int h = Integer.parseInt(p[2]);
                        int w = Integer.parseInt(p[3]);
                        Component component = p.length > 4 && p[4].equals("null") ? null : canvas;
                        cur = null;
                        if (p[1].equals("bj")) {
                            cur = bj.a(-62, h, component, w);
                        } else if (p[1].equals("ck")) {
                            ck made = new ck();
                            cur = made;
                            made.a(h, w, component, (byte) -83);
                        } else {
                            wc made = new wc();
                            cur = made;
                            made.a(h, w, component, (byte) -34);
                        }
                        break;
                    }
                    case "fill": {
                        int seed = Integer.parseInt(p[1]);
                        for (int i = 0; i < cur.n.length; i++) cur.n[i] = pattern(i, seed);
                        break;
                    }
                    case "draw":
                        cur.a(1000, Integer.parseInt(p[1]), Integer.parseInt(p[2]), g);
                        break;
                    case "drawnull":
                        cur.a(1000, Integer.parseInt(p[1]), Integer.parseInt(p[2]), (Graphics) null);
                        break;
                    case "clip":
                        cur.a((byte) -6, Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]), g);
                        break;
                    case "clipnull":
                        cur.a((byte) -6, Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]), (Graphics) null);
                        break;
                    case "gset":
                        g.setClip(Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]));
                        break;
                    case "gnone":
                        g.setClip(null);
                        break;
                    case "grect":
                        g.clipRect(Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]));
                        break;
                    case "newg":
                        g = screen.createGraphics();
                        break;
                    case "bind":
                        cur.b(0);
                        break;
                    case "rebind": {
                        int w = Integer.parseInt(p[1]);
                        int h = Integer.parseInt(p[2]);
                        td.a(new int[w * h], w, h);
                        break;
                    }
                    case "pclip":
                        td.b(Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]));
                        break;
                    case "reset":
                        reset();
                        break;
                    default:
                        throw new IllegalStateException("unknown op " + op);
                }
            } catch (IllegalStateException e) {
                throw e;
            } catch (Throwable t) {
                result = classify(t);
            }
            out.append(index++).append(' ').append(op).append(' ').append(result).append(' ').append(pixMapState()).append(' ').append(pix2dState())
                .append(' ').append(screenState()).append(' ').append(clipState()).append('\n');
        }
        System.out.print(out);
        System.out.flush();
    }
}
