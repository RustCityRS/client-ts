import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Observe ha.a(I) field instructions in the original order. Run the actual raster, sort, cursor selection and
 * update of dirty arrays. The layer, menu drawing and audio endpoints expose the dispatcher's arguments. */
public class HdGameDrawOracle {
    static final be widget = new be();
    static final e player = new e();
    static final StringBuilder events = new StringBuilder();
    static int drawing, faultAt, n;
    static void event(String name) {
        events.append(name).append(';');
        if (++n == faultAt) throw new IllegalStateException();
    }
    public static void animate(int guard, int group) {
        event("animate" + group);
        if (drawing == 6) md.W = -1;
    }
    public static void layer(boolean guard) {
        event("layer");
        bn.V = 3;
        if (drawing == 1 || drawing == 2) {
            hi.a = 33; rg.s = 49;
            if (drawing == 2) { qf.X = widget; kd.Bb = -7; ld.c = 18; }
        }
        if (drawing == 3) tf.w = !tf.w;
        if (drawing == 4) em.z = !em.z;
        if (drawing == 5) throw new AssertionError();
    }
    public static void plain(int guard) { event("plain"); }
    public static void sprite(byte guard) { event("sprite"); }
    public static void feedback(be component, int guard, int y, int x) {
        event("tip" + (component == null ? 0 : 1) + "," + x + "," + y);
    }
    public static void sort(int guard) { event("sort"); wl.b(guard); }
    public static int cursor(int guard) { event("cursor"); return tb.h(guard); }
    public static void applyCursor(int id, int guard) { event("apply" + id); gg.c(id,guard); }
    public static void audio(int elapsed, int x, int z, int plane, int guard) {
        event("audio" + elapsed + "," + x + "," + z + "," + plane);
    }
    public static void glClip() { event("glClip"); dj.c(); }
    public static void swClip() { event("swClip"); kb.c(); }
    public static void glTint(int x, int y, int w, int h, int rgb, int alpha) {
        event("glTint" + rgb); dj.c(x,y,w,h,rgb,alpha);
        if (drawing == 7) tf.w = !tf.w;
    }
    public static void swTint(int x, int y, int w, int h, int rgb, int alpha) {
        event("swTint" + rgb); kb.a(x,y,w,h,rgb,alpha);
        if (drawing == 7) tf.w = !tf.w;
    }
    static void instrument(Path output) throws Exception {
        try (InputStream in = HdGameDrawOracle.class.getResourceAsStream("/ha.class")) {
            ClassReader reader = new ClassReader(in);
            ClassWriter writer = new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] ex) {
                    MethodVisitor parent = super.visitMethod(access,name,desc,sig,ex);
                    if (!name.equals("a") || !desc.equals("(I)V")) return parent;
                    return new MethodVisitor(Opcodes.ASM8,parent) {
                        public void visitFieldInsn(int op, String owner, String name, String desc) {
                            super.visitFieldInsn(op,owner,name,desc);
                            if (owner.equals("ha") || owner.equals("client")) return;
                            String prefix = op == Opcodes.PUTSTATIC ? "w" : "r";
                            super.visitLdcInsn(prefix + owner + "." + name);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdGameDrawOracle","event","(Ljava/lang/String;)V",false);
                        }
                        public void visitMethodInsn(int op, String owner, String name, String desc, boolean itf) {
                            String target = switch (owner + "." + name + desc) {
                                case "hh.a(II)V" -> "animate";
                                case "al.a(Z)V" -> "layer";
                                case "kb.c()V" -> "swClip";
                                case "dj.c()V" -> "glClip";
                                case "wl.b(I)V" -> "sort";
                                case "ij.a(B)V" -> "sprite";
                                case "lf.b(I)V" -> "plain";
                                case "dm.a(Lbe;III)V" -> "feedback";
                                case "tb.h(I)I" -> "cursor";
                                case "gg.c(II)V" -> "applyCursor";
                                case "kb.a(IIIIII)V" -> "swTint";
                                case "dj.c(IIIIII)V" -> "glTint";
                                case "ih.a(IIIII)V" -> "audio";
                                default -> null;
                            };
                            if (target == null) super.visitMethodInsn(op,owner,name,desc,itf);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdGameDrawOracle",target,desc,false);
                        }
                    };
                }
            },0);
            Files.write(output.resolve("ha.class"),writer.toByteArray());
        }
    }
    static String bools(boolean[] values) {
        if (values == null) return "~";
        StringBuilder out = new StringBuilder();
        for (boolean b : values) out.append(b ? '1' : '0');
        return out.toString();
    }
    static String names(na[] values) {
        if (values == null) return "~";
        StringBuilder out = new StringBuilder();
        for (na value : values) out.append(value == wb.h ? 'c' : value == pa.O ? 'e' : 'x');
        return out.toString();
    }
    static String fault(Throwable error) {
        String context = "";
        if (error instanceof ld wrapper) {
            context = "@" + wrapper.e;
            error = wrapper.f;
        }
        return error.getClass().getSimpleName() + context;
    }
    public static void main(String[] args) throws Exception {
        if (args.length == 1) { instrument(Path.of(args[0])); return; }
        GlRecorder recorder = new GlRecorder(Path.of(args[1]));
        tf.t = recorder.gl();
        tf.J = 21; tf.A = 11;
        int i = 0;
        for (String row : Files.readAllLines(Path.of(args[0]))) {
            int[] v = Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray();
            int active = v[0], guard = v[1], menu = v[3], pointer = v[4], bad = v[7];
            drawing = v[5]; faultAt = v[8];
            recorder.mark("case" + i++);
            md.W = v[2]; tf.w = active == 1; em.z = menu != 0; ve.w = menu == 2;
            ml.Q = pointer == 2 ? 2 : 0; lk.Z = pointer == 1 ? 1 : 0;
            wi.W = 17; wl.u = 20; rh.o = 31; sc.v = 32; ah.s = 41; em.y = 42;
            me.nb = 60; em.w = 61; cl.Y = 55; wb.c = -4;
            fb.m = false; ja.r = -1; nj.a = true; pb.q = new boolean[112]; pb.q[81] = true;
            sk.kb = 3; uj.C = new na[3]; t.v = new na[3];
            d.eb = new short[]{41,1003,42}; pf.r = new int[]{33,44,55};
            pl.e = new int[]{1,2,3}; ef.c = new int[]{4,5,6}; mi.U = new long[]{7,8,9};
            bn.V = 3; pa.R = new boolean[]{true,false,false}; ch.y = new boolean[]{false,true,false}; sc.z = new boolean[]{false,true,true};
            vh.b = new int[]{2,-2,7}; e.sc = new int[]{1,5,0}; sd.V = new int[]{6,10,3}; fe.lb = new int[]{3,7,8};
            qf.X = nf.h = widget; hi.a = 9; rg.s = 11; kd.Bb = 13; ld.c = 15; vg.c = false;
            oj.v = -2; gj.d = 67; jl.v = 1; pb.ab = 1; qc.U = v[6];
            od.i = 27; nk.O = player; player.Qb = 123; player.ac = -889; ee.b = 2;
            switch (bad) {
                case 1 -> uj.C = null;
                case 2 -> t.v = new na[0];
                case 3 -> d.eb = new short[0];
                case 4 -> pf.r = null;
                case 5 -> pa.R = new boolean[]{true};
                case 6 -> sc.z = null;
                case 7 -> ch.y = new boolean[0];
                case 8 -> vh.b = null;
                case 9 -> fe.lb = new int[0];
                case 10 -> nk.O = null;
                case 11 -> mi.U = null;
                case 12 -> pb.q = null;
            }
            int[] pixels = new int[231]; Arrays.fill(pixels,0x265172);
            kb.a(pixels,21,11); kb.c(2,3,8,7);
            events.setLength(0); n = 0;
            String result = "ok";
            try { ha.a(guard); }
            catch (RuntimeException | AssertionError error) { result = fault(error); }
            ByteBuffer frame = ByteBuffer.allocate(pixels.length*4).order(ByteOrder.LITTLE_ENDIAN);
            frame.asIntBuffer().put(pixels);
            System.out.println(String.join("|",result,events.toString(),md.W+","+bn.V+","+oj.v+","+od.i+","+vg.c+","+tf.w,
                bools(pa.R),bools(ch.y),bools(sc.z),names(uj.C),names(t.v),Arrays.toString(d.eb),Arrays.toString(pf.r),
                sk.kb+","+me.nb+","+em.w+","+jl.v+","+pb.ab+","+hi.a+","+rg.s+","+(qf.X==null)+","+(nf.h==null),
                Base64.getEncoder().encodeToString(frame.array())));
        }
        recorder.close();
    }
}
