import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

public class CheatOracle {
    static String str(id s) { return s==null?"-":new String(s.b(false),StandardCharsets.ISO_8859_1); }
    public static void main(String[] args) throws Exception {
        var in=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8));
        var result=new PrintWriter(System.out,true,StandardCharsets.UTF_8);
        var log=new ByteArrayOutputStream();System.setOut(new PrintStream(log,true,StandardCharsets.UTF_8));
        for(int i=0;i<4;i++)hc.c[i]=new ke(104,104);
        ek.s=null;wk.d=new ej();tj.m=null;tf.C=30;ia.l=0;
        for(String line;(line=in.readLine())!=null;){
            String[] row=line.split("\\|",4);
            mi.E=Integer.parseInt(row[0]);d.c=Integer.parseInt(row[1]);
            int missing=Integer.parseInt(row[2]);hc.c[2]=missing==0?new ke(104,104):null;
            qk.v=new be(2048);qk.v.a(new int[]{1,2,3,4},0);
            ve.m=0;ui.q[0]=ui.q[1]=null;log.reset();
            boolean error=false;String command=row[3];
            byte[] data=command.getBytes(StandardCharsets.ISO_8859_1);
            try {ig.a(ea.a(data,0,data.length,0),12);}catch(RuntimeException ex){error=true;}
            int hash=1;
            for(ke map:hc.c)hash=hash*31+(map==null?0:Arrays.deepHashCode(map.d));
            result.println(String.join("|",Boolean.toString(error),Integer.toString(qk.v.yb),HexFormat.of().formatHex(qk.v.fb,0,qk.v.yb),
                Boolean.toString(jg.C),Integer.toString(ml.T),Boolean.toString(qf.b),Boolean.toString(pb.sc),
                Boolean.toString(uc.c),Boolean.toString(wd.b),Integer.toString(hf.B),Integer.toString(ue.a()),
                Boolean.toString(qc.W),Integer.toString(tf.C),Integer.toString(hash),Integer.toString(ve.m),
                str(ui.q[0]),str(ui.q[1]),log.toString(StandardCharsets.UTF_8).trim()));
        }
    }
}
