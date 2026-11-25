import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.StringJoiner;

/**
 * Runs the original noise-volume path of runescape_gl.jar on the headless GlRecorder: lm.c() (tf.r into lm.e, then
 * lm.a() builds both 64^3 volumes through ng/sb and lm.e()/lm.f() upload them), then lm.b() (deletion) and lm.d()
 * (unload). tf.r comes from the original capability probe tf.m() on an unrecorded GL answering from the same profile,
 * so the trace holds lm's own calls only. tf.s (the 2D binding cache that tf.c(I) reads) keeps its tf.clinit value -1.
 *
 * Args: <trace dir> <caps profile json>, or: volumes <XxYxZ>... for the generators alone.
 */
public final class HdNoiseOracle {
    static Field field(Class<?> owner, String name) throws ReflectiveOperationException {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    // position, limit, capacity and the SHA-256 of [0, limit) of a private lm volume.
    static String volume(String name) throws Exception {
        ByteBuffer buffer = (ByteBuffer)field(lm.class, name).get(null);
        if (buffer == null) return "null";
        ByteBuffer copy = buffer.duplicate();
        copy.position(0);
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        hash.update(copy);
        return buffer.position() + " " + buffer.limit() + " " + buffer.capacity() + " " + buffer.isDirect() + " "
            + HexFormat.of().formatHex(hash.digest());
    }

    static String names(int[] names) {
        if (names == null) return "null";
        StringJoiner joined = new StringJoiner(",");
        for (int name : names) joined.add(String.valueOf(name));
        return joined.toString();
    }

    static void state(String label) throws Exception {
        System.out.println(label + " " + lm.e + " " + lm.f + " " + lm.g + " " + names(lm.b) + " " + names(lm.a)
            + " bound " + field(tf.class, "s").getInt(null) + " memory " + fa.a);
        System.out.println(label + " ridged " + volume("d"));
        System.out.println(label + " fractal " + volume("c"));
    }

    static String sha(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    // The generators alone, at non-cubic sizes, so a swapped axis or size argument cannot hide behind 64^3.
    // Each line: sizes, then the SHA-256 of ng.b and of sb.b at those sizes.
    static void volumes(String[] sizes) throws Exception {
        for (String size : sizes) {
            String[] xyz = size.split("x");
            int x = Integer.parseInt(xyz[0]), y = Integer.parseInt(xyz[1]), z = Integer.parseInt(xyz[2]);
            System.out.println("volume " + size + " " + sha(new ng().b(x, y, z)) + " " + sha(new sb().b(x, y, z)));
        }
    }

    // se.a(IIIIZ)I over every hash nibble (and higher bits) and edge values, as big-endian ints.
    static void gradients() throws Exception {
        int[] values = {Integer.MIN_VALUE, -8191, -4096, -1, 0, 1, 4095, 8191, Integer.MAX_VALUE};
        ByteBuffer out = ByteBuffer.allocate(64 * values.length * values.length * values.length * 4);
        for (int h = -16; h < 48; h++)
            for (int x : values) for (int y : values) for (int z : values) out.putInt(se.a(x, y, z, h, true));
        System.out.println("gradient " + sha(out.array()));
    }

    static void baseSamples() throws Exception {
        for (Object generator : new Object[]{new vd(12,5,16,2,2,0.45f),new we(8,5,8,8,2,0.1f,0.55f,3f)}) {
            boolean fractal = generator instanceof vd;
            Class<?> type = generator.getClass();
            Field output = field(type,fractal ? "H" : "F"), cursor = field(type,"J");
            for (int length : new int[]{-1,0,4}) {
                for (int start : new int[]{-1,0,2,3,Integer.MAX_VALUE}) {
                    byte[] bytes = length < 0 ? null : new byte[length];
                    output.set(generator,bytes);
                    cursor.setInt(generator,start);
                    for (int i = -128; i <= 127; i++) {
                        int index = (i & 7) - 1;
                        String outcome = "ok";
                        try {
                            if (fractal) ((vd)generator).a(index,(byte)i);
                            else ((we)generator).a(index,(byte)i);
                        } catch (ld ex) {
                            if (ex.f instanceof NullPointerException) outcome = ex.e + "|null";
                            else if (ex.f instanceof ArrayIndexOutOfBoundsException bounds) outcome = ex.e + "|" + bounds.getMessage().split(" ")[1];
                            else throw ex;
                        }
                        System.out.println(outcome + " " + cursor.getInt(generator) + " " + (bytes == null ? "-" : HexFormat.of().formatHex(bytes)));
                    }
                }
            }
        }
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("volumes")) {
            volumes(java.util.Arrays.copyOfRange(args, 1, args.length));
            gradients();
            baseSamples();
            return;
        }
        Path profile = Path.of(args[1]);
        GlRecorder probe = new GlRecorder(null);
        probe.loadProfile(profile);
        tf.t = probe.gl();
        Method caps = tf.class.getDeclaredMethod("m");
        caps.setAccessible(true);
        System.out.println("caps " + caps.invoke(null) + " " + tf.r);
        try (GlRecorder recorder = new GlRecorder(Path.of(args[0]))) {
            recorder.loadProfile(profile);
            tf.t = recorder.gl();
            state("initial");
            lm.c();
            state("created");
            recorder.mark("noise-delete");
            lm.b();
            state("deleted");
            lm.d();
            state("unloaded");
        }
    }
}
