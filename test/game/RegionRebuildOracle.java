import java.awt.Canvas;
import java.io.*;
import java.util.*;

class RegionRebuildOracle {
    static final int[] npcSlots={7,12,19,31000};
    static final bk[] npcs=new bk[4];
    static gh area;
    static void locate(ob a,int x,int z){
        a.Z=x;a.S=z;a.F=3;
        for(int j=0;j<10;j++){a.L[j]=(x>>7)-j;a.ac[j]=(z>>7)+j;}
    }
    static void mark(){
        ag.l=19;gk.j=3;cl.e=5;
        o.S=38;qf.c=45;vc.R=54;t.Z=60;rk.m=1512;ud.g=-372;
        gl.z=43;ic.T=0;ug.d=new kc(0);
        cg.f.a(new tf(null),false);ph.g.a(new qg(null),false);
    }
    static void snapshot(){
        StringJoiner s=new StringJoiner(" ");
        for(int n:new int[]{vg.kb,tf.C,ic.V,ah.k,sb.h,hk.e,vj.t,ah.f,ag.l,gk.j,cl.e,o.S,qf.c,vc.R,t.Z,rk.m,ud.g,gl.z,ic.T,
            jh.k==area?1:0,ug.d==null?0:1,cg.f.d(0)==null?0:1,ph.g.d(0)==null?0:1,ed.d})s.add(""+n);
        for(int i=0;i<ed.d;i++)s.add(""+fi.n[i]);
        for(int i=0;i<npcs.length;i++){s.add(uc.l[npcSlots[i]]==null?"0":"1");s.add(npcs[i].mc==null?"0":"1");}
        for(ob entity:new ob[]{npcs[0],npcs[1],npcs[2],npcs[3],tf.J[23],te.g}){
            for(int n:new int[]{entity.Z,entity.S,entity.F,Arrays.hashCode(entity.L),Arrays.hashCode(entity.ac)})s.add(""+n);
        }
        for(int p=0;p<4;p++)for(int x=0;x<104;x++)for(int z=0;z<104;z++)if(b.H[p][x][z]!=null){
            s.add(""+p);s.add(""+x);s.add(""+z);s.add(""+((b)b.H[p][x][z].d(0)).T.m);
        }
        s.add("-444");
        for(ff f=(ff)wh.S.d(0);f!=null;f=(ff)wh.S.a(0)){s.add(""+f.w);s.add(""+f.N);s.add(""+f.L);}
        System.out.println(s);
    }
    public static void main(String[] args)throws Exception{
        wj.g=new fg(new byte[257],new int[256],new int[256],new int[256],new int[256],new byte[256][0]);
        qd.s=vb.a("",(byte)54);pe.S=new Canvas();
        ba.d=new gk();
        area=new gh(null,null,0,0,0,true,1);area.U.a(new ie(45,46,70,75),false);area.c(0);ba.d.a(area,false);
        te.g=tf.J[2047]=new pb();locate(te.g,4480,4992);
        tf.J[23]=new pb();locate(tf.J[23],7800,2100);
        int[] xs={1024,14208,1023,14209}, zs={2048,15232,2048,2048};
        for(int i=0;i<npcs.length;i++){npcs[i]=uc.l[npcSlots[i]]=new bk();npcs[i].mc=new ja();locate(npcs[i],xs[i],zs[i]);}
        ed.d=1;fi.n[0]=12;
        wh.S=new gk();b.H=new gk[4][104][104];
        for(int i=0;i<9;i++){
            int x=i*10+4,z=i*8+1,plane=i%4;
            ff f=new ff();f.w=x;f.N=z;f.L=90+i;wh.S.a(f,false);
            ig obj=new ig();obj.m=560+i;
            b.H[plane][x][z]=new gk();b.H[plane][x][z].a(new b(obj),false);
        }
        BufferedReader reader=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=reader.readLine())!=null;){
            String[] f=line.split(" ");int[] n=Arrays.stream(f,1,f.length).mapToInt(Integer::parseInt).toArray();
            switch(f[0]){
                case "mark":mark();break;
                case "visible":rj.l=n[0]!=0;break;
                case "dest":gl.z=n[0];ic.T=n[1];break;
                case "build":
                    tf.C=n[5]==0?25:28;
                    bj.a(n[0],n[1],n[2],0,n[3],n[4],n[5]!=0);
                    break;
                default:throw new AssertionError(line);
            }
            snapshot();
        }
    }
}
