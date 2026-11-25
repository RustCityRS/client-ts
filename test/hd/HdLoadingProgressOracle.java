import java.awt.Frame;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.StringJoiner;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public final class HdLoadingProgressOracle {
    static StringJoiner trace;
    static int mutation, count;

    static <T> T blank(Class<T> type) throws ReflectiveOperationException {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Field field = unsafe.getDeclaredField("theUnsafe");
        field.setAccessible(true);
        return type.cast(unsafe.getMethod("allocateInstance", Class.class).invoke(field.get(null), type));
    }

    public static void observed(String field) {
        trace.add(field);
        if (++count == mutation) {
            // Replace both peaks and counters after the JVM captured this operand.
            sj.p = 7; nm.U = -8; cn.B = 9; wc.g = -2;
        }
    }

    static final class Displayed extends Error {}
    public static void message(byte guard, boolean immediate, na text) {
        trace.add(new String(text.T, 0, text.lb, StandardCharsets.ISO_8859_1));
        throw new Displayed();
    }

    static void instrument(Path jar, Path directory) throws Exception {
        try (JarFile archive = new JarFile(jar.toFile())) {
            ClassReader original = new ClassReader(archive.getInputStream(archive.getJarEntry("client.class")));
            ClassWriter out = new ClassWriter(original, ClassWriter.COMPUTE_MAXS);
            original.accept(new ClassVisitor(Opcodes.ASM8, out) {
                public MethodVisitor visitMethod(int flags, String name, String desc, String sig, String[] exceptions) {
                    MethodVisitor mv = super.visitMethod(flags, name, desc, sig, exceptions);
                    if (!name.equals("f") || !desc.equals("(I)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitFieldInsn(int op, String owner, String name, String desc) {
                            super.visitFieldInsn(op, owner, name, desc);
                            String key = owner + "." + name;
                            if (!java.util.Set.of("t.y","sj.p","nm.U","cn.B","wc.g").contains(key)) return;
                            super.visitLdcInsn((op == Opcodes.GETSTATIC ? "R" : "W") + key);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdLoadingProgressOracle","observed","(Ljava/lang/String;)V",false);
                        }
                        public void visitMethodInsn(int op, String owner, String name, String desc, boolean itf) {
                            if (owner.equals("j") && name.equals("a") && desc.equals("(BZLna;)V")) {
                                super.visitMethodInsn(op,"HdLoadingProgressOracle","message",desc,false);
                            } else super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                    };
                }
            },0);
            Files.write(directory.resolve("client.class"),out.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 2) { instrument(Path.of(args[0]),Path.of(args[1])); return; }
        client app = blank(client.class);
        fh.Y = blank(Frame.class);
        ca.ab = true; fh.P = false; tf.w = false;
        try (var in = new java.io.BufferedReader(new java.io.InputStreamReader(System.in))) {
            for (String line; (line=in.readLine())!=null;) {
                String[] tokens=line.split(" ");
                tl.d=Integer.parseInt(tokens[0]); t.y=Integer.parseInt(tokens[1]);
                sj.p=cn.B=Integer.parseInt(tokens[2]); nm.U=wc.g=Integer.parseInt(tokens[3]);
                mutation=Integer.parseInt(tokens[4]); count=0; trace=new StringJoiner("|");
                try { app.f(40); throw new AssertionError("MessageBox was not reached"); }
                catch (Displayed expected) {}
                catch (ld wrapped) {
                    if (!(wrapped.f instanceof ArithmeticException)) throw wrapped;
                    trace.add(wrapped.e + "/zero");
                }
                System.out.println(trace+"|"+sj.p+","+nm.U+","+cn.B+","+wc.g);
            }
        }
    }
}
