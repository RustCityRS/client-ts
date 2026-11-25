import java.applet.Applet;
import java.awt.Canvas;
import java.awt.Dimension;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class HdInitRecolourOracle {
    static final Set<String> slots = Set.of("cj.e", "mj.C", "nj.m", "qe.r", "nj.a", "mk.k", "mk.e");
    static final IdentityHashMap<Object, String> identities = new IdentityHashMap<>();
    static final List<String> writes = new ArrayList<>();
    static class EndOfBlock extends Error {}

    // Watch after each real putstatic. Stop at the first port assignment following both branches.
    static void instrument(String jar, Path output) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry("client.class")));
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int f, String n, String d, String sig, String[] ex) {
                    MethodVisitor method = super.visitMethod(f, n, d, sig, ex);
                    if (!n.equals("g") || !d.equals("(I)V")) return method;
                    return new MethodVisitor(Opcodes.ASM8, method) {
                        public void visitFieldInsn(int op, String owner, String name, String desc) {
                            super.visitFieldInsn(op, owner, name, desc);
                            String key = owner + "." + name;
                            if (op == Opcodes.PUTSTATIC && (slots.contains(key) || key.equals("ee.g"))) {
                                super.visitLdcInsn(key);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdInitRecolourOracle", "record", "(Ljava/lang/String;)V", false);
                            }
                        }
                    };
                }
            }, 0);
            Files.write(output.resolve("client.class"), writer.toByteArray());
        }
    }

    static void record(String slot) throws Exception {
        if (slot.equals("ee.g")) throw new EndOfBlock();
        String[] name = slot.split("\\.");
        Field field = Class.forName(name[0]).getDeclaredField(name[1]);
        Object value = field.get(null);
        if (value instanceof Boolean || value instanceof Integer) {
            writes.add(slot + "=" + value);
        } else {
            String source = Objects.requireNonNull(identities.get(value), "unknown reference in " + slot);
            int hash = value instanceof short[] a ? Arrays.hashCode(a) : Arrays.deepHashCode((short[][]) value);
            writes.add(slot + "=" + source + ":" + hash);
        }
    }

    @SuppressWarnings("removal")
    static class Page extends Applet {
        public Dimension getSize() { return new Dimension(765, 503); }
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) { instrument(args[1], Path.of(args[2])); return; }
        identities.put(md.V, "md.V"); identities.put(pk.V, "pk.V");
        identities.put(dg.c, "dg.c"); identities.put(vd.B, "vd.B");
        identities.put(q.d, "q.d"); identities.put(ci.u, "ci.u");
        identities.put(aa.h, "aa.h"); identities.put(bj.t, "bj.t");

        Class<?> unsafeType = Class.forName("sun.misc.Unsafe");
        Field singleton = unsafeType.getDeclaredField("theUnsafe");
        singleton.setAccessible(true);
        var allocate = unsafeType.getMethod("allocateInstance", Class.class);
        var game = (client) allocate.invoke(singleton.get(null), client.class);
        var page = (Page) allocate.invoke(singleton.get(null), Page.class);
        fk.l = new ll(page, 32, null, 0);
        md.L = new Canvas();
        gj.b = 2;
        try {
            for (String variant : args) {
                vk.n = Integer.parseInt(variant);
                writes.clear();
                try {
                    game.g(2);
                    throw new AssertionError("missed end of client.g palette block");
                } catch (EndOfBlock expected) {
                    System.out.println(String.join(" ", writes));
                } finally {
                    if (gm.T != null) gm.T.a(3208);
                }
            }
        } finally {
            fk.l.b(0);
        }
    }
}
