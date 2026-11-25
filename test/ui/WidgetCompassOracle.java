import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Keep the original lf.a, aj.a and ke.a bodies. Observe the two call edges in lf.a.
class WidgetCompassOracle {
    static aj compass, probe;
    static rh image;
    static StringJoiner events;
    static int mode;
    static String clip(){return td.e+","+td.b+","+td.h+","+td.d;}

    public static boolean mask(aj c,int guard){
        if(guard!=22710)throw new AssertionError("unexpected GetMask guard "+guard);
        events.add((c==compass?"mask":"probe")+","+clip());
        boolean value=c.a(guard);
        if(c==compass && (mode==7 || mode==8))td.b(4,6,19,22);
        return value;
    }
    public static void paint(int root,aj c,int limit,int x,int y){
        events.add("draw,"+root+","+limit+","+x+","+y+","+clip());
        ke.a(root,c,limit,x,y);
        if(mode==7)td.b(7,9,14,18);
    }
    static void instrument(String jarFile,Path dir)throws IOException {
        try(var jar=new JarFile(jarFile);var stream=jar.getInputStream(jar.getJarEntry("lf.class"))){
            ClassReader reader=new ClassReader(stream); ClassWriter writer=new ClassWriter(reader,0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] exceptions){
                    var base=super.visitMethod(access,name,desc,sig,exceptions);
                    if(!name.equals("a") || !desc.equals("(I[Laj;IIIIIIZI)V"))return base;
                    return new MethodVisitor(Opcodes.ASM8,base){
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean iface){
                            if(owner.equals("aj") && name.equals("a") && desc.equals("(I)Z"))
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"WidgetCompassOracle","mask","(Laj;I)Z",false);
                            else if(owner.equals("ke") && name.equals("a") && desc.equals("(ILaj;III)V"))
                                super.visitMethodInsn(op,"WidgetCompassOracle","paint",desc,false);
                            else super.visitMethodInsn(op,owner,name,desc,iface);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("lf.class"),writer.toByteArray());
        }
    }
    static void layout(aj c,int width,int height){
        pa.a(c,width,false,height,2);
        gh.a(c,(byte)-116,width,height);
    }
    static String run(int layout,int state,int yaw,int testMode,MessageDigest sha){
        int w=layout==0?765:layout==1?957:1280,h=layout==0?503:layout==1?613:720;
        compass=ad.a((byte)110,layout==0?(548<<16)|65:(746<<16)|10);
        aj root=ad.a((byte)110,compass.n);
        layout(root,w,h); layout(compass,root.C,root.H);
        if(compass.wc!=1339 || compass.C!=33 || compass.H!=33 || compass.mb!=1186)throw new AssertionError();
        int x=root.ib+compass.ib,y=root.Mb+compass.Mb;
        mode=testMode; ff.u=mode==3?null:image; ki.R=state; df.B=yaw;
        boolean high=(yaw&1)==0; lf.j=b.E=th.g=high;
        hh.kb=191; ik.G=2; n.i=new boolean[100]; sf.m=new boolean[100]; ce.T=new boolean[mode==4?2:100];
        ie.F=false; ve.g=ud.j=-5; uc.c=false; va.Z=new nc(8);
        events=new StringJoiner(";"); compass.s=compass.ud=null; compass.Wc=mode==11;
        if(mode==1 || mode==5){if(!compass.a(22710))throw new AssertionError();}
        if(mode==5)compass.ud=Arrays.copyOf(compass.ud,10);
        if(mode==1 || mode==2 || mode==8)compass.mb=1000000;
        probe=new aj();probe.n=root.Kc;probe.Kc=-38;probe.ob=5;probe.wc=1339;probe.mb=1000000;probe.C=probe.H=1;
        int[] pixels=new int[mode==6?(y+12)*w+x+15:w*h];
        Arrays.fill(pixels,0x4b2369); td.a(pixels,w,h);
        int left=mode==9?x+40:mode==10?x+16:0,top=mode==10?y+8:0,right=mode==10?x+21:w,bottom=mode==10?y+17:h;
        String result="ok";
        try{lf.a(0,new aj[]{root,compass,probe},-1,bottom,top,-1,right,0,true,left);}
        catch(RuntimeException err){
            Throwable cause=err;while(cause instanceof g e)cause=e.a;
            if(cause instanceof NullPointerException)result="null";
            else if(cause instanceof IndexOutOfBoundsException)result="bounds";
            else throw err;
        }
        int changed=0;for(int p:pixels)if(p!=0x4b2369)changed++;
        String row=result+"|"+events+"|"+clip()+"|"+ik.G+","+compass.vb+","+compass.R+","+sf.m[2]+","+
                (ce.T.length>2 && ce.T[2])+","+Arrays.hashCode(compass.s)+","+Arrays.hashCode(compass.ud)+"|"+changed+"|"+
                ProceduralTextureCacheOracle.digest(pixels,sha);
        compass.mb=1186; compass.Wc=false;
        return row;
    }
    public static void main(String[] args)throws Exception{
        if(args.length==2){instrument(args[0],Path.of(args[1]));return;}
        var cache=Path.of(args[0]);var sha=MessageDigest.getInstance("SHA-256");
        try(var a=new ProceduralTextureCacheOracle.Disk(cache,3);var s=new ProceduralTextureCacheOracle.Disk(cache,8);
            var in=new BufferedReader(new InputStreamReader(System.in))){
            al sprites=new al(s,true,true);
            wf.a(null,sprites,true,null,new al(a,true,true));
            int id=sprites.a((byte)95,vb.a("compass",(byte)60));
            image=fa.a(-123,sprites,id,0); image.c();
            for(String line;(line=in.readLine())!=null;){int[] p=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
                System.out.println(run(p[0],p[1],p[2],p[3],sha));}
        }
    }
}
