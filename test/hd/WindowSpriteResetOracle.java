import java.io.InputStream;
import java.nio.file.*;
import jdk.internal.org.objectweb.asm.*;

/** Trace the actual stores in the gamepack before running its window resource reset methods. */
public final class WindowSpriteResetOracle {
    public static void stored(String slot) { System.out.println(slot); }

    static void patch(Path dir, String owner, String name, String descriptor) throws Exception {
        try (InputStream bytes = WindowSpriteResetOracle.class.getResourceAsStream("/" + owner + ".class")) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String id, String desc, String sig, String[] ex) {
                    MethodVisitor delegate = super.visitMethod(access,id,desc,sig,ex);
                    if (!id.equals(name) || !desc.equals(descriptor)) return delegate;
                    return new MethodVisitor(Opcodes.ASM8,delegate) {
                        public void visitFieldInsn(int opcode, String cls, String field, String type) {
                            super.visitFieldInsn(opcode,cls,field,type);
                            if (opcode == Opcodes.PUTSTATIC && (type.startsWith("L") || type.startsWith("["))) {
                                super.visitLdcInsn(cls + "." + field);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"WindowSpriteResetOracle","stored","(Ljava/lang/String;)V",false);
                            }
                        }
                    };
                }
            },0);
            Files.write(dir.resolve(owner + ".class"),writer.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        if (args.length == 2) {
            Path dir = Path.of(args[1]);
            if (hd) {
                patch(dir,"ja","a","(Z)V");
                patch(dir,"j","g","(I)V");
                patch(dir,"g","a","(B)V");
            } else {
                patch(dir,"sj","c","(Z)V");
                patch(dir,"mk","c","(Z)V");
            }
            return;
        }
        if (hd) {
            Class.forName("ja").getDeclaredMethod("a",boolean.class).invoke(null,false);
            Class.forName("j").getDeclaredMethod("g",int.class).invoke(null,-7878);
            Class.forName("g").getDeclaredMethod("a",byte.class).invoke(null,(byte)106);
        } else {
            Class.forName("sj").getDeclaredMethod("c",boolean.class).invoke(null,false);
            Class.forName("mk").getDeclaredMethod("c",boolean.class).invoke(null,false);
        }
    }
}
