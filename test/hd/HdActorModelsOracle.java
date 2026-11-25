import java.awt.Canvas;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

/** Stops at td.WorldRender, after the original actor assembled, posed and fitted each model. */
public class HdActorModelsOracle {
    static final class Complete extends Error {}
    static boolean measuring;
    static StringBuilder commands = new StringBuilder();
    static IdentityHashMap<td,Integer> releaseModels = new IdentityHashMap<>();

    public static void prepared(td model, boolean a, boolean b, boolean c, boolean d, boolean e, boolean f, boolean g) {
        Integer id = releaseModels.get(model);
        if (id != null) commands.append(" ").append(id).append(':').append(a ? 1 : 0).append(b ? 1 : 0).append(c ? 1 : 0)
            .append(d ? 1 : 0).append(e ? 1 : 0).append(f ? 1 : 0).append(g ? 1 : 0);
    }

    public static void draw(td model, int yaw, long tag, int flags, ga particles) throws Exception {
        if (!measuring) return;
        commands.append(" draw(").append(yaw).append(',').append(tag).append(',').append(flags).append(',')
            .append(particles != null).append(',').append(model.s).append(',').append(model.I).append(',').append(HdLocModelOracle.field(td.class,"lb").getInt(model)).append(')');
        for (String name : new String[]{"H","eb","hb","w","P","Q","t","B"}) {
            commands.append(':').append(HdLocModelOracle.digest(HdLocModelOracle.field(td.class,name).get(model)));
        }
    }
    public static void op(String method) {
        if (measuring) commands.append(' ').append(method);
    }
    public static void bias(float distance, float offset) {
        if (measuring) commands.append(" bias(").append((int)distance).append(',').append((int)offset).append(')');
    }
    public static void instrument(Path jar, Path out) throws Exception {
        try (JarFile source = new JarFile(jar.toFile())) {
            for (String owner : new String[]{"tf","td"}) {
                ClassReader reader = new ClassReader(source.getInputStream(source.getJarEntry(owner+".class")));
                ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                    public MethodVisitor visitMethod(int flags,String name,String desc,String sig,String[] exceptions) {
                        MethodVisitor mv = super.visitMethod(flags,name,desc,sig,exceptions);
                        if (owner.equals("td") && desc.equals("(IIIIIIIIJILga;)V")) {
                            mv.visitCode();
                            mv.visitVarInsn(Opcodes.ALOAD,0);
                            mv.visitVarInsn(Opcodes.ILOAD,1);
                            mv.visitVarInsn(Opcodes.LLOAD,9);
                            mv.visitVarInsn(Opcodes.ILOAD,11);
                            mv.visitVarInsn(Opcodes.ALOAD,12);
                            mv.visitMethodInsn(Opcodes.INVOKESTATIC,"HdActorModelsOracle","draw","(Ltd;IJILga;)V",false);
                            mv.visitInsn(Opcodes.RETURN);
                            mv.visitMaxs(0,0); mv.visitEnd();
                            return null;
                        }
                        if (owner.equals("td") && desc.equals("(ZZZZZZZ)V")) {
                            return new MethodVisitor(Opcodes.ASM8,mv) {
                                public void visitCode() {
                                    super.visitCode();
                                    super.visitVarInsn(Opcodes.ALOAD,0);
                                    for (int i = 1; i <= 7; i++) super.visitVarInsn(Opcodes.ILOAD,i);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdActorModelsOracle","prepared","(Ltd;ZZZZZZZ)V",false);
                                }
                            };
                        }
                        if (!owner.equals("tf")) return mv;
                        String op = switch(name+desc) {
                            case "r()F" -> "distance"; case "l()F" -> "offset"; case "q()V" -> "disable"; case "g()V" -> "enable"; case "a(FF)V" -> "bias";
                            default -> null;
                        };
                        if (op == null) return mv;
                        return new MethodVisitor(Opcodes.ASM8,mv) {
                            public void visitCode() {
                                super.visitCode();
                                if (op.equals("bias")) {
                                    super.visitVarInsn(Opcodes.FLOAD,0);
                                    super.visitVarInsn(Opcodes.FLOAD,1);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdActorModelsOracle","bias","(FF)V",false);
                                } else {
                                    super.visitLdcInsn(op);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdActorModelsOracle","op","(Ljava/lang/String;)V",false);
                                }
                            }
                        };
                    }
                },0);
                Files.write(out.resolve(owner+".class"),writer.toByteArray());
            }
        }
    }

    static void cases() throws Exception {
        tf.C = false;
        cj.e = md.V;
        mj.C = pk.V;
        nj.m = dg.c;
        qe.r = vd.B;
        ee.b = 0;
        bb.g = new byte[4][104][104];
        gj.m = new int[4][105][105];
        for (int x = 0; x < 105; x++) for (int z = 0; z < 105; z++) gj.m[0][x][z] = -32 - ((x*x + 13*z - 5*x*z)&127);
        tf.a(3000.0f,12.0f);
        for (int kind = 0; kind < 6; kind++) {
            for (int variant = 0; variant < 8; variant++) {
                boolean animate = (variant & 1) != 0;
                fe actor;
                if (kind == 3) {
                    km npc = new km();
                    npc.rc = rg.b(1,27112);
                    actor = npc;
                } else {
                    e player = new e();
                    player.Bc = new hh();
                    player.Bc.a(new int[]{0,1,2,1,3},kind == 2 ? 1 : -1,kind == 1,0,null,-1);
                    if (kind == 5) {
                        int[] equipment = ((int[])HdLocModelOracle.field(hh.class,"l").get(player.Bc)).clone();
                        equipment[0] = 0x40000000 | 1155;
                        equipment[3] = 0x40000000 | 1277;
                        equipment[4] = 0x40000000 | 1117;
                        equipment[7] = 0x40000000 | 1067;
                        player.Bc.a(new int[]{0,1,2,1,3},-1,false,0,equipment,-1);
                    }
                    if (kind == 4) {
                        nk.O = player;
                        Arrays.fill(ld.b,null);
                        nc arrow = ld.b[ld.b.length-1] = new nc();
                        arrow.q = 2;
                        arrow.k = 731;
                        arrow.l = 14;
                        arrow.c = 14;
                        se.a = lc.n = 0;
                        gj.d = 5;
                        player.nb = new td(gb.a(vl.g,731,0),64,768,false);
                        player.pb = 4;
                        player.V = 8;
                        player.Z = 700;
                        player.Jb = 80;
                        player.fc = 1300;
                        player.Ab = (variant & 3) * 512;
                    }
                    actor = player;
                }
                ra.R = (variant & 2) != 0;
                actor.Qb = 1460;
                actor.ac = 1530;
                actor.dc = -73;
                actor.G = -1;
                actor.O = animate ? 808 : -1;
                actor.ec = 0;
                actor.T = 1;
                actor.B = 1;
                actor.Zb = 0;
                if ((variant & 4) != 0) {
                    actor.oc = 1; actor.zb = 0; actor.Xb = 1; actor.C = 1; actor.tb = 11;
                }
                commands.setLength(0);
                measuring = true;
                try { actor.a(384,0,65536,0,65536,0,0,600,987654321L,3,null); }
                finally { measuring = false; }
                if (kind == 4) {
                    td attach = (td)((e)actor).nb;
                    for (String name : new String[]{"H","eb","hb"}) commands.append(" attach:").append(HdLocModelOracle.digest(HdLocModelOracle.field(td.class,name).get(attach)));
                }
                System.out.println("actor " + kind + " " + variant + " " + actor.Rb + commands);
            }
        }
    }

    static td tagged() throws Exception {
        Constructor<td> create = td.class.getDeclaredConstructor();
        create.setAccessible(true);
        td model = create.newInstance();
        releaseModels.put(model, releaseModels.size()+1);
        return model;
    }

    static void release() throws Exception {
        kc.o = new bj[2][2][2];
        for (int i = 0; i < 2; i++) {
            bj tile = kc.o[i][1-i][i] = new bj(i,1-i,i);
            long tag = i == 0 ? 23L : Long.MIN_VALUE + 36;
            tile.G = new bm(); tile.G.c = tagged(); tile.G.m = tag;
            tile.J = new df(); tile.J.j = tagged(); tile.J.d = tagged(); tile.J.i = ~tag;
            tile.K = new jh(); tile.K.e = tagged(); tile.K.h = tagged(); tile.K.d = tag;
            tile.y = 2;
            tile.w[0] = new ec(); tile.w[0].c = tagged(); tile.w[0].A = tag;
            tile.w[1] = new ec(); tile.w[1].c = tagged(); tile.w[1].A = ~tag;
        }
        sk.lb = false;
        for (boolean active : new boolean[]{false,true,true}) {
            tf.w = active;
            commands.setLength(0);
            bf.c(1);
            System.out.println("release " + active + " " + sk.lb + commands);
        }
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) { instrument(Path.of(args[1]),Path.of(args[2])); return; }
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765,503);
        try (GlRecorder recorder = new GlRecorder(Path.of(args[1])); AutoCloseable install = recorder.installFactory()) {
            recorder.loadProfile(Path.of(args[2]));
            try {
                HdTitleFrameOracle.run(Path.of(args[0]),canvas,tick -> {},stage -> {
                    if (!stage.equals("warmup")) return;
                    try { cases(); release(); } catch (Exception ex) { if (ex instanceof ld wrap) { System.err.println(wrap.e); wrap.f.printStackTrace(); } throw new AssertionError(ex); }
                    throw new Complete();
                });
            } catch (Complete expected) {}
        }
    }
}
