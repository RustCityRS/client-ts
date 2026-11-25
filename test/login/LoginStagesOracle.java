import java.io.*;
import java.lang.reflect.*;
import java.math.BigInteger;
import java.net.Socket;
import java.util.*;
import java.util.zip.CRC32;

class LoginStagesOracle {
    static final HexFormat hex=HexFormat.of();
    static Field f(String key) throws Exception {
        var p=key.split("\\."); var field=Class.forName(p[0]).getDeclaredField(p[1]); field.setAccessible(true); return field;
    }
    static Object get(String key) throws Exception {return f(key).get(null);}
    static void set(String key,Object value) throws Exception {f(key).set(null,value);}
    static Object obj(String name,Class<?>[] types,Object... args) throws Exception {
        var ctor=Class.forName(name).getDeclaredConstructor(types);ctor.setAccessible(true);return ctor.newInstance(args);
    }
    static Object call(String name,Object target,Class<?>[] types,Object... args) throws Exception {
        var p=name.split("\\.");var m=Class.forName(p[0]).getDeclaredMethod(p[1],types);m.setAccessible(true);return m.invoke(target,args);
    }
    static String packet(String name) throws Exception {
        var pkt=get(name);return hex.formatHex((byte[])f("gd.fb").get(pkt),0,f("gd.yb").getInt(pkt));
    }
    static Object string(String value) throws Exception {return call("aj.a",null,new Class<?>[]{String.class,byte.class},value,(byte)-124);}
    static byte[] input=new byte[0];
    static int cursor;
    static boolean broken;
    static String hookProbe="";
    static Socket socket() {
        return new Socket() {
            public void setSoTimeout(int time){} public void setTcpNoDelay(boolean v){}
            public InputStream getInputStream() {return new InputStream() {
                public int available() throws IOException {if(broken)throw new IOException();return input.length-cursor;}
                public int read() throws IOException {
                    try {
                        // The fixture drains no real sockets. Mark the queued writer task complete before close/join.
                        var writer=f("se.n").get(get("ek.s"));
                        if(writer!=null)f("dj.b").setInt(writer,2);
                    } catch(Exception e){throw new AssertionError(e);}
                    if(broken)throw new IOException();
                    return cursor>=input.length?-1:input[cursor++]&255;
                }
            };}
            public OutputStream getOutputStream(){return OutputStream.nullOutputStream();}
        };
    }
    static String jagBytes(Object value) throws Exception {
        return value==null?"~":hex.formatHex((byte[])f("id.A").get(value),0,f("id.c").getInt(value));
    }
    static int accountScriptId=200001;
    static String accountScript(String[] args) throws Exception {
        var instructions=args[1].split(",");
        var ops=new int[instructions.length+1];var operands=new int[ops.length];
        var strings=(Object[])Array.newInstance(Class.forName("id"),ops.length);
        for(int i=0;i<instructions.length;i++) {
            var tokens=instructions[i].split(":",2);ops[i]=Integer.parseInt(tokens[0]);
            if(ops[i]==3)strings[i]=string(tokens[1]);
            else if(tokens.length>1)operands[i]=Integer.parseInt(tokens[1]);
        }
        ops[instructions.length]=21;
        var script=obj("m",new Class<?>[]{});
        f("m.D").set(script,ops);f("m.F").set(script,operands);f("m.B").set(script,strings);
        int id=accountScriptId++;
        call("vj.a",get("sf.g"),new Class<?>[]{long.class,int.class,Class.forName("ei")},(long)id,0,script);
        var event=obj("wf",new Class<?>[]{});f("wf.G").set(event,new Object[]{id});
        call("gh.a",null,new Class<?>[]{event.getClass(),int.class,int.class},event,-22368,200000);
        var result=new StringJoiner(",");
        for(int n=0;n<Integer.parseInt(args[2]);n++)result.add(""+((int[])get("tg.B"))[n]);
        for(int n=0;n<Integer.parseInt(args[3]);n++)result.add(jagBytes(((Object[])get("g.p"))[n]));
        return result.toString();
    }
    static void account(BufferedReader reader, Random rng) throws Exception {
        set("fb.f",2);set("d.c",2);set("ce.F",0);
        set("m.S",obj("dg",new Class<?>[]{}));set("ld.k",obj("dg",new Class<?>[]{}));
        for(String line;(line=reader.readLine())!=null;) {
            var p=line.split(" ");String result="ok";
            set("dg.n",0);
            rng.setSeed(530);
            switch(p[0]) {
                case "reset" -> {
                    for(String key:"t.L gl.t ge.Q pe.P hg.b g.f od.O wd.g".split(" "))set(key,0);
                    set("tf.C",10);set("ek.s",null);set("f.k",null);set("gj.X",null);set("nb.e",-2);set("dg.h",-2);
                    set("ag.f",40001);set("aa.a",50001);set("ie.r",40001);
                    set("th.h",40001);set("bh.g",50001);set("aj.Cb",40001);
                    set("qj.C",Integer.parseInt(p[1]));set("s.O",true);set("ph.j",301);set("dg.a",301);
                    var worlds=(Object[])Array.newInstance(Class.forName("qk"),1);
                    worlds[0]=obj("qk",new Class<?>[]{});f("qk.w").setInt(worlds[0],301);f("qk.D").set(worlds[0],string("world301"));set("oc.i",worlds);
                    for(String key:new String[]{"qk.v","hd.b","wd.e"})set(key,obj("be",new Class<?>[]{int.class},5000));
                    broken=false;input=new byte[0];cursor=0;
                }
                case "script" -> result=accountScript(p);
                case "reopen" -> {} // Replacing an interface host allocates no Java account-creation state.
                case "submit" -> {
                    Object name=p[1].equals("~")?null:string(p[1].equals("_")?"":p[1]);
                    Object password=p[2].equals("~")?null:string(p[2].equals("_")?"":p[2]);
                    try { call("lg.a",null,new Class<?>[]{Class.forName("id"),Class.forName("id"),int.class,int.class},name,password,Integer.parseInt(p[3]),0); }
                    catch(InvocationTargetException ex) { result="runtime"; }
                }
                case "player" -> {
                    set("te.g",p[1].equals("null")?null:obj("pb",new Class<?>[]{}));
                    if(get("te.g")!=null && !p[1].equals("unnamed")) {
                        f("pb.Gc").set(get("te.g"),string(p[1]));
                        var prefix=(Object[])Array.newInstance(Class.forName("id"),1);
                        var suffix=(Object[])Array.newInstance(Class.forName("id"),1);
                        prefix[0]=string("Sir_");suffix[0]=string("_III");
                        set("jb.N",prefix);set("hh.bb",suffix);
                    }
                }
                case "state" -> set("tf.C",Integer.parseInt(p[1]));
                case "ready" -> {var task=get("f.k");f("dj.a").set(task,socket());f("dj.b").setInt(task,1);}
                case "refused" -> f("dj.b").setInt(get("f.k"),2);
                case "broken" -> broken=true;
                case "ports" -> {set("ie.r",Integer.parseInt(p[1]));set("aj.Cb",Integer.parseInt(p[1]));}
                case "ctime" -> set("ge.Q",2000);
                case "wtime" -> set("g.f",1500);
                case "tick" -> {
                    var rest=Arrays.copyOfRange(input,cursor,input.length);var add=p.length>1?hex.parseHex(p[1]):new byte[0];
                    input=Arrays.copyOf(rest,rest.length+add.length);
                    System.arraycopy(add,0,input,rest.length,add.length);cursor=0;
                    call("hi.a",null,new Class<?>[]{int.class},-1439);
                    call("ig.a",null,new Class<?>[]{int.class},125);
                    call("le.a",null,new Class<?>[]{int.class},-28426);
                }
                default -> throw new AssertionError(line);
            }
            var state=new StringJoiner(";");state.add(result);
            for(String key:"t.L gl.t ge.Q nb.e pe.P hg.b g.f od.O dg.h qj.C".split(" "))state.add(""+get(key));
            state.add(""+get("ie.r"));state.add(""+get("aj.Cb"));
            state.add(get("ek.s")==null?"0":"1");state.add(packet("qk.v"));state.add(""+f("gd.yb").getInt(get("hd.b")));
            var names=(Object[])get("gj.X");
            if(names==null)state.add("~");
            else {var values=new StringJoiner(",");for(var name:names)values.add(jagBytes(name));state.add(values.toString());}
            state.add(jagBytes(get("ga.G")));state.add(jagBytes(get("ga.F")));state.add(""+get("fk.cb"));
            state.add(""+get("dg.n"));
            System.out.println(state);
        }
    }
    static void states(BufferedReader reader) throws Exception {
        set("tf.C",0);set("hi.j",42);set("dd.n",-1);set("ej.h",0);set("ii.d",0);set("id.a",0);
        Object js5=get("wk.d");
        for(String line;(line=reader.readLine())!=null;) {
            var parts=line.split(" ");int next=Integer.parseInt(parts[0]);
            set("sd.N",Integer.parseInt(parts[1]));set("d.c",Integer.parseInt(parts[2]));set("uj.l",parts[3].equals("1"));
            if(parts[4].equals("1"))set("mf.m",obj("se",new Class<?>[]{Socket.class,Class.forName("fb")},socket(),get("tj.m")));
            // Keep populated title sprites for the 5 transition. Its raster has a separate pixel oracle.
            if(next==5)set("kg.H",true);
            for(String key:new String[]{"pd.r","ah.d","th.d","mf.p","bc.e"})set(key,77);
            set("wk.d",parts[5].equals("1")?null:js5);
            set("sc.V",true);
            for(String key:"kl.X tk.d dg.h nk.U od.O il.K".split(" "))set(key,81);
            String outcome="ok";
            try{call("ej.a",null,new Class<?>[]{int.class,int.class},-11461,next);}
            catch(InvocationTargetException e){outcome="runtime";}
            var state=new StringJoiner(";");
            for(String key:"tf.C pd.r ah.d th.d mf.p bc.e dd.n ng.B oa.i cf.g mf.b hj.i ra.R kg.H ej.h ii.d id.a".split(" "))
                state.add(""+get(key));
            state.add(get("mf.m")==null?"0":"1");state.add(get("nk.S")==null?"0":"1");
            state.add(outcome);
            for(String key:"kl.X sc.V tk.d dg.h nk.U od.O il.K".split(" "))state.add(""+get(key));
            System.out.println(state);
        }
    }
    static void log(String result) throws Exception {
        var state=new StringJoiner(";");
        state.add(result);
        for(String key:new String[]{"od.O","nk.U","tk.d","dg.h","il.K","kl.X","si.h","mh.n","o.Y","af.I","qc.W"})state.add(""+get(key));
        state.add(""+get("ie.r"));
        state.add(get("ek.s")==null?"0":"1");
        state.add(packet("qk.v"));state.add(packet("wd.e"));state.add(""+f("gd.yb").getInt(get("hd.b")));
        if(get("od.O").equals(9)) {
            for(String key:new String[]{"mi.E","tg.r","ld.g","d.h","aj.Cc","qi.Z","tj.h","mi.y","da.d","ka.c"})state.add(""+get(key));
            state.add(""+get("ok.z"));state.add(""+get("bb.b"));
            if(!hookProbe.isEmpty())state.add(""+get("id.a"));
        }
        if(get("tf.C").equals(25)&&get("dg.h").equals(2)) {
            for(String key:new String[]{"ic.V","ah.k","hk.e","vj.t","ah.f"})state.add(""+get(key));
            var player=get("te.g");
            state.add(""+((int[])f("ob.L").get(player))[0]);
            state.add(""+((int[])f("ob.ac").get(player))[0]);
            state.add(Arrays.toString((int[])get("rb.i")));
            state.add(Arrays.toString((int[])get("fd.X")));
            state.add(Arrays.deepToString((int[][])get("jg.w")));
            for(String key:new String[]{"client.nb","gi.n","df.B","kk.db","gg.C","ag.e"})state.add(""+get(key));
        }
        state.add(""+get("dg.n"));
        System.out.println(state);
    }
    public static void main(String[] args) throws Exception {
        var unsafe=Class.forName("sun.misc.Unsafe");var singleton=unsafe.getDeclaredField("theUnsafe");singleton.setAccessible(true);
        // A task queue with no worker. Test commands explicitly resolve or reject the socket task.
        set("tj.m",unsafe.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),Class.forName("fb")));
        var rng=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        rng.setAccessible(true);((Random)rng.get(null)).setSeed(530);
        set("bi.g",BigInteger.ONE);set("te.e",128);
        set("ej.p",obj("ag",new Class<?>[0]));
        call("jd.a",null,new Class<?>[]{int.class,Class.forName("fb")},-100,null);
        set("hi.f",765);set("fl.l",503);set("qj.C",1);set("oj.k",string(""));
        if(args.length==0){set("ga.G",string("Pilot"));set("ga.F",string("s"));}
        var gd=Class.forName("gd");var fb=Class.forName("fb");var ud=Class.forName("ud");var se=Class.forName("se");
        byte[] empty={0,0,0,0,4,5,1,0,0};var crc=new CRC32();crc.update(empty);
        String[] archives="uh.O bc.c sf.b dd.l rg.m re.d al.l rk.k h.i ha.b ek.D gd.E il.B nf.j f.f gj.Z fk.db bh.c ve.e ok.t ml.t ta.M jl.f aa.d kh.B wf.u wh.X ll.g".split(" ");
        for(int i=0;i<28;i++) {
            var index=obj("db",new Class<?>[]{byte[].class,int.class},empty,(int)crc.getValue());
            f("db.b").setInt(index,i);var archive=obj("al",new Class<?>[]{ud,boolean.class,boolean.class},null,true,true);
            f("al.x").set(archive,index);set(archives[i],archive);
        }
        set("kh.A",get("dd.l"));
        // Minimal startup dependencies for the original stage-9 game reset and loading screen.
        set("wk.d",obj("ej",new Class<?>[0]));
        set("pe.S",new java.awt.Canvas());
        var glyph=new int[256];var fontBytes=new byte[257];fontBytes[256]=13;
        set("wj.g",obj("fg",new Class<?>[]{byte[].class,int[].class,int[].class,int[].class,int[].class,byte[][].class},
            fontBytes,glyph,glyph,glyph,glyph,new byte[256][0]));
        call("td.a",null,new Class<?>[]{int[].class,int.class,int.class},new int[765*503],765,503);
        var zap=get("gf.bb");var unzap=get("fl.a");
        // These startup classes each draw a Math.random value from their class initializer.
        for(String name:new String[]{"cg","ki","ok","si"})Class.forName(name);
        var reader=new BufferedReader(new InputStreamReader(System.in));
        if(args.length>0&&args[0].equals("account")) {account(reader,(Random)rng.get(null));return;}
        if(args.length>0&&args[0].equals("states")) {states(reader);return;}
        set("m.S",obj("dg",new Class<?>[]{}));set("ld.k",obj("dg",new Class<?>[]{}));
        for(String line;(line=reader.readLine())!=null;) {
            var p=line.split(" ");String result="ok";
            set("dg.n",0);
            try {
                switch(p[0]) {
                    case "start" -> {
                        set("ek.s",null);set("f.k",null);set("tf.C",Integer.parseInt(p[1]));set("si.h",0L);set("mh.n",0L);
                        set("ag.f",40001);set("aa.a",50001);set("ie.r",40001);set("o.Y",0);set("af.I",0);set("qc.W",false);
                        hookProbe=p.length>3?p[3]:"";
                        set("uj.l",p.length>2&&p[2].equals("1"));set("id.a",0);
                        set("gf.bb",hookProbe.equals("unzap")?null:zap);
                        set("fl.a",hookProbe.equals("zap")?null:unzap);
                        for(String key:new String[]{"qk.v","hd.b","wd.e"})set(key,obj("be",new Class<?>[]{int.class},5000));
                        call("ii.b",null,new Class<?>[]{int.class},0);broken=false;input=new byte[0];cursor=0;
                    }
                    case "parameters" -> {
                        set("oj.k",p[1].equals("none")?null:string("late"));
                        set("hi.f",991);set("fl.l",-331);set("ce.F",-45678);set("kf.d",7);set("jd.i",65534);set("uj.l",true);
                    }
                    case "ready" -> {var task=get("f.k");f("dj.a").set(task,socket());f("dj.b").setInt(task,1);}
                    case "refused" -> f("dj.b").setInt(get("f.k"),2);
                    case "break" -> broken=true;
                    case "port" -> set("ie.r",Integer.parseInt(p[1]));
                    case "ticks" -> set("nk.U",Integer.parseInt(p[1]));
                    case "continue" -> call("wi.d",null,new Class<?>[]{int.class},100);
                    case "resume" -> call("hg.a",null,new Class<?>[]{boolean.class},true);
                    case "abortReset" -> set("ej.p",null);
                    case "restoreRecorder" -> set("ej.p",obj("ag",new Class<?>[0]));
                    case "tick" -> {
                        var rest=Arrays.copyOfRange(input,cursor,input.length);
                        var add=p.length>1?hex.parseHex(p[1]):new byte[0];
                        input=Arrays.copyOf(rest,rest.length+add.length);
                        System.arraycopy(add,0,input,rest.length,add.length);cursor=0;
                        ((Random)rng.get(null)).setSeed(530);
                        call("le.a",null,new Class<?>[]{int.class},-28426);
                    }
                    default -> throw new AssertionError(line);
                }
            } catch(InvocationTargetException e) {
                result="runtime";
                if (Boolean.getBoolean("debug.oracle")) {
                    var cause=e.getCause();
                    if (cause.getClass().getName().equals("g")) cause=(Throwable)f("g.a").get(cause);
                    cause.printStackTrace();
                }
            }
            log(result);
        }
    }
}
