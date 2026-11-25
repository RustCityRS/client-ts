import java.io.*;
import java.util.Arrays;

public class InterfaceControlsOracle {
    static void design() {
        cl appearance = f.b;
        System.out.println(appearance != null && appearance == f.b);
        for (int mode : new int[]{0, 1, 2, 3, 4, 5, 6}) {
            for (int code : new int[]{-1, 324, 325, 327, 328}) {
                for (int state = 0; state < 8; state++) {
                    f.b = appearance;
                    if ((state & 1) != 0) f.a((byte)69);
                    else f.b.m = (state & 2) != 0;
                    te.g = (state & 2) == 0 ? null : new pb();
                    if (te.g != null && (state & 4) != 0) {
                        te.g.Gc = aj.a("Majula", (byte)-100);
                        te.g.yb = 17; te.g.O = 29; te.g.M = 31;
                    }
                    aj c = new aj();
                    c.wc = code; c.ob = 1; c.n = -1;
                    c.ib = mode == 3 ? 120 : 5; c.Mb = 3; c.C = 7; c.H = 9;
                    c.y = mode != 4; c.Wc = mode == 2 || mode == 4;
                    c.mb = 71; c.lc = 83; c.vb = -10; c.R = -9;
                    ta.P = (state & 4) == 0 ? -1 : 111; nl.bb = 113;
                    uc.c = false; hh.kb = 398; ik.G = 3; vk.db = 398;
                    n.i[3] = mode != 5; ml.T = 0; ie.F = true;
                    td.a(new int[32 * 24], 32, 24);
                    String result = "ok";
                    try {
                        if (mode == 0 || mode == 6) we.a(12449, mode == 6 ? null : c);
                        else lf.a(0, new aj[]{c}, -1, 24, 0, -1, 32, 0, true, 0);
                    } catch (g error) {
                        result = error.a.getClass().getSimpleName() + "@" + error.q;
                    }
                    System.out.println(result + "|" + (f.b == null) + "|" + ta.P + "|" + nl.bb
                        + "|" + c.mb + "|" + c.vb + "|" + c.R + "|" + c.nd + "|" + c.d + "|" + c.md
                        + "|" + c.w + "|" + c.Hc + "|" + c.Sb + "|" + c.Q + "|" + c.jc);
                }
            }
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) { design(); return; }
        DataInputStream in = new DataInputStream(new BufferedInputStream(System.in));
        int count = in.readInt();
        for (int i = 0; i < count; i++) {
            aj c = new aj();
            c.Kc = i;
            c.wc = in.readInt();
            int flags = in.readInt();
            hh.kb = in.readInt();
            c.C = in.readInt();
            int height = in.readInt(), scrollHeight = in.readInt(), x = in.readInt(), y = in.readInt();
            int mx = in.readInt(), my = in.readInt();
            ca.a = in.readInt(); kf.l = in.readInt(); c.vb = in.readInt();
            int events = in.readInt();
            c.mb = in.readInt(); c.lc = in.readInt(); c.Ac = in.readInt();
            c.nd = -23; c.d = -42; c.md = 11; c.w = -91; c.Hc = 99; c.Sb = 4; c.Q = 6; c.jc = 77;
            uc.c = (flags & 1) != 0; c.Wc = (flags & 2) != 0; c.ob = (flags & 4) != 0 ? 0 : 3;
            c.Sc = new l(events, -1);
            if ((flags & 8) != 0) fd.W.a((byte)-89, new l(~events, -1), ((long)c.Kc << 32) + c.bc);
            vk.db = 5; c.R = (flags & 16) != 0 ? 4 : 5;
            te.g = (flags & 32) != 0 ? null : new pb();
            if (te.g != null) {
                te.g.Gc = (flags & 64) != 0 ? null : aj.a("zZ_" + i + "97!", (byte)-100);
                te.g.yb = i; te.g.O = i * 3; te.g.M = ~i;
            }
            f.b.m = (flags & 128) != 0;
            if (i % 13 == 0) { ta.P = -1; nl.bb = -1; }
            if (i % 7 == 0) aj.sb = true;
            StringBuilder row = new StringBuilder(Boolean.toString(client.b(c)));
            Arrays.fill(sf.m, false);
            try { ed.a(c, 99); row.append(" ok"); } catch (RuntimeException ex) { row.append(" error"); }
            row.append(' ').append(Arrays.hashCode(sf.m));
            Arrays.fill(sf.m, false);
            try { ii.a(my, scrollHeight, -83, c, y, mx, x, height); row.append(" ok"); }
            catch (RuntimeException ex) { row.append(" error"); }
            row.append(' ').append(Arrays.hashCode(sf.m)).append(' ').append(c.Ac).append(' ').append(aj.sb).append(' ').append(gf.eb);
            try { we.a(12449, c); row.append(" ok"); } catch (RuntimeException ex) { row.append(" error"); }
            for (int v : new int[]{c.mb,c.lc,c.nd,c.d,c.md,c.w,c.Hc,c.Sb,c.Q,c.jc,ta.P,nl.bb}) row.append(' ').append(v);
            System.out.println(row);
        }
    }
}
