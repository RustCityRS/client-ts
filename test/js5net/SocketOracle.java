import java.io.*;
import java.lang.reflect.*;
import java.net.Socket;
import java.security.MessageDigest;
import java.util.HexFormat;

class SocketOracle {
    static class Transport extends Socket {
        int timeout, flushes, writes;
        boolean tcpNoDelay, inputClosed, outputClosed, closed, failFlush;
        final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        final InputStream input = new ByteArrayInputStream(new byte[]{7,1,2,3,4}) {
            public int read(byte[] b, int off, int len) {
                return super.read(b, off, Math.min(2,len));
            }
            public void close() { inputClosed = true; }
        };
        final OutputStream output = new OutputStream() {
            public void write(int i) { throw new AssertionError(); }
            public void write(byte[] b, int off, int len) { writes++; bytes.write(b,off,len); }
            public void flush() throws IOException {
                flushes++;
                if (failFlush) throw new IOException();
            }
            public void close() { outputClosed = true; }
        };
        public InputStream getInputStream() { return input; }
        public OutputStream getOutputStream() { return output; }
        public void setSoTimeout(int timeout) { this.timeout = timeout; }
        public void setTcpNoDelay(boolean value) { tcpNoDelay = value; }
        public void close() { closed = true; }
    }
    static final Class<?> streamClass;
    static final Transport socket = new Transport();
    static final Object stream;
    static final byte[] dest = {88,88,88,88,88};
    static Thread writer;
    static {
        try {
            streamClass = Class.forName("se");
            var ctor = streamClass.getDeclaredConstructor(Socket.class, Class.forName("fb"));
            ctor.setAccessible(true);
            stream = ctor.newInstance(socket,null);
        } catch(Exception e) { throw new ExceptionInInitializerError(e); }
    }
    static Field field(Class<?> owner, String name) throws Exception {
        var f = owner.getDeclaredField(name); f.setAccessible(true); return f;
    }
    static Object get(String key) throws Exception { return field(streamClass,key).get(stream); }
    static Method method(String name, Class<?>... types) throws Exception {
        var m = streamClass.getDeclaredMethod(name,types); m.setAccessible(true); return m;
    }
    static String hash(byte[] b) throws Exception {
        return b == null ? "null" : HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));
    }
    static void log(String value) throws Exception {
        System.out.println(String.join(";", value, ""+get("m"), ""+get("q"), ""+get("o"), ""+get("y"), hash((byte[])get("B")),
            hash(socket.bytes.toByteArray()), ""+socket.writes, ""+socket.flushes, ""+socket.closed, ""+socket.inputClosed,
            ""+socket.outputClosed, HexFormat.of().formatHex(dest), ""+method("a",int.class).invoke(stream,0)));
    }
    static void invoke(boolean idle, Method m, Object... args) throws Exception {
        String result;
        try { var r = m.invoke(stream,args); result = r == null ? "ok" : r.toString(); }
        catch (InvocationTargetException wrapped) {
            var e = wrapped.getCause(); result = e instanceof IOException ? "io" : "runtime";
        }
        if (idle) waitIdle();
        log(result);
    }
    static void waitIdle() throws Exception {
        long until = System.nanoTime()+2_000_000_000L;
        while (writer.getState() != Thread.State.WAITING || !get("q").equals(get("o"))) {
            if (System.nanoTime() > until) throw new AssertionError("writer did not idle");
            Thread.sleep(1);
        }
    }
    public static void main(String[] args) throws Exception {
        writer = new Thread((Runnable)stream); writer.setDaemon(true);
        var tc = Class.forName("dj");
        var ctor = tc.getDeclaredConstructor(); ctor.setAccessible(true);
        var task = ctor.newInstance();
        field(tc,"a").set(task,writer); field(tc,"b").setInt(task,1);
        field(streamClass,"n").set(stream,task);
        var i = int.class;
        var write = method("a",i,byte[].class,i,byte.class);
        var read = method("a",byte.class,byte[].class,i,i);
        var one = method("d",i); var check = method("b",i);
        var close = method("a",byte.class);
        if (socket.timeout != 30000 || !socket.tcpNoDelay) throw new AssertionError();
        log("init");
        invoke(false,one,17506);
        invoke(false,read,(byte)-115,dest,1,3);
        invoke(false,read,(byte)-115,dest,1,2);
        invoke(false,one,17506);
        byte[] bytes = new byte[5000];
        for (int n = 0; n < bytes.length; n++) bytes[n] = (byte)(n*37+19);
        invoke(false,write,2,bytes,4896,(byte)92);
        invoke(false,write,4999,bytes,3,(byte)92);
        invoke(false,write,2,bytes,5,(byte)92);
        writer.start(); waitIdle(); log("drain");
        invoke(true,write,14,bytes,119,(byte)92);
        socket.failFlush = true;
        invoke(true,write,5,bytes,13,(byte)92);
        invoke(false,check,5000);
        invoke(false,check,5000);
        invoke(true,write,8,bytes,16,(byte)92);
        invoke(false,write,12,bytes,3,(byte)92);
        socket.failFlush = false;
        invoke(false,method("c",i),3);
        invoke(true,write,8,bytes,6,(byte)92);
        invoke(false,check,5000);
        invoke(false,close,(byte)119);
        invoke(false,one,17506);
        invoke(false,read,(byte)-115,dest,-1,37);
        invoke(false,write,-1,bytes,30000,(byte)92);
        invoke(false,method("finalize"));
    }
}
