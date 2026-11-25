import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Arrays;

public final class HdViewportCameraOracle {
    public static void main(String[] args) throws Exception {
        try (BufferedReader input = new BufferedReader(new InputStreamReader(System.in))) {
            for (String line; (line = input.readLine()) != null;) {
                int[] a = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
                tf.w = a[0] != 0;
                vg.b = (short)a[1];
                pb.rb = (short)a[2];
                bh.a(a[3], -1907397104, a[4], a[5], a[6], a[7], a[8], a[9]);
                q.a(81, a[10], a[11], a[12], 42, a[13], (byte)-114, a[14]);
                System.out.println(km.Pc + "," + af.d + "," + kh.f + "," + tg.b + "," + ol.ib + "," + fc.a + "," + bf.B);
            }
        }
    }
}
