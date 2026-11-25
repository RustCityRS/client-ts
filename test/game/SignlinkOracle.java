import java.awt.*;
import java.awt.event.*;
import java.io.*;
import java.lang.reflect.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;

@SuppressWarnings("deprecation")
public class SignlinkOracle {
    static int probe=7;
    static int plus(int x){return x+probe;}
    static void waitFor(dj r)throws Exception{long end=System.currentTimeMillis()+5000;while(r.b==0){if(System.currentTimeMillis()>end)throw new AssertionError("stuck request");Thread.sleep(1);}}
    static final java.util.List<String> closed=new ArrayList<>();
    static ne file(String tag)throws Exception{
        ne f=new ne();File tmp=File.createTempFile("sign530-",null);tmp.deleteOnExit();
        Field field=ne.class.getDeclaredField("d");field.setAccessible(true);
        field.set(f,new RandomAccessFile(tmp,"rw"){public void close()throws IOException{closed.add(tag);super.close();}});
        return f;
    }
    static class Queue extends EventQueue{
        int peeks,remaining;String posted="-";
        public AWTEvent peekEvent(){peeks++;return remaining-->0?new ActionEvent(this,0,""):null;}
        public void postEvent(AWTEvent event){ActionEvent a=(ActionEvent)event;posted=a.getID()+":"+a.getActionCommand()+":"+(a.getSource()==this);}
    }
    static class AudioPlayer extends dg {
        String id;ListLog log;
        AudioPlayer(String id,ListLog log){this.id=id;this.log=log;this.g=new int[256];this.E=256;this.M=0;}
        int a(){log.rows.add(id);return 0;}
    }
    static class ListLog{final java.util.List<String> rows=new ArrayList<>();}
    static void audio(fb sign)throws Exception{
        ld pump=new ld();ListLog log=new ListLog();mj.e=22050;db.v=false;
        pump.l[0]=new AudioPlayer("music",log);pump.l[1]=new AudioPlayer("fx",log);pump.a=sign;
        sign.e=new EventQueue(){int polls=0;public AWTEvent peekEvent(){log.rows.add("poll:"+pump.f);if(++polls==3)pump.j=true;return null;}};
        dj task=sign.a(2,pump,2);waitFor(task);((Thread)task.a).join(3000);if(pump.f)throw new AssertionError("audio task still running");
        System.out.println(String.join(",",log.rows)+":"+pump.f);
    }
    public static void main(String[] args)throws Exception{
        System.setProperty("java.vendor","Test Vendor");System.setProperty("java.version","1.8.53");
        System.setProperty("os.arch","TeSt64");System.setProperty("os.version","TeStBuild");System.setProperty("user.home","directory");
        fb sign=new fb(null,32,null,28);
        Field home=fb.class.getDeclaredField("i");home.setAccessible(true);
        System.out.println(String.join("|",fb.p,fb.k,fb.n,fb.g,(String)home.get(null),""+fb.f,(""+(sign.t==null && sign.m==null && sign.b==null && sign.h==null && sign.b(-106)==null))));
        try(ServerSocket server=new ServerSocket(0,1,InetAddress.getLoopbackAddress())){
            CountDownLatch entered=new CountDownLatch(1),release=new CountDownLatch(1),ran=new CountDownLatch(2);
            URL url=new URL(null,"fixture://stream",new URLStreamHandler(){protected URLConnection openConnection(URL u){return new URLConnection(u){public void connect(){}public InputStream getInputStream()throws IOException{entered.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new IOException("timed out");}catch(InterruptedException e){throw new IOException(e);}return new ByteArrayInputStream(new byte[]{(byte)191,2});}};}});
            dj hold=sign.a(102,url);if(!entered.await(5,TimeUnit.SECONDS))throw new AssertionError("queue did not enter");
            dj sock=sign.a(server.getLocalPort(),false,"127.0.0.1"),valid=sign.a(2,ran::countDown,7),invalid=sign.a(2,ran::countDown,11);
            dj method=sign.a(new Class[]{int.class},-21828,"plus",SignlinkOracle.class),bad=sign.a(new Class[]{String.class},-21828,"plus",SignlinkOracle.class);
            dj field=sign.a(SignlinkOracle.class,"probe",-26556),missing=sign.a(SignlinkOracle.class,"absent",-26556);
            Component c=new Component(){public Point getLocationOnScreen(){return new Point(10,20);}};
            dj[] work={hold,sock,valid,invalid,method,bad,field,missing,sign.a("prefs",true),sign.a((byte)26,0x7f000001),sign.a("page",(byte)-102),sign.a(c,true,true),sign.a(-1,false,4,c),sign.a(4,(byte)100,12,c,new int[]{2},new Point())};
            StringBuilder queued=new StringBuilder();for(int i=0;i<work.length;i++){dj r=work[i];queued.append(r.b+":"+r.e+":"+(i==1?"port":r.c)+":"+(r.f==(i>=1 && i+1<work.length?work[i+1]:null))+" ");}
            System.out.println(queued.toString().trim());release.countDown();
            for(dj r:work)waitFor(r);
            if(!ran.await(5,TimeUnit.SECONDS))throw new AssertionError("invalid priority still starts runnable");
            int[] states=Arrays.stream(work).mapToInt(r->r.b).toArray();System.out.println(Arrays.toString(states));
            Thread thread=(Thread)valid.a;thread.join();InputStream input=(InputStream)hold.a;
            System.out.println(input.read()+":"+input.read()+":"+input.read()+":"+thread.getPriority()+":"+thread.isDaemon()+":"+(((Method)method.a).getName())+":"+((Field)field.a).getName()+":"+(invalid.a==null && bad.a==null));
            input.close();((Socket)sock.a).close();
            sign.a(false);dj a=sign.a(server.getLocalPort(),false,"127.0.0.1"),b=sign.a(102,url);waitFor(b);
            System.out.println(a.b+":"+b.b+":"+(fb.u>System.currentTimeMillis()));
            Queue q=new Queue();sign.e=q;q.remaining=3;qj.a(-3,q,sign);System.out.println(q.peeks+":"+q.posted);q.remaining=59;q.peeks=0;q.posted="-";qj.a(-3,null,sign);System.out.println(q.peeks+":"+q.posted);
            audio(sign);
            sign.t=file("data");sign.m=file("master");sign.b=new ne[]{file("index0"),null,file("index2")};sign.h=file("random");sign.a(15);
            System.out.println(String.join(",",closed)+":"+sign.a((byte)26,7).b);
        }finally{sign.a(15);}
    }
}
