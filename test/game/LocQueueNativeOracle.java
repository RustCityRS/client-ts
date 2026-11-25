import java.lang.reflect.Field;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class LocQueueNativeOracle {
    static final al models=new al(null,false,false);
    static final Field shapes=field(jb.class,"T"), ids=field(jb.class,"yb"), cursor=field(gk.class,"t");
    static StringJoiner calls;
    static ff change,waiting;
    static gk queue;
    static int mode,tick;
    static Field field(Class<?> owner,String name) {
        try{Field f=owner.getDeclaredField(name);f.setAccessible(true);return f;}catch(Exception e){throw new AssertionError(e);}
    }
    // Preserve the JVM invocation's receiver check and Java argument evaluation in jb.a.
    public static boolean request(al archive,boolean accelerated,int group,int file) {
        calls.add("model,"+accelerated+","+group+","+file);
        if(mode==4 && group==5)throw new IllegalStateException();
        if(mode==17)wh.S=null;
        if(mode==18)ik.Y=null;
        if(mode==21){change.w=3;change.N=4;change.O=2;change.B=3;}
        return mode!=2 && (mode!=1 || tick>1) && (mode!=3 || group!=5 || tick>0);
    }
    public static void add(boolean water,int plane,int id,int height,int angle,int shape,int x,int z,boolean surface,ke collision,int guard) {
        calls.add("add,"+water+","+plane+","+id+","+height+","+angle+","+shape+","+x+","+z+","+surface+","+(collision!=null)+","+lf.i);
        if(mode==12)throw new NullPointerException();
        if(mode==13 && tick==0)throw new IllegalStateException();
    }
    static void instrument(Path jar,Path dir)throws Exception {
        try(JarFile source=new JarFile(jar.toFile())) {
            for(String owner:List.of("al","o")){
                ClassReader reader=new ClassReader(source.getInputStream(source.getJarEntry(owner+".class")));
                ClassWriter out=new ClassWriter(0);
                reader.accept(new ClassVisitor(Opcodes.ASM8,out){
                    public MethodVisitor visitMethod(int flags,String name,String desc,String sig,String[] ex){
                        MethodVisitor m=super.visitMethod(flags,name,desc,sig,ex);
                        if(owner.equals("al") && name.equals("a") && desc.equals("(ZII)Z")){
                            m.visitCode();m.visitVarInsn(Opcodes.ALOAD,0);
                            for(int i=1;i<=3;i++)m.visitVarInsn(Opcodes.ILOAD,i);
                            m.visitMethodInsn(Opcodes.INVOKESTATIC,"LocQueueNativeOracle","request","(Lal;ZII)Z",false);
                            m.visitInsn(Opcodes.IRETURN);m.visitMaxs(4,4);m.visitEnd();return null;
                        }
                        if(!owner.equals("o")||!name.equals("a")||!desc.equals("(IIIBIIII)V"))return m;
                        return new MethodVisitor(Opcodes.ASM8,m){
                            public void visitMethodInsn(int op,String c,String n,String d,boolean iface){
                                if(c.equals("nc")&&n.equals("a")&&d.equals("(ZIIIIIIIZLke;I)V"))super.visitMethodInsn(op,"LocQueueNativeOracle","add",d,false);
                                else super.visitMethodInsn(op,c,n,d,iface);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),out.toByteArray());
            }
        }
    }
    static String name(Object n){return n==null?"-":n==queue.c?"S":n==change?"a":n==waiting?"b":"?";}
    static void run(int scenario,int expiry,int shape)throws Exception{
        mode=scenario; queue=wh.S=new gk();
        change=new ff();waiting=new ff();waiting.r=waiting.F=9;
        change.w=mode==15?0:2;change.N=3;change.t=1;change.z=0;
        change.C=change.D=shape;change.O=2;change.B=mode==22?2:1;
        change.L=mode==16?-1:1;change.K=mode==16?-1:mode==22?1:2;
        change.r=expiry==1?1:3;change.F=1;
        queue.a(change,false);queue.a(waiting,false);
        tb.t=mode==7?null:new byte[4][8][8];
        if(tb.t!=null)tb.t[1][2][3]=2;
        rj.l=mode!=14;sb.h=0;lf.i=false;
        hc.c=mode==8?null:mode==9?new ke[1]:new ke[]{null,mode==11?null:new ke(8,8)};
        kl.Bb=mode==10?null:new ra[2][8][8];
        ra square=new ra(1,2,3);square.z=new hk();square.z.f=7L<<32;
        if(kl.Bb!=null)kl.Bb[1][2][3]=square;
        he.w.a(0); ik.Y=mode==5||mode==19||mode==23?null:models;
        for(int id:new int[]{0,1,2,7}){
            jb def=new jb();def.k=id;def.qb=mode==11?1:0;
            if(id==1||id==2){
                shapes.set(def,mode==3||mode==4||mode==18||mode==20?null:mode==23?new int[]{999}:new int[]{4,10,22,4});
                ids.set(def,mode==6||mode==19?new int[0]:mode==20?null:new int[]{-1,65541,23,88});
            }
            he.w.a(id,def,(byte)-71);
        }
        for(tick=0;tick<3;tick++){
            calls=new StringJoiner(";");String result="ok";
            try{od.e((byte)-118);}catch(RuntimeException e){
                Throwable cause=e;while(cause instanceof g nested)cause=nested.a;
                if(cause instanceof NullPointerException)result="null";
                else if(cause instanceof IndexOutOfBoundsException)result="bounds";
                else if(cause instanceof IllegalStateException)result="stop";
                else throw e;
            }
            System.out.println(String.join("|",result,calls.toString(),change.r+","+change.F+","+waiting.r+","+waiting.F,
                name(queue.c.g)+name(queue.c.p)+name(cursor.get(queue))+name(change.p)+name(change.g),
                (square.z!=null)+","+lf.i));
        }
    }
    public static void main(String[]args)throws Exception{
        if(args.length==2){instrument(Path.of(args[0]),Path.of(args[1]));return;}
        Scanner in=new Scanner(System.in);
        while(in.hasNextInt())run(in.nextInt(),in.nextInt(),in.nextInt());
    }
}
