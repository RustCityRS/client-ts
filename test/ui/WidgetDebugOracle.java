import java.io.*;
import java.lang.reflect.Field;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// Observe lf's font and provider calls and supply repeatable values at its JVM heap edge.
// The labels, colour thresholds, calculations, pixel draws and calls into mc remain original.
public class WidgetDebugOracle {
    static final int W=195,H=76;
    static al widgets;
    static db index;
    static mb font12,font11;
    static mc replacement;
    static final IdentityHashMap<mc,Integer> keys=new IdentityHashMap<>();
    static StringJoiner trace;
    static int mode,used;
    static void instrument(Path jar,Path out) throws Exception {
        try(JarFile files=new JarFile(jar.toFile())){
            ClassReader r=new ClassReader(files.getInputStream(files.getJarEntry("lf.class")));
            ClassWriter w=new ClassWriter(0);
            r.accept(new ClassVisitor(Opcodes.ASM8,w){
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] f){
                    var original=super.visitMethod(a,n,d,s,f);
                    if(!n.equals("a") || !d.equals("(I[Laj;IIIIIIZI)V"))return original;
                    return new MethodVisitor(Opcodes.ASM8,original){
                        public void visitMethodInsn(int opcode,String owner,String method,String desc,boolean itf){
                            String name=switch(owner+"."+method+desc){
                                case "java/lang/Runtime.totalMemory()J" -> "total";
                                case "java/lang/Runtime.freeMemory()J" -> "free";
                                case "mc.b(B)I" -> "groups";
                                case "mc.a(Z)I" -> "verified";
                                case "mc.e(I)I" -> "position";
                                case "mb.c(Lid;IIII)V" -> "right";
                                default -> null;
                            };
                            if(name==null)super.visitMethodInsn(opcode,owner,method,desc,itf);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetDebugOracle",name,"(L"+owner+";"+desc.substring(1),false);
                        }
                    };
                }
            },0);
            Files.write(out.resolve("lf.class"),w.toByteArray());
        }
    }
    static long total(Runtime runtime){trace.add("heap");return used*1024L+771;}
    static long free(Runtime runtime){return 113;}
    static int groups(mc p,byte guard){
        int key=keys.get(Objects.requireNonNull(p));trace.add("g"+key);
        if(mode==4 && key==2)lj.h[2]=replacement;
        return p.b(guard);
    }
    static int verified(mc p,boolean guard){
        int key=keys.get(Objects.requireNonNull(p));trace.add("v"+key);
        if(mode==5 && key==3)lj.h[3]=replacement;
        return p.a(guard);
    }
    static int position(mc p,int guard){
        int key=keys.get(Objects.requireNonNull(p));trace.add("p"+key);
        return p.e(guard);
    }
    static void right(mb font,id text,int x,int y,int rgb,int shadow){
        Objects.requireNonNull(font);
        trace.add((font==font12?"12":"11")+":"+new String(text.A,0,text.c,StandardCharsets.ISO_8859_1)+":"+x+":"+y+":"+rgb+":"+shadow);
        font.c(text,x,y,rgb,shadow);
    }
    static Field field(String n)throws Exception{Field f=mc.class.getDeclaredField(n);f.setAccessible(true);return f;}
    static mc provider(int key)throws Exception{
        mc p=new mc(key,null,null,null,null,0,0,false);
        field("G").set(p,mode==3?null:index);
        field("x").setInt(p,key==28||mode==12?Integer.MAX_VALUE:key*7);
        if(mode==8&&key==11)field("Z").setBoolean(p,true);
        keys.put(p,key);return p;
    }
    static String row(int[] args,OutputStream out)throws Exception{
        int group=args[0],file=args[1];jg.C=args[2]!=0;used=args[3];mode=args[4];
        aj c=new aj();c.Kc=group<<16|file;c.b(20327,new gd(widgets.a(-809612665,file,group)));
        if(c.wc!=1405)throw new AssertionError();
        c.n=-1;c.ib=6;c.Mb=5;c.C=c.G;c.H=c.M;
        trace=new StringJoiner(",");keys.clear();
        lj.h=new mc[mode==1?8:28];for(int i=0;i<lj.h.length;i++)lj.h[i]=provider(i);
        replacement=provider(28);
        if(mode==2)lj.h[3]=null;
        wj.g=mode==6?null:font12;ma.b=mode==7?null:font11;
        if(mode==9)lj.h=null;
        dd.a=mode==12?Integer.MIN_VALUE:51;
        ik.G=3;hh.kb=672;sf.m=new boolean[mode==10?3:100];ce.T=new boolean[mode==11?3:100];
        ie.F=true;ml.T=0;n.i=new boolean[100];
        int[] pixels=new int[W*H];for(int i=0;i<pixels.length;i++)pixels[i]=(0x192837+i*111)&0xffffff;
        td.a(pixels,W,H);
        int left=mode==13?109:1,top=mode==13?18:mode==14?40:1,bottom=mode==15?22:H-4;
        String status="ok";
        try{lf.a(0,new aj[]{c},-1,bottom,top,-1,W-9,0,true,left);}
        catch(RuntimeException ex){
            Throwable e=ex;while(e instanceof g wrapped)e=wrapped.a;
            if(e instanceof ArithmeticException)status="divide";
            else if(e instanceof IndexOutOfBoundsException)status="bounds";
            else if(e instanceof NullPointerException)status="null";
            else throw ex;
        }
        ByteBuffer frame=ByteBuffer.allocate(pixels.length*4).order(ByteOrder.LITTLE_ENDIAN);
        frame.asIntBuffer().put(pixels);out.write(frame.array());
        return status+"|"+(sf.m.length>3&&sf.m[3])+"|"+(ce.T.length>3&&ce.T[3])+"|"+c.vb+"|"+c.R+"|"+trace;
    }
    public static void main(String[] args)throws Exception{
        if(args[0].equals("instrument")){instrument(Path.of(args[1]),Path.of(args[2]));return;}
        Path dir=Path.of(args[0]);
        try(var ifs=new ProceduralTextureCacheOracle.Disk(dir,3);var graphics=new ProceduralTextureCacheOracle.Disk(dir,8);
            var fonts=new ProceduralTextureCacheOracle.Disk(dir,13); var images=new BufferedOutputStream(Files.newOutputStream(Path.of(args[1])))){
            widgets=new al(ifs,true,true);index=ifs.table;
            al sprites=new al(graphics,true,true),metrics=new al(fonts,true,true);
            font12=sb.a(sprites,sprites.a((byte)95,vb.a("p12_full",(byte)99)),0,0,metrics);
            font11=sb.a(sprites,sprites.a((byte)95,vb.a("p11_full",(byte)99)),0,0,metrics);
            if(font11==null||font12==null)throw new AssertionError();
            var in=new BufferedReader(new InputStreamReader(System.in));
            for(String line;(line=in.readLine())!=null;)System.out.println(row(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray(),images));
        }
    }
}
