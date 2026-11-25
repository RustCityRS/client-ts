import java.awt.Canvas;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.image.BufferedImage;
import java.nio.file.Path;
import javax.media.opengl.GL;
import javax.media.opengl.GLCapabilities;
import javax.media.opengl.GLContext;
import javax.media.opengl.GLDrawable;
import javax.media.opengl.GLDrawableFactory;

/**
 * Standalone Windows hardware test. Compile with the JDK 21 preview API, jogl.jar and
 * tools/hd-replay/NativeGlReadback.java. Pass the original windows-amd64 natives directory.
 */
public final class NativeReadbackOracle {
    private static final int WIDTH = 13, HEIGHT = 9;
    private static final int GL_FRONT = 0x0404, GL_BACK = 0x0405, GL_BACK_LEFT = 0x0402;
    private static final int GL_READ_BUFFER = 0x0c02, GL_SCISSOR_TEST = 0x0c11;
    private static final int GL_PACK_ALIGNMENT = 0x0d05, GL_PACK_ROW_LENGTH = 0x0d02;
    private static final int GL_PACK_SKIP_ROWS = 0x0d03, GL_PACK_SKIP_PIXELS = 0x0d04;
    private static final int GL_PIXEL_PACK_BUFFER = 0x88eb, GL_PIXEL_PACK_BUFFER_BINDING = 0x88ed;
    private static final int[] PACK = {GL_PACK_ALIGNMENT, GL_PACK_ROW_LENGTH, GL_PACK_SKIP_ROWS, GL_PACK_SKIP_PIXELS};
    private static final int BACKGROUND = 0x2f83c751, LOWER_LEFT = 0x5144beef;
    private static final int LOWER_RIGHT = 0x851f63b7, UPPER_LEFT = 0xc7095bc1, UPPER_RIGHT = 0xebfd7331;

    private static int integer(GL gl, int name) {
        int[] value = {-1};
        gl.glGetIntegerv(name, value, 0);
        return value[0];
    }

    private static void clear(GL gl, int argb) {
        gl.glClearColor((argb >> 16 & 255) / 255f, (argb >> 8 & 255) / 255f,
            (argb & 255) / 255f, (argb >>> 24) / 255f);
        gl.glClear(0x4000); // GL_COLOR_BUFFER_BIT
    }

    private static void rect(GL gl, int x, int y, int width, int height, int argb) {
        gl.glScissor(x, y, width, height);
        clear(gl, argb);
    }

    private static void draw(GL gl) {
        gl.glDisable(GL_SCISSOR_TEST);
        gl.glDisable(0x0bd0); // GL_DITHER
        gl.glDrawBuffer(GL_FRONT);
        clear(gl, 0x194e7f09);
        gl.glDrawBuffer(GL_BACK);
        clear(gl, BACKGROUND);
        gl.glEnable(GL_SCISSOR_TEST);
        rect(gl, 0, 0, 2, 3, LOWER_LEFT);
        rect(gl, 9, 0, 4, 2, LOWER_RIGHT);
        rect(gl, 0, 7, 4, 2, UPPER_LEFT);
        rect(gl, 10, 5, 3, 4, UPPER_RIGHT);
    }

    // Image-space coordinates start at the top. The four corners have different geometries and colours.
    private static int expected(int x, int y) {
        if (x < 4 && y < 2) return UPPER_LEFT;
        if (x >= 10 && y < 4) return UPPER_RIGHT;
        if (x < 2 && y >= 6) return LOWER_LEFT;
        if (x >= 9 && y >= 7) return LOWER_RIGHT;
        return BACKGROUND;
    }

    private static void check(GL gl, int readBuffer, int[] state) throws Exception {
        gl.glReadBuffer(readBuffer);
        for (int i = 0; i < PACK.length; i++) gl.glPixelStorei(PACK[i], state[i]);

        BufferedImage image = NativeGlReadback.readBack(gl, WIDTH, HEIGHT);
        if (integer(gl, GL_READ_BUFFER) != readBuffer) throw new AssertionError("changed GL_READ_BUFFER");
        for (int i = 0; i < PACK.length; i++) {
            int restored = integer(gl, PACK[i]);
            if (restored != state[i]) throw new AssertionError("GL pack " + PACK[i] + " expected " + state[i] + ", got " + restored);
        }
        if (image.getWidth() != WIDTH || image.getHeight() != HEIGHT) throw new AssertionError("image dimensions");
        for (int y = 0; y < HEIGHT; y++) for (int x = 0; x < WIDTH; x++) {
            int actual = image.getRGB(x, y), wanted = expected(x, y);
            if (actual != wanted) throw new AssertionError(String.format(
                "image pixel (%d,%d) expected ARGB %08x, got %08x", x, y, wanted, actual));
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
            canvas.setPreferredSize(new Dimension(WIDTH, HEIGHT));
            frame.add(canvas);
            frame.pack();
            if (frame.isShowing() || !canvas.isDisplayable()) throw new AssertionError("hidden canvas peer");
            GLCapabilities caps = new GLCapabilities();
            caps.setDoubleBuffered(true);
            caps.setRedBits(8); caps.setGreenBits(8); caps.setBlueBits(8); caps.setAlphaBits(8);
            GLDrawable drawable = GLDrawableFactory.getFactory().getGLDrawable(canvas, caps, null);
            drawable.setRealized(true);
            GLContext context = drawable.createContext(null);
            try {
                if (context.makeCurrent() == 0) throw new AssertionError("JOGL context not current");
                GL gl = context.getGL();
                if (integer(gl, 0x0d55) < 8) throw new AssertionError("RGBA8 drawable required");
                draw(gl);
                check(gl, GL_FRONT, new int[]{8, 3, 2, 1});
                int[] buffer = new int[1];
                gl.glGenBuffersARB(1, buffer, 0);
                try {
                    gl.glBindBufferARB(GL_PIXEL_PACK_BUFFER, buffer[0]);
                    gl.glBufferDataARB(GL_PIXEL_PACK_BUFFER, 4096, null, 0x88e1); // GL_STREAM_READ
                    if (buffer[0] == 0 || integer(gl, GL_PIXEL_PACK_BUFFER_BINDING) != buffer[0])
                        throw new AssertionError("pixel pack buffer was not bound");
                    check(gl, GL_BACK_LEFT, new int[]{2, 4, 1, 3});
                    if (integer(gl, GL_PIXEL_PACK_BUFFER_BINDING) != buffer[0]) throw new AssertionError("lost pixel pack buffer");
                } finally {
                    gl.glBindBufferARB(GL_PIXEL_PACK_BUFFER, 0);
                    gl.glDeleteBuffersARB(1, buffer, 0);
                }
                System.out.println(gl.glGetString(0x1f01) + " / " + gl.glGetString(0x1f02));
                System.out.println("2 readbacks, 234 ARGB pixels, read buffer, 4 pack settings and bound pixel pack buffer restored");
            } finally {
                if (GLContext.getCurrent() == context) context.release();
                context.destroy();
                drawable.setRealized(false);
            }
        } finally { frame.dispose(); }
    }
}
