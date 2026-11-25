import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;

/** Original fn.a with the live hardware surface's absent software framebuffer. */
public class HdScrollbarOracle {
    public static void main(String[] args) throws Exception {
        try (GlRecorder recorder = new GlRecorder(Path.of(args[0]))) {
            tf.t = recorder.gl();
            tf.J = 765;
            tf.A = 503;
            byte[] dots = {1, 2, 0, 2, 1, 2};
            int[] palette = {0, 0xf7a520, 0x5314b2};
            ok[] gpu = {new oh(5, 4, 1, 1, 3, 2, dots, palette), new oh(5, 4, 1, 1, 3, 2, dots, palette)};
            ok[] cpu = {new ek(5, 4, 1, 1, 3, 2, dots, palette), new ek(5, 4, 1, 1, 3, 2, dots, palette)};
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            String line;
            BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
            int n = 0;
            while ((line = input.readLine()) != null) {
                int[] v = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
                recorder.mark("row" + n++);
                tf.w = v[0] != 0;
                th.f = tf.w ? gpu : cpu;
                int[] buffer = tf.w ? null : new int[765 * 503 + 1];
                kb.a(buffer, 765, 503);
                kb.c(v[6], v[7], v[8], v[9]);
                if (tf.w) dj.d(v[6], v[7], v[8], v[9]);
                String result = "ok";
                try {
                    fn.a((byte)120, v[1], v[2], v[3], v[4], v[5]);
                } catch (ld error) {
                    result = error.f.getClass().getSimpleName() + " " + error.e;
                }
                String pixels = "-";
                if (buffer != null) {
                    ByteBuffer bytes = ByteBuffer.allocate(buffer.length * 4).order(ByteOrder.LITTLE_ENDIAN);
                    bytes.asIntBuffer().put(buffer);
                    pixels = HexFormat.of().formatHex(sha256.digest(bytes.array()));
                }
                System.out.println(result + " " + pixels);
            }
        }
    }
}
