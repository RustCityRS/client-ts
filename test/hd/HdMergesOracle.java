import java.io.InputStream;
import java.io.PrintWriter;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import jdk.internal.org.objectweb.asm.*;

// The Java side of gl-2d-merges.test.ts (HD batch H2, unit merges): drives the HD arms of the shared 2D methods of the
// unmodified runescape_gl.jar with GlRecorder as tf.t, and writes the GLTrace to <out>/trace.tsv and one result line
// per script command to <out>/state.txt (each command is preceded by the trace mark op<n>).
//
//   java HdMergesOracle instrument <dir>       writes kl.class with kl.b(II)Z's ground, typecode and detail callees
//                                              (ma.a, bj.a, na.a) redirected to the stubs below
//   java HdMergesOracle <cache dir> <out dir> <profile.json> <script file>
//
// The merged methods: the sprite builders re.b(I)[Lqf;, gi.b(I)Lqf;, cj.a(I)[Lqf;, ui.h(I)[Lok;, wh.b(B)Lok;, the font
// builder ce.a(I[B)Lrk; (through k.a), the component graphic be.a(BZ)Lqf;, the minimap build kl.b(II)Z, draw
// ed.a(IBIILbe;)V and compass mj.a(IILbe;IB)V, and the title open oi.a(Lve;B)V and draw oj.a(BZLrk;)V. Every object
// built stays referenced until the end, so no finalizer runs during the trace.
public final class HdMergesOracle {
    private static final List<Object> retained = new ArrayList<>();
    private static ve sprites, metrics;
    private static rk font;
    private static PrintWriter state;
    // kl.b stubs: counts and rolling hashes of the redirected calls, the first detail call, and the failing call.
    private static int grounds, groundHash, typecodes, typecodeHash, details, detailHash, failAt = -1;
    private static String firstDetail = "-";
    private static StringBuilder compassReads;
    private static String compassMode;
    private static int compassImages;

    // Called after the original getstatic, with its operand still on the stack.
    public static void compassRead(String field) {
        if (compassReads == null) return;
        compassReads.append(field);
        if (field.equals("I") && compassMode.equals("swap")) {
            if (++compassImages == 1) ic.a = new mm(13, 3);
            if (compassImages == 2) ic.a = new mm(5, 19);
        }
    }

    static String mapMaskMode;
    public static qf minimapMask(be widget, byte guard, boolean active) {
        if (mapMaskMode != null) {
            we.w = 39;
            if (mapMaskMode.equals("badX")) {
                nk.O = null;
                tb.X.q = new short[0];
            }
            if (mapMaskMode.equals("badZ")) {
                tb.X.d = new short[0];
                we.w = -256;
            }
        }
        return widget.a(guard, active);
    }

    public static qf compassMask(be widget, byte guard, boolean active) {
        if (compassReads != null) {
            compassReads.append("M");
            eg.d = 1024;
            if (compassMode.equals("throwMask")) throw new NullPointerException();
            if (compassMode.equals("wrongMask")) return new mm(1, 1);
        }
        return widget.a(guard, active);
    }

    public static void ground(int[] pixels, int pos, int width, int level, int x, int z) {
        grounds++;
        groundHash = groundHash * 31 + (pos ^ width << 20 ^ level << 28 ^ x << 8 ^ z << 16) + (pixels == null ? 1 : 0);
    }

    public static long typecode(int level, int x, int z) {
        typecodes++;
        typecodeHash = typecodeHash * 31 + (level << 28 ^ x << 8 ^ z << 16);
        return 0L;
    }

    // na.a(offsetZ, x, wallColour, z, activeColour, offsetX, level, dummy)
    public static boolean detail(int offsetZ, int x, int wall, int z, int active, int offsetX, int level, boolean dummy) {
        int call = details++;
        detailHash = detailHash * 31 + (level << 28 ^ x << 8 ^ z << 16 ^ offsetX << 4 ^ offsetZ) * 7 + wall * 3 + active;
        if (call == 0) firstDetail = level + "," + x + "," + z + "," + Integer.toHexString(wall) + "," + Integer.toHexString(active);
        return call != failAt;
    }

    static void instrument(Path directory) throws Exception {
        try (InputStream bytes = HdMergesOracle.class.getResourceAsStream("/kl.class")) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String id, String desc, String sig, String[] ex) {
                    MethodVisitor delegate = super.visitMethod(access, id, desc, sig, ex);
                    if (!id.equals("b") || !desc.equals("(II)Z")) return delegate;
                    return new MethodVisitor(Opcodes.ASM8, delegate) {
                        public void visitMethodInsn(int opcode, String owner, String name, String type, boolean itf) {
                            String stub = switch (owner + "." + name + type) {
                                case "ma.a([IIIIII)V" -> "ground";
                                case "bj.a(III)J" -> "typecode";
                                case "na.a(IIIIIIIZ)Z" -> "detail";
                                default -> null;
                            };
                            if (stub == null) super.visitMethodInsn(opcode, owner, name, type, itf);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdMergesOracle", stub, type, false);
                        }
                    };
                }
            }, 0);
            Files.write(directory.resolve("kl.class"), writer.toByteArray());
        }
        try (InputStream bytes = HdMergesOracle.class.getResourceAsStream("/ed.class")) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter writer = new ClassWriter(reader, 0);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String id, String desc, String sig, String[] ex) {
                    MethodVisitor base = super.visitMethod(access, id, desc, sig, ex);
                    if (!id.equals("a") || !desc.equals("(IBIILbe;)V")) return base;
                    return new MethodVisitor(Opcodes.ASM8, base) {
                        public void visitMethodInsn(int op, String owner, String name, String desc, boolean itf) {
                            if (owner.equals("be") && name.equals("a") && desc.equals("(BZ)Lqf;"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdMergesOracle", "minimapMask", "(Lbe;BZ)Lqf;", false);
                            else super.visitMethodInsn(op, owner, name, desc, itf);
                        }
                    };
                }
            }, 0);
            Files.write(directory.resolve("ed.class"), writer.toByteArray());
        }
        try (InputStream bytes = HdMergesOracle.class.getResourceAsStream("/mj.class")) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String id, String desc, String sig, String[] ex) {
                    MethodVisitor base = super.visitMethod(access, id, desc, sig, ex);
                    if (!id.equals("a") || !desc.equals("(IILbe;IB)V")) return base;
                    return new MethodVisitor(Opcodes.ASM8, base) {
                        public void visitFieldInsn(int op, String owner, String field, String type) {
                            super.visitFieldInsn(op, owner, field, type);
                            String label = switch (owner + "." + field + ":" + type) {
                                case "wb.d:I" -> "S";
                                case "ic.a:Lqf;" -> "I";
                                case "eg.d:I" -> "Y";
                                default -> null;
                            };
                            if (op == Opcodes.GETSTATIC && label != null) {
                                super.visitLdcInsn(label);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdMergesOracle", "compassRead", "(Ljava/lang/String;)V", false);
                            }
                        }
                        public void visitMethodInsn(int op, String owner, String name, String desc, boolean itf) {
                            if (owner.equals("be") && name.equals("a") && desc.equals("(BZ)Lqf;"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdMergesOracle", "compassMask", "(Lbe;BZ)Lqf;", false);
                            else super.visitMethodInsn(op, owner, name, desc, itf);
                        }
                    };
                }
            }, 0);
            Files.write(directory.resolve("mj.class"), writer.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) {
            instrument(Path.of(args[1]));
            return;
        }
        Path directory = Path.of(args[0]);
        Path out = Path.of(args[1]);
        en data = HdTitleFrameOracle.open(directory.resolve("main_file_cache.dat2"), 5200);
        en index = HdTitleFrameOracle.open(directory.resolve("main_file_cache.idx255"), 6000);
        ge master = new ge(255, data, index, 500000);
        sprites = new ve(new HdTitleFrameOracle.Disk(master, data, directory, 8), false, false);
        metrics = new ve(new HdTitleFrameOracle.Disk(master, data, directory, 13), false, false);
        bm.f = sprites;
        GlRecorder recorder = new GlRecorder(out);
        recorder.loadProfile(Path.of(args[2]));
        tf.t = recorder.gl();
        tf.w = true;
        tf.J = 765;
        tf.A = 503;
        try (PrintWriter writer = new PrintWriter(Files.newBufferedWriter(out.resolve("state.txt")))) {
            state = writer;
            int n = 0;
            for (String line : Files.readAllLines(Path.of(args[3]))) {
                if (line.isEmpty()) continue;
                recorder.mark("op" + n);
                StringBuilder result = new StringBuilder();
                try {
                    run(line.split(" "), result);
                    writer.println(n + " ok " + result);
                } catch (Throwable e) {
                    Throwable cause = e;
                    while (cause instanceof ld wrapper && wrapper.f != null) cause = wrapper.f;
                    writer.println(n + " threw " + cause.getClass().getSimpleName() + " " + result);
                }
                n++;
            }
        }
        recorder.close();
    }

    private static int i(String[] t, int index) {
        return Integer.parseInt(t[index]);
    }

    static String kind(Object o) {
        if (o == null) return "null";
        if (o instanceof el) return "el";
        if (o instanceof cf) return "cf";
        if (o instanceof am) return "am";
        if (o instanceof mm) return "mm";
        if (o instanceof oh) return "oh";
        if (o instanceof ek) return "ek";
        if (o instanceof mb) return "mb";
        if (o instanceof dd) return "dd";
        return "?" + o.getClass().getName();
    }

    static String sprite(qf s) {
        if (s == null) return "null";
        retained.add(s);
        return kind(s) + ":" + s.J + "," + s.V + "," + s.P + "," + s.K + "," + s.W + "," + s.I;
    }

    static String indexed(ok s) {
        if (s == null) return "null";
        retained.add(s);
        return kind(s) + ":" + s.l + "," + s.i + "," + s.m + "," + s.d + "," + s.a + "," + s.k;
    }

    static be component(String[] t, int first) {
        be component = new be();
        component.n = i(t, first);
        component.R = i(t, first + 1);
        component.xb = i(t, first + 2);
        component.Yc = -1;
        retained.add(component);
        return component;
    }

    private static void run(String[] t, StringBuilder r) throws Throwable {
        switch (t[0]) {
            case "gl" -> tf.w = i(t, 1) != 0;
            case "seed" -> {
                Field random = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
                random.setAccessible(true);
                ((Random)random.get(null)).setSeed(Long.parseLong(t[1]));
            }
            case "random" -> r.append(Double.doubleToRawLongBits(Math.random()));
            case "load" -> r.append(uj.a((byte)-120, sprites, i(t, 1)) ? "T" : "F");
            case "re" -> { for (qf s : re.b(-26802)) r.append(sprite(s)).append(' '); }
            case "cj" -> { for (qf s : cj.a(-5)) r.append(sprite(s)).append(' '); }
            case "gi" -> r.append(sprite(gi.b(99)));
            case "ui" -> { for (ok s : ui.h(1854847236)) r.append(indexed(s)).append(' '); }
            case "wh" -> r.append(indexed(wh.b((byte)-40)));
            case "font" -> {
                // font <group> <file>; k.a(IIBLve;Lve;)Lrk; takes (file, group, dummy, sprites, metrics)
                font = k.a(i(t, 2), i(t, 1), (byte)125, sprites, metrics);
                retained.add(font);
                r.append(kind(font));
            }
            case "flushcache" -> pf.b = new n(200);
            case "graphic" -> {
                be component = new be();
                component.xb = i(t, 1);
                component.Yc = i(t, 2);
                component.x = i(t, 4) != 0;
                component.X = i(t, 5) != 0;
                component.Pc = i(t, 6);
                component.Oc = i(t, 7);
                component.c = i(t, 8) != 0;
                retained.add(component);
                qf s = component.a((byte)-113, i(t, 3) != 0);
                r.append(sprite(s)).append(" missing=").append(rc.C ? "T" : "F");
            }
            case "titleopen" -> {
                bh.M = false;
                vf.m = i(t, 1);
                kk.g = i(t, 2);
                dl.d = i(t, 3);
                uj.B = i(t, 4);
                oi.a(sprites, (byte)-60);
                r.append(sprite(gd.n)).append(' ').append(indexed(tk.o)).append(" open=").append(bh.M ? "T" : "F");
            }
            case "titledraw" -> {
                ec.k = cd.a("Loading - please wait.", (byte)-126);
                jm.z = cd.a("Loading sprites - " + t[2] + "%", (byte)-126);
                qc.P = i(t, 2);
                oj.t = new int[]{530};
                oj.a(t.length > 3 ? (byte)i(t, 3) : (byte)60, i(t, 1) != 0, font);
                r.append(oj.t == null ? "cleared" : "retained");
            }
            case "mapl" -> {
                int x = i(t, 1);
                for (int level = 0; level < 4; level++) for (int a = 0; a < 104; a++) for (int b = 0; b < 104; b++) {
                    x = x * 1103515245 + 12345;
                    bb.g[level][a][b] = (byte)((x >>> 16) & 0x1f);
                }
            }
            case "resetmap" -> { ha.i = null; ef.j = null; }
            case "build" -> {
                grounds = groundHash = typecodes = typecodeHash = details = detailHash = 0;
                firstDetail = "-";
                failAt = i(t, 2);
                ee.b = i(t, 3);
                ug.m = 77;
                boolean built = kl.b(0, i(t, 1));
                if (ha.i != null) retained.add(ha.i);
                if (ef.j != null) retained.add(ef.j);
                r.append(built ? "T" : "F").append(" g=").append(grounds).append(',').append(groundHash)
                    .append(" t=").append(typecodes).append(',').append(typecodeHash).append(" d=").append(details).append(',')
                    .append(detailHash).append(" first=").append(firstDetail).append(" image=").append(sprite(ha.i))
                    .append(" pending=").append(sprite(ef.j)).append(" pix=").append(kb.i == null ? "null" : "set")
                    .append(" count=").append(ug.m);
            }
            case "mmstate" -> {
                wb.d = i(t, 1);
                nk.O = new e();
                nk.O.Qb = i(t, 2);
                nk.O.ac = i(t, 3);
                eg.d = i(t, 4);
                ej.W = i(t, 5);
                we.w = i(t, 6);
                tb.X = null;
                ug.m = 0;
                wd.g = 0;
                vl.j = 0;
                ja.n = 0;
            }
            case "compassimg" -> {
                if (!uj.a((byte)-120, sprites, i(t, 1))) throw new IllegalStateException("group " + t[1]);
                ic.a = gi.b(99);
                r.append(sprite(ic.a));
            }
            case "mmdraw" -> {
                ch.y[i(t, 6)] = false;
                ed.a(i(t, 6), (byte)59, i(t, 2), i(t, 1), component(t, 3));
                r.append("redraw=").append(ch.y[i(t, 6)] ? "T" : "F");
            }
            case "mmmask" -> {
                e self = nk.O;
                mapMaskMode = t[7];
                if (!mapMaskMode.equals("zoom")) {
                    tb.X = new se(1);
                    tb.X.u[0] = 4;
                }
                try {
                    ed.a(i(t, 6), (byte)59, i(t, 2), i(t, 1), component(t, 3));
                } finally {
                    mapMaskMode = null;
                    nk.O = self;
                    tb.X = null;
                }
            }
            case "compass" -> {
                ch.y[i(t, 6)] = false;
                mj.a(i(t, 1), i(t, 2), component(t, 3), i(t, 6), (byte)59);
                r.append("redraw=").append(ch.y[i(t, 6)] ? "T" : "F");
            }
            case "compassorder" -> {
                compassMode = t[1];
                qf original = ic.a;
                be widget = new be();
                widget.n = widget.R = 33;
                widget.xb = i(t, 2);
                widget.gb = widget.Tc = new int[33];
                if (compassMode.equals("nullWidget")) widget = null;
                if (compassMode.equals("nullImage")) ic.a = null;
                if (compassMode.equals("wrongImage")) ic.a = new mm(1, 1);
                wb.d = compassMode.equals("disabled") || compassMode.equals("limitHigh") ? 3 : 2;
                eg.d = 128;
                compassImages = 0;
                ch.y[5] = false;
                compassReads = new StringBuilder();
                String result = "ok";
                try {
                    mj.a(5, 7, widget, 5, (byte)59);
                } catch (ld wrapped) {
                    result = wrapped.f.getClass().getSimpleName();
                } finally {
                    r.append(compassReads).append('|').append(eg.d).append('|').append(ch.y[5]).append('|').append(result);
                    compassReads = null;
                    ic.a = original;
                }
            }
            default -> throw new AssertionError(t[0]);
        }
    }
}
