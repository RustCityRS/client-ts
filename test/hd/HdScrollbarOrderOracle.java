import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

/** Keep the original fn dispatcher, cap sprites, guard arithmetic, field reads and
 * exception wrapper. Record the arguments at its ten CPU and ten GPU raster calls. */
public class HdScrollbarOrderOracle {
    static List<String> events=new ArrayList<>();
    static int fail, toggle;
    public static void event(String access) {
        events.add(access);
        int step=events.size();
        if(step==fail)throw new IllegalStateException("probe");
        if(step==toggle)tf.w=!tf.w;
        oj.p=step*37+1; ec.l=step*37+2; rl.Z=step*37+3; bj.V=step*37+4;
    }
    public static void rect(int x,int y,int width,int height,int colour,String op) {
        event(op+":"+x+","+y+","+width+","+height+","+colour);
    }
    public static void line(int x,int y,int length,int colour,String op) {
        event(op+":"+x+","+y+","+length+","+colour);
    }
    static void patch(String jar,Path dir) throws Exception {
        Map<String,String> fields=Map.of("th.f","caps","tf.w","active","oj.p","track","ec.l","grip","rl.Z","light","bj.V","dark");
        try(JarFile archive=new JarFile(jar)){
            ClassReader r=new ClassReader(archive.getInputStream(archive.getJarEntry("fn.class")));
            ClassWriter w=new ClassWriter(r,ClassWriter.COMPUTE_MAXS);
            r.accept(new ClassVisitor(Opcodes.ASM8,w){
                public MethodVisitor visitMethod(int flags,String name,String desc,String sig,String[] ex){
                    var base=super.visitMethod(flags,name,desc,sig,ex);
                    if(!name.equals("a")||!desc.equals("(BIIIII)V"))return base;
                    return new MethodVisitor(Opcodes.ASM8,base){
                        public void visitFieldInsn(int op,String o,String n,String d){
                            String label=fields.get(o+"."+n);
                            if(op==Opcodes.GETSTATIC&&label!=null){super.visitLdcInsn(label);super.visitMethodInsn(Opcodes.INVOKESTATIC,
                                "HdScrollbarOrderOracle","event","(Ljava/lang/String;)V",false);}
                            super.visitFieldInsn(op,o,n,d);
                        }
                        public void visitMethodInsn(int op,String o,String n,String d,boolean itf){
                            if(op==Opcodes.INVOKESTATIC&&(o.equals("kb")||o.equals("dj"))){
                                super.visitLdcInsn(o+"."+n);
                                super.visitMethodInsn(op,"HdScrollbarOrderOracle",d.equals("(IIIII)V")?"rect":"line",
                                    d.replace(")","Ljava/lang/String;)"),false);
                            }else super.visitMethodInsn(op,o,n,d,itf);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("fn.class"),w.toByteArray());
        }
    }
    public static void main(String[] args)throws Exception{
        if(args.length>0){patch(args[0],Path.of(args[1]));return;}
        byte[] pixels={1}; int[] palette={0,17};
        th.f=new ok[]{new ek(1,1,0,0,1,1,pixels,palette),new ek(1,1,0,0,1,1,pixels,palette)};
        kb.a(new int[64*128],64,128);
        for(int mode=0;mode<=1;mode++)for(int flip:new int[]{0,2,5})for(int fault=0;fault<=23;fault++){
            events.clear(); tf.w=mode==1; fail=fault; toggle=flip;
            String status="ok";
            try{fn.a((byte)120,17,240,2,3,100);}
            catch(ld e){status=e.f.getClass().getSimpleName()+" "+e.e;}
            System.out.println(mode+","+flip+","+fault+"|"+status+"|"+String.join(";",events));
        }
    }
}
