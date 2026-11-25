import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.nio.ByteBuffer;
import java.nio.file.Path;
import java.util.StringJoiner;

/**
 * Drives the original HD material code (pc and vm, rd, wg, pd, ob, ue, te.e(I)V, cb.b(III)V, gj.b(I)V, nj.a(I)V,
 * ef.a(I)I, jj.a(B)[F) through GlRecorder for test/hd/materials.test.ts. Only the GL driver, the two noise
 * volumes (synthetic, so lm.a()V skips its generators while lm.c()V still uploads them) and the statics a script
 * sets are supplied by the host.
 *
 * Usage: HdMaterialsOracle <trace dir> <caps profile json>; the script arrives on stdin, one command per line, and
 * every command prints one result line. The first line printed is the tf.m() probe of the profile.
 */
public final class HdMaterialsOracle {
    static Field field(Class<?> owner, String name) throws ReflectiveOperationException {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static ByteBuffer volume(int multiplier, int offset) {
        ByteBuffer b = ByteBuffer.allocateDirect(524288);
        for (int i = 0; i < 524288; i++) b.put((byte)(i * multiplier + offset));
        b.flip();
        return b;
    }

    static float bits(String hex) {
        return Float.intBitsToFloat(Integer.parseUnsignedInt(hex, 16));
    }

    static float[] floats(String csv) {
        String[] parts = csv.split(",");
        float[] values = new float[parts.length];
        for (int i = 0; i < parts.length; i++) values[i] = bits(parts[i]);
        return values;
    }

    static String hex(float[] values) {
        StringJoiner out = new StringJoiner(",");
        for (float v : values) out.add(String.format("%08x", Float.floatToRawIntBits(v)));
        return out.toString();
    }

    static String kind(Throwable t) {
        // gj.a(Throwable,String) wraps RuntimeExceptions in ld (field f holds the cause); the TS port strips it.
        while (t instanceof ld wrapped && wrapped.f != null) t = wrapped.f;
        if (t instanceof NullPointerException) return "NPE";
        if (t instanceof ArrayIndexOutOfBoundsException) return "AIOOBE";
        return t.getClass().getSimpleName();
    }

    static hg triangle(int texture, boolean blend, boolean extra, int colour) {
        hg batch = new hg(texture, 128, blend, extra, colour);
        batch.p = 3;
        batch.r = 1;
        batch.b();
        int x = texture == 5 ? 49 : 1;
        batch.a(x, 0, 1, 0f, 1f, 0f, 0x346789ff, .25f);
        batch.a(x, 0, 65, 0f, 1f, 0f, 0x346789ff, .5f);
        batch.a(x + 64, 0, 1, 0f, 1f, 0f, 0x346789ff, .75f);
        batch.a(0, 0, 0, new int[]{0, 1, 2}, null, blend);
        batch.d();
        return batch;
    }

    static String waterFrame(boolean underwater, boolean highDetail) {
        tf.w = true;
        tf.C = false;
        od.c = false;
        rm.g = highDetail;
        l.k = 0;
        je.R = false;
        cb.b(0, 0, 0);
        hf.e = (m)Proxy.newProxyInstance(m.class.getClassLoader(), new Class<?>[]{m.class}, (proxy, method, args) -> {
            if (method.getName().equals("g") && method.getParameterTypes()[1] == int.class) return args[0];
            if (method.getName().equals("a") && method.getParameterTypes()[1] == boolean.class) {
                cb.b(0, 1, (int)args[0]);
                return null;
            }
            throw new AssertionError(method);
        });
        tb.Q = ch.w = gf.M = nd.s = pi.U = wi.db = 0;
        jm.r = aa.m = rh.d = 1;
        dl.h = new boolean[][]{{true}};
        bj tile = new bj(0, 0, 0);
        kc.o = new bj[][][]{{{tile}}};
        id.i = new int[][][]{{{-16,-24},{-32,-40}}};
        gf.O = new int[1][2][2];
        gj.m = underwater ? gf.O : id.i;
        f.ab = new int[][]{{0x05204060}};
        client.kb = new hg[][]{{triangle(4, false, false, 0x234567), triangle(5, true, false, 0x456789)}};
        oj.E = underwater ? new hg[][]{{triangle(-1, false, true, 0x112233), triangle(5, true, true, 0x556677)}} : client.kb;
        uc.a(32, 48, 16, null, 0, (byte)0, 0, 0);
        return "frame " + dl.c + " " + mh.eb + " " + je.R + " " + ma.z + " " + bl.X + " " + tile.x + " " + rc.p;
    }

    /** One original hg draw with independently selected material metadata and vertex normals. */
    static void materialFrame(int material, int argument) {
        cb.b(0, 0, 0);
        od.c = true;
        rm.g = true;
        je.R = false;
        nh.Z = 128;
        hf.e = (m)Proxy.newProxyInstance(m.class.getClassLoader(), new Class<?>[]{m.class}, (proxy, method, args) -> {
            if (method.getName().equals("a") && method.getParameterTypes()[1] == boolean.class) {
                cb.b(0, argument, material);
                return null;
            }
            throw new AssertionError(method);
        });
        hg batch = new hg(1, 128, false, false, 0x234567);
        batch.p = 3;
        batch.r = 1;
        batch.b();
        batch.a(1, -3, 1, 0.02f, 0.92f, -0.39f, 0x346789ff, 0f);
        batch.a(1, 2, 65, -0.31f, 0.89f, -0.33f, 0x346789ff, 0f);
        batch.a(65, -7, 1, 0.35f, 0.84f, -0.42f, 0x346789ff, 0f);
        batch.a(0, 0, 0, new int[]{0, 1, 2}, null, false);
        batch.d();
        bj tile = new bj(0, 0, 0);
        tile.x = true;
        batch.a(new bj[][][]{{{tile}}}, 0f, false);
        if (dl.c != material || mh.eb != argument) throw new AssertionError("material " + dl.c + "/" + mh.eb);
    }

    public static void main(String[] args) throws Exception {
        Path profile = Path.of(args[1]);
        // The capability flags come from the original tf.m() probe on an unrecorded GL with the same profile.
        GlRecorder probe = new GlRecorder(null);
        probe.loadProfile(profile);
        tf.t = probe.gl();
        Method m = tf.class.getDeclaredMethod("m");
        m.setAccessible(true);
        int status = (int)m.invoke(null);
        System.out.println("probe " + status + " " + tf.e + " " + tf.K + " " + tf.H + " " + tf.r + " " + tf.f);
        // tf's cached GL state, back at its <clinit> values without recording.
        tf.c(false); tf.c(true);
        tf.a(1); tf.a(0);
        tf.d(1); tf.d(0);
        tf.c(0); tf.c(-1);
        tf.b();
        field(lm.class, "d").set(null, volume(7, 3));
        field(lm.class, "c").set(null, volume(13, 5));
        aa.t = null; dl.c = 0; mh.eb = 0; je.R = false;
        try (GlRecorder recorder = new GlRecorder(Path.of(args[0]))) {
            recorder.loadProfile(profile);
            BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
            for (String line; (line = input.readLine()) != null;) {
                if (line.isEmpty()) continue;
                String[] cmd = line.split(" ");
                String result = "ok";
                try {
                    switch (cmd[0]) {
                        case "override" -> {
                            if (!cmd[1].equals("-")) tf.e = Integer.parseInt(cmd[1]);
                            if (!cmd[2].equals("-")) tf.K = cmd[2].equals("1");
                            if (!cmd[3].equals("-")) tf.H = cmd[3].equals("1");
                            if (!cmd[4].equals("-")) tf.r = cmd[4].equals("1");
                            if (!cmd[5].equals("-")) tf.f = cmd[5].equals("1");
                        }
                        case "record" -> tf.t = recorder.gl();
                        case "white" -> {
                            int[] name = new int[1];
                            tf.t.glGenTextures(1, name, 0);
                            tf.z = name[0];
                        }
                        case "build" -> te.e(Integer.parseInt(cmd[1]));
                        case "materials" -> {
                            StringJoiner names = new StringJoiner(" ");
                            for (pc material : aa.t) names.add(material == null ? "-" : material.getClass().getName());
                            result = "materials " + names + " noise " + lm.e + " " + (lm.b == null ? "-" : "2d") + " " + (lm.a == null ? "-" : "2d");
                        }
                        case "prefs" -> { od.c = cmd[1].equals("1"); rm.g = cmd[2].equals("1"); }
                        case "cycle" -> tf.g = Integer.parseInt(cmd[1]);
                        case "camera" -> {
                            bb.M = Integer.parseInt(cmd[1]); qc.cb = Integer.parseInt(cmd[2]); sj.D = Integer.parseInt(cmd[3]);
                            ej.X = Integer.parseInt(cmd[4]); uj.H = Integer.parseInt(cmd[5]);
                        }
                        case "depth" -> nh.Z = Integer.parseInt(cmd[1]);
                        case "water" -> {
                            float[] c = floats(cmd[1]);
                            for (int i = 0; i < 4; i++) v.c[i] = c[i];
                        }
                        case "light" -> {
                            field(mk.class, "b").setInt(null, Integer.parseInt(cmd[1]));
                            field(mk.class, "i").setFloat(null, bits(cmd[2]));
                            field(mk.class, "f").setFloat(null, bits(cmd[3]));
                        }
                        case "ambient" -> tf.t.glLightModelfv(2899, floats(cmd[1]), 0);
                        case "set" -> cb.b(0, Integer.parseInt(cmd[1]), Integer.parseInt(cmd[2]));
                        case "lock" -> je.R = cmd[1].equals("1");
                        case "state" -> result = "state " + dl.c + " " + mh.eb + " " + je.R;
                        case "bind" -> aa.t[Integer.parseInt(cmd[1])].b();
                        case "unbind" -> aa.t[Integer.parseInt(cmd[1])].a();
                        case "arg" -> aa.t[Integer.parseInt(cmd[1])].a(Integer.parseInt(cmd[2]));
                        case "flags" -> result = "flags " + aa.t[Integer.parseInt(cmd[1])].c();
                        case "mflags" -> result = "flags " + ef.a(1536);
                        case "reset" -> gj.b(97);
                        case "release" -> nj.a(90);
                        case "unload" -> { rd.d(); pd.e(); }
                        case "wgclient" -> { if (cmd[1].equals("1")) wg.g(); else wg.f(); }
                        case "wgunit" -> result = "unit " + wg.e();
                        case "waterframe" -> result = waterFrame(cmd[1].equals("1"), cmd[2].equals("1"));
                        case "fog" -> result = "fog " + hex(jj.a((byte)-50));
                        case "mark" -> recorder.mark(cmd[1]);
                        default -> throw new AssertionError(cmd[0]);
                    }
                } catch (AssertionError e) {
                    throw e;
                } catch (RuntimeException e) {
                    result = "throw " + kind(e);
                }
                System.out.println(result);
            }
        }
    }
}
