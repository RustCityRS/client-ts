import java.nio.file.Path;

/** Observe i.b between differently lit cache zones, including a redirect halfway through a fade. */
public final class HdEnvironmentTransitionOracle {
    static void state(String label, int returned) {
        System.out.println(label + " " + returned + " " + ab.b + " " + md.S + " " + ve.t + " " + ge.q
            + " " + Float.floatToRawIntBits(en.z) + " " + Float.floatToRawIntBits(ui.T) + " " + Float.floatToRawIntBits(bm.a)
            + " " + Float.floatToRawIntBits(jm.s) + " " + Float.floatToRawIntBits(aj.X) + " " + Float.floatToRawIntBits(be.Vb)
            + " " + ig.d + " " + nc.a + " " + sf.c + " " + mk.c + " " + mk.d + " " + sa.W);
    }
    public static void main(String[] args) throws Exception {
        try (GlRecorder rec = new GlRecorder(Path.of(args[0]))) {
            tf.t = rec.gl(null);
            g.b(118);
            ph.b[3][7] = new li();
            li zone = ph.b[3][7];
            zone.c = 0x7523bd; zone.a = 0xf50410; zone.j = 500;
            zone.n = 0.875f; zone.s = 0.375f; zone.q = 1.3125f;
            zone.k = 35; zone.g = -132; zone.d = -26;
            ph.b[8][2] = new li();
            zone = ph.b[8][2];
            zone.c = 0xc62106; zone.a = 0x01c4f0; zone.j = 123;
            zone.n = 1.125f; zone.s = 0.5f; zone.q = 0.75f;
            zone.k = -187; zone.g = -32; zone.d = 11;
            state("clinit", 0);
            for (int n = 0; n < 12; n++) {
                int[] elapsed = {0,1,125,1,40,0,3,262,0,2,1,3};
                int x = n < 3 || n == 8 || n == 9 ? 3 : 8;
                int z = x == 3 ? 7 : 2;
                if (n == 8) sa.W = true;
                fk.g = n != 5 && n != 6;
                rec.mark("env." + n);
                fm.a(true,z,x);
                state("env." + n,i.b(elapsed[n],z,n == 11 ? 4 : 3,x,1));
            }
        }
    }
}
