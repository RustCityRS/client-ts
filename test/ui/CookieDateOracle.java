import java.io.*;
import java.util.*;

// The formatter and decimal conversions execute directly out of the original JAR.
// Calendar.get and setTimeInMillis are ordinary JVM virtual methods.
class CookieDateOracle {
    static final Calendar original = hc.b;
    static final id[] weekdays = rj.k, months = p.c;
    static final id dash = g.l, colon = mc.M;
    static final long firstTime = -86400001L, otherTime = 951782400123L;
    static Probe first, other;
    static boolean active;
    static int calls, boundary, action;
    static StringBuilder trace;

    static class Probe extends GregorianCalendar {
        String name;
        Probe(String name,long millis) {
            super(TimeZone.getTimeZone("GMT"),Locale.US);
            this.name=name;super.setTimeInMillis(millis);
        }
        public void setTimeInMillis(long value) {
            super.setTimeInMillis(value);
            if (active) change(this,"S",0);
        }
        void directSet(long millis) { super.setTimeInMillis(millis); }
        public int get(int field) {
            int result=super.get(field);
            return active ? change(this,Integer.toString(field),result) : result;
        }
    }

    static int change(Probe receiver,String operation,int value) {
        trace.append(receiver.name).append(operation).append('.');
        if (++calls != boundary) return value;
        switch(action) {
            case 1 -> hc.b=other;
            case 2 -> hc.b=null;
            case 3 -> receiver.directSet(otherTime);
            case 4 -> rj.k=null;
            case 5 -> rj.k=new id[0];
            case 6 -> p.c=null;
            case 7 -> p.c=new id[0];
            case 8 -> { rj.k=new id[7];p.c=new id[12]; }
            case 9 -> { id same=vb.a("alias",(byte)54);Arrays.fill(rj.k,same);Arrays.fill(p.c,same);g.l=mc.M=same; }
            case 10 -> throw new IllegalStateException("probe");
            case 11 -> { return Integer.MIN_VALUE; }
            case 12 -> { return Integer.MAX_VALUE; }
            case 13 -> {id bad=new id();bad.c=1;bad.A=null;Arrays.fill(rj.k,bad);}
        }
        return value;
    }

    public static void main(String[] args) throws Exception {
        if (!original.getTimeZone().getID().equals("GMT")) throw new AssertionError(original.getTimeZone());
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=input.readLine())!=null;){
            String[] values=line.split(" ");
            long time=Long.parseLong(values[0]);int mode=Integer.parseInt(values[1]);
            boundary=Integer.parseInt(values[2]);action=Integer.parseInt(values[3]);
            rj.k=weekdays.clone();p.c=months.clone();g.l=dash;mc.M=colon;
            first=new Probe("A",firstTime);other=new Probe("B",otherTime);original.setTimeInMillis(firstTime);
            hc.b=mode==0?original:mode==1?first:null;ok.s=hc.b;
            calls=0;trace=new StringBuilder();int conversions=lf.l;
            String result;
            active=mode!=0;
            try {
                id text=gk.a(0,time);
                result=Base64.getEncoder().encodeToString(Arrays.copyOf(text.A,text.c));
            } catch (RuntimeException ex) {
                Throwable cause=ex;
                while (cause instanceof g) cause=((g)cause).a;
                result=cause instanceof NullPointerException?"null":cause instanceof IndexOutOfBoundsException?"bounds":
                    cause instanceof IllegalStateException?"stop":cause.getClass().getSimpleName();
            } finally { active=false; }
            String ref=hc.b==null?"N":hc.b==original?"O":hc.b==first?"A":"B";
            System.out.println(String.join(";",result,trace.toString(),ref,String.valueOf(lf.l-conversions),
                String.valueOf(original.getTimeInMillis()),String.valueOf(first.getTimeInMillis()),String.valueOf(other.getTimeInMillis()),
                ok.s==null?"-":String.valueOf(ok.s.getTimeInMillis())));
        }
    }
}
