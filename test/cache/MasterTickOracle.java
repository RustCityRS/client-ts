import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

public class MasterTickOracle {
    static wi master;
    static Field providers;
    static mc[] original, alternate, empty, single, entries;
    static int change, action, event;
    static StringJoiner trace;
    static class Stop extends Error {}

    // Observe reads of wi.j after GETFIELD and the real provider methods on
    // entry. Keep the captured operand on the stack across each callback.
    static void instrument(Path directory, String owner) throws Exception {
        try (InputStream source = MasterTickOracle.class.getResourceAsStream("/" + owner + ".class")) {
            ClassReader reader = new ClassReader(source);
            ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String signature, String[] exceptions) {
                    MethodVisitor method = super.visitMethod(access, name, desc, signature, exceptions);
                    if (owner.equals("wi") && name.equals("a") && desc.equals("(Z)V")) {
                        return new MethodVisitor(Opcodes.ASM8, method) {
                            public void visitFieldInsn(int opcode, String clazz, String field, String type) {
                                super.visitFieldInsn(opcode, clazz, field, type);
                                if (opcode == Opcodes.GETFIELD && clazz.equals("wi") && field.equals("j")) {
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC, "MasterTickOracle", "read", "([Lmc;)[Lmc;", false);
                                }
                            }
                        };
                    }
                    if (owner.equals("mc") && (name.equals("d") && desc.equals("(B)V") || name.equals("g") && desc.equals("(I)V"))) {
                        return new MethodVisitor(Opcodes.ASM8, method) {
                            public void visitCode() {
                                super.visitCode();
                                super.visitVarInsn(Opcodes.ALOAD, 0);
                                super.visitLdcInsn(name);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "MasterTickOracle", "entered", "(Lmc;Ljava/lang/String;)V", false);
                            }
                        };
                    }
                    return method;
                }
            }, 0);
            Files.write(directory.resolve(owner + ".class"), writer.toByteArray());
        }
    }

    static String table(mc[] array) {
        if (array == null) return "-";
        if (array == original) return "a";
        if (array == alternate) return "b";
        return array == empty ? "e" : "s";
    }

    static void observe(String entry) throws Exception {
        trace.add(entry);
        if (++event != change) return;
        switch (action) {
            case 0 -> providers.set(master, alternate);
            case 1 -> providers.set(master, null);
            case 2 -> providers.set(master, empty);
            case 3 -> providers.set(master, single);
            case 4 -> Arrays.fill(original, null);
            case 5 -> Arrays.fill(original, entries[3]);
            case 6 -> throw new Stop();
        }
    }

    static mc[] read(mc[] captured) throws Exception {
        observe("r" + table(captured));
        return captured;
    }

    static void entered(mc provider, String name) throws Exception {
        observe(name + Arrays.asList(entries).indexOf(provider));
    }

    static void run(int shape, int at, int changeTo) throws Exception {
        change = at;
        action = changeTo;
        event = 0;
        trace = new StringJoiner(",");
        original = new mc[]{entries[0], null, entries[1], entries[0]};
        alternate = new mc[]{null, entries[2], entries[3], null, entries[2]};
        single = new mc[]{entries[3]};
        empty = new mc[0];
        providers.set(master, shape == 0 ? original : shape == 1 ? null : shape == 2 ? empty : single);
        String status = "ok";
        try {
            master.a(true);
        } catch (Stop stop) {
            status = "stop";
        } catch (RuntimeException e) {
            Throwable cause = e;
            while (cause instanceof g wrapped) cause = wrapped.a;
            if (cause instanceof NullPointerException) status = "null";
            else if (cause instanceof ArrayIndexOutOfBoundsException) status = "bounds";
            else throw e;
        }
        System.out.println(status + "/" + table((mc[]) providers.get(master)) + "/" + trace);
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0) {
            instrument(Path.of(args[0]), "wi");
            instrument(Path.of(args[0]), "mc");
            return;
        }
        providers = wi.class.getDeclaredField("j");
        providers.setAccessible(true);
        ej net = new ej();
        master = new wi(net, null);
        entries = new mc[4];
        for (int i = 0; i < entries.length; i++) entries[i] = new mc(i, null, null, net, null, 0, 0, false);
        var input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            int[] v = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            run(v[0], v[1], v[2]);
        }
    }
}
