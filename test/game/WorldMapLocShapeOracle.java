import java.io.*;
import java.util.Arrays;
import java.util.StringTokenizer;

// gk and td are the original gamepack classes. The destination may differ from td.g.
class WorldMapLocShapeOracle {
    public static void main(String[] args) throws Exception {
        var in = new BufferedReader(new InputStreamReader(System.in));
        var out = new PrintWriter(new BufferedWriter(new OutputStreamWriter(System.out)));
        for (String line; (line = in.readLine()) != null;) {
            var tokens = new StringTokenizer(line);
            int[] v = new int[14];
            for (int i = 0; i < v.length; i++) v[i] = Integer.parseInt(tokens.nextToken());
            int fg = v[13] == 0 ? 0x12345678 : 0, bg = v[13] == 0 ? 0x87654321 : -1;
            td.c = v[0]; td.e = v[1]; td.b = v[2]; td.h = v[3]; td.d = v[4];
            int[] destination = v[12] < 0 ? null : new int[v[12]];
            if (destination != null) Arrays.fill(destination, 0x778855);
            td.g = new int[]{0x31415926};
            String error = "-";
            try {
                gk.a(fg, v[9], v[7], v[11] != 0, bg, v[5], v[10], destination, v[8], 0, v[6]);
            } catch (g wrapped) {
                String type = wrapped.a instanceof ArrayIndexOutOfBoundsException ? "bounds" :
                    wrapped.a instanceof NullPointerException ? "null" : wrapped.a.getClass().getName();
                error = wrapped.q + "/" + type;
            }
            out.print(error); out.print('|');
            if (destination == null) out.print('-');
            else for (int pixel:destination) out.print(pixel == fg ? 'f' : pixel == bg ? 'b' : pixel == 0x778855 ? '.' : '?');
            out.print('|'); out.println(td.g[0]);
        }
        out.flush();
    }
}
