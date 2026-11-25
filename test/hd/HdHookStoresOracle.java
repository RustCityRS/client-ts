import java.io.InputStream;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Watch be's actual field stores as the HD interpreter installs a component hook. */
public final class HdHookStoresOracle {
    static be widget;
    static final List<String> trace = new ArrayList<>();

    public static void stored(String field) throws Exception {
        Object value = be.class.getDeclaredField(field).get(widget);
        String text = value instanceof int[] a ? Arrays.toString(a) :
            value instanceof Object[] a ? Arrays.toString(a) : String.valueOf(value);
        trace.add(field + "=" + text);
    }

    static void instrument(Path dir) throws Exception {
        try (InputStream in = HdHookStoresOracle.class.getResourceAsStream("/h.class")) {
            ClassReader reader = new ClassReader(in);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] ex) {
                    MethodVisitor mv = super.visitMethod(access, name, desc, sig, ex);
                    if (!name.equals("a") || !desc.equals("(BILjl;)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitFieldInsn(int op, String owner, String field, String type) {
                            super.visitFieldInsn(op, owner, field, type);
                            if (op == Opcodes.PUTFIELD && owner.equals("be") &&
                                    (type.equals("[I") || type.equals("[Ljava/lang/Object;") || field.equals("T"))) {
                                super.visitLdcInsn(field);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdHookStoresOracle","stored","(Ljava/lang/String;)V",false);
                            }
                        }
                    };
                }
            }, 0);
            Files.write(dir.resolve("h.class"), writer.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0) { instrument(Path.of(args[0])); return; }
        int key = 120000;
        for (int op = 1400; op <= 1429; op++) for (int extra : new int[]{0,1000}) for (int id : new int[]{71,-1}) {
            widget = new be();
            sg.i = widget;
            th.j = new be[][]{null, {widget}};
            sc.m = new boolean[]{false,true};
            qc code = new qc();
            code.O = extra == 0 ? new int[]{0,0,0,0,0,3,op,21} : new int[]{0,0,0,0,0,3,0,op+extra,21};
            code.W = extra == 0 ? new int[]{id,73,-20,23,2,0,0,0} : new int[]{id,73,-20,23,2,0,65536,0,0};
            code.T = new na[code.O.length];
            code.T[5] = cd.a("iY",(byte)-128);
            ib.d.a(code,key,(byte)-87);
            jl event = new jl(); event.E = new Object[]{key++};
            trace.clear();
            h.a((byte)-12,100,event);
            System.out.println(String.join("|",trace));
        }
    }
}
