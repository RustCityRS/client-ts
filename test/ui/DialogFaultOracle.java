import java.io.*;
import java.util.*;
import java.util.regex.*;

class DialogFaultOracle {
    static final int[] values={65537,-32768,45199,2147483647};
    static final Pattern failure=Pattern.compile("CS2 - scr:-?[0-9]+ op:(-?[0-9]+)");
    public static void main(String[] args)throws Exception{
        var input=new BufferedReader(new InputStreamReader(System.in));
        var output=System.out;
        int key=45000;
        for(String line;(line=input.readLine())!=null;){
            int[] vector=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int op=vector[0],n=vector[1],str=vector[2],capacity=vector[3],pos=vector[4];
            qk.v.fb=new byte[capacity];Arrays.fill(qk.v.fb,(byte)0xa5);qk.v.yb=pos;qk.v.a(new int[]{1,22,4,8},-1);
            ja.Z=31;lg.G=32;ib.db=33;gi.m=34;ae.j=35;ri.V=36;od.N=37;ae.b=38;rk.i=40;sb.g=41;
            bh.l=null;if(vector[5]!=0){bh.l=new aj();bh.l.C=381;bh.l.H=-7;}
            ob.q[86]=true;ob.q[81]=true;ob.q[82]=false;
            Arrays.fill(tg.B,-901);Arrays.fill(g.p,null);ui.q[0]=null;
            int i=n,size=n+(str>=0?1:0)+4;
            m code=new m();code.D=new int[size];code.F=new int[size];code.B=new id[size];
            for(int j=0;j<n;j++)code.F[j]=values[j%4];
            if(str>=0){code.D[i]=3;if(str==1)code.B[i]=aj.a("123456",(byte)-100);i++;}
            code.D[i++]=op;code.D[i]=3;id marker=code.B[i++]=aj.a("returned",(byte)-100);code.D[i++]=3100;code.D[i]=21;
            sf.g.a((long)key,0,code);wf event=new wf();event.G=new Object[]{key++};
            var capture=new ByteArrayOutputStream();System.setOut(new PrintStream(capture));
            try{li.a(event,116);}finally{System.setOut(output);}
            String log=capture.toString(),fault="-";var m=failure.matcher(log);
            if(m.find())fault=m.group(1)+"/"+(log.contains("NullPointerException")?"null":log.contains("IndexOutOfBoundsException")?"bounds":"runtime");
            String packet=qk.v.yb+" "+HexFormat.of().formatHex(qk.v.fb);
            qk.v.fb=new byte[1];qk.v.yb=0;qk.v.k(2,251);
            output.println(fault+" "+(ui.q[0]==marker)+" "+packet+" "+(qk.v.fb[0]&255)+" "+Arrays.hashCode(tg.B)+" "+
                ja.Z+" "+lg.G+" "+ib.db+" "+gi.m+" "+ae.j+" "+ri.V+" "+od.N+" "+ae.b+" "+rk.i+" "+sb.g);
        }
    }
}
