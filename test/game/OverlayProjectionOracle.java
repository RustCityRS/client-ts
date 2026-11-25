import java.io.*;

public final class OverlayProjectionOracle {
    static void terrain(int mode) {
        ve.q = mode == 2 ? null : new int[4][105][105];
        tb.t = mode == 3 ? null : new byte[4][104][104];
        for (int p = 0; p < 4; p++) for (int x = 0; x <= 104; x++) for (int z = 0; z <= 104; z++) {
            if (ve.q != null) ve.q[p][x][z] = mode == 1 ? (x*1664525 ^ z*1013904223) + p*1515870810 : p*240 + x*3 - z*5;
            if (tb.t != null && x < 104 && z < 104 && ((x+z)&1) == 0) tb.t[p][x][z] = 2;
        }
        if (mode == 4) ve.q[0][2] = null;
    }

    public static void main(String[] args) throws Exception {
        DataInputStream in = new DataInputStream(new BufferedInputStream(System.in));
        int count = in.readInt(), last = -1;
        pb actor = new pb();
        for (int i = 0; i < count; i++) {
            int mode = in.readInt();
            if (mode != last) { terrain(mode); last = mode; }
            int x = in.readInt(), z = in.readInt(), height = in.readInt(), cx = in.readInt(), cy = in.readInt();
            rk.m = in.readInt(); mf.i = in.readInt(); ud.g = in.readInt(); bd.X = in.readInt(); qj.w = in.readInt(); ah.f = in.readInt();
            StringBuilder row = new StringBuilder();
            try { row.append(ml.a(ah.f, x, z, (byte)-20)); } catch (RuntimeException ex) { row.append("error"); }
            jl.e = -567; tg.z = 912;
            try { aj.a(0, cy, false, z, 0, height, cx, x); row.append(" ok"); } catch (RuntimeException ex) { row.append(" error"); }
            row.append(' ').append(jl.e).append(' ').append(tg.z);
            jl.e = -567; tg.z = 912;
            actor.Z = x; actor.S = z;
            try { vi.a(cy,(byte)45,cx,0,0,height,actor); row.append(" ok"); } catch (RuntimeException ex) { row.append(" error"); }
            System.out.println(row.append(' ').append(jl.e).append(' ').append(tg.z));
        }
    }
}
