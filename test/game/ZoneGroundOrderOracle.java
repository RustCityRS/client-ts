import java.io.*;
import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class ZoneGroundOrderOracle {
    static final Field cursor;
    static {
        try { cursor = gk.class.getDeclaredField("t"); cursor.setAccessible(true); }
        catch (ReflectiveOperationException error) { throw new AssertionError(error); }
    }

    // Observe the existing field loads while leaving all list, packet and scene operations in the gamepack.
    static void instrument(String jarPath, Path output) throws Exception {
        try (JarFile jar = new JarFile(jarPath)) {
            for (String cls : List.of("qd", "ng")) {
                ClassReader reader = new ClassReader(jar.getInputStream(jar.getJarEntry(cls + ".class")));
                ClassWriter writer = new ClassWriter(reader, 0);
                reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                    public MethodVisitor visitMethod(int flags, String method, String desc, String sig, String[] exceptions) {
                        MethodVisitor original = super.visitMethod(flags, method, desc, sig, exceptions);
                        if (!(cls.equals("qd") && method.equals("a") && desc.equals("(I)V")) &&
                            !(cls.equals("ng") && method.equals("b") && desc.equals("(III)V"))) return original;
                        return new MethodVisitor(Opcodes.ASM8, original) {
                            public void visitFieldInsn(int op, String owner, String name, String type) {
                                if (op == Opcodes.GETSTATIC && owner.equals("b") && name.equals("H"))
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC, "ZoneGroundOrderOracle", "grid", "()[[[Lgk;", false);
                                else if (op == Opcodes.GETSTATIC && owner.equals("ah") && name.equals("f"))
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC, "ZoneGroundOrderOracle", "plane", "()I", false);
                                else super.visitFieldInsn(op, owner, name, type);
                            }
                        };
                    }
                }, 0);
                Files.write(output.resolve(cls + ".class"), writer.toByteArray());
            }
        }
    }

    static gk[][][] oldGrid, newGrid;
    static int watchAt, change, accesses;
    static StringBuilder accessesSeen;
    static gk[] retained;
    static final List<jf> nodes = new ArrayList<>();
    static final IdentityHashMap<gk, String> queues = new IdentityHashMap<>();

    static void watch(String event) {
        accessesSeen.append(event);
        if (++accesses != watchAt) return;
        switch (change) {
            case 0 -> b.H = newGrid;
            case 1 -> ah.f = 1;
            case 2 -> { b.H = newGrid; ah.f = 1; }
            case 3 -> b.H = null;
            case 4 -> ah.f = 2;
        }
    }
    public static gk[][][] grid() {
        gk[][][] captured = b.H;
        watch(captured == oldGrid ? "A" : captured == newGrid ? "B" : "-");
        return captured;
    }
    public static int plane() {
        int captured = ah.f;
        watch("" + captured);
        return captured;
    }

    static void item(gk list, int id) {
        jf node;
        if (id == -1) node = new jf();
        else {
            ig item = new ig();
            item.m = id;
            item.p = 7;
            node = new b(item);
        }
        list.a(node, false);
        nodes.add(node);
    }

    static String ref(gk q) {
        if (q == null) return "-";
        return queues.computeIfAbsent(q, k -> "q" + queues.size());
    }
    static String ref(jf n) {
        if (n == null) return "-";
        for (var entry : queues.entrySet()) if (entry.getKey().c == n) return entry.getValue();
        if (n instanceof b obj) return "n" + obj.T.m + ":" + obj.T.p;
        return "wrong";
    }
    static String contents(gk q) throws Exception {
        StringJoiner result = new StringJoiner(",");
        for (jf n = q.c.g; n != q.c; n = n.g) result.add(ref(n));
        return ref(q) + "[" + result + "]" + ref((jf)cursor.get(q));
    }

    static void row(int op, int initial, int at, int effect, byte[] body) throws Exception {
        oldGrid = new gk[2][1][1]; newGrid = new gk[2][1][1];
        retained = new gk[4];
        nodes.clear(); queues.clear();
        for (int i = 0; i < 4; i++) {
            gk q = retained[i] = new gk();
            ref(q);
            if (i > 0) item(q, 11 + i);
            if (i > 0 || initial != 0) (i < 2 ? oldGrid : newGrid)[i & 1][0][0] = q;
        }
        gk q = retained[0];
        switch (initial) {
            case 2 -> item(q, 11);
            case 3 -> { item(q, -1); item(q, 11); }
            case 4 -> { item(q, 12); item(q, -1); item(q, 11); }
            case 5 -> { item(q, 11); item(q, -1); }
            case 6 -> { item(q, 12); item(q, 11); }
        }
        kl.Bb = new ra[2][1][1];
        b.H = oldGrid; ah.f = 0; dg.C = ha.a = 0; mi.y = 73;
        ve.q = null;
        watchAt = at; change = effect; accesses = 0; accessesSeen = new StringBuilder();
        hd.b = new be(body.length); hd.b.fb = body; o.Y = op;
        String status = "ok";
        try { qd.a(64); }
        catch (RuntimeException error) {
            Throwable cause = error;
            while (cause instanceof g wrapped) cause = wrapped.a;
            status = cause.getClass().getSimpleName() + "@" + (error instanceof g wrapped ? wrapped.q : "");
        }
        StringJoiner slots = new StringJoiner(","), lists = new StringJoiner(";"), links = new StringJoiner(";");
        for (gk[][][] root : new gk[][][][]{oldGrid,newGrid})
            for (gk[][] layer : root) slots.add(ref(layer[0][0]));
        var ordered = new ArrayList<>(queues.keySet());
        ordered.sort(Comparator.comparing(ZoneGroundOrderOracle::ref));
        for (gk list : ordered) lists.add(contents(list));
        for (jf node : nodes) links.add(ref(node.p) + "/" + ref(node) + "/" + ref(node.g));
        StringJoiner scene = new StringJoiner(",");
        for (ra[][] layer : kl.Bb) {
            ra tile = layer[0][0];
            scene.add(tile == null || tile.y == null ? "-" : "" + ((ig)tile.y.k).m);
        }
        System.out.println(status + "|" + hd.b.yb + "|" + accessesSeen + "|" + ah.f + "|" +
            (b.H == oldGrid ? "A" : b.H == newGrid ? "B" : "-") + "|" + slots + "|" + lists + "|" + links + "|" + scene);
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) { instrument(args[0], Path.of(args[1])); return; }
        for (int i = 11; i <= 14; i++) {
            kl obj = new kl(); obj.h = i; fa.b.a(i, obj, (byte)-71);
        }
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            String[] words = line.split(" ");
            row(Integer.parseInt(words[0]), Integer.parseInt(words[1]), Integer.parseInt(words[2]),
                Integer.parseInt(words[3]), HexFormat.of().parseHex(words[4]));
        }
    }
}
