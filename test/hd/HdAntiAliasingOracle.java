import java.awt.Canvas;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.image.BufferedImage;
import java.nio.file.Files;
import java.nio.file.Path;

/** The game's real CS2 capability query, context initializer and diagonal widget draw on the native JOGL backend. */
public final class HdAntiAliasingOracle {
    private static final int WIDTH = 63, HEIGHT = 49;
    private static int scriptId = 86000;

    private static void controls(int value) {
        qc script = new qc();
        script.O = new int[]{6121,0,6016,6116,21};
        script.W = new int[]{0,value,0,0,0};
        script.T = new na[5];
        ib.d.a(script,scriptId,(byte)-87);
        jl event = new jl();
        event.E = new Object[]{scriptId++};
        uj.t[0] = uj.t[1] = -701;
        h.a((byte)-12,100,event);
    }

    private static int parameter(int name) {
        int[] result = {-1};
        tf.t.glGetIntegerv(name,result,0);
        return result[0];
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("controls")) {
            for (boolean active : new boolean[]{false,true}) for (boolean supported : new boolean[]{false,true})
                for (boolean invalid : new boolean[]{false,true}) for (int value : new int[]{-1,0,1,2,3}) {
                    tf.w = active;
                    tf.y = supported;
                    cl.bb = invalid;
                    controls(value);
                    System.out.println(uj.t[0] + " " + uj.t[1] + " " + pa.N + " " + cl.bb);
                }
            return;
        }
        Path out = Path.of(args[0]), natives = Path.of(args[1]).toAbsolutePath();
        System.loadLibrary("jawt");
        System.load(natives.resolve("jogl.dll").toString());
        System.load(natives.resolve("jogl_awt.dll").toString());
        for (int selection = 0; selection <= 2; selection++) {
            Frame frame = new Frame();
            try {
                frame.setUndecorated(true);
                Canvas canvas = new Canvas();
                canvas.setPreferredSize(new Dimension(WIDTH, HEIGHT));
                frame.add(canvas);
                frame.pack();
                controls(selection);
                int result = tf.a(canvas,2 * pa.N);
                if (result != 0) throw new AssertionError("tf.a returned " + result);
                try {
                    controls(selection);
                    for (int scene = 0; scene < 2; scene++) {
                        dj.c(0,0,WIDTH,HEIGHT,scene == 0 ? 0 : 0x285068);
                        dj.b(7,7,55,33,scene == 0 ? 0xffffff : 0xc5a197,7);
                        if (scene == 1) dj.b(8,38,46,4,0x0905ba,3);
                        BufferedImage image = NativeGlReadback.readBack(tf.t,WIDTH,HEIGHT);
                        byte[] rgba = new byte[WIDTH * HEIGHT * 4];
                        int i = 0;
                        for (int y = 0; y < HEIGHT; y++) for (int x = 0; x < WIDTH; x++) {
                            int pixel = image.getRGB(x,y);
                            rgba[i++] = (byte)(pixel >> 16);
                            rgba[i++] = (byte)(pixel >> 8);
                            rgba[i++] = (byte)pixel;
                            rgba[i++] = (byte)(pixel >>> 24);
                        }
                        Files.write(out.resolve("native-" + selection + "-" + scene + ".rgba"),rgba);
                    }
                    System.out.println(selection + " " + uj.t[0] + " " + parameter(0x80a8) + " " + parameter(0x80a9));
                } finally { tf.o(); }
            } finally { frame.dispose(); }
        }
    }
}
