import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.util.HexFormat;

public class HdShadowTriangleOracle {
    public static void main(String[] args) throws Exception {
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            int[] v = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            byte[] pixels = v[0] < 0 ? null : new byte[v[0]];
            if (pixels != null) Arrays.fill(pixels,(byte)0x5a);
            String status = "ok";
            try {
                hf.a(pixels,v[1],v[2],v[3],v[4],v[5],v[6],v[7]);
            } catch (ArrayIndexOutOfBoundsException error) {
                status = "bounds:" + error.getMessage().split(" ")[1];
            } catch (NullPointerException error) {
                status = "null";
            }
            System.out.println(status + " " + (pixels == null ? "-" : HexFormat.of().formatHex(pixels)));
        }
    }
}
