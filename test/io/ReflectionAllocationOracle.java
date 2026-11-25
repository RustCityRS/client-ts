import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodType;
import java.util.Arrays;
import java.util.HexFormat;
import jdk.internal.org.objectweb.asm.*;

public class ReflectionAllocationOracle {
    public static byte[] allocate(int length) {
        throw new OutOfMemoryError("fixture allocator");
    }
    public static void main(String[] argv) throws Throwable {
        ClassWriter out = new ClassWriter(0);
        out.visit(Opcodes.V1_5, Opcodes.ACC_PUBLIC, "CheckWithExhaustedHeap", null, "java/lang/Object", null);
        try (InputStream bytes = lj.class.getResourceAsStream("/lj.class")) {
            new ClassReader(bytes).accept(new ClassVisitor(Opcodes.ASM8) {
                public MethodVisitor visitMethod(int acc,String name,String descriptor,String sig,String[] exceptions) {
                    if (!name.equals("a") || !descriptor.equals("(Lfb;Lgd;II)V")) return null;
                    MethodVisitor m = out.visitMethod(Opcodes.ACC_STATIC|Opcodes.ACC_PUBLIC,"decode",descriptor,null,null);
                    return new MethodVisitor(Opcodes.ASM8,m) {
                        public void visitIntInsn(int op,int operand) {
                            if (op==Opcodes.NEWARRAY && operand==Opcodes.T_BYTE)
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"ReflectionAllocationOracle","allocate","(I)[B",false);
                            else super.visitIntInsn(op,operand);
                        }
                    };
                }
            },ClassReader.SKIP_DEBUG|ClassReader.SKIP_FRAMES);
        }
        out.visitEnd();
        MethodHandle decode = MethodHandles.lookup().findStatic(MethodHandles.lookup().defineClass(out.toByteArray()),"decode",
            MethodType.methodType(void.class,fb.class,gd.class,int.class,int.class));
        byte[] body = HexFormat.of().parseHex(new BufferedReader(new InputStreamReader(System.in)).readLine());
        gd packet = new gd(body);
        decode.invokeExact((fb)null,packet,body.length,896);
        qj check = (qj)di.a.d(0);
        System.out.println(packet.yb+"|"+Arrays.toString(check.z)+"|"+Arrays.toString(check.u));
    }
}
