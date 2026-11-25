import java.lang.reflect.InvocationTargetException;
import java.nio.file.Files;
import java.nio.file.Path;
import jdk.internal.org.objectweb.asm.*;

public class NpcUpdateOracle implements Opcodes {
    private static int reads;
    private static int fault;

    public static void readType() {
        reads++;
        if (fault == 1) throw new IllegalStateException();
        if (fault == 2) throw new AssertionError();
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("hd");
        String npc = hd ? "km" : "bk", typeField = hd ? "rc" : "mc";
        if (args.length == 2) {
            ClassReader original = new ClassReader(npc);
            ClassWriter output = new ClassWriter(original, 0);
            int[] sites = {0};
            original.accept(new ClassVisitor(ASM8, output) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] exceptions) {
                    MethodVisitor method = super.visitMethod(access, name, desc, sig, exceptions);
                    if (!name.equals("a") || !desc.equals("(IIIII)V")) return method;
                    return new MethodVisitor(ASM8, method) {
                        public void visitFieldInsn(int op, String owner, String field, String descriptor) {
                            super.visitFieldInsn(op, owner, field, descriptor);
                            if (op == GETFIELD && owner.equals(npc) && field.equals(typeField)) {
                                sites[0]++;
                                super.visitMethodInsn(INVOKESTATIC, "NpcUpdateOracle", "readType", "()V", false);
                            }
                        }
                    };
                }
            }, 0);
            if (sites[0] != 1) throw new AssertionError(sites[0]);
            Files.write(Path.of(args[1], npc + ".class"), output.toByteArray());
            return;
        }
        Class<?> cls = Class.forName(npc);
        var ctor = cls.getDeclaredConstructor();
        ctor.setAccessible(true);
        Object receiver = ctor.newInstance();
        var field = cls.getDeclaredField(typeField);
        field.setAccessible(true);
        var type = field.getType().getDeclaredConstructor();
        type.setAccessible(true);
        var method = cls.getDeclaredMethod("a", int.class, int.class, int.class, int.class, int.class);
        method.setAccessible(true);
        for (Object value : new Object[]{null, type.newInstance()}) {
            field.set(receiver, value);
            for (fault = 0; fault < 3; fault++) {
                reads = 0;
                String result = "return";
                try { method.invoke(receiver, -1, 2, -3, 4, 5); }
                catch (InvocationTargetException err) {
                    Throwable cause = err.getCause();
                    if (cause instanceof AssertionError) result = "error";
                    else {
                        var context = cause.getClass().getDeclaredField(hd ? "e" : "q");
                        context.setAccessible(true);
                        result = (String) context.get(cause);
                    }
                }
                System.out.println(reads + "|" + result);
            }
        }
    }
}
