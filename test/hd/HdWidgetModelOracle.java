import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.StringJoiner;
import jdk.internal.org.objectweb.asm.*;

/** Run gn.a on two original widgets. Observe its virtual model call; the cached empty td still executes its own method. */
public final class HdWidgetModelOracle {
    static final List<String> events = new ArrayList<>();
    static final List<String> fields = new ArrayList<>();
    static String fault;

    public static void fieldAccess(String label) {
        fields.add(label + "@" + events.size());
        if (label.equals(fault)) throw new IllegalStateException("failure in " + label);
    }
    static int scissorCalls;

    static String value(Object arg) {
        if (arg instanceof Float f) return "f" + Integer.toHexString(Float.floatToIntBits(f));
        if (arg instanceof Double d) return "d" + Long.toHexString(Double.doubleToLongBits(d));
        if (arg instanceof float[] a) {
            StringJoiner values = new StringJoiner(",", "[", "]");
            for (float v : a) values.add(value(v));
            return values.toString();
        }
        return String.valueOf(arg);
    }

    static void event(String name, Object... args) {
        StringJoiner values = new StringJoiner(",", name + "(", ")");
        for (Object arg : args) values.add(value(arg));
        events.add(values + "@" + vg.c);
        if (name.equals("glScissor")) scissorCalls++;
        if (name.equals(fault) || (fault.equals("restoreClip") && name.equals("glScissor") && scissorCalls == 2))
            throw new IllegalStateException("failure in " + name);
    }

    public static void observeModel(ak instance, int x, int y, int z, int pitch, int tx, int ty, int tz, long tag) {
        event("model", x, y, z, pitch, tx, ty, tz, tag);
        instance.a(x, y, z, pitch, tx, ty, tz, tag);
    }

    static void instrument(Path output) throws Exception {
        ClassReader reader;
        try (var src = HdWidgetModelOracle.class.getResourceAsStream("/gn.class")) { reader = new ClassReader(src); }
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            public MethodVisitor visitMethod(int access, String name, String desc, String signature, String[] exceptions) {
                MethodVisitor next = super.visitMethod(access, name, desc, signature, exceptions);
                if (!name.equals("a") || !desc.equals("(III[Lbe;IIIIBI)V")) return next;
                return new MethodVisitor(Opcodes.ASM8, next) {
                    @Override public void visitFieldInsn(int op, String owner, String name, String descriptor) {
                        String label = switch (owner + "." + name) {
                            case "il.I" -> "lightingBrightness";
                            case "vg.c" -> op == Opcodes.PUTSTATIC ? "consumeDepthClear" : "pendingDepthClear";
                            case "hf.g" -> "modelSine";
                            case "hf.r" -> "modelCosine";
                            default -> null;
                        };
                        if (label != null) {
                            super.visitLdcInsn(label);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdWidgetModelOracle", "fieldAccess", "(Ljava/lang/String;)V", false);
                        }
                        super.visitFieldInsn(op, owner, name, descriptor);
                    }
                    public void visitMethodInsn(int op, String owner, String name, String desc, boolean iface) {
                        if (owner.equals("ak") && name.equals("a") && desc.equals("(IIIIIIIJ)V")) {
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdWidgetModelOracle", "observeModel", "(Lak;IIIIIIIJ)V", false);
                        } else super.visitMethodInsn(op, owner, name, desc, iface);
                    }
                };
            }
        }, 0);
        Files.write(output.resolve("gn.class"), writer.toByteArray());
    }

    static be widget(int slot, int flags, int input) {
        be c = new be();
        c.Fc = 11 + slot; c.N = -1; c.I = 6; c.Hb = (flags & 1) != 0; c.A = (flags & 2) != 0;
        c.md = (flags & 4) != 0; c.Vc = (short)(slot == 0 ? -32765 : 32760); c.o = (short)(slot == 0 ? 31237 : -29999);
        c.jd = 13 + slot; c.jb = 17; c.n = 121; c.R = 97; c.F = 60; c.pd = 103;
        c.ic = -11; c.Eb = 12; c.j = 404; c.hc = -18; c.nc = 31; c.ld = 251; c.Gc = 65; c.D = slot == 0 && input == 2 ? 2048 : 314;
        c.ab = 1; c.Z = slot == 0 && input == 1 || input == 3 ? -1 : 9;
        if (input == 4) { c.Bc = new int[]{0}; c.kd = null; }
        return c;
    }

    static Field field(Class<?> owner, String member) throws ReflectiveOperationException {
        Field f = owner.getDeclaredField(member);
        f.setAccessible(true);
        return f;
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1) { instrument(Path.of(args[0])); return; }
        Constructor<td> constructor = td.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        jk.z.a((byte)-115, constructor.newInstance(), 65545L);
        nk.O = new e();
        tf.w = true; tf.J = 291; tf.A = 217;
        tf.t = GlRecorder.forOracle().gl((proxy, method, values) -> {
            event(method.getName(), values == null ? new Object[0] : values);
            return null;
        });
        sc.z[0] = true;
        Field clipRight = field(dj.class, "d");
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            String[] parts = line.split(" ");
            int[] inputs = Arrays.stream(parts, 0, 3).mapToInt(Integer::parseInt).toArray();
            int flags = inputs[0], input = inputs[1];
            il.I = inputs[2]; od.c = (flags & 16) != 0; vg.c = (flags & 8) != 0;
            fault = parts[3]; scissorCalls = 0; events.clear(); fields.clear();
            be[] widgets = {widget(0, flags, input), widget(1, flags ^ 7, input)};
            String result = "ok";
            try { gn.a(7, 11, 9, widgets, 181, -1, 5, 155, (byte)119, 0); }
            catch (ld e) { result = e.f.getClass().getSimpleName() + " " + e.e; }
            String clip = dj.c + "," + dj.b + "," + clipRight.getInt(null) + "," + dj.e;
            System.out.println(result + "|" + vg.c + "|" + clip + "|" + String.join(";", events) + "|" + String.join(";", fields));
        }
    }
}
