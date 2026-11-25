import java.applet.Applet;
import java.awt.Canvas;
import java.awt.Component;
import java.awt.Container;
import java.awt.event.FocusListener;
import java.io.*;
import java.lang.reflect.*;
import sun.misc.Unsafe;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

// No class-file instrumentation. The production p.a(IZ)V, fb.a(I)V, ne.a(I)V
// and their catch blocks run directly. AWT and the abstract lifecycle methods
// provide callbacks which can change the shared canvas and Signlink.
public class ShellShutdownOracle {
    private static final Method quit;
    private static final Field stopped;
    private static final Unsafe unsafe;
    private static final StringBuilder trace = new StringBuilder();
    private static final Surface[] canvases = {new Surface(0), new Surface(1)};
    private static final Parent[] parents = {new Parent(0), new Parent(1)};
    private static final fb[] links = new fb[2];
    private static final Host[] hosts = new Host[2];
    private static Shell shell;
    private static int trigger, action, events;
    private static boolean clean;
    private static g original;
    private static CountDownLatch paused, resume;
    static {
        try {
            quit=p.class.getDeclaredMethod("a",int.class,boolean.class);quit.setAccessible(true);
            stopped=fb.class.getDeclaredField("q");stopped.setAccessible(true);
            var f=Unsafe.class.getDeclaredField("theUnsafe");f.setAccessible(true);unsafe=(Unsafe)f.get(null);
        } catch (ReflectiveOperationException e) {throw new AssertionError(e);}
    }
    private static <T> T blank(Class<T> c) throws InstantiationException {return c.cast(unsafe.allocateInstance(c));}
    private static String canvasId(Component c) {return c==null?"-":c==canvases[0]?"0":"1";}
    private static String linkId(fb f) {return f==null?"-":f==links[0]?"0":"1";}
    private static void call(boolean value) throws Throwable {
        try {quit.invoke(shell,-864,value);}catch(InvocationTargetException e){throw e.getCause();}
    }
    @SuppressWarnings("unchecked") private static <T extends Throwable> void raise(Throwable t) throws T {throw (T)t;}
    private static void event(String value) {
        trace.append(value).append(';');
        if ((trigger==-2 && value.equals("quit")) || (trigger==-3 && value.equals("destroy0"))) {
            paused.countDown();
            try { if(!resume.await(4,TimeUnit.SECONDS)) throw new AssertionError("shutdown monitor held during callback"); }
            catch(InterruptedException e) {throw new AssertionError(e);}
        }
        if(++events!=trigger) return;
        switch(action) {
            case 1 -> throw new IllegalStateException("callback");
            case 2 -> throw original;
            case 3 -> throw new AssertionError("callback");
            case 4, 12 -> ShellShutdownOracle.<RuntimeException>raise(new IOException("callback"));
            case 13 -> ShellShutdownOracle.<RuntimeException>raise(new javax.sound.sampled.LineUnavailableException("callback"));
            case 14 -> ShellShutdownOracle.<RuntimeException>raise(new ClassNotFoundException("callback"));
            case 5 -> pe.S=canvases[1];
            case 6 -> pe.S=null;
            case 7 -> tj.m=links[1];
            case 8 -> tj.m=null;
            case 9 -> canvases[1].parent=null;
            case 10 -> {try {call(!clean);} catch(Throwable t){throw new AssertionError(t);} }
            case 11 -> {pe.S=canvases[1];tj.m=links[1];}
        }
    }
    static class Shell extends p {
        public void init() {}
        void a(int n) {}
        void b(byte b) {}
        void d(int n) {}
        void c(int n) {event("quit");}
        void a(boolean full) {event("release:"+full);}
    }
    static class Host extends Applet {
        int id;
        public void destroy(){event("destroy"+id);}
    }
    static class Surface extends Canvas {
        final int id;
        Parent parent;
        Surface(int id){this.id=id;}
        public void removeFocusListener(FocusListener l){event("focus"+id+":"+(l==shell));}
        public Container getParent(){event("parent"+id);return parent;}
    }
    static class Parent extends Container {
        final int id;
        Parent(int id){this.id=id;}
        public void remove(Component c){event("remove"+id+":"+canvasId(c));}
    }
    static class CloseProbe extends RandomAccessFile {
        int id;
        // The fixture allocates this test endpoint without opening an OS file.
        private CloseProbe() throws IOException {super("","r");}
        public void close() {event("stop"+id);}
    }
    private static void prepare(int flags) throws Exception {
        var thread=fb.class.getDeclaredField("a");thread.setAccessible(true);
        var file=ne.class.getDeclaredField("d");file.setAccessible(true);
        for(int i=0;i<2;i++) {
            var link=links[i]=blank(fb.class);
            thread.set(link,new Thread());
            link.o=(flags&2)!=0?null:(flags&4)!=0?shell:hosts[i];
            var endpoint=blank(CloseProbe.class);endpoint.id=i;
            link.t=blank(ne.class);file.set(link.t,endpoint);
            canvases[i].parent=(flags&16)!=0?null:parents[i];
        }
        tj.m=(flags&1)!=0?null:links[0];
        g.r=(flags&32)!=0;tb.h=null;pe.S=(flags&8)!=0?null:canvases[0];
        jg.k=shell;original=od.a(new IllegalStateException("wrapped"),"origin");
    }
    private static String result(Throwable e) {
        if(e instanceof g wrapped) return (e==original?"same:":"wrap:")+wrapped.q+"/"+result(wrapped.a);
        if(e instanceof NullPointerException)return "null";
        if(e instanceof IOException)return "io";
        if(e instanceof javax.sound.sampled.LineUnavailableException)return "line";
        if(e instanceof ClassNotFoundException)return "class";
        if(e instanceof AssertionError)return "error";
        return "runtime";
    }
    public static void main(String[] args) throws Exception {
        var output=System.out;
        var log=new ByteArrayOutputStream();
        System.setOut(new PrintStream(log) {
            public void println(String value) {
                if (value.startsWith("Shutdown complete - clean:")) event("log:"+value);
                super.println(value);
            }
        });
        shell=WindowModeOracle.container(Shell.class);
        for(int i=0;i<2;i++){hosts[i]=WindowModeOracle.container(Host.class);hosts[i].id=i;}
        try(var input=new BufferedReader(new InputStreamReader(System.in))){
            for(String line;(line=input.readLine())!=null;){
                String[] parts=line.split(" ");
                int flags=Integer.parseInt(parts[0]);
                trigger=Integer.parseInt(parts[1]);action=Integer.parseInt(parts[2]);clean=parts[3].equals("1");
                prepare(flags);trace.setLength(0);events=0;log.reset();
                String first="ok",again="ok";
                if(trigger<0) {
                    paused=new CountDownLatch(1);resume=new CountDownLatch(1);
                    var error=new AtomicReference<Throwable>();
                    var firstCaller=new Thread(()->{try{call(clean);}catch(Throwable t){error.set(t);}});
                    firstCaller.start();
                    try {
                        if(!paused.await(3,TimeUnit.SECONDS)) throw new AssertionError("first shutdown did not enter callback");
                        try{call(!clean);}catch(Throwable t){again=result(t);}
                        pe.S=canvases[1];tj.m=links[1];
                    } finally {resume.countDown();firstCaller.join();}
                    if(error.get()!=null) first=result(error.get());
                } else {
                    try{call(clean);}catch(Throwable t){first=result(t);}
                    try{call(!clean);}catch(Throwable t){again=result(t);}
                }
                output.println(first+"|"+again+"|"+trace+"|"+g.r+","+canvasId(pe.S)+","+linkId(tj.m)+","+
                    stopped.getBoolean(links[0])+","+stopped.getBoolean(links[1])+"|"+log.toString().trim());
            }
        }
    }
}
