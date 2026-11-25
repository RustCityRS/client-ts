import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

class AreaSoundFrameOracle {
    static final RuntimeException raw=new IllegalStateException();
    static final Error serious=new AssertionError();
    static final Exception checked=new IOException();
    static g wrapped;
    static int failure,loads;

    // The observed class only replaces vd.a(Lal;II)Lvd; at the two call sites in
    // cl.a(Lik;IIIII)V. Throwable handlers, list advancement and mutations stay original.
    static vd load(al archive,int group,int file)throws Throwable {
        loads++;
        return switch(failure){
            case 0 -> throw raw;
            case 1 -> throw wrapped;
            case 2 -> throw checked;
            case 3 -> throw serious;
            default -> vd.a(archive,group,file);
        };
    }
    static void instrument(Path jar,Path dest)throws Exception {
        try(JarFile source=new JarFile(jar.toFile())){
            ClassReader reader=new ClassReader(source.getInputStream(source.getJarEntry("cl.class")));
            ClassWriter writer=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    MethodVisitor original=super.visitMethod(access,name,desc,sig,ex);
                    if(!name.equals("a")||!desc.equals("(Lik;IIIII)V"))return original;
                    return new MethodVisitor(Opcodes.ASM8,original){
                        public void visitMethodInsn(int op,String owner,String method,String type,boolean itf){
                            if(op==Opcodes.INVOKESTATIC && owner.equals("vd") && method.equals("a") && type.equals("(Lal;II)Lvd;"))
                                super.visitMethodInsn(op,"AreaSoundFrameOracle","load",type,false);
                            else super.visitMethodInsn(op,owner,method,type,itf);
                        }
                    };
                }
            },0);
            Files.write(dest.resolve("cl.class"),writer.toByteArray());
        }
    }
    static void run(int[] a){
        int site=a[0],plane=a[2],elapsed=a[3],x=a[4],z=a[5];
        failure=a[1];loads=0;wrapped=new g(raw,"earlier.context");
        nc.j=new gk();ik.s=new gk();jk.A=new nc(16);rg.m=null;dd.u=91;
        ik before=new ik(),subject=new ik(),after=new ik();
        for(ik s:new ik[]{before,subject,after}){
            s.C=s.B=x;s.M=s.E=z;s.L=plane;s.A=128;s.N=-1;
            s.q=new int[]{53};s.t=elapsed+5;
        }
        nc.j.a(before,true);
        switch(site){
            case 0 -> nc.j=null;
            case 1 -> ik.s=null;
            case 2 -> jk.A=null;
            case 3 -> ik.s.a(subject,true);
            case 4 -> jk.A.a((byte)-89,subject,91L);
            case 5 -> nc.j.a(new jf(),true);
            case 6 -> ik.s.a(new jf(),true);
            case 7 -> jk.A.a((byte)-89,new jf(),91L);
            case 8 -> {subject.t=elapsed-3;subject.q=new int[0];nc.j.a(subject,true);}
            case 9,12 -> {subject.N=71;nc.j.a(subject,true);}
            case 10,11 -> {}
            case 13 -> {subject.t=elapsed-3;nc.j.a(subject,true);}
            default -> throw new AssertionError(site);
        }
        if(nc.j!=null)nc.j.a(after,true);
        String fault="ok",context="-";boolean sameThrown=false,sameCause=false;
        try{
            if(site==10)cl.a(null,x,elapsed,z,0,plane);
            else tk.a((byte)101,plane,elapsed,x,z);
        }catch(Throwable t){
            sameThrown=(failure==0&&t==raw)||(failure==1&&t==wrapped)||(failure==2&&t==checked)||(failure==3&&t==serious);
            if(t instanceof g e){context=e.q;t=e.a;}
            sameCause=t==raw;
            if(t instanceof NullPointerException)fault="null";
            else if(t instanceof ArrayIndexOutOfBoundsException)fault="bounds";
            else if(t instanceof ClassCastException)fault="cast";
            else if(t==raw)fault="raw";
            else if(t==checked)fault="checked";
            else if(t==serious)fault="error";else throw new AssertionError(t);
        }
        System.out.println(fault+"|"+context+"|"+sameThrown+","+sameCause+"|"+loads+"|"+before.t+","+subject.t+","+after.t);
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){instrument(Path.of(args[0]),Path.of(args[1]));return;}
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String row;(row=in.readLine())!=null;)run(Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
