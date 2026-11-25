import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HexFormat;

/** Render the cached login interface before and after its actual OnLoad scripts. */
class CacheTitleFrameOracle {
    public static void main(String[] args) throws Exception {
        Path cache = Path.of(args[0]);
        try (var interfaces = new ProceduralTextureCacheOracle.Disk(cache, 3);
             var models = new ProceduralTextureCacheOracle.Disk(cache, 7);
             var glyphs = new ProceduralTextureCacheOracle.Disk(cache, 8);
             var scripts = new ProceduralTextureCacheOracle.Disk(cache, 12);
             var metrics = new ProceduralTextureCacheOracle.Disk(cache, 13)) {
            h.i = new al(glyphs, false, false);
            dd.l = new al(interfaces, false, false);
            wf.a(new al(metrics, false, false), h.i, true, new al(models, false, false), dd.l);
            il.B = new al(scripts, false, false);
            hi.f = 765; fl.l = 503; hd.m = Integer.parseInt(args[1]);
            tf.C = 10; ik.R = qj.C = 1;
            wi.i = h.i.a((byte)110, ek.J);
            od.a(h.i, 0);
            for (int phase = 0; phase < 2; phase++) {
                if (phase == 1) {
                    ma.a(HexFormat.of().parseHex("0101010000555300010101000000000001002d00006c6f63616c686f73740000000001000000"),1);
                    gd.b(hd.m, (byte)-89);
                }
                ik.a(false, false);
                Arrays.fill(n.i, true);
                ik.G = 0;
                td.a(new int[hi.f * fl.l], hi.f, fl.l);
                b.c(1);
                ByteBuffer pixels = ByteBuffer.allocate(td.g.length * 4).order(ByteOrder.LITTLE_ENDIAN);
                pixels.asIntBuffer().put(td.g);
                System.out.write(pixels.array());
            }
        }
    }
}
