import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.HashMap;
import java.util.Map;

// Run the original HD dispatcher and route finder together with an open collision map.
public final class HdInventoryActorActionOracle {
    static final int component = 149 << 16 | 2;
    static be widget;
    static final Object[] enterArgs = {101}, leaveArgs = {102};

    public static void runHook(int guard, jl event) {
        if (event.F != widget || (event.E != enterArgs && event.E != leaveArgs)) {
            throw new AssertionError("wrong target hook arguments or widget");
        }
        HdExamineMenuOracle.writes.add((event.E == enterArgs ? "enter/" : "leave/") + th.n + "/" + vd.C + "/" + cl.Y);
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0) {
            Path out = Path.of(args[0]);
            Map<String,String> fields = new HashMap<>(HdExamineMenuOracle.stores);
            fields.putAll(Map.ofEntries(
                Map.entry("sd.R","objComponent"), Map.entry("p.e","objSlot"), Map.entry("wf.d","objId"), Map.entry("ck.D","objName"),
                Map.entry("be.Ec","targetChild"), Map.entry("jg.b","targetParam"), Map.entry("hj.e","targetComponent"),
                Map.entry("wf.f","targetFlags"), Map.entry("th.n","targetMode"), Map.entry("u.i","targetCursor"),
                Map.entry("cl.Y","defaultCursor"), Map.entry("hn.W","targetVerb"), Map.entry("gd.i","targetName"),
                Map.entry("jl.F","eventComponent"), Map.entry("jl.E","eventArgs")));
            HdExamineMenuOracle.instrument(out, "i", "p", "(II)V", fields, null);
            HdExamineMenuOracle.instrument(out, "t", "a", "(BJII)Z");
            HdExamineMenuOracle.instrument(out, "ub", "b", "(IIIIIII)V", fields, "HdInventoryActorActionOracle");
            HdExamineMenuOracle.instrument(out, "ec", "a", "(B)V", fields, "HdInventoryActorActionOracle");
            return;
        }
        widget = new be();
        widget.Fc = component;
        widget.gc = new bf(-1, 91);
        widget.Ub = widget.Dc = widget.Sb = cd.a("Widget", (byte)-128);
        widget.wd = new int[]{1, 7};
        h ashes = new h();
        ashes.Y = 592; ashes.E = cd.a("Ashes", (byte)-128);
        cb.Y.a((byte)-77, ashes, 592L);
        th.j = new be[150][];
        th.j[149] = new be[]{null, null, widget};
        sc.m = new boolean[150];
        sc.m[149] = true;
        li.h[0] = new mj(104, 104);
        for (int[] column : li.h[0].m) Arrays.fill(column, 0);
        nk.O = new e();
        nk.O.K[0] = nk.O.w[0] = 40;
        e targetPlayer = new e();
        km targetNpc = new km();
        targetNpc.rc = new me();
        targetNpc.rc.X = 708;
        targetPlayer.K[0] = targetPlayer.w[0] = targetNpc.K[0] = targetNpc.w[0] = 44;
        se.a = 3144;
        lc.n = 3208;
        ah.s = 583;
        em.y = 327;
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            int[] row = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int action = row[0], horizontal = row[1], vertical = row[2], id = row[3];
            pl.e = new int[]{horizontal};
            ef.c = new int[]{vertical};
            d.eb = new short[]{(short)action};
            mi.U = new long[]{Integer.toUnsignedLong(id) | ((long) row[6] << 32)};
            nm.S[407] = row[4] == 1 ? targetNpc : null;
            mi.S[407] = row[4] == 1 ? targetPlayer : null;
            pb.q[82] = row[5] == 1;
            vd.C = row[7] >> 2 & 1; th.n = (row[7] & 1) != 0; d.R = null;
            widget.bb = (row[7] & 2) != 0 ? enterArgs : null;
            widget.gd = (row[7] & 2) != 0 ? leaveArgs : null;
            cl.Y = 67;
            sd.R = component; wf.d = 0x8123; p.e = 0x4567;
            hj.e = component; be.Ec = -1;
            ag.P.y = new byte[128];
            ag.P.T = 0;
            ag.P.a(new int[]{1,22,4,8},false);
            fi.k = 4; bg.M = 51; jh.j = 11; c.eb = 37;
            fl.P = 9; v.b = null; uf.t = -12;
            mh.Y = false; mj.i = ha.q = kd.zb = -5; ef.g = jb.p = 7;
            HdExamineMenuOracle.writes.clear();
            HdExamineMenuOracle.routeReads.clear();
            i.p(2597,0);
            System.out.println(String.join("|",
                HexFormat.of().formatHex(ag.P.y,0,ag.P.T),
                fi.k + "," + bg.M + "," + jh.j + "," + c.eb,
                fl.P + "," + (v.b == widget) + "," + uf.t,
                vd.C + "," + wf.d + "," + p.e + "," + sd.R + "," + th.n + "," + hj.e + "," + be.Ec + "," + (d.R == widget),
                mh.Y + "," + mj.i + "," + ha.q + "," + kd.zb + "," + ef.g + "," + jb.p,
                String.join(",", HdExamineMenuOracle.writes),
                String.join(",", HdExamineMenuOracle.routeReads)));
        }
    }
}
