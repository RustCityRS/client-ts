import java.io.*;
import java.nio.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

class WidgetDragDrawOracle {
    static final int W=32,H=20,TARGET=0x481246,COVER=0x38cc71;
    static aj[] group,slots,mount;
    static aj target,parent;
    static String replay,first,draws,stores;
    static boolean failOnReplay;
    static String alias(aj[] array){return array==null?"-":array==group?"group":array==slots?"slots":array==mount?"mount":"other";}
    public static void enter(int y,aj[] list,int p,int bottom,int top,int root,int right,int x,boolean guard,int left){
        if(p==-1412584499)replay=String.join(",",alias(list),""+x,""+y,""+root,""+left,""+top,""+right,""+bottom);
    }
    public static void store(String field){
        if(field.equals("q"))first=alias(jg.q);
        if(!stores.isEmpty())stores+=";";
        stores+=field+","+gf.db+","+alias(jg.q)+","+ma.n;
    }
    static void record(int x,int y,int w,int h,int colour,int alpha){
        if(colour!=TARGET&&colour!=COVER)return;
        if(!draws.isEmpty())draws+=";";
        draws+=(colour==TARGET?"T":"C")+","+x+","+y+","+w+","+h+","+alpha+","+td.e+","+td.b+","+td.h+","+td.d;
        if(failOnReplay&&colour==TARGET&&!replay.equals("-"))throw new IllegalStateException();
    }
    public static void fill(int x,int y,int w,int h,int rgb){record(x,y,w,h,rgb,256);td.d(x,y,w,h,rgb);}
    public static void blend(int x,int y,int w,int h,int rgb,int alpha){record(x,y,w,h,rgb,alpha);td.b(x,y,w,h,rgb,alpha);}
    static void prepare(Path jar,Path dir)throws Exception{
        try(var f=new JarFile(jar.toFile())){
            var in=new ClassReader(f.getInputStream(f.getJarEntry("lf.class")));
            var out=new ClassWriter(in,ClassWriter.COMPUTE_MAXS);
            in.accept(new ClassVisitor(Opcodes.ASM8,out){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    var base=super.visitMethod(access,name,desc,sig,ex);
                    if(!desc.equals("(I[Laj;IIIIIIZI)V")||!name.equals("a"))return base;
                    return new MethodVisitor(Opcodes.ASM8,base){
                        public void visitCode(){
                            super.visitCode();
                            for(int i=0;i<10;i++)super.visitVarInsn(i==1?Opcodes.ALOAD:Opcodes.ILOAD,i);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetDragDrawOracle","enter",desc,false);
                        }
                        public void visitFieldInsn(int op,String owner,String name,String d){
                            super.visitFieldInsn(op,owner,name,d);
                            if(op==Opcodes.PUTSTATIC&&((owner.equals("jg")&&name.equals("q"))
                                    ||(owner.equals("gf")&&name.equals("db"))||(owner.equals("ma")&&name.equals("n")))){
                                super.visitLdcInsn(name);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetDragDrawOracle","store","(Ljava/lang/String;)V",false);
                            }
                        }
                        public void visitMethodInsn(int op,String owner,String name,String d,boolean iface){
                            if(owner.equals("td")&&name.equals("d")&&d.equals("(IIIII)V"))super.visitMethodInsn(op,"WidgetDragDrawOracle","fill",d,false);
                            else if(owner.equals("td")&&name.equals("b")&&d.equals("(IIIIII)V"))super.visitMethodInsn(op,"WidgetDragDrawOracle","blend",d,false);
                            else super.visitMethodInsn(op,owner,name,d,iface);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("lf.class"),out.toByteArray());
        }
    }
    static aj box(int id,int p,int x,int y,int w,int h,int rgb){
        var c=new aj();c.Kc=id;c.n=p;c.ib=x;c.Mb=y;c.C=w;c.H=h;c.y=true;c.Jc=true;c.ob=3;c.oc=rgb;return c;
    }
    static String fault(Throwable e){
        if(e instanceof g w)return w.q+"/"+fault(w.a);
        if(e instanceof NullPointerException)return "null";if(e instanceof IllegalStateException)return "probe";
        throw new AssertionError(e);
    }
    static void run(int source,int inline,int motion,int mode,OutputStream frames)throws IOException{
        var back=box(1,-1,0,0,W,H,0x172536);
        parent=box(10,-1,3,2,16,11,0);parent.ob=0;parent.hc=2;parent.Ac=3;
        int layer=source==2?-1:10;
        target=box(11,layer,mode==2?15:4,5,mode==3?24:6,4,TARGET);target.zc=inline!=0;target.S=16;
        if(mode==4)target.Wc=true;
        var cover=box(12,layer,target.ib,target.Mb,target.C,target.H,COVER);
        group=source==0?new aj[]{null,back,parent,target,cover}:new aj[]{null,back,parent};
        slots=source==1?new aj[]{null,target,cover}:null;
        mount=source==2?new aj[]{target,null,cover}:null;
        if(mode==11){
            aj extra=box(13,-1412584499,4,7,4,3,0xb33168);
            aj[] sourceArray=source==0?group:source==1?slots:mount;
            aj[] expanded=Arrays.copyOf(sourceArray,sourceArray.length+1);
            expanded[expanded.length-1]=extra;
            if(source==0)group=expanded;else if(source==1)slots=expanded;else mount=expanded;
        }
        parent.pb=slots;
        fk.ab=new aj[][]{group,mount};rg.b=new boolean[]{true,true};va.Z=new nc(8);
        if(source==2){var sub=new qd();sub.q=1;sub.v=1;va.Z.a((byte)-89,sub,10L);}
        hd.m=0;hi.f=W;fl.l=H;hh.kb=99;ik.G=2;
        sf.m=new boolean[]{true,true};n.i=new boolean[2];ce.T=new boolean[2];uc.c=false;ml.T=0;
        pe.T=mode==5?null:target;vf.Y=mode==1?null:mode==8?back:parent;ed.h=(motion&1)!=0;bk.vc=(motion&2)!=0;
        oe.s=3;oa.g=2;sj.C=mode==7?-7:29;pf.Q=mode==7?-9:18;c.A=1;c.s=1;
        if(mode==9){oe.s=Integer.MAX_VALUE-2;oa.g=Integer.MAX_VALUE-1;sj.C=Integer.MIN_VALUE;pf.Q=Integer.MIN_VALUE;}
        if(mode==10){oe.s=Integer.MIN_VALUE+3;oa.g=Integer.MIN_VALUE+2;c.A=Integer.MIN_VALUE;c.s=Integer.MAX_VALUE;}
        jg.q=new aj[0];gf.db=73;ma.n=91;first="-";replay="-";draws="";stores="";failOnReplay=mode==6;
        int[] pixels=new int[W*H];td.a(pixels,W,H);String error="-";
        try{db.a(-54);}catch(Throwable e){error=fault(e);}
        ByteBuffer raw=ByteBuffer.allocate(pixels.length*4).order(ByteOrder.LITTLE_ENDIAN);
        raw.asIntBuffer().put(pixels);frames.write(raw.array());
        System.out.println(String.join("|",error,first,replay,draws,alias(jg.q),
            gf.db+","+ma.n+","+target.vb+","+target.R+","+ik.G,
            td.e+","+td.b+","+td.h+","+td.d,stores));
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){prepare(Path.of(args[0]),Path.of(args[1]));return;}
        Class.forName("client");
        var in=new BufferedReader(new InputStreamReader(System.in));
        try(var frames=new BufferedOutputStream(Files.newOutputStream(Path.of(args[0])))){
            for(String line;(line=in.readLine())!=null;){var v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();run(v[0],v[1],v[2],v[3],frames);}
        }
    }
}
