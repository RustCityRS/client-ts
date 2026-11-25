import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.util.Arrays;

/** Expose hm's destination, cache validity and all four ordered distances after each scanline. */
public final class HdVoronoiScanlineOracle {
    static Field field(Class<?> type, String name) throws Exception {
        Field f = type.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = reader.readLine()) != null;) {
            int[] v = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            hm op = new hm();
            pe.r = 13;
            fb.h = new int[]{v[7]};
            op.H = new pf(1, 1, 13);
            int[][] backing = (int[][])field(pf.class, "g").get(op.H);
            nk.d = v[2] < 0 ? null : new int[v[2]];
            if (nk.d != null) for (int i = 0; i < nk.d.length; i++) nk.d[i] = (i - 3) * 734003 + i * 7919;
            backing[0] = v[3] == -2 ? nk.d : v[3] < 0 ? null : new int[v[3]];
            if (backing[0] != null && v[3] != -2) Arrays.fill(backing[0], 777);
            byte[] permutation = v[4] < 0 ? null : new byte[v[4]];
            if (permutation != null) for (int i = 0; i < permutation.length; i++) permutation[i] = (byte)(89 * i + 113);
            short[] offsets = v[5] < 0 ? null : new short[v[5]];
            if (offsets != null) for (int i = 0; i < offsets.length; i++) offsets[i] = (short)(1877 * i - 29399);
            field(hm.class, "W").setInt(op, v[0]);
            field(hm.class, "S").setInt(op, v[1]);
            field(hm.class, "X").set(op, permutation);
            field(hm.class, "eb").set(op, offsets);
            field(hm.class, "ib").setInt(op, v[6]);
            field(hm.class, "jb").setInt(op, 19);
            cl.X = 10;
            jg.g = 11;
            uf.p = 12;
            ui.Q = 13;
            String outcome = "ok";
            try { op.a(0, (byte)-72); }
            catch (ld ex) {
                Throwable cause = ex.f;
                if (cause instanceof ArrayIndexOutOfBoundsException) outcome = "index " + cause.getMessage().split(" ")[1];
                else if (cause instanceof NullPointerException) outcome = "null";
                else throw ex;
            }
            System.out.println(outcome + "|" + Arrays.toString(backing[0]) + "|" + op.H.t + "|" +
                cl.X + "," + jg.g + "," + uf.p + "," + ui.Q);
        }
    }
}
