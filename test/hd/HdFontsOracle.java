import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Drives the original HD 2D font and indexed-sprite code of runescape_gl.jar through GlRecorder for
 * test/hd/gl-2d-fonts.test.ts: the GL indexed sprite oh (oh.a([B[I)V upload and display list, the two draws), the
 * GL font mb (mb.a([[B)V atlas upload, the 256 display lists, the plain, masked and alpha glyph draws) and the text
 * layout of rk with tf.w set (tagged text, shadows, colour, alpha, strike and underline through dj.a(IIII)V, icons).
 *
 * The host supplies only the GL driver and the cache files. groups.bin (written by the test) holds the archive-8
 * sprite groups and the archive-13 font metrics as the JS5 layer returns them; each sprite group is decoded with the
 * jar's own decoder (gk.a([BI)V) and turned into oh objects one frame at a time, the way ui.h(I)[Lok; does while tf.w
 * is set, keeping every finished sprite reachable so no finalizer can run during the trace; each font is built by
 * ce.a(I[B)Lrk; with tf.w set (so mb).
 *
 * Usage: HdFontsOracle <trace dir> <caps profile json> <groups.bin>; the script arrives on stdin, one command per line,
 * and every command prints one result line ("upload" prints one line per group).
 */
public final class HdFontsOracle {
    static Field field(Class<?> owner, String name) throws ReflectiveOperationException {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static String kind(Throwable t) {
        // gj.a(Throwable,String) wraps RuntimeExceptions in ld (field f holds the cause); the TS port strips it.
        while (t instanceof ld wrapped && wrapped.f != null) t = wrapped.f;
        if (t instanceof NullPointerException) return "NPE";
        if (t instanceof ArrayIndexOutOfBoundsException) return "AIOOBE";
        return t.getClass().getSimpleName();
    }

    // The raw bytes as an na, appended one character at a time (cd.a(String,B) would decode its escape pairs).
    static na text(String hex) {
        byte[] bytes = HexFormat.of().parseHex(hex);
        na s = gn.a((byte)-92, bytes.length);
        for (byte b : bytes) s.d(b & 0xff, (byte)115);
        return s;
    }

    static int[] ints(String csv) {
        if (csv.equals("-")) return null;
        String[] parts = csv.split(",");
        int[] values = new int[parts.length];
        for (int i = 0; i < parts.length; i++) values[i] = Integer.parseInt(parts[i]);
        return values;
    }

    static void finalize(Object target) throws Throwable {
        Method method = target.getClass().getDeclaredMethod("finalize");
        method.setAccessible(true);
        method.invoke(target);
    }

    static Object unsafeInstance(Class<?> kind) throws Exception {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Field singleton = unsafe.getDeclaredField("theUnsafe");
        singleton.setAccessible(true);
        return unsafe.getMethod("allocateInstance", Class.class).invoke(singleton.get(null), kind);
    }

    static cf mask;

    public static void main(String[] args) throws Throwable {
        List<int[]> entries = new ArrayList<>();
        List<byte[]> spriteData = new ArrayList<>(), metricData = new ArrayList<>();
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(Files.newInputStream(Path.of(args[2]))))) {
            int count = in.readInt();
            for (int i = 0; i < count; i++) {
                int kind = in.readInt(), group = in.readInt();
                byte[] sprite = new byte[in.readInt()];
                in.readFully(sprite);
                int metricLength = in.readInt();
                byte[] metric = null;
                if (metricLength >= 0) {
                    metric = new byte[metricLength];
                    in.readFully(metric);
                }
                entries.add(new int[]{kind, group});
                spriteData.add(sprite);
                metricData.add(metric);
            }
        }
        Path profile = Path.of(args[1]);
        GlRecorder probe = new GlRecorder(null);
        probe.loadProfile(profile);
        tf.t = probe.gl();
        // tf's cached GL state back at its <clinit> values without recording (the TS side does the same).
        tf.c(false); tf.c(true);
        tf.b(false); tf.b(true);
        tf.a(false); tf.a(true);
        tf.a(1); tf.a(0);
        tf.d(1); tf.d(0);
        tf.c(0); tf.c(-1);
        tf.b();
        field(tf.class, "o").setBoolean(null, false);
        aa.t = null; dl.c = 0;
        tf.w = true;
        tf.J = 765;
        tf.A = 503;
        Map<Integer, rk> fonts = new HashMap<>();
        Map<Integer, List<ok>> sprites = new HashMap<>();
        try (GlRecorder recorder = new GlRecorder(Path.of(args[0]))) {
            recorder.loadProfile(profile);
            tf.t = recorder.gl();
            BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
            for (String line; (line = input.readLine()) != null;) {
                if (line.isEmpty()) continue;
                String[] v = line.split(" ");
                String result = "ok";
                try {
                    switch (v[0]) {
                        case "upload" -> {
                            for (int e = 0; e < entries.size(); e++) {
                                int kind = entries.get(e)[0], group = entries.get(e)[1];
                                recorder.mark((kind == 0 ? "s" : "f") + group);
                                String r;
                                if (kind == 0) {
                                    List<ok> set = new ArrayList<>();
                                    sprites.put(group, set);
                                    try {
                                        gk.a(spriteData.get(e), 98);
                                        for (int i = 0; i < nb.h; i++) set.add(new oh(jk.x, sg.h, wf.b[i], wa.z[i], uj.x[i], ca.Y[i], ah.l[i], vc.R));
                                        g.a((byte)113);
                                        r = "ok " + set.size();
                                    } catch (Throwable t) {
                                        r = "throw " + kind(t) + " " + set.size();
                                    }
                                } else {
                                    try {
                                        gk.a(spriteData.get(e), 98);
                                        rk font = ce.a(-22376, metricData.get(e));
                                        if (!(font instanceof mb)) throw new AssertionError("not mb");
                                        fonts.put(group, font);
                                        r = "ok " + font.ab;
                                    } catch (Throwable t) {
                                        r = "throw " + kind(t);
                                    }
                                }
                                System.out.println((kind == 0 ? "s " : "f ") + group + " " + r + " " + fa.e);
                            }
                            result = "uploaded " + fa.e;
                        }
                        case "mark" -> recorder.mark(v[1]);
                        case "icons" -> fonts.get(Integer.parseInt(v[1])).a(sprites.get(Integer.parseInt(v[2])).toArray(new ok[0]), ints(v[3]));
                        case "mask" -> {
                            int[] name = new int[1];
                            tf.t.glGenTextures(1, name, 0);
                            mask = (cf)unsafeInstance(cf.class);
                            mask.ab = name[0];
                            mask.O = Integer.parseInt(v[1]);
                            mask.cb = Integer.parseInt(v[2]);
                            dj.a = mask;
                            dj.c = Integer.parseInt(v[3]);
                            dj.b = Integer.parseInt(v[4]);
                        }
                        case "nomask" -> dj.a = null;
                        case "active" -> tf.w = v[1].equals("1");
                        case "left" -> fonts.get(Integer.parseInt(v[1])).a(text(v[6]), Integer.parseInt(v[2]), Integer.parseInt(v[3]), Integer.parseInt(v[4]), Integer.parseInt(v[5]));
                        case "right" -> fonts.get(Integer.parseInt(v[1])).b(text(v[6]), Integer.parseInt(v[2]), Integer.parseInt(v[3]), Integer.parseInt(v[4]), Integer.parseInt(v[5]));
                        case "centre" -> fonts.get(Integer.parseInt(v[1])).c(text(v[6]), Integer.parseInt(v[2]), Integer.parseInt(v[3]), Integer.parseInt(v[4]), Integer.parseInt(v[5]));
                        case "para" -> result = "lines " + fonts.get(Integer.parseInt(v[1])).a(text(v[12]), Integer.parseInt(v[2]), Integer.parseInt(v[3]),
                            Integer.parseInt(v[4]), Integer.parseInt(v[5]), Integer.parseInt(v[6]), Integer.parseInt(v[7]), Integer.parseInt(v[8]),
                            Integer.parseInt(v[9]), Integer.parseInt(v[10]), Integer.parseInt(v[11]));
                        case "para256" -> result = "lines " + fonts.get(Integer.parseInt(v[1])).a(text(v[11]), Integer.parseInt(v[2]), Integer.parseInt(v[3]),
                            Integer.parseInt(v[4]), Integer.parseInt(v[5]), Integer.parseInt(v[6]), Integer.parseInt(v[7]), Integer.parseInt(v[8]),
                            Integer.parseInt(v[9]), Integer.parseInt(v[10]));
                        case "wave" -> fonts.get(Integer.parseInt(v[1])).b(text(v[7]), Integer.parseInt(v[2]), Integer.parseInt(v[3]), Integer.parseInt(v[4]),
                            Integer.parseInt(v[5]), Integer.parseInt(v[6]));
                        case "wave2" -> fonts.get(Integer.parseInt(v[1])).a(text(v[7]), Integer.parseInt(v[2]), Integer.parseInt(v[3]), Integer.parseInt(v[4]),
                            Integer.parseInt(v[5]), Integer.parseInt(v[6]));
                        case "shake" -> fonts.get(Integer.parseInt(v[1])).a(text(v[8]), Integer.parseInt(v[2]), Integer.parseInt(v[3]), Integer.parseInt(v[4]),
                            Integer.parseInt(v[5]), Integer.parseInt(v[6]), Integer.parseInt(v[7]));
                        case "random" -> result = "random " + fonts.get(Integer.parseInt(v[1])).a(text(v[7]), Integer.parseInt(v[2]), Integer.parseInt(v[3]),
                            Integer.parseInt(v[4]), Integer.parseInt(v[5]), new Random(), Integer.parseInt(v[6]));
                        case "randomAligned" -> {
                            int[] bounds = new int[4];
                            int n = fonts.get(Integer.parseInt(v[1])).a(text(v[11]), Integer.parseInt(v[2]), Integer.parseInt(v[3]), Integer.parseInt(v[4]),
                                Integer.parseInt(v[5]), Integer.parseInt(v[6]), Integer.parseInt(v[7]), Integer.parseInt(v[8]), Integer.parseInt(v[9]),
                                new Random(), Integer.parseInt(v[10]), bounds);
                            result = "random " + n + " " + bounds[0] + "," + bounds[1] + "," + bounds[2] + "," + bounds[3];
                        }
                        case "width" -> result = "width " + fonts.get(Integer.parseInt(v[1])).a(text(v[2]));
                        case "glyph" -> fonts.get(Integer.parseInt(v[1])).a(Integer.parseInt(v[2]), Integer.parseInt(v[3]), Integer.parseInt(v[4]),
                            Integer.parseInt(v[5]), Integer.parseInt(v[6]), Integer.parseInt(v[7]), v[8].equals("1"));
                        case "glyphAlpha" -> fonts.get(Integer.parseInt(v[1])).a(Integer.parseInt(v[2]), Integer.parseInt(v[3]), Integer.parseInt(v[4]),
                            Integer.parseInt(v[5]), Integer.parseInt(v[6]), Integer.parseInt(v[7]), Integer.parseInt(v[8]), v[9].equals("1"));
                        case "sprite" -> sprites.get(Integer.parseInt(v[1])).get(Integer.parseInt(v[2])).a(Integer.parseInt(v[3]), Integer.parseInt(v[4]));
                        case "spriteAlpha" -> sprites.get(Integer.parseInt(v[1])).get(Integer.parseInt(v[2])).a(Integer.parseInt(v[3]), Integer.parseInt(v[4]),
                            Integer.parseInt(v[5]));
                        case "finalizeFont" -> finalize(fonts.get(Integer.parseInt(v[1])));
                        case "finalizeSprite" -> finalize(sprites.get(Integer.parseInt(v[1])).get(Integer.parseInt(v[2])));
                        case "flush" -> { fa.c(); result = "counters " + fa.a + " " + fa.e + " " + fa.f; }
                        case "nogl" -> tf.t = null;
                        default -> throw new IllegalArgumentException("unknown command " + line);
                    }
                } catch (IllegalArgumentException e) {
                    if (e.getMessage() != null && e.getMessage().startsWith("unknown command")) throw e;
                    result = "throw " + kind(e);
                } catch (Throwable t) {
                    while (t instanceof java.lang.reflect.InvocationTargetException wrapped) t = wrapped.getCause();
                    result = "throw " + kind(t);
                }
                System.out.println(result);
            }
        }
    }
}
