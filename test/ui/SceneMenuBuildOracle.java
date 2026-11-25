import java.io.*;
import java.util.*;

final class SceneMenuBuildOracle {
    static id s(String value){return vb.a(value,(byte)60);}
    static long key(int kind,int id,int x,int z){return ((long)id<<32)|((long)kind<<29)|((z&127)<<7)|(x&127);}
    public static void main(String[] args)throws Exception{
        var reader=new BufferedReader(new InputStreamReader(System.in));
        pb local=new pb(),p1=new pb(),p2=new pb();
        local.Gc=s("self");p1.Gc=s("one");p2.Gc=s("two");jb.N=hh.bb=null;
        bk n1=new bk(),n2=new bk();ja def1=new ja(),def2=new ja();
        def1.r=s("npcOne");def2.r=s("npcTwo");def1.hb=def2.hb=true;
        def1.F=def2.F=new id[]{s("Talk"),s("Attack"),null,s("Tag"),s("Op4")};
        for(int i=0;i<8;i++){bk.ic[i]=i==1?s("Attack"):s("Option"+i);la.jb[i]=80+i;oe.A[i]=(i&1)!=0;}
        jb loc=new jb();loc.k=13;loc.r=s("bench");loc.kb=new id[]{s("Use"),null,s("Look"),null,s("Op4")};he.w.a(13L,loc,(byte)-71);
        nh.ab=s("Walk here");ce.D=151;aa.e=66;me.P=78;gl.C=77;t.W=s("Cast");ge.Z=s("object");al.s=s("spell");oh.a=-1;
        ra[][][] tiles=new ra[1][104][104];
        for(int x:new int[]{0,1,2,103})for(int z:new int[]{0,1,2,103}){tiles[0][x][z]=new ra(0,x,z);tiles[0][x][z].z=new hk();}
        aj widget=new aj();fk.ab=new aj[][]{{widget}};rg.b=new boolean[]{true};
        sj param=new sj();param.B=94;mg.c.a(68L,0,param);
        for(String line;(line=reader.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int kind=v[0],mode=v[1],damage=v[2],delta=v[3],coord=v[4],count=v[5];
            ak.a=new id[500];ph.e=new id[500];p.u=new short[500];ia.n=new int[500];mh.h=new int[500];ml.x=new int[500];sa.z=new long[500];
            vb.o=count;p.u[0]=57;
            te.g=damage==11?null:local;tf.J=new pb[]{null,damage==5?null:p1,damage==6?null:p2};uc.l=new bk[]{null,damage==7?null:n1,damage==8?null:n2};
            n1.mc=damage==9?null:def1;n2.mc=damage==10?null:def2;
            def1.M=1+(mode&1);def2.M=1;def1.y=(mode&16)!=0?45:0;def2.y=67;
            local.uc=90;local.zc=1;local.Bc=2;
            p1.uc=70;p1.qc=72;p1.zc=39;p1.Bc=(mode&1)!=0?1:2;p1.rc=(mode&2)!=0?122:0;
            p2.uc=92;p2.qc=95;p2.zc=2;p2.rc=0;p2.Bc=1;
            int center=0x2080+(def1.M==2?0:64);n1.Z=n1.S=center;n2.Z=center+delta;n2.S=center+delta;
            p1.Z=0x20c0;p1.S=0x20c0;p2.Z=p1.Z+delta;p2.S=p1.S+delta;p1.b(0,1+(mode&1));p2.b(0,1);
            fi.n=damage==12?null:damage==13?new int[]{1}:new int[]{1,damage==14?19:2};
            ad.h=damage==15?null:damage==16?new int[]{1}:new int[]{1,damage==17?-1:2};
            ed.d=fe.R=2;
            le.c=mode>>2&1;ok.r=(mode&8)!=0;pj.C=63;jl.c=mode>>1&1;kl.p=(mode&16)!=0;ie.F=false;
            gh.Y=damage==23?-1:0;qe.W=0;aa.e=66;
            if(damage==23||damage==24){ok.r=true;pj.C|=64;}
            oh.a=damage==25?68:damage==26?69:-1;
            if(damage==25||damage==26){le.c=0;ok.r=true;}
            ah.f=damage==22?1:0;kl.Bb=damage==21?null:tiles;
            long scenery=key(2,13,coord,coord);
            if(coord>=0&&coord<104)tiles[0][coord][coord].z.f=scenery;
            long pick=key(mode&3,1,coord,coord);
            if((mode&3)==2)pick=scenery;
            pf.W=damage==4?null:new long[]{-1L,pick,pick,scenery,scenery+(1L<<32),pick,key(1,2,coord,coord),key(0,2,coord,coord)};
            dd.r=damage==1?-1:damage==2?0:damage==3?9:8;
            oj.j=-321;vf.X=234;p.l=-156;fl.m=176;
            if(damage==20){oj.j=Integer.MAX_VALUE;fl.m=Integer.MIN_VALUE;}
            int width=damage==18?0:-73,height=damage==19?0:63;
            String fault="ok";
            try{
                if(kind==0)pg.a(32,delta,-127,width,height,delta,-45);
                if(kind==1)bj.a(coord,-coord,(byte)-112,21,n1.mc);
                if(kind==2)dg.a(-coord,coord,10455,2,damage==5?null:damage==7?te.g:p1);
            }catch(RuntimeException ex){
                Throwable e=ex;while(e instanceof g w&&w.a!=null)e=w.a;
                fault=e instanceof NullPointerException?"null":e instanceof IndexOutOfBoundsException?"bounds":e instanceof ArithmeticException?"divide":e.getClass().getSimpleName();
            }
            System.out.println(fault+" "+vb.o+" "+Arrays.hashCode(ak.a)+" "+Arrays.hashCode(ph.e)+" "+Arrays.hashCode(ia.n)+" "+Arrays.hashCode(p.u)+" "+Arrays.hashCode(sa.z)+" "+Arrays.hashCode(mh.h)+" "+Arrays.hashCode(ml.x)+" "+ok.r+" "+aa.e);
        }
    }
}
