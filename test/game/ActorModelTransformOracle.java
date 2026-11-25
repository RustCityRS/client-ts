import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// Keep all branches, field accesses, arithmetic and local variables in ob.a.
// Observe only its calls out to the model and the terrain height service.
public class ActorModelTransformOracle {
    static void instrument(String jar, Path dir) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry("ob.class")));
            ClassWriter writer = new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int flags, String name, String desc, String sig, String[] ex) {
                    MethodVisitor mv = super.visitMethod(flags, name, desc, sig, ex);
                    if (!name.equals("a") || !(desc.equals("(BLnd;)V") || desc.equals("(ILnd;Z)V"))) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitMethodInsn(int op, String owner, String method, String signature, boolean iface) {
                            if (owner.equals("nd") && op == Opcodes.INVOKEVIRTUAL) {
                                String probe = switch (method + signature) {
                                    case "a(I)V" -> "roll";
                                    case "b(I)V" -> "pitch";
                                    case "b()I" -> "minY";
                                    case "b(III)V" -> "translate";
                                    default -> throw new AssertionError(method + signature);
                                };
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "ActorModelTransformOracle", probe, "(Lnd;" + signature.substring(1), false);
                            } else if (owner.equals("ml") && method.equals("a") && signature.equals("(IIIB)I")) {
                                super.visitMethodInsn(op, "ActorModelTransformOracle", "height", signature, false);
                            } else super.visitMethodInsn(op, owner, method, signature, iface);
                        }
                    };
                }
            }, 0);
            Files.write(dir.resolve("ob.class"), writer.toByteArray());
        }
    }
    static final String[] names = {"zb", "I", "X", "cc", "rb", "s", "Eb", "Pb", "db", "Tb"};
    static final Field[] fields = new Field[names.length];
    static final int[] angles = dc.l, cosines = dc.g;
    static ob actor;
    static mg bas;
    static int mode, ordinal, minYValue, modelCalls;
    static StringJoiner trace;
    static void event(nd model, String value) {
        Objects.requireNonNull(model);
        trace.add(value);
        modelCalls++;
        if (mode >= 20 && modelCalls == mode-19) throw new IllegalStateException();
        if (mode == 12) {
            actor.H += 76; bas.O = 36;
            if (modelCalls == 1) minYValue ^= -126;
        }
    }
    static int minY(nd model) { int value = minYValue; event(model, "m" + value); return value; }
    static void roll(nd model, int value) { event(model, "z" + value); }
    static void pitch(nd model, int value) { event(model, "x" + value); }
    static void translate(nd model, int x, int y, int z) { event(model, "y" + x + "," + y + "," + z); }
    static int height(int level, int x, int z, byte guard) {
        trace.add("h" + level + "," + x + "," + z);
        int corner = ordinal++ & 3;
        if (mode == 1) { ah.f++; actor.Z += 19; actor.S -= 393; }
        if (mode >= 2 && mode <= 5 && corner == mode-2) throw new IllegalStateException();
        if (mode == 6) return new int[]{0x7fffffff, 0x40000100, 0x70000000, -0x7fffffff}[corner];
        if (mode == 7) return 0;
        if (mode == 8) return ml.a(level, x, z, guard);
        return (x * 17 - z * 111 + (x ^ z) * 45 + level * 9231) >> 3;
    }
    static String state() throws Exception {
        StringJoiner result = new StringJoiner(",");
        for (Field f : fields) result.add(String.valueOf(f.get(actor)));
        return result + "," + tj.b + "," + ug.a + "," + ph.l;
    }
    static void run(int[] a) throws Exception {
        actor = new pb(); bas = tb.o = new mg();
        mode = a[2]; minYValue = a[7]; ordinal = modelCalls = 0; trace = new StringJoiner(";");
        ah.f = 1; tj.b = 38; ug.a = -7; ph.l = 935;
        dc.l = angles; dc.g = cosines;
        switch (mode) {
            case 9 -> dc.g = new int[0];
            case 10 -> dc.l = null;
            case 13 -> tb.o = null;
        }
        bas.w = a[4]; bas.j = a[5]; actor.H = a[6]; actor.Z = a[8]; actor.S = a[9];
        actor.Mb = a[10] != 0; actor.wb = a[11]; bas.l = a[12]; bas.x = a[13];
        bas.E = a[14]; bas.O = a[15]; bas.d = a[16]; bas.s = a[17];
        for (int i=0; i<fields.length; i++) {
            if (fields[i].getType() == boolean.class) fields[i].setBoolean(actor, a[18+i] != 0);
            else fields[i].setInt(actor, a[18+i]);
        }
        nd model = mode == 11 ? null : new fc();
        String result = "ok";
        try {
            for (int i=0; i<a[1]; i++) {
                if (i == 5 || i == 11) actor.wb = -actor.wb;
                if (i == 17) actor.Mb = false;
                if (a[0] == 0) actor.a((byte)-118, model);
                else actor.a(a[3], model, true);
                trace.add("c" + state());
            }
        } catch (RuntimeException e) {
            Throwable t = e; while (t instanceof g wrapped) t = wrapped.a;
            if (t instanceof NullPointerException) result = "null";
            else if (t instanceof ArrayIndexOutOfBoundsException) result = "bounds";
            else if (t instanceof ArithmeticException) result = "div";
            else if (t instanceof IllegalStateException) result = "probe";
            else throw e;
        }
        System.out.println(result + "|" + state() + "|" + trace);
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 0) { instrument(args[0], Path.of(args[1])); return; }
        for (int i=0; i<names.length; i++) { fields[i] = ob.class.getDeclaredField(names[i]); fields[i].setAccessible(true); }
        ve.q = new int[4][105][105]; tb.t = new byte[4][104][104];
        for (int p=0; p<4; p++) for (int x=0; x<105; x++) for (int z=0; z<105; z++) {
            ve.q[p][x][z] = p*31917 - x*117 + z*x*73;
            if (x<104 && z<104) tb.t[p][x][z] = (byte)(x ^ z);
        }
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = reader.readLine()) != null;) run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
