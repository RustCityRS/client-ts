import java.util.*;

class LoopLayerOracle {
    static aj hot,next;
    static int action,reads;
    static final class Provider extends ud {
        db b(int dummy) {
            if (++reads==1) mutate();
            return null;
        }
        byte[] a(int dummy,int group){throw new AssertionError();}
        void b(int dummy,int group){throw new AssertionError();}
        int c(int group,int dummy){throw new AssertionError();}
    }
    static void mutate(){
        switch(action){
            case 1: sj.C=-700;pf.Q=700;sa.x=-51;oj.e=100;ca.a=oi.h=0;break;
            case 2: ie.F=true;break;
            case 3: hot.Ib=null;break;
            case 4: hot.wc=205;break;
            case 5: hot.Sc=null;break;
            case 6: ob.q[11]=false;break;
            case 7: fk.ab[1][1]=null;break;
            case 8: hot.Qc=null;break;
            case 9: ok.D=129;break;
        }
    }
    static int number(int hash,int value){return 31*hash+value;}
    static String queue(gk list){
        int hash=1,n=0;
        for(wf e=(wf)list.a(true);e!=null;e=(wf)list.a(true)){
            for(int v:new int[]{(Integer)e.G[0],e.C.Kc,e.D,e.K,e.x,e.E,e.v?1:0}) hash=number(hash,v);
            n++;
        }
        return n+","+hash;
    }
    static aj widget(int index){
        aj c=new aj();c.Kc=65536+index;c.n=-1;c.bc=-1;c.ob=3;c.y=c.i=true;
        c.ib=0;c.Mb=0;c.C=55;c.H=39;c.Sc=new l(6,-1);
        c.Gc=new Object[]{31};c.pc=new Object[]{32};c.J=new Object[]{33};c.Tc=new Object[]{34};c.x=new Object[]{35};
        return c;
    }
    public static void main(String[] args) {
        m script=new m();script.E=1;script.D=new int[]{33,43,0,201,21};script.F=new int[]{0,1500,0,0,0};script.B=new id[5];
        sf.g.a(9131L,0,script);
        for(int i=0;i<300;i++){
            hot=widget(0);next=widget(1);hot.N=new Object[]{9131,-2147483644};reads=0;action=i%10;
            int mode=i/10%15;
            hot.Qc=mode==1?new byte[]{-1}:new byte[]{10,11};hot.dd=mode==2?null:new byte[]{0,0};
            hot.Ib=mode==3?new int[]{7}:new int[]{7,0};hot.z=mode==4?new int[0]:null;
            if(mode==5)hot.N=null;if(mode==6)hot.wc=205;if(mode==7)hot.wc=7;
            hot.Sc=mode==8?null:new l(6,-1);
            if(mode==9)hot.x=null;
            if(mode==10){hot.y=false;hot.Hb=2;}
            fk.ab=new aj[][]{null,new aj[]{hot,next}};rg.b=mode==11?new boolean[0]:new boolean[]{false,true};
            if(mode==12)fk.ab[1]=null;
            kh.A=new al(new Provider(),true,true);qk.v=new be(mode==13?3:32);
            if(mode!=14)qk.v.a(new int[]{1,2,5,8},-1);
            pe.T=vf.Y=m.W=null;sj.C=5;pf.Q=6;sa.x=9;oj.e=11;ca.a=oi.h=1;ie.F=false;ec.e=null;
            ob.q[10]=true;ob.q[11]=i>=150;ok.D=2;sc.T[0]=7;sc.T[1]=12;hd.i[0]=24;hd.i[1]=67;
            hh.kb=8;bb.e=17;od.U[1500]=-455;ia.l=-22;sb.e=0;di.g=null;
            String fault="ok";
            try{dd.a(67,2,89,4,(byte)-40,1,-7,-9);}catch(RuntimeException e){
                Throwable err=e;while(err instanceof g)err=((g)err).a;
                fault=err instanceof IndexOutOfBoundsException?"bounds":err instanceof NullPointerException?"null":err.getClass().getSimpleName();
            }
            System.out.println(fault+" "+reads+" "+od.U[1500]+" "+ia.l+" "+Arrays.toString(hot.z)+" "+hot.Fc+" "+hot.Xc+
                " "+hot.Mc+" "+next.Mc+" "+(di.g==null?-1:di.g.Kc)+" "+qk.v.yb+" "+HexFormat.of().formatHex(qk.v.fb)+
                " "+queue(db.s)+" "+queue(ra.r)+" "+queue(mi.q));
        }
    }
}
