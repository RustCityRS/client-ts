import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

/** Observe lc.a(IIIIIII)V at its native read and dispatch boundaries; both clip implementations execute. */
public final class HdOverlayRasterOracle {
    static StringBuilder calls;
    static int toggles, fault, ordinal, widths, reads, mutation;
    static Field glRight;


    // Trace direct member loads separately from callback ordinals, including failure prefixes.
    public static void field(String label) { calls.append(label).append(';'); }

    static void event(String key, int... args) {
        calls.append(key);
        for (int v : args) calls.append(',').append(v);
        calls.append(';');
        if (++ordinal == fault) throw new IllegalStateException("injected");
    }
    public static boolean read(boolean active) {
        event("read", active ? 1 : 0);
        reads++;
        if (mutation == 1 && reads == 1) { jb.k[0].W = 41; jb.k[0].I = 19; fc.a = 69; }
        if (mutation == 2 && reads == 3) wl.q = null;
        if (mutation == 3 && reads == 3) { fc.a = -17; bf.B = 71; wl.q.ab = 23; }
        return active;
    }
    static void toggle(int bit) { if ((toggles & (1 << bit)) != 0) tf.w = !tf.w; }
    public static void project(byte guard, int cy, int scaleX, fe actor, int scaleY, int h, int cx) {
        event("project", cy, cx, h, scaleX, scaleY);
        fc.a = 39; bf.B = 32;
    }
    public static int width(rk font, na text) {
        event("width", ++widths);
        toggle(widths == 1 ? 0 : 3);
        return 27;
    }
    public static void sprite(qf sprite, int x, int y) {
        boolean back = sprite == jb.k[0];
        event(back ? "back" : "front", x, y);
        toggle(back ? 1 : 2);
    }
    public static void left(rk font, na text, int x, int y, int colour, int shadow) {
        java.util.Objects.requireNonNull(font);
        event("left", x, y, colour, shadow);
        toggle(4);
    }
    public static void centre(rk font, na text, int x, int y, int colour, int shadow) {
        java.util.Objects.requireNonNull(font);
        event("centre", x, y, colour, shadow);
        toggle(4);
    }
    public static void sdClip(int a, int b, int c, int d) {event("sdClip",a,b,c,d); kb.d(a,b,c,d);}
    public static void sdReset(int a, int b, int c, int d) {event("sdReset",a,b,c,d); kb.c(a,b,c,d);}
    public static void hdClip(int a, int b, int c, int d) {event("hdClip",a,b,c,d); dj.c(a,b,c,d);}
    public static void hdReset(int a, int b, int c, int d) {event("hdReset",a,b,c,d); dj.d(a,b,c,d);}

    static void prepare(Path jar, Path dir) throws Exception {
        int[] reads = {0};
        try (JarFile archive = new JarFile(jar.toFile())) {
            ClassReader reader = new ClassReader(archive.getInputStream(archive.getJarEntry("lc.class")));
            ClassWriter output = new ClassWriter(ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, output) {
                public MethodVisitor visitMethod(int access, String name, String desc, String signature, String[] exceptions) {
                    MethodVisitor mv = super.visitMethod(access, name, desc, signature, exceptions);
                    if (!name.equals("a") || !desc.equals("(IIIIIII)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitFieldInsn(int op, String owner, String field, String sig) {
                            super.visitFieldInsn(op, owner, field, sig);
                            if (op == Opcodes.GETFIELD && owner.equals("nc") && field.equals("p")) {
                                super.visitLdcInsn("hintActor");
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdOverlayRasterOracle","field","(Ljava/lang/String;)V",false);
                            }
                            if (op == Opcodes.GETSTATIC) {
                                String label = switch(owner + "." + field) {
                                    case "vl.j" -> "players";
                                    case "wd.g" -> "npcs";
                                    case "mi.S" -> "playerList";
                                    case "ib.f" -> "playerIds";
                                    case "cj.i" -> "npcIds";
                                    case "fc.a" -> "projectX";
                                    case "bf.B" -> "projectY";
                                    case "rl.V" -> "skulls";
                                    case "km.sc" -> "prayers";
                                    case "gj.d" -> "cycle";
                                    case "ej.U" -> "chatMode";
                                    case "pg.fb" -> "limit";
                                    case "wi.bb" -> "count";
                                    case "pg.lb" -> "chatY";
                                    case "pg.Z" -> "chatHeight";
                                    case "pg.R" -> "chatX";
                                    case "pg.cb" -> "chatWidth";
                                    case "ge.m" -> "effects";
                                    case "wl.q" -> "font";
                                    default -> null;
                                };
                                if (label != null) {
                                    super.visitLdcInsn(label);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdOverlayRasterOracle","field","(Ljava/lang/String;)V",false);
                                }
                            }
                            if (op == Opcodes.GETSTATIC && owner.equals("tf") && field.equals("w") && sig.equals("Z")) {
                                reads[0]++;
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdOverlayRasterOracle", "read", "(Z)Z", false);
                            }
                        }
                        public void visitMethodInsn(int op, String owner, String name, String sig, boolean iface) {
                            String hook = switch (owner + "." + name + sig) {
                                case "og.a(BIILfe;III)V" -> "project";
                                case "qf.e(II)V" -> "sprite";
                                case "rk.a(Lna;)I" -> "width";
                                case "rk.a(Lna;IIII)V" -> "left";
                                case "rk.c(Lna;IIII)V" -> "centre";
                                case "kb.d(IIII)V" -> "sdClip";
                                case "kb.c(IIII)V" -> "sdReset";
                                case "dj.c(IIII)V" -> "hdClip";
                                case "dj.d(IIII)V" -> "hdReset";
                                default -> null;
                            };
                            if (hook == null) super.visitMethodInsn(op, owner, name, sig, iface);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdOverlayRasterOracle", hook,
                                op == Opcodes.INVOKESTATIC ? sig : "(L" + owner + ";" + sig.substring(1), false);
                        }
                    };
                }
            }, 0);
            if (reads[0] != 6) throw new AssertionError("native HD reads " + reads[0]);
            Files.write(dir.resolve("lc.class"), output.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 2) { prepare(Path.of(args[0]), Path.of(args[1])); return; }
        glRight = dj.class.getDeclaredField("d");
        glRight.setAccessible(true);
        tf.t = new GlRecorder(null).gl();
        tf.J = 140; tf.A = 90;
        rk font = new dd(new byte[257]);
        jb.k = new qf[]{new mm(17,6), new mm(17,6)};
        nk.O = new e(); nk.O.Bc = new hh();
        nk.O.Rb = -81; nk.O.Wb = cd.a("Obj",(byte)-120);
        nk.O.Y = 73; nk.O.S = 129; nk.O.jc = 0; nk.O.Lb = 143;
        vl.j = wd.g = 0; gj.d = 60; ej.U = 0;
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            String[] v = line.split(" ");
            nk.O.s = Integer.parseInt(v[0]); tf.w = v[1].equals("1");
            toggles = Integer.parseInt(v[2]); fault = Integer.parseInt(v[3]); mutation = Integer.parseInt(v[4]);
            boolean roster = v.length > 5;
            ej.U = roster ? Integer.parseInt(v[6]) : 0;
            vl.j = wd.g = roster ? 1 : 0;
            if (roster) {
                ib.f[0] = 17; mi.S[17] = nk.O;
                cj.i[0] = 31; nm.S[31] = new km(); nm.S[31].rc = new me();
                nk.O.Vc = 0; nm.S[31].rc.H = 0;
                rl.V = km.sc = jb.k;
                ld.b[0] = new nc(); ld.b[0].q = 10; ld.b[0].p = 17;
                ld.b[1] = new nc(); ld.b[1].q = 1; ld.b[1].p = 31;
                wh.l = re.w = jb.k; j.x = font; java.util.Arrays.fill(nk.O.L, 80);
            } else { nk.O.Vc = -1; }
            wl.q = font; wl.q.ab = 9;
            jb.k[0].W = 17; jb.k[0].I = 6;
            kb.a(new int[140*90], 140, 90);
            kb.c(2,4,92,69); dj.d(7,9,103,82);
            reads = widths = ordinal = 0; calls = new StringBuilder();
            String result = "ok";
            try { lc.a(13,96,11,301,59,433,-7397); }
            catch (ld ex) { result = ex.e + "/" + ex.f.getClass().getSimpleName(); }
            System.out.println(calls + "|" + result + "|" + (tf.w?1:0) + "|" + wi.bb + "|" +
                kb.b+","+kb.d+","+kb.e+","+kb.h+"|"+dj.c+","+dj.b+","+glRight.getInt(null)+","+dj.e);
        }
    }
}
