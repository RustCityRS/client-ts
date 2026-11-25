import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// The observed run adds watchpoints only inside de.a. Its four square lookups
// still execute ke.b, gk.a, j.a and dd.a from the unmodified gamepack.
public class LocChangeSetOldOracle {
    static void prepare(String jar,Path dir)throws Exception{
        try(JarFile file=new JarFile(jar)){
            ClassReader reader=new ClassReader(file.getInputStream(file.getJarEntry("de.class")));
            ClassWriter writer=new ClassWriter(ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    MethodVisitor mv=super.visitMethod(access,name,desc,sig,ex);
                    if(!name.equals("a")||!desc.equals("(Lff;I)V"))return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv){
                        public void visitFieldInsn(int op,String c,String n,String d){
                            if(!c.equals("ff")){super.visitFieldInsn(op,c,n,d);return;}
                            super.visitLdcInsn(n);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocChangeSetOldOracle",op==Opcodes.GETFIELD?"read":"store",
                                op==Opcodes.GETFIELD?"(Lff;Ljava/lang/String;)I":"(Lff;ILjava/lang/String;)V",false);
                        }
                        public void visitMethodInsn(int op,String c,String n,String d,boolean iface){
                            if(d.equals("(III)J")){
                                super.visitLdcInsn(c);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"LocChangeSetOldOracle","lookup","(IIILjava/lang/String;)J",false);
                            }else super.visitMethodInsn(op,c,n,d,iface);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("de.class"),writer.toByteArray());
        }
    }
    static ff change;
    static int mode,failure,step,reads;
    static StringJoiner trace;
    static void watch(String tag){trace.add(tag);if(++step==failure)throw new IllegalStateException();}
    static int read(ff f,String n){
        Objects.requireNonNull(f);
        int value=switch(n){case "z"->f.z;case "t"->f.t;case "w"->f.w;case "N"->f.N;default->throw new AssertionError(n);};
        if(mode==23&&n.equals("z"))value=reads++;
        watch(n+"="+value);return value;
    }
    static void store(ff f,int v,String n){
        watch(n+"<-"+v);
        switch(n){case "B"->f.B=v;case "D"->f.D=v;case "K"->f.K=v;default->throw new AssertionError(n);}
    }
    static long lookup(int p,int x,int z,String c){
        watch(c+"("+p+","+x+","+z+")");
        long key=switch(c){case "ke"->ke.b(p,x,z);case "gk"->gk.a(p,x,z);case "j"->j.a(p,x,z);case "dd"->dd.a(p,x,z);default->throw new AssertionError(c);};
        if(mode>=20&&mode<=22){
            change.z++;
            if(mode==21){change.t=1;change.w=2;change.N=2;}
            if(mode==22)kl.Bb=null;
        }
        return key;
    }
    static ra tile(int p,int x,int z,long key){
        ra t=new ra(p,x,z);t.z=new hk();t.z.f=key;t.C=new nf();t.C.a=key;t.u=new pk();t.u.e=key;
        ec s=new ec();s.u=key;s.a=x;s.m=z;t.H[0]=s;t.t=1;return t;
    }
    static String run(String[] row){
        mode=Integer.parseInt(row[1]);long key=Long.parseUnsignedLong(row[2],16);
        int initialAngle=Integer.parseInt(row[3]);failure=Integer.parseInt(row[4]);step=reads=0;trace=new StringJoiner(";");
        change=new ff();change.z=Integer.parseInt(row[0]);change.t=0;change.w=change.N=1;
        change.B=-67;change.D=63;change.K=13579;
        kl.Bb=new ra[2][3][3];ra s=kl.Bb[0][1][1]=tile(0,1,1,key);
        kl.Bb[1][2][2]=tile(1,2,2,key^0x811111110031c000L);
        if(mode>=20){s.C.a=key^0x300000001L;s.u.e=key^0x7fffffff0017c000L;}
        switch(mode){
            case 1->kl.Bb[0][1][1]=null;
            case 2->{s.z=null;s.C=null;s.u=null;s.t=0;}
            case 3->kl.Bb=null;
            case 4->kl.Bb=new ra[0][][];
            case 5->kl.Bb[0]=null;
            case 6->kl.Bb[0]=new ra[1][];
            case 7->kl.Bb[0][1]=null;
            case 8->kl.Bb[0][1]=new ra[0];
            case 9->s.H[0]=null;
            case 10->s.H=null;
            case 11->s.H=new ec[0];
            case 12->s.t=-2;
            case 13->s.t=Integer.MAX_VALUE;
            case 14->{s.H[1]=s.H[0];s.H[0]=new ec();s.H[0].u=0x20000000L;s.t=2;}
            case 15->{s.H[0].a=2;s.H[1]=null;s.t=2;}
            case 16->s.H[0].m=2;
            case 17->change.t=2;
            case 18->change.N=-1;
        }
        String result="ok";
        try{de.a(mode==19?null:change,initialAngle);}
        catch(RuntimeException ex){
            Throwable t=ex;while(t instanceof g w)t=w.a;
            if(t instanceof NullPointerException)result="null";
            else if(t instanceof ArrayIndexOutOfBoundsException)result="bounds:"+t.getMessage().split(" ")[1];
            else if(t instanceof IllegalStateException)result="probe";
            else throw ex;
        }
        return result+"|"+change.B+","+change.D+","+change.K+"|"+trace;
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){prepare(args[0],Path.of(args[1]));return;}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String s;(s=in.readLine())!=null;)System.out.println(run(s.split(" ")));
    }
}
