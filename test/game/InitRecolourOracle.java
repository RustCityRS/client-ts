import java.awt.Canvas;
import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Run once from the untouched gamepack, then with watchpoints on the stores in client.b(B)V
// and the entry/return of cb.b(SS)V. The latter still recolours the real archive-7 head meshes.
public class InitRecolourOracle {
    static final Set<String> slots = Set.of("wg.b", "pb.sc", "ij.j", "sa.u", "m.C");
    static final IdentityHashMap<Object,String> identities = new IdentityHashMap<>();
    static final ArrayList<String> writes = new ArrayList<>(), recolours = new ArrayList<>();
    static int stop, oldHash;

    static void instrument(String jar, Path dir) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            for (String owner : List.of("client", "cb")) {
                ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry(owner + ".class")));
                ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
                reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                    public MethodVisitor visitMethod(int f, String n, String d, String sig, String[] ex) {
                        MethodVisitor m = super.visitMethod(f, n, d, sig, ex);
                        if (!n.equals("b")) return m;
                        if (owner.equals("client") && d.equals("(B)V")) return new MethodVisitor(Opcodes.ASM8, m) {
                            public void visitFieldInsn(int op, String c, String name, String desc) {
                                String slot = c + "." + name;
                                if (op == Opcodes.PUTSTATIC && slots.contains(slot)) {
                                    super.visitInsn(Opcodes.DUP);
                                    if (desc.equals("Z")) super.visitMethodInsn(Opcodes.INVOKESTATIC, "java/lang/Boolean", "valueOf", "(Z)Ljava/lang/Boolean;", false);
                                    super.visitLdcInsn(slot);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC, "InitRecolourOracle", "write", "(Ljava/lang/Object;Ljava/lang/String;)V", false);
                                }
                                super.visitFieldInsn(op, c, name, desc);
                            }
                        };
                        if (owner.equals("cb") && d.equals("(SS)V")) return new MethodVisitor(Opcodes.ASM8, m) {
                            public void visitCode() {
                                super.visitCode();
                                super.visitVarInsn(Opcodes.ALOAD, 0);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC, "InitRecolourOracle", "before", "(Lcb;)V", false);
                            }
                            public void visitInsn(int op) {
                                if (op == Opcodes.RETURN) {
                                    super.visitVarInsn(Opcodes.ALOAD, 0);
                                    super.visitVarInsn(Opcodes.ILOAD, 1);
                                    super.visitVarInsn(Opcodes.ILOAD, 2);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC, "InitRecolourOracle", "after", "(Lcb;SS)V", false);
                                }
                                super.visitInsn(op);
                            }
                        };
                        return m;
                    }
                }, 0);
                Files.write(dir.resolve(owner + ".class"), writer.toByteArray());
            }
        }
    }

    static String identity(Object o) {
        if (o == null) return "-";
        if (o instanceof Boolean) return o.toString();
        return Objects.requireNonNull(identities.get(o));
    }
    static String state() {
        return String.join("/", identity(wg.b), identity(ij.j), identity(sa.u), identity(m.C), identity(pb.sc));
    }
    static class Stop extends Error {}
    static void write(Object value, String name) {
        writes.add(name + "=" + identity(value) + "@" + state());
        if (writes.size() == stop) throw new Stop();
    }
    static void before(cb mesh) { oldHash = Arrays.hashCode(mesh.p); }
    static void after(cb mesh, short from, short to) {
        recolours.add(from + ">" + to + ":" + oldHash + ">" + Arrays.hashCode(mesh.p));
    }
    static String head(boolean female) throws Exception {
        gl.u.a(0);
        cl player = new cl();
        player.a(female, new int[]{2,3,4,1,3}, 0, null, -9, -1);
        fc mesh = (fc)player.a(0, 0, null, 0, -123);
        boolean cached = mesh == player.a(0, 0, null, 0, -123);
        StringJoiner result = new StringJoiner(",");
        result.add(String.valueOf(cached));
        for (String field : List.of("y","t","l","M","L")) {
            Object value = ModelMeshOracle.field(fc.class, field).get(mesh);
            result.add(String.valueOf(value instanceof int[] a ? Arrays.hashCode(a) : value instanceof short[] a ? Arrays.hashCode(a) : value));
        }
        return result.toString();
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) { instrument(args[1], Path.of(args[2])); return; }
        identities.put(gj.U, "gj.U"); identities.put(gk.o, "gk.o");
        identities.put(uh.Y, "uh.Y"); identities.put(gk.b, "gk.b");
        identities.put(lh.e, "lh.e"); identities.put(ie.J, "ie.J");
        identities.put(ik.Z, "ik.Z"); identities.put(pk.c, "pk.c");
        Class<?> unsafeClass = Class.forName("sun.misc.Unsafe");
        Object unsafe = ModelMeshOracle.field(unsafeClass, "theUnsafe").get(null);
        Method allocate = unsafeClass.getMethod("allocateInstance", Class.class);
        var page = (ClientBootOracle.Page)allocate.invoke(unsafe, ClientBootOracle.Page.class);
        client game = (client)allocate.invoke(unsafe, client.class);
        var config = new al(new ModelMeshOracle.Provider(args[0], 2), false, false);
        var models = new al(new ModelMeshOracle.Provider(args[0], 7), false, true);
        id.a(config, (byte)69, models);
        dc.r = new ModelMeshOracle.Textures();
        pe.S = new Canvas();
        d.c = 2;
        tj.m = new fb(page,32,null,0);
        var output = System.out;
        System.setOut(new PrintStream(OutputStream.nullOutputStream()));
        try (var input = new BufferedReader(new InputStreamReader(System.in))) {
            for (String line; (line = input.readLine()) != null;) {
                String[] parts = line.split(" ");
                jl.c = Integer.parseInt(parts[0]); stop = Integer.parseInt(parts[1]);
                writes.clear(); recolours.clear();
                String status = "ok", heads = "-";
                try {
                    game.b((byte)-108);
                    heads = head(false) + ";" + head(true);
                } catch (Stop interrupted) { status = "stop"; }
                finally { ud.a.a(false); }
                output.println(String.join("|",status,state(),heads,String.join(";",writes),String.join(";",recolours)));
            }
        } finally { tj.m.a(true); }
    }
}
