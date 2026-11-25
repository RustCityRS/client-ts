import java.nio.file.Path;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HexFormat;
import javax.media.opengl.GLContext;

public final class TerrainTextureOracle {
    public static void main(String[] args) throws Exception {
        try (GlRecorder recorder = new GlRecorder(Path.of(args[0]))) {
            GLContext context = recorder.context(recorder.gl());
            context.makeCurrent();
            tf.t = context.getGL();
            tf.w = true;
            tf.g = 73;
            BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
            for (String line; (line = input.readLine()) != null;) {
                String[] fields = line.split(" ");
                uh texture = new uh(new wa(HexFormat.of().parseHex(fields[1])));
                recorder.mark(fields[0]);
                boolean small = fields[0].endsWith("s");
                boolean cold = texture.a(null, null, 579100487, small);
                boolean warm = texture.a(null, null, 579100487, small);
                System.out.println(fields[0] + " " + cold + " " + warm + " " + fa.a);
            }
            context.release();
        }
    }
}
