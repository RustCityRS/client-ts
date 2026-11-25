import java.io.*;
import java.util.*;

class InteractionOracle {
    static final HexFormat hex=HexFormat.of();
    static String hex(id text){return text==null?"~":hex.formatHex(text.A,0,text.c);}
    public static void main(String[] argv)throws Exception{
        DataInputStream in=new DataInputStream(System.in);
        te.g=new pb();te.g.L[0]=34;te.g.ac[0]=32;
        hc.c[0]=new ke(104,104);for(int[] r:hc.c[0].d)Arrays.fill(r,0);
        int[] ids={4,99,777,955};fe.R=4;
        for(int i=0;i<ids.length;i++)ad.h[i]=ids[i];
        tf.J[99]=new pb();tf.J[777]=new pb();tf.J[955]=new pb();
        tf.J[777].Gc=aj.a("aNa MaRiA",(byte)-100);tf.J[955].Gc=aj.a("Same",(byte)-100);
        tf.J[777].L[0]=41;tf.J[777].ac[0]=37;tf.J[955].L[0]=34;tf.J[955].ac[0]=32;
        hk.e=3210;vj.t=3330;qk.v.a(new int[]{3,7,13,17},-1);
        for(int i=7;i<10;i++){ek seq=new ek();seq.b=i%3;seq.h=10-i;ga.B.a((long)i,seq,(byte)-71);}
        int count=in.readInt();
        for(int i=0;i<count;i++){
            int op=in.readInt(),n=in.readInt();int[] args=new int[n];for(int j=0;j<n;j++)args[j]=in.readInt();
            int len=in.readInt();id text=null;
            if(len>=0){text=new id();text.A=in.readNBytes(len);text.c=len;}
            int size=n+(len>=0?1:0)+2;int pos=0;
            m s=new m();s.D=new int[size];s.F=new int[size];s.B=new id[size];
            for(int arg:args){s.D[pos]=0;s.F[pos++]=arg;}
            if(len>=0){s.D[pos]=3;s.B[pos++]=text;}
            s.D[pos]=op;s.D[pos+1]=21;
            int id=12300+i;sf.g.a((long)id,0,s);wf event=new wf();event.G=new Object[]{id};
            bb.e=i+1234;qk.v.yb=0;te.g.fc=i+7;te.g.Xb=i+20;te.g.w=i+23;te.g.gc=i+31;te.g.hb=i+41;te.g.F=i+62;te.g.T=i+79;
            li.a(event,116);pb p=te.g;
            System.out.println(hex.formatHex(qk.v.fb,0,qk.v.yb)+"|"+ve.m+","+sb.c+","+de.t[0]+","+hex(ui.q[0])+","+hex(m.T[0])+"|"+
                gl.z+","+ic.T+"|"+p.bb+","+p.fc+","+p.Xb+","+p.w+","+p.gc+","+p.hb+","+p.F+","+p.T);
        }
    }
}
