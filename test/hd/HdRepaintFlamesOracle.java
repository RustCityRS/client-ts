import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.lang.reflect.Proxy;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.IntBuffer;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.media.opengl.GL;

public class HdRepaintFlamesOracle {
    static String trace = "";

    static String hash(int[] pixels) throws Exception {
        ByteBuffer bytes = ByteBuffer.allocate(pixels.length * 4).order(ByteOrder.LITTLE_ENDIAN);
        bytes.asIntBuffer().put(pixels);
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.array()));
    }

    static void paint(rc shell, boolean active, boolean java5, int clip) {
        sj.F = shell;
        eh.a = false;
        fh.P = false;
        cl.bb = false;
        tc.f = java5;
        tf.w = active;
        tk.c = 0L;
        fl.U = 7;
        jh.c = 5;
        Graphics graphics = clip == 0 ? null : new BufferedImage(8, 6, BufferedImage.TYPE_INT_RGB).getGraphics();
        if (clip == 2 || clip == 3) graphics.setClip(0, 0, clip == 2 ? 6 : 7, 5);
        boolean threw = false;
        try { shell.paint(graphics); }
        catch (RuntimeException ex) { threw = true; }
        finally { if (graphics != null) graphics.dispose(); }
        System.out.println(active + "|" + java5 + "|" + clip + "|" + fh.P + "|" + cl.bb + "|" + threw);
    }

    static void flames(boolean active, boolean bigEndian) throws Exception {
        int[] pixels = new int[157 * 270];
        for (int i = 0; i < pixels.length; ++i) pixels[i] = (i * 0x12345) & 0xffffff;
        kb.a(pixels, 157, 270);
        kb.c(9, 12, 47, 31);
        uf.e = 0;
        cl.ab = new int[256];
        hh.r = new int[256];
        for (int i = 0; i < 256; ++i) { cl.ab[i] = i % 25 - 7; hh.r[i] = i * 0xabc; }
        ri.d = new int[32768];
        for (int i = 0; i < ri.d.length; ++i) ri.d[i] = i & 255;
        nd.y = new mm(128, 254);
        tf.w = active;
        tf.f = bigEndian;
        tf.J = 157;
        tf.A = 270;
        trace = "";
        s.b(5, 100, 7);
        System.out.println(active + "|" + bigEndian + "|" + hash(pixels) + "|" + hash(nd.y.L) + "|" + trace);
    }

    public static void main(String[] args) throws Exception {
        rc shell = (rc) HdTitleFrameOracle.headlessInstance(client.class);
        tf.t = (GL) Proxy.newProxyInstance(GL.class.getClassLoader(), new Class<?>[]{GL.class}, (o, method, p) -> {
            if (method.getName().equals("glRasterPos2i")) trace += "pos=" + p[0] + "," + p[1] + " ";
            if (method.getName().equals("glDrawPixels"))
                trace += "pixels=" + p[0] + "," + p[1] + "," + p[2] + "," + p[3] + "," + hash(((IntBuffer)p[4]).array());
            return null;
        });
        for (boolean active : new boolean[]{false, true})
            for (boolean java5 : new boolean[]{false, true})
                for (int clip = 0; clip < 4; ++clip) paint(shell, active, java5, clip);
        for (boolean active : new boolean[]{false, true})
            for (boolean bigEndian : new boolean[]{false, true}) flames(active, bigEndian);
    }
}
