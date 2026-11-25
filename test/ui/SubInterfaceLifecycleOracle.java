import java.nio.file.*;
import java.util.*;

class SubInterfaceLifecycleOracle {
    static final int A=20,B=21,ID=A<<16,SCRIPT=193000;
    static final short[][] OPS={{1002},{1002,46,6,1001,57},{46,46,46,46},{57,57,57,57},{1001,57,1001,57}};
    static aj widget(int id,int type,int root,int marker){
        aj c=new aj();c.Kc=id;c.ob=type;c.R=23;c.vb=root;c.Sb=30+root;c.Hc=40+root;c.Q=50+root;
        c.ac=new Object[]{SCRIPT,marker};return c;
    }
    static int digest(aj c){return c.Q*10000+c.Sb*100+c.Hc;}
    static String label(id s){return s==null?"~":HexFormat.of().formatHex(s.A,0,s.c);}
    public static void main(String[] args)throws Exception{
        al archive=new al(new SubInterfaceOracle.Provider(Files.readAllBytes(Path.of(args[0]))),false,true);
        fk.ab=new aj[archive.b(21296)][];rg.b=new boolean[fk.ab.length];
        byte[] metrics=new byte[257];Arrays.fill(metrics,(byte)7);fg font=new fg(metrics);
        m script=new m();script.D=new int[]{42,0,4002,33,4000,43,21};script.F=new int[]{0,10,0,0,0,0,0};
        script.B=new id[7];script.E=1;sf.g.a((long)SCRIPT,0,script);
        final long k1=(long)B<<48,k2=((long)(B+1)<<48)-1,k3=(long)A<<48,k4=-1;
        for(int i=0;i<400;i++){
            int mode=i%5,fault=i/5%16,group=fault==8?fk.ab.length:B,parent=fault==12?ID+2:ID;
            aj host=widget(ID,0,0,2),pressed=widget(ID+1,3,1,4),first=widget(B<<16,2,2,6),last=widget((B<<16)+1,3,3,8);
            first.Lb=new Object[]{SCRIPT,1};last.Lb=new Object[]{SCRIPT,3};ca.g=pressed;
            fk.ab[A]=new aj[]{host,pressed};fk.ab[B]=new aj[]{first,last};rg.b[A]=rg.b[B]=true;
            kh.A=archive;hd.m=A;vk.db=23;ik.G=1;nh.Y[0]=r.U[0]=0;gk.i[0]=ik.Q[0]=100;
            fl.i=hc.j=4;lk.u=50;client.C=80;hi.f=765;fl.l=503;
            Arrays.fill(sf.m,false);od.U[0]=0;
            va.Z=new nc(8);fd.W=new nc(8);for(long key:new long[]{k1,k2,k3,k4})fd.W.a((byte)-89,new l(1,2),key);
            qd sub=new qd();sub.v=group;sub.q=1;if(mode==1||mode==2)va.Z.a((byte)-89,sub,(long)parent);
            short[] ops=OPS[i/80];vb.o=ops.length;ie.F=true;ec.g=(i&1)!=0;uf.b=font;
            for(int j=0;j<500;j++){
                ak.a[j]=vb.a("Op"+(j%6),(byte)54);ph.e[j]=j%2==0?ga.J:vb.a("<col=ff0000>Item"+(j%6),(byte)54);
                p.u[j]=j<ops.length?ops[j]:(short)57;mh.h[j]=ia.n[j]=j;ml.x[j]=j+11;sa.z[j]=100L+j;
            }
            switch(fault){
                case 1->uf.b=null;case 2->host.vb=100;case 3->pressed.vb=100;case 4->fk.ab[B]=null;
                case 5->{rg.b[B]=false;kh.A=null;} case 6->fk.ab[B][1]=null;case 7->hd.m=-1;
                case 9->ph.e[0]=null;case 10->{if(mode==4)group=65535;}case 11->ik.G=101;
                case 13->vb.o=501;case 14->{first.ob=last.ob=2;}case 15->{if(mode==4)group=-1;}
            }
            boolean failed=false;try{
                if(mode==0)sub=ti.a(1,group,parent,(byte)109);
                else if(mode==1||mode==2)ok.a(sub,mode==2,15361);
                else if(mode==3)bb.a(group,0);else rj.a(group,111);
            }catch(RuntimeException e){failed=true;}
            StringJoiner s=new StringJoiner("/");
            s.add(""+failed).add(""+(va.Z.a((byte)-85,(long)parent)!=null)).add(""+(ca.g!=null)).add(""+rg.b[B]);
            aj[] stored=fk.ab[B];s.add(stored==null?"~":(stored[0]!=null)+","+(stored[1]!=null));
            s.add(digest(first)+","+digest(last)).add(""+od.U[0]).add(Arrays.toString(Arrays.copyOf(sf.m,4)));
            for(long key:new long[]{k1,k2,k3,k4})s.add(""+(fd.W.a((byte)-85,key)!=null));
            s.add(vb.o+","+ie.F+","+lk.u+","+client.C);
            for(int j=0;j<6;j++)s.add(label(ak.a[j])+","+label(ph.e[j])+","+p.u[j]+","+ia.n[j]+","+mh.h[j]+","+ml.x[j]+","+sa.z[j]);
            System.out.println(s);
        }
    }
}
