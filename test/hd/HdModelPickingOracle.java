import java.awt.Canvas;
import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import javax.media.opengl.GL;

/** Original td.a runs through its complete picking path. glPushMatrix is the first call after picking. */
public final class HdModelPickingOracle {
    private static final class Done extends Error {}
    private static final Done STOP = new Done();
    private static final long SENTINEL = 0x1760a56972adL;

    private static void compare(Path file) throws Exception {
        tf.t = (GL)Proxy.newProxyInstance(GL.class.getClassLoader(), new Class<?>[]{GL.class}, (proxy, method, args) -> {
            if (method.getName().equals("glPushMatrix")) throw STOP;
            throw new AssertionError(method);
        });
        tg.c = -271;
        ub.m = 271;
        a.g = -208;
        li.x = 208;
        Map<Integer, td> models = new HashMap<>();
        BufferedReader poses = new BufferedReader(new InputStreamReader(System.in));
        try (DataOutputStream out = new DataOutputStream(Files.newOutputStream(file))) {
            for (String line; (line = poses.readLine()) != null;) {
                int[] v = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
                td model = models.computeIfAbsent(v[0], id -> new td(gb.a(vl.g, id, 0), 64, 768, false));
                model.s = v[1] == 1;
                d.db = v[2] == 1;
                long key = v[3] > 0 ? (1L << 48) + v[0] : v[3];
                for (int y = -198; y <= 198; y += 11) {
                    for (int x = -260; x <= 260; x += 10) {
                        aa.a = 1;
                        vc.V[0] = vc.V[1] = vc.V[2] = SENTINEL;
                        lk.V = x;
                        ck.K = y;
                        try {
                            model.a(v[4], hf.g[v[5]], hf.r[v[5]], hf.g[v[6]], hf.r[v[6]], v[7], v[8], v[9], key, 0, null);
                        } catch (Done done) {
                            if (done != STOP) throw done;
                        }
                        if (vc.V[0] != SENTINEL || vc.V[2] != SENTINEL) throw new AssertionError("picked list bounds");
                        out.writeByte(aa.a);
                        out.writeLong(vc.V[1]);
                    }
                }
            }
        }
    }

    public static void main(String[] args) throws Exception {
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765, 503);
        try (GlRecorder recorder = new GlRecorder(null); AutoCloseable factory = recorder.installFactory()) {
            recorder.loadProfile(Path.of(args[1]));
            try {
                HdTitleFrameOracle.run(Path.of(args[0]), canvas, ignored -> {}, phase -> {
                    if (!phase.equals("interface.onload")) return;
                    try { compare(Path.of(args[2])); }
                    catch (Exception e) { throw new IllegalStateException(e); }
                    throw STOP;
                });
            } catch (Done done) {
                if (done != STOP) throw done;
            }
        }
    }
}
