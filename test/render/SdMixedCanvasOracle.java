import java.awt.Component;
import java.awt.Graphics;
import java.io.DataOutputStream;
import java.nio.file.Path;

/** Untouched client.jar draws two views of one rebuilt map, followed by its ordinary SD overlays. */
public final class SdMixedCanvasOracle {
    static final int WIDTH = 496, HEIGHT = 340;

    static id text(String value) {
        id key = new id();
        key.A = value.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        key.c = key.A.length;
        return key;
    }

    static aj mask(int child) {
        aj c = ad.a((byte)110, (548 << 16) | child);
        c.C = c.G;
        c.H = c.M;
        if (!c.a(22710)) throw new AssertionError("missing original mask " + child);
        return c;
    }

    static void checkpoint(DataOutputStream out, int[] pixels) throws Exception {
        // Full signed td.g words, including the portion beyond this draw's clip.
        for (int pixel : pixels) out.writeInt(pixel);
    }

    public static void main(String[] args) throws Exception {
        al[] archives = NativeSceneClickOracle.buildScene(args[0], false);
        FinishBuildOracle.seed(55301);
        kh.a(archives[8], archives[2], (byte)-103);
        wf.a(archives[13], archives[8], true, archives[7], archives[3]);
        ld.a(archives[8], 52);
        si.a((byte)114, archives[8], archives[13]);
        FinishBuildOracle.seed(55302);
        uf.a(archives[8], -7058);
        aj map = mask(64), compass = mask(65);
        if (map.wc != 1338 || compass.wc != 1339) throw new AssertionError("unexpected cached widgets");
        rg.s = new oh() {
            void a(int a, int b, int c, Graphics g) {}
            void a(int a, int b, Component c, byte d) {}
            void a(byte a, int b, int c, int d, int e, Graphics g) {}
        };
        rg.s.i = WIDTH;
        rg.s.e = HEIGHT;
        int[] pixels = rg.s.n = new int[WIDTH * HEIGHT];
        FinishBuildOracle.seed(55303);
        if (!ph.a(0, true)) throw new AssertionError("Lumbridge minimap unavailable");
        if (td.g != pixels) throw new AssertionError("lost original frame target");
        dc.d();
        for (int i = 0; i < pixels.length; i++) pixels[i] = 0x204060 ^ (i * 31 & 0x1f3f5f);
        ug.d = null;
        ve.g = ud.j = -1;
        df.J = 0;
        FinishBuildOracle.seed(55304);
        try (DataOutputStream out = FinishBuildOracle.output(Path.of(args[1]), "mixed-canvas")) {
            kk.a((byte)118, 174, 255, 17, 13, false);
            checkpoint(out, pixels);
            qj.w = 105;
            kk.a((byte)118, 179, 278, 132, 143, false);
            checkpoint(out, pixels);
            df.J = 2; jh.r = 200; sb.a = 241; kg.K = 159;
            qa.a(278, 179, 143, 132, -90);
            checkpoint(out, pixels);
            df.B = 317; ag.e = 23; kk.db = 41; ki.R = 0;
            fd.a(288, map, 3, 32, 15);
            checkpoint(out, pixels);
            ke.a(4, compass, 3, 301, 17);
            checkpoint(out, pixels);
            df.B = 1747;
            ki.R = 5;
            fd.a(288, map, 3, 32, 15);
            ke.a(4, compass, 3, 301, 17);
            checkpoint(out, pixels);
            td.b(205, 172, 405, 192);
            int[] offsets = new int[20], lengths = new int[20];
            for (int i = 0; i < 20; i++) { offsets[i] = 63 + i % 9; lengths[i] = 70 - i % 7; }
            td.a(offsets, lengths);
            wj.g.a(text("<col=ff7f00>Rune</col><u>Scape</u> 530"), 285, 188, 0xfdf8c9, 0x080e14);
            checkpoint(out, pixels);
            td.b(100, 160, 415, 230);
            ma.b.a(text("Lumbridge <col=87f83e>Castle</col>"), 190, 195, 155, 30, 0xfcac37, 0x470c56, 129, 1, 1, 0);
            checkpoint(out, pixels);
            td.c();
            int[] source = {0x55ffc844,0xff112233,0,0xff886633,0x873427ba,0x00ff0077};
            rh swatch = new rh(3,2,0,0,3,2,source);
            swatch.c(183,165);
            swatch.b();
            td.d(0,0,3,2,0xe52af5);
            td.a(pixels,WIDTH,HEIGHT);
            swatch.c(184,166);
            vh alpha = new vh(3,2,0,0,3,2,new int[]{0xffcc2200,0xfe71c958,0x01001122,0,0x10304550,0x8055cc22});
            alpha.c(185,166);
            td.b(185,167,10,3,0xffee2288,37);
            // Native rh catches the source fault and keeps the visible two-pixel prefix.
            swatch.b(196,167,5,1,3,1,0,256,new int[]{0},new int[]{5});
            checkpoint(out, pixels);
        } catch (g error) { throw new AssertionError(error.q, error.a); }
    }
}
