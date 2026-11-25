import java.io.*;
import java.lang.instrument.*;
import java.nio.charset.StandardCharsets;
import java.security.ProtectionDomain;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

@SuppressWarnings("removal")
public class EnvironmentScriptOracle {
    static long time;
    static int jsMode;
    static String call="-";
    public static long now(int unused){return time;}
    public static Object call(int unused,java.applet.Applet applet,String name){
        call=name;
        switch(jsMode){case 0:throw new RuntimeException();case 1:return true;case 2:return false;case 3:return null;default:return "true";}
    }
    // Substitute only the wall clock and the LiveConnect bridge. gh.a, pe.c, d.b and GregorianCalendar execute in the gamepack.
    public static void premain(String ignored,Instrumentation instrumentation){
        instrumentation.addTransformer(new ClassFileTransformer(){
            public byte[] transform(ClassLoader loader,String name,Class<?> was,ProtectionDomain domain,byte[] data){
                if(!name.equals("gh")&&!name.equals("id"))return null;
                ClassWriter out=new ClassWriter(0);
                new ClassReader(data).accept(new ClassVisitor(Opcodes.ASM8,out){
                    public MethodVisitor visitMethod(int a,String n,String d,String sig,String[] ex){
                        return new MethodVisitor(Opcodes.ASM8,super.visitMethod(a,n,d,sig,ex)){
                            public void visitMethodInsn(int op,String owner,String method,String desc,boolean itf){
                                if(owner.equals("eh")&&method.equals("a")&&desc.equals("(I)J"))
                                    super.visitMethodInsn(op,"EnvironmentScriptOracle","now",desc,false);
                                else if(owner.equals("w")&&method.equals("a")&&desc.equals("(ILjava/applet/Applet;Ljava/lang/String;)Ljava/lang/Object;"))
                                    super.visitMethodInsn(op,"EnvironmentScriptOracle","call",desc,false);
                                else super.visitMethodInsn(op,owner,method,desc,itf);
                            }
                        };
                    }
                },0);return out.toByteArray();
            }
        });
    }
    public static void main(String[] args)throws Exception{
        ok.s=Calendar.getInstance(TimeZone.getTimeZone(args[0]));ok.s.setTimeInMillis(0L);
        tj.m=new fb(null,0,null,0);int next=75301;
        try(BufferedReader reader=new BufferedReader(new InputStreamReader(System.in))){
            for(String row;(row=reader.readLine())!=null;){
                String[] v=row.split(" ");int index=Integer.parseInt(v[1]);time=Long.parseLong(v[2]);
                int op=Integer.parseInt(v[0]),n=v.length-3;
                ja.Z=(short)(index+12);lg.G=(short)(index+40);ib.db=(short)(index+10);gi.m=(short)(index+11);
                ae.j=(short)index;ri.V=(short)(index+45);od.N=(short)(index+87);ae.b=(short)(index+120);
                rk.i=810;sb.g=445;bh.l=new aj();bh.l.C=index*45803-87533;bh.l.H=index*7331-14128;
                jsMode=(index>>1)%5;client.L=(index&1)==1;call="-";
                m s=new m();int size=n+3;s.D=new int[size];s.F=new int[size];s.B=new id[size];
                for(int i=0;i<n;i++)s.F[i]=Integer.parseInt(v[i+3]);
                s.D[n]=op;s.F[n+1]=1099435;s.D[n+2]=21;
                wf event=new wf();event.G=new Object[]{next};sf.g.a((long)next++,0,s);
                gh.a(event,-22368,500);
                StringJoiner stack=new StringJoiner(",");
                for(int i=0;i<10;i++){stack.add(""+tg.B[i]);if(tg.B[i]==1099435)break;}
                System.out.println(stack+";"+ja.Z+","+lg.G+","+ib.db+","+gi.m+","+ae.j+","+ri.V+","+od.N+","+ae.b+","+rk.i+","+sb.g+";"+call+";"+ok.s.getTimeInMillis());
            }
        }finally{tj.m.a(100);}
    }
}
