import java.io.*;
import java.lang.reflect.*;
import java.net.Socket;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.*;

class WorldListBlockingOracle extends WorldListOracle {
    static final int ROOT=190000, CHILD=190001;
    static void program(int key,int ints,int strings,int intArgs,int stringArgs,String code) throws Exception {
        var ins=code.split(" ");var script=new m();
        script.D=new int[ins.length];script.F=new int[ins.length];script.B=new id[ins.length];
        script.E=ints;script.I=strings;script.K=intArgs;script.R=stringArgs;
        for(int i=0;i<ins.length;i++) {
            var pair=ins[i].split(":",2);script.D[i]=Integer.parseInt(pair[0]);
            if(script.D[i]==3)script.B[i]=vb.a(pair[1],(byte)54);
            else if(pair.length>1)script.F[i]=Integer.parseInt(pair[1]);
        }
        sf.g.a((long)key,0,script);
    }
    static void queue(gk queue,int key) {
        wf event=new wf();event.C=new aj();event.C.bc=-1;event.G=new Object[]{key};queue.a(event,false);
    }
    static String vars() throws Exception {
        return Arrays.toString(Arrays.copyOf(od.U,4))+"/"+string(me.a[0])+"/"+string(me.a[1])+"/"+
            oi.b+"/"+mk.J[0]+"/"+string(lk.t[0])+"/"+jb.v+"/"+dg.n+"/"+wd.g+"/"+rb.a;
    }
    static final class DelayedSocket extends Socket {
        final CountDownLatch reading=new CountDownLatch(1),release=new CountDownLatch(1);
        final CountDownLatch outputRelease=new CountDownLatch(1);
        final byte[] data;int pos;boolean fail,closed,holdWriter;
        final ByteArrayOutputStream sent=new ByteArrayOutputStream();
        DelayedSocket(byte... data){this.data=data;}
        public void setTcpNoDelay(boolean v){}public void setSoTimeout(int n){}
        public OutputStream getOutputStream(){return new OutputStream(){
            public void write(int value)throws IOException{
                if(holdWriter)try{
                    if(!outputRelease.await(5,TimeUnit.SECONDS))throw new IOException("writer timed out");
                }catch(InterruptedException e){throw new IOException(e);}
                sent.write(value);
            }
        };}
        public InputStream getInputStream(){return new InputStream(){
            public int available(){return data.length-pos;}
            public int read()throws IOException {
                if(pos==0) {reading.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new IOException("hung");}
                    catch(InterruptedException e){throw new IOException(e);}}
                if(closed||fail)throw new IOException();
                return pos<data.length?data[pos++]&255:-1;
            }
            public void close(){closed=true;release.countDown();}
        };}
        public void close(){closed=true;release.countDown();}
    }
    static void stock(Object app,Method title,Path assets,boolean success)throws Exception{
        il.B=new al(new FloorConfigOracle.Provider(assets.resolve("12")),false,false);
        wf.a(null,null,true,null,new al(new FloorConfigOracle.Provider(assets.resolve("3")),false,false));
        wf install=new wf();install.G=new Object[]{1299};li.a(install,125);
        aj component=ad.a((byte)110,48759008);
        wf timer=new wf();timer.G=component.J;timer.C=component;db.s.a(timer,false);
        wd.g=1;ga.I=System.currentTimeMillis();jb.v=0;rb.a=0;ff.v=0;
        var socket=new DelayedSocket(success?new byte[]{0,0,2,1,0}:new byte[]{0});f.k=new dj();f.k.b=1;f.k.a=socket;
        FutureTask<Void> tick=new FutureTask<>(()->{title.invoke(app,(byte)94);return null;});
        var thread=new Thread(tick);thread.setDaemon(true);thread.start();
        if(!socket.reading.await(3,TimeUnit.SECONDS)){if(tick.isDone())tick.get();throw new AssertionError("missing stock read");}
        System.out.println("stock "+success+" before "+component.J[0]+"/"+jb.v);
        socket.release.countDown();tick.get(3,TimeUnit.SECONDS);
        if(ek.s!=null){ek.s.a((byte)-86);ek.s=null;}
        System.out.println("stock "+success+" after "+(component.J==null?"~":component.J[0])+"/"+jb.v+"/"+hex.formatHex(socket.sent.toByteArray()));
    }
    public static void main(String[] args)throws Exception{
        var unsafe=Class.forName("sun.misc.Unsafe");var singleton=unsafe.getDeclaredField("theUnsafe");singleton.setAccessible(true);
        var alloc=unsafe.getMethod("allocateInstance",Class.class);
        tj.m=(fb)alloc.invoke(singleton.get(null),fb.class);var worker=new Thread(tj.m);worker.setDaemon(true);worker.start();
        var app=alloc.invoke(singleton.get(null),client.class);
        var title=client.class.getDeclaredMethod("g",byte.class);title.setAccessible(true);
        tf.C=10;hd.m=-1;hh.kb=1;th.h=40001;bh.g=50001;aj.Cb=40001;
        m.S=new dg();ld.k=new dg();
        String append="42:0 0:10 4002 0:%d 4000 43:0";
        program(ROOT,1,1,0,0,"0:256 34:0 3:outer 36:0 0:1 43:0 0:303 3:inner 40:"+CHILD+" 33:0 43:3 35:0 48:0 "+append.formatted(2)+" 21");
        program(CHILD,1,1,1,1,"0:17 6500 43:1 33:0 4000 43:2 35:0 48:1 21");
        for(int n=3;n<=5;n++)program(ROOT+n,1,1,0,0,append.formatted(n)+" 21");
        for(String mode:List.of("success","partial","rejected","failed","closed","writer","replaceStack")){
            Arrays.fill(od.U,0);Arrays.fill(me.a,null);jb.v=dg.n=0;wd.g=1;rb.a=mode.equals("rejected")?4:0;
            ga.I=System.currentTimeMillis();kc.i=0;ag.j=null;ff.v=0;ek.s=null;f.k=new dj();f.k.b=1;
            var socket=new DelayedSocket(mode.equals("success")||mode.equals("writer")?new byte[]{0,0,2,1,0}:mode.equals("rejected")?new byte[]{17}:new byte[]{0});
            socket.holdWriter=mode.equals("writer");
            socket.fail=mode.equals("failed");f.k.a=socket;
            queue(db.s,ROOT);queue(ra.r,ROOT+4);queue(mi.q,ROOT+5);
            FutureTask<Void> tick=new FutureTask<>(()->{title.invoke(app,(byte)94);return null;});
            var game=new Thread(tick);game.setDaemon(true);game.start();
            if(!socket.reading.await(3,TimeUnit.SECONDS)){
                if(tick.isDone())tick.get();throw new AssertionError("hello never read");
            }
            System.out.println(mode+" before "+vars()+"/"+kc.p[0].i);
            queue(db.s,ROOT+3);
            int[] original=tg.B;
            if(mode.equals("replaceStack")) { tg.B=new int[1000];Arrays.fill(tg.B,7119); }
            if(mode.equals("closed"))ek.s.a((byte)-86);else socket.release.countDown();
            if(socket.holdWriter){
                long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(3);
                while(Arrays.stream(game.getStackTrace()).noneMatch(f->f.getMethodName().equals("join"))){
                    if(System.nanoTime()>deadline)throw new AssertionError("writer not joined");Thread.sleep(1);
                }
                System.out.println(mode+" joining "+vars()+"/"+socket.sent.size());
                socket.outputRelease.countDown();
            }
            tick.get(3,TimeUnit.SECONDS);
            if(ek.s!=null){ek.s.a((byte)-86);ek.s=null;}
            System.out.println(mode+" after "+vars()+"/"+hex.formatHex(socket.sent.toByteArray()));
            if(mode.equals("replaceStack")) { System.out.println("previous slot "+original[1]);tg.B=original; }
        }
        if(args.length>0) {
            stock(app,title,Path.of(args[0]),false);
            stock(app,title,Path.of(args[0]),true);
        }
    }
}
