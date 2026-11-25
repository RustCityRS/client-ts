import java.awt.Canvas;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.nio.ByteBuffer;
import java.util.Arrays;
import java.util.Base64;

/** Pixel state before and after presentation in ten consecutive original client.d(0) frames. */
class WidgetFramePersistenceOracle {
    static final int W = 23, H = 17;
    static final BufferedImage screen = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
    static class Display extends Canvas {
        public Graphics getGraphics() { return screen.getGraphics(); }
    }
    static aj rect(int id, int x, int y, int width, int height, int colour) {
        aj c = new aj();
        c.Kc = id; c.n = -1; c.y = true; c.ob = 3; c.Jc = true;
        c.ib = x; c.Mb = y; c.C = width; c.H = height; c.oc = colour;
        return c;
    }
    static String bytes(int[] pixels) {
        ByteBuffer data = ByteBuffer.allocate(W * H * 4);
        for (int i = 0; i < W * H; i++) data.putInt(pixels[i] & 0xffffff);
        return Base64.getEncoder().encodeToString(data.array());
    }
    static String bits(boolean[] flags) {
        return (flags[0] ? "1" : "0") + (flags[1] ? "1" : "0");
    }
    public static void main(String[] args) throws Exception {
        client applet = WindowModeOracle.container(client.class);
        aj.kb = WindowModeOracle.container(WindowModeOracle.TestFrame.class);
        pe.S = new Display();
        rg.s = new wc();
        rg.s.a(H, W, pe.S, (byte)-34);
        hi.f = vk.rb = W; fl.l = oh.j = H; wb.db = false;
        hi.g = wd.b = qf.f = we.y = false; oa.a = 0L;
        te.g = new pb(); nc.j = new gk(); ig.t = aa.e = qh.c = -1;
        aj a = rect(0, 2, 2, 7, 4, 0x991122), b = rect(1, 12, 6, 6, 8, 0x1155cc);
        fk.ab = new aj[][]{{a, b}}; rg.b = new boolean[]{true}; hd.m = 0;
        ik.G = 2; sf.m = new boolean[100]; ce.T = new boolean[100]; n.i = new boolean[100];
        Arrays.fill(rg.s.n, 0x123456);
        int[] initial = new int[W * H]; Arrays.fill(initial, 0x123456);
        screen.setRGB(0, 0, W, H, initial, 0, W);
        for (int i = 0; i < 10; i++) {
            hh.kb = 63 + i; tf.C = i % 3 == 0 ? 10 : 30;
            sf.m[0] = i == 0 || i == 3 || i == 6 || i == 8;
            sf.m[1] = i == 0 || i == 4 || i == 5 || i == 9;
            a.oc = 0x991122 + i * 59; b.oc = 0x1155cc - i * 113;
            b.Wc = i == 4;
            applet.d(0);
            System.out.println(bytes(rg.s.n) + "|" + bytes(screen.getRGB(0,0,W,H,null,0,W)) +
                "|" + bits(sf.m) + "|" + bits(ce.T) + "|" + bits(n.i) + "|" + ik.G);
        }
    }
}
