import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import jdk.internal.org.objectweb.asm.*;

class PreferencesOracle {
    static Field field(String owner, String name) throws Exception {
        Field f = Class.forName(owner).getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Method method(String owner, String name, Class<?>... types) throws Exception {
        Method m = Class.forName(owner).getDeclaredMethod(name, types);
        m.setAccessible(true);
        return m;
    }

    static final String SD = "dg.w rj.l oi.j lf.i b.E jh.j ai.j lf.j m.Q rf.x th.g kc.a uc.k kf.d kg.A q.b pd.t sd.N dd.u wa.c ef.E aa.h hc.a j.f oa.j lf.c wb.db we.y";
    static final String HD = "il.I ml.ab gf.N uf.b ec.n be.Kb ba.x mi.ab ra.R l.k od.c rm.g fk.g pa.N hn.X hk.eb jl.J bb.n cg.f j.v bl.W rg.F cj.h na.o lb.A k.c fb.m na.h";

    // Walk actual field instructions in the default initializer and the packed login word.
    // The two alternatives for setting particle detail are the only conditional stores.
    static String accessOrder(boolean hd, String owner, String name, String desc, int opcode) throws IOException {
        List<String> fields = Arrays.asList((hd ? HD : SD).split(" "));
        List<String> result = new ArrayList<>();
        try (var input = ClassLoader.getSystemResourceAsStream(owner + ".class")) {
            new ClassReader(input).accept(new ClassVisitor(Opcodes.ASM8) {
                public MethodVisitor visitMethod(int access, String n, String d, String sig, String[] ex) {
                    if (!name.equals(n) || !desc.equals(d)) return null;
                    return new MethodVisitor(Opcodes.ASM8) {
                        public void visitFieldInsn(int op, String o, String f, String d) {
                            int index = fields.indexOf(o + "." + f);
                            if (op == opcode && index >= 0) result.add(String.valueOf(index));
                        }
                        public void visitMethodInsn(int op, String o, String n, String d, boolean iface) {
                            String member = o + "." + n + d;
                            if (member.equals(hd ? "ec.a(IZ)V" : "pb.a(BZ)V")) result.add("1");
                            if (member.equals(hd ? "ga.c()I" : "ue.a()I") ||
                                member.equals(hd ? "ga.b(I)V" : "ue.c(I)V") && !result.contains("particles")) result.add("particles");
                        }
                    };
                }
            }, ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES);
        }
        return String.join(",", result);
    }

    static Object allocate(Class<?> c) throws Exception {
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        return unsafe.getMethod("allocateInstance", Class.class).invoke(field(unsafe.getName(), "theUnsafe").get(null), c);
    }

    // Supply the disk file at the SignLink boundary. The bundled worker handles only a
    // subset of requests; the original loader normally supplies the preference file.
    static void loadFile(boolean hd, Method load, Class<?> provider, byte[] contents) throws Exception {
        Path path = Files.createTempFile("rs530-prefs-", ".dat");
        try {
            Files.write(path, contents);
            Object link = allocate(provider);
            Field queue = field(provider.getName(), hd ? "t" : "c");
            Object file = allocate(Class.forName(hd ? "qm" : "ne"));
            Field handle = field(hd ? "qm" : "ne", hd ? "a" : "d");
            try (RandomAccessFile stream = new RandomAccessFile(path.toFile(), "r")) {
                handle.set(file, stream);
                FutureTask<Void> request = new FutureTask<>(() -> {
                    Object queued;
                    long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
                    synchronized (link) {
                        while ((queued = queue.get(link)) == null) {
                            if (System.nanoTime() >= deadline) throw new AssertionError("No preference-file request");
                            link.wait(100);
                        }
                    }
                    String req = hd ? "im" : "dj";
                    Field status = field(req, hd ? "d" : "b");
                    try {
                        if (!"runescape".equals(field(req, hd ? "c" : "d").get(queued))) throw new AssertionError("Wrong filename");
                        if (field(req, hd ? "f" : "e").getInt(queued) != 12) throw new AssertionError("Wrong request");
                        field(req, hd ? "e" : "a").set(queued, file);
                        status.setInt(queued, 1);
                    } finally {
                        if (status.getInt(queued) == 0) status.setInt(queued, 2);
                    }
                    return null;
                });
                Thread.startVirtualThread(request);
                defaults(hd, load, link);
                request.get(5, TimeUnit.SECONDS);
                if (handle.get(file) != null) throw new AssertionError("Preferences file left open");
            }
        } finally {
            Files.deleteIfExists(path);
        }
    }

    static void defaults(boolean hd, Method load, Object provider) throws Exception {
        if (hd) load.invoke(null, provider, 0);
        else load.invoke(null, -100, provider);
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        String packetName = hd ? "wa" : "gd";
        Class<?> packet = Class.forName(packetName);
        var ctor = packet.getDeclaredConstructor(byte[].class);
        ctor.setAccessible(true);
        Field pos = field(packetName, hd ? "T" : "yb"), data = field(packetName, hd ? "y" : "fb");
        Class<?> provider = Class.forName(hd ? "ll" : "fb");
        Method load = hd ? method("gf", "a", provider, int.class) : method("jd", "a", int.class, provider);
        Method read = method(hd ? "kk" : "ja", hd ? "b" : "a", packet, int.class);
        Method write = hd ? method("dl", "a", byte.class) : method("db", "b", int.class);
        Method pack = method(hd ? "lf" : "e", hd ? "c" : "a", int.class);
        Field memory = field("te", hd ? "C" : "e");
        Field context = field(hd ? "ld" : "g", hd ? "e" : "q");
        Field cause = field(hd ? "ld" : "g", hd ? "f" : "a");
        List<Field> state = new ArrayList<>();
        for (String key : (hd ? HD : SD).split(" ")) {
            String[] pair = key.split("\\.");
            state.add(field(pair[0], pair[1]));
        }
        Method particles = hd ? method("ga", "c") : method("ue", "a");
        System.out.println(accessOrder(hd, hd ? "gf" : "jd", "a", hd ? "(Lll;I)V" : "(ILfb;)V", Opcodes.PUTSTATIC));
        System.out.println(accessOrder(hd, hd ? "lf" : "e", hd ? "c" : "a", "(I)I", Opcodes.GETSTATIC));
        var in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            var p = line.split(" ", -1);
            memory.setInt(null, Integer.parseInt(p[0]));
            byte[] bytes = p[3].equals("null") ? null : HexFormat.of().parseHex(p[3]);
            Object pkt = p[2].equals("null") ? null : ctor.newInstance((Object)bytes);
            if (pkt != null) pos.setInt(pkt, Integer.parseInt(p[1]));
            String status = "ok";
            if (p[2].equals("file")) loadFile(hd, load, provider, bytes);
            else {
                defaults(hd, load, null);
                try {
                    read.invoke(null, pkt, hd ? -1 : 93);
                } catch (InvocationTargetException failure) {
                    Throwable wrapper = failure.getCause();
                    if (!context.getDeclaringClass().isInstance(wrapper)) throw failure;
                    status = ((Throwable)cause.get(wrapper)).getClass().getSimpleName() + " " + context.get(wrapper);
                }
            }
            Object encoded = hd ? write.invoke(null, (byte)-116) : write.invoke(null, -6);
            List<String> values = new ArrayList<>();
            for (Field f : state) values.add(f.get(null).toString());
            values.add(particles.invoke(null).toString());
            System.out.println(status + ";" + (pkt == null ? "-" : pos.getInt(pkt)) + ";" +
                HexFormat.of().formatHex((byte[])data.get(encoded), 0, pos.getInt(encoded)) + ";" +
                pack.invoke(null, hd ? -2 : 120) + ";" + String.join(",", values));
        }
    }
}
