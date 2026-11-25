import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// Skip the geometry builder only, from the first PCM service in gj.e through
// cf.a (FillBaseLevel). The original readiness checks, both loop counters, all
// calls from lk.c to ed.d and the state/window/region gates remain in place.
public class MapBuildPostOracle {
    static void instrument(String jar, Path dir) throws Exception {
        Map<String,String> probes = Map.ofEntries(
            Map.entry("ph.a(ZI)V","keep"),Map.entry("al.a(III)[B","missing"),
            Map.entry("lk.c(I)V","quit"),Map.entry("ng.b(III)V","obj"),Map.entry("ia.c(I)V","roofs"),
            Map.entry("uj.a(I)V","pump"),Map.entry("l.b(Z)V","correct"),Map.entry("bf.c(I)V","reset"),
            Map.entry("be.k(II)V","opcode"),Map.entry("gd.h(II)V","windowValue"),Map.entry("al.a(Lid;B)V","hint"),
            Map.entry("ej.a(II)V","state"),Map.entry("g.a(I)V","reopen"),Map.entry("ed.d(I)V","slow")
        );
        try (JarFile source=new JarFile(jar)) {
            ClassReader reader=new ClassReader(source.getInputStream(source.getJarEntry("gj.class")));
            ClassWriter writer=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int flags,String name,String desc,String sig,String[] ex) {
                    MethodVisitor mv=super.visitMethod(flags,name,desc,sig,ex);
                    if (!name.equals("e")||!desc.equals("(I)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv) {
                        final Label afterGeometry=new Label();
                        boolean started;
                        public void visitIntInsn(int op,int operand) {
                            if (op==Opcodes.SIPUSH && operand==8428) super.visitLabel(afterGeometry);
                            super.visitIntInsn(op,operand);
                        }
                        public void visitMethodInsn(int op,String owner,String method,String desc,boolean iface) {
                            if (!started && owner.equals("uj") && method.equals("a") && desc.equals("(I)V")) {
                                started=true;
                                super.visitInsn(Opcodes.POP);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"MapBuildPostOracle","geometry","()V",false);
                                super.visitJumpInsn(Opcodes.GOTO,afterGeometry);
                                return;
                            }
                            String probe=probes.get(owner+"."+method+desc);
                            if (probe==null) super.visitMethodInsn(op,owner,method,desc,iface);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"MapBuildPostOracle",probe,
                                op==Opcodes.INVOKESTATIC?desc:"(L"+owner+";"+desc.substring(1),false);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("gj.class"),writer.toByteArray());
        }
    }
    static StringJoiner calls;
    static int count, hash, hints, mode, pumps;
    static void event(String label) {
        calls.add(label);
        if (mode==31 && label.equals("reset")) { ek.s=null; tf.C=28; }
        if (mode==32 && label.equals("roof")) { qg.G=true; tf.C=30; }
    }
    static void fail(int code) { if (mode==code) throw new IllegalStateException(); }
    public static void keep(boolean force,int guard) { event("keep"+force); }
    public static byte[] missing(al receiver,int guard,int file,int group) { event("missing");return null; }
    public static void geometry() { event("geometry"); fail(1); }
    public static void quit(int guard) { if (guard!=8428) throw new AssertionError();event("quit");fail(2); }
    public static void obj(int guard,int z,int x) {
        if (guard!=72 || x!=count/104 || z!=count%104) throw new AssertionError(count+": "+x+","+z);
        if (count==0) event("sort");
        count++;hash=hash*31 + (x<<8) + z;
        if (count==1) fail(3);
        if (count==105) fail(4);
        if (count==10816) fail(5);
    }
    public static void roofs(int guard) { if(guard!=512) throw new AssertionError();event("roof");fail(6); }
    public static void pump(int guard) { if(guard!=64) throw new AssertionError();event("audio");fail(++pumps==1?7:14); }
    public static void correct(boolean guard) { if(!guard) throw new AssertionError();event("correct");fail(8); }
    public static void reset(int guard) { if(guard!=-18131) throw new AssertionError();event("reset");fail(9); }
    public static void opcode(be out,int guard,int value) { Objects.requireNonNull(out);event("p"+value);fail(value==20?10:12); }
    public static void windowValue(gd out,int value,int guard) { Objects.requireNonNull(out);event("w"+value); }
    public static void hint(al receiver,id name,byte guard) {
        Objects.requireNonNull(receiver); if (++hints==1) event("hints");fail(11);
    }
    public static void state(int guard,int next) { tf.C=next;event("state"+next); }
    public static void reopen(int guard) { event("reopen");fail(13); }
    public static void slow(int guard) { event("slow");fail(15); }
    public static void main(String[] args) throws Exception {
        if (args.length>0) { instrument(args[0],Path.of(args[1]));return; }
        Class<?> unsafe=Class.forName("sun.misc.Unsafe");
        Field field=unsafe.getDeclaredField("theUnsafe");field.setAccessible(true);
        Method allocate=unsafe.getMethod("allocateInstance",Class.class);
        java.awt.Frame frame=(java.awt.Frame)allocate.invoke(field.get(null),java.awt.Frame.class);
        se stream=(se)allocate.invoke(field.get(null),se.class);
        re.d=new al(null,false,false);
        for (String line : new BufferedReader(new InputStreamReader(System.in)).lines().toList()) {
            int[] a=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            tf.C=a[0];qg.G=a[1]!=0;tb.h=(a[2]&1)!=0?frame:null;ek.s=(a[2]&2)!=0?stream:null;mode=a[3];
            mk.G=new byte[mode==30?1:0][];lk.x=new byte[mk.G.length][];
            fd.X=new int[]{3};hh.qb=new int[]{-1};ae.c=null;kg.o=null;
            ug.d=new kc(0);bc.e=0;ic.V=30;ah.k=42;qk.v=new be(8);
            count=hints=pumps=0;hash=1;calls=new StringJoiner(",");
            String result="ok";
            try { gj.e(-30458); }
            catch(RuntimeException e) {
                Throwable t=e;while(t instanceof g wrapped)t=wrapped.a;
                if(t instanceof IllegalStateException) result="probe";else throw e;
            }
            System.out.println(result+"/"+tf.C+"/"+bc.e+"/"+count+"/"+hash+"/"+hints+"/"+calls);
        }
    }
}
