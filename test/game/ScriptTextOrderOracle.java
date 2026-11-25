import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class ScriptTextOrderOracle {
    static final Map<String, String> methods = Map.of(
        "me.a(IZ)Z", "print", "pa.f(II)Z", "alnum", "qi.a(II)Z", "alpha",
        "uc.a(IB)Z", "digit", "ab.c(II)I", "lower", "tb.a(IB)I", "upper",
        "ik.a(II)Lfg;", "font", "mb.a(Lid;I)I", "lines", "mb.b(Lid;I)I", "width");
    static int target, at, edit, reads;
    static boolean active;
    static StringBuilder trace;
    static int[] primary, secondary;

    public static void opcode(int op) { active = op == target; }
    public static void observe(String tag) {
        if (!active) return;
        trace.append(tag).append(',');
        if (++reads != at) return;
        switch (edit) {
            case 1 -> tg.B = secondary;
            case 2 -> tg.B = null;
            case 3 -> tg.B = new int[0];
            case 4 -> throw new IllegalStateException("observer");
        }
    }
    public static void called(String tag, int value) { observe(tag + value); }

    static void prepare(Path jar, Path dir) throws Exception {
        try (JarFile file = new JarFile(jar.toFile())) {
            for (String unit : List.of("gh","me","pa","qi","uc","ab","tb","ik","mb")) {
                ClassReader input = new ClassReader(file.getInputStream(file.getJarEntry(unit+".class")));
                ClassWriter output = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                input.accept(new ClassVisitor(Opcodes.ASM8,output) {
                    public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] errors) {
                        MethodVisitor mv = super.visitMethod(access,name,desc,sig,errors);
                        String tag = methods.get(unit+"."+name+desc);
                        if (tag != null) return new MethodVisitor(Opcodes.ASM8,mv) {
                            public void visitCode() {
                                super.visitCode();
                                super.visitLdcInsn(tag);
                                int arg = switch (tag) {
                                    case "lines", "width" -> 2;
                                    case "alpha", "font" -> 1;
                                    default -> 0;
                                };
                                super.visitVarInsn(Opcodes.ILOAD,arg);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"ScriptTextOrderOracle","called","(Ljava/lang/String;I)V",false);
                            }
                        };
                        if (!unit.equals("gh") || !name.equals("a") || !desc.equals("(Lwf;II)V")) return mv;
                        return new MethodVisitor(Opcodes.ASM8,mv) {
                            public void visitVarInsn(int op, int slot) {
                                super.visitVarInsn(op,slot);
                                if (op == Opcodes.ISTORE && slot == 11) {
                                    super.visitVarInsn(Opcodes.ILOAD,slot);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"ScriptTextOrderOracle","opcode","(I)V",false);
                                }
                            }
                            public void visitFieldInsn(int op,String owner,String name,String desc) {
                                super.visitFieldInsn(op,owner,name,desc);
                                if (op == Opcodes.GETSTATIC && (owner.equals("tg") && name.equals("B") || owner.equals("g") && name.equals("p"))) {
                                    super.visitLdcInsn(owner.equals("tg")?"I":"S");
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"ScriptTextOrderOracle","observe","(Ljava/lang/String;)V",false);
                                }
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(unit+".class"),output.toByteArray());
            }
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) { prepare(Path.of(args[0]),Path.of(args[1])); return; }
        byte[] metrics = new byte[257];
        for (int i=0;i<metrics.length;i++) metrics[i] = (byte)(1+i%7);
        for (int id : new int[]{100,203}) fa.p.a((long)id,new fg(metrics),(byte)-71);
        id text = vb.a("abc def gh", (byte)70);
        PrintStream output = System.out;
        for (String line : new BufferedReader(new InputStreamReader(System.in)).lines().toList()) {
            int[] v = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            target = v[0]; int operand = v[1]; at = v[2]; edit = v[3]; int argCount = v[4];
            active = false; reads = 0; trace = new StringBuilder();
            primary = new int[]{-14,-15,-16}; secondary = new int[]{9,203,99}; tg.B = primary;
            g.p = new id[]{null}; nf.j = null;
            boolean font = target == 4108 || target == 4109;
            int n = argCount + (font ? 1 : 0);
            m script = new m(); script.F = new int[n+2]; script.D = new int[n+2]; script.B = new id[n+2];
            for (int i=0;i<argCount;i++) script.F[i] = i==0 ? operand : 100;
            if (font) { script.D[argCount] = 3; script.B[argCount] = text; }
            script.D[n] = target; script.D[n+1] = 21;
            sf.g = new vj(8); sf.g.a(77L,0,script);
            wf event = new wf(); event.G = new Object[]{77};
            ByteArrayOutputStream report = new ByteArrayOutputStream();
            System.setOut(new PrintStream(report));
            try { gh.a(event,-22368,100); } finally { System.setOut(output); active = false; }
            String msg = report.toString();
            String fault = msg.isEmpty() ? "ok" : msg.contains("IndexOutOfBoundsException") ? "bounds" :
                msg.contains("NullPointerException") ? "null" : msg.contains("observer") ? "observer" : "other";
            output.println(fault+";"+trace+";"+Arrays.toString(primary)+";"+Arrays.toString(secondary)+";"+
                (tg.B==primary?"A":tg.B==secondary?"B":tg.B==null?"N":"E"));
        }
    }
}
