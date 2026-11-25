import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.media.opengl.GLContext;

/** Read native OpenGL immediately after the original JAR's terrain and model calls and before its first 3D swap. */
public class HdIndexedTerrainReadback {
    static void read(Path file) throws Exception {
        BufferedImage frame = NativeGlReadback.readBack(GLContext.getCurrent().getGL(), 765, 503);
        byte[] rgba = new byte[frame.getWidth() * frame.getHeight() * 4];
        int p = 0;
        for (int y = 0; y < frame.getHeight(); y++) for (int x = 0; x < frame.getWidth(); x++) {
            int pixel = frame.getRGB(x, y);
            rgba[p++] = (byte)(pixel >> 16); rgba[p++] = (byte)(pixel >> 8);
            rgba[p++] = (byte)pixel; rgba[p++] = (byte)(pixel >> 24);
        }
        Files.write(file, rgba);
    }

    public static void main(String[] args) throws Exception {
        Path trace = Path.of(args[0]), output = Path.of(args[1]), natives = Path.of(args[2]).toAbsolutePath();
        System.loadLibrary("jawt");
        System.load(natives.resolve("jogl.dll").toString());
        System.load(natives.resolve("jogl_awt.dll").toString());
        ReplayTrace source = new ReplayTrace(Path.of(args[3]), trace.getParent().resolve("blobs"));
        GlReplay.validateEncoding(trace);
        int draws = 0;
        try (GlReplay replay = new GlReplay(source,output.resolve("swaps"),765,503);
             BufferedReader input = Files.newBufferedReader(trace)) {
            if (!"#GLTrace v1".equals(input.readLine())) throw new AssertionError("trace header");
            for (String line; (line=input.readLine()) != null;) {
                if (line.startsWith("#")) continue;
                String[] row = line.split("\\t",-1);
                if (row[1].equals("GLDrawable.swapBuffers") && draws > 0) {
                    if (draws != 232) throw new AssertionError("indexed draws " + draws);
                    read(output.resolve("terrain-present.rgba"));
                    replay.record(row);
                    return;
                }
                replay.record(row);
                if (row[1].equals("glDrawElements")) {
                    draws++;
                    // Draws 37-39 are the first real model using direct NIO client positions and colours.
                    if (draws == 1 || draws == 5 || draws == 12 || draws == 14 || draws == 36 || draws == 37 || draws == 39 || draws == 232)
                        read(output.resolve("terrain-" + draws + ".rgba"));
                }
            }
            throw new AssertionError("missing first 3D title swap");
        }
    }
}
