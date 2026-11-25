import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HexFormat;

public class HdShadowBlitOracle {
    private static byte[] pixels(int size) {
        if (size < 0) return null;
        byte[] values = new byte[size];
        for (int i = 0; i < size; i++) values[i] = (byte)(0xf5 - 29 * i);
        return values;
    }

    public static void main(String[] args) throws Exception {
        Class<?>[] signature = {byte[].class, byte[].class, int.class, int.class, int.class, int.class, int.class, int.class};
        Method add = tj.class.getDeclaredMethod("b", signature);
        Method subtract = tj.class.getDeclaredMethod("a", signature);
        add.setAccessible(true);
        subtract.setAccessible(true);
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            int[] p = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            byte[] dst = pixels(p[1]), src = p[2] == -2 ? dst : pixels(p[2]);
            String outcome = "ok";
            try {
                (p[0] == 0 ? add : subtract).invoke(null, dst, src, p[3], p[4], p[5], p[6], p[7], p[8]);
            } catch (InvocationTargetException e) {
                Throwable cause = e.getCause();
                if (cause instanceof NullPointerException) outcome = "null";
                else if (cause instanceof ArrayIndexOutOfBoundsException) outcome = "bounds " + cause.getMessage().split(" ")[1];
                else throw e;
            }
            System.out.println(outcome + " " + (dst == null ? "-" : HexFormat.of().formatHex(dst)));
        }
    }
}
