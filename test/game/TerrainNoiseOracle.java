import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.util.StringTokenizer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class TerrainNoiseOracle {
    private static final Pattern BOUNDS = Pattern.compile("Index (-?\\d+) out of bounds for length \\d+");

    private static int[] table(int length) {
        int[] values = new int[length];
        for (int i = 0; i < length; i++) {
            switch (i & 3) {
                case 0: values[i] = Integer.MIN_VALUE + i; break;
                case 1: values[i] = Integer.MAX_VALUE - i; break;
                case 2: values[i] = 65536; break;
                default: values[i] = i * 1664525 + 1013904223;
            }
        }
        return values;
    }

    private static String exception(Throwable thrown) {
        while (thrown instanceof g) thrown = ((g) thrown).a;
        if (thrown instanceof ArithmeticException) return "divide";
        if (thrown instanceof NullPointerException) return "null";
        if (thrown instanceof ArrayIndexOutOfBoundsException) {
            Matcher bounds = BOUNDS.matcher(thrown.getMessage());
            if (bounds.matches()) return "index " + bounds.group(1);
        }
        throw new AssertionError(thrown);
    }

    public static void main(String[] args) throws Exception {
        int[][] tables = {dc.g, null, table(0), table(1), table(513), table(1024), table(2048)};
        ve.q = new int[1][104][104];
        tb.t = new byte[1][104][104];
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        PrintWriter out = new PrintWriter(System.out);
        String line;
        while ((line = input.readLine()) != null) {
            StringTokenizer argsIn = new StringTokenizer(line);
            int op = Integer.parseInt(argsIn.nextToken());
            dc.g = tables[Integer.parseInt(argsIn.nextToken())];
            int a = Integer.parseInt(argsIn.nextToken()), b = Integer.parseInt(argsIn.nextToken());
            int c = Integer.parseInt(argsIn.nextToken()), d = Integer.parseInt(argsIn.nextToken());
            try {
                switch (op) {
                    case 0: out.println(be.a(a, (byte) -29, b)); break;
                    case 1: out.println(ui.a(a, b, true, c)); break;
                    case 2: out.println(lc.a(a, true, b)); break;
                    case 3: out.println(je.a(a, b, c, d, (byte) 120)); break;
                    case 4: out.println(vb.a(a, -1, b)); break;
                    case 5:
                        // A zero map-land opcode at a valid plane-zero tile calls be.a.
                        fi.a(false, new gd(new byte[]{0}), d, 0, 0, c, b, false, a);
                        out.println(ve.q[0][c][d]);
                        break;
                    default: throw new AssertionError(op);
                }
            } catch (RuntimeException e) {
                out.println(exception(e));
            }
        }
        out.flush();
    }
}
