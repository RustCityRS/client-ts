import java.awt.Component;
import java.awt.Graphics;
import java.io.DataOutputStream;
import java.nio.file.Path;
import java.util.Arrays;

// Run the cached top-level interface with the original viewport, terrain and minimap.
public final class NativeRootSdOracle {
    public static void main(String[] args) throws Exception {
        final int width = 765, height = 503;
        al[] archives = NativeSceneClickOracle.buildScene(args[0], false);
        FinishBuildOracle.seed(55301);
        kh.a(archives[8], archives[2], (byte)-103);
        wf.a(archives[13], archives[8], true, archives[7], archives[3]);
        ld.a(archives[8], 52);
        si.a((byte)114, archives[8], archives[13]);
        FinishBuildOracle.seed(55302);
        uf.a(archives[8], -7058);
        rg.s = new oh() {
            void a(int a, int b, int c, Graphics g) {}
            void a(int a, int b, Component c, byte d) {}
            void a(byte a, int b, int c, int d, int e, Graphics g) {}
        };
        rg.s.i = hi.f = width;
        rg.s.e = fl.l = height;
        int[] pixels = rg.s.n = new int[width * height];
        FinishBuildOracle.seed(55303);
        if (!ph.a(0, true)) throw new AssertionError("minimap");
        ug.d = null;
        ve.g = ud.j = -1;
        jg.C = false;
        ie.F = true;
        hd.m = 548;
        qd mount = new qd();
        mount.v = 149;
        va.Z.a((byte)-89, mount, (548L << 16) + 11);
        ik.a(false, false);
        try (DataOutputStream out = FinishBuildOracle.output(Path.of(args[1]), "root")) {
            for (int yaw : new int[]{0, 128}) {
                qj.w = yaw;
                FinishBuildOracle.seed(55304);
                Arrays.fill(n.i, true);
                ik.G = 0;
                td.a(pixels,width,height);
                dc.d();
                Arrays.fill(pixels, 0x131b23);
                b.c(1);
                for (int pixel : pixels) out.writeInt(pixel);
            }
        }
    }
}
