import java.util.Arrays;

public final class CoordArrowOracle {
    static int scenario;
    static kf[] initial;
    static StringBuilder trace;

    static final class Icon extends rh {
        final int id;
        Icon(int id) {
            super(2, 2, 0, 0, 2, 2, new int[]{id + 1, 0, 0, id + 5});
            this.id = id;
        }
        @Override void c(int x, int y) {
            trace.append(id).append(',').append(x).append(',').append(y).append('/');
            super.c(x, y);
            if (id == 0) {
                if (scenario == 9) ve.t = null;
                if (scenario == 10) initial[2] = null;
                if (scenario == 11) wa.a = new vc[]{null, new Icon(7)};
                if (scenario == 12) hh.kb = 10;
                if (scenario == 13) hk.e++;
            }
        }
    }

    static kf arrow(int index) {
        kf a = new kf();
        a.j = 2; a.i = hk.e + 3; a.e = vj.t + 8;
        a.k = 64 + index; a.m = 64 - index; a.r = index * 4; a.o = index;
        return a;
    }

    public static void main(String[] args) {
        int[] screen = new int[100 * 80];
        td.a(screen, 100, 80);
        ve.q = new int[4][105][105];
        tb.t = new byte[4][104][104];
        int[] cycles = {Integer.MIN_VALUE, -21, -1, 0, 9, 10, 19, 20, Integer.MAX_VALUE};
        int[] widths = {80, 81, -3, Integer.MIN_VALUE, Integer.MAX_VALUE};
        for (scenario = 0; scenario < 19; scenario++) for (int cycle : cycles) for (int width : widths) {
            hh.kb = cycle; hk.e = scenario == 17 ? Integer.MAX_VALUE : 3000; vj.t = 3100;
            rk.m = 448; ud.g = 0; mf.i = 0; bd.X = 0; qj.w = 0; ah.f = 0;
            initial = new kf[]{arrow(0), null, arrow(1), arrow(2)};
            ve.t = initial; wa.a = new vc[]{new Icon(0), new Icon(1), new Icon(2)};
            if (scenario == 1) ve.t = null;
            if (scenario == 2) ve.t = new kf[0];
            if (scenario == 3) initial[0].j = 10;
            if (scenario == 4) wa.a = null;
            if (scenario == 5) wa.a[1] = null;
            if (scenario == 6) initial[2].o = -1;
            if (scenario == 7) initial[2].e += 150;
            if (scenario == 8) initial[0].r = Integer.MIN_VALUE;
            if (scenario == 14) ah.f = -1;
            if (scenario == 15) ud.g = 1050;
            if (scenario == 16) qj.w = 2048;
            if (scenario == 18) initial[3].k = Integer.MAX_VALUE;
            int left = scenario == 8 ? Integer.MAX_VALUE : 8;
            int top = scenario == 8 ? Integer.MIN_VALUE : 17;
            jl.e = 9011; tg.z = -459; trace = new StringBuilder();
            Arrays.fill(screen, 41);
            String status = "ok";
            try { al.a(256, left, width, -1, 83, 256, top); }
            catch (RuntimeException err) {
                Throwable e = err;
                while (e instanceof g) e = ((g)e).a;
                if (e instanceof NullPointerException) status = "null";
                else if (e instanceof ArrayIndexOutOfBoundsException) status = "bounds";
                else throw err;
            }
            System.out.println(status+" "+jl.e+" "+tg.z+" "+trace+" "+Arrays.hashCode(screen));
        }
    }
}
