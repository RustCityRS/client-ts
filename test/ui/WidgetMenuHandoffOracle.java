import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

// lf.a visits fixed children, created children and mounted interfaces before returning to its caller.
// The original sf.a resolves the inventory slot and writes the action rows.
class WidgetMenuHandoffOracle {
    static aj widget(int id, int parent, int type, int x, int y, int w, int h, boolean buttons) {
        aj c = new aj();
        c.Kc=id; c.n=parent; c.ob=type; c.ib=x; c.Mb=y; c.C=w; c.H=h;
        c.f=buttons ? 1 : 0; c.fc=vb.a("W"+id,(byte)60);
        return c;
    }

    static String run(int flags, int x, int y, int fault) {
        boolean buttons=fault==0;
        aj back=widget(3,-1,3,0,0,90,65,buttons);
        aj parent=widget(10,-1,0,6,4,68,53,buttons);
        parent.hc=5; parent.Ac=7; parent.jb=74; parent.y=(flags&16)!=0;
        parent.hd=(flags&1)!=0; parent.Wc=(flags&32)!=0;
        aj fixed=widget(11,10,3,5,7,40,36,buttons);
        aj inv=widget(12,10,2,6,9,64,32,buttons);
        inv.G=2; inv.M=1; inv.yb=new int[20]; inv.Gb=new int[20]; inv.Zb=new int[2];
        parent.pb=new aj[]{null,inv};
        aj mount=widget(65536,-1,3,1,3,18,20,buttons);
        aj tip=widget(13,-1,3,2,3,64,54,buttons); tip.wc=1406;
        aj[] top={back,parent,null,fixed,tip};
        fk.ab=new aj[][]{top,new aj[]{mount}}; rg.b=new boolean[]{true,true}; va.Z=new nc(8);
        if((flags&2)!=0){qd sub=new qd(); sub.q=(flags&4)!=0?1:0; sub.v=1; va.Z.a((byte)-89,sub,10L);}
        uc.c=(flags&8)!=0; ie.F=(flags&64)!=0; ve.g=x; ud.j=y;
        ia.n=new int[fault==1?0:64]; p.u=new short[fault==2?0:64];
        ak.a=new id[fault==3?0:64]; ph.e=new id[fault==4?0:64]; mh.h=new int[64]; ml.x=new int[64]; sa.z=new long[64];
        Arrays.fill(ia.n,-3); Arrays.fill(p.u,(short)19);
        vb.o=2; aa.e=45; ik.G=0; hh.kb=7; ml.T=0; n.i=new boolean[10];
        nk.V=hg.f=null; oj.i=-7; fd.Z=li.y=-5;
        td.a(new int[96*72],96,72);
        String error="ok";
        try {lf.a(0,top,-1,62,1,-1,88,0,true,3);}
        catch(g ex){error=ex.q+"/"+ex.a.getClass().getSimpleName();}
        StringJoiner rows=new StringJoiner(";");
        for(int i=0;i<vb.o;i++){
            String text=i>=ak.a.length?"short":ak.a[i]==null?"-":new String(ak.a[i].A,0,ak.a[i].c,StandardCharsets.ISO_8859_1);
            rows.add((i<p.u.length?""+p.u[i]:"short")+","+text+","+(i<ia.n.length?""+ia.n[i]:"short")+","+ml.x[i]+","+
                    (i>=ph.e.length?"short":ph.e[i]==null?"-":ph.e[i]==ga.J?"empty":"value"));
        }
        return error+"|"+rows+"|"+(hg.f==null?-1:hg.f.Kc)+","+oj.i+","+parent.Ac+","+ik.G+","+(nk.V==tip)+","+fd.Z+","+li.y;
    }

    public static void main(String[] args) throws IOException {
        try(var in=new BufferedReader(new InputStreamReader(System.in))){
            for(String line;(line=in.readLine())!=null;){
                int[] p=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
                System.out.println(run(p[0],p[1],p[2],p[3]));
            }
        }
    }
}
