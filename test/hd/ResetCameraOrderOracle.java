import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

/** Observe the reset block's original stores and Math.random calls in each gamepack. */
public class ResetCameraOrderOracle {
    // Slot numbers match the TS fixture's state vector. Order here does not set the event order.
    static final List<String> SD = List.of("client.nb", "df.B", "gg.C", "kk.db", "ag.e", "gi.n",
        "le.c", "ic.T", "gk.j", "fe.R", "ki.R", "ok.r", "ag.l", "gl.z", "ve.m", "ed.d");
    static final List<String> HD = List.of("ke.U", "eg.d", "qk.h", "we.w", "ej.W", "sj.H",
        "vd.C", "gk.h", "id.b", "vl.j", "wb.d", "th.n", "pe.j", "ja.n", "f.Z", "wd.g");
    static final List<String> trace = new ArrayList<>();
    static int cut, finalSlot;
    static long trialSeed;
    static Random random;

    static final class Cut extends Error {}
    static final class Done extends Error {}
    public static void event(String name) {
        trace.add(name);
        if (trace.size() == cut) throw new Cut();
    }
    public static void stored(int slot) {
        // Reset itself initializes unrelated gamepack classes before this block on the first JVM call.
        if (trace.isEmpty()) random.setSeed(trialSeed);
        event("w" + slot);
        if (slot == finalSlot) throw new Done();
    }
    public static void draw() { event("random"); }

    static Field field(String id) throws ReflectiveOperationException {
        String[] parts = id.split("\\.");
        Field f = Class.forName(parts[0]).getDeclaredField(parts[1]);
        f.setAccessible(true);
        return f;
    }

    static void instrument(Path jarPath, Path output, boolean hd) throws Exception {
        String cls = hd ? "tk" : "tj";
        List<String> fields = hd ? HD : SD;
        String first = hd ? "vd.C" : "fe.R";
        String last = hd ? "wd.g" : "gl.z";
        try (JarFile jar = new JarFile(jarPath.toFile())) {
            ClassReader reader = new ClassReader(jar.getInputStream(jar.getJarEntry(cls + ".class")));
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String signature, String[] ex) {
                    MethodVisitor original = super.visitMethod(access, name, desc, signature, ex);
                    if (!name.equals("a") || !desc.equals(hd ? "(Z)V" : "(I)V")) return original;
                    return new MethodVisitor(Opcodes.ASM8, original) {
                        boolean inside;
                        public void visitFieldInsn(int op, String owner, String name, String desc) {
                            super.visitFieldInsn(op, owner, name, desc);
                            if (op != Opcodes.PUTSTATIC) return;
                            String key = owner + "." + name;
                            if (key.equals(first)) inside = true;
                            if (!inside) return;
                            int slot = fields.indexOf(key);
                            if (slot == -1) throw new AssertionError("Unobserved native store " + key);
                            super.visitLdcInsn(slot);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "ResetCameraOrderOracle", "stored", "(I)V", false);
                            if (key.equals(last)) inside = false;
                        }
                        public void visitMethodInsn(int op, String owner, String name, String type, boolean itf) {
                            if (inside && owner.equals("java/lang/Math") && name.equals("random") && type.equals("()D")) {
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "ResetCameraOrderOracle", "draw", "()V", false);
                            }
                            super.visitMethodInsn(op, owner, name, type, itf);
                        }
                    };
                }
            }, 0);
            Files.write(output.resolve(cls + ".class"), writer.toByteArray());
        }
    }

    static void ensureObject(String id, boolean packet) throws Exception {
        Field f = field(id);
        if (f.get(null) != null) return;
        var constructor = packet ? f.getType().getDeclaredConstructor(int.class) : f.getType().getDeclaredConstructor();
        constructor.setAccessible(true);
        f.set(null, packet ? constructor.newInstance(5000) : constructor.newInstance());
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        if (args.length == 3) {
            instrument(Path.of(args[1]), Path.of(args[2]), hd);
            return;
        }
        finalSlot = hd ? 15 : 13;
        List<Field> fields = new ArrayList<>();
        for (String name : hd ? HD : SD) fields.add(field(name));
        ensureObject(hd ? "od.f" : "ej.p", false);
        ensureObject(hd ? "ag.P" : "qk.v", true);
        ensureObject(hd ? "eg.e" : "hd.b", true);
        Field generator = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        generator.setAccessible(true);
        random = (Random)generator.get(null);
        Method reset = Class.forName(hd ? "tk" : "tj").getDeclaredMethod("a", hd ? boolean.class : int.class);
        reset.setAccessible(true);
        for (long seed : new long[]{0L, -1L, 530L, 0x123456789ABCL}) {
            for (cut = 0; cut <= fields.size() + 6; cut++) {
                for (int slot = 0; slot < fields.size(); slot++) {
                    Field f = fields.get(slot);
                    if (f.getType() == boolean.class) f.setBoolean(null, true);
                    else f.setInt(null, 1000 + slot);
                }
                trace.clear();
                trialSeed = seed;
                try {
                    reset.invoke(null, hd ? (Object)true : (Object)0);
                    throw new AssertionError("Missed end of native reset block");
                } catch (InvocationTargetException ex) {
                    if (!(cut == 0 ? ex.getCause() instanceof Done : ex.getCause() instanceof Cut)) throw ex;
                }
                List<String> state = new ArrayList<>();
                for (Field f : fields) state.add(String.valueOf(f.get(null)));
                System.out.println(seed + "|" + cut + "|" + String.join(",", trace) + "|" + String.join(",", state) + "|" + random.nextInt());
            }
        }
    }
}
