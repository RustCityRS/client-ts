import java.io.*;
import java.util.*;

class InterfaceInputOracle {
    static final aj[] all = new aj[14];
    static final String[] hooks={"Gc","pc","g","W","Tc","Pb","V","J","Pc","x","K","nb","N","ad","k"};
    static void widget(String line) throws Exception {
        String[] fields=line.split(",");
        int[] v=Arrays.stream(fields).mapToInt(Integer::parseInt).toArray();
        int slot=v[0];
        aj c=all[slot]=new aj();
        c.Kc=v[1]; c.n=v[2]; c.ob=v[3]; c.y=(v[4]&1)!=0; c.i=(v[4]&2)!=0;
        c.Wc=(v[4]&4)!=0; c.hd=(v[4]&8)!=0; c.ib=v[5]; c.Mb=v[6]; c.C=v[7]; c.H=v[8];
        c.hc=v[9]; c.Ac=v[10]; c.jb=v[11]; c.wc=v[12]; c.Sc=new l(v[13],-1); c.Hb=v[14];
        c.bc=v[15]; c.R=9; c.vb=slot; c.cc=2; c.Yb=1;
        for(int i=0;i<hooks.length;i++) {
            Object[] args={9001,slot*20+i,-2147483647,-2147483646,-2147483642,-2147483641,-2147483644};
            aj.class.getDeclaredField(hooks[i]).set(c,args);
        }
    }
    static int index(aj c){return c==null ? -1 : Arrays.asList(all).indexOf(c);}
    static String events(gk q){
        StringJoiner rows=new StringJoiner(";");
        for(wf e=(wf)q.a(true);e!=null;e=(wf)q.a(true)) rows.add(e.G[1]+","+index(e.C)+","+e.D+","+e.K+","+e.x+","+e.E+","+(e.v?1:0));
        return rows.toString();
    }
    public static void main(String[] args) throws Exception {
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(int i=0;i<all.length;i++)widget(in.readLine());
        fk.ab=new aj[][]{Arrays.copyOf(all,11),{all[12],all[13]}}; rg.b=new boolean[]{true,true};
        all[0].pb=new aj[]{all[11]};
        qd sub=new qd();sub.v=1;sub.q=0;va.Z.a((byte)-47,sub,all[7].Kc);
        all[1].Qc=new byte[]{16,17,18};
        all[1].dd=new byte[]{0,3,4};all[1].Ib=new int[]{0,2,3};
        m script=new m();
        ArrayList<Integer> ops=new ArrayList<>(),vals=new ArrayList<>();
        ops.add(42);vals.add(2);
        for(int local=0;local<6;local++) {
            ops.add(0);vals.add(31);ops.add(4002);vals.add(0);ops.add(33);vals.add(local);ops.add(4000);vals.add(0);
        }
        ops.add(43);vals.add(2);ops.add(21);vals.add(0);
        script.D=ops.stream().mapToInt(x->x).toArray();script.F=vals.stream().mapToInt(x->x).toArray();script.B=new id[ops.size()];script.E=6;sf.g.a(9001L,0,script);
        vk.db=9;vb.o=0;od.U[2]=0; qk.v.a(new int[]{0,3,5,8},-1);
        qa.P=mf.q=ck.I=sc.W=0;kg.l[0]=new int[4][3];ga.A=mg.e=1;
        String row;
        while((row=in.readLine())!=null) {
            int[] v=Arrays.stream(row.split(",")).mapToInt(Integer::parseInt).toArray();
            hh.kb=v[0];sj.C=v[1];pf.Q=v[2];ca.a=v[3];oi.h=v[4];sa.x=v[5];oj.e=v[6];kf.l=v[7];ie.F=v[8]!=0;uc.c=v[9]!=0;
            all[2].Wc=v[10]!=0;ec.e=v[11]!=0?all[1]:null;sb.e=v[12];se.d=v[13]==0?3:65534;qh.e=false;kf.a(1);pi.p=v[14];bb.e=v[0]+1;
            Arrays.fill(ob.q,false);int[] codes={16,17,18,81,82,86};for(int i=0;i<codes.length;i++)ob.q[codes[i]]=(v[15]&(1<<i))!=0;
            ok.D=2;sc.T[0]=48;hd.i[0]=-1;sc.T[1]=-1;hd.i[1]=65;
            m.W=null;wg.d=bk.vc=false;di.g=gh.C=null;Arrays.fill(sf.m,false);
            int pos=qk.v.yb;
            dd.a(120,0,160,0,(byte)-40,0,0,0);
            StringBuilder sample=new StringBuilder(events(db.s)+"|"+events(ra.r)+"|"+events(mi.q));
            if(pe.T!=null) fl.b((byte)-124);
            int[] state={index(pe.T),index(vf.Y),index(m.W),wg.d?1:0,bk.vc?1:0,sg.c,kh.D,oe.s,oa.g,c.A,c.s,h.a,ed.h?1:0,index(di.g),index(gh.C),aj.sb?1:0,gf.eb,a.e,ca.n,sb.e,index(bh.l),od.U[2]};
            sample.append("|").append(Arrays.toString(state));
            sample.append("|").append(Arrays.toString(all[1].z)).append("|").append(HexFormat.of().formatHex(qk.v.fb,pos,qk.v.yb));
            for(aj w:all) sample.append("|").append(w.Fc?1:0).append(",").append(w.Xc?1:0).append(",").append(w.Ac).append(",").append(w.Mc).append(",").append(sf.m[w.vb]?1:0);
            System.out.println(sample);
        }
    }
}
