import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.StringJoiner;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Drives the original HD marker callers and their real cache-hit mask, sprites and rasterizers.
public final class HdMinimapMarkersOracle {
    private static final int WIDTH = 96, HEIGHT = 88;
    private static StringJoiner reads;
    private static int zoomReads;
    private static boolean zeroSecondDivisor;

    static void read(String field) {
        reads.add(field);
        if (field.equals("zoom") && ++zoomReads == 2 && zeroSecondDivisor) we.w = -256;
    }

    // The second pass observes fields around the original instructions, including hi.a's guarded store.
    private static void observeReads(String jarPath, String cls, String descriptor, Path out) throws Exception {
        try (JarFile jar = new JarFile(jarPath)) {
            ClassReader reader = new ClassReader(jar.getInputStream(jar.getJarEntry(cls + ".class")));
            ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int flags, String name, String desc, String sig, String[] exceptions) {
                    MethodVisitor mv = super.visitMethod(flags, name, desc, sig, exceptions);
                    if (!name.equals("a") || !desc.equals(descriptor)) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitFieldInsn(int opcode, String owner, String field, String type) {
                            String label = switch (owner + "." + field) {
                                case "tf.w" -> "active";
                                case "wi.R" -> "edges";
                                case "be.n" -> "width";
                                case "be.R" -> "height";
                                case "ej.W" -> "angle";
                                case "eg.d" -> "yaw";
                                case "we.w" -> "zoom";
                                case "hf.g" -> "sin";
                                case "hf.r" -> "cos";
                                case "lj.t" -> "markers";
                                case "hi.a" -> "setX";
                                default -> null;
                            };
                            // A null widget faults before a successful width/height observation.
                            if (opcode == Opcodes.GETFIELD) super.visitFieldInsn(opcode, owner, field, type);
                            if (label != null) {
                                super.visitLdcInsn(label);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdMinimapMarkersOracle", "read", "(Ljava/lang/String;)V", false);
                            }
                            if (opcode != Opcodes.GETFIELD) super.visitFieldInsn(opcode, owner, field, type);
                        }
                    };
                }
            }, 0);
            Files.createDirectories(out);
            Files.write(out.resolve(cls + ".class"), writer.toByteArray());
        }
    }

    private static void faultReads() {
        int[] sin = hf.g, cos = hf.r;
        mm dot = new mm(1, 1, 0, 0, 1, 1, new int[]{0x123456});
        kb.a(new int[32 * 32], 32, 32);
        for (boolean active : new boolean[]{false, true}) for (int op = 0; op < 3; op++) {
            for (int mode = 0; mode < 11; mode++) {
                tf.w = active;
                int dx = mode == 5 ? 601 : mode == 6 || mode == 7 || mode == 10 || op == 0 ? 7 : 100;
                qf sprite = mode == 7 ? null : dot;
                lj.t = new qf[]{sprite};
                wi.R = mode == 1 ? new qf[0] : new qf[]{null};
                hf.g = mode == 2 ? null : sin;
                hf.r = mode == 3 ? null : cos;
                zeroSecondDivisor = mode == 4;
                zoomReads = 0;
                we.w = mode == 8 ? -256 : 17;
                ej.W = -67;
                eg.d = 240;
                hi.a = 311;
                be widget = new be();
                widget.n = 71;
                widget.R = 61;
                widget.gb = new int[32];
                widget.Tc = new int[32];
                Arrays.fill(widget.Tc, 32);
                if (mode == 9) widget = null;
                if (mode == 10) lj.t = new qf[0];
                reads = new StringJoiner(",");
                String result = "ok";
                try {
                    if (op == 0) em.a(widget, sprite, 13, dx, 12, (byte)11, 8);
                    else hi.a(0, 12, 8, dx, 13, widget, op == 2);
                } catch (ld error) {
                    result = failure(error);
                }
                System.out.println(reads + "|" + hi.a + "|" + result);
            }
        }
    }

    private static int[] pixels(int length, int seed) {
        int[] result = new int[length];
        for (int i = 0; i < length; i++) result[i] = i % 5 == 0 ? 0 : (i + 1) * seed;
        return result;
    }

    private static String failure(RuntimeException error) {
        String context = "";
        Throwable cause = error;
        if (cause instanceof ld wrapped) {
            context = wrapped.e;
            cause = wrapped.f;
        }
        return cause.getClass().getSimpleName() + ":" + context;
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) {
            observeReads(args[1], "hi", "(IIIIILbe;Z)V", Path.of(args[2]));
            observeReads(args[1], "em", "(Lbe;Lqf;IIIBI)V", Path.of(args[2]));
            return;
        }
        if (args[0].equals("reads")) {
            faultReads();
            return;
        }
        try (GlRecorder recorder = new GlRecorder(Path.of(args[0]))) {
            tf.t = recorder.gl();
            tf.w = true;
            tf.J = WIDTH;
            tf.A = HEIGHT;
            mm dot = new mm(13, 15, 2, 3, 7, 8, pixels(56, 12471));
            mm edge = new mm(30, 30, 0, 0, 30, 30, pixels(900, 1237));
            cf glDot = new cf(dot);
            cf glEdge = new cf(edge);
            cf glMask = new cf(71, 61, 0, 0, 71, 61, pixels(71 * 61, 71));
            pf.b.a((byte)-75, glMask, 20L);
            pf.b.a((byte)-75, dot, 21L);
            BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
            int serial = 0;
            for (String line; (line = in.readLine()) != null; serial++) {
                int[] p = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
                tf.w = p[0] == 1;
                int op = p[1], dx = p[2], dz = p[3], x = p[6], y = p[7], mode = p[8];
                eg.d = p[4];
                ej.W = -67;
                we.w = p[5];
                recorder.mark("row" + serial);
                int[] frame = pixels(WIDTH * HEIGHT, 37);
                boolean narrow = mode == 1;
                int left = narrow ? 33 : 3, top = narrow ? 28 : 7;
                int right = narrow ? 49 : 91, bottom = narrow ? 41 : 80;
                kb.a(frame, WIDTH, HEIGHT);
                kb.c(left, top, right, bottom);
                if (tf.w) dj.d(left, top, right, bottom);
                be widget = new be();
                widget.n = 71;
                widget.R = 61;
                widget.xb = mode == 2 ? -1 : mode == 3 ? 21 : 20;
                widget.gb = new int[mode == 8 ? 1 : bottom - top];
                widget.Tc = new int[bottom - top];
                for (int i = 0; i < widget.gb.length; i++) widget.gb[i] = i % 6 + 3;
                for (int i = 0; i < widget.Tc.length; i++) widget.Tc[i] = right - left - (i % 16);
                qf sprite = tf.w ? glDot : dot;
                qf arrow = tf.w ? glEdge : edge;
                if (mode == 4) {
                    sprite = tf.w ? dot : glDot;
                    arrow = tf.w ? edge : glEdge;
                } else if (mode == 5) {
                    sprite = null;
                    arrow = null;
                } else if (mode == 6) {
                    widget = null;
                }
                lj.t = new qf[]{sprite};
                wi.R = new qf[]{arrow};
                rc.C = true;
                String result = "ok";
                try {
                    if (op == 0) em.a(widget, sprite, dz, dx, y, (byte)11, x);
                    else hi.a(mode == 7 ? 1 : 0, y, x, dx, dz, widget, false);
                } catch (RuntimeException error) {
                    result = failure(error);
                }
                ByteBuffer bytes = ByteBuffer.allocate(frame.length * 4);
                bytes.asIntBuffer().put(frame);
                String digest = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.array()));
                System.out.println(result + "|" + rc.C + "|" + digest);
            }
        }
    }
}
