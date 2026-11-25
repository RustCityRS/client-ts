import java.io.*;
import java.util.*;
import java.util.regex.*;

class VariableScriptOracle {
    static final Pattern report=Pattern.compile("CS2 - scr:-?[0-9]+ op:(-?[0-9]+)");
    static final id seed=aj.a("seed",(byte)-100), value=aj.a("value",(byte)-100);
    static int stringHash(id[] entries){
        int h=1;
        for(id entry:entries)h=h*31+(entry==null?0:entry==seed?1:entry==value?2:entry==pa.Ab?3:4);
        return h;
    }
    public static void main(String[] args)throws Exception{
        var input=new BufferedReader(new InputStreamReader(System.in));var output=System.out;int key=76000;
        for(int i=0;i<3;i++){
            og bit=new og();bit.j=i==2?2500:14;bit.d=3;bit.i=i==1?35:7;cd.d.a(7L+i,bit,(byte)-71);
        }
        pj inventory=new pj();inventory.H=12;ed.c.a(7,0,inventory);
        for(String line;(line=input.readLine())!=null;){
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int op=v[0],operand=v[1],ints=v[2],strings=v[3],truncate=v[4],actor=v[5];
            wf.b(true);db.p=new nc(16);
            Arrays.fill(tg.B,-5501);Arrays.fill(g.p,null);Arrays.fill(vj.d,27);Arrays.fill(od.U,59);Arrays.fill(me.a,null);
            me.a[7]=seed;te.g=actor==0?null:new pb();if(actor==2)te.g.pc=new cl();
            if(te.g!=null){te.g.uc=91;te.g.Z=-1557;te.g.S=8081;if(te.g.pc!=null)te.g.pc.m=true;}
            int pc=ints+strings;
            m code=new m();code.D=new int[pc+3];code.F=truncate==2?null:new int[truncate==1?pc:pc+3];code.B=new id[pc+3];
            if(code.F!=null)for(int i=0;i<ints;i++)code.F[i]=(i%2==0?operand:11);
            for(int i=ints;i<pc;i++){code.D[i]=3;code.B[i]=operand<0?null:value;}
            code.D[pc]=op;code.D[pc+1]=3;code.B[pc+1]=value;code.D[pc+2]=21;
            if(truncate==0)code.F[pc]=operand;
            sf.g.a((long)key,0,code);wf event=new wf();event.G=new Object[]{key++};
            var capture=new ByteArrayOutputStream();System.setOut(new PrintStream(capture));
            try{li.a(event,116);}finally{System.setOut(output);}
            String log=capture.toString(),fault="-";var m=report.matcher(log);
            if(m.find())fault=m.group(1)+"/"+(log.contains("NullPointerException")?"null":log.contains("IndexOutOfBoundsException")?"bounds":log.contains("IllegalStateException")?"illegal":"runtime");
            output.println(fault+" "+Arrays.hashCode(tg.B)+" "+stringHash(g.p)+" "+Arrays.hashCode(vj.d)+" "+Arrays.hashCode(od.U)+" "+
                stringHash(me.a)+" "+db.p.d((byte)-107)+" "+jd.d.d((byte)-107));
        }
    }
}
