import java.io.*;
import java.util.*;

class ClientStatePacketOracle extends WidgetPacketOracle {
    static String text(id value) { return value == null ? "-" : hex.formatHex(value.A,0,value.c); }

    public static void main(String[] args) throws Exception {
        var input=new BufferedReader(new InputStreamReader(System.in));
        id seed=aj.a("seed",(byte)-100);
        ff.P=aj.a("walk",(byte)-100);
        m script=new m();script.D=new int[]{33,43,33,43,35,48,35,48,21};
        script.F=new int[]{0,300,1,301,0,300,1,301,0};script.B=new id[9];script.E=2;script.I=2;
        sf.g.a(85901L,0,script);
        for(int i=0;i<3;i++){bb type=new bb();type.d=i==1?0:9;vf.S.a((long)i,type,(byte)-71);}
        og bit=new og();bit.j=1;bit.d=2;bit.i=5;cd.d.a(8L,bit,(byte)-71);
        for(String line;(line=input.readLine())!=null;) {
            String[] fields=line.split(" ",-1);
            int op=Integer.parseInt(fields[0]),mode=Integer.parseInt(fields[1]);
            bind(op,Integer.parseInt(fields[2]),hex.parseHex(fields[3]));
            Arrays.fill(vj.d,0);Arrays.fill(oc.c,0);
            oc.c[0]=18;vj.d[1]=431;oc.c[1]=77;if((mode&1)!=0)oc.c[3]=912;
            Arrays.fill(ii.c,11);qg.B=Integer.MAX_VALUE-1;gg.y=(mode&1)!=0?4:3;
            db.p=new nc(16);ff.q=91;wf.b(true);
            Arrays.fill(ld.d,53);od.V=Integer.MAX_VALUE;
            Arrays.fill(ll.m, 19);Arrays.fill(wa.o,88);Arrays.fill(di.i,3);
            va.Z=new nc(8);
            od.U[300]=od.U[301]=367;me.a[300]=me.a[301]=seed;
            Arrays.fill(bk.ic,seed);Arrays.fill(la.jb,925);Arrays.fill(oe.A,false);
            ki.R=111;nh.ab=seed;Arrays.fill(ve.t,null);wa.a=(mode&1)!=0?null:new vc[2];
            if ((mode&2)!=0) ve.t[0]=new kf();
            String outcome;
            try { outcome=String.valueOf(rg.a((byte)57)); }
            catch(RuntimeException ex) {
                Throwable e=ex;while(e instanceof g wrapped && wrapped.a!=null)e=wrapped.a;
                outcome=e instanceof IndexOutOfBoundsException?"bounds":e instanceof NullPointerException?"null":e.getClass().getName();
            }
            StringJoiner options=new StringJoiner(","),arrows=new StringJoiner(",");
            for(int i=0;i<8;i++)options.add(text(bk.ic[i])+":"+la.jb[i]+":"+oe.A[i]);
            for(kf a:ve.t)arrows.add(a==null?"-":a.a+":"+a.e+":"+a.h+":"+a.i+":"+a.j+":"+a.k+":"+a.m+":"+a.o+":"+a.r);
            System.out.println(outcome+";"+hd.b.yb+";"+o.Y+";"+jd.i+";"+qc.Z+";"+od.U[300]+";"+od.U[301]+";"+text(me.a[300])+";"+text(me.a[301])+
                ";"+Arrays.hashCode(vj.d)+";"+Arrays.hashCode(oc.c)+";"+qg.B+";"+Arrays.hashCode(ii.c)+";"+db.p.d((byte)-107)+";"+ff.q+
                ";"+Arrays.hashCode(ll.m)+";"+Arrays.hashCode(wa.o)+";"+Arrays.hashCode(di.i)+";"+od.V+";"+Arrays.hashCode(ld.d)+
                ";"+ki.R+";"+text(nh.ab)+";"+options+";"+arrows);
        }
    }
}
