import java.io.*;
import java.util.*;

class DragLoopOracle {
    static final aj source=new aj(),parent=new aj(),target=new aj(),alternate=new aj();
    static int reads,action;
    static void clearTarget(){m.W=null;}
    static final class Provider extends ud {
        db b(int dummy) {
            if (++reads==1) {
                if(action==1)ca.a=1;
                if(action==2)pe.T=alternate;
                if(action==3)ed.h=false;
            } else if(reads==2) {
                if(action==4)clearTarget();
                if(action==5)pe.T=null;
            }
            return null;
        }
        byte[] a(int dummy,int group){throw new AssertionError();}
        void b(int dummy,int group){throw new AssertionError();}
        int c(int group,int dummy){throw new AssertionError();}
    }
    static void script(int id,int base) {
        m code=new m();code.D=new int[15];code.F=new int[15];code.B=new id[15];code.E=6;
        for(int i=0;i<6;i++){code.D[2*i]=33;code.F[2*i]=i;code.D[2*i+1]=43;code.F[2*i+1]=base+i;}
        code.D[12]=0;code.D[13]=201;code.D[14]=21;
        sf.g.a((long)id,0,code);
    }
    static int id(aj c){return c==null?-1:c.Kc;}
    static String fault(RuntimeException e){
        Throwable cause=e;while(cause instanceof g)cause=((g)cause).a;
        return cause instanceof IndexOutOfBoundsException?"bounds":cause instanceof NullPointerException?"null":cause.getClass().getSimpleName();
    }
    static void menu(){
        byte[] metrics=new byte[257];Arrays.fill(metrics,(byte)6);fg font=new fg(metrics);
        byte[] seed={1,2,3,4};
        for(int i=0;i<640;i++){
            int flags=i/5;
            pe.T=source;vf.Y=parent;ca.a=0;wg.d=bk.vc=true;ed.h=false;h.a=0;
            source.Yb=5;source.Kc=40;source.R=0;source.vb=0;vk.db=0;sf.m[0]=false;
            qk.v=new be(32);qk.v.a(new int[]{seed[0],seed[1],seed[2],seed[3]},-1);
            vb.o=new int[]{0,1,2,4,501}[i%5];d.q=flags&1;si.q=aj.a("Menu",(byte)-121);
            uf.b=(flags&64)==0?font:null;
            for(int j=0;j<5;j++){
                ak.a[j]=si.q;ph.e[j]=(flags&4)!=0 && j==3?null:ga.J;
                p.u[j]=(short)(j==3 && (flags&2)!=0?3001:(j%2==0?1002:22));
                ml.x[j]=1234+j;mh.h[j]=21+j;sa.z[j]=10+j;
            }
            qe.W=0x0102_bacc;gh.Y=11;ob.q[81]=(flags&2)!=0;pb.sc=true;ec.g=(flags&4)!=0;
            hi.f=123;fl.l=92;ve.g=120;ud.j=71;sa.x=(flags&8)!=0?95:120;oj.e=71;
            pk.k=(flags>>4)%3;g.n=120;ef.J=71;ie.F=false;fl.i=hc.j=lk.u=client.C=-17;
            String status="ok";
            try{fl.b((byte)-124);}catch(RuntimeException e){status=fault(e);}
            System.out.println(status+" "+id(pe.T)+" "+h.a+" "+sf.m[0]+" "+ie.F+" "+pk.k+" "+g.n+" "+ef.J+" "+
                fl.i+" "+hc.j+" "+lk.u+" "+client.C+" "+qk.v.yb+" "+HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb));
        }
    }
    public static void main(String[] argv)throws Exception {
        if(argv.length>0){menu();return;}
        aj[] nodes={source,parent,target,alternate};
        for(int i=0;i<nodes.length;i++){nodes[i].Kc=65536+i;nodes[i].bc=900+i;nodes[i].n=65537;nodes[i].R=17;nodes[i].vb=0;}
        source.ad=new Object[]{9120,-2147483647,-2147483646,-2147483645,-2147483643,-2147483642,-2147483641};
        source.k=new Object[]{9121,-2147483647,-2147483646,-2147483645,-2147483643,-2147483642,-2147483641};
        alternate.k=source.k;script(9120,1300);script(9121,1310);alternate.Sc=new l(1<<18,-1);
        fk.ab=new aj[][]{null,nodes};rg.b=new boolean[]{false,true};vk.db=17;vb.o=0;
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=in.readLine())!=null;) {
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int mode=v[0],bytes=v[1],mouse=v[2];action=v[3];reads=0;
            qk.v=new be(bytes);if(mode!=5)qk.v.a(new int[]{1,3,7,11},-1);kh.A=new al(new Provider(),true,true);
            pe.T=mode==1?null:source;vf.Y=mode==2?null:parent;m.W=mode==3?null:target;
            source.Sc=mode==4?null:new l(mode==8?0:1<<18,-1);source.cd=parent;
            wg.d=mode!=6;bk.vc=true;ed.h=mode!=7;h.a=v[4];
            sj.C=v[5];pf.Q=v[6];ca.a=mouse;c.A=2;c.s=9;oe.s=17;oa.g=41;
            parent.C=v[7];parent.H=73;parent.hc=-13;parent.Ac=808;
            source.C=29;source.H=33;source.cc=5;source.Yb=2;source.vb=mode==9?1000:0;
            sg.c=23;kh.D=-3;sf.m[0]=false;
            Arrays.fill(od.U,1300,1320,-127);String fault="ok";
            try{fl.b((byte)-124);}catch(RuntimeException failure){
                fault=fault(failure);
            }
            System.out.println(fault+" "+id(pe.T)+" "+id(m.W)+" "+h.a+" "+ed.h+" "+sf.m[0]+" "+reads+" "+qk.v.yb+" "+
                HexFormat.of().formatHex(qk.v.fb)+" "+Arrays.toString(Arrays.copyOfRange(od.U,1300,1320)));
        }
    }
}
