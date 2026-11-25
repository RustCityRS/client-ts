import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import javax.media.opengl.GL;
import jdk.internal.org.objectweb.asm.*;

// Original ij.a(116) with its real archive, font, software raster and GL wrappers. Instrument only the five
// sprite stores and the boundaries of actual calls. A failure in a cf/el constructor never executes its store.
public class HdSpriteMenuOracle {
    static final List<String> events = new ArrayList<>();
    static final String[] slots = {"d.ib", "oi.h", "nb.i", "hd.e", "qi.z"};
    static final int[][] themes = {{9,641,13,802,14}, {641,9,802,13,882}};
    static final List<Object> retained = new ArrayList<>();
    static HdTitleFrameOracle.Disk spriteDisk;
    static int available, mode, at, writes, fills, uploads;
    static int[] ids;

    static void instrument(Path dir) throws Exception {
        try (InputStream in = HdSpriteMenuOracle.class.getResourceAsStream("/ij.class")) {
            ClassReader reader = new ClassReader(in);
            ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String signature, String[] ex) {
                    MethodVisitor base = super.visitMethod(access,name,desc,signature,ex);
                    if (!name.equals("a") || !desc.equals("(B)V")) return base;
                    return new MethodVisitor(Opcodes.ASM8,base) {
                        public void visitFieldInsn(int opcode, String owner, String name, String desc) {
                            super.visitFieldInsn(opcode,owner,name,desc);
                            int slot = Arrays.asList(slots).indexOf(owner + "." + name);
                            if (opcode == Opcodes.PUTSTATIC && slot >= 0) {
                                super.visitLdcInsn(slot);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdSpriteMenuOracle","store","(I)V",false);
                            }
                        }
                        public void visitMethodInsn(int op, String owner, String name, String desc, boolean itf) {
                            super.visitMethodInsn(op,owner,name,desc,itf);
                            if (owner.equals("rk") && name.equals("a") && desc.equals("(Lna;IIII)V")) {
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdSpriteMenuOracle","afterText","()V",false);
                            }
                            if (desc.equals("(IIIIII)V") && (owner.equals("dj") || owner.equals("kb"))) {
                                super.visitLdcInsn(owner);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdSpriteMenuOracle","afterFill","(Ljava/lang/String;)V",false);
                            }
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("ij.class"),writer.toByteArray());
        }
    }

    static String state() {
        StringBuilder state = new StringBuilder();
        for (qf sprite : new qf[]{d.ib,oi.h,nb.i,hd.e,qi.z}) {
            state.append(sprite == null ? '_' : sprite instanceof el ? 'E' : sprite instanceof cf ? 'C' : sprite instanceof am ? 'A' : 'P');
            if (sprite != null) retained.add(sprite);
        }
        return state.toString();
    }
    public static void store(int slot) {
        events.add("s" + slot + state());
        if (writes++ != at) return;
        if (mode == 1) tf.w = !tf.w;
        if (mode == 2) {
            // Replace the next static between its software store and its checkcast.
            if (slot == 0) oi.h = d.ib;
            if (slot == 2) hd.e = nb.i;
            if (slot == 3) qi.z = hd.e;
        }
        if (mode == 3) {
            if (slot == 0) oi.h = null;
            if (slot == 2) hd.e = null;
            if (slot == 3) qi.z = null;
        }
    }
    public static void afterText() {
        events.add("text");
        if (mode == 4) tf.w = !tf.w;
    }
    public static void afterFill(String owner) {
        events.add(owner);
        if (fills++ == at && mode == 5) tf.w = !tf.w;
    }
    static final class Source extends v {
        ii b(int guard) { events.add("index"); return spriteDisk.index; }
        void a(int group, int guard) { throw new AssertionError(); }
        int b(int group, int guard) { throw new AssertionError(); }
        byte[] c(int group, int guard) {
            int slot = 0;
            while (ids[slot] != group) slot++;
            events.add("g" + slot);
            if (slot == at && mode == 6) tf.w = !tf.w;
            if (slot == at && mode == 7) ra.K = null;
            return (available & (1 << slot)) != 0 ? spriteDisk.c(group,guard) : null;
        }
    }
    static String fault(Throwable error) {
        String site = "";
        if (error instanceof ld wrapper) {
            site = wrapper.e.endsWith("ij.F(116)") ? "/ij" : "/" + wrapper.e;
            error = wrapper.f;
        }
        return error.getClass().getSimpleName() + site;
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1) { instrument(Path.of(args[0])); return; }
        Path cache = Path.of(args[0]);
        en data = HdTitleFrameOracle.open(cache.resolve("main_file_cache.dat2"),5200);
        ge master = new ge(255,data,HdTitleFrameOracle.open(cache.resolve("main_file_cache.idx255"),6000),500000);
        spriteDisk = new HdTitleFrameOracle.Disk(master,data,cache,8);
        ve sprites = new ve(spriteDisk,false,false);
        ve metrics = new ve(new HdTitleFrameOracle.Disk(master,data,cache,13),false,false);
        int fontId = sprites.a(cd.a("b12_full",(byte)-123),(byte)-30);
        GlRecorder recorder = new GlRecorder(Path.of(args[1]));
        GL delegate = recorder.gl();
        tf.t = (GL) Proxy.newProxyInstance(GL.class.getClassLoader(),new Class<?>[]{GL.class},(self,method,values) -> {
            if (method.getName().equals("glTexImage2D") && uploads++ == at) {
                if (mode == 8) throw new IllegalStateException();
                if (mode == 9) throw new AssertionError();
            }
            try { return method.invoke(delegate,values); }
            catch (InvocationTargetException ex) { throw ex.getCause(); }
        });
        tf.J = 76;
        tf.A = 70;
        rk[] fonts = new rk[2];
        for (int i = 0; i < 2; i++) {
            tf.w = i == 1;
            fonts[i] = k.a(0,fontId,(byte)125,sprites,metrics);
        }
        ta.w = cd.a("Choose",(byte)-122);
        for (int i = 0; i < 3; i++) {
            uj.C[i] = cd.a("Op" + i,(byte)-122);
            t.v[i] = cd.a(i == 1 ? "target" : "",(byte)-122);
        }
        int number = 0;
        ByteArrayOutputStream frames = new ByteArrayOutputStream();
        for (String line : Files.readAllLines(Path.of(args[2]))) {
            int[] row = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int active = row[0], preset = row[2];
            available = row[1];
            mode = row[3];
            at = row[4];
            ids = themes[row[5]];
            recorder.mark("case" + number++);
            tf.w = active == 1;
            wl.q = mode == 10 ? null : fonts[active];
            ee.c = ids[0]; nf.e = ids[1]; gl.d = ids[2]; kk.i = ids[3]; uj.E = ids[4];
            ra.K = new ve(new Source(),false,false);
            qf[] saved = new qf[5];
            for (int i = 0; i < 5; i++) {
                if ((preset & (1 << i)) != 0) saved[i] = gf.a(sprites,0,ids[i],(byte)39);
            }
            d.ib = saved[0]; oi.h = saved[1]; nb.i = saved[2]; hd.e = saved[3]; qi.z = saved[4];
            if (mode == 11) saved[at].W = saved[at].I = 0;
            da.ab = 0x217a9f; ug.p = 0xaa596f; ii.y = 33; sm.b = -17;
            pk.Y = 0xafffff; vf.c = 0xffaa23;
            ok.b = 4; si.ab = 2; bc.X = 64; bn.O = 48; sk.kb = 3;
            rh.o = 14; sc.v = 40;
            bn.V = 2;
            vh.b[0] = e.sc[0] = 5; sd.V[0] = fe.lb[0] = 10;
            vh.b[1] = e.sc[1] = 69; sd.V[1] = fe.lb[1] = 2;
            ch.y[0] = ch.y[1] = false;
            int[] pixels = new int[tf.J * tf.A];
            Arrays.fill(pixels,0x172634);
            kb.a(pixels,tf.J,tf.A);
            kb.c(3,3,72,67);
            events.clear();
            uploads = writes = fills = 0;
            String result = "ok";
            try {
                ij.a((byte)116);
                if (mode == 12 || mode == 13 || mode == 14) {
                    events.add("again");
                    if (mode == 13) tf.w = !tf.w;
                    if (mode == 14) available = 31;
                    ij.a((byte)116);
                }
            }
            catch (RuntimeException | AssertionError error) { result = fault(error); }
            ByteBuffer image = ByteBuffer.allocate(pixels.length * Integer.BYTES).order(ByteOrder.LITTLE_ENDIAN);
            image.asIntBuffer().put(pixels);
            frames.writeBytes(image.array());
            System.out.println(result + "|" + String.join(",",events) + "|" + state() + "|" + tf.w + "|"
                + ch.y[0] + "," + ch.y[1] + "|" + Arrays.hashCode(pixels));
        }
        Files.write(Path.of(args[1],"pixels.bin"),frames.toByteArray());
        recorder.close();
    }
}
