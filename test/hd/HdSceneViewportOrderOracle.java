import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

/** Observe the stock viewport caller. Inert callees isolate its native branch decisions and loads. */
public class HdSceneViewportOrderOracle {
    static final Map<String,String> names = new HashMap<>();
    static final List<String> events = new ArrayList<>();
    static boolean flip;
    static int scales;
    public static void event(String s) { events.add(s); }
    public static int scale(int ignored) { return 300 + ++scales; }
    public static void scene() { events.add("draw"); if (flip) tf.w = !tf.w; }
    public static void overlays(int y,int w,int x,int sx,int h,int sy,int guard) { events.add("overlay:"+sx+","+sy); }
    public static void arrow(int w,int x,int h,boolean flag,int sy,int sx,int y) { events.add("arrow:"+sx+","+sy); }

    static void prepare(Path jar, Path out) throws Exception {
        try(JarFile entries = new JarFile(jar.toFile())) {
            ClassReader r = new ClassReader(entries.getInputStream(entries.getJarEntry("ui.class")));
            ClassWriter w = new ClassWriter(r,ClassWriter.COMPUTE_MAXS);
            r.accept(new ClassVisitor(Opcodes.ASM8,w) {
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex) {
                    MethodVisitor v = super.visitMethod(access,name,desc,sig,ex);
                    if (!name.equals("a") || !desc.equals("(IIZIII)V")) return v;
                    return new MethodVisitor(Opcodes.ASM8,v) {
                        public void visitFieldInsn(int op,String owner,String field,String type) {
                            String mapped = names.get(owner+"."+field);
                            if (mapped != null && op == Opcodes.GETSTATIC) {
                                super.visitLdcInsn(mapped);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdSceneViewportOrderOracle","event","(Ljava/lang/String;)V",false);
                            }
                            super.visitFieldInsn(op,owner,field,type);
                            if (op == Opcodes.GETSTATIC && "scale".equals(mapped))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdSceneViewportOrderOracle","scale","(I)I",false);
                        }
                        public void visitMethodInsn(int op,String owner,String member,String type,boolean iface) {
                            if (owner.contains("/")) { super.visitMethodInsn(op,owner,member,type,iface); return; }
                            if (owner.equals("lc") || owner.equals("t")) {
                                super.visitMethodInsn(op,"HdSceneViewportOrderOracle",owner.equals("lc")?"overlays":"arrow",type,false);
                                return;
                            }
                            Type[] args=Type.getArgumentTypes(type);
                            for(int i=args.length-1;i>=0;i--) super.visitInsn(args[i].getSize()==2?Opcodes.POP2:Opcodes.POP);
                            if (op!=Opcodes.INVOKESTATIC) super.visitInsn(Opcodes.POP);
                            if (owner.equals("mf")) super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdSceneViewportOrderOracle","scene","()V",false);
                            Type result=Type.getReturnType(type);
                            if (result.getSort()==Type.INT) super.visitInsn(Opcodes.ICONST_0);
                            else if (result.getSort()==Type.OBJECT) super.visitInsn(Opcodes.ACONST_NULL);
                            else if (result.getSort()!=Type.VOID) throw new AssertionError(owner+"."+member+type);
                        }
                    };
                }
            },0);
            Files.write(out.resolve("ui.class"),w.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        String[] fields={"tf.w active","gg.bb focusX","ii.a focusZ","ee.b level","nk.O self","sa.Q shakeRandom","ch.z shakePhase","qg.Y shakeFrequency","sc.p scale","em.z menu","me.nb mouseX","em.w mouseY","ub.m maxX","a.g minY","tg.c minX","li.x maxY","tl.d state","od.i elapsed","il.I brightness","gj.d cycle","ba.x flicker"};
        for(String item:fields) { String[] pair=item.split(" ");names.put(pair[0],pair[1]); }
        if(args.length==2) {prepare(Path.of(args[0]),Path.of(args[1])); return;}
        nk.O=new e(); ah.n=bn.eb=0; nc.n=100; tm.i=100;
        for (int hardware=0;hardware<=1;hardware++) for (int mode:new int[]{1,3}) for (int mouse:new int[]{-1,50,110}) for(int toggle=0;toggle<=1;toggle++) {
            tf.w=hardware!=0; flip=toggle!=0; sg.o=mode; me.nb=mouse; em.w=50; em.z=mouse==110; tl.d=mode==1?10:30;
            ob.a=new boolean[]{true,false,false,false,false};
            sa.Q=ch.z=qg.Y=wh.m=new int[5];
            bi.jb=false; events.clear();scales=0;
            ui.a(-6403,100,false,0,100,0);
            System.out.println(String.join(" ",events));
        }
    }
}
