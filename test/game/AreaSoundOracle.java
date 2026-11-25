import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class AreaSoundOracle{
    static jb loc=new jb();static bk npc=new bk();static pb player=new pb();static int[] ids;
    static String state(ik s){
        return Arrays.toString(new int[]{s.t,s.u,s.v,s.A,s.B,s.C,s.E,s.K,s.L,s.M,s.N,s.y?1:0,Arrays.hashCode(s.q),s.z==null?-1:s.z.j(),s.J==null?-1:s.J.j()});
    }
    public static void main(String[] args)throws Exception{
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        rg.m=new al(new ChatOracle.Source(in.readLine()),false,true);ids=Arrays.stream(in.readLine().split(" ")).mapToInt(Integer::parseInt).toArray();
        Field rng=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");rng.setAccessible(true);((Random)rng.get(null)).setSeed(55031);
        db.v=false;mj.e=22050;dd.u=83;o.P=new cj();ba.f=new hd(22050,22050);ah.f=1;
        loc.k=500;loc.fb=2;loc.y=3;loc.pb=4;loc.E=ids[0];loc.mb=new int[]{ids[1],ids[2]};loc.c=1;loc.ib=9;
        jb multi=new jb();multi.k=501;multi.pb=6;multi.E=ids[3];multi.c=2;multi.ib=6;multi.mb=new int[]{ids[2]};
        he.w.a(501L,multi,(byte)-71);
        ja base=new ja();base.a=ids[0];base.T=ids[1];base.lb=ids[2];base.mb=ids[3];base.M=2;base.B=3;
        ja other=new ja();other.a=ids[3];other.T=ids[2];other.lb=ids[1];other.mb=ids[0];other.B=8;other.M=3;
        gf.Z.a(601L,other,(byte)-71);npc.mc=base;npc.U=21;npc.b(0,2);npc.Z=1320;npc.S=1600;npc.M=22;
        mg bas=new mg();bas.C=22;bas.z=24;bas.R=25;bas.v=26;ig.n.a(21L,bas,(byte)-71);
        player.U=21;player.b(0,3);player.M=24;player.Gc=vb.a("Test_name",(byte)4);player.ic=4;
        player.Lc=ids[3];player.mc=ids[2];player.Ec=ids[1];player.vc=ids[0];
        player.Z=1355;player.S=1500;player.L[0]=11;player.ac[0]=13;
        for(String line;(line=in.readLine())!=null;){
            String[] f=line.split(" ");int[] n=new int[6];for(int i=1;i<f.length;i++)n[i]=Integer.parseInt(f[i]);
            String action=f[0];int pcm=0;switch(action){
                case "loc":da.a(13,loc,128,1,null,10,null,n[1]);break;
                case "multi":{loc.e=new int[]{501,-1};npc.mc.J=new int[]{601,-1};
                    Field varp=jb.class.getDeclaredField("lb");varp.setAccessible(true);varp.setInt(loc,7);
                    varp=ja.class.getDeclaredField("H");varp.setAccessible(true);varp.setInt(npc.mc,7);break;}
                case "npc":da.a(13,null,128,1,null,10,npc,0);break;
                case "player":sf.a(player,false);break;
                case "anim":npc.M=n[1];player.M=n[2];break;
                case "var":vj.d[7]=n[1];wh.f(17819);break;
                case "vol":dd.u=n[1];break;
                case "plane":ah.f=n[1];break;
                case "rad":player.ic=n[1];player.Ec=ids[n[2]];sf.a(player,false);break;
                case "tick":tk.a((byte)101,ah.f,n[1],n[2],n[3]);break;
                case "mix":{int[] b=new int[n[1]];o.P.b(b,0,b.length);pcm=Arrays.hashCode(b);break;}
                case "rmloc":fa.a(1,13,-110,10,loc);break;
                case "rmnpc":sg.a(58,npc);break;
                case "rmplayer":v.a(false,player);break;
                case "clear":oh.a(n[1]!=0,24077);break;
            }
            StringBuilder s=new StringBuilder().append(pcm);
            for(gk list:new gk[]{nc.j,ik.s})for(ik a=(ik)list.d(0);a!=null;a=(ik)list.a(0))s.append('|').append(state(a));
            for(ik a=(ik)jk.A.c((byte)36);a!=null;a=(ik)jk.A.a(11))s.append('|').append(state(a));System.out.println(s);
        }
    }
}
