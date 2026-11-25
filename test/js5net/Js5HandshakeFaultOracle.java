import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.util.*;

// Calls the untouched client methods. Only java.net.Socket and its host streams
// are supplied by this fixture; dj, the five-byte gd, se, ej and fb are native.
public class Js5HandshakeFaultOracle {
    static StringBuilder trace;
    static String point;
    static int action, ready, reply;
    static g original;
    static void hit(String name) {
        trace.append(name).append(';');
        if(!name.equals(point))return;
        switch(action) {
            case 1 -> raise(new IOException());
            case 2 -> raise(new SocketException());
            case 3 -> throw new IllegalStateException();
            case 4 -> throw original;
            case 5 -> throw new AssertionError();
            case 6 -> raise(new ClassNotFoundException());
            case 7 -> {wk.d=null;raise(new IOException());}
            case 8 -> wk.d=null;
        }
    }
    @SuppressWarnings("unchecked") static <T extends Throwable> void raise(Throwable e) throws T {throw (T)e;}
    static class Peer extends Socket {
        boolean probe;
        Peer(boolean probe){this.probe=probe;}
        public void setSoTimeout(int t){if(probe)hit("timeout"+t);}
        public void setTcpNoDelay(boolean on){if(probe)hit("nodelay"+on);}
        public InputStream getInputStream(){
            if(probe)hit("input");
            return new InputStream(){
                public int available(){if(probe)hit("available");return ready;}
                public int read(){if(probe)hit("read");return reply;}
            };
        }
        public OutputStream getOutputStream(){if(probe)hit("output");return OutputStream.nullOutputStream();}
    }
    static String cause(Throwable t) {
        if(t instanceof g w) return (w==original?"same:":"wrap:")+w.q+"/"+cause(w.a);
        if(t instanceof ClassCastException)return "cast";
        if(t instanceof NullPointerException)return "null";
        if(t instanceof AssertionError)return "error";
        if(t instanceof ClassNotFoundException)return "class";
        if(t instanceof IOException)return "io";
        return "runtime";
    }
    public static void main(String[] args)throws Exception {
        var app=Js5ConnectionOracle.allocate("client");
        var b=client.class.getDeclaredMethod("b",boolean.class);
        var a=client.class.getDeclaredMethod("a",int.class,int.class);
        var g=client.class.getDeclaredMethod("g",int.class);
        for(var m:new Method[]{a,b,g})m.setAccessible(true);
        var queueStream=Js5ConnectionOracle.field("ej","B");
        var buffer=Js5ConnectionOracle.field("se","B");var tail=Js5ConnectionOracle.field("se","o");
        try(var input=new BufferedReader(new InputStreamReader(System.in))) {
            for(String line;(line=input.readLine())!=null;) {
                String[] v=line.split(" ");
                int entry=Integer.parseInt(v[0]),stage=Integer.parseInt(v[1]),bad=Integer.parseInt(v[2]),site=Integer.parseInt(v[3]);
                int code=Integer.parseInt(v[4]);point=v[5];action=Integer.parseInt(v[6]);ready=Integer.parseInt(v[7]);reply=Integer.parseInt(v[8]);
                tj.m=(fb)Js5ConnectionOracle.allocate("fb");fb link=tj.m;
                se old=new se(new Peer(false),link);
                var q=wk.d=new ej();if(entry==1)q.a((byte)0,1,2,(byte)-80,true);
                te.f=new dj();dj task=te.f;task.b=code;
                task.a=switch(bad){case 1,7 -> null;case 2 -> 42;case 3 -> "socket";case 4 -> new Object();default -> new Peer(true);};
                if(bad==5)te.f=null;if(bad==6)wk.d=null;if(bad==7)tj.m=null;
                if(stage==3){var peer=new Peer(false);old=new se(peer,link);peer.probe=true;}
                hl.H=old;je.T=stage;tf.C=30;sj.M=mc.X=0;ha.c=0;ie.r=ag.f=40729;aa.a=50729;q.G=0;q.F=72;
                original=od.a(new IllegalStateException(),"origin");trace=new StringBuilder();String result="ok";
                try {
                    if(entry==2)a.invoke(app,site,code);else if(entry==1)g.invoke(app,3524);else b.invoke(app,false);
                }catch(InvocationTargetException e){result=cause(e.getCause());}
                se stream=hl.H!=null&&hl.H!=old?hl.H:(se)queueStream.get(q);
                byte[] bytes=stream==null?null:(byte[])buffer.get(stream);
                String wire=bytes==null?"-":HexFormat.of().formatHex(bytes,0,tail.getInt(stream));
                System.out.println(result+"|"+trace+"|"+je.T+","+q.G+","+q.F+","+ie.r+","+mc.X+","+
                    (te.f==task)+","+(wk.d==q)+","+(hl.H==null?"-":hl.H==old?"old":"new")+","+
                    (queueStream.get(q)!=null)+","+(ha.c!=0)+"|"+wire);
                point="-";action=0;
            }
        }
    }
}
