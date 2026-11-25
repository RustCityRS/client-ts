import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import jdk.internal.org.objectweb.asm.*;

/** The original archive-3 inventory widget, obj/model decode, na.a composition and gn.a slot draws. */
public final class HdInventoryIconsOracle {
    private static final List<String> dragFields = new ArrayList<>();
    public static void field(String access) { dragFields.add(access); }

    // Observe the original instructions from the post-drag renderer check to the
    // highlight branch. Existing field loads, stores and branches remain in place.
    private static void instrument(Path dir) throws Exception {
        ClassReader reader = new ClassReader("gn");
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            public MethodVisitor visitMethod(int access, String name, String desc, String signature, String[] exceptions) {
                MethodVisitor method = super.visitMethod(access,name,desc,signature,exceptions);
                if (!name.equals("a") || !desc.equals("(III[Lbe;IIIIBI)V")) return method;
                return new MethodVisitor(Opcodes.ASM8, method) {
                    boolean afterDragCycles, observing;
                    public void visitFieldInsn(int op, String owner, String name, String descriptor) {
                        String member = owner+"."+name;
                        if (member.equals("gd.j")) afterDragCycles = true;
                        if (afterDragCycles && member.equals("tf.w")) observing = true;
                        if (member.equals("v.b")) { afterDragCycles = false; observing = false; }
                        if (observing && switch (member) {
                            case "tf.w","dj.b","dj.e","kb.d","kb.h","be.hb","be.R","be.bc","od.i","qk.f" -> true;
                            default -> false;
                        }) {
                            super.visitLdcInsn((op == Opcodes.PUTFIELD || op == Opcodes.PUTSTATIC ? "store " : "load ") + member);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdInventoryIconsOracle","field","(Ljava/lang/String;)V",false);
                        }
                        super.visitFieldInsn(op,owner,name,descriptor);
                    }
                };
            }
        }, 0);
        Files.write(dir.resolve("gn.class"),writer.toByteArray());
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) { instrument(Path.of(args[1])); return; }
        Path cache = Path.of(args[0]);
        en data = HdTitleFrameOracle.open(cache.resolve("main_file_cache.dat2"), 5200);
        en index = HdTitleFrameOracle.open(cache.resolve("main_file_cache.idx255"), 6000);
        ge master = new ge(255, data, index, 500000);
        Map<Integer, HdTitleFrameOracle.Disk> disks = new LinkedHashMap<>();
        Map<Integer, ve> archives = new LinkedHashMap<>();
        try (GlRecorder recorder = new GlRecorder(Path.of(args[1]))) {
            for (int id : new int[]{3,7,8,9,13,19,26}) {
                var disk = new HdTitleFrameOracle.Disk(master, data, cache, id);
                disks.put(id, disk);
                archives.put(id, new ve(disk, id != 9, true));
            }
            ve sprites = archives.get(8);
            dd font = (dd)k.a(0, Integer.parseInt(args[3]), (byte)124, sprites, archives.get(13));
            th.a(true, (byte)-128, archives.get(19), font, archives.get(7));
            hf.a(new nk(archives.get(9), archives.get(26), sprites, 20, false));
            var rng = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
            rng.setAccessible(true);
            ((Random)rng.get(null)).setSeed(530);
            hf.a(0.7f);
            recorder.loadProfile(Path.of(args[2]));
            tf.t = recorder.gl(); tf.J = 191; tf.A = 270;
            sc.z[0] = true; nk.O = new e();
            be grid = new be();
            grid.Fc = 149 << 16;
            grid.a(-115, new wa(archives.get(3).a(149, (byte)-122, 0)));
            grid.n = 190; grid.R = 268;
            int[] items = {1351,590,995,4151,4152,13444,303};
            for (int i = 0; i < items.length; i++) {
                grid.dc[i] = items[i] + 1;
                grid.wd[i] = i == 2 ? 101 : 1;
            }
            for (boolean active : new boolean[]{false,true}) {
                tf.w = active;
                jd.c = new n(100);
                grid.N = -1;
                jd.i = null;
                for (int frame = 0; frame < 3; frame++) {
                    recorder.mark("inventory." + active + "." + frame);
                    int[] target = new int[191*270];
                    Arrays.fill(target, 0x345678);
                    kb.a(target,191,270);
                    vd.C = frame == 2 ? 1 : 0; sd.R = grid.Fc; p.e = 0;
                    v.b = frame == 2 ? grid : null; uf.t = 1;
                    gn.a(0, 2, 3, new be[]{grid}, 191, -1, 0, 270, (byte)119, 0);
                    qf first = pf.a(frame == 2 ? 2 : 1, items[0], grid.Bb, 1, frame == 2 ? 0 : 0x302020, 65536);
                    System.out.println(active + " " + frame + " " + first.getClass().getName() + " " + Arrays.hashCode(target));
                }
                recorder.mark("inventory." + active + ".drag");
                grid.N = 1; jd.i = grid; ac.n = 0; gd.j = 5;
                for (int y : new int[]{150,-150,83,-1}) {
                    be parent = new be(); parent.N = -77; parent.hb = 30; parent.R = 30; parent.bc = 200;
                    od.i = 3; sc.v = y; qk.f = 0;
                    kb.a(new int[191*270],191,270);
                    dragFields.clear();
                    gn.a(0, 2, 3, new be[]{grid,parent}, 191, 1, 40, 110, (byte)119, 0);
                    System.out.println("drag " + active + " " + y + " " + parent.hb + " " + qk.f + " " + String.join(",",dragFields));
                }
            }
        } finally {
            for (var disk : disks.values()) disk.file.b(false);
            index.b(false);
            data.b(false);
        }
    }
}
