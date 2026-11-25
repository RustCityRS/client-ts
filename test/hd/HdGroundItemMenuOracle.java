import java.util.Arrays;
import java.util.HexFormat;

/** Run the original scene menu, mouse loop, pathfinder and packet writer on one picked ground pile. */
public final class HdGroundItemMenuOracle {
    static final int X = 37, Z = 62, ID = 0x95bc;

    public static void main(String[] args) {
        nk.O = new e();
        ee.b = 0;
        li.h[0] = new mj(104, 104);
        for (int[] row : li.h[0].m) Arrays.fill(row, 0);
        nk.O.K[0] = X - 3;
        nk.O.w[0] = Z - 2;
        se.a = 3072;
        lc.n = 3168;
        th.j = new be[][]{{null, new be(), new be()}};
        sc.m = new boolean[]{true};
        h item = new h();
        item.E = li.f;
        cb.Y.a((byte)-77, item, ID);
        uj stack = new uj();
        stack.D = ID;
        mi.Y = new ih[4][104][104];
        mi.Y[0][X][Z] = new ih();
        mi.Y[0][X][Z].a(true, new pa(stack));
        vc.V = new long[]{(3L << 29) | (Z << 7) | X};
        aa.a = 1;
        for (int variant = 0; variant <= 1; variant++) {
            for (int op = 0; op < 8; op++) {
                vk.n = variant;
                item.qb = new na[5];
                if (op < 5) item.qb[op] = li.f;
                vd.C = op == 5 ? 1 : 0;
                th.n = op == 6;
                wf.f = 1; jg.b = -1;
                sd.R = 1; wf.d = 0x8123; p.e = 0x4567;
                hj.e = 2; be.Ec = -1;
                ck.D = gd.i = hn.W = li.f;
                sk.kb = 0; em.z = false;
                ob.a(0,100,100,100,0,25,(byte)90);
                wl.b(122);
                int selected = -1;
                for (int i = 0; i < sk.kb; i++) {
                    if (mi.U[i] == ID && (op == 7) == (d.eb[i] == 1002)) selected = i;
                }
                if (selected < 0 || op != 7 && selected != sk.kb - 1) throw new AssertionError("missing ground option " + op);
                String row = d.eb[selected] + "," + mi.U[selected] + "," + pl.e[selected] + "," + ef.c[selected];
                lk.Z = 1; ml.Q = 0; jb.n = 0;
                ah.s = me.nb = 50; em.y = em.w = 30;
                if (op == 7) {
                    em.z = true; ok.b = si.ab = 0; bn.O = 100;
                    em.y = 31 + 15 * (sk.kb - 1 - selected);
                }
                fi.k = 0; bg.M = 45; jh.j = c.eb = -1;
                ag.P.y = new byte[128]; ag.P.T = 0;
                ag.P.a(new int[]{1,22,4,8},false);
                ah.b(-48);
                String packet = HexFormat.of().formatHex(ag.P.y, 0, ag.P.T);
                System.out.println(variant + "/" + op + " " + row + " " + packet + " " +
                    fi.k + "," + bg.M + "," + jh.j + "," + c.eb + "," + (jd.i == null));
            }
        }
    }
}
