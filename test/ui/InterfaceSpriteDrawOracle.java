import java.io.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

// The first run uses the original lf. In the second run each sprite invocation
// in lf records its receiver, arguments and active clip before calling the same
// virtual method. All sprite retrieval, blitting, recursion and clipping are original.
class InterfaceSpriteDrawOracle {
    static final int W=29,H=23;
    static byte[] group;
    static db index,modelIndex;
    static int source, mode, draws;
    static StringJoiner trace;

    static void instrument(Path jar, Path out) throws Exception {
        try (JarFile file=new JarFile(jar.toFile())) {
            ClassReader reader=new ClassReader(file.getInputStream(file.getJarEntry("lf.class")));
            ClassWriter writer=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int acc,String name,String desc,String sig,String[] ex) {
                    MethodVisitor original=super.visitMethod(acc,name,desc,sig,ex);
                    if(!name.equals("a")||!desc.equals("(I[Laj;IIIIIIZI)V")) return original;
                    return new MethodVisitor(Opcodes.ASM8,original) {
                        public void visitMethodInsn(int op,String owner,String method,String type,boolean itf) {
                            String target=switch(method+type) {
                                case "c(II)V" -> "draw"; case "a(III)V" -> "alpha";
                                case "a(IIII)V" -> "scale"; case "a(IIIII)V" -> "scaleAlpha";
                                case "a(IIZII)V" -> "rotate"; default -> null;
                            };
                            if(op==Opcodes.INVOKEVIRTUAL && owner.equals("vc") && target!=null)
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterfaceSpriteDrawOracle",target,"(Lvc;"+type.substring(1),false);
                            else super.visitMethodInsn(op,owner,method,type,itf);
                        }
                    };
                }
            },0);
            Files.write(out.resolve("lf.class"),writer.toByteArray());
        }
    }
    static String clip(){return td.e+","+td.b+","+td.h+","+td.d;}
    static void call(vc sprite,String op,int... args){
        StringJoiner entry=new StringJoiner(",");
        entry.add(op).add(sprite instanceof vh?"alpha":"rgb");
        for(int value:args)entry.add(""+value);
        trace.add(entry+"@"+clip());
        if(++draws==3 && mode==4)throw new IllegalStateException("third draw");
    }
    static void draw(vc v,int x,int y){call(v,"draw",x,y);v.c(x,y);}
    static void alpha(vc v,int x,int y,int a){call(v,"alpha",x,y,a);v.a(x,y,a);}
    static void scale(vc v,int x,int y,int w,int h){call(v,"scale",x,y,w,h);v.a(x,y,w,h);}
    static void scaleAlpha(vc v,int x,int y,int w,int h,int a){call(v,"scaleAlpha",x,y,w,h,a);v.a(x,y,w,h,a);}
    static void rotate(vc v,int angle,int y,boolean guard,int x,int s){call(v,"rotate",angle,y,x,s);v.a(angle,y,guard,x,s);}

    static class Provider extends ud {
        db b(int guard){trace.add("index");return source>=8?modelIndex:index;}
        byte[] a(int guard,int id){trace.add("group,"+id);return source==5||source>=8?null:group;}
        int c(int id,int guard){throw new AssertionError();}
        void b(int guard,int id){throw new AssertionError();}
    }
    static rh sprite(boolean alpha,int seed){
        int[] pixels=new int[mode==3?4:12];
        for(int i=0;i<pixels.length;i++){
            int rgb=(seed+i*0x38204b)&0xffffff;
            pixels[i]=i%5==1?0:rgb|(alpha?((i*61+47)&255)<<24:0);
        }
        int cw=mode==1?0:6,ch=mode==2?0:5;
        return alpha?new vh(cw,ch,1,1,4,3,pixels):new rh(cw,ch,1,1,4,3,pixels);
    }
    static void run(int[] a)throws Exception {
        source=a[0];mode=a[7];draws=0;trace=new StringJoiner(";");
        boolean alpha=a[1]!=0;
        aj c=new aj();c.n=-1;c.ob=5;c.y=source>=2;c.bd=source==1?new int[0]:null;
        c.ib=mode==6?W+8:3;c.Mb=4;c.C=a[5];c.H=a[6];c.q=a[2]!=0;c.A=a[3];c.S=a[4];c.Xb=alpha;
        c.mb=source==6?-1:300;c.lc=169;c.yc=source==3||source>=7?411:-1;
        c.tc=2;c.Dc=0x80710e;c.e=a[4]%2==0;c.xc=a[3]==0?1234:-31;
        bj.b=new ve(16);gb.r=new ve(16);h.f=new al(new Provider(),true,true);
        long flags=((long)c.Dc<<40)+((long)c.tc<<36)+((alpha?1L:0L)<<35);
        if(source<=3){
            bj.b.a(flags+300,sprite(alpha,0x674123),(byte)-71);
            bj.b.a(flags+169,sprite(alpha,0x1278bc),(byte)-71);
        }
        if(source>=8){
            fa.b=new ve(16);fa.b.a(411,new kl(),(byte)-71);
            nf.c=new al(new Provider(),true,true);
        }else if(c.yc!=-1){
            int packed=c.yc+(c.e?65536:0)+(c.tc<<17)+(c.Dc<<19);
            gb.r.a((long)packed*3849834839L+3147483667L*c.xc,source==7?new Object():sprite(alpha,0xbc924a),(byte)-71);
        }
        int[] screen=new int[W*H];
        for(int i=0;i<screen.length;i++)screen[i]=(0x214756+i*0xb9)&0xffffff;
        td.a(screen,W,H);hh.kb=vk.db=37;ik.G=0;
        sf.m[0]=false;n.i[0]=mode!=5;rk.o=source!=9;
        aj[] widgets={c};
        if(mode==7){
            aj parent=new aj();parent.n=-1;parent.Kc=489;parent.ob=0;parent.y=true;
            parent.ib=3;parent.Mb=2;parent.C=14;parent.H=13;c.n=489;c.ib=-2;c.Mb=3;
            widgets=new aj[]{parent,c};
        }
        String error="ok";
        try{lf.a(0,widgets,-1,21,3,-1,26,0,true,4);}
        catch(RuntimeException e){
            Throwable t=e;while(t instanceof g wrapped)t=wrapped.a;
            if(t instanceof ArithmeticException)error="divide";
            else if(t instanceof IndexOutOfBoundsException)error="bounds";
            else if(t instanceof IllegalStateException)error="third";
            else if(t instanceof ClassCastException)error="cast";
            else throw e;
        }
        ByteBuffer bytes=ByteBuffer.allocate(screen.length*4).order(ByteOrder.LITTLE_ENDIAN);
        bytes.asIntBuffer().put(screen);
        String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.array()));
        System.out.println(String.join("|",error,trace.toString(),clip(),""+rk.o,""+sf.m[0],""+c.vb,""+c.R,hash));
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){instrument(Path.of(args[0]),Path.of(args[1]));return;}
        Path dir=Path.of(args[0]);byte[] table=Files.readAllBytes(dir.resolve("index"));
        index=new db(table,q.a(0,table,table.length));group=Files.readAllBytes(dir.resolve("sprite"));
        table=Files.readAllBytes(dir.resolve("models"));modelIndex=new db(table,q.a(0,table,table.length));
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String row;(row=in.readLine())!=null;)run(Arrays.stream(row.split(" ")).mapToInt(Integer::parseInt).toArray());
    }
}
