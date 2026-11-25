import java.awt.Frame;
import java.awt.Insets;
import java.awt.event.WindowListener;
import java.io.*;
import java.lang.instrument.*;
import java.nio.charset.StandardCharsets;
import java.security.ProtectionDomain;
import java.util.*;
import java.util.concurrent.*;
import jdk.internal.org.objectweb.asm.*;

public class StandaloneOracle {
    static final ArrayList<String> calls = new ArrayList<>();
    static CountDownLatch entered;
    static int exit;
    static String fail;
    public static class Exit extends Error {}
    public static void exit(int code) { exit=code; throw new Exit(); }
    public static void exitFromShell(int code) {
        System.out.println("exit "+code);
        if (fail.equals("blocked")) throw new SecurityException();
        System.exit(code);
    }
    public static void run() { entered.countDown(); }
    static Object allocate(Class<?> cls) throws Exception {
        Class<?> unsafe=Class.forName("sun.misc.Unsafe");
        var f=unsafe.getDeclaredField("theUnsafe"); f.setAccessible(true);
        return unsafe.getMethod("allocateInstance",Class.class).invoke(f.get(null),cls);
    }
    public static Object clientObject() throws Exception { return allocate(client.class); }
    public static Frame frameObject() throws Exception { call("create"); return (Frame)allocate(FrameHost.class); }
    static void call(String text) {
        calls.add(text);
        if(text.equals(fail)) throw new IllegalStateException("frame host");
    }
    public static final class FrameHost extends Frame {
        public void setTitle(String title){ call("title "+title); }
        public void setResizable(boolean enabled){ call("resize "+enabled); }
        public void addWindowListener(WindowListener shell){ call("listen "+(shell==jg.k)); }
        public void setVisible(boolean enabled){ call("visible "+enabled); }
        public void toFront(){ call("front"); }
        public Insets getInsets(){ call("insets"); return new Insets(17,3,5,7); }
        public void setSize(int w,int h){ call("size "+w+" "+h); }
        public void setLocation(int x,int y){ call("loc "+x+" "+y); }
    }
    public static void thread(int type,Runnable task,int priority){ calls.add("thread "+(task==jg.k)+" "+priority); }

    // Replace the two headless-incompatible object allocations and the launched game loop.
    // The original main, standalone startup, translation, Signlink constructor and thread queue run.
    public static void premain(String opts,Instrumentation instrumentation) {
        instrumentation.addTransformer(new ClassFileTransformer(){
            public byte[] transform(ClassLoader loader,String name,Class<?> cls,ProtectionDomain domain,byte[] bytes) {
                if(!Set.of("client","p","ef","fb").contains(name))return null;
                ClassWriter cw=new ClassWriter(0);
                new ClassReader(bytes).accept(new ClassVisitor(Opcodes.ASM8,cw){
                    public MethodVisitor visitMethod(int access,String method,String desc,String sig,String[] exceptions){
                        MethodVisitor mv=super.visitMethod(access,method,desc,sig,exceptions);
                        if(name.equals("p") && method.equals("run") && desc.equals("()V")){
                            mv.visitCode();mv.visitMethodInsn(Opcodes.INVOKESTATIC,"StandaloneOracle","run","()V",false);
                            mv.visitInsn(Opcodes.RETURN);mv.visitMaxs(0,1);mv.visitEnd();return null;
                        }
                        return new MethodVisitor(Opcodes.ASM8,mv) {
                            String allocated=null;
                            public void visitCode(){
                                super.visitCode();
                                if(name.equals("fb")&&method.equals("a")&&desc.equals("(ILjava/lang/Runnable;I)Ldj;")){
                                    super.visitVarInsn(Opcodes.ILOAD,1);super.visitVarInsn(Opcodes.ALOAD,2);super.visitVarInsn(Opcodes.ILOAD,3);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"StandaloneOracle","thread","(ILjava/lang/Runnable;I)V",false);
                                }
                            }
                            public void visitTypeInsn(int op,String type){
                                if(op==Opcodes.NEW && ((name.equals("client")&&method.equals("main")&&type.equals("client")) ||
                                        (name.equals("p")&&desc.equals("(IIIILjava/lang/String;IZI)V")&&type.equals("java/awt/Frame")))){allocated=type;return;}
                                super.visitTypeInsn(op,type);
                            }
                            public void visitInsn(int op){ if(allocated==null||op!=Opcodes.DUP)super.visitInsn(op); }
                            public void visitMethodInsn(int op,String owner,String n,String d,boolean itf){
                                if(owner.equals(allocated)&&n.equals("<init>")){
                                    if(owner.equals("client")){
                                        super.visitMethodInsn(Opcodes.INVOKESTATIC,"StandaloneOracle","clientObject","()Ljava/lang/Object;",false);
                                        super.visitTypeInsn(Opcodes.CHECKCAST,"client");
                                    }else super.visitMethodInsn(Opcodes.INVOKESTATIC,"StandaloneOracle","frameObject","()Ljava/awt/Frame;",false);
                                    allocated=null;
                                } else if(name.equals("ef")&&owner.equals("java/lang/System")&&n.equals("exit"))
                                    super.visitMethodInsn(op,"StandaloneOracle","exit",d,false);
                                else if(name.equals("p")&&owner.equals("java/lang/System")&&n.equals("exit"))
                                    super.visitMethodInsn(op,"StandaloneOracle","exitFromShell",d,false);
                                else super.visitMethodInsn(op,owner,n,d,itf);
                            }
                        };
                    }
                },0);
                return cw.toByteArray();
            }
        });
    }

    static class Shell extends p {
        public void init(){} void a(int x){} void b(byte x){} void d(int x){}
        void c(int x){System.out.println("quit");}
        void a(boolean x){System.out.println("release "+x);}
    }
    static class ShutdownTest {
    static void run(String kind)throws Exception{
        fail=kind;
        p shell=kind.equals("concrete")?(client)clientObject():(Shell)allocate(Shell.class);
        dg.B=shell instanceof client?(client)shell:null;jg.k=shell;
        tb.h=kind.equals("applet")?null:(Frame)allocate(FrameHost.class);
        fb worker=ca.l=tj.m=new fb(null,0,"runescape",28);
        var method=p.class.getDeclaredMethod("a",int.class,boolean.class);
        method.setAccessible(true);method.invoke(shell,-864,true);
        var stopped=fb.class.getDeclaredField("q");stopped.setAccessible(true);
        System.out.println("returned "+g.r+" "+(dg.B!=null)+" "+(jg.k==shell)+" "+(tb.h!=null)+" "+(ca.l!=null)+" "+(tj.m!=null)+" "+stopped.getBoolean(worker));
    }
    }
    public static void main(String[] options)throws Exception {
        if(options.length>0){ShutdownTest.run(options[0]);return;}
        PrintStream original=System.out;
        var reader=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8));
        for(String row;(row=reader.readLine())!=null;){
            String[] parts=row.split(" ",-1);
            String[] args=new String[parts.length-1];
            for(int i=0;i<args.length;i++) args[i]=parts[i+1].equals("-")?null:new String(Base64.getDecoder().decode(parts[i+1]),StandardCharsets.UTF_8);
            fail=parts[0].replace('_',' ');calls.clear();exit=-1;entered=new CountDownLatch(1);
            ik.R=907;d.c=31;oi.e=12;hl.w=29;uj.l=true;lk.z=true;client.L=true;jl.c=-7;vk.kb=true;ce.F=91;da.e=61;oj.k=null;
            dg.B=null;jg.k=null;tb.h=null;ca.l=tj.m=null;mf.j=908;pa.rb=3;sk.N=5;hi.f=7;fl.l=9;vk.rb=11;oh.j=13;
            var output=new ByteArrayOutputStream();System.setOut(new PrintStream(output,true,StandardCharsets.UTF_8));
            try {
                if(fail.equals("shell")){
                    client shell=(client)clientObject();
                    shell.a(Integer.parseInt(args[0]),-17,85,Integer.parseInt(args[1]),"other",Integer.parseInt(args[2]),true,-11014);
                }else client.main(fail.equals("nullargs")?null:args);
            }catch(Exit e){}
            if(tj.m!=null && !entered.await(5,TimeUnit.SECONDS))throw new IllegalStateException("game thread");
            if(tj.m!=null)tj.m.a(100);
            System.setOut(original);
            String logs=output.toString(StandardCharsets.UTF_8).trim();
            if(logs.startsWith("Error:"))logs="error";
            original.println(String.join("|",""+ik.R,""+d.c,""+oi.e,""+hl.w,""+uj.l,""+lk.z,""+client.L,""+jl.c,""+vk.kb,
                ""+ce.F,""+da.e,""+(oj.k==ga.J),""+(dg.B!=null),""+(jg.k!=null),""+(dg.B==jg.k),""+mf.j,""+pa.rb,""+sk.N,
                ""+hi.f,""+fl.l,""+vk.rb,""+oh.j,""+(tb.h!=null),""+(ca.l==tj.m),""+(tj.m!=null&&tj.m.o==null),""+(entered.getCount()==0),
                ""+exit,String.join(",",calls),logs));
        }
    }
}
