import java.io.*;
import java.util.*;

public class WidgetAnimationOracle {
    static aj[] widgets=new aj[8];
    static final int base=28000;
    static void setup(){
        rg.b=new boolean[]{true,true};
        fk.ab=new aj[2][];
        int[] parents={-1,0,0,77,0,4,-1,6};
        for(int i=0;i<8;i++){
            aj c=widgets[i]=new aj();c.n=parents[i];c.Kc=i;c.ob=(i==0||i==2||i==4||i==6)?0:6;
            c.R=2;c.vb=i;c.nd=100+i;c.d=200+i;c.Hc=i-3;
        }
        fk.ab[0]=new aj[]{widgets[0],null,widgets[1],widgets[2],widgets[3]};fk.ab[1]=new aj[]{widgets[6],widgets[7]};
        widgets[0].pb=new aj[]{widgets[4],widgets[5]};
        va.Z=new nc(8);qd sub=new qd();sub.v=1;va.Z.a((byte)-89,sub,2L);
        fd.W=new nc(512);vk.db=2;te.g=new pb();fe.R=0;
        ga.B=new ve(64);
        for(int i=0;i<4;i++){
            ek s=new ek();s.f=base+i;s.F=new int[]{1+i,1,3+i};s.g=new int[]{910,911,912};s.G=new int[]{0,1,-1,5}[i];
            ga.B.a((long)s.f,s,(byte)-71);
        }
    }
    public static void main(String[] args)throws Exception{
        setup();BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String row;(row=in.readLine())!=null;){
            String[] fields=row.split(" ");int n=Integer.parseInt(fields[0]);id.p=Integer.parseInt(fields[1]);
            if(n>=120){
                int mode=(n-120)%8;
                aj c=new aj();c.n=-1;c.ob=6;c.jc=base+4;c.qd=-1;c.R=2;c.vb=mode==6?100:0;c.Hc=2;
                c.Sb=mode==4?-1:0;c.Q=66;c.P=0x8000ffff;
                aj other=new aj();other.n=-1;other.ob=6;other.P=0x004a0031;other.R=2;other.vb=1;
                fk.ab[0]=new aj[]{c,other};sf.m=new boolean[100];uc.c=false;
                ek s=new ek();s.f=base+4;s.G=mode==7?Integer.MIN_VALUE:0;
                s.g=mode==0?null:mode==1?new int[0]:new int[]{4,8};
                s.F=mode==2?null:mode==3?new int[0]:mode==5?new int[]{3}:new int[]{3,5};
                ga.B.a((long)s.f,s,(byte)-71);
                String fault="ok";
                try{g.a(4,0);}catch(RuntimeException e){
                    Throwable cause=e;while(cause instanceof g)cause=((g)cause).a;
                    fault=cause instanceof IndexOutOfBoundsException?"bounds":cause instanceof NullPointerException?"null":cause.getClass().getSimpleName();
                }
                System.out.println(fault+" "+c.Sb+" "+c.Q+" "+c.Hc+" "+c.nd+" "+c.d+" "+other.nd+" "+other.d+" "+sf.m[0]+" "+sf.m[1]);
                continue;
            }
            uc.c=(n%5)==0;di.g=widgets[(n%3)*2];sf.m=new boolean[100];
            for(int i=0;i<widgets.length;i++){
                aj c=widgets[i];c.y=(n+i)%3==0;c.Wc=(n+2*i)%7==0;c.Sc=new l((n+i)%2,-1);
                c.jc=base+((n+i)&3);c.qd=(i&1)==0?-1:base+((n^i)&3);
                c.bd=(n+i)%4==0?new int[0]:null;
                c.P=(n+i)*0xf3130751;c.R=(i+n)%9==0?3:2;
                if((n%12)==0)c.Hc=Integer.MAX_VALUE-i;
                if((n%12)==1)c.Hc=0;
            }
            g.a(4,0);
            te.g.Z=n*59107;te.g.S=-n*61;gl.z=(te.g.Z>>7)+(n%2);ic.T=(te.g.S>>7)+(n%3);
            th.a(121,false);
            StringJoiner out=new StringJoiner("|");
            for(aj c:widgets)out.add(c.Sb+","+c.Q+","+c.Hc+","+c.nd+","+c.d+","+sf.m[c.vb]);
            System.out.println(out+"|"+gl.z+","+ic.T);
        }
    }
}
