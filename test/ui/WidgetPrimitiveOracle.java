import java.io.*;
import java.nio.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

class WidgetPrimitiveOracle {
    static String command;
    static java.lang.reflect.Field clipHeight;
    static void prepare(Path jar,Path dir)throws Exception{
        try(var f=new JarFile(jar.toFile())){
            var in=new ClassReader(f.getInputStream(f.getJarEntry("lf.class")));
            var out=new ClassWriter(in,0);
            in.accept(new ClassVisitor(Opcodes.ASM8,out){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    var base=super.visitMethod(access,name,desc,sig,ex);
                    if(!name.equals("a")||!desc.equals("(I[Laj;IIIIIIZI)V"))return base;
                    return new MethodVisitor(Opcodes.ASM8,base){
                        public void visitMethodInsn(int opcode,String owner,String name,String desc,boolean iface){
                            String replacement=switch(name+desc){
                                case "d(IIIII)V"->"fill";case "c(IIIII)V"->"outline";case "c(IIIIII)V"->"outlineAlpha";
                                case "b(IIIIII)V"->"fillAlpha";case "f(IIIII)V"->"line";case "a(IIIIII)V"->"thick";
                                default->null;};
                            if(owner.equals("td")&&replacement!=null)super.visitMethodInsn(opcode,"WidgetPrimitiveOracle",replacement,desc,false);
                            else super.visitMethodInsn(opcode,owner,name,desc,iface);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("lf.class"),out.toByteArray());
        }
    }
    static void log(String op,int... args){command=op+Arrays.toString(args);}
    public static void fill(int x,int y,int w,int h,int rgb){log("fill",x,y,w,h,rgb);td.d(x,y,w,h,rgb);}
    public static void outline(int x,int y,int w,int h,int rgb){log("outline",x,y,w,h,rgb);td.c(x,y,w,h,rgb);}
    public static void outlineAlpha(int x,int y,int w,int h,int rgb,int alpha){log("outlineAlpha",x,y,w,h,rgb,alpha);td.c(x,y,w,h,rgb,alpha);}
    public static void fillAlpha(int x,int y,int w,int h,int rgb,int alpha){log("fillAlpha",x,y,w,h,rgb,alpha);td.b(x,y,w,h,rgb,alpha);}
    public static void line(int x,int y,int x1,int y1,int rgb){log("line",x,y,x1,y1,rgb);td.f(x,y,x1,y1,rgb);}
    public static void thick(int x,int y,int x1,int y1,int rgb,int size){log("thick",x,y,x1,y1,rgb,size);td.a(x,y,x1,y1,rgb,size);}
    static String fault(Throwable ex){
        if(ex instanceof g wrap)return wrap.q+"/"+fault(wrap.a);
        if(ex instanceof NullPointerException)return "null";
        if(ex instanceof IndexOutOfBoundsException)return "bounds";
        throw new AssertionError(ex);
    }
    static void run(int[] v)throws Exception{
        int format=v[1],state=v[4],flags=v[5],mode=v[10];
        aj c=new aj();c.n=-1;c.ob=v[0];c.y=(format&1)!=0;c.Wc=(format&2)!=0;
        c.Jc=(flags&1)!=0;c.Oc=(flags&2)!=0;c.Sc=new l((flags&4)!=0?1:0,-1);
        c.S=v[2];c.Uc=v[3];c.oc=0xc04523;c.I=0x235bc0;
        c.B=(flags&8)!=0?0:0x40bf45;c.kd=(flags&8)!=0?0:0xea3d61;
        if((state&1)!=0)c.bd=new int[0];
        if(mode==7){c.bd=new int[]{0};c.eb=null;}
        di.g=(state&2)!=0?c:null;uc.c=(flags&16)!=0;
        c.ib=v[6];c.Mb=v[7];c.C=v[8];c.H=v[9];
        ik.G=1;hh.kb=3482;
        boolean draw=(flags&32)!=0;n.i=mode==4?new boolean[0]:new boolean[]{false,draw,false};ml.T=v[11];
        int[] pixels=new int[mode==1?98:31*19+1];for(int i=0;i<pixels.length;i++)pixels[i]=0x873625+i*99;
        td.a(mode==2?null:pixels,31,19);
        dc.e=(flags&64)!=0?73:0;dc.j=false;
        int left=2,top=3,right=28,bottom=17;String error="-";command="-";
        try{lf.a(0,new aj[]{c},-1,bottom,top,-1,right,0,true,left);}
        catch(Throwable ex){error=fault(ex);}
        var bytes=ByteBuffer.allocate(pixels.length*4);for(int pixel:pixels)bytes.putInt(pixel);
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.array()));
        System.out.println(String.join("|",error,command,hash,c.vb+","+c.R+","+ik.G,
            td.e+","+td.b+","+td.h+","+td.d+","+dc.p+","+clipHeight.getInt(null)+","+dc.j));
    }
    public static void main(String[] args)throws Exception{
        if(args.length!=0){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        Class.forName("client");clipHeight=dc.class.getDeclaredField("q");clipHeight.setAccessible(true);
        var in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;)run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
