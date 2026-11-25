import java.awt.Canvas;
import java.io.PrintWriter;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;

/** Invoke the original HD whole-model and masked skeletal transforms with the same sequence of frame operations as TS. */
public final class HdGlModelAnimationOracle {
    private static final class Finished extends Error {}

    private static Object field(td model, String name) throws Exception {
        Field field = td.class.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(model);
    }

    private static String values(Object array) {
        if (array == null) return "-";
        if (array instanceof int[] ints) return Arrays.toString(ints);
        if (array instanceof short[] shorts) return Arrays.toString(shorts);
        byte[] bytes = (byte[]) array;
        int[] unsigned = new int[bytes.length];
        for (int i = 0; i < bytes.length; i++) unsigned[i] = bytes[i] & 255;
        return Arrays.toString(unsigned);
    }

    static void snapshot(PrintWriter out, String mesh, String step, td model) throws Exception {
        out.print(mesh + "\t" + step);
        for (String name : List.of("H", "eb", "hb", "v", "L", "W", "t", "B"))
            out.print("\t" + values(field(model, name)));
        for (String name : List.of("sb", "yb", "vb", "Bb")) out.print("\t" + field(null, name));
        for (String name : List.of("Y", "z", "A")) {
            ql stream = (ql) field(model, name);
            out.print("\t" + (stream == null ? "-" : stream.b));
        }
        out.println("\t" + ((ae)field(model, "U")).h);
    }

    private static int[] ints(String token) {
        if (token.equals("-")) return null;
        if (token.equals("[]")) return new int[0];
        return Arrays.stream(token.split(",")).mapToInt(Integer::parseInt).toArray();
    }

    private static void compare(Path steps, Path output) throws Exception {
        try (PrintWriter out = new PrintWriter(Files.newBufferedWriter(output))) {
            for (String mesh : List.of("arms", "arms-low-light", "torso-arms", "empty")) {
                gb raw = switch (mesh) {
                    case "arms", "arms-low-light" -> gb.a(vl.g, 151, 0);
                    case "torso-arms" -> new gb(new gb[]{gb.a(vl.g, 292, 0), gb.a(vl.g, 151, 0)}, 2);
                    default -> new gb(0, 0, 0);
                };
                od.c = !mesh.equals("arms-low-light");
                td model = new td(raw, 64, 768, false);
                model.o();
                model.d();
                snapshot(out, mesh, "start", model);
                for (String line : Files.readAllLines(steps)) {
                    String[] s = line.split(" ");
                    // Treat each frame's streams as uploaded so each individual invalidation is visible.
                    for (String stream : List.of("Y", "z", "A")) {
                        ql value = (ql)field(model, stream);
                        if (value != null) value.b = true;
                    }
                    ((ae)field(model, "U")).h = true;
                    int op = Integer.parseInt(s[2]), x = Integer.parseInt(s[3]), y = Integer.parseInt(s[4]), z = Integer.parseInt(s[5]);
                    if (s[1].equals("discard")) model.a(false, op == 0, op == 0, false, false, op == 1, false);
                    else if (s[1].equals("all")) model.a(op, x, y, z);
                    else model.a(op, ints(s[8]), x, y, z, Boolean.parseBoolean(s[6]), Integer.parseInt(s[7]), ints(s[9]));
                    snapshot(out, mesh, s[0], model);
                }
                model.f();
                snapshot(out, mesh, "end", model);
            }
        }
    }

    @FunctionalInterface
    interface CachedComparison { void run() throws Exception; }

    static void withArchives(String[] args, CachedComparison comparison) throws Exception {
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765, 503);
        try (GlRecorder gl = new GlRecorder(null); AutoCloseable factory = gl.installFactory()) {
            gl.loadProfile(Path.of(args[1]));
            try {
                HdTitleFrameOracle.run(Path.of(args[0]), canvas, frame -> {}, phase -> {
                    if (!phase.equals("interface.onload")) return;
                    try { comparison.run(); }
                    catch (Exception e) { throw new IllegalStateException(e); }
                    throw new Finished();
                });
            } catch (Finished done) {}
        }
    }

    public static void main(String[] args) throws Exception {
        withArchives(args, () -> compare(Path.of(args[2]), Path.of(args[3])));
    }
}
