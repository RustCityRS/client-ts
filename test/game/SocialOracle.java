import java.io.*;
import java.util.*;

class SocialOracle {
    static int texts(id[] words){
        int hash=1;for(id w:words)hash=31*hash+(w==null?0:Arrays.hashCode(w.b(false)));return hash;
    }
    static String snapshot(){
        int clan=1;
        if(jl.b==null)clan=0;
        else for(rf member:jl.b){
            clan=31*clan+(member==null?0:1);
            if(member!=null){clan=31*clan+Long.hashCode(member.k);clan=31*clan+member.r;clan=31*clan+member.z;clan=31*clan+texts(new id[]{member.t,member.w});}
        }
        return String.join("|",Arrays.toString(new int[]{ei.u,sj.L,n.h,uh.N,ve.r,mh.g,ve.m,si.e,nk.gb,sd.V,uc.b,qe.N,sb.c,mf.l}),
            ""+Arrays.hashCode(jd.m),""+texts(ck.p),""+Arrays.hashCode(jf.b),""+texts(pa.qb),""+Arrays.hashCode(sf.e),""+Arrays.hashCode(m.L),
            ""+Arrays.hashCode(pi.r),""+texts(na.y),""+clan,""+texts(new id[]{dk.P,hg.g}),""+Arrays.hashCode(de.t),""+texts(m.T),""+texts(ui.q),""+texts(ma.j),""+Arrays.hashCode(jg.z));
    }
    public static void main(String[] args)throws Exception{
        te.g=new pb();te.g.Gc=vb.a("Alice",(byte)100);si.h=te.g.Gc.b((byte)-16);qj.C=530;
        qk.v.a(new int[]{1,2,3,4},0);da.e=42;
        var input=new BufferedReader(new InputStreamReader(System.in));
        pb player=te.g;
        id[] worldNames=pa.qb;
        int[] ranks=sf.e;
        id nameCrown=q.f,staffCrown=lj.a;
        for(String line;(line=input.readLine())!=null;){
            String[] p=line.split(" ",-1);
            String answer="";
            switch(p[0]){
                case "self":te.g=p[1].equals("missing")?null:player;break;
                case "crowns":
                    q.f=p[1].equals("first")?null:nameCrown;
                    lj.a=p[1].equals("second")?null:staffCrown;
                    break;
                case "worldNames":pa.qb=p[1].equals("short")?new id[0]:worldNames;break;
                case "sortEdge":
                    if(p[1].equals("prepare")){
                        sj.L=2;jd.m[0]=vb.a("Before",(byte)100).b((byte)-16);
                        jd.m[1]=vb.a("Next",(byte)100).b((byte)-16);
                        ck.p[0]=mi.a((byte)-72,jd.m[0]).b(0);ck.p[1]=mi.a((byte)-72,jd.m[1]).b(0);
                        jf.b[0]=17;jf.b[1]=qj.C;
                        sf.e=new int[]{19};
                    }else{
                        sf.e=ranks;
                        sj.L=0;
                    }
                    break;
                case "tick":bb.e++;break;
                case "area":se.x=ChatOracle.num(p[1]);break;
                case "member":da.d=ChatOracle.num(p[1])!=0;break;
                case "language":hl.w=ChatOracle.num(p[1]);ii.a((byte)127,hl.w);break;
                case "recv":
                    try { ChatOracle.receive(ChatOracle.num(p[1]), ChatOracle.bytes(p[2])); answer="true"; }
                    catch (RuntimeException failure) { answer="exception"; }
                    answer+="|"+hd.b.yb+"|"+o.Y;
                    break;
                case "script":answer=ChatOracle.run(p,true);break;
                case "add":
                    jd.a(ChatOracle.num(p[1]),p[2].equals("-")?null:ChatOracle.word(p[2]),p[3].equals("-")?null:ChatOracle.word(p[3]),ChatOracle.num(p[4]),-1,p[5].equals("-")?null:ChatOracle.word(p[5]));break;
            }
            System.out.println(answer+"#"+snapshot());
        }
    }
}
