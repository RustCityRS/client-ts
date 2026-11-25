import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

class WidgetMinimapMenuOracle {
    static al interfaces,sprites;
    static int mode;
    static aj widget;
    static int[] starts,widths;
    static final int[] surface=new int[960*515];
    static String draw;
    static id text(String s){return vb.a(s,(byte)60);}
    static String value(id s){return s==null?"null":new String(s.A,0,s.c,java.nio.charset.StandardCharsets.ISO_8859_1);}
    public static void map(int x,aj c,int root,int guard,int y){
        if(guard!=32 || widget!=c)throw new AssertionError();
        fd.a(x,c,root,guard,y);
        draw=x+","+y+","+root+","+td.e+","+td.b+","+td.h+","+td.d;
        // At this boundary the raster and root flag have already been written; lf.a must restore the parent clip.
        if(mode==7){ve.g=x+100;ud.j=y+80;ki.R=3;df.B=-839;ag.e=92;kk.db=19;}
        if(mode==8)c.s=new int[0];
        if(mode==9)c.ud=null;
        if(mode==10)te.g=null;
    }
    static void instrument(String jarFile,Path dir)throws IOException{
        try(var jar=new JarFile(jarFile);var stream=jar.getInputStream(jar.getJarEntry("lf.class"))){
            var reader=new ClassReader(stream);var writer=new ClassWriter(reader,0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer){
                public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex){
                    var base=super.visitMethod(access,name,desc,sig,ex);
                    if(!name.equals("a")||!desc.equals("(I[Laj;IIIIIIZI)V"))return base;
                    return new MethodVisitor(Opcodes.ASM8,base){
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf){
                            if(owner.equals("fd")&&name.equals("a")&&desc.equals("(ILaj;III)V"))super.visitMethodInsn(op,"WidgetMinimapMenuOracle","map",desc,itf);
                            else super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                    };
                }
            },0); Files.write(dir.resolve("lf.class"),writer.toByteArray());
        }
    }
    static void layout(aj c,int w,int h){pa.a(c,w,false,h,2);gh.a(c,(byte)-116,w,h);}
    static String row(int[] v){
        int group=v[0],point=v[2],key=v[5],count=v[6];mode=v[3];
        hi.f=group==548?765:960;fl.l=515;hd.m=group;
        widget=ad.a((byte)110,(group<<16)|(group==548?64:8));aj root=ad.a((byte)110,widget.n);
        layout(root,hi.f,fl.l);layout(widget,root.C,root.H);
        int sprite=widget.mb;widget.s=widget.ud=null;
        if(!widget.a(22710))throw new AssertionError();starts=widget.s;widths=widget.ud;
        if(mode==6){widget.s=widget.ud=null;widget.mb=1000000;}
        widget.Wc=mode==5;
        int y=point<5?12:point==9?-1:point==10?widget.H:76;
        int x=switch(point){case 0->starts[y]-1;case 1->starts[y];case 2->starts[y]+widths[y];case 3->starts[y]+widths[y]+1;
            case 4->starts[y]+1;case 5->0;case 6->151;case 7->152;default->76;};
        ve.g=root.ib+widget.ib+x;ud.j=root.Mb+widget.Mb+y;
        int seed=v[7];df.B=seed;ag.e=seed*113+31;kk.db=seed==13?-256:seed==91?Integer.MAX_VALUE:seed*109+2;
        te.g=new pb();te.g.Z=seed==91?Integer.MAX_VALUE-7:6341+seed;te.g.S=seed==91?Integer.MIN_VALUE+5:6413-seed;
        ob.q[81]=(key&1)!=0;ob.q[82]=(key&2)!=0;
        jl.c=v[4];ki.R=v[1];ie.F=mode==4;ok.r=mode==1 || mode==2 || mode==3;
        pj.C=mode==1?32:64;gh.Y=mode==3?312:-1;qe.W=widget.Kc;
        aa.e=29;ce.D=87;t.W=text("Cast");nh.ab=text("Walk");si.m=text("Face");
        vb.o=count;hh.kb=399;vk.db=399;ik.G=1;ml.T=0;sf.m=new boolean[100];n.i=new boolean[100];ce.T=new boolean[100];
        aj[] actual=fk.ab[group];aj[] kept=new aj[actual.length];kept[root.Kc&65535]=root;kept[widget.Kc&65535]=widget;fk.ab[group]=kept;
        td.a(surface,hi.f,fl.l);draw="-";String status="ok";
        try{b.c(1);}
        catch(RuntimeException err){Throwable c=err;while(c instanceof g e)c=e.a;
            if(c instanceof NullPointerException)status="null";else if(c instanceof IndexOutOfBoundsException)status="bounds";else throw err;}
        finally{fk.ab[group]=actual;widget.s=starts;widget.ud=widths;widget.Wc=false;widget.mb=sprite;}
        StringJoiner rows=new StringJoiner(";");
        for(int i=count;i<vb.o;i++)rows.add(p.u[i]+","+mh.h[i]+","+ml.x[i]+","+sa.z[i]+","+ia.n[i]+","+value(ak.a[i])+","+value(ph.e[i]));
        return String.join("|",status,draw,vb.o+","+ok.r+","+aa.e+","+ce.T[1],rows.toString(),td.e+","+td.b+","+td.h+","+td.d);
    }
    public static void main(String[] args)throws IOException{
        if(args.length==2){instrument(args[0],Path.of(args[1]));return;}
        var p=Path.of(args[0]);
        try(var groups=new ProceduralTextureCacheOracle.Disk(p,3);var pics=new ProceduralTextureCacheOracle.Disk(p,8);
            var in=new BufferedReader(new InputStreamReader(System.in))){
            sprites=new al(pics,true,true);interfaces=new al(groups,true,true);wf.a(null,sprites,true,null,interfaces);
            for(String line;(line=in.readLine())!=null;)System.out.println(row(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray()));
        }
    }
}
