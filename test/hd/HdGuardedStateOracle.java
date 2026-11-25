import java.nio.charset.StandardCharsets;

public final class HdGuardedStateOracle {
    static String run(Runnable call) {
        try {
            call.run();
            return "ok";
        } catch (ld failure) {
            return failure.f.getClass().getSimpleName() + " " + failure.e;
        }
    }

    static void change(boolean server, int guard, int damage) {
        client.U = new sc(16);
        la.f = new ce();
        rh.e = new ce();
        n.e = cd.a("sep", (byte)-118);
        ve.t = 771;
        int type = server ? 8 : 3;
        int id = server ? 7 : 99;
        da entry = te.a(4, type, id);
        if (damage == 1) client.U = null;
        if (damage == 2) {
            if (server) rh.e = null;
            else la.f = null;
        }
        if (damage == 3) {
            client.U = new sc(16);
            client.U.a(1, new ab(), ((long)type << 32) | id);
        }
        String result = run(() -> {
            if (server) ve.a((byte)guard, -91, id, -83, 24);
            else n.a(id, guard);
        });
        System.out.println(result + "|" + ve.t + "|" + (n.e == null) + "|" +
                entry.T + "," + entry.V + "," + entry.U + "|" + (entry.v < 0) + "|" + ((entry.v & Long.MAX_VALUE) != 0));
    }

    static void clean(int guard, int damage) {
        n body = new n(2), head = new n(2);
        Object value = new Object();
        body.a((byte)-109, value, 1L);
        head.a((byte)-109, value, 2L);
        uf.j = damage == 1 ? null : body;
        l.b = damage == 2 ? null : head;
        String result = run(() -> wk.b(-51, guard));
        System.out.println(result + "|" + body.a(-12623) + "," + head.a(-12623));
    }

    static void label(boolean target, int guard, int fixture) {
        ab.m = cd.a("members", (byte)-120);
        qh.a = fixture == 0 ? null : new se(1);
        na prefix = fixture <= 1 ? null : cd.a("FiR", (byte)-120);
        if (qh.a != null && fixture != 2) qh.a.j[0] = cd.a("first<br>label", (byte)-120);
        if (qh.a != null) {
            qh.a.q[0] = 41;
            qh.a.d[0] = 59;
        }
        bn.N = fixture == 3 ? null : new be();
        if (bn.N != null) { bn.N.n = 20; bn.N.R = 30; }
        mh.S = 17; aa.j = 19; dl.e = 80; oi.m = 70; gj.r = 2.0f;
        lc.l = -1; rj.P = -2;
        na[] completed = new na[1];
        String status = run(() -> {
            if (target) ab.a(prefix, guard);
            else completed[0] = rc.a(prefix, guard != 0);
        });
        na result = completed[0];
        String text = result == null ? "-" : new String(result.T, 0, result.lb, StandardCharsets.ISO_8859_1);
        System.out.println(status + "|" + (ab.m == null) + "|" + lc.l + "," + rj.P + "|" + text);
    }

    public static void main(String[] args) throws Exception {
        Class.forName("client");
        for (int guard : new int[]{-128,-124,-120,-45})
            for (int damage = 0; damage <= 3; damage++) change(true,guard,damage);
        for (int guard : new int[]{91,87,86,-14})
            for (int damage = 0; damage <= 3; damage++) change(false,guard,damage);
        for (int guard : new int[]{64,-76})
            for (int damage = 0; damage <= 2; damage++) clean(guard,damage);
        for (int guard : new int[]{-801,89})
            for (int fixture = 0; fixture <= 4; fixture++) label(true,guard,fixture);
        for (int guard : new int[]{1,0})
            for (int fixture = 0; fixture <= 4; fixture++) label(false,guard,fixture);
    }
}
