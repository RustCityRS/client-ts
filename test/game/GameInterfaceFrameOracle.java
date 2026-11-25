import java.io.*;
import java.nio.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// All widget and frame code executes in the gamepack. Replace only the main 3D viewport draw.
public class GameInterfaceFrameOracle {
    static final StringJoiner sceneCalls = new StringJoiner(",");
    public static void scene(byte guard, int height, int width, int y, int x, boolean fixed) {
        sceneCalls.add(x + "/" + y + "/" + width + "/" + height + "/" + fixed);
        td.b(x, y, x + width, y + height);
        td.d(x, y, width, height, 0x26495b);
        td.d(x + 5, y + 7, 19, 23, 0xa22930);
    }
    static void prepare(Path gamepack, Path directory) throws Exception {
        try (var jar = new JarFile(gamepack.toFile())) {
            var original = new ClassReader(jar.getInputStream(jar.getJarEntry("lf.class")));
            var writer = new ClassWriter(0);
            int[] sites = {0};
            original.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] exceptions) {
                    MethodVisitor target = super.visitMethod(access, name, desc, sig, exceptions);
                    if (!desc.equals("(I[Laj;IIIIIIZI)V") || !name.equals("a")) return target;
                    return new MethodVisitor(Opcodes.ASM8, target) {
                        public void visitMethodInsn(int op, String owner, String method, String desc, boolean itf) {
                            if (owner.equals("kk") && method.equals("a") && desc.equals("(BIIIIZ)V")) {
                                sites[0]++;
                                super.visitMethodInsn(op, "GameInterfaceFrameOracle", "scene", desc, false);
                            } else super.visitMethodInsn(op, owner, method, desc, itf);
                        }
                    };
                }
            }, 0);
            if (sites[0] != 1) throw new IllegalArgumentException("Unexpected number of scene calls: " + sites[0]);
            Files.write(directory.resolve("lf.class"), writer.toByteArray());
        }
    }
    public static void main(String[] args) throws Exception {
        if (args[0].equals("prepare")) { prepare(Path.of(args[1]), Path.of(args[2])); return; }
        Path cache = Path.of(args[0]);
        try (var interfaces = new ProceduralTextureCacheOracle.Disk(cache, 3);
             var models = new ProceduralTextureCacheOracle.Disk(cache, 7);
             var sprites = new ProceduralTextureCacheOracle.Disk(cache, 8);
             var metrics = new ProceduralTextureCacheOracle.Disk(cache, 13);
             var objects = new ProceduralTextureCacheOracle.Disk(cache, 19);
             var textureDefs = new ProceduralTextureCacheOracle.Disk(cache, 9);
             var materials = new ProceduralTextureCacheOracle.Disk(cache, 26);
             var output = new BufferedOutputStream(Files.newOutputStream(Path.of(args[1])))) {
            al gfx = h.i = new al(sprites, false, true);
            al model = new al(models, true, true), font = new al(metrics, false, true);
            wf.a(font, gfx, true, model, new al(interfaces, true, true));
            ld.a(gfx, 52); si.a((byte)114, gfx, font); uf.a(gfx, -7058);
            bj.a(new al(objects, true, true), -113, true, rg.h, model);
            dc.r = new kg(new al(textureDefs, true, true), new al(materials, true, true), gfx, 20, false);
            var gamma = dc.class.getDeclaredField("i"); gamma.setAccessible(true); gamma.setFloat(null, 0.8f);
            var palette = dc.class.getDeclaredMethod("b", int.class, int.class); palette.setAccessible(true); palette.invoke(null,0,512);
            te.g = new pb(); ie.F = true; jg.C = false;
            int w = Integer.parseInt(args[2]), hgt = Integer.parseInt(args[3]);
            int group = Integer.parseInt(args[4]);
            hi.f = w; fl.l = hgt; hd.m = group;
            for (int i = 5; i < args.length; i += 2) {
                qd mount = new qd(); mount.v = Integer.parseInt(args[i+1]); mount.q = 0;
                va.Z.a((byte)-89, mount, ((long)group << 16) + Integer.parseInt(args[i]));
            }
            ik.a(false,false); ik.G = 0; Arrays.fill(n.i, true);
            td.a(new int[w * hgt], w, hgt); Arrays.fill(td.g, 0x131b23);
            b.c(1);
            ByteBuffer raw = ByteBuffer.allocate(td.g.length * 4).order(ByteOrder.LITTLE_ENDIAN);
            raw.asIntBuffer().put(td.g); output.write(raw.array());
            System.out.println(ik.G + " " + sceneCalls);
        }
    }
}
