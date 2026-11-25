import java.io.*;
import java.lang.reflect.*;
import java.net.Socket;
import java.util.*;

final class LoginStreamOracle {
    static se a,b;
    static be first,second;
    static id[] oldNames,replacement;
    static int events,at,action;
    static StringBuilder log;
    static Field writer,closed;
    static final HexFormat hex=HexFormat.of();

    static void event(char peer,char type) throws IOException {
        log.append(peer).append(type);
        if (++events!=at)return;
        switch(action){
            case 1 -> ek.s=b;
            case 2 -> ek.s=null;
            case 3,5 -> hd.b=second;
            case 4 -> hd.b=null;
            case 6 -> gj.X=replacement;
            case 7 -> gj.X=null;
            case 8 -> throw new IOException("fixture read");
        }
    }
    static final class Peer extends Socket {
        final char tag;final byte[] input;int pos;
        Peer(char tag,String bytes){this.tag=tag;input=bytes.equals("-")?new byte[0]:hex.parseHex(bytes);}
        public void setSoTimeout(int value){} public void setTcpNoDelay(boolean value){}
        public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
        public InputStream getInputStream(){return new InputStream(){
            public int available() throws IOException {int n=input.length-pos;event(tag,'A');return n;}
            public int read() throws IOException {
                // A staged, completed writer request lets se.close finish without a worker.
                try{if(ek.s!=null && writer.get(ek.s) instanceof dj task)task.b=2;}
                catch(IllegalAccessException e){throw new AssertionError(e);}
                int value=pos<input.length?input[pos++]&255:-1;
                event(tag,'R');return events==at && action==9?-1:value;
            }
            public int read(byte[] dst,int off,int size)throws IOException{
                int n=Math.min(input.length-pos,size);
                if(n>0){System.arraycopy(input,pos,dst,off,n);pos+=n;}
                event(tag,'B');return n>0?n:-1;
            }
        };}
    }
    static String names(id[] array){
        if(array==null)return "-";
        StringJoiner names=new StringJoiner(",");
        for(id name:array)names.add(name==null?"_":hex.formatHex(name.A,0,name.c));
        return array.length+"["+names+"]";
    }
    static String packet(be p){return p.yb+","+hex.formatHex(p.fb);}
    static void initialize()throws Exception{
        writer=se.class.getDeclaredField("n");closed=se.class.getDeclaredField("m");
        writer.setAccessible(true);closed.setAccessible(true);
        var unsafe=Class.forName("sun.misc.Unsafe");var singleton=unsafe.getDeclaredField("theUnsafe");singleton.setAccessible(true);
        tj.m=(fb)unsafe.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),fb.class);
        m.S=null;ld.k=null;
        for(String cls:new String[]{"hi","ig","le","qk","bi","mg","fh","ga","ii","jd","id","ak","mi","gd","sg"})
            Class.forName(cls);
    }
    public static void main(String[] args)throws Exception{
        initialize();
        var randomField=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        randomField.setAccessible(true);var rng=(Random)randomField.get(null);
        BufferedReader reader=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=reader.readLine())!=null;){
            String[] v=line.split(" ");int kind=Integer.parseInt(v[0]),stage=Integer.parseInt(v[1]),status=Integer.parseInt(v[2]);
            at=Integer.parseInt(v[3]);action=Integer.parseInt(v[4]);
            Peer pa=new Peer('a',v[5]),pb=new Peer('b',v[6]),pc=new Peer('c',v[5]);
            a=new se(pa,tj.m);b=new se(pb,tj.m);ek.s=a;
            dj ticket=new dj();ticket.b=status;ticket.a=action==10?null:pc;f.k=action==11?null:ticket;
            first=new be(32);Arrays.fill(first.fb,(byte)0x31);first.yb=7;
            second=new be(action==5?5:32);Arrays.fill(second.fb,(byte)0x11);second.yb=3;
            hd.b=first;qk.v=new be(32);Arrays.fill(qk.v.fb,(byte)0x53);qk.v.yb=4;
            oldNames=new id[]{aj.a("Fixture",(byte)-124),null};replacement=new id[]{null};gj.X=oldNames;
            t.L=kind==0?stage:0;pe.P=kind==1?stage:0;od.O=kind==2?stage:0;
            ge.Q=4;g.f=5;nk.U=6;gl.t=hg.b=tk.d=0;dg.h=31;nb.e=32;mh.n=33;
            il.K=21;kl.X=20;qj.C=-1;s.O=false;sc.V=false;o.Y=-1;af.I=kind==2 && stage==9?3:0;
            ej.p=null;rj.x=false;
            ga.G=kind==2 && stage==3?null:aj.a("Fixture",(byte)-124);ga.F=null;
            ag.f=ie.r=40001;aa.a=50001;th.h=aj.Cb=40002;bh.g=50002;
            // Stop after the account fields if stage 8 reaches its first ISAAC read.
            mi.E=tg.r=mi.y=0;ld.g=d.h=aj.Cc=qi.Z=tj.h=da.d=ka.c=false;
            rng.setSeed(530);events=0;log=new StringBuilder();
            String fault="ok";
            try{if(kind==0)hi.a(-1439);else if(kind==1)ig.a(125);else le.a(-28426);}
            catch(RuntimeException e){
                Throwable cause=e;while(cause instanceof g wrap && wrap.a!=null)cause=wrap.a;
                fault=cause instanceof NullPointerException?"null":cause instanceof NegativeArraySizeException?"negative":
                    cause instanceof IndexOutOfBoundsException?"bounds":cause.getClass().getSimpleName();
            }
            var state=new StringJoiner(",");
            for(int n:new int[]{t.L,pe.P,od.O,ge.Q,g.f,nk.U,gl.t,hg.b,tk.d,dg.h,nb.e,il.K,kl.X,qj.C,ie.r,aj.Cb,o.Y,af.I,mi.E,tg.r,mi.y})state.add(""+n);
            System.out.println(String.join(";",fault,state.toString(),""+mh.n,log.toString(),pa.pos+","+pb.pos+","+pc.pos,
                ""+(f.k==ticket),ek.s==null?"-":ek.s==a?"a":ek.s==b?"b":"c",closed.get(a)+","+closed.get(b),
                hd.b==null?"-":hd.b==first?"a":"b",packet(first),packet(second),packet(qk.v),""+rj.x,
                gj.X==null?"-":gj.X==oldNames?"old":gj.X==replacement?"replaced":"new",names(gj.X),names(oldNames),names(replacement)));
        }
    }
}
