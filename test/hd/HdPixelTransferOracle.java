import java.awt.Canvas;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.image.BufferedImage;
import java.nio.IntBuffer;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.media.opengl.*;

/** Compile with tools/hd-replay/NativeGlReadback.java and the two archived HD jars using
 * javac --enable-preview --release 21. Run with --enable-preview --enable-native-access=ALL-UNNAMED
 * and the original windows-amd64 native-library folder as the only argument. No visible window is opened. */
public class HdPixelTransferOracle {
    static final int W = 37, H = 29;
    static void record(GL gl, String label) throws Exception {
        BufferedImage image = NativeGlReadback.readBack(gl,W,H);
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (int y = 0; y < H; y++) for (int x = 0; x < W; x++) {
            int argb = image.getRGB(x,y);
            for (int shift : new int[]{16,8,0,24}) digest.update((byte)(argb >> shift));
        }
        System.out.println(label + " " + HexFormat.of().formatHex(digest.digest()));
    }
    static void prepare(GL gl) {
        gl.glDisable(3089); gl.glDisable(2929); gl.glDisable(2912);
        gl.glDisable(3042); gl.glDisable(3008);
        gl.glClearColor(0.2f,0.4f,0.6f,0.8f); gl.glClear(16384);
        gl.glPixelStorei(3312,0);
        gl.glPixelStorei(3315,0); gl.glPixelStorei(3316,0);
        gl.glPixelStorei(3314,0); gl.glPixelStorei(3317,4);
        gl.glPixelZoom(1.0f,1.0f);
    }
    static void run(GL gl, GLDrawable drawable) throws Exception {
        int[] pixels = new int[W*H+64];
        for (int i = 0; i < pixels.length; i++) pixels[i] = 0x2e7fdb95 + i*0x170f0309;
        tf.t = gl; tf.J = W; tf.A = H; tf.w = true;
        for (int mode = 0; mode < 10; mode++) {
            prepare(gl);
            if (mode == 0 || mode == 1 || mode == 2) {
                tf.f = mode == 1;
                if (mode == 2) { gl.glEnable(3089); gl.glScissor(9,8,10,11); }
                dj.a(pixels,6,7,13,11);
            } else if (mode == 8 || mode == 9) {
                dj.a(pixels,0,0,W,H);
                drawable.swapBuffers();
                prepare(gl);
                if (mode == 9) { gl.glEnable(3089); gl.glScissor(4,6,17,13); }
                tf.h();
            } else {
                IntBuffer data = IntBuffer.wrap(pixels);
                data.position(2);
                gl.glPixelStorei(3314,15);
                gl.glPixelStorei(3315,2); gl.glPixelStorei(3316,1);
                gl.glPixelStorei(3317,8); gl.glPixelStorei(3312,mode == 3 ? 1 : 0);
                gl.glRasterPos2i(mode == 7 ? -1 : 11,17);
                gl.glPixelZoom(mode == 5 ? -1.5f : 1.0f,mode == 4 ? 2.5f : mode == 6 ? 0.0f : -1.0f);
                gl.glDrawPixels(9,7,32993,mode == 3 ? 33639 : 5121,data);
            }
            record(gl,"p"+mode);
        }
    }
    public static void main(String[] args) throws Exception {
        Path natives = Path.of(args[0]).toAbsolutePath();
        System.loadLibrary("jawt");
        System.load(natives.resolve("jogl.dll").toString());
        System.load(natives.resolve("jogl_awt.dll").toString());
        Frame frame = new Frame();
        try {
            frame.setUndecorated(true);
            Canvas canvas = new Canvas();
            canvas.setPreferredSize(new Dimension(W,H));
            frame.add(canvas); frame.pack();
            if (frame.isShowing()) throw new AssertionError();
            GLCapabilities caps = new GLCapabilities();
            caps.setDoubleBuffered(true); caps.setAlphaBits(8);
            GLDrawable drawable = GLDrawableFactory.getFactory().getGLDrawable(canvas,caps,null);
            drawable.setRealized(true);
            GLContext context = drawable.createContext(null);
            try {
                if (context.makeCurrent() == 0) throw new AssertionError("JOGL context");
                run(context.getGL(),drawable);
            } finally {
                if (GLContext.getCurrent() == context) context.release();
                context.destroy(); drawable.setRealized(false);
            }
        } finally { frame.dispose(); }
    }
}
