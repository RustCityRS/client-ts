import java.util.Arrays;

class RoofSetupOracle {
    static String status(Throwable ex) {
        while (ex instanceof g wrapped && wrapped.a != null) ex = wrapped.a;
        if (ex instanceof NullPointerException) return "null";
        if (ex instanceof IndexOutOfBoundsException) return "bounds";
        if (ex instanceof NegativeArraySizeException) return "negative";
        throw new AssertionError(ex);
    }

    static void run(int scenario, int layout, int mode, int stamp, int operation) {
        kf.n = mode == 0;
        rj.l = mode != 3;
        oi.j = mode == 2 || mode == 3;
        ai.d = stamp;
        ah.f = scenario % 4;
        kl.Bb = new ra[4][104][104];
        tb.t = new byte[4][104][104];
        ve.q = new int[4][105][105];
        for (int p = 0; p < 4; p++) {
            for (int x = 0; x < 104; x++) {
                for (int z = 0; z < 104; z++) {
                    if (x % 3 == 1 && z % 3 == 1) tb.t[p][x][z] = 4;
                    ve.q[p][x][z] = z * 7 - x * 9 - p * 240;
                }
            }
        }
        byte[][][] previous = new byte[4][104][104];
        for (byte[][] plane : previous) for (byte[] row : plane) Arrays.fill(row, (byte)69);
        if (layout == 0) previous = null;
        if (layout == 2) previous[1][13] = new byte[] {88, -23};
        if (layout == 3) previous[2][8] = null;
        if (layout == 4) previous[1] = previous[0];
        ac.k = previous;
        sf.j = rj.p = new int[]{1, 2};
        ce.G = aj.Ub = new int[]{3, 4};
        vc.M = hf.D = new int[]{5, 6};
        gh.L = ek.i = new int[]{7, 8};
        qa.N = de.w = new int[]{9, 10};
        String result = "ok";
        try {
            if (operation == 0) ia.c(512);
            else if (operation == 1) {
                ia.c(512);
                kf.n = false;
                rj.l = true;
                oi.j = true;
                ai.d++;
                ia.c(512);
            } else if (operation == 2) bb.a(60,(byte)stamp);
            else d.a((byte)-39, -1);
        } catch (RuntimeException ex) { result = status(ex); }
        int[][] bounds = {sf.j, ce.G, vc.M, gh.L, qa.N};
        int[][] drawn = {rj.p, aj.Ub, hf.D, ek.i, de.w};
        StringBuilder out = new StringBuilder(result);
        out.append('/').append(ac.k == previous ? 1 : 0).append('/').append(Arrays.deepHashCode(ac.k));
        out.append('/').append(Arrays.deepHashCode(previous));
        for (int i = 0; i < bounds.length; i++) {
            out.append('/').append(bounds[i].length).append('/').append(Arrays.hashCode(bounds[i]));
            out.append('/').append(bounds[i] == drawn[i] ? 1 : 0).append('/').append(Arrays.hashCode(drawn[i]));
        }
        System.out.println(out);
    }

    public static void main(String[] args) throws Exception {
        var in = new java.io.BufferedReader(new java.io.InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            int[] n = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            run(n[0], n[1], n[2], n[3], n[4]);
        }
    }
}
