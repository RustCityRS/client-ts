import java.util.Arrays;
import java.util.StringJoiner;

/** Exercise the same labeled menu operations as HdMenuActionsOracle in the SD gamepack. */
final class SdMenuActionsOracle {
    static id text(String value) { return vb.a(value, (byte)60); }

    static id[] names(int count) {
        id[] labels = new id[count];
        for (int index = 0; index < count; index++) labels[index] = text("op" + index);
        return labels;
    }

    static void printRows() {
        StringJoiner rows = new StringJoiner(" ");
        for (int index = 0; index < vb.o; index++) rows.add(Short.toString(p.u[index]));
        System.out.println(rows);
    }

    public static void main(String[] args) {
        kl item = new kl();
        item.s = text("Item"); item.I = 21; item.vb = names(5);
        fa.b.a(21L, item, (byte)-71);
        aj widget = new aj();
        widget.Kc = 77; widget.bc = 3; widget.ob = 2; widget.y = true; widget.G = widget.M = 1;
        widget.yb = new int[20]; widget.Gb = new int[20]; widget.Zb = new int[]{22}; widget.Sc = new l(-1, -1);
        widget.Tb = widget.E = widget.r = widget.fc = text("widget"); widget.j = names(5); widget.Yc = names(10);
        ja npc = new ja(); npc.r = text("NPC"); npc.F = names(5); npc.hb = true; npc.y = 0;
        te.g = new pb(); pb other = new pb(); other.Gc = text("Player");
        bk.ic = names(8); Arrays.fill(oe.A, true);
        ge.Z = al.s = t.W = text("selected"); oh.a = -1; pj.C = 63;
        long key = (13L << 32) | (2L << 29) | (2 << 7) | 1;
        ah.f = 0; kl.Bb = new ra[1][2][3]; ra tile = kl.Bb[0][1][2] = new ra(0, 1, 2);
        tile.z = new hk(); tile.z.f = key;
        jb loc = new jb(); loc.r = text("Object"); loc.k = 13; loc.kb = names(5);
        he.w.a(13L, loc, (byte)-71); pf.W = new long[]{key}; dd.r = 1;
        oj.j = vf.X = p.l = fl.m = 0;

        for (int mode = 0; mode < 3; mode++) {
            le.c = mode == 1 ? 1 : 0; ok.r = mode == 2; jl.c = 1;
            for (int button = 0; button <= 6; button++) {
                vb.o = 0; widget.f = button;
                sf.a(1, 1, -1, widget); printRows();
            }
            vb.o = 0; bj.a(4, 8, (byte)-112, 9, npc); printRows();
            vb.o = 0; dg.a(8, 4, 10455, 9, other); printRows();
            vb.o = 0; pg.a(0, 1, -127, 10, 10, 1, 0); printRows();
        }
        ig stack = new ig(); stack.m = item.I; item.C = names(5);
        b.H = new gk[1][2][3]; b.H[0][1][2] = new gk();
        b.H[0][1][2].a(new b(stack), false);
        pf.W[0] = (3L << 29) | (2 << 7) | 1;
        for (int mode = 0; mode < 3; mode++) {
            vb.o = 0; le.c = mode == 1 ? 1 : 0; ok.r = mode == 2;
            pg.a(0, 1, -127, 10, 10, 1, 0); printRows();
        }
        vb.o = dd.r = 0; pj.C = 64; qe.W = 0; gh.Y = -1;
        fk.ab = new aj[][]{{widget}}; rg.b = new boolean[]{true};
        pg.a(0, 1, -127, 10, 10, 1, 0); printRows();
        vb.o = 0; ok.r = false; Arrays.fill(oe.A, false);
        dg.a(8, 4, 10455, 9, other); printRows();
        vb.o = jl.c = 0; te.g.uc = 3; npc.y = 10; Arrays.fill(npc.F, fd.eb);
        bj.a(4, 8, (byte)-112, 9, npc); printRows();
        StringJoiner interfaces = new StringJoiner(" "), menuOnly = new StringJoiner(" ");
        for (int id = Short.MIN_VALUE; id <= Short.MAX_VALUE; id++) {
            p.u[0] = (short)id;
            if (o.a(29050, (short)id)) interfaces.add(Integer.toString(id));
            if (re.a(0, (byte)-53)) menuOnly.add(Integer.toString(id));
        }
        System.out.println(interfaces); System.out.println(menuOnly);
    }
}
