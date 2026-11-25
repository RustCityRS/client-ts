import java.awt.Canvas;
import java.awt.Graphics;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.StringJoiner;

// Each row starts with fresh packet-era globals, then calls bj.a(IIIIIIZ)V from the gamepack.
public class RegionRebuildFaultOracle {
    static final IdentityHashMap<gk, Integer> piles = new IdentityHashMap<>();
    static gh area;
    static boolean changeCentre;

    static void place(ob entity, int offset) {
        entity.Z = 5800 + offset;
        entity.S = 7100 + offset;
        entity.F = 2;
        for (int i = 0; i < 10; i++) {
            entity.L[i] = 44 + offset - i;
            entity.ac[i] = 51 + offset + i;
        }
    }

    static int groundHash() {
        if (b.H == null) return 0;
        int h = 31 + b.H.length;
        for (gk[][] plane : b.H) {
            h = h * 31 + (plane == null ? -1 : plane.length);
            if (plane == null) continue;
            for (gk[] row : plane) {
                h = h * 31 + (row == null ? -1 : row.length);
                if (row != null) for (gk tile : row) h = h * 31 + (tile == null ? 0 : piles.get(tile));
            }
        }
        return h;
    }

    static void run(String line) {
        String[] words = line.split(" ");
        String mode = words[0];
        boolean title = words[1].equals("1");
        int cx = Integer.parseInt(words[2]), cz = Integer.parseInt(words[3]);
        ic.V = -33; ah.k = -42; sb.h = 2; hk.e = 0; vj.t = 0; ah.f = 3;
        jh.k = null; ug.d = new kc(0); rj.l = false; vg.kb = 0; tf.C = title ? 28 : 25;
        cl.e = 5; gk.j = 3; ag.l = 19; o.S = 38; qf.c = 45; vc.R = 54; t.Z = 60;
        rk.m = Integer.MIN_VALUE + 6; ud.g = Integer.MAX_VALUE - 7; gl.z = 43; ic.T = -73;
        ed.d = 9; fi.n = new int[3]; Arrays.fill(fi.n, -7);
        uc.l = new bk[32768];
        bk first = uc.l[0] = new bk(), second = uc.l[2] = new bk();
        first.mc = new ja(); second.mc = new ja();
        place(first, 1); place(second, 4);
        tf.J = new pb[2048];
        pb player = tf.J[1] = new pb(), self = te.g = tf.J[2047] = new pb();
        place(player, 7); place(self, 12);
        b.H = new gk[4][104][104];
        piles.clear();
        for (gk[][] plane : b.H) for (int x : new int[]{0, 8, 95, 103}) for (int z : new int[]{0,1,16,17,87,103}) {
            gk pile = plane[x][z] = new gk();
            piles.put(pile, piles.size() + 1);
        }
        wh.S = new gk();
        ff loc = new ff(); loc.w = 35; loc.N = 48; wh.S.a(loc, false);
        cg.f = new gk(); cg.f.a(new jf(), false);
        ph.g = new gk(); ph.g.a(new jf(), false);
        changeCentre = false;
        switch (mode) {
        case "ok": break;
        case "centre-callback": changeCentre = true; break;
        case "npc-table-null": uc.l = null; break;
        case "npc-table-short": uc.l = Arrays.copyOf(uc.l, 2); break;
        case "npc-x-null": second.L = null; break;
        case "npc-x-short": second.L = Arrays.copyOf(second.L, 3); break;
        case "npc-z-null": second.ac = null; break;
        case "npc-z-short": second.ac = Arrays.copyOf(second.ac, 3); break;
        case "culled-npc": second.Z = -2345; second.L = null; break;
        case "npc-ids-null": fi.n = null; break;
        case "npc-ids-short": fi.n = new int[1]; break;
        case "player-table-null": tf.J = null; break;
        case "player-table-short": tf.J = Arrays.copyOf(tf.J, 2); break;
        case "player-x-null": player.L = null; break;
        case "player-x-short": player.L = Arrays.copyOf(player.L, 6); break;
        case "player-z-null": player.ac = null; break;
        case "player-z-short": player.ac = Arrays.copyOf(player.ac, 6); break;
        case "self-null": te.g = null; break;
        case "ground-null": b.H = null; break;
        case "planes-short": b.H = Arrays.copyOf(b.H, 2); break;
        case "plane-null": b.H[2] = null; break;
        case "x-short": b.H[1] = Arrays.copyOf(b.H[1], 4); break;
        case "z-short": b.H[1][0] = Arrays.copyOf(b.H[1][0], 2); break;
        case "dest-null-source-short": b.H[1][0] = null; b.H[1][8] = new gk[2]; break;
        case "dest-short-source-null": b.H[1][0] = new gk[0]; b.H[1][8] = null; break;
        case "end-dest-null": b.H[1][103] = null; break;
        case "loc-null": wh.S = null; break;
        case "loc-class": wh.S.a(new jf(), false); break;
        case "spot-null": ph.g = null; break;
        case "proj-null": cg.f = null; break;
        default: throw new AssertionError(mode);
        }
        String outcome = "ok";
        try {
            bj.a(1, cz, 43, 0, cx, 52, title);
        } catch (RuntimeException error) {
            Throwable t = error;
            while (t instanceof g) t = ((g)t).a;
            if (t instanceof NullPointerException) outcome = "null";
            else if (t instanceof ArrayIndexOutOfBoundsException) outcome = "bounds";
            else if (t instanceof ClassCastException) outcome = "cast";
            else throw error;
        }
        StringJoiner row = new StringJoiner(" ");
        row.add(outcome);
        for (int n : new int[]{vg.kb, tf.C, ic.V, ah.k, sb.h, hk.e, vj.t, ah.f, jh.k == area ? 1 : 0, ug.d == null ? 0 : 1,
            ed.d, Arrays.hashCode(fi.n), uc.l == null ? -1 : uc.l.length, tf.J == null ? -1 : tf.J.length})
            row.add(Integer.toString(n));
        for (ob actor : new ob[]{first, second, player, self}) for (int n : new int[]{actor.Z, actor.S, actor.F,
            Arrays.hashCode(actor.L), Arrays.hashCode(actor.ac)}) row.add(Integer.toString(n));
        for (int n : new int[]{second.mc == null ? 0 : 1, uc.l != null && uc.l.length > 2 && uc.l[2] == second ? 1 : 0,
            groundHash(), loc.w, loc.N, ((jf)loc).p == null ? 0 : 1, ag.l, gk.j, cl.e, o.S, rk.m, qf.c, vc.R, t.Z, ud.g,
            gl.z, ic.T, ph.g == null ? -1 : ph.g.d(0) == null ? 0 : 1, cg.f == null ? -1 : cg.f.d(0) == null ? 0 : 1})
            row.add(Integer.toString(n));
        System.out.println(row);
    }

    public static void main(String[] args) throws Exception {
        wj.g = new fg(new byte[257], new int[256], new int[256], new int[256], new int[256], new byte[256][0]);
        qd.s = vb.a("", (byte)54);
        pe.S = new Canvas() {
            public Graphics getGraphics() {
                if (changeCentre) { ic.V = 20; ah.k = 21; hk.e = 12; vj.t = -15; }
                return null;
            }
        };
        ba.d = new gk();
        area = new gh(null, null, 0, 0, 0, true, 1);
        area.U.a(new ie(152, 155, 178, 182), false); area.c(0); ba.d.a(area, false);
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = reader.readLine()) != null;) run(line);
    }
}
