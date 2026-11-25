import java.awt.Canvas;
import java.nio.file.Path;
import java.util.*;

/** A real archive-7 model drawn by the unchanged widget provider, gn.a and td.a, with original material definitions. */
public final class HdCachedWidgetModelOracle {
    public static void main(String[] args) throws Exception {
        var rng = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        rng.setAccessible(true);
        ((Random)rng.get(null)).setSeed(530);
        Path directory = Path.of(args[0]);
        en data = HdTitleFrameOracle.open(directory.resolve("main_file_cache.dat2"), 5200);
        en reference = HdTitleFrameOracle.open(directory.resolve("main_file_cache.idx255"), 6000);
        ge master = new ge(255, data, reference, 500000);
        Map<Integer, HdTitleFrameOracle.Disk> disks = new LinkedHashMap<>();
        try (GlRecorder recorder = new GlRecorder(Path.of(args[1])); var factory = recorder.installFactory()) {
            for (int id : new int[]{7, 8, 9, 26}) disks.put(id, new HdTitleFrameOracle.Disk(master, data, directory, id));
            qh.g = new ve(disks.get(7), true, true);
            hf.a(new nk(new ve(disks.get(9), false, true), new ve(disks.get(26), true, true),
                        new ve(disks.get(8), true, true), 20, false));
            hf.a(0.7f);
            recorder.loadProfile(Path.of(args[2]));
            Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
            canvas.setSize(291, 217);
            if (tf.a(canvas, 0) != 0) throw new AssertionError("context creation failed");
            nk.O = new e(); sc.z[0] = true; od.c = true; il.I = 3;
            for (int frame = 0; frame < 2; frame++) {
                recorder.mark("cache-widget." + frame);
                vg.c = true;
                be[] widgets = {HdWidgetModelOracle.widget(0, 13, 0), HdWidgetModelOracle.widget(1, 10, 0)};
                gn.a(7, 11, 9, widgets, 181, -1, 5, 155, (byte)119, 0);
                if (vg.c) throw new AssertionError("cache model did not reach the depth clear");
            }
            recorder.mark("cache-widget.end");
            Object model = jk.z.b(65545L, (byte)121);
            System.out.println(model.getClass().getName() + " " + disks.get(7).requested);
            tf.o();
        } finally {
            for (var disk : disks.values()) disk.file.b(false);
            reference.b(false);
            data.b(false);
        }
    }
}
