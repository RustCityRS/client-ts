import java.applet.Applet;
import java.awt.*;
import java.nio.file.*;
import java.util.ArrayList;
import jdk.internal.org.objectweb.asm.*;

public class HdWindowWheelOracle {
    static int read;
    static boolean start, pending;
    static final ArrayList<String> events = new ArrayList<>();
    static final uc marker = new uc() {
        int a(int value) { throw new AssertionError(); }
        void a(boolean ignored, Component c) { throw new AssertionError(); }
        void a(Component c, int ignored) { throw new AssertionError(); }
    };
    static class Page extends Applet { public Dimension getSize() { return new Dimension(765,503); } }
    public static uc wheel() {
        read++; events.add("wheel");
        if (start && read==1) return null;
        if (read==(start ? 2 : 1)) return marker;
        pending=true; return null;
    }
    public static Canvas canvas() { if (pending) events.add("canvas"); return md.L; }
    public static void mount(rc shell,byte guard) {}
    public static void main(String[] args) throws Exception {
        if (args.length!=0) {
            ClassReader r=new ClassReader("pm"); ClassWriter w=new ClassWriter(r,0);
            r.accept(new ClassVisitor(Opcodes.ASM8,w) {
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] e) {
                    MethodVisitor mv=super.visitMethod(a,n,d,s,e);
                    if (!n.equals("a") || !d.equals("(ZIZIZII)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv) {
                        public void visitFieldInsn(int op,String o,String n,String d) {
                            if (op==Opcodes.GETSTATIC && o.equals("fk") && n.equals("q"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdWindowWheelOracle","wheel","()Luc;",false);
                            else if (op==Opcodes.GETSTATIC && o.equals("md") && n.equals("L"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdWindowWheelOracle","canvas","()Ljava/awt/Canvas;",false);
                            else super.visitFieldInsn(op,o,n,d);
                        }
                        public void visitMethodInsn(int op,String o,String n,String d,boolean itf) {
                            if ((o.equals("client") || o.equals("rc")) && n.equals("b") && d.equals("(B)V"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdWindowWheelOracle","mount","(Lrc;B)V",false);
                            else super.visitMethodInsn(op,o,n,d,itf);
                        }
                    };
                }
            },0); Files.write(Path.of(args[0],"pm.class"),w.toByteArray()); return;
        }
        md.L=new Canvas(); fk.l=(ll)WindowLayoutOracle.headless(ll.class); fk.l.i=(Applet)WindowLayoutOracle.headless(Page.class);
        for (int which=0;which<2;which++) {
            start=which==1; pending=false; read=0; events.clear();
            try { pm.a(true,0,false,0,false,-1,-1); throw new AssertionError(); }
            catch (ld failure) {
                if (!(failure.f instanceof NullPointerException)) throw failure;
                System.out.println(String.join(";",events)+"|"+failure.e);
            }
        }
    }
}
