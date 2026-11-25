import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.util.HexFormat;

final class MenuDispatchFaultOracle {
    static id text(String s) { return aj.a(s, (byte)-100); }
    static String hex(id value) {
        return value == null ? "-" : HexFormat.of().formatHex(value.A, 0, value.c);
    }

    public static void main(String[] args) throws Exception {
        var lines = new BufferedReader(new InputStreamReader(System.in));
        pb self = new pb(), player = new pb();
        bk npc = new bk(); npc.mc = new ja(); npc.mc.G = 0x1251;
        self.L[0] = 14; self.ac[0] = 19; self.Z = 14 * 128 + 64; self.S = 19 * 128 + 64;
        player.L[0] = npc.L[0] = 17; player.ac[0] = npc.ac[0] = 23;
        hc.c[0] = new ke(104, 104);
        for (int[] col : hc.c[0].d) Arrays.fill(col, 0);
        kl obj = new kl(); obj.I = 5; obj.s = text("Arrow"); fa.b.a(5L, obj, (byte)-71);
        jb loc = new jb(); loc.k = 4321; loc.fb = 3; loc.y = 2; loc.tb = 5;
        he.w.a(4321L, loc, (byte)-71);
        aj widget = new aj(); widget.Kc = 2; widget.vb = 0; widget.R = 19;
        widget.Sc = new l(-1, 91); widget.pd = 62; widget.wb = 85;
        widget.r = text("widget"); widget.Tb = text("spell"); widget.E = text("select");
        fk.ab = new aj[][]{{null, null, widget}}; rg.b = new boolean[]{true}; vk.db = 19;
        aj oldHighlight = new aj(); oldHighlight.R = 19; oldHighlight.vb = 1;
        id selected = text("selected"), cast = text("cast"), target = text("target");
        ah.f = 0; hk.e = 3072; vj.t = 3168; sa.x = -141; oj.e = 941;
        df.B = 0x733; ag.e = -16; kk.db = 47; a.e = -39; ca.n = 19;
        for (String line; (line = lines.readLine()) != null;) {
            int[] v = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int mode = v[6], damage = v[8];
            te.g = (mode & 8) != 0 ? null : self;
            tf.J[5] = (mode & 64) != 0 ? null : player;
            uc.l[5] = (mode & 64) != 0 ? null : npc;
            jl.c = (mode >> 1) & 1; ob.q[82] = jl.c != 0;
            widget.y = (mode & 2) != 0; widget.vb = (mode & 32) != 0 ? -1 : 0;
            widget.Ob = (mode & 16) != 0 ? null : new int[]{2, (mode & 4) != 0 ? 100000 : 12};
            widget.Vb = (mode & 16) != 0 ? new int[][]{new int[0]} : null;
            vb.o = 0;
            mh.h = damage == -1 || damage == 9 ? null : damage == 1 || damage == 10 ? new int[0] : new int[]{v[2]};
            ml.x = damage == -2 || damage == 10 ? null : damage == 2 || damage == 9 ? new int[0] : new int[]{v[3]};
            sa.z = damage == -3 ? null : damage == 3 ? new long[0] : new long[]{((long)v[4] << 32) | Integer.toUnsignedLong(v[5])};
            p.u = damage == -4 ? null : damage == 4 ? new short[0] : new short[]{(short)v[0]};
            ph.e = damage == -5 ? null : damage == 5 ? new id[0] : new id[]{target};
            ak.a = damage == -6 ? null : new id[0]; ia.n = damage == -7 ? null : new int[0];
            le.c = mode & 1; ok.r = le.c != 0;
            gh.Y = -1; qe.W = 2; pj.C = 12; oh.a = 13; ce.D = 14; aa.e = 21;
            ge.Z = selected; t.W = cast; al.s = target; ph.h = 22131; gl.A = 45123; ti.X = 2;
            m.G = oldHighlight; ki.O = -52; u.q = 29; ca.g = null; ia.l = 71;
            Arrays.fill(sf.m, false); ve.m = 0; ui.q[0] = null;
            df.J = 3; jh.r = 45; sb.a = 57; kg.K = 68; lh.a = 7; vi.S = 8;
            o.O = false; ak.j = 9; oh.k = 10; rc.b = 11; si.t = 12; hl.Y = 13;
            gl.z = -32; ic.T = -98; ba.a = -6;
            qk.v.fb = new byte[v[7]]; Arrays.fill(qk.v.fb, (byte)0xa5); qk.v.yb = v[9];
            qk.v.a(new int[]{1, 22, 4, 8}, -1);
            String fault = "-";
            try { bd.c(2, v[1]); } catch (RuntimeException error) {
                Throwable cause = error;
                while (cause instanceof g wrap && wrap.a != null) cause = wrap.a;
                fault = cause instanceof NullPointerException ? "null" : cause instanceof IndexOutOfBoundsException ? "bounds" : cause.getClass().getSimpleName();
            }
            int pos = qk.v.yb;
            String packet = HexFormat.of().formatHex(qk.v.fb);
            qk.v.fb = new byte[1]; qk.v.yb = 0; qk.v.k(2, 251);
            System.out.println(String.join(" ", fault, Integer.toString(pos), packet, Integer.toString(qk.v.fb[0] & 255),
                df.J+" "+jh.r+" "+sb.a+" "+kg.K+" "+lh.a+" "+vi.S,
                o.O+" "+ak.j+" "+oh.k+" "+rc.b+" "+si.t+" "+hl.Y+" "+gl.z+" "+ic.T+" "+ba.a,
                le.c+" "+ph.h+" "+ti.X+" "+gl.A+" "+hex(ge.Z),
                ok.r+" "+gh.Y+" "+qe.W+" "+ce.D+" "+pj.C+" "+oh.a+" "+hex(t.W)+" "+hex(al.s)+" "+aa.e,
                u.q+" "+(m.G==widget?1:m.G==oldHighlight?2:0)+" "+ki.O+" "+(ca.g==widget)+" "+ia.l,
                sf.m[0]+" "+sf.m[1]+" "+ve.m+" "+hex(ui.q[0])));
        }
    }
}
