import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.Socket;
import java.util.HexFormat;

class Js5ConnectionOracle {
    static Field field(String owner,String member)throws Exception{
        Field f=Class.forName(owner).getDeclaredField(member);f.setAccessible(true);return f;
    }
    static Object get(String owner,String member)throws Exception{return field(owner,member).get(null);}
    static void set(String owner,String member,Object value)throws Exception{field(owner,member).set(null,value);}
    static Object allocate(String name)throws Exception{
        var unsafe=Class.forName("sun.misc.Unsafe");
        var instance=unsafe.getDeclaredField("theUnsafe");instance.setAccessible(true);
        return unsafe.getMethod("allocateInstance",Class.class).invoke(instance.get(null),Class.forName(name));
    }
    static int reply=-1;
    static class FixtureSocket extends Socket{
        boolean bad;
        FixtureSocket(boolean bad){this.bad=bad;}
        public void setSoTimeout(int timeout)throws java.net.SocketException{if(bad)throw new java.net.SocketException();}
        public void setTcpNoDelay(boolean b){}
        public InputStream getInputStream(){return new InputStream(){
            public int available(){return reply<0?0:1;}
            public int read(){int result=reply;reply=-1;return result;}
        };}
        public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
    }
    static String request(Object req,Object stream)throws Exception{
        if(req==null)return "-";
        Object arg=field("dj","d").get(req);
        return field("dj","e").getInt(req)+":"+field("dj","c").getInt(req)+":"+(arg==stream?"self":arg)+":"+field("dj","b").getInt(req);
    }
    static void log(Object previous)throws Exception{
        var queue=get("wk","d");var connecting=get("hl","H");var active=field("ej","B").get(queue);
        var stream=connecting!=null?connecting:active!=null?active:previous;
        String writer="-",bytes="-",closed="-";
        if(stream!=null){
            writer=request(field("se","n").get(stream),stream);
            var buffer=(byte[])field("se","B").get(stream);
            bytes=buffer==null?"-":HexFormat.of().formatHex(buffer,0,field("se","o").getInt(stream));
            closed=""+field("se","m").getBoolean(stream);
        }
        System.out.println(get("je","T")+";"+get("ie","r")+";"+field("ej","G").getInt(queue)+";"+field("ej","F").getInt(queue)+";"+
            request(get("te","f"),null)+";"+(connecting!=null)+";"+(active!=null)+";"+writer+";"+bytes+";"+closed);
    }
    static void ready(boolean broken)throws Exception{
        Object req=get("te","f");field("dj","a").set(req,new FixtureSocket(broken));field("dj","b").setInt(req,1);
    }
    // Exercise client.g -> ej.g -> client.b while keeping the native applet error screen and port state.
    static void errors(Object client, String[] args) throws Exception {
        var original = System.out;
        String[] shown = {"-"};
        System.setOut(new java.io.PrintStream(java.io.OutputStream.nullOutputStream()) {
            public void println(String line) {
                try { shown[0] = line + "@" + get("tf", "C"); }
                catch (Exception e) { throw new AssertionError(e); }
            }
        });
        var ctor = Class.forName("ej").getDeclaredConstructor();
        ctor.setAccessible(true);
        var tick = client.getClass().getDeclaredMethod("g", int.class);
        tick.setAccessible(true);
        var request = Class.forName("ej").getDeclaredMethod("a", byte.class, int.class, int.class, byte.class, boolean.class);
        request.setAccessible(true);
        set("ag", "f", 40231);
        set("aa", "a", 50231);
        for (int i = 1; i < args.length; i++) {
            int[] v = java.util.Arrays.stream(args[i].split(",")).mapToInt(Integer::parseInt).toArray();
            Object queue = ctor.newInstance();
            set("wk", "d", queue);
            field("ej", "G").setInt(queue, v[0]);
            field("ej", "F").setInt(queue, v[1]);
            set("tf", "C", v[2]);
            set("sj", "M", v[3]);
            set("mc", "X", v[4]);
            set("ie", "r", v[5]);
            field("p", "o").setBoolean(client, v[6] != 0);
            if (v[7] != 0) request.invoke(queue, (byte)0, 7, 8, (byte)-80, true);
            set("je", "T", -1);
            shown[0] = "-";
            tick.invoke(client, 3524);
            original.println(shown[0] + " " + field("p", "o").getBoolean(client) + " " + get("tf", "C") + " " +
                get("sj", "M") + " " + get("mc", "X") + " " + get("ie", "r") + " " + get("je", "T"));
        }
        System.setOut(original);
    }
    static void handshakes(Object client, Method connect, String[] args) throws Exception {
        Object link = allocate("fb");
        set("tj", "m", link);
        var queueConstructor = Class.forName("ej").getDeclaredConstructor();
        queueConstructor.setAccessible(true);
        var streamConstructor = Class.forName("se").getDeclaredConstructor(Socket.class, Class.forName("fb"));
        streamConstructor.setAccessible(true);
        for (int i = 1; i < args.length; i++) {
            int[] v = java.util.Arrays.stream(args[i].split(",")).mapToInt(Integer::parseInt).toArray();
            Object queue = queueConstructor.newInstance();
            Object stream = streamConstructor.newInstance(new FixtureSocket(false), link);
            set("tf", "C", v[0]);
            set("wk", "d", queue);
            set("je", "T", 3);
            set("hl", "H", stream);
            set("te", "f", allocate("dj"));
            set("ha", "c", v[2] == 0 ? System.currentTimeMillis() : v[2] == 1 ? 0L : Long.MIN_VALUE);
            set("sj", "M", 0);
            reply = v[1];
            connect.invoke(client, false);
            log(stream);
        }
    }

    public static void main(String[] args)throws Exception{
        Object client=allocate("client");Method connect=client.getClass().getDeclaredMethod("b",boolean.class);connect.setAccessible(true);
        if (args.length != 0) {
            if (args[0].equals("errors")) errors(client, args);
            else handshakes(client, connect, args);
            return;
        }
        set("tj","m",allocate("fb"));set("ag","f",40231);set("aa","a",50231);set("ie","r",40231);set("sd","T","game.example");set("tf","C",30);
        var ctor=Class.forName("ej").getDeclaredConstructor();ctor.setAccessible(true);set("wk","d",ctor.newInstance());
        connect.invoke(client,false);log(null);ready(false);connect.invoke(client,false);log(null);
        var first=get("hl","H");reply=7;connect.invoke(client,false);log(first);
        connect.invoke(client,false);log(null);ready(true);connect.invoke(client,false);log(null);
        set("mc","X",0);set("sj","M",2);connect.invoke(client,false);log(null);
        ready(false);connect.invoke(client,false);log(null);reply=0;connect.invoke(client,false);log(null);
    }
}
