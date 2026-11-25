import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class CheckMinimapOracle {
    static int action;
    static pb other;
    static String trace;

    // Observe hi.b's three callees. Keep the original comparisons, argument evaluation and field writes.
    static void instrument(Path jar, Path dir) throws Exception {
        try (JarFile source = new JarFile(jar.toFile())) {
            ClassReader reader = new ClassReader(source.getInputStream(source.getJarEntry("hi.class")));
            ClassWriter writer = new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int flags, String name, String desc, String sig, String[] ex) {
                    MethodVisitor mv = super.visitMethod(flags, name, desc, sig, ex);
                    if (!name.equals("b") || !desc.equals("(I)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitMethodInsn(int op, String owner, String name, String desc, boolean iface) {
                            String probe = switch (owner + "." + name + desc) {
                                case "ph.a(IZ)Z" -> "build";
                                case "bj.a(IIIIIIZ)V" -> "rebuild";
                                case "ia.c(I)V" -> "roofs";
                                default -> null;
                            };
                            super.visitMethodInsn(op, probe == null ? owner : "CheckMinimapOracle",
                                    probe == null ? name : probe, desc, iface);
                        }
                        public void visitFieldInsn(int op, String owner, String name, String desc) {
                            super.visitFieldInsn(op, owner, name, desc);
                            if (op == Opcodes.GETSTATIC && owner.equals("ic") && name.equals("V")) {
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "CheckMinimapOracle", "afterCentreX", "()V", false);
                            }
                        }
                    };
                }
            }, 0);
            Files.write(dir.resolve("hi.class"), writer.toByteArray());
        }
    }
    public static void afterCentreX() {
        if (action == 5) te.g = other;
        if (action == 6) te.g = null;
    }
    public static void rebuild(int level, int centreZ, int localX, int guard, int centreX, int localZ, boolean title) {
        if (guard != 0 || title) throw new AssertionError();
        trace += "rebuild," + level + "," + centreZ + "," + localX + "," + centreX + "," + localZ + ";";
    }
    public static boolean build(int level, boolean guard) {
        if (!guard) throw new AssertionError();
        trace += "build," + level + ";";
        if (action == 2) throw new IllegalStateException();
        if (action == 3 || action == 4) ah.f = -81;
        return action != 0 && action != 4;
    }
    public static void roofs(int guard) {
        if (guard != 512) throw new AssertionError();
        trace += "roofs," + gk.j + ";";
        if (action == 7) throw new IllegalStateException();
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 2) { instrument(Path.of(args[0]), Path.of(args[1])); return; }
        for (String line : new BufferedReader(new InputStreamReader(System.in)).lines().toList()) {
            int[] row = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            rj.l = row[0] != 0; sb.h = row[1]; ah.f = row[2]; gk.j = row[3]; action = row[5];
            ah.k = -410; ic.V = 218; te.g = new pb(); other = new pb(); other.ac[0] = -212;
            te.g.L[0] = 73; te.g.ac[0] = 109;
            if (row[4] == 1) te.g = null;
            if (row[4] == 2) te.g.L = new int[0];
            if (row[4] == 3) te.g.ac = new int[0];
            trace = ""; String result = "ok";
            try { hi.b(0); }
            catch (RuntimeException error) {
                Throwable cause = error;
                while (cause instanceof g wrapped) cause = wrapped.a;
                if (cause instanceof NullPointerException) result = "null";
                else if (cause instanceof ArrayIndexOutOfBoundsException) result = "bounds";
                else if (cause instanceof IllegalStateException) result = "stop";
                else throw error;
            }
            System.out.println(result + "/" + trace + "/" + ah.f + "/" + gk.j);
        }
    }
}
