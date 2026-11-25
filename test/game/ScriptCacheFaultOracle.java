import com.sun.jdi.*;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.EventRequest;
import java.io.*;
import java.nio.file.*;
import java.util.*;

public class ScriptCacheFaultOracle {
    static byte[] data, replacement;
    static gd observed;
    static vj initial, other;
    static String mode;
    static int reads;
    static final byte[] index = {0,0,0,0,18,5,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0};
    static class Provider extends ud {
        db b(int unused) { return new db(index,q.a(0,index,index.length)); }
        byte[] a(int unused, int group) {
            if (group != 0) throw new AssertionError(group);
            reads++;
            if (mode.equals("rebind")) sf.g = other;
            if (mode.equals("drop-cache")) sf.g = null;
            if (data == null) return null;
            byte[] packed = new byte[data.length + 5];
            int n = data.length;
            for (int i=4; i>0; i--, n>>>=8) packed[i] = (byte)n;
            System.arraycopy(data,0,packed,5,data.length);
            return packed;
        }
        void b(int unused, int group) { throw new AssertionError(); }
        int c(int group, int unused) { throw new AssertionError(); }
    }
    static byte[] bytes(String s) { return s.equals("-") ? null : HexFormat.of().parseHex(s.substring(1)); }
    public static void main(String[] args) throws Exception {
        for (String line : Files.readAllLines(Path.of(args[0]))) {
            String[] fields = line.split(" ");
            mode=fields[0]; data=bytes(fields[1]); replacement=bytes(fields[2]); reads=0; observed=null;
            initial = sf.g = new vj(2); other = new vj(2);
            ei occupant = mode.equals("cast") ? new ei() : new m();
            if (mode.equals("cast") || mode.equals("hit")) { initial.a(0L,0,occupant); initial.a(1L,0,new m()); }
            il.B = mode.equals("no-archive") || mode.equals("hit") || mode.equals("cast") ? null : new al(new Provider(), true,true);
            if (mode.equals("no-cache")) sf.g = null;
            String result = "loaded";
            m script = null;
            try {
                script = j.a(0,-100);
                if (script == null) result = "missing";
            } catch (RuntimeException error) {
                Throwable t=error;
                while (t instanceof g) t=((g)t).a;
                if (t instanceof NullPointerException) result="null";
                else if (t instanceof ArrayIndexOutOfBoundsException) result="bounds";
                else if (t instanceof NegativeArraySizeException) result="length";
                else if (t instanceof ClassCastException) result="cast";
                else throw error;
            }
            if (mode.equals("cast") || mode.equals("hit")) initial.a(2L,0,new m());
            ei oldValue=initial.a(261775,0L), newValue=other.a(261775,0L);
            System.out.println(result+" "+reads+" "+(observed==null?"-":observed.yb)+" "+
                (oldValue==null?0:oldValue==occupant?1:2)+" "+(newValue==null?0:1)+" "+
                (initial.a(261775,1L)==null?0:1)+" "+(script==null?0:Arrays.hashCode(script.D))+" "+
                (script==null?0:Arrays.hashCode(script.F)));
        }
    }
}

// Obtain the real packet cursor on successful and interrupted j.a calls without modifying any gamepack class.
class ScriptCacheDebugger {
    public static void main(String[] args) throws Exception {
        LaunchingConnector launch=Bootstrap.virtualMachineManager().defaultConnector();
        var argsVM=launch.defaultArguments();
        argsVM.get("main").setValue("ScriptCacheFaultOracle \"" + args[0] + "\"");
        argsVM.get("options").setValue("-Xmx256m -Djava.awt.headless=true -cp \"" + System.getProperty("java.class.path") + "\"");
        VirtualMachine vm=launch.launch(argsVM);
        Process process=vm.process();
        Thread out=new Thread(()->{try {process.getInputStream().transferTo(System.out);} catch(IOException e){throw new UncheckedIOException(e);}});
        Thread err=new Thread(()->{try {process.getErrorStream().transferTo(System.err);} catch(IOException e){throw new UncheckedIOException(e);}});
        out.start(); err.start();
        for (String name : new String[]{"j","gd"}) {
            var req=vm.eventRequestManager().createClassPrepareRequest(); req.addClassFilter(name); req.enable();
        }
        try {
            boolean run=true;
            while(run) {
                EventSet events=vm.eventQueue().remove();
                for (Event event:events) {
                    if (event instanceof ClassPrepareEvent e) {
                        boolean get=e.referenceType().name().equals("j");
                        Method method=e.referenceType().methodsByName(get?"a":"c",get?"(II)Lm;":"(I)I").get(0);
                        var bp=vm.eventRequestManager().createBreakpointRequest(method.locationOfCodeIndex(get?90:0));
                        bp.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD); bp.enable();
                    } else if(event instanceof BreakpointEvent e) {
                        var host=(ClassType)vm.classesByName("ScriptCacheFaultOracle").get(0);
                        Field saved=host.fieldByName("observed");
                        if(e.location().declaringType().name().equals("gd")) {
                            Location caller=e.thread().frame(1).location();
                            if(caller.declaringType().name().equals("j") && caller.codeIndex()==87)
                                host.setValue(saved,e.thread().frame(0).thisObject());
                        } else if(((StringReference)host.getValue(host.fieldByName("mode"))).value().equals("replace-bytes")) {
                            var packet=(ObjectReference)host.getValue(saved);
                            packet.setValue(packet.referenceType().fieldByName("fb"),host.getValue(host.fieldByName("replacement")));
                        }
                    } else if(event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) run=false;
                }
                if(run) events.resume();
            }
        } catch(VMDisconnectedException done) {
        } finally {
            try {vm.dispose();} catch(VMDisconnectedException done) {}
            if(!process.waitFor(10,java.util.concurrent.TimeUnit.SECONDS))process.destroyForcibly();
            int status=process.waitFor();out.join();err.join();
            if(status!=0)throw new AssertionError("gamepack VM exit "+status);
        }
    }
}
