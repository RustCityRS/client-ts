import java.io.*;
import java.net.Socket;
import java.util.*;

class StatOracle {
    static final int[] OPS={3300,3305,3306,3307,3308,3309,3310,3311,3312,3316,3317,3318,3321,3322,3323,3324,3325,3326,3327,3328,3329,3333,3335,3336,3337};
    static int[] args(int op,int step){
        if(op>=3305&&op<=3307)return new int[]{step%25};
        if(op>=3309&&op<=3311)return new int[]{0x8008f112*step};
        if(op==3336)return new int[]{step*0x7031c,step-30,7-step,0x7fffff11*step};
        return new int[0];
    }
    static void read(int opcode,byte[] bytes)throws Exception{
        Socket socket=new Socket(){
            public void setSoTimeout(int n){}
            public void setTcpNoDelay(boolean enabled){}
            public InputStream getInputStream(){return new ByteArrayInputStream(bytes);}
            public OutputStream getOutputStream(){return new ByteArrayOutputStream();}
        };
        ek.s=new se(socket,null);af.I=bytes.length;o.Y=opcode;
        if(!rg.a((byte)57))throw new AssertionError("packet was not consumed");
    }
    public static void main(String[] argv)throws Exception{
        DataInputStream in=new DataInputStream(System.in);
        int count=in.readInt();te.g=new pb();te.g.pc=new cl();
        fk.ab=new aj[][]{{new aj()},{null,new aj()}};rg.b=new boolean[]{true,true};
        aj root=fk.ab[0][0];root.R=vk.db;root.vb=9;
        qd sub=new qd();sub.v=1;va.Z.a((byte)-89,sub,0L);
        for(int step=0;step<count;step++){
            bb.e=step*7189+1;sf.m[9]=false;fk.ab[1][1].y=(step&1)!=0;
            int opcode=in.readInt();read(opcode,in.readNBytes(in.readInt()));
            hl.w=step%4;qj.C=355+step;ce.F=step*7;hh.kb=step*0x3737735;
            mi.E=step%4;tg.r=step%15;da.d=(step%3)==0;ka.c=(step%7)==0;ld.g=(step&2)!=0;d.h=(step&1)!=0;qi.Z=(step&4)!=0;
            te.g.uc=25+step;te.g.pc.m=(step%3)==1;te.g.Z=step*0x1018007;te.g.S=-step*63991;hk.e=step*0x103729;vj.t=step*0x76321;ah.f=step-10;fk.cb=step-17;
            ArrayList<Integer> ops=new ArrayList<>(),operands=new ArrayList<>();
            for(int j=0;j<OPS.length;j++){
                for(int arg:args(OPS[j],step)){ops.add(0);operands.add(arg);}
                ops.add(OPS[j]);operands.add(0);ops.add(43);operands.add(j);
            }
            ops.add(21);operands.add(0);
            m script=new m();script.D=ops.stream().mapToInt(n->n).toArray();script.F=operands.stream().mapToInt(n->n).toArray();script.B=new id[ops.size()];
            sf.g.a(8200L+step,0,script);wf e=new wf();e.G=new Object[]{8200+step};li.a(e,116);
            System.out.println(hd.b.yb+" "+sf.m[9]+" "+mf.l+" "+od.V+" "+Arrays.hashCode(ld.d)+" "+Arrays.hashCode(di.i)+" "+Arrays.hashCode(wa.o)+" "+Arrays.hashCode(ll.m)+" "+Arrays.toString(Arrays.copyOf(od.U,OPS.length)));
        }
    }
}
