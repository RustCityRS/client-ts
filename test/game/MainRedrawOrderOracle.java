import java.awt.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class MainRedrawOrderOracle {
    static final Set<String> watched=Set.of("m.S","aj.kb","tb.h","oa.a","hi.g","th.d","ah.d");
    static StringJoiner trace;
    static final Map<String,Integer> occurrences=new HashMap<>();
    static int mode, fail;
    static long time;
    static dg a,b;
    static TestFrame desktop,full;
    static class Stop extends Error {}
    static class TestFrame extends Frame {
        int id;
        public Dimension getSize() { trace.add("size"+id); return new Dimension(300+id,100+id); }
        public Insets getInsets() { trace.add("insets"+id); return new Insets(1,2,3,4); }
    }

    // Run immediately after GETSTATIC, leaving its captured value on the JVM stack.
    public static void read(String name) {
        trace.add(name); int n=occurrences.merge(name,1,Integer::sum);
        if (fail>0 && --fail==0) throw new IllegalArgumentException("probe");
        if (name.equals("m.S") && n==1 && mode<=2) m.S=mode==1?null:b;
        if (name.equals("aj.kb")) {
            if (n==1 && mode>=3 && mode<=5) aj.kb=full;
            if (n==2 && mode==4) aj.kb=desktop;
            if (n==2 && mode==5) aj.kb=null;
        }
        if (name.equals("tb.h") && n==1 && (mode==6||mode==7)) tb.h=mode==6?full:null;
        if (name.equals("tb.h") && n==3 && mode==8) tb.h=null;
        if (name.equals("oa.a") && n==1 && mode==9) oa.a=120;
        if (name.equals("th.d") && n==1 && mode==12) ah.d=23;
        if (name.equals("ah.d") && n==1 && mode==13) {ah.d=-32;th.d=47;}
        if (name.equals("th.d") && n==2 && mode==14) th.d=0;
        if (name.equals("hi.g") && mode<11) throw new Stop();
    }
    public static boolean music(boolean dummy) { return mode<=2; }
    public static void discard(dg receiver,int dummy) { Objects.requireNonNull(receiver); trace.add(receiver==a?"A":"B"); }
    public static long clock(int dummy) { trace.add("clock"); return time; }
    public static int windowMode(int dummy) { return 0; }
    public static void setWindow(int h,boolean apply,int mode,boolean replace,int w) { trace.add("window"); }
    public static void message(id text,boolean immediate,byte dummy) {
        trace.add(new String(text.A,0,text.c,StandardCharsets.ISO_8859_1)); throw new Stop();
    }

    static void prepare(String jar,String dir) throws Exception {
        try(var archive=new JarFile(jar)) {
            var source=new ClassReader(archive.getInputStream(archive.getJarEntry("client.class")));
            var out=new ClassWriter(ClassWriter.COMPUTE_MAXS);
            source.accept(new ClassVisitor(Opcodes.ASM8,out) {
                public MethodVisitor visitMethod(int flags,String name,String desc,String sig,String[] exceptions) {
                    var method=super.visitMethod(flags,name,desc,sig,exceptions);
                    if (!name.equals("d")||!desc.equals("(I)V")) return method;
                    return new MethodVisitor(Opcodes.ASM8,method) {
                        public void visitFieldInsn(int op,String owner,String field,String signature) {
                            super.visitFieldInsn(op,owner,field,signature);
                            String key=owner+"."+field;
                            if(op==Opcodes.GETSTATIC && watched.contains(key)) {
                                super.visitLdcInsn(key);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"MainRedrawOrderOracle","read","(Ljava/lang/String;)V",false);
                            }
                        }
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean iface) {
                            String target=switch(owner+"."+name+desc) {
                                case "a.a(Z)Z" -> "music"; case "dg.b(I)V" -> "discard";
                                case "eh.a(I)J" -> "clock"; case "vg.a(Lid;ZB)V" -> "message";
                                case "ld.b(I)I" -> "windowMode"; case "ui.a(IZIZI)V" -> "setWindow";
                                default -> null;
                            };
                            if (target==null) super.visitMethodInsn(op,owner,name,desc,iface);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"MainRedrawOrderOracle",target,
                                op==Opcodes.INVOKESTATIC?desc:"(L"+owner+";"+desc.substring(1),false);
                        }
                    };
                }
            },0);
            Files.write(Path.of(dir,"client.class"),out.toByteArray());
        }
    }
    public static void main(String[] args) throws Exception {
        if (args.length==2) {prepare(args[0],args[1]);return;}
        client app=WindowModeOracle.container(client.class);
        desktop=WindowModeOracle.container(TestFrame.class);desktop.id=1;
        full=WindowModeOracle.container(TestFrame.class);full.id=2; a=new dg(); b=new dg();
        try (var input=new java.io.BufferedReader(new java.io.InputStreamReader(System.in))) {
            for(String line;(line=input.readLine())!=null;) {
                String[] fields=line.split(" ");
                mode=Integer.parseInt(fields[0]); fail=Integer.parseInt(fields[1]); time=Long.parseLong(fields[2]);
                tf.C=mode==9||mode==10?30:25; bc.e=1; hj.d=true; m.S=mode==2?null:a;
                aj.kb=null; tb.h=desktop; hi.g=false; fb.l="mac"; wd.b=false;
                oa.a=17; vk.rb=oh.j=0;
                th.d=Integer.parseInt(fields[3]); ah.d=Integer.parseInt(fields[4]); occurrences.clear(); trace=new StringJoiner(";");
                String status="ok";
                try {app.d(0);} catch(Stop stop) {status="stop";} catch(g wrapped) {
                    Throwable cause=wrapped.a;
                    status=wrapped.q+"/"+(cause instanceof NullPointerException?"null":cause instanceof ArithmeticException?"zero":cause.getMessage());
                }
                System.out.println(String.join("|",status,trace.toString(),""+oa.a,""+vk.rb,""+oh.j,""+th.d,""+ah.d));
            }
        }
    }
}
