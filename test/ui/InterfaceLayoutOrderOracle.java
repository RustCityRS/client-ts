import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

class InterfaceLayoutOrderOracle {
    static void prepare(Path jar,Path dir)throws Exception{
        try(var file=new JarFile(jar.toFile())){
            for(String owner:List.of("pa","gh","hf")){
                String desc=switch(owner){case "gh"->"(Laj;BII)V";case "pa"->"(Laj;IZII)V";default->"(IIIB[Laj;Z)V";};
                var in=new ClassReader(file.getInputStream(file.getJarEntry(owner+".class")));
                var out=new ClassWriter(in,ClassWriter.COMPUTE_MAXS);
                in.accept(new ClassVisitor(Opcodes.ASM8,out){
                    public MethodVisitor visitMethod(int access,String name,String d,String sig,String[] ex){
                        var base=super.visitMethod(access,name,d,sig,ex);
                        if(!name.equals("a")||!desc.equals(d))return base;
                        return new MethodVisitor(Opcodes.ASM8,base){
                            public void visitFieldInsn(int op,String target,String field,String type){
                                if(target.equals("aj")&&(op==Opcodes.GETFIELD||op==Opcodes.PUTFIELD)){
                                    super.visitLdcInsn((op==Opcodes.GETFIELD?"r":"w")+field);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterfaceLayoutOrderOracle","event","(Ljava/lang/String;)V",false);
                                }
                                super.visitFieldInsn(op,target,field,type);
                            }
                            public void visitMethodInsn(int op,String target,String name,String d,boolean iface){
                                // Isolate hf.a's own widget accesses, including which partially updated
                                // widget is observable when it enters either layout helper or recursion.
                                if(owner.equals("hf")&&name.equals("a")&&Set.of("gh","pa","mi").contains(target)){
                                    super.visitMethodInsn(op,"InterfaceLayoutOrderOracle",target,d,false);
                                }else super.visitMethodInsn(op,target,name,d,iface);
                            }
                        };
                    }
                },0);
                Files.write(dir.resolve(owner+".class"),out.toByteArray());
            }
        }
    }

    static aj c;
    static int at,action,n;
    static StringJoiner log;
    static final Object[] oldHook={"first"},newHook={"second"};
    static void event(String key){
        log.add(key);
        if(++n!=at)return;
        if(action==1)throw new IllegalStateException();
        if(action==2)throw new AssertionError();
        if(action==3){
            c.C=17;c.H=-47;c.hc=71;c.Ac=-11;c.jb=173;c.ld=-71;c.ic=newHook;
            c.Bc=0x70000;c.Ec=-8193;c.G=-33;c.M=81;c.cb=3;c.Wb=10;
        }
    }
    public static void gh(aj widget,byte guard,int w,int h){event("gh:"+guard+","+w+","+h);}
    public static void pa(aj widget,int w,boolean change,int h,int guard){event("pa:"+w+","+change+","+h);}
    public static void mi(boolean change,aj widget,int guard){event("mi:"+change);}
    static String error(Throwable e){
        if(e instanceof g wrapped)return wrapped.q+"/"+error(wrapped.a);
        if(e instanceof AssertionError)return "fatal";
        if(e instanceof IllegalStateException)return "probe";
        if(e instanceof ArithmeticException)return "zero";
        if(e instanceof NullPointerException)return "null";
        throw new AssertionError(e);
    }
    static void run(int[] v){
        int entry=v[0],a=v[1],b=v[2],type=v[3],seed=v[4],qa=v[5],active=v[6],resize=v[7];
        int w=seed==3?Integer.MAX_VALUE:31,h=seed==3?Integer.MIN_VALUE:24;
        c=new aj();c.n=13;c.ub=c.X=(byte)a;c.m=c.h=(byte)b;c.ob=type;c.wc=seed==1?1337:4;
        c.C=seed==1?-13:11;c.H=seed==1?-17:12;c.Mb=-27;c.ib=41;
        c.Bc=seed==0?-6:seed==1?278:0x600023;c.Ec=seed==0?-9:seed==1?271:-0x222223;
        c.G=seed==0?3:seed==1?-6:0x33333337;c.M=seed==0?4:seed==1?-8:-0x22222225;
        c.ab=-3;c.jd=5;c.cb=seed==2?0:3;c.Wb=seed==4?0:7;
        c.hc=seed==1?-12:99;c.Ac=seed==1?0:153;c.jb=43;c.ld=39;
        c.ic=seed==4?null:oldHook;c.Sc=new l(active,-1);
        uc.c=qa!=0;mi.q=new gk();bh.l=null;
        if(seed==5)mi.q=null;
        aj other=new aj();other.n=18;
        at=v[8];action=v[9];n=0;log=new StringJoiner(",");String fault="-";
        try{
            if(entry==0)gh.a(c,(byte)(seed%2==0?-116:-76),w,h);
            else if(entry==1)pa.a(c,w,resize!=0,h,2);
            else hf.a(w,h,13,(byte)100,seed==6?null:seed==7?new aj[0]:new aj[]{null,other,c},resize!=0);
        }catch(Throwable e){fault=error(e);}
        wf ev=mi.q==null?null:(wf)mi.q.d(0);
        System.out.println(String.join("|",fault,log.toString(),c.ib+","+c.Mb+","+c.C+","+c.H+","+c.hc+","+c.Ac,
            (bh.l==c)+","+(ev==null?"-":(ev.C==c)+","+(ev.G==oldHook?"old":ev.G==newHook?"new":"other"))));
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        Class.forName("client");
        var in=new BufferedReader(new InputStreamReader(System.in));
        for(String line; (line=in.readLine())!=null;)run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
