import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class HdTitleRegionOracle {
    static final List<String> log = new ArrayList<>();
    static int scenario;
    static int failAt;
    static int requests;
    static ve maps;
    static int[] originalGround;

    // ca.h keeps all original arithmetic, array allocations and stores. Observe the archive boundary, and stop
    // the called map builder at its entry. fm.a keeps its real UI table, local player, camera and environment writes.
    static void patch(String jar, Path out) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            for (String owner : new String[] { "ca", "fm" }) {
                ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry(owner + ".class")));
                ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
                reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                    public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] errors) {
                        MethodVisitor mv = super.visitMethod(access, name, desc, sig, errors);
                        if (!(owner.equals("ca") && name.equals("h") && desc.equals("(I)V")) &&
                            !(owner.equals("fm") && name.equals("a") && desc.equals("(ZI)V"))) return mv;
                        return new MethodVisitor(Opcodes.ASM8, mv) {
                            public void visitMethodInsn(int op, String o, String n, String d, boolean itf) {
                                String replace = switch (o + "." + n + d) {
                                    case "ve.a(Lna;B)I" -> "lookup";
                                    case "k.a(IIIIZIZ)V" -> "rebuild";
                                    case "ig.a(BI)V" -> "closeTop";
                                    case "ke.a(ZLwk;Z)V" -> "closeSub";
                                    case "eb.d(I)V" -> "resetInterfaces";
                                    case "rb.a(ZB)V" -> "resize";
                                    case "gn.b(Z)V" -> "redraw";
                                    case "fn.c(II)V" -> "onLoad";
                                    case "gg.c(II)V" -> "cursor";
                                    case "lf.a(ILve;)V" -> "flames";
                                    case "pl.a(II)V" -> "state";
                                    default -> null;
                                };
                                if (replace == null) super.visitMethodInsn(op, o, n, d, itf);
                                else super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdTitleRegionOracle", replace,
                                    replace.equals("lookup") ? "(Lve;Lna;B)I" : d, false);
                            }
                        };
                    }
                }, 0);
                Files.write(out.resolve(owner + ".class"), writer.toByteArray());
            }
        }
    }

    public static int lookup(ve archive, na name, byte guard) {
        if (archive == null) throw new NullPointerException();
        String text = new String(name.T, 0, name.lb, StandardCharsets.US_ASCII);
        int id = archive.a(name, guard);
        requests++;
        if (scenario == 1) id = text.startsWith("n") && (requests & 1) == 1 ? -1 : requests + 4000;
        log.add(text + "=" + id);
        if (requests == failAt) throw new IllegalArgumentException();
        if (scenario == 2 && requests == 1) ca.Z = null;
        if (scenario == 3 && requests == 1) {
            originalGround = client.lb;
            client.lb = new int[18];
            Arrays.fill(client.lb, 9191);
        }
        return id;
    }

    public static void rebuild(int level, int zoneZ, int zoneX, int localZ, boolean title, int localX, boolean dummy) {
        log.add("rebuild " + level + " " + zoneZ + " " + localX + " " + zoneX + " " + localZ + " " + title);
    }
    public static void closeTop(byte guard, int id) { log.add("close " + id); }
    public static void closeSub(boolean discard, wk sub, boolean guard) {
        log.add("sub " + sub.a + " " + sub.r + " " + discard);
        sub.b(-1024);
    }
    public static void resetInterfaces(int guard) { log.add("reset"); }
    public static void resize(boolean resize, byte guard) { log.add("resize " + resize); }
    public static void redraw(boolean guard) { log.add("redraw"); }
    public static void onLoad(int id, int guard) { log.add("load " + id); }
    public static void cursor(int id, int guard) { log.add("cursor " + id); }
    public static void flames(int guard, ve sprites) { log.add("flames"); }
    public static void state(int state, int guard) { log.add("state " + state); }

    static String emptyFiles(byte[][] files) {
        return files == null ? "null" : files.length + "/" + Arrays.stream(files).filter(x -> x != null).count();
    }
    static String array(int[] items) { return Arrays.toString(items).replace(" ", ""); }
    static void run(int path, boolean open, boolean gl, int camera, int x, int z, int baseX, int baseZ, int mode, int fail) {
        log.clear();
        scenario = mode; failAt = fail; requests = 0;
        originalGround = null;
        ca.Z = maps;
        km.Pc = x; kh.f = z; se.a = baseX; lc.n = baseZ;
        tm.g = -21; uc.f = 387;
        sg.o = camera; me.k = -1; eb.t = -1;
        if (camera == 4) {
            sg.o = 3;
            me.k = 0; eb.t = 1; k.i = 0; g.d = 0; t.z = 5731; sh.c = 432; j.K = 3011;
            id.d = new int[][][] {
                {{399250, 307, 418761}, {388555, -18, 378200}, {435567, 1414, 459298}, {490917, 17, 381943}},
                {{412318, 355, 415048}, {385713, 2340, 402148}, {409999, -932, 385165}, {470130, 1514, 377201}}
            };
        }
        md.W = 331; mf.X = 738; je.T = new sc(8);
        for (int key : new int[] { 3, 1, 9 }) {
            wk sub = new wk();
            sub.r = 700 + key;
            je.T.a(1, sub, key);
        }
        if (mode == 4) je.T.a(1, new ab(), 2);
        wb.c = 3; cl.Y = 500; nk.O = null; tf.w = gl; sa.W = false;
        mf.O = pg.jb = pa.L = we.H = bi.Y = null;
        cl.V = client.lb = te.H = nm.P = hk.bb = nj.j = null;
        fl.D = null;
        String fault = "-";
        try {
            if (path == 0) ca.h(20479);
            else fm.a(open, 3000);
        } catch (ld e) {
            fault = e.f.getClass().getSimpleName() + "/" + e.e;
        }
        String keys = fl.D == null ? "null" : fl.D.length + "/" + Arrays.stream(fl.D).filter(a -> Arrays.equals(a, new int[4])).count();
        System.out.println(String.join(";", log) + "|" + fault + "|" + km.Pc + "," + kh.f + "," + sa.W + "," + md.W + "," + cl.Y + ","
            + (nk.O == null ? "null" : nk.O.ac + "/" + nk.O.Qb) + "|" + array(te.H) + "|" + array(client.lb) + "|" + array(nj.j)
            + "|" + array(nm.P) + "|" + array(hk.bb) + "|" + array(cl.V) + "|" + keys + "|" +
            String.join(",", emptyFiles(mf.O), emptyFiles(pg.jb), emptyFiles(pa.L), emptyFiles(we.H), emptyFiles(bi.Y)) + "|" + array(originalGround));
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("patch")) { patch(args[1], Path.of(args[2])); return; }
        Path cache = Path.of(args[0]);
        en data = HdTitleFrameOracle.open(cache.resolve("main_file_cache.dat2"), 5200);
        en reference = HdTitleFrameOracle.open(cache.resolve("main_file_cache.idx255"), 6000);
        maps = new ve(new HdTitleFrameOracle.Disk(new ge(255, data, reference, 500000), data, cache, 5), false, false);
        for (String row : Files.readAllLines(Path.of(args[1]))) {
            int[] a = Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray();
            run(a[0], a[1] != 0, a[2] != 0, a[3], a[4], a[5], a[6], a[7], a[8], a[9]);
        }
    }
}
