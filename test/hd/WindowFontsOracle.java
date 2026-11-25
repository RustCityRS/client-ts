import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Runs the original hn.a, both font factories and all decoders. The ve.GetFile boundary supplies cache 8/13 bytes. */
public final class WindowFontsOracle {
    static final List<String> events = new ArrayList<>();
    static final List<Integer> groups = new ArrayList<>();
    static final byte[][][] contents = new byte[2][3][];
    static ve sprites, metrics;
    static String fault;
    static final int[][] counts = new int[2][3];

    public static byte[] read(ve archive, int group, int file) {
        int a = archive == sprites ? 0 : 1, g = groups.indexOf(group);
        if (g < 0 || a == 1 && archive != metrics) throw new AssertionError("archive read");
        String read = (a == 0 ? "s" : "m") + g + "." + ++counts[a][g];
        events.add(file == 0 ? read : read + "/" + file);
        if (file != 0) {
            if (g != 1 || file != 1) throw new AssertionError("p12 file selector");
            return fault.equals("p12-file1-supplied") ? contents[a][2].clone() : null;
        }
        if (fault.equals("miss-" + read)) return null;
        if (fault.equals("short-" + read)) return new byte[1];
        return contents[a][g].clone();
    }

    public static void stored(String slot) { events.add(slot); }

    static void instrument(String owner, Path directory) throws Exception {
        try (InputStream bytes = WindowFontsOracle.class.getResourceAsStream("/" + owner + ".class")) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String id, String desc, String sig, String[] ex) {
                    MethodVisitor mv = super.visitMethod(access, id, desc, sig, ex);
                    if (owner.equals("ve") && id.equals("a") && desc.equals("(IBI)[B")) {
                        mv.visitCode();
                        mv.visitVarInsn(Opcodes.ALOAD, 0);
                        mv.visitVarInsn(Opcodes.ILOAD, 1);
                        mv.visitVarInsn(Opcodes.ILOAD, 3);
                        mv.visitMethodInsn(Opcodes.INVOKESTATIC, "WindowFontsOracle", "read", "(Lve;II)[B", false);
                        mv.visitInsn(Opcodes.ARETURN);
                        mv.visitMaxs(3, 4);
                        mv.visitEnd();
                        return null;
                    }
                    if (!owner.equals("hn") || !id.equals("a") || !desc.equals("(Lve;ILve;)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitFieldInsn(int opcode, String cls, String name, String type) {
                            super.visitFieldInsn(opcode, cls, name, type);
                            if (opcode == Opcodes.PUTSTATIC && type.startsWith("L")) {
                                super.visitLdcInsn(cls + "." + name);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "WindowFontsOracle", "stored", "(Ljava/lang/String;)V", false);
                            }
                        }
                    };
                }
            }, 0);
            Files.write(directory.resolve(owner + ".class"), writer.toByteArray());
        }
    }

    static Object value(Class<?> owner, Object target, String name) throws Exception {
        Field field = owner.getDeclaredField(name);
        field.setAccessible(true);
        return field.get(target);
    }

    static void bytes(DataOutputStream out, byte[] bytes) throws IOException {
        out.writeInt(bytes == null ? -1 : bytes.length);
        if (bytes != null) out.write(bytes);
    }

    static String glyphs(rk font) throws Exception {
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        try (var out = new DataOutputStream(new DigestOutputStream(OutputStream.nullOutputStream(), sha))) {
            for (String name : new String[]{"ab","V","J"}) out.writeInt((int)value(rk.class, font, name));
            for (String name : new String[]{"jb","S","db","I","U"}) {
                int[] array = (int[])value(rk.class, font, name);
                out.writeInt(array == null ? -1 : array.length);
                if (array != null) for (int entry : array) out.writeInt(entry);
            }
            bytes(out, (byte[])value(rk.class, font, "gb"));
            if (font instanceof dd soft) {
                byte[][] masks = (byte[][])value(dd.class, soft, "Eb");
                out.writeInt(masks.length);
                for (byte[] mask : masks) bytes(out, mask);
            }
        }
        return HexFormat.of().formatHex(sha.digest());
    }

    static void compare(boolean active, String scenario, GlRecorder recorder) throws Exception {
        fault = scenario;
        for (int[] a : counts) Arrays.fill(a, 0);
        events.clear();
        tf.w = active;
        tf.t = scenario.equals("null-gl") ? null : recorder.gl();
        dd[] old = new dd[4];
        for (int i = 0; i < old.length; i++) old[i] = new dd(new byte[257]);
        j.x = old[0]; vj.j = old[1]; rh.h = old[2]; wl.q = old[3];
        String result = "ok";
        try {
            hn.a(scenario.equals("null-metrics") ? null : metrics, scenario.startsWith("p12-file1") ? 1 : 0,
                scenario.equals("null-sprites") ? null : sprites);
        } catch (RuntimeException error) {
            Throwable cause = error;
            while (cause instanceof ld wrapped) cause = wrapped.f;
            result = cause.getClass().getSimpleName();
        }
        var ids = new IdentityHashMap<rk, String>();
        for (int i = 0; i < old.length; i++) ids.put(old[i], "old" + i);
        List<String> state = new ArrayList<>();
        for (rk font : new rk[]{j.x, vj.j, rh.h, wl.q}) {
            if (font == null) state.add("null");
            else {
                if (!ids.containsKey(font)) ids.put(font, state.size() + ":" + font.getClass().getName() + ":" + glyphs(font));
                state.add(ids.get(font));
            }
        }
        System.out.println((active ? "gl" : "sd") + "|" + scenario + "|" + result + "|"
            + String.join(",", events) + "|" + String.join(",", state));
    }

    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args[1]);
        if (args[0].equals("instrument")) {
            instrument("ve", dir);
            instrument("hn", dir);
            return;
        }
        for (int group : new int[]{Integer.parseInt(args[3]), Integer.parseInt(args[4]), Integer.parseInt(args[5])}) {
            int slot = groups.size();
            groups.add(group);
            contents[0][slot] = Files.readAllBytes(dir.resolve(group + ".glyphs"));
            contents[1][slot] = Files.readAllBytes(dir.resolve(group + ".metrics"));
        }
        sprites = new ve(null, false, false);
        metrics = new ve(null, false, false);
        nc.h = groups.get(0); kc.t = groups.get(1); fm.V = groups.get(2);
        try (GlRecorder recorder = new GlRecorder(null)) {
            recorder.loadProfile(Path.of(args[2]));
            for (boolean active : new boolean[]{false, true}) {
                for (int i = 6; i < args.length; i++) compare(active, args[i], recorder);
            }
        }
    }
}
