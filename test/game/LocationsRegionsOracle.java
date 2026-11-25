import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// Observe the unmodified 530 decoders' packet reads. Substitute only the two
// external services that would otherwise need the live definition cache/scene.
public class LocationsRegionsOracle {
    static void instrument(String jar, Path output) throws Exception {
        try (JarFile archive = new JarFile(jar)) {
            for (String owner : new String[]{"hi", "ck"}) {
                ClassReader reader = new ClassReader(archive.getInputStream(archive.getJarEntry(owner + ".class")));
                ClassWriter writer = new ClassWriter(0);
                String descriptor = owner.equals("hi") ? "(BI[Lke;[BIZ)V" : "(II[Lke;BII[BIZII)V";
                reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                    public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] exceptions) {
                        MethodVisitor mv = super.visitMethod(access, name, desc, sig, exceptions);
                        if (!name.equals("a") || !desc.equals(descriptor)) return mv;
                        return new MethodVisitor(Opcodes.ASM8, mv) {
                            public void visitMethodInsn(int op, String target, String method, String signature, boolean iface) {
                                if (op == Opcodes.INVOKEVIRTUAL && target.equals("gd")) {
                                    String probe = switch (method + signature) {
                                        case "o(B)I" -> "readId";
                                        case "g(I)I" -> "readPosition";
                                        case "f(B)I" -> "readInfo";
                                        default -> throw new AssertionError(method + signature);
                                    };
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC, "LocationsRegionsOracle", probe, "(Lgd;" + signature.substring(1), false);
                                } else if (op == Opcodes.INVOKESTATIC && target.equals("ke") && method.equals("a") && signature.equals("(II)Ljb;")) {
                                    super.visitMethodInsn(op, "LocationsRegionsOracle", "locType", signature, false);
                                } else if (op == Opcodes.INVOKESTATIC && target.equals("nc") && method.equals("a") && signature.equals("(ZIIIIIIIZLke;I)V")) {
                                    super.visitMethodInsn(op, "LocationsRegionsOracle", "place", signature, false);
                                } else super.visitMethodInsn(op, target, method, signature, iface);
                            }
                        };
                    }
                }, 0);
                Files.write(output.resolve(owner + ".class"), writer.toByteArray());
            }
        }
    }

    static gd packet;
    static int mode;
    static StringJoiner events;
    static final ke[] originals = {new ke(2, 2), new ke(2, 2), new ke(2, 2), new ke(2, 2)};
    static ke[] maps;
    static byte[] input;

    static int trace(String tag, int from, int value) {
        events.add(tag + from + ":" + packet.yb + "=" + value);
        return value;
    }
    public static int readId(gd p, byte arg) {
        packet = p;
        return trace("i", p.yb, p.o(arg));
    }
    public static int readPosition(gd p, int arg) {
        packet = p;
        return trace("p", p.yb, p.g(arg));
    }
    public static int readInfo(gd p, byte arg) {
        packet = p;
        return trace("s", p.yb, p.f(arg));
    }
    public static jb locType(int guard, int id) {
        if (guard != 11525) throw new AssertionError("ke.a guard " + guard);
        events.add("t" + packet.yb + "=" + id);
        if (mode == 13) throw new IllegalStateException();
        if (mode == 14) return null;
        if (mode == 15) tb.t = null;
        jb type = new jb();
        type.y = 1 + (id & 3);
        type.fb = 1 + ((id >>> 2) & 3);
        if (mode == 16) { type.y = Integer.MIN_VALUE; type.fb = Integer.MAX_VALUE; }
        return type;
    }
    public static void place(boolean underwater, int level, int id, int heightLevel, int angle, int shape,
                             int x, int z, boolean surface, ke collision, int guard) {
        if (guard != 2) throw new AssertionError("nc.a guard " + guard);
        int index = collision == null ? -1 : Arrays.asList(originals).indexOf(collision);
        events.add("l" + packet.yb + "=" + (underwater ? 1 : 0) + "," + level + "," + id + "," +
            heightLevel + "," + angle + "," + shape + "," + x + "," + z + "," + (surface ? 1 : 0) + "," + index);
        if (mode == 17) throw new IllegalStateException();
        if (mode == 18) tb.t = null;
        if (mode == 19) Arrays.fill(maps, null);
        if (mode == 20 && packet.yb < input.length) input[packet.yb] = 0;
    }

    // One row per case. flags are patterned across both axes, and across
    // planes, so reading the packed source tile/plane can change map identity.
    static void run(String line) {
        String[] v = line.split(" ");
        int[] a = Arrays.stream(v, 0, 10).mapToInt(Integer::parseInt).toArray();
        mode = a[9];
        input = v[10].equals("N") ? null : v[10].equals("_") ? new byte[0] : HexFormat.of().parseHex(v[10]);
        packet = null;
        maps = originals.clone();
        events = new StringJoiner(";");
        tb.t = new byte[4][104][104];
        for (int plane=0; plane<4; plane++) for (int x=0; x<104; x++) for (int z=0; z<104; z++)
            tb.t[plane][x][z] = (byte)((x * 3 + z * 17 + plane * 7) & 255);
        switch (mode) {
            case 1 -> { for (byte[] row : tb.t[1]) Arrays.fill(row, (byte)2); }
            case 2 -> { for (byte[] row : tb.t[1]) Arrays.fill(row, (byte)1); }
            case 3 -> tb.t = null;
            case 4 -> tb.t = new byte[1][][];
            case 5 -> tb.t[1] = null;
            case 6 -> tb.t[1] = new byte[1][];
            case 7 -> Arrays.fill(tb.t[1], null);
            case 8 -> Arrays.fill(tb.t[1], new byte[1]);
            case 9 -> maps = null;
            case 10 -> maps = new ke[0];
            case 11 -> maps = new ke[]{originals[0]};
            case 12 -> maps[2] = null;
        }
        String result = "ok";
        try {
            if (a[0] == 0) hi.a((byte)-120, a[1], maps, input, a[2], a[8] != 0);
            else ck.a(a[1], a[3], maps, (byte)-100, a[7], a[5], input, a[2], a[8] != 0, a[6], a[4]);
        } catch (RuntimeException e) {
            Throwable t = e;
            while (t instanceof g wrapped) t = wrapped.a;
            if (t instanceof NullPointerException) result = "null";
            else if (t instanceof ArrayIndexOutOfBoundsException) result = "bounds" + t.getMessage().split(" ")[1];
            else if (t instanceof IllegalStateException) result = "probe";
            else throw e;
        }
        System.out.println(result + "|" + (packet == null ? -1 : packet.yb) + "|" + events);
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 0) { instrument(args[0], Path.of(args[1])); return; }
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) run(line);
    }
}
