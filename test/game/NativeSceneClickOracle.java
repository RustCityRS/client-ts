import java.io.DataOutputStream;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.StringJoiner;

/** Render the actual four-square Lumbridge scene through kk.a, including picking, menu rows and cached cross sprites. */
public final class NativeSceneClickOracle {
    static al[] buildScene(String cache, boolean dynamic) throws Exception {
        al[] archives = new al[28];
        for (int id = 0; id < archives.length; id++) archives[id] = FinishBuildOracle.archive(cache, id);
        uh.O = ef.K = archives[0];
        bc.c = uk.d = archives[1];
        aj.ec = ik.V = archives[2];
        dd.l = archives[3];
        rg.m = archives[4];
        re.d = archives[5];
        al.l = archives[6];
        rk.k = ik.Y = archives[7];
        h.i = archives[8];
        ek.D = archives[10];
        gd.E = archives[11];
        il.B = archives[12];
        gd.U = archives[16];
        ag.i = archives[20];
        ma.g = archives[22];
        dc.r = new kg(archives[9], archives[26], archives[8], 20, false);
        gh.X = new bl();
        ok.z = true;
        rj.l = true;
        fd.X = new int[]{254, 256, 380, 382};
        hh.qb = new int[]{255, 257, 381, 383};
        rb.i = new int[]{49 << 8 | 49, 49 << 8 | 50, 50 << 8 | 49, 50 << 8 | 50};
        jg.w = new int[][]{{-1653558720,2119901478,-1449369788,-1829505468},{1150282919,572626783,-257791473,2031745700},
            {183396243,-461663209,-212681663,-266126212},{0,0,0,0}};
        mk.G = new byte[4][];
        lk.x = new byte[4][];
        ic.V = ah.k = 401;
        hk.e = vj.t = 3160;
        qg.G = dynamic;
        if (qg.G) {
            for (int level = 0; level < 4; level++) {
                for (int x = 0; x < 13; x++) {
                    for (int z = 0; z < 13; z++) {
                        int sourceX = 395 + x, sourceZ = 395 + z;
                        ag.d[level][x][z] = (level << 24) | (sourceX << 14) | (sourceZ << 3) | (((x + z + level) & 3) << 1);
                    }
                }
            }
            ag.d[0][0][0] = -1;
            ag.d[1][12][12] = 9 << 14 | 7 << 3;
        }
        tb.t = new byte[4][104][104];
        for (int level = 0; level < 4; level++) hc.c[level] = new ke(104,104);
        tf.C = 25;
        FinishBuildOracle.seed(53002);
        dc.a(0.8f);
        ki.X = si.u = 0;
        FinishBuildOracle.seed(53003);
        try {
            gj.e(-30458);
        } catch (g error) {
            throw new AssertionError(error.q, error.a);
        }
        if (tf.C != 30) throw new AssertionError("rebuild stage " + bc.e + " state " + tf.C);
        int[][][] collisions = new int[4][][];
        for (int level = 0; level < 4; level++) collisions[level] = hc.c[level].d;
        System.out.println("region " + Arrays.deepHashCode(ve.q) + "," + Arrays.deepHashCode(collisions) + "," + Arrays.deepHashCode(tb.t) + "," + mc.P);
        te.g = new pb();
        te.g.Z = te.g.S = 50 * 128 + 64;
        cl.e = 2;
        rk.m = 6500; mf.i = -1080; ud.g = 5700; bd.X = 256; qj.w = 0;
        ah.f = 0; ja.W = false;
        al sprites = archives[8];
        di.m = oh.a(0, sprites, (byte)75, sprites.a((byte)126, je.jb));
        if (di.m.length != 8) throw new AssertionError("cached cross frames");
        return archives;
    }

    public static void main(String[] args) throws Exception {
        buildScene(args[0], args.length > 2);
        int[] pixels = new int[512 * 334];
        td.a(pixels,512,334);
        dc.d();
        FinishBuildOracle.seed(53004);
        try (DataOutputStream out = FinishBuildOracle.output(Path.of(args[1]), "scene-click")) {
            for (int frame = 0; frame < 9; frame++) {
                // The two mouse positions hit a bare floor and an interactable loc respectively.
                int mode = frame == 0 ? 0 : frame <= 4 ? 1 : 2;
                ve.g = mode == 2 ? 112 : 256;
                ud.j = mode == 2 ? 46 : 167;
                sc.a(ah.f, ve.g - 256, ud.j - 167);
                df.J = mode; jh.r = frame == 0 ? 0 : (frame - 1) % 4 * 100;
                sb.a = ve.g; kg.K = ud.j;
                Arrays.fill(pixels,0);
                vb.o = 0;
                try {
                    kk.a((byte)118,334,512,0,0,false);
                } catch (g error) { throw new AssertionError(error.q, error.a); }
                StringJoiner picks = new StringJoiner(",");
                for (int i = 0; i < dd.r; i++) picks.add(Long.toString(pf.W[i]));
                StringJoiner menu = new StringJoiner(";");
                for (int i = 0; i < vb.o; i++) menu.add(p.u[i]+","+mh.h[i]+","+ml.x[i]+","+sa.z[i]);
                System.out.println("scene " + si.t + "," + hl.Y + "|" + picks + "|" + menu);
                for (int pixel : pixels) out.writeInt(pixel);
            }
        }
    }
}
