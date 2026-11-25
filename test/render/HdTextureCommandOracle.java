import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.IntBuffer;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import javax.media.opengl.GL;

// Run the original HD tf class against a JOGL command recorder. No native
// context is required. Stop inside the first glTexImage2D before tf.s calls jf.f.
public class HdTextureCommandOracle {
    private static final Field bound = integerField("s");
    private static final Field rgb = integerField("i");
    private static final Field alpha = integerField("h");
    private static final List<String> commands = new ArrayList<>();
    private static final class UploadComplete extends Error {}
    private static final class DriverFault extends Error {}
    private static final GlRecorder recorder = GlRecorder.forOracle();
    private static GL driverB;
    private static int first, second, generated;
    private static String fault, swap;

    private static Field integerField(String name) {
        try {
            Field field = tf.class.getDeclaredField(name);
            field.setAccessible(true);
            if (field.getType() != int.class) throw new AssertionError(name);
            return field;
        } catch (ReflectiveOperationException e) { throw new AssertionError(e); }
    }

    private static String texture(int id) {
        if (id == first) return "T0";
        if (id == second) return "T1";
        return String.valueOf(id);
    }

    private static String state() throws IllegalAccessException {
        return String.join(",", texture(tf.z), texture(bound.getInt(null)),
                           String.valueOf(rgb.getInt(null)), String.valueOf(alpha.getInt(null)));
    }

    private static GL driver(String label) {
        InvocationHandler handler = (proxy, method, args) -> {
            String name = method.getName();
            String record = switch (name) {
                case "glGenTextures" -> {
                    int[] ids = (int[])args[1];
                    yield "gen(" + args[0] + "," + ids.length + "," + args[2] + "," + ids[(int)args[2]] + ")";
                }
                case "glBindTexture" -> "bind(" + args[0] + "," + texture((int)args[1]) + ")";
                case "glEnable" -> "enable(" + args[0] + ")";
                case "glDisable" -> "disable(" + args[0] + ")";
                case "glTexEnvi" -> "envi(" + args[0] + "," + args[1] + "," + args[2] + ")";
                case "glTexImage2D" -> {
                    IntBuffer pixels = (IntBuffer)args[8];
                    ByteBuffer copy = ByteBuffer.allocate(pixels.remaining() * Integer.BYTES).order(pixels.order());
                    copy.asIntBuffer().put(pixels.duplicate());
                    yield "image(" + args[0] + "," + args[1] + "," + args[2] + "," + args[3] + "," + args[4] +
                        "," + args[5] + "," + args[6] + "," + args[7] + ",int," + pixels.position() + "," +
                        pixels.limit() + "," + pixels.capacity() + "," + pixels.isDirect() + "," +
                        HexFormat.of().formatHex(copy.array()) + ")";
                }
                default -> throw new AssertionError("Unexpected JOGL call " + method);
            };
            commands.add(label + "." + record + "@" + state());
            if (name.equals(fault)) throw new DriverFault();
            if (name.equals("glGenTextures")) ((int[])args[1])[(int)args[2]] = generated++ == 0 ? first : second;
            if (name.equals(swap)) tf.t = driverB;
            if (name.equals("glTexImage2D")) throw new UploadComplete();
            return null;
        };
        return recorder.gl(handler);
    }

    public static void main(String[] args) throws Exception {
        first = Integer.parseInt(args[0]);
        second = Integer.parseInt(args[1]);
        Method boot = tf.class.getDeclaredMethod("s");
        boot.setAccessible(true);
        GL driverA = driver("A");
        driverB = driver("B");
        tf.t = driverA;
        try (var input = new BufferedReader(new InputStreamReader(System.in))) {
            for (String line; (line = input.readLine()) != null;) {
                String[] v = line.split(" ");
                String result = "ok";
                commands.clear();
                int arg = Integer.parseInt(v[1]);
                fault = v[2]; swap = v[3];
                try {
                    switch (v[0]) {
                        case "state" -> {}
                        case "context" -> tf.t = arg == 0 ? null : arg == 1 ? driverA : driverB;
                        case "boot" -> {
                            try {
                                boot.invoke(null);
                                throw new AssertionError("tf.s returned past the first upload");
                            } catch (InvocationTargetException e) {
                                Throwable cause = e.getCause();
                                if (cause instanceof UploadComplete) result = "upload";
                                else if (cause instanceof DriverFault) result = "fault";
                                else if (cause instanceof NullPointerException) result = "null";
                                else throw e;
                            }
                        }
                        case "bind" -> tf.c(arg);
                        case "rgb" -> tf.d(arg);
                        case "alpha" -> tf.a(arg);
                        default -> throw new AssertionError(v[0]);
                    }
                } catch (DriverFault e) { result = "fault"; }
                  catch (NullPointerException e) { result = "null"; }
                String context = tf.t == null ? "-" : tf.t == driverA ? "A" : "B";
                System.out.println(result + "|" + context + "|" + state() + "|" + String.join(";",commands));
            }
        }
    }
}
