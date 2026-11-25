import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class HdDynamicChunkOracle {
    static wa packet;

    // Keep a reference to the actual decoder packet so fault cases can compare its final cursor.
    static void instrument(String jar, String directory) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry("tm.class")));
            ClassWriter writer = new ClassWriter(ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] exceptions) {
                    MethodVisitor mv = super.visitMethod(access, name, desc, sig, exceptions);
                    if (!name.equals("a") || !desc.equals("(III[Lmj;IB[BIIIZ)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8, mv) {
                        public void visitMethodInsn(int op, String owner, String name, String desc, boolean itf) {
                            super.visitMethodInsn(op, owner, name, desc, itf);
                            if (owner.equals("wa") && name.equals("<init>") && desc.equals("([B)V")) {
                                super.visitInsn(Opcodes.DUP);
                                super.visitFieldInsn(Opcodes.PUTSTATIC, "HdDynamicChunkOracle", "packet", "Lwa;");
                            }
                        }
                    };
                }
            }, 0);
            Files.write(Path.of(directory, "tm.class"), writer.toByteArray());
        }
    }

    static void run(String recipe) throws Exception {
        String[] fields = recipe.split(" ");
        int rot = Integer.parseInt(fields[0]), x = Integer.parseInt(fields[1]), z = Integer.parseInt(fields[2]);
        int level = Integer.parseInt(fields[3]), source = Integer.parseInt(fields[4]);
        boolean water = fields[5].equals("1");
        tf.w = fields[6].equals("1");
        int planes = water ? 1 : 4;
        byte[] trailer = fields[7].equals("-") ? new byte[0] : HexFormat.of().parseHex(fields[7]);
        int terrainLength = planes * 64 * 64 * 3;
        byte[] data = new byte[terrainLength + trailer.length];
        for (int i = 0; i < terrainLength / 3; i++) {
            data[i*3] = (byte)(50 + (i & 1));
            data[i*3+1] = 1;
            data[i*3+2] = (byte)(2 + (i % 123));
        }
        System.arraycopy(trailer, 0, data, terrainLength, trailer.length);
        mj[] maps = {new mj(104,104), new mj(104,104), new mj(104,104), new mj(104,104)};
        sm.e = new byte[4][104][104];
        gj.m = new int[4][105][105];
        id.i = gj.m;
        bb.g = new byte[4][104][104];
        for (int p = 0; p < 4; p++) for (int a = 0; a < 104; a++) for (int b = 0; b < 104; b++) {
            sm.e[p][a][b] = 17;
            gj.m[p][a][b] = (p+1)*5000 + a*9 - b*11;
            bb.g[p][a][b] = (byte)((a ^ b) & 2);
        }
        ph.b = new li[13][13];
        jf.a = new gi[255];
        jf.l = 0;
        packet = null;
        String status = "ok";
        try {
            tm.a(rot, x, level, maps, z, (byte)-100, data, source, 24, 16, water);
        } catch (ld ex) {
            status = ex.f.getClass().getSimpleName() + "/" + ex.e;
        }
        StringBuilder result = new StringBuilder(status + "|" + packet.T + "|" + Arrays.deepHashCode(sm.e));
        for (int i = 0; i < jf.l; i++) {
            gi light = jf.a[i];
            result.append("|L ").append(light.r).append(' ').append(light.q).append(' ').append(light.i).append(' ').append(light.x)
                .append(' ').append(light.g).append(' ').append(light.j).append(' ').append(light.C).append(' ').append(light.t)
                .append(' ').append(HdMapLightOracle.field(light,"e")).append(' ').append(HdMapLightOracle.field(light,"y"))
                .append(' ').append(HdMapLightOracle.field(light,"p")).append(' ').append(HdMapLightOracle.field(light,"d"));
        }
        for (int a = 0; a < 13; a++) for (int b = 0; b < 13; b++) {
            li e = ph.b[a][b];
            if (e != null) result.append("|E ").append(a).append(' ').append(b).append(' ').append(e.c).append(' ')
                .append(Float.floatToRawIntBits(e.n)).append(' ').append(Float.floatToRawIntBits(e.s)).append(' ')
                .append(Float.floatToRawIntBits(e.q)).append(' ').append(e.k).append(' ').append(e.g).append(' ').append(e.d)
                .append(' ').append(e.a).append(' ').append(e.j);
        }
        System.out.println(result);
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0) { instrument(args[0], args[1]); return; }
        f.P = new int[2048];
        for (int i = 0; i < hf.a.length; i++) hf.a[i] = i * 3571 & 0xffffff;
        ic type = new ic();
        type.c = 4; type.p = 287; type.g = 717; type.o = -51;
        rm.d.a((byte)-75, type, 42);
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) run(line);
    }
}
