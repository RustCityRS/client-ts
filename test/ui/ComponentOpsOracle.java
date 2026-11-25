import java.util.*;
import java.io.*;
import java.lang.reflect.*;

final class ComponentOpsOracle {
    static final int ROOT=1<<16;
    static final Field[] fields=Arrays.stream(aj.class.getDeclaredFields()).filter(f->!Modifier.isStatic(f.getModifiers())).sorted(Comparator.comparing(Field::getName)).toArray(Field[]::new);
    static {
        for(Field f:fields)f.setAccessible(true);
    }
    static int hash(Object v)throws Exception{
        if(v instanceof aj c)return 31*c.Kc+c.bc+1;
        if(v!=null && v.getClass().isArray()){int h=1;for(int i=0;i<Array.getLength(v);i++)h=31*h+hash(Array.get(v,i));return h;}
        return ComponentOracle.hash(v);
    }
    static String snapshot(aj c)throws Exception{
        if(c==null)return "-";
        int h=1;for(Field f:fields)h=31*h+hash(f.get(c));
        return String.valueOf(h);
    }
    static String target(aj c){return c==null?"-":c.Kc+","+c.bc;}
    static void seedDrag(boolean menu){ie.F=menu;pe.T=null;vf.Y=null;c.A=-1;c.s=-2;ed.h=true;h.a=23;}
    static String dragState(){return target(pe.T)+" "+target(vf.Y)+" "+c.A+" "+c.s+" "+h.a+" "+ed.h;}
    public static void main(String[] args)throws Exception{
        hi.f=765;fl.l=503;vk.db=134;fk.ab=new aj[3][];rg.b=new boolean[]{false,true,true};
        aj c=new aj(),d=new aj();c.Kc=ROOT;d.Kc=ROOT+1;
        fk.ab[1]=new aj[]{c,d};fk.ab[2]=new aj[]{null};c.R=d.R=134;c.vb=0;d.vb=1;c.ob=0;d.ob=4;d.n=ROOT;
        kl obj=new kl();obj.I=4;obj.P=200;obj.U=321;obj.q=-51;obj.u=67;obj.m=189;obj.gb=12345;fa.b.a(4L,obj,(byte)-71);
        te.g=new pb();te.g.pc=new cl();int[] equipment=new int[12];equipment[8]=Integer.MIN_VALUE;
        te.g.pc.a(false,new int[]{1,2,3,4,5},0,equipment,-9,-1);hh.S.a(3L,new fi(),(byte)-71);
        Field cached=cl.class.getDeclaredField("t"),key=cl.class.getDeclaredField("o");cached.setAccessible(true);key.setAccessible(true);cached.setLong(te.g.pc,0x123456789L);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));int id=17000;
        PrintStream output=System.out;ByteArrayOutputStream capture=new ByteArrayOutputStream();PrintStream quiet=new PrintStream(capture);
        for(String line;(line=in.readLine())!=null;){
            String[] tokens=line.split(" ");m code=new m();code.D=new int[tokens.length];code.F=new int[tokens.length];code.B=new id[tokens.length];
            for(int k=0;k<tokens.length;k++){
                String[] cmd=tokens[k].split(":",-1);
                code.D[k]=Integer.parseInt(cmd[0]);
                if(code.D[k]==3)code.B[k]=aj.a(cmd[1],(byte)-100);else code.F[k]=Integer.parseInt(cmd[1]);
            }
            sf.g.a((long)id,0,code);Arrays.fill(tg.B,-9801);Arrays.fill(g.p,null);
            boolean drag=line.contains("3108:") || line.contains("3109:");
            if(drag)seedDrag(code.F[0]==-7);
            od.U[1901]=-999;sf.m[0]=sf.m[1]=false;
            wf event=new wf();event.G=new Object[]{id++};
            capture.reset();System.setOut(quiet);try{
                if(line.contains("403:1")){d.Lb=event.G;gd.b(1,(byte)-89);d.Lb=null;}else li.a(event,116);
            }finally{System.setOut(output);}
            int ints=1,strings=1;
            for(int j=0;j<16;j++){ints=31*ints+tg.B[j];strings=31*strings+hash(g.p[j]);}
            String state=od.U[1901]+" "+sf.m[0]+" "+sf.m[1]+" "+target(al.B)+" "+target(ai.i)+" "+snapshot(c)+" "+snapshot(d)+" "+snapshot(al.B)+" "+snapshot(ai.i)+" "+ints+" "+strings+" "+cached.getLong(te.g.pc)+" "+key.getLong(te.g.pc);
            if(c.pb!=null)for(aj child:c.pb)state+=" "+snapshot(child);
            String report=capture.toString();
            java.util.regex.Matcher m=java.util.regex.Pattern.compile("CS2 - scr:-?[0-9]+ op:(-?[0-9]+)").matcher(report);
            String fault="-";
            if(m.find()){
                String kind=report.contains("NullPointerException")?"null":report.contains("IndexOutOfBoundsException")?"bounds":report.contains("NegativeArraySizeException")?"size":"runtime";
                fault=m.group(1)+"/"+kind;
            }
            state+=" "+fault;
            if(drag)state+=" "+dragState();
            output.println(state);
        }
    }
}
