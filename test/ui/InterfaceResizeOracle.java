public class InterfaceResizeOracle {
    private static aj widget(int id, int parent, int marker) {
        aj c = new aj();
        c.Kc = id;
        c.n = parent;
        c.ob = marker == 1 ? 0 : 3;
        c.X = c.h = 1;
        c.ub = 2;
        c.m = 1;
        c.G = marker * 7;
        c.M = marker + 3;
        c.hc = c.Ac = 1000;
        c.ic = new Object[]{marker};
        return c;
    }

    // A freshly registered group follows the same ik.a(false,false) route as the title.
    // Report writes made before a failed aspect division, including untouched siblings.
    private static void session(String row) {
        int[] p = java.util.Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray();
        hi.f = 300; fl.l = 210; hd.m = 1; uc.c = p[0] != 0;
        aj root = widget(65536, -1, 1), subject = widget(65537, root.Kc, 2), after = widget(65538, -1, 3);
        subject.ob = p[1]; subject.X = (byte)p[2]; subject.h = (byte)p[3];
        subject.cb = p[4]; subject.Wb = p[5]; subject.Sc = new l(p[6], -1);
        subject.C = -31; subject.H = 39; subject.ib = -55; subject.Mb = -65;
        subject.Bc = -500; subject.Ec = 909; subject.G = 2; subject.M = 3;
        subject.ub = subject.m = 0; subject.jd = -3; subject.ab = 5;
        fk.ab = new aj[][]{null, {root, subject, after}}; rg.b = new boolean[]{false, true};
        String result = "ok";
        try { ik.a(false, false); }
        catch (RuntimeException ex) {
            Throwable cause = ex;
            while (cause instanceof g w) cause = w.a;
            if (!(cause instanceof ArithmeticException)) throw ex;
            result = "divide";
        }
        StringBuilder trace = new StringBuilder(result);
        for (aj c : new aj[]{root, subject, after})
            for (int v : new int[]{c.C,c.H,c.ib,c.Mb,c.hc,c.Ac}) trace.append(' ').append(v);
        System.out.println(trace.append(' ').append(mi.q.a(true) == null));
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) {
            var reader = new java.io.BufferedReader(new java.io.InputStreamReader(System.in));
            for (String row; (row=reader.readLine())!=null;) session(row);
            return;
        }
        aj root = widget(65536, -1, 1);
        aj child = widget(65537, root.Kc, 2);
        aj dynamic = widget(root.Kc, root.Kc, 3);
        aj mounted = widget(131072, -1, 4);
        aj last = widget(65538, -1, 5);
        root.pb = new aj[]{null, dynamic};
        fk.ab = new aj[][]{null, {root, child, last}, {mounted}};
        rg.b = new boolean[]{false, true, true};
        qd sub = new qd();
        sub.v = 2;
        va.Z.a((byte)-89, sub, root.Kc);
        int[] widths = {0,765,765,1024,1024,-40,300,640,Integer.MAX_VALUE};
        int[] heights = {0,503,503,768,768,900,200,480,Integer.MIN_VALUE};
        for (int i = 0; i < widths.length; i++) {
            hi.f = widths[i];
            fl.l = heights[i];
            hd.m = i == 7 ? -1 : 1;
            dynamic.X = (byte)(i == 5 || i == 6 ? 4 : 1);
            dynamic.cb = 3;
            dynamic.Wb = i == 5 ? 0 : 2;
            String result = "ok";
            try {
                if (i == 3) ik.a(0, root);
                else ik.a(true, false);
            } catch (RuntimeException ex) { result = "error"; }
            StringBuilder row = new StringBuilder(result);
            for (aj c : new aj[]{root, child, dynamic, mounted, last}) {
                for (int v : new int[]{c.C,c.H,c.ib,c.Mb,c.hc,c.Ac}) row.append(' ').append(v);
            }
            row.append(" |");
            for (wf event = (wf)mi.q.a(true); event != null; event = (wf)mi.q.a(true)) {
                row.append(' ').append(event.G[0]);
            }
            System.out.println(row);
        }
    }
}
