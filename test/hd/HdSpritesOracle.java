import java.io.PrintWriter;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

// The Java side of gl-2d-sprites.test.ts. Drives the GL sprite (cf), the GL alpha sprite (el) and the GL raster (dj)
// of the unmodified runescape_gl.jar with GlRecorder as tf.t and tf.w set, and writes the GLTrace to <out>/trace.tsv
// and the Java-visible state after every step to <out>/state.txt.
//
//   java HdSpritesOracle <cache dir> <out dir> script <script file>
//   java HdSpritesOracle <cache dir> <out dir> upload <group id limit>
//
// script: one operation per line (the grammar is the TS test's); each is preceded by the trace mark op<n> and
// followed by "<n> ok|threw <exception> <state>". upload: every group of archive 8 through uj.a(BLve;I)Z (the sprite
// group loader) and re.b(I)[Lqf; (the sprite builder, cf or el per frame), with the mark g<group> before each group
// and one line per frame. Every sprite stays referenced until the end, so no finalizer runs on its own.
public final class HdSpritesOracle {
    private static final Map<Integer, cf> sprites = new HashMap<>();
    private static final List<Object> retained = new ArrayList<>();
    private static ve archive;
    private static Field djD, cfZ, cfBb, cfDb;

    public static void main(String[] args) throws Exception {
        Path directory = Path.of(args[0]);
        Path out = Path.of(args[1]);
        en data = HdTitleFrameOracle.open(directory.resolve("main_file_cache.dat2"), 5200);
        en index = HdTitleFrameOracle.open(directory.resolve("main_file_cache.idx255"), 6000);
        ge master = new ge(255, data, index, 500000);
        archive = new ve(new HdTitleFrameOracle.Disk(master, data, directory, 8), false, false);
        djD = field(dj.class, "d");
        cfZ = field(cf.class, "Z");
        cfBb = field(cf.class, "bb");
        cfDb = field(cf.class, "db");
        GlRecorder recorder = new GlRecorder(out);
        tf.t = recorder.gl();
        tf.w = true;
        try (PrintWriter state = new PrintWriter(Files.newBufferedWriter(out.resolve("state.txt")))) {
            if (args[2].equals("upload")) {
                int limit = Integer.parseInt(args[3]);
                for (int group = 0; group < limit; group++) {
                    if (!uj.a((byte)-120, archive, group)) continue;
                    recorder.mark("g" + group);
                    qf[] frames = re.b(-26802);
                    for (int i = 0; i < frames.length; i++) {
                        cf sprite = (cf)frames[i];
                        retained.add(sprite);
                        state.print(group + " " + i + " " + (sprite instanceof el ? "el" : "cf") + " " + sprite(sprite) + "\n");
                    }
                }
                state.print("fa=" + fa.e + "," + fa.c + "\n");
            } else {
                int n = 0;
                for (String line : Files.readAllLines(Path.of(args[3]))) {
                    if (line.isEmpty()) continue;
                    recorder.mark("op" + n);
                    String result;
                    try {
                        run(line.split(" "));
                        result = "ok";
                    } catch (Throwable e) {
                        result = "threw " + e.getClass().getSimpleName();
                    }
                    state.print(n + " " + result + " " + state() + "\n");
                    n++;
                }
            }
        }
        recorder.close();
    }

    private static Field field(Class<?> owner, String name) throws NoSuchFieldException {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    private static int i(String[] t, int index) {
        return Integer.parseInt(t[index]);
    }

    // The test's pixel generator: an LCG, with a pixel forced to 0 (transparent) when (x >>> 16) % zeroEvery == 0.
    private static int[] pixels(int seed, int zeroEvery, int length) {
        int[] pixels = new int[length];
        int x = seed;
        for (int i = 0; i < length; i++) {
            x = x * 1103515245 + 12345;
            pixels[i] = zeroEvery > 0 && (x >>> 16) % zeroEvery == 0 ? 0 : x;
        }
        return pixels;
    }

    private static cf sprite(String id) {
        int key = Integer.parseInt(id);
        if (key < 0) return null;
        cf sprite = sprites.get(key);
        if (sprite == null) throw new IllegalStateException("no sprite " + id);
        return sprite;
    }

    private static void put(int id, cf sprite) {
        sprites.put(id, sprite);
        retained.add(sprite);
    }

    private static void run(String[] t) throws Throwable {
        switch (t[0]) {
            case "size" -> { tf.J = i(t, 1); tf.A = i(t, 2); }
            case "big" -> tf.f = i(t, 1) != 0;
            case "new" -> {
                int[] pixels = pixels(i(t, 9), i(t, 10), i(t, 7) * i(t, 8));
                put(i(t, 1), t[2].equals("el") ? new el(i(t, 3), i(t, 4), i(t, 5), i(t, 6), i(t, 7), i(t, 8), pixels)
                    : new cf(i(t, 3), i(t, 4), i(t, 5), i(t, 6), i(t, 7), i(t, 8), pixels));
            }
            case "newmm" -> {
                int[] pixels = pixels(i(t, 9), i(t, 10), i(t, 7) * i(t, 8));
                if (t[2].equals("el")) put(i(t, 1), new el(new am(i(t, 3), i(t, 4), i(t, 5), i(t, 6), i(t, 7), i(t, 8), pixels)));
                else put(i(t, 1), new cf(new mm(i(t, 3), i(t, 4), i(t, 5), i(t, 6), i(t, 7), i(t, 8), pixels)));
            }
            case "cache" -> {
                if (!uj.a((byte)-120, archive, i(t, 2))) throw new IllegalStateException("group " + t[2]);
                qf[] frames = re.b(-26802);
                for (qf frame : frames) retained.add(frame);
                put(i(t, 1), (cf)frames[i(t, 3)]);
            }
            case "reup" -> { cf s = sprite(t[1]); s.a(pixels(i(t, 2), i(t, 3), s.W * s.I)); }
            case "fin" -> sprite(t[1]).finalize();
            case "flush" -> fa.c();
            case "fareset" -> fa.b();
            case "d" -> draw(sprite(t[1]), t);
            case "hline" -> dj.a(i(t, 1), i(t, 2), i(t, 3), i(t, 4));
            case "vline" -> dj.b(i(t, 1), i(t, 2), i(t, 3), i(t, 4));
            case "reset" -> dj.c();
            case "pix" -> dj.a(pixels(i(t, 1), i(t, 2), i(t, 5) * i(t, 6)), i(t, 3), i(t, 4), i(t, 5), i(t, 6));
            case "pixnull" -> dj.a((int[])null, i(t, 1), i(t, 2), i(t, 3), i(t, 4));
            case "rect" -> dj.a(i(t, 1), i(t, 2), i(t, 3), i(t, 4), i(t, 5));
            case "rectT" -> dj.a(i(t, 1), i(t, 2), i(t, 3), i(t, 4), i(t, 5), i(t, 6));
            case "thick" -> dj.b(i(t, 1), i(t, 2), i(t, 3), i(t, 4), i(t, 5), i(t, 6));
            case "fillT" -> dj.c(i(t, 1), i(t, 2), i(t, 3), i(t, 4), i(t, 5), i(t, 6));
            case "inter" -> dj.c(i(t, 1), i(t, 2), i(t, 3), i(t, 4));
            case "clear" -> dj.d();
            case "line" -> dj.b(i(t, 1), i(t, 2), i(t, 3), i(t, 4), i(t, 5));
            case "fill" -> dj.c(i(t, 1), i(t, 2), i(t, 3), i(t, 4), i(t, 5));
            case "clip" -> dj.d(i(t, 1), i(t, 2), i(t, 3), i(t, 4));
            case "mask" -> dj.a(sprite(t[1]));
            case "nomask" -> dj.a();
            case "unload" -> dj.b();
            default -> throw new AssertionError(t[0]);
        }
    }

    private static void draw(cf s, String[] t) {
        switch (t[2]) {
            case "e2" -> s.e(i(t, 3), i(t, 4));
            case "c2" -> s.c(i(t, 3), i(t, 4));
            case "d2" -> s.d(i(t, 3), i(t, 4));
            case "a3" -> s.a(i(t, 3), i(t, 4), i(t, 5));
            case "a6" -> s.a(i(t, 3), i(t, 4), i(t, 5), i(t, 6), i(t, 7), i(t, 8));
            case "b6" -> s.b(i(t, 3), i(t, 4), i(t, 5), i(t, 6), i(t, 7), i(t, 8));
            case "a4" -> s.a(i(t, 3), i(t, 4), i(t, 5), i(t, 6));
            case "b5" -> s.b(i(t, 3), i(t, 4), i(t, 5), i(t, 6), i(t, 7));
            case "c5" -> s.c(i(t, 3), i(t, 4), i(t, 5), i(t, 6), i(t, 7));
            case "b4" -> s.b(i(t, 3), i(t, 4), i(t, 5), i(t, 6));
            case "m2" -> s.a(i(t, 3), i(t, 4), sprite(t[5]));
            case "m8" -> s.a(i(t, 3), i(t, 4), i(t, 5), i(t, 6), i(t, 7), i(t, 8), i(t, 9), i(t, 10), sprite(t[11]));
            // d <id> q5 <angle> <y> <x> <scale>: qf.a(IIIII)V takes (y, angle, scale, x, dummy).
            case "q5" -> ((qf)s).a(i(t, 4), i(t, 3), i(t, 6), i(t, 5), -1470985020);
            default -> throw new AssertionError(t[2]);
        }
    }

    private static String sprite(cf s) throws IllegalAccessException {
        return s.O + "," + s.cb + "," + s.L + "," + s.ab + "," + cfZ.getInt(s) + "," + cfBb.getInt(s) + "," + cfDb.getInt(s)
            + "," + s.J + "," + s.V + "," + s.P + "," + s.K + "," + s.W + "," + s.I;
    }

    private static String state() throws IllegalAccessException {
        StringBuilder b = new StringBuilder("dj=");
        String mask = "null";
        if (dj.a != null) {
            mask = "?";
            for (Map.Entry<Integer, cf> e : sprites.entrySet()) if (e.getValue() == dj.a) mask = "s" + e.getKey();
        }
        b.append(mask).append(',').append(dj.b).append(',').append(dj.c).append(',').append(djD.getInt(null)).append(',').append(dj.e);
        b.append(" fa=").append(fa.e).append(',').append(fa.c);
        for (Map.Entry<Integer, cf> e : new TreeMap<>(sprites).entrySet()) b.append(" s").append(e.getKey()).append('=').append(sprite(e.getValue()));
        return b.toString();
    }
}
