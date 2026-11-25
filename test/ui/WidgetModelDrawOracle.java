import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.file.Path;
import java.nio.file.Files;
import java.util.*;

// Original lf.a, the original JS5 archives and the complete software model renderer.
public class WidgetModelDrawOracle {
    static cl appearance;
    static pb viewer;
    static final int W=256,H=256;
    static int[] sin,cos;
    static Field activeType, activeId;

    static String run(int[] row, OutputStream frames)throws Exception {
        int source=row[0],flags=row[1],layout=row[2],fault=row[3],pitch=row[4];
        aj c=new aj();c.Kc=4;c.n=-1;c.ob=6;c.y=(flags&1)!=0;c.Ic=(flags&2)!=0;
        c.C=120;c.H=124;c.ib=50;c.Mb=40;
        c.md=1;c.w=0;activeType.setInt(c,1);activeId.setInt(c,1100);
        c.bd=new int[]{0};c.eb=new int[]{(flags&4)!=0?1:0};c.Vb=new int[][]{{20,1,0}};
        c.d=384;c.id=44;c.nd=pitch;c.vd=380;c.qb=8;c.Vc=6;c.hb=16;c.db=0;
        if(layout==1){c.Bb=55;c.Y=92;c.qb=-15;c.Vc=7;c.db=-13;}
        if(layout==2){c.Bb=1;c.Y=-2;c.qb=Integer.MIN_VALUE;c.Vc=Integer.MAX_VALUE;c.vd=-256;}
        if(layout==3)c.vd=0;
        if(layout==4){c.jc=808;c.qd=819;c.Sb=0;c.Q=1;c.Hc=2;}
        if(layout==5){c.C=13;c.H=18;c.vd=0x7fffffff;}
        te.g=fault==1?null:viewer;
        f.b=fault==8?null:appearance;
        mi.y=17;tf.J[2047]=tf.J[73]=null;
        if(source==1)c.w=-1;
        if(source==2)c.w=900000;
        if(source==3){c.yc=995;c.xc=1000;}
        if(source==4){c.yc=4151;c.xc=1;}
        if(source==5){c.md=4;c.w=995;}
        if(source==6){c.md=0;activeType.setInt(c,0);}
        if(source==7){c.md=3;}
        if(source>=8&&source<=13){
            c.md=5;
            if(source==8)c.w=-1;
            else {
                pb who=new pb();who.Gc=vb.a("Rune",(byte)99);who.pc=appearance;
                int slot=source==9?17:73;
                c.w=(int)who.Gc.b((byte)-16)<<11|slot;
                if(source==10)c.w^=2048;
                if(source==11)who.pc=null;
                if(source==12)who.Gc=null;
                if(source!=13)tf.J[slot==17?2047:slot]=who;
            }
        }
        if(source==14){c.yc=40000;c.xc=1;}
        if(fault==2)c.eb=null;
        if(fault==3)c.nd=2048;
        dc.l=fault==4?null:sin;dc.g=fault==5?new int[0]:cos;
        ik.G=3;hh.kb=346;vk.db=fault==6?345:346;
        sf.m=new boolean[100];n.i=new boolean[fault==10?3:100];
        if(fault!=7&&fault!=9&&fault!=10)n.i[3]=true;
        ml.T=fault==9||fault==10?2:0;rk.o=source!=14;ie.F=true;
        int[] pixels=new int[W*H];td.a(pixels,W,H);
        int left=layout==0?0:33,top=layout==0?0:17,right=layout==0?W:222,bottom=layout==0?H:236;
        String result="ok";
        try {lf.a(0,new aj[]{c},-1,bottom,top,-1,right,0,true,left);}
        catch(RuntimeException ex) {
            Throwable cause=ex;while(cause instanceof g w)cause=w.a;
            if(cause instanceof NullPointerException)result="null";
            else if(cause instanceof IndexOutOfBoundsException)result="bounds";
            else if(cause instanceof ArithmeticException)result="divide";
            else if(cause instanceof ClassCastException)result="cast";
            else throw ex;
        }
        ByteBuffer bytes=ByteBuffer.allocate(4*pixels.length).order(ByteOrder.LITTLE_ENDIAN);
        bytes.asIntBuffer().put(pixels);
        frames.write(bytes.array());
        return result+" "+rk.o+" "+sf.m[3]+" "+dc.f+" "+dc.b+" "+oj.j+" "+vf.X+" "+p.l+" "+fl.m+" "+
            Arrays.hashCode(pixels);
    }
    public static void main(String[] args)throws Exception {
        Path dir=Path.of(args[0]);
        activeType=aj.class.getDeclaredField("zb");activeType.setAccessible(true);
        activeId=aj.class.getDeclaredField("O");activeId.setAccessible(true);
        try(var output = new BufferedOutputStream(Files.newOutputStream(Path.of(args[1])));
            var models=new ProceduralTextureCacheOracle.Disk(dir,7);var objects=new ProceduralTextureCacheOracle.Disk(dir,19);
            var seq=new ProceduralTextureCacheOracle.Disk(dir,20);var bases=new ProceduralTextureCacheOracle.Disk(dir,1);
            var frames=new ProceduralTextureCacheOracle.Disk(dir,0);var textures=new ProceduralTextureCacheOracle.Disk(dir,9);
            var mats=new ProceduralTextureCacheOracle.Disk(dir,26);var sprites=new ProceduralTextureCacheOracle.Disk(dir,8)) {
            kk.R=new al(models,true,true);
            bj.a(new al(objects,true,true),-113,true,null,kk.R);
            // A decoded object can be available while its referenced mesh has not arrived.
            Field itemModel=kl.class.getDeclaredField("xb");itemModel.setAccessible(true);itemModel.setInt(rg.a(40000,-28322),900000);
            hf.a(new al(seq,true,true),new al(bases,true,true),-124,new al(frames,true,true));
            dc.r=new kg(new al(textures,false,true),new al(mats,true,true),new al(sprites,true,true),20,false);
            Field gamma=dc.class.getDeclaredField("i");gamma.setAccessible(true);gamma.setFloat(null,0.8f);
            Method palette=dc.class.getDeclaredMethod("b",int.class,int.class);palette.setAccessible(true);palette.invoke(null,0,512);
            sin=dc.l;cos=dc.g;
            m.C=pk.c;sa.u=ik.Z;wg.b=lh.e;ij.j=ie.J;
            int[] equipment=new int[12];equipment[3]=1073741824|4151;
            appearance=new cl();appearance.a(false,new int[5],-1,equipment,-9,-1);
            f.b=appearance;viewer=new pb();viewer.pc=appearance;
            var reader=new BufferedReader(new InputStreamReader(System.in));
            for(String line;(line=reader.readLine())!=null;)
                System.out.println(run(Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray(), output));
        }
    }
}
