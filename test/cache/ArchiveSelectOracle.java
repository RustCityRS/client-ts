import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;
import java.util.zip.CRC32;
import jdk.internal.org.objectweb.asm.*;

public class ArchiveSelectOracle {
    static al archive;
    static db index;
    static Object[][] original, alternate;
    static Field files, packed;
    static byte[] payload = {77};
    static int event, change, action, group, file;
    static StringJoiner trace;

    // Sample the operand of each original archive array read, returning that
    // same reference even if the counterparty replaces the field.
    static void instrument(Path directory) throws Exception {
        try (var input = ArchiveSelectOracle.class.getResourceAsStream("/al.class")) {
            var reader = new ClassReader(input);
            var writer = new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String signature, String[] exceptions) {
                    MethodVisitor method = super.visitMethod(access, name, desc, signature, exceptions);
                    return new MethodVisitor(Opcodes.ASM8, method) {
                        public void visitFieldInsn(int opcode, String owner, String member, String type) {
                            super.visitFieldInsn(opcode, owner, member, type);
                            if (opcode != Opcodes.GETFIELD) return;
                            String callback = owner.equals("db") && member.equals("j") ? "capacities" :
                                    owner.equals("al") && member.equals("O") ? "files" :
                                    owner.equals("al") && member.equals("w") ? "packed" : null;
                            if (callback != null) super.visitMethodInsn(Opcodes.INVOKESTATIC, "ArchiveSelectOracle", callback, "(" + type + ")" + type, false);
                        }
                    };
                }
            }, 0);
            Files.write(directory.resolve("al.class"), writer.toByteArray());
        }
    }

    static Field field(String name) throws Exception {
        Field f = al.class.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static void observe(String label) {
        trace.add(label);
        if (++event != change) return;
        try {
            switch (action) {
                case 0 -> index.j = new int[0];
                case 1 -> index.j = null;
                case 2 -> files.set(archive, alternate);
                case 3 -> files.set(archive, null);
                case 4 -> files.set(archive, new Object[0][]);
                case 5 -> packed.set(archive, new Object[0]);
                case 6 -> packed.set(archive, null);
                case 7 -> throw new AssertionError("stop");
            }
        } catch (IllegalAccessException e) { throw new AssertionError(e); }
    }

    static int[] capacities(int[] previous) { observe("c"); return previous; }
    static Object[][] files(Object[][] previous) { observe("f"); return previous; }
    static Object[] packed(Object[] previous) { observe("p"); return previous; }

    static class Copier extends rb {
        void a(byte unused, byte[] value) {}
        byte[] b(byte unused) { observe("copy"); return payload; }
    }

    static class Provider extends ud {
        db b(int unused) { observe("index"); return index; }
        byte[] a(int mode, int id) { observe("load"+id); return null; }
        void b(int unused, int id) { throw new AssertionError("unexpected hint"); }
        int c(int id, int unused) { throw new AssertionError("unexpected percentage"); }
    }

    static String slot(Object[][] rows) {
        if (group < 0 || group >= rows.length) return "x";
        Object[] row = rows[group];
        if (row == null) return "-";
        if (file < 0 || file >= row.length) return "x";
        return row[file] == null ? "0" : row[file] instanceof Copier ? "c" : "b";
    }

    static String run(int op, int shape, int at, int to) throws Exception {
        event = 0; change = at; action = to; trace = new StringJoiner(",");
        int[] capacities = switch (shape) {
            case 0, 5 -> new int[]{3};
            case 3 -> new int[]{0,0,1};
            default -> new int[]{0,1,3};
        };
        group = shape == 0 || shape == 5 ? 0 : shape == 2 ? 2 : shape == 6 ? -1 : shape == 7 ? 99 : 1;
        file = shape == 0 || shape == 5 || shape == 2 ? 1 : 0;
        int id = capacities.length == 1 ? file : group;
        boolean check = shape != 5 && shape != 8;
        vc.J = shape == 7;
        index.j = capacities;
        index.e = capacities.length;
        original = new Object[capacities.length][];
        alternate = new Object[capacities.length][];
        for (int i = 0; i < capacities.length; i++) {
            original[i] = new Object[capacities[i]];
            alternate[i] = new Object[capacities[i]];
            Arrays.fill(original[i], new Copier());
            Arrays.fill(alternate[i], new byte[]{42});
        }
        if (shape == 4 || shape == 5 || shape == 8) Arrays.fill(original, null);
        archive = new al(new Provider(), true, true);
        field("x").set(archive, index);
        files.set(archive, original);
        packed.set(archive, new Object[capacities.length]);
        Object result;
        try {
            result = switch (op) {
                case 0 -> archive.a(-809612665, file, group);
                case 1 -> archive.a(check, group, file);
                case 2 -> archive.b((byte)109, group);
                case 3 -> archive.a(id, -100);
                case 4 -> archive.b(id, check);
                default -> archive.c(group,111);
            };
            if (result instanceof byte[] bytes) result = bytes[0] & 255;
        } catch (AssertionError stop) {
            if (!"stop".equals(stop.getMessage())) throw stop;
            result = "stop";
        } catch (RuntimeException ex) {
            Throwable cause = ex;
            while (cause instanceof g wrapped) cause = wrapped.a;
            result = cause instanceof NullPointerException ? "nullref" : cause instanceof ArrayIndexOutOfBoundsException ? "bounds" :
                cause instanceof IllegalArgumentException ? "argument" : "runtime";
        }
        return result + "/" + slot(original) + slot(alternate) + "/" + trace;
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) { instrument(Path.of(args[0])); return; }
        files = field("O"); packed = field("w");
        byte[] noGroups = {0,0,0,0,4,5,0,0,0};
        CRC32 crc = new CRC32(); crc.update(noGroups);
        index = new db(noGroups, (int)crc.getValue());
        try (var input = new BufferedReader(new InputStreamReader(System.in))) {
            for (String line; (line = input.readLine()) != null;) {
                int[] row = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
                System.out.println(run(row[0],row[1],row[2],row[3]));
            }
        }
    }
}
