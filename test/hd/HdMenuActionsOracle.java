import java.util.Arrays;
import java.util.StringJoiner;

final class HdMenuActionsOracle {
    static na text(String value) { return cd.a(value, (byte)-128); }

    static na[] names(int count) {
        na[] labels = new na[count];
        for (int index = 0; index < count; index++) labels[index] = text("op" + index);
        return labels;
    }

    static void printRows() {
        StringJoiner rows = new StringJoiner(" ");
        for (int i = 0; i < sk.kb; i++) {
            short action = d.eb[i];
            rows.add(action + "," + pl.e[i] + "," + ef.c[i] + "," + mi.U[i] + ","
                    + wi.c(i, 0) + "," + aa.a(action, 121));
        }
        System.out.println(rows);
    }

    public static void main(String[] args) {
        h item = new h();
        item.E = text("Item"); item.Y = 21; item.U = names(5);
        cb.Y.a((byte)-77, item, 21L);
        be widget = new be();
        widget.Fc = 77; widget.O = 3; widget.I = 2; widget.Hb = true; widget.w = widget.Tb = 1;
        widget.yc = new int[20]; widget.cd = new int[20]; widget.dc = new int[]{22}; widget.gc = new bf(-1, -1);
        widget.Sb = widget.Ub = widget.Dc = widget.Rc = text("widget"); widget.s = names(5); widget.q = names(10);
        me npc = new me(); npc.L = text("NPC"); npc.u = names(5); npc.I = true; npc.x = 0;
        nk.O = new e(); e other = new e(); other.Mc = text("Player"); other.Xc = 1;
        mj.d = names(8); Arrays.fill(a.f, true);
        ck.D = gd.i = hn.W = text("selected"); jg.b = -1; wf.f = 63;

        long key = (13L << 32) | (2L << 29) | (2 << 7) | 1;
        ee.b = 0; kc.o = new bj[1][2][3]; bj tile = kc.o[0][1][2] = new bj(0, 1, 2);
        tile.K = new jh(); tile.K.d = key;
        pb loc = new pb(); loc.E = text("Object"); loc.hb = 13; loc.z = names(5);
        oe.j.a((byte)-77, loc, 13L); vc.V = new long[]{key}; aa.a = 1;
        tg.c = ub.m = a.g = li.x = 0;

        for (int mode = 0; mode < 3; mode++) {
            vd.C = mode == 1 ? 1 : 0; th.n = mode == 2; vk.n = 1;
            for (int button = 0; button <= 6; button++) {
                sk.kb = 0; widget.xd = button;
                va.a(1, true, 1, widget); printRows();
            }
            sk.kb = 0; u.a(npc, 4, -126, 9, 8); printRows();
            sk.kb = 0; rj.a(9, 31, 8, other, 4); printRows();
            sk.kb = 0; ob.a(0, 10, 10, 0, 1, 1, (byte)66); printRows();
        }
        if (args.length == 0) return;
        uj stack = new uj(); stack.D = item.Y; item.qb = names(5);
        mi.Y = new ih[1][2][3]; mi.Y[0][1][2] = new ih();
        mi.Y[0][1][2].a(true, new pa(stack));
        vc.V[0] = (3L << 29) | (2 << 7) | 1;
        for (int mode = 0; mode < 3; mode++) {
            sk.kb = 0; vd.C = mode == 1 ? 1 : 0; th.n = mode == 2;
            ob.a(0, 10, 10, 0, 1, 1, (byte)66); printRows();
        }
        sk.kb = aa.a = 0; wf.f = 64; hj.e = 0; be.Ec = -1;
        th.j = new be[][]{{widget}}; sc.m = new boolean[]{true};
        ob.a(0, 10, 10, 0, 1, 1, (byte)66); printRows();
        sk.kb = 0; th.n = false; Arrays.fill(a.f, false);
        rj.a(9, 31, 8, other, 4); printRows();
        sk.kb = vk.n = 0; nk.O.yc = 3; npc.x = 10; Arrays.fill(npc.u, ui.Y);
        u.a(npc, 4, -126, 9, 8); printRows();
        StringJoiner interfaces = new StringJoiner(" "), menuOnly = new StringJoiner(" ");
        for (int id = Short.MIN_VALUE; id <= Short.MAX_VALUE; id++) {
            d.eb[0] = (short)id;
            if (aa.a((short)id, 121)) interfaces.add(Integer.toString(id));
            if (wi.c(0, 0)) menuOnly.add(Integer.toString(id));
        }
        System.out.println(interfaces); System.out.println(menuOnly);
    }
}
