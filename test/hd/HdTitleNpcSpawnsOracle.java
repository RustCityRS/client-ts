import java.awt.Canvas;
import java.nio.file.Path;
import java.util.Arrays;

/** Observe the real gd.c title build, then replay its populated NPC map through mh.h. */
public class HdTitleNpcSpawnsOracle {
    static final int REGION = (42 << 8) | 83;
    static final class Finished extends Error {}

    static String ints(int[] values) {
        return Arrays.toString(values).replace(" ", "");
    }

    static void snapshot(String name) {
        System.out.println("case " + name + " " + ints(Arrays.copyOf(rj.Z, mg.Q)) + " " + ints(Arrays.copyOf(cj.i, wd.g)));
        for (int pos = 0; pos < wd.g; pos++) {
            int index = cj.i[pos];
            km npc = nm.S[index];
            System.out.println("npc " + ints(new int[]{index, npc.rc.X, npc.kc, npc.c((byte)114), npc.Ab, npc.cb,
                npc.W, npc.G, npc.Qb, npc.ac, npc.Nb}) + " " + ints(npc.K) + " " + ints(npc.w));
        }
    }

    static void fault(String name) {
        try {
            mh.h((byte)-124);
            throw new AssertionError("missing fault " + name);
        } catch (ld e) {
            System.out.println("fault " + name + " " + e.f.getClass().getSimpleName() + " " + e.e);
        }
        snapshot(name);
    }

    static void inspect() {
        System.out.println("input " + se.a + " " + lc.n + " " + dc.ab + " " + gj.d);
        byte[] selected = null;
        for (int i = 0; i < pg.jb.length; i++) {
            if (pg.jb[i] == null) continue;
            System.out.println("group " + i + " " + te.H[i] + " " + nm.P[i] + " " + pg.jb[i].length + " " + Arrays.hashCode(pg.jb[i]));
            if (te.H[i] == REGION) selected = pg.jb[i];
        }
        if (selected == null || selected.length == 0) throw new AssertionError("missing n42_83");
        snapshot("title");
        pg.jb = new byte[][]{selected};
        te.H = new int[]{REGION};
        se.a = 42 * 64;
        lc.n = 83 * 64;
        for (int plane = 0; plane < 4; plane++) {
            dc.ab = plane;
            Arrays.fill(nm.S, null);
            mg.Q = wd.g = 0;
            mh.h((byte)-124);
            snapshot("plane" + plane);
            gj.d++;
            mh.h((byte)-124);
            snapshot("occupied" + plane);
        }
        dc.ab = 0;
        rg.b(5758, 27112).G = 8;
        fault("direction");
        pg.jb = null;
        fault("null-data");
        throw new Finished();
    }

    public static void main(String[] args) throws Exception {
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765, 503);
        try (GlRecorder gl = new GlRecorder(null); AutoCloseable factory = gl.installFactory()) {
            gl.loadProfile(Path.of(args[1]));
            try {
                HdTitleFrameOracle.run(Path.of(args[0]), canvas, frame -> {}, phase -> {
                    if (phase.equals("region.build") && (mg.Q != 0 || wd.g != 0)) throw new AssertionError("title NPCs before gd.c");
                    if (phase.equals("warmup")) inspect();
                });
                throw new AssertionError("title build never reached warmup");
            } catch (Finished done) {}
        }
    }
}
