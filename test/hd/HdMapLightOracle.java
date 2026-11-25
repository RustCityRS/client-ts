import java.awt.Canvas;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.HexFormat;

/** Captures the original title's gd.c(-117) result at the boundary before title animation.
 * Both sides use an indexed diagnostic RGB table so that palette generation is independent
 * of the terrain reader and its randomized brightness. Original JS5 reads and all lights run. */
public class HdMapLightOracle {
    static int bits(float value) { return Float.floatToRawIntBits(value); }

    static int field(gi light, String name) throws ReflectiveOperationException {
        Field member = gi.class.getDeclaredField(name);
        member.setAccessible(true);
        return member.getInt(light);
    }

    static void light(gi l) throws ReflectiveOperationException {
        System.out.println("L " + l.r + " " + l.a + " " + l.A + " " + l.q + " " + l.i + " " + l.x + " "
            + l.j + " " + Arrays.toString(l.u) + " " + l.C + " " + l.t + " " + field(l,"E") + " " + l.g
            + " " + bits(l.z) + " " + field(l,"e") + " " + field(l,"y") + " " + field(l,"p") + " " + field(l,"d"));
    }

    static void snapshot() {
        try {
            for (int i = 0; i < te.H.length; i++) {
                if (we.H[i] != null) System.out.println("M " + client.lb[i] + " " + ((te.H[i] >> 8) * 64 - se.a)
                    + " " + ((te.H[i] & 255) * 64 - lc.n) + " " + (gf.R * 8 - 48) + " " + ((eb.u - 6) * 8));
            }
            System.out.println("lights " + jf.l);
            for (int i = 0; i < jf.l; i++) light(jf.a[i]);
            System.out.println("noise " + Arrays.hashCode(f.P));
            Field member = jf.class.getDeclaredField("g");
            member.setAccessible(true);
            int[][][] grid = (int[][][])member.get(null);
            for (int[][] level : grid) for (int[] row : level) System.out.println("G " + Arrays.toString(row));
            IdentityHashMap<li,Integer> identities = new IdentityHashMap<>();
            for (li[] row : ph.b) {
                for (li e : row) {
                    int id = identities.computeIfAbsent(e, ignored -> identities.size());
                    System.out.println("E " + id + " " + e.c + " " + bits(e.n) + " " + bits(e.s) + " " + bits(e.q)
                        + " " + e.k + " " + e.g + " " + e.d + " " + e.a + " " + e.j);
                }
            }
            System.out.println("sun " + gl.f + " " + mi.Z + " " + li.t + " " + (nk.O.K[0] >> 3) + " " + (nk.O.w[0] >> 3));
        } catch (ReflectiveOperationException e) {
            throw new AssertionError(e);
        }
    }

    static void environmentCase(byte[] data) {
        wa packet = new wa(data);
        String result;
        try {
            li e = new li(packet);
            result = e.c + " " + bits(e.n) + " " + bits(e.s) + " " + bits(e.q) + " " + e.k + " " + e.g
                + " " + e.d + " " + e.a + " " + e.j;
        } catch (ld failure) {
            result = failure.e;
        }
        System.out.println("environment " + HexFormat.of().formatHex(data) + "|" + packet.T + " " + result);
    }

    static void flickerCase(byte[] data) {
        wa packet = new wa(data);
        StringBuilder result = new StringBuilder();
        try {
            gi l = new gi(packet);
            for (int tick : new int[]{-2147483648, -5711, 0, 5, 33, 1267, 2147483647}) {
                for (boolean disabled : new boolean[]{false,true}) {
                    l.a(disabled, tick, -3696);
                    for (float value : new float[]{l.w,l.I[0],l.I[1],l.I[2],l.I[3]}) result.append(" ").append(bits(value));
                }
            }
        } catch (ld failure) {
            result.append(" ").append(failure.e);
        }
        System.out.println("flicker " + HexFormat.of().formatHex(data) + "|" + packet.T + result);
    }

    static void defaultLights() throws Exception {
        for (int mode = 0; mode < 3; mode++) {
            if (mode == 0) f.P = null;
            if (mode == 2) f.P = new int[]{5,-3,2};
            int[] previous = f.P;
            gi light = new gi();
            System.out.println("default " + (f.P == previous) + " " + Arrays.hashCode(f.P) + " " + field(light,"e")
                + " " + field(light,"y") + " " + field(light,"p") + " " + field(light,"d") + " " + light.g
                + " " + light.I.length + " " + bits(light.w) + " " + bits(light.z) + " " + (light.u == null));
        }
    }

    static void edgeCases() {
        byte[] payload = new byte[32];
        for (int i = 1; i < payload.length; ++i) payload[i] = (byte)(i * 183 + 91);
        for (int mask = 0; mask < 256; ++mask) {
            payload[0] = (byte)mask;
            environmentCase(payload);
        }
        for (int length = 0; length < 23; length++) environmentCase(Arrays.copyOf(payload,length));
        byte[] light = HexFormat.of().parseHex("19ff2300e77fff01010203020501abf100");
        for (int value = 0; value < 256; value++) {
            light[16] = (byte)value;
            flickerCase(light);
        }
        for (int length = 0; length < light.length; length++) flickerCase(Arrays.copyOf(light,length));
    }

    public static void main(String[] args) throws Exception {
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765,503);
        try (GlRecorder capture = new GlRecorder(Path.of(args[1])); AutoCloseable factory = capture.installFactory()) {
            capture.loadProfile(Path.of(args[2]));
            HdTitleFrameOracle.run(Path.of(args[0]), canvas, i -> {}, stage -> {
                if (stage.equals("region.build")) {
                    for (int i = 0; i < hf.a.length; i++) hf.a[i] = (i * 0x73a753 + 0x552318) & 0xffffff;
                }
                if (stage.equals("warmup")) snapshot();
            });
            edgeCases();
            defaultLights();
        }
    }
}
