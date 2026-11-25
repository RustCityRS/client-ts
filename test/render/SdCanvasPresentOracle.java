import java.awt.Canvas;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.Arrays;

// Drive the original SD wc and HD ti BufferedImage PixScreens against a real AWT Graphics.
public final class SdCanvasPresentOracle {
    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("hd");
        Class<?> c = Class.forName(hd ? "ti" : "wc");
        Object screen = c.getDeclaredConstructor().newInstance();
        Canvas component = new Canvas();
        Field pixels = c.getSuperclass().getDeclaredField(hd ? "e" : "n");
        Method init = hd ? c.getDeclaredMethod("a", int.class, boolean.class, int.class, Component.class)
                         : c.getDeclaredMethod("a", int.class, int.class, Component.class, byte.class);
        Method draw = hd ? c.getDeclaredMethod("a", int.class, int.class, Graphics.class, int.class)
                         : c.getDeclaredMethod("a", int.class, int.class, int.class, Graphics.class);
        Method clip = hd ? c.getDeclaredMethod("a", int.class, int.class, int.class, int.class, Graphics.class, int.class)
                         : c.getDeclaredMethod("a", byte.class, int.class, int.class, int.class, int.class, Graphics.class);
        BufferedImage front = null;
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        DataOutputStream out = new DataOutputStream(new BufferedOutputStream(System.out));
        for (String line; (line = in.readLine()) != null;) {
            int[] a = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int w = a[0], h = a[1], canvasW = a[2], canvasH = a[3], seed = a[4];
            if (front == null || front.getWidth() != canvasW || front.getHeight() != canvasH) {
                front = new BufferedImage(canvasW, canvasH, BufferedImage.TYPE_INT_RGB);
            }
            if (hd) init.invoke(screen, h, false, w, component);
            else init.invoke(screen, h, w, component, (byte)-34);
            int[] words = (int[])pixels.get(screen);
            for (int i = 0; i < words.length; i++) words[i] = (i * 0x2545F491) ^ (seed * 0x27D4EB2F);
            Graphics g = front.getGraphics();
            try {
                if (a[5] == -1) {
                    if (hd) draw.invoke(screen, 0, 0, g, 0);
                    else draw.invoke(screen, 1000, 0, 0, g);
                }
                for (int i = 0; i < a[5]; i++) {
                    int p = 6 + i * 4, x = a[p], y = a[p+1], cw = a[p+2], ch = a[p+3];
                    if (hd) clip.invoke(screen, cw, x, 6260, ch, g, y);
                    else clip.invoke(screen, (byte)-6, ch, cw, x, y, g);
                }
            } finally { g.dispose(); }
            for (int color : front.getRGB(0, 0, canvasW, canvasH, null, 0, canvasW)) out.writeInt(color);
        }
        out.flush();
    }
}
