import java.io.*;
import java.lang.reflect.Field;
import java.util.*;

// Runs ke.a(ILaj;III)V (op 0), fd.a(ILaj;III)V (op 1) and ph.a(IZ)Z (op 2) on the real gamepack classes for the
// scenarios minimap-builder.test.ts sends ("op seed mode" per line). Both sides build the same state from the same
// xorshift stream, in the same order; minimap-builder.test.ts mirrors every step below.
public class MinimapBuilderOracle {
    static final int W=140,H=120;
    static final String[] NAMES={"alice","bob","Carol","dave1","e_f","zz"};
    static final String[] LABELS={"Lumbridge","Varrock<br>East","<col=ff0000>Draynor</col>","","A","Al Kharid"};
    static final int[] KINDS={0,1,2,10,5};
    static final int[] FLAGS={0x8,0x80,0x2,0x20,0x100,0x200000,0x40000,0x1000,0x4};
    static final ud EMPTY=new ud(){
        db b(int n){return null;} byte[] a(int m,int g){return null;}
        void b(int n,int g){} int c(int g,int n){return 0;}
    };
    static int s;
    static Random math;
    static int[] frame;
    static aj comp;
    static int x,y,index;

    static int rnd(){s^=s<<13;s^=s>>>17;s^=s<<5;return s;}
    static int r(int n){return (rnd()>>>1)%n;}

    static class Other extends vc {
        void a(int a,int b,int c){} void a(int a,int b,int c,int d,int e,int f){} void a(int a,int b){}
        void a(int a,int b,int c,int d){} void b(int a,int b){} void c(int a,int b){} void a(int a,int b,int c,int d,int e){}
    }

    static rh dot(int w,int h){
        rh d=new rh(w,h);
        for(int i=0;i<d.I.length;i++)d.I[i]=r(3)==0?0:rnd();
        return d;
    }
    static rh image(int w,int h,int seed){
        rh d=new rh(w,h);
        for(int i=0;i<d.I.length;i++)d.I[i]=(i*0x2545F491)^seed;
        return d;
    }
    static fg font(int style){
        byte[] metrics=new byte[257];Arrays.fill(metrics,(byte)(4+style));metrics[256]=(byte)(9+style);
        int gw=3+style%2;
        int[] zero=new int[256],w=new int[256],h=new int[256];Arrays.fill(w,gw);Arrays.fill(h,5);
        byte[][] mask=new byte[256][gw*5];
        for(int c=0;c<256;c++)for(int j=0;j<mask[c].length;j++)if((c+j+style)%3!=0)mask[c][j]=1;
        return new fg(metrics,zero,zero,w,h,mask);
    }
    static id name(int i){return vb.a(NAMES[i],(byte)99);}
    static long key(int id,int shape,int angle,boolean neg){
        long k=(((long)id)<<32)|0x40000000L|((long)(angle&3)<<20)|((long)shape<<14)|69;
        return neg?k|Long.MIN_VALUE:k;
    }
    static void locs(int fn5){
        he.w=new ve(64);hj.f=new ve(64);mk.A=new ve(64);n.g=null;mj.d=new al(EMPTY,true,true);
        int[] functions={0,22,-1,-1,5,-1,48,-1};
        int[][] multis={null,null,null,{-1,101,100},{102,-1},{102},null,null};
        for(int i=0;i<8;i++){
            jb l=new jb();l.k=100+i;l.j=i==5?fn5:functions[i];l.e=multis[i];l.wb=i==7?10:-1;
            l.ub=false;l.O=0;l.fb=1;l.y=1;
            he.w.a((long)(100+i),l,(byte)-71);
        }
        da m=new da();m.l=40;m.j=false;m.a=0;hj.f.a(10L,m,(byte)-71);
    }
    static void common(int mode){
        frame=new int[W*H];
        for(int i=0;i<frame.length;i++)frame[i]=(i*0x9E3779B1)^s;
        td.a(mode==6?null:frame,W,H);
        int cw=40+r(50),ch=40+r(50);
        x=r(W-cw+1);y=r(H-ch+1);
        comp=new aj();comp.C=cw;comp.H=ch;comp.s=new int[ch];comp.ud=new int[ch];
        for(int i=0;i<ch;i++){int a=r(6);comp.s[i]=a;comp.ud[i]=cw-a-r(6);}
        index=r(100);
        Arrays.fill(ce.T,false);
        switch(mode){
            case 1->comp=null;
            case 2->comp.s=null;
            case 3->comp.ud=new int[3];
            case 4->index=100;
            case 5->x=W-10;
            case 7->y=H-10;
        }
    }
    static String status(RuntimeException ex){
        Throwable t=ex;while(t instanceof g w)t=w.a;
        if(t instanceof NullPointerException)return "null";
        if(t instanceof ArrayIndexOutOfBoundsException)return "bounds";
        if(t instanceof ClassCastException)return "cast";
        if(t instanceof ArithmeticException)return "division";
        if(t instanceof IllegalArgumentException)return "illegal";
        if(t instanceof IllegalStateException)return "state";
        throw ex;
    }
    static int hash(int[] a){if(a==null)return 0;int h=1;for(int v:a)h=31*h+v;return h;}
    static int hash(boolean[] a){int h=1;for(boolean v:a)h=31*h+(v?1:0);return h;}
    static String pix(){return hash(frame)+"|"+hash(ce.T)+"|"+td.e+","+td.b+","+td.h+","+td.d+"|"+(td.f==null)+(td.a==null);}

    static String compass(int mode){
        common(mode);
        ff.u=dot(20+r(20),20+r(20));ki.R=r(7);df.B=r(2048);
        int limit=r(4)==0?r(6):3;
        if(mode==10)ff.u=null;
        if(mode==11)ff.u=new Other();
        String st="ok";
        try{ke.a(index,comp,limit,x,y);}catch(RuntimeException ex){st=status(ex);}
        return st+"|"+pix();
    }

    static String draw(int mode){
        common(mode);
        ki.R=r(8)==0?(r(2)==0?2:5):0;
        df.B=r(2048);ag.e=r(121)-60;kk.db=r(31)-20;
        pb self=new pb();self.Z=r(104*128);self.S=r(104*128);self.Bc=r(3);te.g=self;
        ek.w=image(512,512,rnd());
        hk.e=r(4000);vj.t=r(4000);
        ma.b=font(0);wj.g=font(1);uf.b=font(2);
        if(r(4)==0)ug.d=null;
        else{
            int n=r(5);kc k=new kc(n);
            for(int i=0;i<n;i++){
                k.f[i]=(byte)r(32);k.m[i]=(short)(hk.e+(self.Z>>7)+r(21)-10);k.l[i]=(short)(vj.t+(self.S>>7)+r(21)-10);
                k.b[i]=r(3)==0?-1:(rnd()&0xffffff);k.j[i]=vb.a(LABELS[r(LABELS.length)],(byte)99);
            }
            ug.d=k;
        }
        locs(-1);
        Arrays.fill(ec.o,0);Arrays.fill(ba.h,0);Arrays.fill(oh.m,0);
        qk.C=r(6);
        for(int i=0;i<qk.C;i++){ba.h[i]=(self.Z>>7)+r(17)-8;oh.m[i]=(self.S>>7)+r(17)-8;ec.o[i]=100+r(7);}
        gh.N=new vc[50];
        for(int i=0;i<50;i++)gh.N[i]=dot(3+i%4,3+i%3);
        ah.f=r(4);b.H=new gk[4][104][104];
        int objs=r(6);
        for(int i=0;i<objs;i++){int ox=Math.min(103,Math.max(0,(self.Z>>7)+r(17)-8)),oz=Math.min(103,Math.max(0,(self.S>>7)+r(17)-8));b.H[ah.f][ox][oz]=new gk();}
        ll.r=new vc[]{dot(3,3),dot(4,4),dot(3,4),dot(4,3),dot(5,5),dot(2,2)};
        uc.l=new bk[32768];ed.d=r(5);
        for(int i=0;i<ed.d;i++){
            int id=r(12);fi.n[i]=id;
            if(r(4)!=0&&uc.l[id]==null){
                bk npc=new bk();npc.Z=self.Z+r(2048)-1024;npc.S=self.S+r(2048)-1024;
                if(r(5)!=0){
                    ja t=new ja();t.gb=r(4)!=0;t.hb=r(4)!=0;t.u=r(3)==0?r(6):-1;t.J=r(5)==0?new int[]{-1}:null;
                    npc.mc=t;
                }
                uc.l[id]=npc;
            }
        }
        tf.J=new pb[2048];fe.R=r(5);
        for(int i=0;i<fe.R;i++){
            int id=r(20);ad.h[i]=id;
            if(r(5)!=0&&tf.J[id]==null){
                pb p=new pb();p.Z=self.Z+r(2048)-1024;p.S=self.S+r(2048)-1024;p.Bc=r(3);
                p.Gc=r(30)==0?null:name(r(6));p.pc=r(6)==0?null:new cl();
                tf.J[id]=p;
            }
        }
        sj.L=r(4);
        for(int i=0;i<sj.L;i++){jd.m[i]=name(r(6)).b((byte)-16);jf.b[i]=r(3);}
        uh.N=r(3);jl.b=new rf[uh.N];
        for(int i=0;i<uh.N;i++){rf m=new rf();m.k=name(r(6)).b((byte)-16);jl.b[i]=m;}
        hh.kb=r(40);ve.t=new kf[4];
        for(int i=0;i<4;i++){
            if(r(3)==0)continue;
            kf a=new kf();a.j=KINDS[r(5)];a.a=r(16)-2;a.o=r(2);a.e=vj.t+r(104);a.i=hk.e+r(104);
            ve.t[i]=a;
        }
        cf.e=new vc[]{dot(6,6),dot(5,7)};gf.cb=new vc[]{image(30,30,rnd()),image(30,30,rnd())};
        gl.z=r(3)==0?0:r(104);ic.T=r(104);fe.Y=dot(6,8);
        switch(mode){
            case 10->ki.R=2;
            case 11->ek.w=null;
            case 12->ek.w=new Other();
            case 13->ma.b=null;
            case 14->kk.db=-256;
            case 15->gh.N=null;
            case 16->ll.r=new vc[1];
            case 17->te.g=null;
            case 18->ug.d=null;
            case 19->jl.b=new rf[uh.N==0?0:uh.N-1];
            case 20->gh.N=new vc[6];
        }
        String st="ok";
        try{fd.a(x,comp,index,32,y);}catch(RuntimeException ex){st=status(ex);}
        return st+"|"+pix();
    }

    static String state(vc v,vc prevW,vc prevK){
        if(v==null)return "n";
        if(!(v instanceof rh))return "o";
        return (v==prevW?"w":"")+(v==prevK?"k":"")+hash(((rh)v).I);
    }
    static String build(int mode){
        common(mode);
        int level=mode==20?4:r(4);
        ah.f=r(3)==0?r(4):(level&3);
        tb.t=new byte[4][104][104];
        for(int l=0;l<4;l++)for(int i=0;i<104;i++)for(int j=0;j<104;j++){
            int v=r(16);
            tb.t[l][i][j]=(byte)(v<10?0:v==10?8:v==11?16:v==12?24:v==13?2:v==14?10:4);
        }
        kl.Bb=new ra[4][104][104];
        for(int l=0;l<4;l++)for(int i=0;i<104;i++)for(int j=0;j<104;j++){
            int v=r(10);
            if(v==0)continue;
            ra sq=new ra(l,i,j);kl.Bb[l][i][j]=sq;
            if(v<7)sq.F=new ma(0,0,0,0,-1,v==1?0:(rnd()&0xffffff),true);
            if(r(12)==0){int id=100+r(7),shape=r(4),angle=r(4);boolean neg=r(4)==0;sq.z=new hk();sq.z.f=key(id,shape,angle,neg);}
            if(r(mode==26?3:60)==0){int id=100+r(7),angle=r(4);sq.u=new pk();sq.u.e=key(id,22,angle,false);}
        }
        if(mode==21){
            int l=level&3,i=1+r(102),j=1+r(102);
            ra sq=kl.Bb[l][i][j];if(sq==null)kl.Bb[l][i][j]=sq=new ra(l,i,j);
            sq.z=new hk();sq.z.f=key(107,0,0,false);
            tb.t[l][i][j]=0;
        }
        hc.c=new ke[4];
        for(int l=0;l<4;l++){
            ke m=new ke(104,104);
            for(int a=0;a<104;a++)for(int bz=0;bz<104;bz++)if(m.d[a][bz]==0x1000000)m.d[a][bz]=0;
            for(int k=0;k<1500;k++){int a=r(104),bz=r(104),v=FLAGS[r(9)];m.d[a][bz]|=v;}
            hc.c[l]=m;
        }
        locs(new int[]{29,34,36,46,47,3,-1,22}[r(8)]);
        Arrays.fill(ec.o,0);Arrays.fill(ba.h,0);Arrays.fill(oh.m,0);qk.C=-7;
        int im=r(3);
        ek.w=im==0?null:image(512,512,rnd());
        ob.Kb=mode==22?image(512,512,rnd()):null;
        if(mode==23)ek.w=new Other();
        if(mode==24)ek.w=image(100,100,rnd());
        oh screen=new oh(){
            void a(int a,int b,int c,java.awt.Graphics g){}
            void a(int a,int b,java.awt.Component c,byte d){}
            void a(byte a,int b,int c,int d,int e,java.awt.Graphics g){}
        };
        screen.n=new int[W*H];screen.e=H;screen.i=W;rg.s=mode==25?null:screen;
        vc prevW=ek.w,prevK=ob.Kb;
        math.setSeed(rnd());
        String st="ok";
        try{st=String.valueOf(ph.a(level,true));}catch(RuntimeException ex){st=status(ex);}
        int next=(int)(Math.random()*2147483647.0);
        return st+"|"+qk.C+"|"+hash(ec.o)+"|"+hash(ba.h)+"|"+hash(oh.m)+"|"+state(ek.w,prevW,prevK)+"|"+state(ob.Kb,prevW,prevK)
            +"|"+(td.g==screen.n)+","+td.c+","+td.i+"|"+next;
    }

    public static void main(String[] args)throws Exception{
        Field rng=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        rng.setAccessible(true);math=(Random)rng.get(null);
        // The four <clinit>s that draw from Math.random run now, so none of them lands inside a seeded ph.a run.
        for(String c:new String[]{"cg","ki","ok","si"})Class.forName(c);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        PrintStream out=new PrintStream(new BufferedOutputStream(System.out),false);
        for(String line;(line=in.readLine())!=null;){
            String[] p=line.split(" ");
            int op=Integer.parseInt(p[0]),mode=Integer.parseInt(p[2]);s=Integer.parseInt(p[1]);
            out.println(op==0?compass(mode):op==1?draw(mode):build(mode));
        }
        out.flush();
    }
}
