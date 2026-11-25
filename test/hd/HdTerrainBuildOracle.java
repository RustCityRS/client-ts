import java.awt.Canvas;
import java.io.*;
import java.lang.reflect.*;
import java.nio.ByteBuffer;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Captures the two original terrain builders at entry and return. The JAR builds its real title
// region. Only the GL storage option at the region boundary is changed so hg.d retains the packed
// vertex bytes in its direct buffer. The VBO upload itself is independently checked by HdGeometryOracle.
public class HdTerrainBuildOracle {
    static Path directory;
    static int index;
    static DataOutputStream input;

    static void instrument(Path jar, Path output) throws Exception {
        try (JarFile j = new JarFile(jar.toFile())) {
            for (String name : new String[]{"pi","a"}) {
                ClassReader source = new ClassReader(j.getInputStream(j.getJarEntry(name + ".class")).readAllBytes());
                ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                source.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                    @Override public MethodVisitor visitMethod(int flags, String method, String desc, String sig, String[] exceptions) {
                        MethodVisitor next = super.visitMethod(flags, method, desc, sig, exceptions);
                        if (!method.equals("a") || !desc.endsWith(")[Lhg;")) return next;
                        return new MethodVisitor(Opcodes.ASM8,next) {
                            public void visitCode() {
                                super.visitCode();
                                super.visitLdcInsn(name);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdTerrainBuildOracle","begin","(Ljava/lang/String;)V",false);
                                int slot = 0;
                                for (jdk.internal.org.objectweb.asm.Type arg : jdk.internal.org.objectweb.asm.Type.getArgumentTypes(desc)) {
                                    boolean integer = arg.getSort() == jdk.internal.org.objectweb.asm.Type.INT;
                                    super.visitVarInsn(integer ? Opcodes.ILOAD : Opcodes.ALOAD, slot++);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdTerrainBuildOracle",integer ? "number" : "array",
                                        integer ? "(I)V" : "(Ljava/lang/Object;)V", false);
                                }
                            }
                            public void visitInsn(int op) {
                                if (op == Opcodes.ARETURN) {
                                    super.visitInsn(Opcodes.DUP);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdTerrainBuildOracle","finish","([Lhg;)V",false);
                                }
                                super.visitInsn(op);
                            }
                        };
                    }
                },0);
                Files.write(output.resolve(name + ".class"),writer.toByteArray());
            }
        }
    }

    public static void begin(String name) throws IOException {
        input = new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(directory.resolve(index + ".bin"))));
        input.writeByte(name.equals("pi") ? 0 : 1);
    }

    public static void number(int v) throws IOException { input.writeInt(v); }

    public static void array(Object value) throws IOException {
        if (value == null) { number(-1); return; }
        number(Array.getLength(value));
        if (value instanceof byte[] bytes) input.write(bytes);
        else if (value instanceof int[] ints) for (int v : ints) number(v);
        else if (value instanceof float[] floats) for (float v : floats) number(Float.floatToRawIntBits(v));
        else for (Object row : (Object[])value) array(row);
    }

    static Object field(hg b, String name) throws ReflectiveOperationException {
        Field f = hg.class.getDeclaredField(name);
        f.setAccessible(true);
        return f.get(b);
    }

    public static void finish(hg[] batches) throws Exception {
        input.close();
        try (PrintWriter out = new PrintWriter(Files.newBufferedWriter(directory.resolve(index + ".txt")))) {
            for (hg b : batches) {
                ByteBuffer v = ((ByteBuffer)field(b,"s")).duplicate();
                byte[] bytes = new byte[v.remaining()];
                v.get(bytes);
                String vertices = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
                MessageDigest hash = MessageDigest.getInstance("SHA-256");
                try (DataOutputStream outTiles = new DataOutputStream(new java.security.DigestOutputStream(OutputStream.nullOutputStream(),hash))) {
                    int count = (int)field(b,"O");
                    for (int tile = 0; tile < count; tile++) {
                        for (String s : new String[]{"P","x","w"}) outTiles.writeInt(((int[])field(b,s))[tile]);
                        int[] polygon = ((int[][])field(b,"E"))[tile];
                        outTiles.writeInt(polygon.length);
                        for (int i : polygon) outTiles.writeInt(i);
                        if (b.M) {
                            int[] blend = ((int[][])field(b,"I"))[tile];
                            outTiles.writeInt(blend == null ? -1 : blend.length);
                            if (blend != null) for (int i : blend) outTiles.writeInt(i);
                            outTiles.writeBoolean(((boolean[])field(b,"S"))[tile]);
                        }
                    }
                }
                out.println(b.a + " " + b.y + " " + b.C + " " + b.p + " " + b.q + " " + b.r + " " +
                    field(b,"O") + " " + field(b,"G") + " " + field(b,"D") + " " + vertices + " " + HexFormat.of().formatHex(hash.digest()));
            }
        }
        index++;
    }

    // The title has no underwater region. Exercise depth coordinates and all twelve tile shapes
    // at all rotations with real archive materials, including smooth overlay edge neighbours.
    static void shapedTiles() {
        byte[][][] flags = new byte[4][104][104];
        byte[][] shapes = new byte[104][104], rotations = new byte[104][104];
        byte[][] underlays = new byte[104][104], overlays = new byte[104][104];
        int[][] heights = new int[105][105], surface = new int[105][105], lighting = new int[105][105];
        int[][] hsl = new int[105][105], water = new int[104][104];
        float[][] nx = new float[105][105], ny = new float[105][105], nz = new float[105][105];
        int[] smooth = new int[4];
        int found = 0;
        for (int id = 0; id < 255 && found < smooth.length; id++) {
            wl overlay = um.a((byte)-81,id);
            if (overlay.j && overlay.z != -1) smooth[found++] = id + 1;
        }
        if (found != 4) throw new AssertionError("Expected four smooth overlays");
        for (int x = 22; x < 40; x++) {
            for (int z = 22; z < 40; z++) {
                int dx = x - 22, dz = z - 22;
                heights[x][z] = -16 * (x ^ z);
                surface[x][z] = heights[x][z] - ((x * 23 + z * 17) & 255);
                lighting[x][z] = 20 + ((x * 13 + 7 * z) & 127);
                hsl[x][z] = (x * 643 + z * 17) & 65535;
                nx[x][z] = (dx - 8) * 0.071f;
                ny[x][z] = -0.63f - dz * 0.003f;
                nz[x][z] = (dz - 9) * 0.06f;
                if (dx == 0 || dz == 0 || dx >= 17 || dz >= 17) continue;
                int shape = (dx - 1) % 12;
                shapes[x][z] = (byte)shape;
                rotations[x][z] = (byte)((dz - 1) & 3);
                underlays[x][z] = (byte)(1 + (dx + 2 * dz) % 6);
                overlays[x][z] = (byte)(dz <= 12 ? smooth[(dx * 3 + dz) & 3] : 0);
                flags[1][x][z] = (byte)((x + z) % 3 == 0 ? 2 : 0);
                flags[2][x][z] = (byte)((x ^ z) % 4 == 0 ? 8 : 0);
                water[x][z] = ((1 + ((x + z) & 7)) << 24) | ((x & 1) == 0 ? 0x1f53a1 : 0x42932f);
            }
        }
        pi.a(flags,shapes,underlays,lighting,ny,water,overlays,rotations,nx,2,nz,hsl,heights,surface,4096);
        a.a(ny,nx,heights,2,nz,rotations,lighting,0,shapes,underlays,overlays,flags);
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) { instrument(Path.of(args[1]), Path.of(args[2])); return; }
        directory = Path.of(args[1]);
        Canvas canvas = new Canvas() { public boolean isDisplayable() { return true; } };
        canvas.setSize(765,503);
        try (GlRecorder capture = new GlRecorder(directory); AutoCloseable factory = capture.installFactory()) {
            capture.loadProfile(Path.of(args[2]));
            HdTitleFrameOracle.run(Path.of(args[0]),canvas,i -> {},stage -> {
                if (stage.equals("region.build")) {
                    tf.C = false;
                    for (int i = 0; i < hf.a.length; i++) hf.a[i] = (i * 0x73a753 + 0x552318) & 0xffffff;
                }
                if (stage.equals("warmup")) shapedTiles();
            });
        }
        System.out.println("terrain builders " + index);
    }
}
