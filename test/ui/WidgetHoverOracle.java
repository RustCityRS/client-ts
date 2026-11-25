import java.io.*;
import java.lang.invoke.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

public class WidgetHoverOracle {
    static final aj[] widgets = new aj[3];

    public static void traverse() {
        if (di.g != null || gh.C != null) throw new AssertionError("t.c did not clear both widgets");
        dd.a(40, 0, 80, 0, (byte)-40, 0, 0, 0);
    }

    // Preserve the locals that t.c saves at 0xc3c..0xc4f for its redraw and timer block at 0xfdb..0x106b.
    static MethodHandle tick() throws Exception {
        ClassNode source = new ClassNode();
        try (InputStream in = t.class.getResourceAsStream("/t.class")) {
            new ClassReader(in).accept(source, ClassReader.SKIP_FRAMES | ClassReader.SKIP_DEBUG);
        }
        MethodNode game = source.methods.stream().filter(m -> m.name.equals("c") && m.desc.equals("(I)V")).findFirst().orElseThrow();
        ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
        writer.visit(Opcodes.V1_5, Opcodes.ACC_PUBLIC, "ExtractedWidgetHoverTick", null, "java/lang/Object", null);
        MethodVisitor op = writer.visitMethod(Opcodes.ACC_PUBLIC | Opcodes.ACC_STATIC, "run", "()V", null, null);
        op.visitCode();
        op.visitFieldInsn(Opcodes.GETSTATIC, "client", "wb", "I");
        op.visitVarInsn(Opcodes.ISTORE, 12);
        int part = 0;
        for (AbstractInsnNode n : game.instructions) {
            if (n instanceof FieldInsnNode f) {
                if (f.owner.equals("di") && f.name.equals("g") && f.getOpcode() == Opcodes.GETSTATIC && (part == 0 || part == 2)) part++;
                if (part == 3 && f.owner.equals("cl") && f.name.equals("e")) { part++; break; }
            }
            if (part == 1 || part == 3) n.accept(op);
            if (part == 1 && n instanceof FieldInsnNode f && f.owner.equals("gh") && f.name.equals("C") && f.getOpcode() == Opcodes.PUTSTATIC) {
                op.visitMethodInsn(Opcodes.INVOKESTATIC, "WidgetHoverOracle", "traverse", "()V", false);
                part++;
            }
        }
        if (part != 4) throw new AssertionError("missing t.c code range");
        op.visitInsn(Opcodes.RETURN); op.visitMaxs(0, 0); op.visitEnd(); writer.visitEnd();
        return MethodHandles.lookup().findStatic(MethodHandles.lookup().defineClass(writer.toByteArray()), "run", MethodType.methodType(void.class));
    }

    public static void main(String[] args) throws Throwable {
        MethodHandle run = tick();
        for (int i = 0; i < widgets.length; i++) {
            aj c = widgets[i] = new aj();
            c.n = -1; c.Kc = i; c.ob = i == 2 ? 4 : 8; c.ib = i * 22; c.C = 20; c.H = 20;
            c.Hb = i == 0 ? 2 : i; c.R = 15;
        }
        fk.ab = new aj[][]{ widgets }; rg.b = new boolean[]{true}; vk.db = 15;
        a.e = -91; ca.n = 127;
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String s; (s = in.readLine()) != null;) {
            int[] v = Arrays.stream(s.split(" ")).mapToInt(Integer::parseInt).toArray();
            if (v[0] >= -1) di.g = v[0] == -1 ? null : widgets[v[0]];
            if (v[1] >= -1) gh.C = v[1] == -1 ? null : widgets[v[1]];
            if (v[2] != -999) gh.A = v[2];
            jf.i = v[3]; sj.C = v[4]; pf.Q = 7;
            for (int i = 0; i < widgets.length; i++) widgets[i].vb = v[5] == i ? 100 : i;
            Arrays.fill(sf.m, false);
            String result = "ok";
            try { run.invokeExact(); }
            catch (RuntimeException e) {
                Throwable cause = e;
                while (cause instanceof g wrapped && wrapped.a != null) cause = wrapped.a;
                result = cause instanceof IndexOutOfBoundsException ? "bounds" : cause.getClass().getSimpleName();
            }
            int dirty = 0;
            for (int i = 0; i < widgets.length; i++) if (sf.m[i]) dirty |= 1 << i;
            System.out.println(result + " " + Arrays.asList(widgets).indexOf(di.g) + " " + Arrays.asList(widgets).indexOf(gh.C) + " " + gh.A + " " + jf.i + " " + dirty + " " + a.e + " " + ca.n);
        }
    }
}
