import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Random;

// Run stage 80's sprite loader directly with both renderers in the HD JAR.
public final class HdMapfunctionSpritesOracle {
    public static void main(String[] args) throws Exception {
        Path directory = Path.of(args[0]);
        en data = HdTitleFrameOracle.open(directory.resolve("main_file_cache.dat2"), 5200);
        en index = HdTitleFrameOracle.open(directory.resolve("main_file_cache.idx255"), 6000);
        ge master = new ge(255, data, index, 500000);
        ve sprites = new ve(new HdTitleFrameOracle.Disk(master, data, directory, 8), false, false);
        ve metrics = new ve(new HdTitleFrameOracle.Disk(master, data, directory, 13), false, false);
        g.a(208, sprites);
        hn.a(metrics, 0, sprites);
        cg.a(21, sprites);
        Field random = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        random.setAccessible(true);
        try (var output = new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(Path.of(args[1]))))) {
            for (int i = 3; i < args.length; i++) {
                ((Random)random.get(null)).setSeed(Long.parseLong(args[i]));
                cg.a(21, sprites);
                if (tf.w || nk.L != fe.lc) throw new AssertionError("software mapfunction array");
                output.writeInt(nk.L.length);
                for (mm sprite : nk.L) {
                    output.writeInt(sprite.L.length);
                    for (int pixel : sprite.L) output.writeInt(pixel);
                }
                output.writeDouble(Math.random());
            }
            try (GlRecorder recorder = new GlRecorder(null)) {
                recorder.loadProfile(Path.of(args[2]));
                tf.t = recorder.gl();
                int shadowGroup = gk.j;
                Field palette = ek.class.getDeclaredField("n");
                palette.setAccessible(true);
                for (boolean missing : new boolean[]{false, true}) {
                    for (boolean active : new boolean[]{false, true}) {
                        tf.w = active;
                        gk.j = missing ? -1 : shadowGroup;
                        ek[] before = tj.d;
                        qf compass = ic.a;
                        try {
                            cg.a(21, sprites);
                            output.writeByte(0);
                        } catch (ld wrapped) {
                            if (!(wrapped.f instanceof NullPointerException)) throw wrapped;
                            output.writeByte(1);
                        }
                        output.writeBoolean(before == tj.d);
                        output.writeBoolean(compass == ic.a);
                        output.writeBoolean(ic.a instanceof cf);
                        for (qf sprite : wi.R) output.writeBoolean(sprite instanceof cf);
                        for (qf sprite : fe.lc) output.writeBoolean(sprite instanceof cf);
                        output.writeBoolean(nk.L == fe.lc);
                        output.writeInt(tj.d == null ? -1 : tj.d.length);
                        if (tj.d == null) continue;
                        for (ek shadow : tj.d) {
                            for (int dim : new int[]{shadow.l, shadow.i, shadow.m, shadow.d, shadow.a, shadow.k}) output.writeInt(dim);
                            output.writeInt(shadow.o.length);
                            output.write(shadow.o);
                            int[] colours = (int[])palette.get(shadow);
                            output.writeInt(colours.length);
                            for (int colour : colours) output.writeInt(colour);
                        }
                    }
                }
            }
        }
    }
}
