import java.awt.Canvas;
import java.awt.Component;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import javax.sound.sampled.*;
import jdk.internal.org.objectweb.asm.*;

public class AudioLoadingOracle {
    static String mode;
    static boolean stereo;
    static fb first, second;
    static Canvas canvas, replacement;
    static al title, samples, patches, effects;
    static int lines;
    static final List<String> trace=new ArrayList<>();

    static Field field(Class<?> type,String name) throws Exception {
        Field f=type.getDeclaredField(name); f.setAccessible(true); return f;
    }
    static Object blank(Class<?> type) throws Exception {
        Class<?> unsafe=Class.forName("sun.misc.Unsafe"); Object u=field(unsafe,"theUnsafe").get(null);
        return unsafe.getMethod("allocateInstance",Class.class).invoke(u,type);
    }
    static String archive(al value){return value==null?"-":value==samples?"s":value==patches?"p":value==effects?"e":"?";}
    static String player(dg p, Object input) throws Exception {
        if(p==null)return "-";
        Object stream=field(dg.class,"r").get(p);
        return p.getClass().getName()+"/"+p.M+"/"+p.E+"/"+(p.g==null?-1:p.g.length)+"/"+(stream!=null&&stream==input?1:0);
    }
    static void note(String phase) {
        try {
            int program=qj.F==null?-1:((int[])field(ng.class,"Q").get(qj.F))[9];
            String task=ei.x==null?"-":(ei.x.a==first?"a":ei.x.a==second?"b":"?")+(ei.x.l[0]==null?"-":"0")+(ei.x.l[1]==null?"-":"1");
            trace.add(phase+":"+bh.b+","+ga.D+","+hi.j+","+(ie.A==le.j?1:0)+","+mj.e+","+(db.v?1:0)+","+bj.l+","+program+","+
                player(m.S,qj.F)+","+(ve.f==null?0:ve.f==qj.F?1:2)+","+archive(g.o)+archive(rk.a)+archive(ab.U)+","+
                player(ld.k,o.P)+","+(o.P==null?0:1)+","+(ba.f==null?0:1)+","+task);
        } catch(Exception e){throw new AssertionError(e);}
    }
    public static javax.sound.sampled.Mixer.Info[] getMixerInfo(){return new javax.sound.sampled.Mixer.Info[0];}
    public static Line getLine(Line.Info info) throws LineUnavailableException {
        DataLine.Info data=(DataLine.Info)info; AudioFormat f=data.getFormats()[0]; int i=lines++;
        note("line"+i+"/"+data.getMaxBufferSize()+"/"+f.getChannels());
        if(i==0 && mode.equals("swap")){tj.m=second;pe.S=replacement;}
        if(mode.startsWith("native")||mode.equals("absent")||mode.equals("swap")||mode.equals("retry")&&i==1)
            throw new LineUnavailableException();
        return (Line)Proxy.newProxyInstance(AudioLoadingOracle.class.getClassLoader(),new Class[]{SourceDataLine.class},(p,m,args)->{
            if(m.getName().equals("start")){note("start"+i);if(i==0&&mode.equals("rate"))mj.e=0;}
            if(m.getName().equals("close")&&mode.equals("pref")){note("close"+i);if(i==1)q.b=stereo;}
            return null;
        });
    }
    static class Output implements k {
        final String id;
        Output(String id){this.id=id;}
        public void a(boolean stereo,int dummy,Component component,int rate){note("nativeInit"+id+"/"+(component==canvas?"c":component==replacement?"r":"-")+"/"+rate);}
        public void a(byte dummy,int channel,int cap){note("nativeOpen"+id+"/"+channel+"/"+cap);if(mode.equals("nativeerror")&&channel==1)throw new IllegalStateException();}
        public void a(int channel,int[] buffer){}
        public int a(int channel,int dummy){return 0;}
        public void b(int channel,int dummy){}
        public void c(int channel,int dummy){}
    }
    static class Provider extends ud {
        db b(int dummy){note("index");if(mode.equals("indexerror"))throw new IllegalStateException();return null;}
        byte[] a(int a,int b){throw new AssertionError();}
        void b(int a,int b){throw new AssertionError();}
        int c(int a,int b){return 0;}
    }
    static void run(String test,boolean s)throws Exception{
        mode=test;stereo=s;trace.clear();lines=0;
        first=(fb)blank(fb.class);second=(fb)blank(fb.class);
        if(!mode.equals("absent")) field(fb.class,"d").set(first,new Output("a"));
        field(fb.class,"d").set(second,new Output("b"));
        tj.m=first;canvas=new Canvas();replacement=new Canvas();pe.S=canvas;
        ei.x=null; m.S=null;ld.k=null;o.P=null;qj.F=null;ba.f=null;ve.f=null;g.o=null;rk.a=null;ab.U=null;
        samples=new al(new Provider(),false,false);patches=new al(new Provider(),false,false);effects=new al(new Provider(),false,false);
        f.f=mode.equals("archives")?null:samples;gj.Z=mode.equals("archives")?null:patches;rg.m=mode.equals("archives")?null:effects;
        al.l=mode.equals("title")?null:new al(new Provider(),false,false);
        bh.b=45;ga.D=19;hi.j=721;ie.A=null;we.y=true;q.b=stereo;
        if(mode.equals("busy")){ei.x=new ld();ei.x.a=first;ei.x.l[0]=new dg();}
        Method load=client.class.getDeclaredMethod("f",byte.class);load.setAccessible(true);
        boolean failed=false;
        try{load.invoke(blank(client.class),(byte)-63);}catch(InvocationTargetException e){failed=true;}
        note(failed?"failed":"done");
        if(mode.equals("pref")){q.b=!stereo;rc.a(1);note("changed");}
        for(String row:trace)System.out.println(test+"/"+s+" "+row);
    }
    static void prepare(String jar,Path out)throws Exception{
        try(JarFile source=new JarFile(jar)){
            ClassReader c=new ClassReader(source.getInputStream(source.getJarEntry("ua.class")));
            ClassWriter w=new ClassWriter(0);
            c.accept(new ClassVisitor(Opcodes.ASM8,w){
                public MethodVisitor visitMethod(int a,String n,String d,String sig,String[] ex){
                    return new MethodVisitor(Opcodes.ASM8,super.visitMethod(a,n,d,sig,ex)){
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean iface) {
                            if(owner.equals("javax/sound/sampled/AudioSystem")&&(name.equals("getMixerInfo")||name.equals("getLine")))owner="AudioLoadingOracle";
                            super.visitMethodInsn(op,owner,name,desc,iface);
                        }
                    };
                }
            },0);
            Files.write(out.resolve("ua.class"),w.toByteArray());
        }
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){prepare(args[0],Path.of(args[1]));return;}
        for(String mode:"ok retry native nativeerror absent swap busy rate archives title indexerror pref".split(" "))
            for(boolean stereo:new boolean[]{false,true})run(mode,stereo);
    }
}
