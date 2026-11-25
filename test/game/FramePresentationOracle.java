import java.awt.Canvas;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferInt;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Base64;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

/** Calls client.d, db.a/gf.e and wc in the original, unmodified gamepack. */
public class FramePresentationOracle {
    static final int WIDTH = 19, HEIGHT = 13;
    static final BufferedImage surface = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_ARGB);
    static final int[] screen = ((DataBufferInt) surface.getRaster().getDataBuffer()).getData();
    static final StringBuilder events = new StringBuilder();
    static Graphics graphics;
    static ProbeCanvas firstCanvas, secondCanvas;
    static ProbeMap firstMap, secondMap;
    static int mode, count, draws, reads, failAt;
    static boolean[] original;

    static void installRoots() {
        ik.G = count;
        ce.T = original = new boolean[]{true, false, true, true, false, true};
        ik.Q = new int[]{6, 2, 4, 9, 1, 2};
        gk.i = new int[]{9, 2, 5, 23, 6, -3};
        nh.Y = new int[]{-2, 3, 4, 7, 5, 0};
        r.U = new int[]{3, 2, -1, 8, 6, 1};
    }

    static class ProbeCanvas extends Canvas {
        int id;
        ProbeCanvas(int id) { this.id = id; }
        public Graphics getGraphics() {
            events.append("G").append(id).append(';');
            installRoots();
            switch (mode) {
                case 1: throw new IllegalArgumentException();
                case 2: throw new AssertionError();
                case 3: pe.S = secondCanvas; throw new IllegalArgumentException();
                case 4: pe.S = null; throw new IllegalArgumentException();
                case 5: return null;
                case 6: rg.s = secondMap; break;
                case 7: rg.s = null; break;
                case 8: ik.G = 0; break;
                case 9: ik.G = 6; break;
                case 10: ce.T = null; break;
                case 11: ce.T = new boolean[]{false, true}; break;
                case 12: ik.Q = Arrays.copyOf(ik.Q, 2); break;
                case 13: nh.Y = null; break;
                case 14: gk.i = null; break;
                case 15: r.U = null; break;
                case 26: throw new IllegalArgumentException();
            }
            return graphics;
        }
        public void repaint() {
            events.append("R").append(id).append(';');
            if (mode == 26) throw new IllegalStateException();
        }
    }

    static class ProbeMap extends oh {
        final int id;
        final wc pixmap = new wc();
        ProbeMap(int id) {
            this.id = id;
            pixmap.a(HEIGHT, WIDTH, firstCanvas, (byte)-34);
            for (int i = 0; i < pixmap.n.length; i++) pixmap.n[i] = (id * 0x194877 + i * 0x7023) & 0xffffff;
        }
        void before(Graphics g) {
            events.append(g == null ? "null" : g == graphics ? "g" : "?").append(';');
            draws++;
            if (mode == 16 && draws == 1 || mode == 17 && draws == 2) throw new IllegalArgumentException();
            if (mode == 18 && draws == 1) throw new AssertionError();
        }
        void after() {
            if (draws != 1) return;
            switch (mode) {
                case 19: ce.T = new boolean[]{true,true,false,true,false,false}; break;
                case 20: ce.T = null; break;
                case 21: rg.s = secondMap; pe.S = secondCanvas; break;
                case 22: ik.G = 1; break;
                case 23: ik.G = 6; break;
                case 24: ik.Q[2] = 7; gk.i[2] = 3; nh.Y[2] = -1; r.U[2] = -2; break;
                case 25: tf.C = 0; hi.g = true; break;
                case 27: pe.S = secondCanvas; throw new IllegalArgumentException();
                case 28: ce.T = new boolean[0]; break;
            }
        }
        void a(int guard, int x, int y, Graphics g) {
            events.append("F").append(id).append(',').append(x).append(',').append(y).append(',');
            before(g); pixmap.a(guard,x,y,g); after();
        }
        void a(byte guard, int h, int w, int x, int y, Graphics g) {
            events.append("D").append(id).append(',').append(h).append(',').append(w).append(',').append(x).append(',').append(y).append(',');
            before(g); pixmap.a(guard,h,w,x,y,g); after();
        }
        void a(int h, int w, Component c, byte guard) { throw new AssertionError(); }
    }

    static String flags(boolean[] f) {
        if (f == null) return "~";
        StringBuilder s = new StringBuilder();
        for (boolean b : f) s.append(b ? '1' : '0');
        return s.toString();
    }

    public static void read(String key) {
        events.append(key).append(';');
        if (++reads == failAt) throw new IllegalArgumentException("probe");
    }

    // A second, disposable classpath observes the statics after GETSTATIC. The
    // first run uses the stock bytecode and compares the same surfaces and flags.
    static void observeReads(String jar, String out) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            ClassReader source = new ClassReader(file.getInputStream(file.getJarEntry("client.class")));
            ClassWriter observed = new ClassWriter(ClassWriter.COMPUTE_MAXS);
            source.accept(new ClassVisitor(Opcodes.ASM8, observed) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] ex) {
                    MethodVisitor method = super.visitMethod(access,name,desc,sig,ex);
                    if (!name.equals("d") || !desc.equals("(I)V")) return method;
                    return new MethodVisitor(Opcodes.ASM8,method) {
                        boolean presentation;
                        public void visitMethodInsn(int op, String owner, String name, String desc, boolean iface) {
                            super.visitMethodInsn(op,owner,name,desc,iface);
                            if (owner.equals("mk") && name.equals("a") && desc.equals("(ILmb;Z)V")) presentation = true;
                        }
                        public void visitFieldInsn(int op, String owner, String name, String desc) {
                            super.visitFieldInsn(op,owner,name,desc);
                            if (owner.equals("qf") && name.equals("f")) presentation = false;
                            if (presentation && op == Opcodes.GETSTATIC) {
                                super.visitLdcInsn(owner+"."+name);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"FramePresentationOracle","read","(Ljava/lang/String;)V",false);
                            }
                        }
                    };
                }
            },0);
            Files.write(Path.of(out,"client.class"),observed.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0) { observeReads(args[0],args[1]); return; }
        client applet = WindowModeOracle.container(client.class);
        aj.kb = WindowModeOracle.container(WindowModeOracle.TestFrame.class);
        hi.f = vk.rb = WIDTH; fl.l = oh.j = HEIGHT; pa.rb = sk.N = 0;
        wb.db = false; qh.c = -1; te.g = new pb(); nc.j = new gk();
        hd.m = -1; we.y = qf.f = wd.b = false; oa.a = 0L;
        firstCanvas = new ProbeCanvas(1); secondCanvas = new ProbeCanvas(2);
        firstMap = new ProbeMap(1); secondMap = new ProbeMap(2);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String row : in.lines().toList()) {
            int[] v = Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray();
            tf.C = v[0]; ml.T = v[1]; hi.g = v[2] != 0; count = v[3]; mode = v[4]; draws = reads = 0;
            failAt = v.length == 6 ? v[5] : 0;
            pe.S = mode == 29 ? null : firstCanvas; rg.s = firstMap;
            // The frame producer finishes before the presentation reads its root count.
            ik.G = 0; ce.T = original = new boolean[]{true, true, true};
            Arrays.fill(screen,0xff324152);
            graphics = surface.getGraphics();
            graphics.setClip(1,1,WIDTH-2,HEIGHT-2);
            events.setLength(0);
            String status = "ok";
            try { applet.d(0); }
            catch (AssertionError err) { status = "error"; }
            catch (RuntimeException err) {
                Throwable e = err;
                while (e instanceof g wrapped) e = wrapped.a;
                status = e instanceof NullPointerException ? "null" : e instanceof IllegalStateException ? "repaint" :
                    "probe".equals(e.getMessage()) ? "probe" : e.getClass().getName();
                if (err instanceof g wrapped) status += "@" + wrapped.q;
            }
            ByteBuffer bytes = ByteBuffer.allocate(screen.length*4).order(ByteOrder.LITTLE_ENDIAN);
            bytes.asIntBuffer().put(screen);
            System.out.println(String.join("|",status,events.toString(),""+ik.G,flags(original),flags(ce.T),
                ""+hi.g,""+tf.C,Base64.getEncoder().encodeToString(bytes.array())));
            graphics.dispose();
        }
    }
}
