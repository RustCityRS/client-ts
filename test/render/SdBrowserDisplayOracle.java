import java.awt.Canvas;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.util.Arrays;

// HD gamepack, software display. Each snapshot uses the actual ti backed by vk.e.
public final class SdBrowserDisplayOracle {
    static final int W = 83, H = 49;
    static final BufferedImage front = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
    static final DataOutputStream out = new DataOutputStream(new BufferedOutputStream(System.out));
    static void snapshot() throws Exception {
        for (int color : front.getRGB(0, 0, W, H, null, 0, W)) out.writeInt(color);
    }
    static void all() {
        Graphics g = md.L.getGraphics();
        try { vd.w.a(0, 0, g, 0); } finally { g.dispose(); }
    }
    static void clip(int x, int y, int w, int h) {
        Graphics g = md.L.getGraphics();
        try { vd.w.a(w, x, 6260, h, g, y); } finally { g.dispose(); }
    }
    public static void main(String[] args) throws Exception {
        md.L = new Canvas() { public Graphics getGraphics() { return front.getGraphics(); } };
        vd.w = new ti();
        vd.w.a(H, false, W, md.L);
        for (int i = 0; i < vd.w.e.length; i++) vd.w.e[i] = i * 0x31c3eb91 ^ 0x7c568931;
        byte[] metrics = new byte[257];
        Arrays.fill(metrics, (byte)5);
        metrics[256] = 8;
        int[] zero = new int[256], widths = new int[256], heights = new int[256];
        Arrays.fill(widths, 3); Arrays.fill(heights, 5);
        byte[][] masks = new byte[256][15];
        for (int c = 0; c < 256; c++) for (int k = 0; k < 15; k++) masks[c][k] = (byte)((c+k)%3 == 0 ? 0 : 1);
        rh.h = new dd(metrics, zero, zero, widths, heights, masks);
        all(); snapshot();
        kb.c(1, 1, 80, 47, 0x9c5a1762);
        kb.a(3, 2, 45, 31, 0xabee77, 67);
        Graphics g = md.L.getGraphics();
        try {
            g.clipRect(4, 2, 40, 19);
            vd.w.a(23, 1, 6260, 7, g, 0);
            vd.w.a(31, 26, 6260, 3, g, 14);
        } finally { g.dispose(); }
        snapshot();
        kb.c(36, 28, 29, 12, 0x7f090705);
        j.a((byte)-125, true, cd.a("Please wait", (byte)-127));
        snapshot();
        kb.a(37, 30, 41, 16, 0x916b4f, 127);
        clip(40, 34, 20, 61); snapshot();
        kb.c(2, 43, 27, 3, 0xdde0f210);
        for (int value : vd.w.e) out.writeInt(value);
        kb.c(13, 30, 6, 2, 0x90549886);
        all(); snapshot();
        kb.c(19, 20, 11, 9, 0x11776655);
        all(); snapshot();
        out.flush();
    }
}
