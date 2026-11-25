import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Run gn.a itself; replace only its drawing and GetMask calls, and observe completed stores and clip calls. */
public final class WidgetSpecialDrawOracle {
    static final List<String> events = new ArrayList<>();
    static be widget;
    static String fault;
    static int clips;
    static long heapBytes;

    static long total(Runtime rt) { return heapBytes + 913; }
    static long free(Runtime rt) { return 913; }
    static int groups(bg provider, byte dummy) { return 4; }
    static int verified(bg provider, int dummy) { return 2; }
    static int position(bg provider, int dummy) { return 1; }
    static void label(rk font, na text, int x, int y, int colour, int shadow) {
        events.add(new String(text.T, 0, text.lb, java.nio.charset.StandardCharsets.ISO_8859_1)
            + "(" + x + "," + y + "," + colour + "," + shadow + ")");
    }

    public static void event(String name) { events.add(name); }
    static void guard(boolean condition) { if (!condition) throw new AssertionError(); }
    public static void scene(int dummy, int h, boolean fixed, int x, int w, int y) {
        guard(dummy == -6403); draw("scene(" + h + "," + w + "," + y + "," + x + "," + fixed + ")");
    }
    public static void minimap(int root, byte dummy, int y, int x, be c) {
        guard(dummy == 59 && c == widget); draw("minimap(" + x + "," + root + "," + y + ")");
    }
    public static void compass(int x, int y, be c, int root, byte dummy) {
        guard(dummy == 59 && c == widget); draw("compass(" + root + "," + x + "," + y + ")");
    }
    public static void map(int x, int dummy, int y, int h, int w) {
        guard(dummy == 64); draw("map(" + y + "," + x + "," + h + "," + w + ")");
    }
    public static void overview(int x, int h, int w, int dummy, int y) {
        guard(dummy == 19481); draw("overview(" + x + "," + y + "," + h + "," + w + ")");
    }
    public static void flames(int x, int dummy, int y) {
        guard(dummy == 95); draw("flames(" + x + "," + y + ")");
    }
    static void draw(String name) {
        event(name);
        // Distinct callee clip makes a missing, early or wrong-backend restoration visible.
        if (tf.w) dj.d(2,3,43,57); else kb.c(2,3,43,57);
        if (fault.equals("draw")) throw new IllegalStateException();
    }
    public static boolean mask(be c, int dummy) {
        guard(c == widget && dummy == -30721);
        event("mask");
        return !fault.equals("nomask");
    }
    static void clip(String mode, int a, int b, int c, int d) {
        event(mode + "(" + a + "," + b + "," + c + "," + d + ")");
        if (++clips == 2 && fault.equals("restore")) throw new IllegalStateException();
    }
    public static void software(int a, int b, int c, int d) { clip("sdClip",a,b,c,d); kb.c(a,b,c,d); }
    public static void hardware(int a, int b, int c, int d) { clip("glClip",a,b,c,d); dj.d(a,b,c,d); }
    public static void raster3d() { event("raster3d"); hf.a(); }
    public static void store(boolean[] flags, int index, int value) {
        flags[index] = value != 0;
        if (flags == pa.R || flags == ch.y) event((flags == pa.R ? "dirty" : "redraw") + "[" + index + "]=" + flags[index]);
    }

    static void instrument(Path dir) throws Exception {
        try (InputStream bytes = WidgetSpecialDrawOracle.class.getResourceAsStream("/gn.class")) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int a, String n, String d, String s, String[] ex) {
                    MethodVisitor mv = super.visitMethod(a,n,d,s,ex);
                    if (!n.equals("a") || !d.equals("(III[Lbe;IIIIBI)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv) {
                        void log(String name) {
                            super.visitLdcInsn(name);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetSpecialDrawOracle","event","(Ljava/lang/String;)V",false);
                        }
                        public void visitMethodInsn(int op, String cls, String name, String desc, boolean iface) {
                            String instanceHook = switch (cls + "." + name + desc) {
                                case "java/lang/Runtime.totalMemory()J" -> "total";
                                case "java/lang/Runtime.freeMemory()J" -> "free";
                                case "bg.b(B)I" -> "groups";
                                case "bg.c(I)I" -> "verified";
                                case "bg.d(I)I" -> "position";
                                case "rk.b(Lna;IIII)V" -> "label";
                                default -> null;
                            };
                            if (instanceHook != null) {
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "WidgetSpecialDrawOracle", instanceHook, "(L" + cls + ";" + desc.substring(1), false);
                                return;
                            }
                            String hook = switch (cls + "." + name + desc) {
                                case "ui.a(IIZIII)V" -> "scene";
                                case "ed.a(IBIILbe;)V" -> "minimap";
                                case "mj.a(IILbe;IB)V" -> "compass";
                                case "wa.a(IIIII)V" -> "map";
                                case "a.a(IIIII)V" -> "overview";
                                case "s.b(III)V" -> "flames";
                                case "dj.d(IIII)V" -> "hardware";
                                case "kb.c(IIII)V" -> "software";
                                case "hf.a()V" -> "raster3d";
                                case "be.a(I)Z" -> "mask";
                                default -> null;
                            };
                            if (hook == null) super.visitMethodInsn(op,cls,name,desc,iface);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetSpecialDrawOracle",hook,hook.equals("mask") ? "(Lbe;I)Z" : desc,false);
                        }
                        public void visitFieldInsn(int op, String cls, String name, String type) {
                            super.visitFieldInsn(op,cls,name,type);
                            String field = cls + "." + name;
                            if (op == Opcodes.PUTSTATIC && (field.equals("wl.h") || field.equals("rg.s") || field.equals("hi.a"))) log(field);
                            if (op == Opcodes.GETSTATIC && field.equals("sc.z")) log("paint gate");
                        }
                        public void visitInsn(int op) {
                            if (op == Opcodes.BASTORE) super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetSpecialDrawOracle","store","([ZII)V",false);
                            else super.visitInsn(op);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("gn.class"), writer.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1) { instrument(Path.of(args[0])); return; }
        kb.a(new int[291 * 217],291,217);
        tf.J = 291; tf.A = 217;
        try (GlRecorder gl = new GlRecorder(null)) {
            tf.t = gl.gl();
            var right = dj.class.getDeclaredField("d"); right.setAccessible(true);
            var input = new BufferedReader(new InputStreamReader(System.in));
            for (String line; (line = input.readLine()) != null;) {
                String[] parts = line.split(" ");
                tf.w = Boolean.parseBoolean(parts[0]);
                fault = parts[2];
                widget = new be();
                widget.N = -1; widget.I = 1; widget.K = Integer.parseInt(parts[1]);
                if (widget.K == 1405) {
                    String[] sizes = fault.split(",");
                    dg.f = true;
                    tk.v = 51;
                    heapBytes = Long.parseLong(sizes[0]);
                    fa.a = Integer.parseInt(sizes[1]); fa.f = Integer.parseInt(sizes[2]); fa.e = Integer.parseInt(sizes[3]);
                    wa.Eb = new bg[28];
                }
                widget.jd = 13; widget.jb = 17; widget.n = 121; widget.R = 97;
                wl.h = null; rg.s = -7; hi.a = -9;
                pa.R = new boolean[fault.equals("shortDirty") ? 2 : 100];
                ch.y = new boolean[fault.equals("shortRedraw") ? 2 : 100];
                sc.z[2] = false; wb.d = 5;
                clips = 0; events.clear();
                String result = "ok";
                try { gn.a(7,11,9,new be[]{widget},181,-1,5,155,(byte)119,2); }
                catch (ld ex) {
                    Throwable cause = ex;
                    while (cause instanceof ld wrapped) cause = wrapped.f;
                    result = cause.getClass().getSimpleName();
                }
                int[] clip = tf.w ? new int[]{dj.c,dj.b,right.getInt(null),dj.e} : new int[]{kb.b,kb.d,kb.e,kb.h};
                System.out.println(line + "|" + result + "|" + String.join(";",events) + "|" + (wl.h == widget) + ","
                    + rg.s + "," + hi.a + "|" + clip[0] + "," + clip[1] + "," + clip[2] + "," + clip[3]);
            }
        }
    }
}
