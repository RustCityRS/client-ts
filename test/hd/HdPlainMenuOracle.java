import java.io.InputStream;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

// Capture the HD menu's primitive calls at the original dispatch sites in lf.b.
class HdPlainMenuOracle {
    static final List<String> calls = new ArrayList<>();
    public static void rect(int x,int y,int w,int h,int rgb,String kind) {
        calls.add(kind+" "+x+" "+y+" "+w+" "+h+" "+rgb);
    }
    public static void text(rk font,na string,int x,int y,int rgb,int shadow) {
        Objects.requireNonNull(font);
        StringBuilder label = new StringBuilder();
        for(int i=0;i<string.d(-92);i++) label.append((char)string.c(i,(byte)-96));
        calls.add(label+" "+x+" "+y+" "+rgb+" "+shadow);
    }
    static void instrument(Path directory)throws Exception {
        try(InputStream in=HdPlainMenuOracle.class.getResourceAsStream("/lf.class")){
            ClassReader reader=new ClassReader(in);
            ClassWriter writer=new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    MethodVisitor m=super.visitMethod(access,name,desc,sig,ex);
                    if(!name.equals("b") || !desc.equals("(I)V"))return m;
                    return new MethodVisitor(Opcodes.ASM8,m){
                        public void visitMethodInsn(int op,String cls,String name,String desc,boolean itf){
                            if((cls.equals("dj")||cls.equals("kb")) && desc.equals("(IIIII)V")){
                                super.visitLdcInsn(cls+"."+name);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdPlainMenuOracle","rect","(IIIIILjava/lang/String;)V",false);
                            }else if(cls.equals("rk") && name.equals("a") && desc.equals("(Lna;IIII)V")){
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdPlainMenuOracle","text","(Lrk;Lna;IIII)V",false);
                            }else super.visitMethodInsn(op,cls,name,desc,itf);
                        }
                    };
                }
            },0);
            Files.write(directory.resolve("lf.class"),writer.toByteArray());
        }
    }
    public static void main(String[] args)throws Exception {
        if(args.length>0){instrument(Path.of(args[0]));return;}
        ta.w=cd.a("Menu",(byte)-128);
        for(int i=0;i<3;i++){uj.C[i]=cd.a("Op"+i,(byte)-128);t.v[i]=cd.a(i==1?"target":"",(byte)-128);}
        wl.q=new dd(new byte[257]);
        for(int mask=0;mask<32;mask++){
            tf.w=(mask&1)!=0;
            ok.b=(mask&2)!=0?Integer.MAX_VALUE-9:-3;
            si.ab=(mask&4)!=0?Integer.MIN_VALUE+8:13;
            bn.O=(mask&8)!=0?-8:150;bc.X=69;
            rh.o=ok.b+2;sc.v=si.ab+30;
            sk.kb=(mask&16)!=0?0:3;
            bn.V=1;vh.b[0]=sd.V[0]=e.sc[0]=fe.lb[0]=10;ch.y[0]=false;
            calls.clear();
            lf.b(-117);
            System.out.println(String.join("|",calls)+"|"+ch.y[0]);
        }
    }
}
