import java.io.*;
import java.net.*;
import java.applet.*;
import java.lang.reflect.Field;
import java.lang.invoke.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

@SuppressWarnings({"removal","deprecation"})
public class BrowserPacketOracle {
    static String cookie="~",shown="~",prefix,host;
    static long time;
    static int cookieFault;
    static String cookieTrace;
    static final HexFormat hex=HexFormat.of();
    public static long clock(int dummy){return time;}
    public static void evaluate(id value,Applet applet,int dummy){
        if(cookieTrace!=null)cookieTrace+="set/";
        if(cookieFault==3)throw new IllegalStateException();
        cookie=new String(value.A,0,value.c,StandardCharsets.UTF_8);
    }
    static String js(id value){return value==null?"~":hex.formatHex(value.A,0,value.c);}
    static String str(String value){return hex.formatHex(value.getBytes(StandardCharsets.UTF_8));}
    static class Page extends Applet {
        public String getParameter(String name){
            if(cookieTrace!=null)cookieTrace+=name+"/";
            if(cookieFault==1 && name.equals("cookieprefix") || cookieFault==2 && name.equals("cookiehost"))throw new IllegalStateException();
            return name.equals("cookieprefix")?prefix:name.equals("cookiehost")?host:null;
        }
        public URL getCodeBase(){try{return new URL("https://rs.example/game/");}catch(Exception e){throw new AssertionError(e);}}
        public AppletContext getAppletContext(){return (AppletContext)java.lang.reflect.Proxy.newProxyInstance(getClass().getClassLoader(),new Class[]{AppletContext.class},
            (proxy,method,args)->{if(method.getName().equals("showDocument"))shown=args[0]+" "+args[1];return null;});}
    }
    static Object allocate(Class<?> type)throws Exception{
        Class<?> unsafe=Class.forName("sun.misc.Unsafe");Field f=unsafe.getDeclaredField("theUnsafe");f.setAccessible(true);
        return unsafe.getMethod("allocateInstance",Class.class).invoke(f.get(null),type);
    }
    // Preserve the gamepack cookie builder. Replace the wall clock and the final LiveConnect call at the two host boundaries.
    static MethodHandle cookieBuilder()throws Throwable{
        ClassWriter out=new ClassWriter(ClassWriter.COMPUTE_MAXS);
        out.visit(Opcodes.V1_5,Opcodes.ACC_PUBLIC,"PacketCookieBuilder",null,"java/lang/Object",null);
        try(InputStream stream=gi.class.getResourceAsStream("/gi.class")){
            new ClassReader(stream).accept(new ClassVisitor(Opcodes.ASM8){
                public MethodVisitor visitMethod(int access,String name,String desc,String signature,String[] exceptions){
                    if(!name.equals("a")||!desc.equals("(ZLid;)V"))return null;
                    MethodVisitor m=out.visitMethod(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC,"write",desc,null,null);
                    return new MethodVisitor(Opcodes.ASM8,m){
                        public void visitMethodInsn(int op,String owner,String n,String d,boolean itf){
                            if(owner.equals("eh")&&n.equals("a")&&d.equals("(I)J"))super.visitMethodInsn(Opcodes.INVOKESTATIC,"BrowserPacketOracle","clock",d,false);
                            else if(owner.equals("id")&&n.equals("b")&&d.equals("(Ljava/applet/Applet;I)V"))super.visitMethodInsn(Opcodes.INVOKESTATIC,"BrowserPacketOracle","evaluate","(Lid;Ljava/applet/Applet;I)V",false);
                            else super.visitMethodInsn(op,owner,n,d,itf);
                        }
                    };
                }
            },ClassReader.SKIP_FRAMES|ClassReader.SKIP_DEBUG);
        }
        out.visitEnd();
        return MethodHandles.lookup().findStatic(MethodHandles.lookup().defineClass(out.toByteArray()),"write",MethodType.methodType(void.class,boolean.class,id.class));
    }
    static void read(int opcode,byte[] bytes)throws Exception{
        Socket socket=new Socket(){public void setSoTimeout(int n){} public void setTcpNoDelay(boolean enabled){}
            public InputStream getInputStream(){return new ByteArrayInputStream(bytes);} public OutputStream getOutputStream(){return new ByteArrayOutputStream();}};
        ek.s=new se(socket,null);o.Y=opcode;af.I=bytes.length;
        if(!rg.a((byte)57))throw new AssertionError("packet not consumed");
    }
    static String arrows(){
        StringJoiner out=new StringJoiner("/");
        for(kf h:ve.t)out.add(h==null?"~":h.a+","+h.e+","+h.h+","+h.i+","+h.j+","+h.k+","+h.m+","+h.o+","+h.r);
        return out.toString();
    }
    public static void main(String[] argv)throws Throwable{
        Page page=(Page)allocate(Page.class);jg.k=(p)allocate(client.class);tj.m=new fb(page,0,null,0);
        MethodHandle builder=cookieBuilder();be encoded=new be(5000);int[] seed={538,777,39,30};hd.b.a(seed,-1);encoded.a(seed,-1);
        try(BufferedReader in=new BufferedReader(new InputStreamReader(System.in))){
            for(String line;(line=in.readLine())!=null;){
                String[] row=line.split(" ",-1);
                if(row[0].equals("hint")){
                    wa.a=new vc[Integer.parseInt(row[1])];byte[] payload=hex.parseHex(row[2]);read(217,payload);
                    System.out.println(hd.b.yb+" "+arrows());
                }else if(row[0].equals("date"))System.out.println(js(gk.a(0,Long.parseLong(row[1]))));
                else if(row[0].equals("cookie")){
                    byte[] payload=hex.parseHex(row[2]);prefix=row[3].equals("~")?null:row[3];host=row[4].equals("~")?null:row[4];time=Long.parseLong(row[1]);
                    read(142,payload);int pos=hd.b.yb;cookie="~";builder.invokeExact(false,oj.k);
                    System.out.println(pos+" "+js(oj.k)+" "+str(cookie));
                }else if(row[0].equals("cookie-fault")){
                    cookieFault=Integer.parseInt(row[1]);cookieTrace="";cookie="~";
                    id setting=row[2].equals("null")?null:aj.a("session", (byte)-72);
                    builder.invokeExact(false,setting);
                    System.out.println((oj.k==setting)+" "+cookieTrace+" "+!cookie.equals("~"));
                    cookieTrace=null;cookieFault=0;
                }else{
                    fb.f=Integer.parseInt(row[1]);fb.l=row[2];vk.kb=row[3].equals("1");byte[] plain=hex.parseHex(row[4]);
                    shown="~";b.L=null;client.sb=null;pa.tb=false;
                    encoded.yb=0;for(byte c:plain)encoded.k(2,c&255);read(42,Arrays.copyOf(encoded.fb,encoded.yb));
                    if(b.L!=null)for(int i=0;b.L.b==0&&i<1000;i++)Thread.sleep(1);
                    System.out.println(hd.b.yb+" "+str(shown)+" "+js(client.sb)+" "+pa.tb+" "+(b.L==null?"~":b.L.e+","+b.L.b+","+str((String)b.L.d)));
                }
            }
        }finally{tj.m.a(100);}
    }
}
