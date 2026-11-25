import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import java.util.regex.Pattern;
import jdk.internal.org.objectweb.asm.*;

class WidgetSetterOracle {
    static final List<String> slots = List.of("Bc Ec m ub G M Bb Y h X C H ld jb hc Ac jc Sb Hc Q gb yc w md xc d nd hb db id vd e c Lc Zc Rb Qb Z dc U qc sc i".split(" "));
    static final Set<String> calls = Set.of("ed.a(Laj;I)V", "ik.a(ILaj;)V", "mi.a(ZLaj;I)V", "qg.a(BI)V",
        "re.a(II)V", "n.a(IB)V", "cf.a(IZ)V", "pd.a(II)V", "fl.a(II)V", "ti.d(II)V", "rg.a(II)Lkl;");
    static final Pattern report = Pattern.compile("CS2 - scr:-?[0-9]+ op:(-?[0-9]+)");
    static aj selected;
    static int boundary, target, mutation;
    static StringBuilder trace;

    // The VM still executes each actual field instruction. A test watchpoint fires
    // only after a successful load or store, and before an original callee executes.
    public static void observe(String token) throws Exception {
        trace.append(token);
        if (token.charAt(0) == '=') trace.append(':').append(ComponentOracle.hash(aj.class.getDeclaredField(token.substring(1)).get(selected)));
        trace.append(',');
        if (++boundary != target) return;
        switch (mutation) {
            case 1 -> throw new IllegalStateException("widget watchpoint");
            case 2 -> tg.B = new int[]{4,75,1,2};
            case 3 -> { selected.ld = 127; selected.C = -11; selected.jb = -4; selected.H = Integer.MAX_VALUE; }
            case 4 -> { selected.Bb = 0; selected.G = 0; }
            case 5 -> tg.B = new int[0];
        }
    }

    static void prepare(Path jar, Path dir) throws Exception {
        try (JarFile file = new JarFile(jar.toFile())) {
            ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry("gh.class")));
            ClassWriter sink = new ClassWriter(ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,sink) {
                public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
                    MethodVisitor method = super.visitMethod(access,name,descriptor,signature,exceptions);
                    if (!name.equals("a") || !descriptor.equals("(Lwf;II)V")) return method;
                    return new MethodVisitor(Opcodes.ASM8,method) {
                        void emit(String token) {
                            super.visitLdcInsn(token);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetSetterOracle","observe","(Ljava/lang/String;)V",false);
                        }
                        public void visitFieldInsn(int op,String owner,String field,String desc) {
                            super.visitFieldInsn(op,owner,field,desc);
                            if (owner.equals("aj") && (op == Opcodes.GETFIELD || op == Opcodes.PUTFIELD))
                                emit((op == Opcodes.PUTFIELD ? "=" : "?")+field);
                            else if (owner.equals("kl") && op == Opcodes.GETFIELD) emit("obj."+field);
                        }
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean iface) {
                            if (op == Opcodes.INVOKESTATIC && calls.contains(owner+"."+name+desc)) emit("!"+owner);
                            super.visitMethodInsn(op,owner,name,desc,iface);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("gh.class"),sink.toByteArray());
        }
    }

    static aj widget(int index,int layout) {
        aj c = new aj();
        c.Kc = index; c.bc = layout == 1 ? 7 : -1; c.ob = layout == 2 ? 0 : 4;
        c.R = 176; c.vb = index; c.ld = 100; c.C = 40; c.jb = 80; c.H = 30;
        if (layout == 3) { c.ld = Integer.MAX_VALUE; c.C = -15; c.jb = 2; c.H = 40; }
        c.Bb = layout == 1 ? 0 : 64; c.G = layout == 2 ? 0 : 32; c.Y = 45;
        c.jc = 90; c.Sb = 4; c.Hc = 7; c.Q = 9;
        c.gb = layout == 1 ? null : word("old"); return c;
    }
    static id word(String text) { return vb.a(text,(byte)54); }

    public static void main(String[]args) throws Exception {
        if (args.length != 0) { prepare(Path.of(args[0]),Path.of(args[1])); return; }
        hi.f = 765; fl.l = 503; vk.db = 176;
        kl obj = new kl(); obj.I = 4; obj.P = 200; obj.U = 321; obj.q = -51; obj.u = 67; obj.m = 189; obj.gb = 12345;
        fa.b.a(4L,obj,(byte)-71);
        var input = new BufferedReader(new InputStreamReader(System.in)); var output = System.out;
        int key = 79500;
        for (String line; (line = input.readLine()) != null;) {
            String[] parts = line.split(" ");
            int mode = Integer.parseInt(parts[0]), layout = Integer.parseInt(parts[1]);
            target = Integer.parseInt(parts[2]); mutation = Integer.parseInt(parts[3]);
            aj primary = widget(0,layout), secondary = widget(1,layout);
            selected = mode == 0 || mode == 4 ? primary : secondary;
            al.B = mode == 4 ? null : primary; ai.i = secondary;
            fk.ab = new aj[][]{{primary,mode == 3 ? null : secondary}}; rg.b = new boolean[]{true};
            tg.B = new int[24]; g.p = new id[12]; sf.m[0] = sf.m[1] = false;
            int len = parts.length-4;
            m code = new m(); code.D = new int[len]; code.F = new int[len]; code.B = new id[len];
            for (int i = 0; i < len; i++) {
                String[] instruction = parts[i+4].split(":",-1); code.D[i] = Integer.parseInt(instruction[0]);
                if (code.D[i] == 3) code.B[i] = instruction[1].equals("~") ? null : word(instruction[1]);
                else code.F[i] = Integer.parseInt(instruction[1]);
            }
            sf.g.a((long)key,0,code); wf event = new wf(); event.G = new Object[]{key++};
            boundary = 0; trace = new StringBuilder(); var log = new ByteArrayOutputStream();
            System.setOut(new PrintStream(log));
            try { gh.a(event,-22368,1200); } finally { System.setOut(output); }
            String msg = log.toString(), fault = "-"; var found = report.matcher(msg);
            if (found.find()) fault = found.group(1)+"/"+(msg.contains("widget watchpoint") ? "stop" :
                msg.contains("NullPointerException") ? "null" : msg.contains("IndexOutOfBoundsException") ? "bounds" :
                msg.contains("ArithmeticException") ? "divide" : "runtime");
            int hash = 1;
            for (String field : slots) hash = hash*31+ComponentOracle.hash(aj.class.getDeclaredField(field).get(selected));
            output.println(fault+";"+trace+";"+hash+";"+sf.m[0]+";"+sf.m[1]);
        }
    }
}
