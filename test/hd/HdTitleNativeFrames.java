import java.awt.Canvas;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.function.IntConsumer;
import javax.imageio.ImageIO;
import javax.media.opengl.GLContext;
import javax.media.opengl.GLDrawable;

/**
 * Capture original gamepack frames on the Windows driver, immediately before each real swap.
 * On JDK 21 compile this class together with HdTitleFrameOracle, GlRecorder and NativeGlReadback
 * using --enable-preview --release 21 and runescape_gl.jar and jogl.jar on the classpath. Run with
 * --enable-preview --enable-native-access=ALL-UNNAMED --add-opens=java.base/java.lang=ALL-UNNAMED.
 * Arguments are the sector cache folder, PNG output folder and original windows-amd64 natives folder.
 */
public final class HdTitleNativeFrames implements IntConsumer {
    final Path output;
    final Field drawable = tf.class.getDeclaredField("E");
    int next, captures;

    HdTitleNativeFrames(Path output) throws ReflectiveOperationException {
        this.output = output;
        drawable.setAccessible(true);
    }

    public void accept(int frame) {
        if (frame != captures) throw new AssertionError("Missing swap before title frame " + frame);
        next = frame;
        if (frame != 0) return;
        System.out.println("OpenGL renderer " + tf.t.glGetString(7937));
        try {
            GLDrawable real = (GLDrawable) drawable.get(null);
            drawable.set(null, new GLDrawable() {
                public GLContext createContext(GLContext share) { return real.createContext(share); }
                public void setRealized(boolean realized) { real.setRealized(realized); }
                public void swapBuffers() {
                    if (captures != next) throw new AssertionError("Extra swap at frame " + next);
                    BufferedImage image = NativeGlReadback.readBack(tf.t, tf.J, tf.A);
                    String filename = String.format(Locale.ROOT, "title-%02d.png", next);
                    try {
                        if (!ImageIO.write(image, "PNG", output.resolve(filename).toFile())) throw new IOException("No PNG writer");
                    } catch (IOException ex) {
                        throw new UncheckedIOException(ex);
                    }
                    captures++;
                    real.swapBuffers();
                }
            });
        } catch (IllegalAccessException ex) {
            throw new IllegalStateException(ex);
        }
    }

    public static void main(String[] args) throws Exception {
        Path output = Path.of(args[1]), natives = Path.of(args[2]).toAbsolutePath();
        Files.createDirectories(output);
        System.loadLibrary("jawt");
        System.load(natives.resolve("jogl.dll").toString());
        System.load(natives.resolve("jogl_awt.dll").toString());
        Frame window = new Frame();
        try {
            window.setFocusableWindowState(false);
            Canvas canvas = new Canvas();
            canvas.setPreferredSize(new Dimension(765, 503));
            window.add(canvas);
            window.pack();
            HdTitleNativeFrames capture = new HdTitleNativeFrames(output);
            HdTitleFrameOracle.run(Path.of(args[0]), canvas, capture, checkpoint -> {});
            if (capture.captures != 50) throw new AssertionError("Captured " + capture.captures + " frames");
        } finally {
            tf.o();
            window.dispose();
        }
    }
}
