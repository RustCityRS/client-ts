import java.applet.Applet;
import java.io.*;
import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.HexFormat;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;
import netscape.javascript.JSObject;

@SuppressWarnings({"removal","deprecation"})
public class BrowserControlOracle {
    static final HexFormat hex=HexFormat.of();
    static final Object token=new Object();
    static final IllegalStateException failure=new IllegalStateException();
    static final Error fatal=new AssertionError();
    static final class Page extends Applet {}
    static final class Window extends JSObject {
        public Object call(String name,Object... args) { trace="c"+text(name)+(args==null?"-":"+"+args.length);return result(); }
        public Object eval(String source) { trace="e"+text(source);return result(); }
        public Object getMember(String name){throw new AssertionError();}
        public void setMember(String name,Object v){throw new AssertionError();}
        public void removeMember(String name){throw new AssertionError();}
        public Object getSlot(int i){throw new AssertionError();}
        public void setSlot(int i,Object v){throw new AssertionError();}
    }
    static String trace;
    static int mode;
    static Page page;
    static final Window window=new Window();
    static Object result(){
        switch(mode){case 0:return null;case 1:return Boolean.TRUE;case 2:return token;
            case 3:return "é\u0000\uD800\uD83D\uDE42";case 4:throw failure;case 5:throw fatal;
            default:throw new AssertionError();}
    }
    static String text(String name){return name==null?"~":hex.formatHex(name.getBytes(StandardCharsets.UTF_8));}
    // Only the removed browser-plugin resolver is substituted. Both w methods,
    // their guards, JSObject invocation instructions, and id conversions execute in the JAR.
    public static JSObject getWindow(Applet source){
        if(source==null)throw new NullPointerException();
        if(source!=page)throw new AssertionError("unexpected applet");
        return window;
    }
    static void instrument(String jar,Path dir)throws Exception{
        try(JarFile j=new JarFile(jar)){
            ClassReader reader=new ClassReader(j.getInputStream(j.getJarEntry("w.class")));
            ClassWriter writer=new ClassWriter(0);int[] calls={0};
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String n,String desc,String sig,String[] exceptions){
                    return new MethodVisitor(Opcodes.ASM8,super.visitMethod(access,n,desc,sig,exceptions)){
                        public void visitMethodInsn(int op,String owner,String method,String descriptor,boolean itf){
                            if(owner.equals("netscape/javascript/JSObject")&&method.equals("getWindow")){
                                owner="BrowserControlOracle";calls[0]++;
                            }
                            super.visitMethodInsn(op,owner,method,descriptor,itf);
                        }
                    };
                }
            },0);
            if(calls[0]!=2)throw new AssertionError("expected both getWindow sites");
            Files.write(dir.resolve("w.class"),writer.toByteArray());
        }
    }
    static String describe(Object answer){
        if(answer==null)return "~";
        if(answer==token)return "obj";
        if(answer instanceof id s)return "j"+hex.formatHex(s.A,0,s.c);
        if(answer instanceof String s)return "s"+text(s);
        return answer.toString();
    }
    public static void main(String[] args)throws Throwable {
        if(args.length>0){instrument(args[0],Path.of(args[1]));return;}
        Class<?> unsafe=Class.forName("sun.misc.Unsafe");Field f=unsafe.getDeclaredField("theUnsafe");f.setAccessible(true);
        page=(Page)unsafe.getMethod("allocateInstance",Class.class).invoke(f.get(null),Page.class);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;){
            String[] v=line.split(" ");int guard=Integer.parseInt(v[1]);Applet app=v[2].equals("1")?page:null;
            mode=Integer.parseInt(v[3]);id source=new id();source.A=v[4].equals("~")?null:hex.parseHex(v[4]);source.c=Integer.parseInt(v[5]);
            String value=source.A==null?null:new String(source.A,StandardCharsets.UTF_8),out="void";trace="-";
            try{
                switch(v[0]){
                    case "c":out=describe(w.a(guard,app,value));break;
                    case "e":w.a(guard,value,app);break;
                    case "C":out=describe(source.a(app,(byte)guard));break;
                    case "E":source.b(app,guard);break;
                }
            } catch(Throwable e){
                String ctx="";
                if(e instanceof g wrapped){ctx=" "+wrapped.q;e=wrapped.a;}
                if(e==failure)out="host";
                else if(e==fatal)out="fatal";
                else if(e instanceof NullPointerException)out="null";
                else if(e instanceof ArithmeticException)out="divide";
                else if(e instanceof IndexOutOfBoundsException)out="bounds";
                else throw e;
                out+=ctx;
            }
            System.out.println(trace+" "+out+" "+(source.A==null?"~":hex.formatHex(source.A)));
        }
    }
}
