import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.lang.reflect.Field;
import java.util.*;

// No patching of map, list, sprite, font or raster code. The sprite observer calls
// through to rh.c to compare the real framebuffer, including ordering on faults.
public class WorldMapOverlayOracle {
    static final class Surface extends Canvas {
        public Image createImage(int w,int h){return new BufferedImage(w,h,BufferedImage.TYPE_INT_RGB);}
    }
    static final int[] sizes={11,12,14,17,19,22,26,30};
    static final eg[] fonts=new eg[8];
    static final Field cursor;
    static {try {cursor=gk.class.getDeclaredField("t");cursor.setAccessible(true);}catch(Exception e){throw new AssertionError(e);}}
    static StringJoiner calls;
    static int fault;
    static gk first;
    static mi seedNode;
    static kc mainLabels;
    static int[] pixels(int length,int id) {
        int[] a=new int[length];
        for(int i=0;i<length;i++)a[i]=i%7==1?0:0xff000000^(i*0x7231a59)^(id*0x8ab329);
        return a;
    }
    static class Sprite extends rh {
        int index;
        Sprite(int i){super(14,14,i,2,9,10,pixels(90,i));index=i;}
        void c(int x,int y){
            calls.add(index+"@"+x+","+y);
            if(calls.length()>0&&index==1&&fault==17){ad.a=new gk();fault=0;}
            if(index==1&&fault==18)throw new IllegalStateException("sprite");
            super.c(x,y);
        }
    }
    static void put(int x,int y,int id){qj.L[x>>6][y>>6][(x&63)+((y&63)<<6)]=id+1;}
    static void setup(int mask,int zoom,int seq,int clip) {
        td.a(pixels(182*135,9),182,135);
        if(clip==1)td.b(11,9,125,103);else if(clip==2)td.b(61,65,61,65);
        hd.h=switch(zoom){case -1->Float.NaN;case 31->3.25F;case 81->8.125F;default->(float)zoom;};
        oi.a=500;od.P=590;ml.m=128;hd.n=seq;hh.sb=seq==-20?0:2;ij.l=1;
        first=ad.a=new gk();seedNode=new mi();seedNode.s=2;seedNode.F=75;seedNode.z=38;
        if((mask&1)!=0)ad.a.a(seedNode,true);
        if((mask&2)!=0)ad.a.a(new jf(),true);
        qj.L=new int[2][2][4096];
        int[][] coords={{63,64,100},{61,63,101},{65,68,102},{70,58,101},{52,71,100},{68,61,101},{72,69,102},{13,0,100},{126,127,102}};
        for(int[] p:coords)put(p[0],p[1],p[2]);
        oe.y=new rh[]{new Sprite(0),new Sprite(1),new Sprite(2)};
        gl.w=new boolean[]{false,(mask&4)!=0,false};
        he.w=new ve(64);
        for(int i=0;i<3;i++){jb loc=new jb();loc.j=i;he.w.a(100L+i,loc,(byte)-71);}
        jg.t=new kc(5);
        String[] words={"Lake<br>Isle","Port @red@W","Icy <br>Tör<br>Three","Hide","Last"};
        for(int i=0;i<5;i++){
            jg.t.j[i]=aj.a(words[i],(byte)-77);jg.t.f[i]=(byte)new int[]{8,9,10,16,11}[i];
            jg.t.m[i]=(short)(558+i*3);jg.t.l[i]=(short)(659-i*3);jg.t.b[i]=i==1?0xac5019:-1;
        }
        if((mask&8)!=0){jg.t.f[0]=26;jg.t.b[0]=0xf00023;jg.t.f[1]=8;jg.t.b[1]=-1;jg.t.f[2]=9;}
        sa.A=new id[5];
        sa.A[3]=aj.a("tail",(byte)-77);sa.A[4]=sa.A[3];
        ma.b=new fg(new byte[257]);
        lk.E=fonts[0];ig.y=fonts[1];ia.k=fonts[2];rb.b=fonts[3];qa.T=fonts[4];t.Y=fonts[5];ml.Q=fonts[6];hj.j=fonts[7];
        switch(fault){
            case 1->ad.a=null;
            case 2->gl.w=null;
            case 3->gl.w=new boolean[1];
            case 4->oe.y=null;
            case 5->oe.y=new rh[]{new Sprite(0)};
            case 6->oe.y[2]=null;
            case 7->qj.L=null;
            case 8->qj.L[1]=null;
            case 9->qj.L[0][1]=new int[12];
            case 10->qj.L[1][1]=null;
            case 11->td.g=new int[6700];
            case 12->td.g=null;
            case 13->seedNode.s=-1;
            case 14->seedNode.s=3;
            case 15->{jb loc=new jb();loc.j=-1;he.w.a(102,loc,(byte)-71);}
            case 16->qj.L[1]=new int[0][];
            case 20->jg.t=null;
            case 21->jg.t.f=new byte[1];
            case 22->jg.t.b=new int[2];
            case 23->jg.t.j[1]=null;
            case 24->jg.t.l=new short[1];
            case 25->jg.t.m=null;
            case 26->sa.A=null;
            case 27->sa.A=new id[1];
            case 28->sa.A=new id[0];
            case 29->ma.b=null;
            case 30->{lk.E=null;rb.b=null;t.Y=null;hj.j=null;}
            case 31->jg.t.j[0]=aj.a("1<br>2<br>3<br>4<br>5<br>6",(byte)-77);
            case 32->jg.t.j[0]=aj.a("",(byte)-77);
            case 33->jg.t.j[1]=jg.t.j[0];
            case 34->jg.t.h=0;
            case 35->jg.t.j=null;
            case 36->jg.t.f=new byte[]{16,16,16,16,16};
            case 37->{jg.t.h=1;jg.t.f[0]=(byte)mask;}
        }
    }
    static String node(jf n,gk list){
        if(n==null)return "-";if(n==list.c)return "H";
        if(n instanceof mi i)return (i==seedNode?"S":"N")+i.s+":"+i.F+":"+i.z;
        return "bad";
    }
    static String list(gk l)throws Exception{
        if(l==null)return "-";
        StringJoiner s=new StringJoiner(",");s.add(node((jf)cursor.get(l),l));
        for(jf n=l.c.g;n!=l.c;n=n.g)s.add(node(n,l));
        return s.toString();
    }
    static String strings(id[] scratch){
        if(scratch==null)return "-";
        var seen=new IdentityHashMap<id,Integer>();var s=new StringJoiner(",");
        for(id v:scratch){
            if(v==null){s.add("-");continue;}
            if(!seen.containsKey(v))seen.put(v,seen.size());
            s.add(seen.get(v)+":"+v.c+":"+Base64.getEncoder().encodeToString(v.A));
        }
        return s.toString();
    }
    static String run(String line)throws Exception {
        int[] p=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
        int op=p[0];fault=p[1];calls=new StringJoiner(";");
        setup(p[2],p[3],p[4],p[5]);
        if(op==3){
            jg.t=mainLabels;
            int focus=-1, ordinal=p[4];
            for(int i=0;i<mainLabels.h;i++)if((mainLabels.f[i]&8)!=0 && ordinal--==0){focus=i;break;}
            if(focus<0)throw new AssertionError("missing label "+p[4]);
            oi.a=mainLabels.m[focus]-67;od.P=mainLabels.l[focus]-ml.m+1+67;
        }
        String error="ok";
        try {
            if(op==0)e.a(p[6],30079,p[7],p[8],p[9],p[10],p[11],p[12],p[13],p[14],p[15]);
            if(op==1)mj.a(p[6],p[7],(byte)97,p[8],p[9],p[10],p[11],p[12],p[13]);
            if(op>=2)ik.a(p[6],p[7],p[8],p[9],p[10],p[11],p[12],(byte)-127,p[13]);
        }catch(RuntimeException ex){
            Throwable c=ex;
            while(c instanceof g w)c=w.a;
            error=c instanceof ClassCastException?"cast":c instanceof NullPointerException?"null":
                c instanceof IndexOutOfBoundsException?"bounds":c instanceof ArithmeticException?"arithmetic":
                c instanceof IllegalStateException?"state":c.getClass().getSimpleName();
            if(ex instanceof g w) {
                // Keep the e/mj/ik wrappers under test. Lower layers have their own differential tests.
                for(String context:w.q.split(" "))if(context.startsWith("e.C(")||context.startsWith("mj.A(")||context.startsWith("ik.F("))error+="/"+context;
            }
        }
        String raw="";
        if(op==3){
            var bytes=java.nio.ByteBuffer.allocate(td.g.length*4).order(java.nio.ByteOrder.LITTLE_ENDIAN);
            bytes.asIntBuffer().put(td.g);raw="|"+Base64.getEncoder().encodeToString(bytes.array());
        }
        return String.join("|",error,WorldMapFontOracle.pixels(td.g),calls.toString(),list(first),
            (first==ad.a?"same:":"other:")+list(ad.a),strings(sa.A))+raw;
    }
    public static void main(String[] args)throws Exception {
        pe.S=new Surface();
        for(int i=0;i<sizes.length;i++)fonts[i]=new eg(sizes[i],true,pe.S);
        try(var disk=new ProceduralTextureCacheOracle.Disk(java.nio.file.Path.of(args[0]),23)){
            mainLabels=ii.a(12447,vb.a("main_labels",(byte)99),new al(disk,true,true));
        }
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;)System.out.println(run(line));
    }
}
