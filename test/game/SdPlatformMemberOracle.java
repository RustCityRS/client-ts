import java.awt.Canvas;
import java.awt.event.*;
import java.awt.image.ImageConsumer;
import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import jdk.jfr.Recording;
import jdk.jfr.consumer.RecordingFile;

public final class SdPlatformMemberOracle {
    static Field field(Class<?> cls, String name) throws Exception {
        Field f = cls.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    static void row(Object... values) {
        System.out.println(String.join("|", Arrays.stream(values).map(String::valueOf).toList()));
    }
    static class Actor extends ob {
        int b(int guard) { throw new AssertionError(); }
        int b() { throw new AssertionError(); }
        void a(int a,int b,int c,int d,int e) { throw new AssertionError(); }
        void a(int a,int b,int c,int d,int e,int f,int g,int h,long i,int j,ue k) { throw new AssertionError(); }
    }
    static void defaults() throws Exception {
        pd text = new pd(); ui number = new ui();
        row("entries",text.q,text.k,text.g,text.p,number.B,number.k,number.g,number.p);
        jd texture = new jd(), other = new jd();
        bf[] ops = (bf[])field(jd.class,"c").get(texture);
        Object colour = field(jd.class,"f").get(texture), alpha = field(jd.class,"h").get(texture);
        int[] textures = (int[])field(jd.class,"a").get(texture), sprites = (int[])field(jd.class,"p").get(texture);
        row("texture",ops.length,ops[0]==colour,ops[1]==alpha,colour!=alpha,textures.length,sprites.length,textures!=sprites,
            field(jd.class,"a").get(other)!=textures,field(jd.class,"f").get(other)!=colour);
        for (bf op:ops) row("fill",op instanceof ri,op.K,op.L,op.z.length,field(ri.class,"O").get(op));
        Actor actor = new Actor(), neighbor = new Actor();
        actor.L[0]=81;neighbor.L[0]=35;
        for(boolean hide:new boolean[]{false,true}) {
            actor.a(neighbor,-3,0,Integer.MAX_VALUE,hide);
            actor.a(null,Integer.MIN_VALUE,5,2,!hide);
            row("model",actor.a(23,-7,0)==actor,neighbor.a(-1,2,3)==neighbor,actor.d((byte)62),actor.d((byte)0),actor.L[0],neighbor.L[0]);
        }
        ue particles = new ue();
        for(int detail:new int[]{0,2}) { ue.c(detail);particles.b();row("particles",ue.a()); }
    }
    static void pixmap() throws Exception {
        ck source=new ck(); int[] calls={0};
        ImageConsumer a=(ImageConsumer)Proxy.newProxyInstance(SdPlatformMemberOracle.class.getClassLoader(),new Class[]{ImageConsumer.class},
            (p,m,v)->{calls[0]++;return null;});
        ImageConsumer b=(ImageConsumer)Proxy.newProxyInstance(SdPlatformMemberOracle.class.getClassLoader(),new Class[]{ImageConsumer.class},
            (p,m,v)->{throw new AssertionError();});
        for(int state=0;state<3;state++){
            if(state==1)source.addConsumer(a);
            if(state==2)source.removeConsumer(a);
            source.requestTopDownLeftRightResend(b);source.requestTopDownLeftRightResend(null);
            row("image",state,source.isConsumer(null),source.isConsumer(a),source.isConsumer(b),calls[0]);
        }
    }
    static void shell() throws Exception {
        client shell = new client();
        row("applet", shell instanceof p, field(p.class,"o").get(shell), new client()!=shell);
        FocusEvent event = new FocusEvent(new Canvas(),FocusEvent.FOCUS_GAINED);
        for (boolean focus : new boolean[]{false,true}) {
            qd.u=focus;hi.g=false;
            shell.focusLost(event);row("lost",qd.u,hi.g);
            shell.focusGained(null);row("gained",qd.u,hi.g);
            shell.focusLost(null);row("lost",qd.u,hi.g);
            for(String name:new String[]{"windowOpened","windowActivated","windowIconified","windowDeiconified","windowDeactivated","windowClosed"}){
                qd.u=focus;hi.g=!focus;
                p.class.getMethod(name,WindowEvent.class).invoke(shell,(Object)null);
                row(name,qd.u,hi.g,field(p.class,"o").get(shell));
            }
        }
        wk.d=new ej(); hh.kb=86;mi.A=17;je.ib=9;kf.l=34;
        for(int state:new int[]{1000,20,20,1000}){
            tf.C=state;shell.a(121);row("mainloop",state,tf.C,hh.kb,mi.A,je.ib,kf.l);
        }
        tf.C=20;wk.d=null;
        try {shell.a(121);throw new AssertionError();}
        catch(g e){row("mainloop-error",e.a instanceof NullPointerException,e.q,hh.kb,mi.A,je.ib);}
        tf.C=20;sa.w=57;e.f=18;qi.S=42;af.J=new byte[1][][];
        wb.f(25);
        row("map",tf.C,sa.w,e.f,qi.S,af.J==null);
    }
    static void timer() throws Exception {
        bl timer=new bl();Field next=field(bl.class,"j");
        for(int ms:new int[]{-20000,-120000,-1400000}){
            long before=System.nanoTime(), start=before+ms*1000000L;
            next.setLong(timer,start);
            int ticks=timer.a((byte)71,0,100000);
            long end=next.getLong(timer);
            row("nano",ms,ticks,end==start+ticks*100000000000L,end>=before);
        }
    }
    static void locations() {
        mc.a(4,12,12,3,false);
        tb.t=new byte[4][12][12];
        hc.c=new ke[]{new ke(12,12),new ke(12,12),new ke(12,12),new ke(12,12)};
        jb type=new jb(); type.qb=1;
        he.w.a(17L,type,(byte)-71); he.w.a(0L,new jb(),(byte)-71);
        long key=17L<<32|22L<<14|3L<<20;
        for(int action=0; action<5; action++) {
            int plane=1,x=4,z=5;
            vf.a(plane,x,z,0,new Actor(),key,false);
            hc.c[plane].d[x][z]=0x40008;
            rj.l=action!=1;sb.h=0;lf.i=false;
            tb.t[1][x][z]=(byte)(action==2?2:0);
            o.a(22,plane,action==4?17:-1,(byte)-26,3,action==3?0:x,3,z);
            row("loc",action,dd.a(plane,x,z),hc.c[plane].d[x][z],lf.i);
        }
    }
    static void file(Path path) throws Throwable {
        ne handle=new ne();java.io.File logical=new java.io.File("sd-member-cache");
        field(ne.class,"c").set(handle,logical);
        try(RandomAccessFile raf=new RandomAccessFile(path.toFile(),"rw")) {
            field(ne.class,"d").set(handle,raf);
            for(int i=0;i<2;i++){
                handle.finalize();
                boolean open=raf.getFD().valid();
                row("finalize",i,open,field(ne.class,"d").get(handle)==null,field(ne.class,"c").get(handle)==logical);
            }
        }
    }
    static void brokenStream(Path recording) throws Exception {
        lf input = new lf();
        try (Recording session = new Recording()) {
            session.enable("jdk.ThreadSleep").withThreshold(java.time.Duration.ZERO);
            session.start();
            int[] result = { -9 };
            Thread reader = new Thread(() -> result[0] = input.read(), "sd-member-eof");
            reader.start();
            // Shorten the 29,999 ms host wait only after the JVM enters Thread.sleep.
            long timeout = System.nanoTime() + 5000000000L;
            while(reader.getState()!=Thread.State.TIMED_WAITING) {
                if(System.nanoTime()>timeout)throw new AssertionError("reader did not sleep");
                Thread.yield();
            }
            reader.interrupt(); reader.join();
            session.stop(); session.dump(recording);
            var waits=RecordingFile.readAllEvents(recording).stream()
                .filter(e->e.getEventType().getName().equals("jdk.ThreadSleep") && e.getThread().getJavaName().equals("sd-member-eof"))
                .map(e->e.getDuration("time").toMillis()).toList();
            row("eof",result[0],waits);
        }
    }
    public static void main(String[] args) throws Throwable {
        defaults(); pixmap(); shell(); locations(); timer(); file(Path.of(args[0])); brokenStream(Path.of(args[1]));
    }
}
