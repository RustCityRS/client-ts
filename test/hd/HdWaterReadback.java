import java.awt.Canvas;
import java.awt.image.BufferedImage;
import java.io.BufferedReader;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.media.opengl.GL;
import javax.media.opengl.GLContext;

/** Captures original 530 terrain/material passes and replays the captured inputs on native OpenGL. */
public final class HdWaterReadback {
    static final int SIZE = 128;

    static void capture(Path directory, Path profile) throws Exception {
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(SIZE, SIZE);
        try (GlRecorder recorder = new GlRecorder(directory); AutoCloseable factory = recorder.installFactory()) {
            recorder.loadProfile(profile);
            if (tf.a(canvas, 0) != 0) throw new AssertionError("HD initialization");
            tf.g = 9;
            od.c = false;
            tf.p();
            GL gl = tf.t;
            for (int wet = 0; wet < 2; wet++) for (int high = 0; high < 2; high++) {
                setup(gl);
                HdMaterialsOracle.waterFrame(wet == 1, high == 1);
                recorder.mark("water." + wet + high);
            }
            for (int[] input : new int[][]{{0,0},{1,1},{1,3},{3,0},{3,96},{4,1},{5,1}}) {
                setup(gl);
                gl.glDisable(0x0b50); // GL_LIGHTING
                gl.glEnableClientState(0x8075); // GL_NORMAL_ARRAY
                tf.g = 9;
                HdMaterialsOracle.materialFrame(input[0],input[1]);
                recorder.mark("water.env" + input[0] + "-" + input[1]);
            }
        }
    }

    private static void setup(GL gl) {
        tf.a(0, 0, SIZE, SIZE, 64, 64, 0f, 0f, 128, 128);
        gl.glLoadIdentity();
        gl.glTranslatef(-16f, 12f, -145f);
        gl.glRotatef(90f, 1f, 0f, 0f);
        gl.glDisable(0x0b44); // GL_CULL_FACE
        gl.glClearColor(0.2f, 0.4f, 0.6f, 1f);
        gl.glClear(0x4100); // GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT
    }

    static void replay(Path directory, Path natives, Path format) throws Exception {
        System.loadLibrary("jawt");
        System.load(natives.resolve("jogl.dll").toString());
        System.load(natives.resolve("jogl_awt.dll").toString());
        Path source = directory.resolve("trace.tsv");
        GlReplay.validateEncoding(source);
        ReplayTrace spec = new ReplayTrace(format, directory.resolve("blobs"));
        try (GlReplay replay = new GlReplay(spec, directory.resolve("swaps"), SIZE, SIZE);
             BufferedReader reader = Files.newBufferedReader(source)) {
            if (!"#GLTrace v1".equals(reader.readLine())) throw new AssertionError("trace header");
            for (String line; (line = reader.readLine()) != null;) {
                if (line.startsWith("#")) continue;
                String[] row = line.split("\\t", -1);
                replay.record(row);
                if (row[1].equals("~mark") && row[2].startsWith("water.")) {
                    BufferedImage image = NativeGlReadback.readBack(GLContext.getCurrent().getGL(), SIZE, SIZE);
                    byte[] rgba = new byte[SIZE * SIZE * 4];
                    int at = 0;
                    for (int y = 0; y < SIZE; y++) for (int x = 0; x < SIZE; x++) {
                        int pixel = image.getRGB(x, y);
                        rgba[at++] = (byte)(pixel >>> 16);
                        rgba[at++] = (byte)(pixel >>> 8);
                        rgba[at++] = (byte)pixel;
                        rgba[at++] = (byte)(pixel >>> 24);
                    }
                    Files.write(directory.resolve(row[2] + ".rgba"), rgba);
                }
            }
        }
    }

    public static void main(String[] args) throws Exception {
        Path directory = Path.of(args[1]);
        if (args[0].equals("capture")) capture(directory, Path.of(args[2]));
        else replay(directory, Path.of(args[2]).toAbsolutePath(), Path.of(args[3]));
    }
}
