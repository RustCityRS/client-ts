import java.applet.Applet;
import java.awt.Canvas;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferInt;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Exercise pm.a with the original renderer, model sorters, packet-backed raster and texture cache.
 * The tests stop at lb.a, the following resource rebuild, or at entry to the recursive software fallback. */
@SuppressWarnings("removal")
public final class HdModeSwitchOracle {
    static class Boundary extends Error {
        Boundary(String name) { super(name); }
    }
    static class Page extends Applet {
        public Dimension getSize() { return new Dimension(871,613); }
    }
    static class Screen extends Canvas {
        boolean display;
        BufferedImage image;
        public Graphics getGraphics() {
            image = new BufferedImage(getWidth(),getHeight(),BufferedImage.TYPE_INT_RGB);
            return image.getGraphics();
        }
        String imageHash() {
            if (image == null) return "-";
            int hash = 1;
            for (int word : ((DataBufferInt)image.getRaster().getDataBuffer()).getData()) hash=31*hash+(word & 0xffffff);
            return Integer.toString(hash);
        }
        Screen(boolean display) { this.display = display; }
        public boolean isDisplayable() { return display; }
    }
    static String brightness;
    static int entries;
    public static void entered(int mode) {
        if (++entries > 1) throw new Boundary("fallback" + mode);
    }
    public static void reload() { throw new Boundary("reload"); }
    public static void brightness(float value) { brightness = Integer.toHexString(Float.floatToRawIntBits(value)); }

    static void instrument(Path output) throws Exception {
        ClassReader in = new ClassReader("pm");
        ClassWriter out = new ClassWriter(in, ClassWriter.COMPUTE_MAXS);
        in.accept(new ClassVisitor(Opcodes.ASM8,out) {
            public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] exceptions) {
                var next = super.visitMethod(access,name,desc,sig,exceptions);
                if (!name.equals("a") || !desc.equals("(ZIZIZII)V")) return next;
                return new MethodVisitor(Opcodes.ASM8,next) {
                    public void visitCode() {
                        super.visitCode();
                        super.visitVarInsn(Opcodes.ILOAD,1);
                        super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdModeSwitchOracle","entered","(I)V",false);
                    }
                    public void visitMethodInsn(int op,String owner,String n,String d,boolean itf) {
                        if (owner.equals("lb") && n.equals("a") && d.equals("(Z)V"))
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdModeSwitchOracle","reload","()V",false);
                        if (owner.equals("hf") && n.equals("a") && d.equals("(F)V")) {
                            super.visitInsn(Opcodes.DUP);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdModeSwitchOracle","brightness","(F)V",false);
                        }
                        super.visitMethodInsn(op,owner,n,d,itf);
                    }
                };
            }
        }, 0);
        Files.write(output.resolve("pm.class"),out.toByteArray());
    }

    static Object get(Object owner,String name) throws Exception {
        Field f=(owner instanceof Class<?> c ? c : owner.getClass()).getDeclaredField(name);
        f.setAccessible(true);
        return f.get(owner instanceof Class<?> ? null : owner);
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("instrument")) { instrument(Path.of(args[1])); return; }
        Path assets=Path.of(args[2]);
        gk.a(Files.readAllBytes(assets.resolve("p12-glyphs")),98);
        rh.h=ce.a(-22376,Files.readAllBytes(assets.resolve("p12-metrics")));
        gk.a(Files.readAllBytes(assets.resolve("b12-glyphs")),98);
        wl.q=ce.a(-22376,Files.readAllBytes(assets.resolve("b12-metrics")));
        gk.a(Files.readAllBytes(assets.resolve("titlebg")),98);
        gd.n=gi.b(99);
        gk.a(Files.readAllBytes(assets.resolve("logo")),98);
        tk.o=wh.b((byte)-40);
        jm.z=cn.q;
        qc.P=97;
        rh.j=(client)WindowLayoutOracle.headless(client.class);
        try (var gl = new GlRecorder(Path.of(args[0])); var factory = gl.installFactory()) {
            gl.loadProfile(Path.of(args[1]));
            fk.l = (ll)WindowLayoutOracle.headless(ll.class);
            fk.l.i = (Page)WindowLayoutOracle.headless(Page.class);
            md.W = -1;
            jk.B = null;
            for (String scenario : List.of("soft","fixed","resizable","create","createAA","undisplayable","missingThread","missingTextures",
                "coldUnavailable","coldAvailable","coldTitle","return1","return2","return3","return4","returnUnlit","nullFullscreenLink")) {
                entries = 0;
                tl.d=scenario.equals("coldTitle") ? 5 : 0;
                brightness = "-";
                boolean ready = !scenario.equals("undisplayable");
                Screen canvas = new Screen(ready);
                md.L = canvas;
                tf.o();
                tf.J = 43; tf.A = 47;
                if (scenario.equals("fixed") || scenario.equals("resizable") || scenario.startsWith("return")) tf.w = true;
                gn.d = true; ml.ab = false; jk.y = false; fh.P = false;
                Arrays.fill(pa.R,false);
                pa.N = scenario.equals("createAA") ? 2 : 0;
                rc.M = !scenario.startsWith("cold"); od.c = !scenario.equals("returnUnlit");
                il.I = scenario.matches("return[1-4]") ? scenario.charAt(6)-'0' : 3;
                cm.b = scenario.equals("missingThread") ? null : Thread.currentThread();
                Thread.currentThread().setPriority(3);
                nk cache = (nk)WindowLayoutOracle.headless(nk.class);
                hf.e = scenario.equals("missingTextures") ? null : cache;
                w.o();
                int mode = scenario.equals("soft") || scenario.startsWith("return") ? 0 : scenario.equals("resizable") ? 2 : 1;
                boolean rebuild = !List.of("soft","fixed","resizable").contains(scenario);
                int previous = scenario.startsWith("return") || scenario.equals("fixed") || scenario.equals("resizable") ? 1 : 0;
                ll link = fk.l;
                java.util.concurrent.FutureTask<Void> supply=null;
                if (scenario.startsWith("cold")) {
                    ll loader=(ll)WindowLayoutOracle.headless(ll.class);
                    loader.i=fk.l.i;
                    fk.l=loader;
                    supply=new java.util.concurrent.FutureTask<>(() -> {
                        Field queue=ll.class.getDeclaredField("t");queue.setAccessible(true);
                        im task;
                        synchronized (loader) {
                            while ((task=(im)queue.get(loader))==null) loader.wait(100);
                        }
                        if (task.f!=10 || task.c!=client.class) {task.d=2;throw new AssertionError("wrong gl library request");}
                        task.d=scenario.equals("coldUnavailable") ? 2 : 1;
                        return null;
                    });
                    Thread.startVirtualThread(supply);
                }
                if (scenario.equals("nullFullscreenLink")) { fk.l = null; mode = 3; }
                String result = "ok";
                try { pm.a(false,mode,rebuild,previous,false,123,456); }
                catch (Boundary e) { result = e.getMessage(); }
                catch (ld e) { result = e.f.getClass().getSimpleName()+" "+e.e; }
                finally { fk.l=link; }
                if (supply!=null) supply.get(5,java.util.concurrent.TimeUnit.SECONDS);
                if (canvas.image != null) {
                    try (var output = new java.io.DataOutputStream(new java.io.BufferedOutputStream(
                        Files.newOutputStream(assets.resolve(scenario+".rgb"))))) {
                        for (int pixel : ((DataBufferInt)canvas.image.getRaster().getDataBuffer()).getData()) {
                            output.writeByte(pixel >>> 16); output.writeByte(pixel >>> 8); output.writeByte(pixel);
                        }
                    }
                }
                int dirty=0;
                for (boolean flag : pa.R) if (flag) dirty++;
                System.out.println(scenario + "|" + result + "|" + tf.w + "," + tf.J + "," + tf.A + "," + gn.d + "," + jk.y + "," + dirty + "," + fh.P
                    + "|" + Thread.currentThread().getPriority() + "," + get(w.class,"Ob") + "," + get(cache,"J") + "," + (get(cache,"P")!=null)
                    + "," + (get(cache,"G")!=null) + "," + brightness + "|" + canvas.getWidth() + "," + canvas.getHeight() + "," + canvas.getX() + "," + canvas.getY()
                    + "," + canvas.getIgnoreRepaint() + "|" + rc.M + "," + canvas.imageHash());
            }
            tf.o();
        }
    }
}
