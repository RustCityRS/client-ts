import java.io.*;
import java.nio.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// The class transformation observes the ten td call sites in ta.a only. Each observer runs the
// original td body, so clipping, partial pixel writes and their exceptions still come from the JAR.
public final class ScrollbarDrawOracle {
    static final int W=48,H=94;
    static final int[] defaults={ae.e,mh.c,pa.yb,ui.D};
    static int mode, step, failAt;
    static StringJoiner trace;
    static int[] primary, alternate;

    static void prepare(Path gamepack,Path dir) throws Exception {
        try (JarFile jar=new JarFile(gamepack.toFile())) {
            ClassReader read=new ClassReader(jar.getInputStream(jar.getJarEntry("ta.class")));
            ClassWriter out=new ClassWriter(0);
            int[] sites={0,0,0};
            read.accept(new ClassVisitor(Opcodes.ASM8,out) {
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex) {
                    MethodVisitor to=super.visitMethod(access,name,desc,sig,ex);
                    if(!name.equals("a")||!desc.equals("(IIIIIB)V"))return to;
                    return new MethodVisitor(Opcodes.ASM8,to) {
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                            if(op==Opcodes.INVOKESTATIC&&owner.equals("td")) {
                                String wrapper;
                                if(name.equals("d")&&desc.equals("(IIIII)V")) { wrapper="rect"; sites[0]++; }
                                else if(name.equals("d")&&desc.equals("(IIII)V")) { wrapper="horizontal"; sites[1]++; }
                                else if(name.equals("e")&&desc.equals("(IIII)V")) { wrapper="vertical"; sites[2]++; }
                                else throw new AssertionError(name+desc);
                                super.visitMethodInsn(op,"ScrollbarDrawOracle",wrapper,desc,false);
                            } else super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                    };
                }
            },0);
            if(!Arrays.equals(sites,new int[]{2,4,4}))throw new AssertionError(Arrays.toString(sites));
            Files.write(dir.resolve("ta.class"),out.toByteArray());
        }
    }

    static void start(String name,int... args) {
        StringJoiner line=new StringJoiner(",");
        line.add(name);
        for (int n:args) line.add(Integer.toString(n));
        trace.add(line.toString());
        if(++step==failAt)throw new IllegalStateException("observed draw fault");
    }
    static void after() {
        if(mode==1 || mode==15) {
            ae.e+=step*101; mh.c-=step*711; pa.yb^=step*89101; ui.D+=step*4411;
        }
        if(mode==15 && step==5) td.g=alternate;
    }
    public static void rect(int x,int y,int w,int h,int colour) {
        start("F",x,y,w,h,colour); td.d(x,y,w,h,colour); after();
    }
    public static void horizontal(int x,int y,int w,int colour) {
        start("H",x,y,w,colour); td.d(x,y,w,colour); after();
    }
    public static void vertical(int x,int y,int h,int colour) {
        start("V",x,y,h,colour); td.e(x,y,h,colour); after();
    }
    static final class Marker extends si {
        final int id;
        final ch sprite;
        Marker(int id) {
            this.id=id;
            byte[] pixels=new byte[16];
            for(int i=0;i<16;i++)pixels[i]=(byte)((i+id)%3);
            sprite=new ch(16,16,2,1,4,4,pixels,new int[]{0,0x1A0210+id,0xB03F00+id});
        }
        void a(int x,int y) {
            start("S"+id,x,y);
            sprite.a(x,y);
            if(id==0&&mode==8)me.L=new si[]{null,new Marker(2)};
            if(id==0&&mode==9)me.L=null;
            after();
        }
        void a(int x,int y,int alpha) {throw new AssertionError();}
    }
    static String run(int[] v) {
        int x=v[0],y=v[1],offset=v[2],height=v[3],content=v[4],clip=v[5];
        mode=v[6]; failAt=v[7]; step=0; trace=new StringJoiner(";");
        ae.e=defaults[0];mh.c=defaults[1];pa.yb=defaults[2];ui.D=defaults[3];
        if(mode==1||mode==15){ae.e=0x10203040;mh.c=-70219;pa.yb=0x6782342;ui.D=-83210;}
        primary=new int[mode==13 ? 170 : W*H]; alternate=new int[W*H];
        for(int i=0;i<primary.length;i++)primary[i]=i*8347^0xA5C3;Arrays.fill(alternate,0x897345);
        td.a(mode==12?null:primary,W,H);
        if(clip==1)td.b(9,11,19,63);
        if(clip==2)td.b(5,31,2,21);
        if(clip==3)td.b(0,0,48,16);
        me.L=new si[]{new Marker(0),new Marker(1)};
        if(mode==3)me.L=null;
        if(mode==4)me.L=new si[0];
        if(mode==5)me.L[0]=null;
        if(mode==6)me.L=Arrays.copyOf(me.L,1);
        if(mode==7)me.L[1]=null;
        String status="ok";
        try {ta.a(height,y,offset,content,x,(byte)122);}
        catch(RuntimeException e) {
            Throwable root=e;while(root instanceof g) root=((g)root).a;
            if(root instanceof NullPointerException) status="null";
            else if(root instanceof ArrayIndexOutOfBoundsException) status="range:"+root.getMessage().split(" ")[1];
            else if(root instanceof ArithmeticException) status="division";
            else if(root instanceof IllegalStateException) status="injected";
            else throw e;
        }
        return status+"|"+trace+"|"+Arrays.hashCode(primary)+","+Arrays.hashCode(alternate);
    }
    static final int SCREEN_W=96, SCREEN_H=96;

    static aj rectangle(int id,int y,int colour) {
        aj child=new aj();
        child.Kc=id; child.n=40; child.ob=3; child.ib=31; child.Mb=y;
        child.C=22; child.H=11; child.Jc=true; child.oc=colour;
        return child;
    }

    // Enter unmodified lf.a rather than the observed ta.class used by the direct-method probe.
    static void containers(Path directory, Path frames) throws Exception {
        try (var disk=new ProceduralTextureCacheOracle.Disk(directory,8);
             var output=new BufferedOutputStream(Files.newOutputStream(frames))) {
            al archive=new al(disk,true,true);
            int group=archive.a((byte)95,bf.H);
            si[] arrows=wb.a(group,0,-1006411924,archive);
            if(arrows==null||arrows.length!=2)throw new AssertionError("Missing scrollbar group "+group);
            BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
            for(String line;(line=input.readLine())!=null;) {
                int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
                int scroll=v[0], content=v[1], flags=v[2], fault=v[3], clip=v[4];
                aj parent=new aj();
                parent.ob=0; parent.n=-1; parent.Kc=40; parent.ib=12; parent.Mb=9; parent.C=40; parent.H=56;
                parent.Ac=scroll; parent.hc=2; parent.jb=content; parent.y=(flags&1)!=0; parent.Wc=(flags&8)!=0;
                aj first=rectangle(41,5,0x861740), last=rectangle(42,content-17,0x4859da);
                aj[] widgets={parent,first,last};
                ik.G=3; hh.kb=763; vk.db=763; n.i[3]=(flags&2)!=0; ml.T=(flags&4)!=0?2:0;
                ie.F=true; uc.c=false; di.g=(flags&16)!=0?parent:null;
                me.L=arrows;
                if(fault==1)me.L=null;
                else if(fault==2)me.L=new si[]{arrows[0],null};
                else if(fault==3)me.L=new si[]{arrows[0]};
                else if(fault==4)me.L=new si[0];
                else if(fault==5)me.L=new si[]{null,arrows[1]};
                int left=clip==2?47:3, top=clip==2?14:2;
                int right=clip==1?51:clip==2?62:94, bottom=clip==2?56:92;
                int[] pixels=new int[SCREEN_W*SCREEN_H]; Arrays.fill(pixels,0x385720);
                td.a(pixels,SCREEN_W,SCREEN_H);
                String status="ok";
                try {lf.a(0,widgets,-1,bottom,top,-1,right,0,true,left);}
                catch(RuntimeException error) {
                    Throwable cause=error; while(cause instanceof g wrapped)cause=wrapped.a;
                    status=cause.getClass().getSimpleName();
                }
                ByteBuffer raw=ByteBuffer.allocate(pixels.length*4).order(ByteOrder.LITTLE_ENDIAN);
                raw.asIntBuffer().put(pixels);output.write(raw.array());
                System.out.println(status+" "+parent.Ac+" "+parent.vb+" "+first.vb+" "+last.vb+" "+first.R+" "+last.R
                    +" "+td.e+" "+td.b+" "+td.h+" "+td.d);
            }
        }
    }
    public static void main(String[] args)throws Exception {
        if(args.length==3&&args[0].equals("containers")){containers(Path.of(args[1]),Path.of(args[2]));return;}
        if(args.length==2){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        String line;
        while((line=input.readLine())!=null)System.out.println(run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray()));
    }
}
