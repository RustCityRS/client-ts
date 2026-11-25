import java.awt.Canvas;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import jdk.internal.org.objectweb.asm.*;

/** Observe calls and completed writes inside the original HD lb.a(Z)V. All callees run unchanged. */
public final class WindowResourceReloadOracle {
    static List<String> trace;
    private static final int[] PLAYERS = {0, 42, 2047, 2048};
    private static final class Finished extends Error {}

    public static void event(String name) {
        if (trace != null) trace.add(name);
    }

    public static void player(int index) {
        event("e.nb=" + index);
    }

    public static void ints(int a, int b, String label) {
        event(label + "(" + a + "," + b + ")");
    }

    static void checkSprites(ve archive) {
        if (trace != null && (archive == null || archive != ra.K)) throw new AssertionError("sprite archive");
    }

    public static void fonts(ve metrics, int guard, ve sprites) {
        if (trace != null && (metrics == null || metrics != ve.l)) throw new AssertionError("font metrics archive");
        checkSprites(sprites);
        hn.a(metrics, guard, sprites);
    }

    public static void sprites(int guard, ve archive) {
        checkSprites(archive);
        cg.a(guard, archive);
    }

    public static void open(ve archive, byte guard) {
        checkSprites(archive);
        oi.a(archive, guard);
    }

    public static void title(boolean open, int guard) {
        if (trace != null && open) throw new AssertionError("unexpected title flag");
        fm.a(open, guard);
    }

    public static void map(int guard, boolean file) {
        if (trace != null && file) throw new AssertionError("unexpected map flag");
        jb.a(guard, file);
    }

    static void instrument(Path directory) throws Exception {
        try (InputStream bytes = WindowResourceReloadOracle.class.getResourceAsStream("/lb.class")) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String id, String desc, String sig, String[] ex) {
                    MethodVisitor delegate = super.visitMethod(access, id, desc, sig, ex);
                    if (!id.equals("a") || !desc.equals("(Z)V")) return delegate;
                    return new MethodVisitor(Opcodes.ASM8, delegate) {
                        void log(String text) {
                            super.visitLdcInsn(text);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "WindowResourceReloadOracle", "event", "(Ljava/lang/String;)V", false);
                        }
                        public void visitMethodInsn(int opcode, String owner, String name, String type, boolean itf) {
                            String checked = switch (owner + "." + name + type) {
                                case "hn.a(Lve;ILve;)V" -> "fonts";
                                case "cg.a(ILve;)V" -> "sprites";
                                case "oi.a(Lve;B)V" -> "open";
                                case "fm.a(ZI)V" -> "title";
                                case "jb.a(IZ)V" -> "map";
                                default -> null;
                            };
                            if (type.equals("(II)V") && (owner.equals("tj") || owner.equals("pl"))) {
                                super.visitInsn(Opcodes.DUP2);
                                super.visitLdcInsn(owner + "." + name);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "WindowResourceReloadOracle", "ints", "(IILjava/lang/String;)V", false);
                            } else if (type.endsWith(")V") && !name.equals("<init>") && !owner.startsWith("java/")) {
                                log(owner + "." + name);
                            }
                            if (checked == null) super.visitMethodInsn(opcode, owner, name, type, itf);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC, "WindowResourceReloadOracle", checked, type, false);
                        }
                        public void visitFieldInsn(int opcode, String owner, String name, String type) {
                            super.visitFieldInsn(opcode, owner, name, type);
                            if (opcode == Opcodes.PUTSTATIC && !owner.equals("lb")) log(owner + "." + name + "=");
                            if (opcode == Opcodes.GETSTATIC && owner.equals("tl") && name.equals("d")) log("tl.d?");
                            if (opcode == Opcodes.PUTFIELD && owner.equals("e") && name.equals("nb")) {
                                super.visitVarInsn(Opcodes.ILOAD, 1);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "WindowResourceReloadOracle", "player", "(I)V", false);
                            }
                        }
                    };
                }
            }, 0);
            Files.write(directory.resolve("lb.class"), writer.toByteArray());
        }
    }

    static void exercise(int state, String missing) {
        id.b = 67;
        jf.l = 17;
        jf.a = null;
        sm previous = ni.n;
        mi.S = new e[2049];
        for (int index : PLAYERS) {
            mi.S[index] = new e();
            mi.S[index].nb = new Object();
        }
        tl.d = state;
        if (missing.equals("texture")) hf.e = null;
        if (missing.equals("gl")) tf.t = null;
        trace = new ArrayList<>();
        String result = "ok";
        try {
            lb.a(false);
        } catch (ld wrapped) {
            Throwable cause = wrapped;
            while (cause instanceof ld wrapper) cause = wrapper.f;
            result = cause.getClass().getSimpleName();
        }
        System.out.println("calls=" + String.join("|", trace));
        trace = null;
        if (jf.a != null) for (gi light : jf.a) if (light != null) throw new AssertionError("new light array");
        StringBuilder occupied = new StringBuilder();
        for (int index : PLAYERS) occupied.append(mi.S[index] != null && mi.S[index].nb != null ? '1' : '0');
        System.out.println("state=" + result + "|" + id.b + "|" + (ni.n != previous) + "|" + jf.l + "|"
            + (jf.a == null ? -1 : jf.a.length) + "|" + occupied);
        throw new Finished();
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) {
            instrument(Path.of(args[1]));
            return;
        }
        boolean active = args[0].equals("active");
        int state = Integer.parseInt(args[1]);
        String missing = args[2];
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765, 503);
        try (GlRecorder recorder = new GlRecorder(null); AutoCloseable factory = recorder.installFactory()) {
            recorder.loadProfile(Path.of(args[4]));
            try {
                HdTitleFrameOracle.run(Path.of(args[3]), canvas, frame -> {}, section -> {
                    // The two checkpoints straddle the original pm.a switch at stage 150.
                    if (section.equals(active ? "interface.onload" : "mode.hd")) {
                        if (tf.w != active) throw new AssertionError("renderer");
                        exercise(state, missing);
                    }
                });
                throw new AssertionError("window reset was not reached");
            } catch (Finished done) {}
        }
    }
}
