import java.awt.Canvas;
import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.lang.management.BufferPoolMXBean;
import java.lang.management.ManagementFactory;
import java.lang.reflect.*;
import java.nio.ByteBuffer;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import javax.media.opengl.GL;
import jdk.internal.org.objectweb.asm.*;

/** Observe td model draws and their ordered JOGL submissions at the East Ardougne title camera. */
public class HdEastMarketOracle {
    static final List<String> events = new ArrayList<>();
    static boolean tracing;
    static class Finished extends Error {}

    public static void model(int yaw, int sp, int cp, int sy, int cy, int x, int y, int z, long key, int level, Object particles) {
        if (tracing) events.add("M "+yaw+" "+sp+" "+cp+" "+sy+" "+cy+" "+x+" "+y+" "+z+" "+key+" "+level+" "+(particles!=null));
    }

    static void patch(Path jarPath, Path output) throws Exception {
        try (JarFile jar = new JarFile(jarPath.toFile())) {
            ClassReader reader = new ClassReader(jar.getInputStream(jar.getJarEntry("td.class")));
            ClassWriter writer = new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int access,String name,String desc,String signature,String[] exceptions) {
                    MethodVisitor dest = super.visitMethod(access,name,desc,signature,exceptions);
                    if (!name.equals("a") || !desc.equals("(IIIIIIIIJILga;)V")) return dest;
                    return new MethodVisitor(Opcodes.ASM8,dest) {
                        public void visitCode() {
                            super.visitCode();
                            for (int local=1; local<=8; local++) visitVarInsn(Opcodes.ILOAD,local);
                            visitVarInsn(Opcodes.LLOAD,9);
                            visitVarInsn(Opcodes.ILOAD,11);
                            visitVarInsn(Opcodes.ALOAD,12);
                            visitMethodInsn(Opcodes.INVOKESTATIC,"HdEastMarketOracle","model","(IIIIIIIIJILjava/lang/Object;)V",false);
                        }
                    };
                }
            },0);
            Files.write(output.resolve("td.class"),writer.toByteArray());
        }
    }

    static String indices(Object source, int count) {
        if (source instanceof Number) return "@"+source;
        ByteBuffer view = ((ByteBuffer)source).duplicate();
        byte[] bytes = new byte[count*4];
        view.get(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    static void capture(Random random,Path dir) throws Exception {
        fl.U=dl.d=1148;
        jh.c=uj.B=896;
        kb.a(new int[1148*896],1148,896);
        Method tick=client.class.getDeclaredMethod("d",byte.class);
        tick.setAccessible(true);
        gj.d=1000;
        // These colour offsets initially come from process-global <clinit> randomness.
        // They determine which ground vertices share colours and therefore a vertex index.
        gm.R=ok.c=0;
        random.setSeed(6999);
        hf.a(0.7f);
        random.setSeed(7000);
        me.P[176]=110;
        jl event=new jl();
        event.E=new Object[]{1887,48758909,48758911,48758910,48758912,48758913};
        h.a((byte)-12,200000,event);
        int elapsed=0;
        for (;elapsed<400;elapsed++) {
            random.setSeed(8000+elapsed);
            for (int j=0;j<8 && tl.d==28;j++) gd.c(-117);
            ++gj.d;
            tick.invoke(rh.j,(byte)1);
            if (t.z>=12000 && t.z<13000) break;
        }
        String pose="P "+elapsed+" "+km.Pc+" "+af.d+" "+kh.f+" "+tg.b+" "+ol.ib+" "+t.z;
        GL original=tf.t;
        tf.t=(GL)Proxy.newProxyInstance(GL.class.getClassLoader(),new Class[]{GL.class},(proxy,m,a)->{
            if (tracing && m.getName().equals("glDrawElements")) events.add("D "+a[0]+" "+a[1]+" "+a[2]+" "+indices(a[3],(int)a[1]));
            if (tracing && m.getName().equals("glCallList")) events.add("L "+a[0]);
            try { return m.invoke(original,a); } catch (InvocationTargetException e) { throw e.getCause(); }
        });
        for (int i=0;i<3;i++) {
            random.setSeed(9500+i);
            bi.jb=false; // The local disk fixture has no outstanding archive request.
            tracing=i==2;
            if (tracing) events.add(pose);
            ui.a(-6403,896,true,0,1148,0);
        }
        Files.write(dir.resolve("east.txt"),events);
        if (System.getenv("RS530_EAST_MARKET_EVIDENCE") != null) {
            System.gc();
            Runtime runtime = Runtime.getRuntime();
            System.out.println("collectedJavaHeapBytes " + (runtime.totalMemory()-runtime.freeMemory()));
            for(BufferPoolMXBean pool:ManagementFactory.getPlatformMXBeans(BufferPoolMXBean.class))
                System.out.println("javaBufferPool "+pool.getName()+" "+pool.getMemoryUsed());
        }
        tracing=false;
        tf.t=original;
        tf.o();
        w.o();
        rj.f((byte)100);
        ((nk)hf.e).k(20,-1);
        random.setSeed(9599);
        hf.a(0.7f);
        dl.d=fl.U=765; uj.B=jh.c=503;
        int[] pixels=new int[765*503];
        kb.a(pixels,765,503);
        hf.a();
        random.setSeed(9600);
        bi.jb=false;
        pl.a(28,5);
        for(int i=0;i<8 && tl.d==28;i++)gd.c(-117);
        if(tl.d!=10 || tf.w)throw new AssertionError("software market rebuild "+tl.d);
        try(DataOutputStream output=new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(dir.resolve("east-sd.bin"))))){
            for(int frame=0;frame<3;frame++){
                Arrays.fill(pixels,0x131b23);
                random.setSeed(9601+frame);
                bi.jb=false;
                ui.a(-6403,503,true,0,765,0);
                if(frame!=0)for(int pixel:pixels)output.writeInt(pixel);
            }
        }
    }

    public static void main(String[] args) throws Exception {
        if (args[0].equals("patch")) { patch(Path.of(args[1]),Path.of(args[2])); return; }
        Path dir=Path.of(args[1]);
        Field holder=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        holder.setAccessible(true);
        Random random=(Random)holder.get(null);
        Canvas canvas=new Canvas(){ public boolean isDisplayable(){ return true; } };
        canvas.setSize(765,503);
        try (GlRecorder recorder=new GlRecorder(dir); AutoCloseable handles=recorder.installFactory()) {
            recorder.loadProfile(Path.of(args[2]));
            try {
                HdTitleFrameOracle.run(Path.of(args[0]),canvas,i->{},phase->{
                    if (phase.equals("interface.onload")) random.setSeed(530);
                    if (!phase.equals("warmup")) return;
                    try { capture(random,dir); } catch (Exception e) { throw new AssertionError(e); }
                    throw new Finished();
                });
            } catch (Finished done) {}
        }
    }
}
