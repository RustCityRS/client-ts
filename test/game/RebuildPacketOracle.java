import java.io.*;
import java.util.*;
import java.awt.Canvas;

class RebuildPacketOracle {
    public static void main(String[] args)throws Exception{
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        String table=in.readLine();
        id mapPrefix=ah.h,locPrefix=hj.g,um=id.K,ul=ei.w,separator=qc.M;
        tf.C=25;wj.g=new fg(new byte[257],new int[256],new int[256],new int[256],new int[256],new byte[256][0]);
        qd.s=vb.a("",(byte)54);pe.S=new Canvas();ba.d=new gk();te.g=new pb();
        int[][][] complete = ag.d;
        var bitPos = be.class.getDeclaredField("Db");
        bitPos.setAccessible(true);
        for(String line;(line=in.readLine())!=null;){
            String[] fields=line.split(" ");
            int lookup=Integer.parseInt(fields[3]);
            bitPos.setInt(hd.b,0);
            ag.d = complete;
            if (lookup >= 5) {
                ag.d = complete.clone();
                ag.d[0] = complete[0].clone();
                switch (lookup) {
                    case 5 -> ag.d = null;
                    case 6 -> ag.d = new int[0][][];
                    case 7 -> ag.d[0] = null;
                    case 8 -> ag.d[0] = new int[0][];
                    case 9 -> ag.d[0][0] = null;
                    case 10 -> ag.d[0][0] = new int[0];
                    case 11 -> ag.d[0][0] = new int[1];
                }
            }
            ah.h=mapPrefix;hj.g=locPrefix;id.K=um;ei.w=ul;qc.M=separator;
            re.d=lookup==1?null:new al(new ChatOracle.Source(table){
                db b(int dummy){
                    if(lookup==2){ah.h=locPrefix;hj.g=mapPrefix;id.K=locPrefix;ei.w=mapPrefix;qc.M=separator;}
                    if(lookup==3)re.d=null;
                    if(lookup==4)qc.M=vb.a("-", (byte)54);
                    return super.b(dummy);
                }
            },false,false);
            hd.b.fb=Base64.getDecoder().decode(fields[2]);hd.b.yb=0;af.I=Integer.parseInt(fields[1]);
            int joins=s.N; String result="ok";
            try{ac.a(true,fields[0].equals("1"));}
            catch(RuntimeException ex){
                Throwable error=ex;
                while(error instanceof g wrapped && wrapped.a!=null)error=wrapped.a;
                result=error instanceof ArrayIndexOutOfBoundsException||error instanceof NegativeArraySizeException?"bounds":error.getClass().getSimpleName();
            }
            System.out.println(result+" "+hd.b.yb+" "+bitPos.getInt(hd.b)+" "+(qg.G?1:0)+" "+Arrays.deepHashCode(ag.d)+" "+Arrays.deepHashCode(jg.w)+" "+
                Arrays.hashCode(rb.i)+" "+Arrays.hashCode(fd.X)+" "+Arrays.hashCode(hh.qb)+" "+Arrays.hashCode(nk.X)+" "+Arrays.hashCode(p.J)+" "+
                Arrays.deepHashCode(mk.G)+" "+Arrays.deepHashCode(lk.x)+" "+Arrays.deepHashCode(kg.o)+" "+Arrays.hashCode(ae.c)+" "+
                ic.V+" "+ah.k+" "+sb.h+" "+ah.f+" "+hk.e+" "+vj.t+" "+te.g.L[0]+" "+te.g.ac[0]+" "+(lookup==1||lookup==3?s.N-joins:0));
        }
    }
}
