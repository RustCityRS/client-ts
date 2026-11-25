import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import jdk.internal.org.objectweb.asm.*;

class WidgetQueryOracle {
    static final String[] integers = "ib Mb C H n hc Ac ld jb vd nd id d S db hb mb bc yc xc".split(" ");
    static final Set<String> observed = Set.of("ib","gb","yc","xc","Yc","r","pb");
    static final Pattern report = Pattern.compile("CS2 - scr:-?[0-9]+ op:(-?[0-9]+)");
    static aj selected;
    static int[] secondInts;
    static id[] secondStrings;
    static nc secondProperties;
    static int targetRead, mutation, reads;
    static StringBuilder fields;

    // The original GETFIELD completes (and may fault) before this observer. Its
    // returned value remains on the JVM operand stack while the backing field changes.
    public static void fieldRead(String field) {
        fields.append(field).append('.');
        if (++reads != targetRead) return;
        switch (mutation) {
            case 1 -> tg.B = secondInts;
            case 2 -> g.p = secondStrings;
            case 3 -> { selected.Yc = null; selected.r = null; selected.pb = null; selected.xc = 419; }
            case 4 -> { selected.Yc = new id[0]; selected.r = word("changed"); selected.pb = new aj[0]; }
            case 5 -> { selected.Yc = new id[]{word("other"), null}; selected.pb = new aj[]{null, selected}; }
            case 6 -> tg.B = null;
            case 7 -> g.p = null;
            case 8 -> fd.W = secondProperties;
            case 9 -> fd.W = null;
            case 10 -> { selected.Kc = 25; selected.bc = -7; }
            case 11 -> selected.Sc = null;
        }
    }

    static void prepare(Path jar, Path dir) throws Exception {
        try (JarFile file = new JarFile(jar.toFile())) {
            for (String unit : List.of("gh","client")) prepareClass(file,unit,dir);
        }
    }

    static void prepareClass(JarFile file, String unit, Path dir) throws Exception {
            boolean active = unit.equals("client");
            ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry(unit+".class")));
            ClassWriter output = new ClassWriter(ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, output) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] errors) {
                    MethodVisitor mv = super.visitMethod(access, name, desc, sig, errors);
                    if (!name.equals("a") || !desc.equals(active ? "(Laj;)Ll;" : "(Lwf;II)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitFieldInsn(int op, String owner, String name, String desc) {
                            super.visitFieldInsn(op,owner,name,desc);
                            boolean watch = active ?
                                op == Opcodes.GETSTATIC && owner.equals("fd") && name.equals("W") ||
                                op == Opcodes.GETFIELD && owner.equals("aj") && Set.of("Kc","bc","Sc").contains(name) :
                                op == Opcodes.GETFIELD && (owner.equals("aj") && observed.contains(name) || owner.equals("qd") && name.equals("v"));
                            if (watch) {
                                super.visitLdcInsn(name);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetQueryOracle","fieldRead","(Ljava/lang/String;)V",false);
                            }
                        }
                    };
                }
            }, 0);
            Files.write(dir.resolve(unit+".class"),output.toByteArray());
    }

    static id word(String value) { return vb.a(value, (byte)54); }
    static String format(id[] value) {
        if (value == null) return "~";
        return Arrays.stream(value).map(s -> s == null ? "~" : HexFormat.of().formatHex(s.A, 0, s.c)).collect(Collectors.joining(","));
    }
    static aj widget(int base, int layout) throws Exception {
        aj c = new aj();
        for (int i = 0; i < integers.length; i++) aj.class.getDeclaredField(integers[i]).setInt(c, base + i);
        c.Wc = base > 100; c.gb = word("text" + base); c.Sc = new l(base << 11, -1);
        c.Kc = base == 100 ? Integer.MIN_VALUE : Integer.MAX_VALUE;
        if (layout == 10) c.bc = Integer.MIN_VALUE;
        c.r = layout == 1 ? null : word("base" + base);
        c.Yc = layout == 1 ? null : layout == 3 ? new id[0] : new id[]{layout == 2 ? null : word("first" + base), word("second" + base)};
        c.pb = layout == 1 ? null : layout == 3 ? new aj[0] : new aj[]{c, c, layout == 2 ? null : c};
        if (layout == 1) c.yc = -1;
        return c;
    }

    public static void main(String[]args) throws Exception {
        if (args.length != 0) { prepare(Path.of(args[0]),Path.of(args[1])); return; }
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        PrintStream output = System.out;
        int key = 79500;
        for (String line; (line = input.readLine()) != null;) {
            int[] row = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int op = row[0], mode = row[1], layout = row[2], n = row.length - 7;
            targetRead = row[3]; mutation = row[4]; reads = 0; fields = new StringBuilder();
            aj primary = widget(100, layout), secondary = widget(200, layout);
            selected = op >= 2000 || mode != 1 ? primary : secondary;
            al.B = layout == 4 ? null : primary; ai.i = layout == 4 ? null : secondary;
            fk.ab = new aj[][]{{al.B, ai.i}}; rg.b = new boolean[]{true};
            va.Z = new nc(8); qd sub = new qd(); sub.v = 77;
            if (layout == 3) va.Z = null;
            else if (layout != 1) va.Z.a((byte)-89, layout == 5 ? new jf() : sub, 0L);
            fd.W = new nc(8); secondProperties = new nc(8);
            long componentKey = ((long)selected.Kc << 32) + selected.bc;
            secondProperties.a((byte)-89,new l(30 << 11,-1),componentKey);
            fd.W.a((byte)-89,new l(31 << 11,-1),(25L << 32)-7);
            if (layout == 6 || layout == 10) fd.W.a((byte)-89,new l(32 << 11,-1),componentKey);
            else if (layout == 7) selected.Sc = null;
            else if (layout == 8) fd.W = null;
            else if (layout == 9) fd.W.a((byte)-89,new jf(),componentKey);
            int[] firstInts = row[5] < 0 ? null : new int[row[5]];
            if (firstInts != null) Arrays.fill(firstInts, -111);
            secondInts = new int[]{-222,-222,-222,-222}; tg.B = firstInts;
            id[] firstStrings = row[6] < 0 ? null : new id[row[6]];
            if (firstStrings != null) Arrays.fill(firstStrings,word("a"));
            secondStrings = new id[]{word("b"),word("b")}; g.p = firstStrings;
            m code = new m(); code.D = new int[n+3]; code.F = new int[n+3]; code.B = new id[n+3];
            System.arraycopy(row,7,code.F,0,n);
            code.D[n] = op; code.F[n] = mode; code.F[n+1] = -72; code.D[n+2] = 21;
            sf.g.a((long)key,0,code); wf event = new wf(); event.G = new Object[]{key++};
            ByteArrayOutputStream log = new ByteArrayOutputStream();
            System.setOut(new PrintStream(log));
            try { gh.a(event,-22368,1200); } finally { System.setOut(output); }
            String message = log.toString(), fault = "-";
            var match = report.matcher(message);
            if (match.find()) fault = match.group(1) + "/" + (message.contains("IndexOutOfBoundsException") ? "bounds" :
                message.contains("NullPointerException") ? "null" : message.contains("ClassCastException") ? "cast" :
                message.contains("IllegalStateException") ? "illegal" : "runtime");
            output.println(String.join(";",fault,fields.toString(),Arrays.toString(firstInts),Arrays.toString(secondInts),
                format(firstStrings),format(secondStrings),tg.B == null ? "N" : tg.B == firstInts ? "A" : "B", g.p == null ? "N" : g.p == firstStrings ? "A" : "B"));
        }
    }
}
