import java.io.*;
import java.lang.reflect.*;
import java.net.Socket;
import java.util.*;

class WorldListOracle {
    static final Class<?> I = int.class, B = byte.class, Z = boolean.class;
    static final HexFormat hex = HexFormat.of();
    static int scriptId = 100000;
    static TestSocket socket;
    static Field field(String key) throws Exception {
        var p = key.split("\\."); var f = Class.forName(p[0]).getDeclaredField(p[1]); f.setAccessible(true); return f;
    }
    static Method method(String key, Class<?>... types) throws Exception {
        var p = key.split("\\."); var m = Class.forName(p[0]).getDeclaredMethod(p[1],types); m.setAccessible(true); return m;
    }
    static Object get(String key) throws Exception { return field(key).get(null); }
    static void set(String key, Object value) throws Exception { field(key).set(null,value); }
    static Object create(String owner, Class<?>[] types, Object... args) throws Exception {
        var ctor = Class.forName(owner).getDeclaredConstructor(types); ctor.setAccessible(true); return ctor.newInstance(args);
    }
    static Object create(String owner) throws Exception { return create(owner,new Class<?>[]{}); }
    static class TestSocket extends Socket {
        int visible, position;
        boolean advanceClock;
        final byte[] bytes;
        TestSocket(byte[] bytes) { this.bytes = bytes; }
        public void setSoTimeout(int ms) {}
        public void setTcpNoDelay(boolean b) {}
        public InputStream getInputStream() {
            return new InputStream() {
                public int available() { return visible; }
                public int read() {
                    if(advanceClock) {
                        advanceClock=false;
                        try{set("eh.b",(Long)get("eh.b")+12000L);}catch(Exception e){throw new AssertionError(e);}
                    }
                    if (visible < 1) return -1; visible--; return bytes[position++] & 255;
                }
            };
        }
        public OutputStream getOutputStream() { return OutputStream.nullOutputStream(); }
    }
    static String string(Object value) throws Exception {
        if (value == null) return "~";
        return hex.formatHex((byte[])field("id.A").get(value),0,field("id.c").getInt(value));
    }
    static String rows(String table) throws Exception {
        Object[] rows = (Object[])get(table);
        if (rows == null) return "~";
        var out = new StringJoiner("|");
        for (Object row : rows) {
            if (row == null) { out.add("~"); continue; }
            if (table.equals("oc.d")) out.add(field("oa.d").get(row) + ":" + string(field("oa.l").get(row)));
            else if (table.equals("ke.y")) out.add(field("qk.w").get(row).toString());
            else out.add(field("qk.w").get(row)+":"+field("ka.j").get(row)+":"+field("ka.r").get(row)+":"+field("ka.q").get(row)+":"+
                string(field("qk.y").get(row))+":"+string(field("qk.D").get(row)));
        }
        return out.toString();
    }
    static void log(String result) throws Exception {
        var out = new StringJoiner(";");
        out.add(result);
        for (String key : new String[]{"ph.j","dg.a","ff.v","qa.U","s.O","tf.K","rb.a","wd.g","ec.i","bc.b"}) out.add(get(key).toString());
        for (String key : new String[]{"oc.d","oc.i","ke.y"}) out.add(rows(key));
        byte[] body = (byte[])get("ag.j"); out.add(body == null ? "~" : hex.formatHex(body));
        var pkt = get("qk.v");
        out.add(hex.formatHex((byte[])field("gd.fb").get(pkt),0,field("gd.yb").getInt(pkt)));
        out.add(""+get("aj.Cb"));
        out.add(""+get("dg.n"));
        System.out.println(out);
    }
    static String runScript(String[] parts) throws Exception {
        var insns = parts[1].split(",");
        var ops = new int[insns.length+1]; var operands = new int[ops.length];
        for (int n=0;n<insns.length;n++) {
            var pair=insns[n].split(":"); ops[n]=Integer.parseInt(pair[0]);
            if(pair.length>1) operands[n]=Integer.parseInt(pair[1]);
        }
        ops[insns.length]=21;
        var script = create("m"); field("m.D").set(script,ops); field("m.F").set(script,operands);
        var id = scriptId++;
        method("vj.a",long.class,I,Class.forName("ei")).invoke(get("sf.g"),(long)id,0,script);
        var event=create("wf"); field("wf.G").set(event,new Object[]{id});
        int[] ints=(int[])get("tg.B"); Object[] strings=(Object[])get("g.p");
        Arrays.fill(ints,0x12345678); Arrays.fill(strings,null);
        PrintStream console=System.out;
        try (PrintStream quiet = new PrintStream(OutputStream.nullOutputStream())) {
            System.setOut(quiet);
            method("gh.a",event.getClass(),I,I).invoke(null,event,-22368,200000);
        } finally { System.setOut(console); }
        var result=new StringJoiner(",");
        for(int n=0;n<Integer.parseInt(parts[2]);n++) result.add(""+ints[n]);
        for(int n=0;n<Integer.parseInt(parts[3]);n++) result.add(string(strings[n]));
        return result.toString();
    }
    public static void main(String[] args) throws Exception {
        // Use SignLink's writer-thread service without invoking its cache-directory
        // constructor. Connection-opening tasks below are supplied by the fixture.
        var type=Class.forName("sun.misc.Unsafe");
        var singleton=type.getDeclaredField("theUnsafe"); singleton.setAccessible(true);
        var platform=type.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),Class.forName("fb"));
        set("tj.m",platform); var thread=new Thread((Runnable)platform); thread.setDaemon(true); thread.start();
        set("th.h",40001); set("bh.g",50001); set("aj.Cb",40001);
        set("tf.C",10); set("fb.f",2); set("d.c",2);
        var tick=method("jb.c",I);
        set("m.S",create("dg"));set("ld.k",create("dg"));
        var reader=new BufferedReader(new InputStreamReader(System.in));
        for(String line;(line=reader.readLine())!=null;) {
            String[] p=line.split(" "); String result="ok";
            set("dg.n",0);
            try {
                switch(p[0]) {
                    case "parse" -> result=method("ma.a",byte[].class,I).invoke(null,hex.parseHex(p[1]),1).toString();
                    case "open" -> {
                        socket=new TestSocket(hex.parseHex(p[1]));
                        var task=create("dj"); field("dj.a").set(task,socket); field("dj.b").setInt(task,1);
                        set("f.k",task); set("wd.g",1); set("ga.I",System.currentTimeMillis()); socket.visible=1;
                        result=tick.invoke(null,-1).toString();
                    }
                    case "more" -> { socket.visible+=Integer.parseInt(p[1]); result=tick.invoke(null,-1).toString(); }
                    case "slow" -> {
                        socket.visible+=Integer.parseInt(p[1]);socket.advanceClock=true;
                        result=tick.invoke(null,-1)+":"+((Long)get("kc.i")-(Long)get("ga.I")>=12000L);
                    }
                    case "fresh" -> { set("kc.i",System.currentTimeMillis()); result=tick.invoke(null,-1).toString(); }
                    case "failed","timeout" -> {
                        var task=create("dj"); field("dj.b").setInt(task,2);
                        set("f.k",task); set("wd.g",1); set("ga.I",p[0].equals("timeout")?0L:System.currentTimeMillis());
                        result=tick.invoke(null,-1).toString();
                    }
                    case "sort" -> method("se.a",Z,B,I,I,Z).invoke(null,p[4].equals("1"),(byte)-113,Integer.valueOf(p[1]),Integer.valueOf(p[3]),p[2].equals("1"));
                    case "port" -> set("aj.Cb",Integer.parseInt(p[1]));
                    case "country" -> field("ka.j").setInt(method("ii.b",I,I).invoke(null,Integer.valueOf(p[1]),-63),Integer.parseInt(p[2]));
                    case "session" -> {
                        set("tf.C",Integer.parseInt(p[1]));set("pe.P",Integer.parseInt(p[2]));
                        set("od.O",Integer.parseInt(p[3]));set("t.L",Integer.parseInt(p[4]));
                    }
                    case "script", "scriptNow" -> {set("jb.v",0);result=runScript(p)+"/"+get("jb.v");}
                    case "switch" -> result=method("fd.a",I,I).invoke(null,Integer.valueOf(p[1]),32)+":"+get("sd.T")+":"+get("qj.C")+":"+get("ag.f")+":"+get("aa.a")+":"+get("ie.r");
                    default -> throw new AssertionError(line);
                }
            } catch(InvocationTargetException e) { result="runtime"; }
            log(result);
        }
    }
}
