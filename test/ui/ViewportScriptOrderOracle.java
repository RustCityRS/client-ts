import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

/** Observe each viewport field access in the original CS2 dispatcher. All six opcode
 * bodies, integer array operations and the viewport calculation run in the gamepack. */
public final class ViewportScriptOrderOracle {
    static final String[] sd = {"ja.Z","lg.G","ib.db","gi.m","ae.j","ri.V","od.N","ae.b","rk.i","sb.g","tg.B","bh.l","aj.C","aj.H"};
    static final String[] hd = {"od.g","an.db","vg.b","pb.rb","mc.tb","ac.k","ee.f","kd.yb","nc.n","tm.i","uj.t","wl.h","be.n","be.R"};
    static final String[] labels = {"fov","fov2","zoom","zoom2","min1","max1","min2","max2","width","height","stack","component","widgetW","widgetH"};
    static final List<String> events = new ArrayList<>();
    static String[] names;
    static boolean gl;
    static int stop, nextId = 98100;
    static String failure;

    public static void event(String access) {
        events.add(access);
        if (stop == events.size()) throw new IllegalStateException("probe");
    }
    public static void report(String text, Throwable t, byte guard) { report(t, text, guard); }
    public static void report(Throwable t, String text, int guard) {
        if (t instanceof NullPointerException) failure = "null";
        else if (t instanceof ArrayIndexOutOfBoundsException) failure = "bounds:" + t.getMessage().split(" ")[1];
        else if ("probe".equals(t.getMessage())) failure = "probe";
        else throw new AssertionError(text, t);
    }

    static void patch(String jar, Path dir) throws Exception {
        String owner = gl ? "h" : "gh";
        try (JarFile pack = new JarFile(jar)) {
            ClassReader reader = new ClassReader(pack.getInputStream(pack.getJarEntry(owner + ".class")));
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int flags, String name, String desc, String sig, String[] ex) {
                    MethodVisitor base = super.visitMethod(flags,name,desc,sig,ex);
                    if (!name.equals("a") || !desc.equals(gl ? "(BILjl;)V" : "(Lwf;II)V")) return base;
                    return new MethodVisitor(Opcodes.ASM8, base) {
                        boolean inViewport, lastOpcode, lastField;
                        void observe(String tag) {
                            super.visitLdcInsn(tag);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "ViewportScriptOrderOracle", "event", "(Ljava/lang/String;)V", false);
                        }
                        public void visitIntInsn(int op, int value) {
                            super.visitIntInsn(op, value);
                            if (op == Opcodes.SIPUSH && value == 6200) inViewport = true;
                            if (op == Opcodes.SIPUSH && value == 6205) lastOpcode = true;
                        }
                        public void visitFieldInsn(int op, String o, String n, String d) {
                            int index = Arrays.asList(names).indexOf(o + "." + n);
                            if (inViewport && index >= 0 && op != Opcodes.GETFIELD) observe((op == Opcodes.PUTSTATIC ? "w:" : "r:") + labels[index]);
                            super.visitFieldInsn(op, o, n, d);
                            // A null component fails at GETFIELD before a value can be observed.
                            if (inViewport && index >= 0 && op == Opcodes.GETFIELD) observe("r:" + labels[index]);
                            if (lastOpcode && index == 1) lastField = true;
                        }
                        public void visitInsn(int op) {
                            super.visitInsn(op);
                            if (lastField && op == Opcodes.IASTORE) inViewport = false;
                        }
                        public void visitMethodInsn(int op, String o, String n, String d, boolean itf) {
                            if (inViewport && o.equals(gl ? "ja" : "bi") && n.equals("a") && d.equals(gl ? "(IIIIIZ)V" : "(IIIIZI)V")) observe("calc");
                            if ((o + "." + n).equals(gl ? "ha.a" : "pk.a") && d.equals(gl ? "(Ljava/lang/String;Ljava/lang/Throwable;B)V" : "(Ljava/lang/Throwable;Ljava/lang/String;I)V"))
                                super.visitMethodInsn(op,"ViewportScriptOrderOracle","report",d,false);
                            else super.visitMethodInsn(op,o,n,d,itf);
                        }
                    };
                }
            }, 0);
            Files.write(dir.resolve(owner + ".class"), writer.toByteArray());
        }
    }
    static Field field(String name) throws Exception {
        String[] pair = name.split("\\.");
        Field f = Class.forName(pair[0]).getDeclaredField(pair[1]);
        f.setAccessible(true);
        return f;
    }
    static Object create(String name) throws Exception {
        Constructor<?> ctor = Class.forName(name).getDeclaredConstructor();
        ctor.setAccessible(true);
        return ctor.newInstance();
    }
    static Method method(Class<?> owner, Class<?>... types) throws Exception {
        Method m = owner.getDeclaredMethod("a", types);
        m.setAccessible(true);
        return m;
    }
    static int run(int op, int mode, int fail) throws Exception {
        int[] args = switch(mode) {
            case 0 -> new int[]{89,9,63,5};
            case 1 -> new int[]{-1,32768,65536,65535};
            default -> new int[]{15,74,19,51};
        };
        int count = op < 6202 ? 2 : op == 6202 ? 4 : 0;
        if (mode == 3 && count > 0) count--;
        int[] stack = new int[op >= 6203 && mode >= 3 && mode <= 4 ? mode - 3 : 8];
        Arrays.fill(stack, -595);
        field(names[10]).set(null, stack);
        for (int i=0; i<10; i++) {
            Field f = field(names[i]);
            if (i < 8) f.setShort(null, (short)(39+i)); else f.setInt(null, 39+i);
        }
        Object component = create(gl ? "be" : "aj");
        field(names[12]).setInt(component, 637);
        field(names[13]).setInt(component, -9);
        field(names[11]).set(null, mode == 5 ? null : component);
        Object script = create(gl ? "qc" : "m");
        int[] ops = new int[count+2], operands = new int[count+2];
        System.arraycopy(args, 0, operands, 0, count);
        ops[count] = op; ops[count+1] = 21;
        field(gl ? "qc.O" : "m.D").set(script, ops);
        field(gl ? "qc.W" : "m.F").set(script, operands);
        field(gl ? "qc.T" : "m.B").set(script, Array.newInstance(Class.forName(gl ? "na" : "id"), ops.length));
        Object cache = field(gl ? "ib.d" : "sf.g").get(null), hook = create(gl ? "jl" : "wf");
        int id = nextId++;
        field(gl ? "jl.E" : "wf.G").set(hook, new Object[]{id});
        if (gl) method(cache.getClass(), Class.forName("rg"), long.class, byte.class).invoke(cache, script, (long)id, (byte)-87);
        else method(cache.getClass(), long.class, int.class, Class.forName("ei")).invoke(cache, (long)id, 0, script);
        stop = fail; failure = "-"; events.clear();
        if (gl) method(Class.forName("h"), byte.class, int.class, hook.getClass()).invoke(null, (byte)-12, 200, hook);
        else method(Class.forName("gh"), hook.getClass(), int.class, int.class).invoke(null, hook, -22368, 200);
        StringJoiner values = new StringJoiner(",");
        for (int i=0; i<10; i++) values.add(String.valueOf(field(names[i]).get(null)));
        System.out.println(op + "," + mode + "," + fail + "|" + String.join(",", events) + "|" + failure + "|" + values + "|" + Arrays.toString(stack));
        return events.size();
    }
    public static void main(String[] args) throws Exception {
        gl = args[0].equals("gl"); names = gl ? hd : sd;
        if (args.length > 1) { patch(args[1], Path.of(args[2])); return; }
        for (int op=6200; op<=6205; op++) for (int mode=0; mode<6; mode++) {
            int length = run(op, mode, 0);
            for (int point=1; point<=length; point++) run(op, mode, point);
        }
    }
}
