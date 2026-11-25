import com.sun.jdi.*;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.regex.*;

public class Cs2StackOracle {
    static int stop, changes;
    static int[] otherInts;
    static id[] otherStrings;
    static gh area;
    static id newName;
    static final id[] strings = new id[9];
    static final Pattern report = Pattern.compile("CS2 - scr:-?[0-9]+ op:(-?[0-9]+)");

    static int stringHash(id[] values) {
        if (values == null) return 0;
        int hash = 1;
        for (id value : values) {
            int index = 0; // id.equals(Object) has its own game semantics; use identity.
            while (index < strings.length && strings[index] != value) index++;
            if (index == strings.length) throw new AssertionError("unknown string");
            hash = hash * 31 + index;
        }
        return hash;
    }

    public static void main(String[] args) throws Exception {
        String[] texts = {"", "male", "female", "area", "Display", "replacement", "changed", "tail"};
        for (int i = 0; i < texts.length; i++) strings[i + 1] = i == 0 ? uj.i : aj.a(texts[i], (byte)-77);
        newName = strings[7];
        int key = 92700;
        for (String row : Files.readAllLines(Path.of(args[0]))) {
            String[] w = row.split(" ");
            int op = Integer.parseInt(w[0]), ni = Integer.parseInt(w[1]), ns = Integer.parseInt(w[2]);
            int ilen = Integer.parseInt(w[3]), slen = Integer.parseInt(w[4]), alen = Integer.parseInt(w[5]);
            String mode = w[6]; stop = Integer.parseInt(w[7]); changes = 0;
            int[] initialInts = tg.B = ilen < 0 ? null : new int[ilen];
            id[] initialStrings = g.p = slen < 0 ? null : new id[slen];
            otherInts = alen < 0 ? null : new int[alen]; otherStrings = alen < 0 ? null : new id[alen];
            if (initialInts != null) Arrays.fill(initialInts, -315);
            if (initialStrings != null) Arrays.fill(initialStrings, strings[2]);
            if (otherInts != null) Arrays.fill(otherInts, 937);
            if (otherStrings != null) Arrays.fill(otherStrings, strings[6]);
            te.g = mode.equals("no-player") ? null : new pb();
            if (te.g != null && !mode.equals("no-model")) { te.g.pc = new cl(); te.g.pc.m = mode.equals("female"); }
            ba.d = new gk();
            area = new gh(mode.equals("null-group") ? null : strings[4], mode.equals("no-name") ? null : strings[5], 0,0,0,true,1);
            ba.d.a(area,false);
            gl.w = mode.equals("no-flags") || mode.equals("negative") ? null : new boolean[]{false,true};
            int arg = op == 5217 ? mode.equals("negative") ? -1 : 1 : 0xdeadbeef;
            m code = new m();
            int n = ni + ns + 4;
            code.D = new int[n]; code.F = new int[n]; code.B = new id[n];
            int pc = 0;
            for (int j=0;j<ni;j++,pc++) code.F[pc] = j == ni-1 ? arg : 41;
            for (int j=0;j<ns;j++,pc++) {
                code.D[pc] = 3;
                code.B[pc] = mode.equals("null-arg") ? null : op == 4105 ? strings[j == ns-1 ? 3 : 2]
                    : op == 5207 && !mode.equals("miss") ? strings[4] : strings[2];
            }
            code.D[pc++] = op;
            code.F[pc++] = -78;
            code.D[pc] = 3; code.B[pc++] = strings[8];
            code.D[pc] = 21;
            sf.g.a((long)key,0,code); wf event = new wf(); event.G = new Object[]{key++};
            PrintStream saved = System.out; var capture = new ByteArrayOutputStream();
            System.setOut(new PrintStream(capture));
            try { gh.a(event,-22368,4000); } finally { System.setOut(saved); }
            String log = capture.toString(), fault = "-";
            Matcher match = report.matcher(log);
            if (match.find()) fault = match.group(1) + "/" + (log.contains("NullPointerException") ? "null" :
                log.contains("IndexOutOfBoundsException") ? "bounds" : "other");
            System.out.println(String.join(" ",fault,""+Arrays.hashCode(initialInts),""+stringHash(initialStrings),
                ""+Arrays.hashCode(otherInts),""+stringHash(otherStrings),tg.B==initialInts?"0":"1",g.p==initialStrings?"0":"1",""+changes));
        }
    }
}

// JDI observes the unchanged, checksum-pinned gh.a. For designated rows only, replace the relevant static
// array at its original bytecode position. This makes the already-captured JVM operand-stack receiver visible.
class Cs2StackDebugger {
    static final int[] offsets = {0x5fc8,0x5ff3,0x6019,0x1780,0x1797,0x1a53,0x2e35,0x2e62,0x313b};
    static ClassType type(VirtualMachine vm, String name) { return (ClassType)vm.classesByName(name).get(0); }
    static void write(ClassType cls, String field, Value value) throws Exception {
        cls.setValue(cls.fieldByName(field),value);
    }

    public static void main(String[] args) throws Exception {
        LaunchingConnector connector = Bootstrap.virtualMachineManager().defaultConnector();
        var options = connector.defaultArguments();
        options.get("main").setValue("Cs2StackOracle \"" + args[0] + "\"");
        options.get("options").setValue("-Xmx256m -Djava.awt.headless=true -cp \"" + System.getProperty("java.class.path") + "\"");
        VirtualMachine vm = connector.launch(options);
        Process process = vm.process();
        Thread out = new Thread(() -> { try { process.getInputStream().transferTo(System.out); } catch (IOException e) { throw new UncheckedIOException(e); } });
        Thread err = new Thread(() -> { try { process.getErrorStream().transferTo(System.err); } catch (IOException e) { throw new UncheckedIOException(e); } });
        out.start(); err.start();
        var prepare = vm.eventRequestManager().createClassPrepareRequest(); prepare.addClassFilter("gh"); prepare.enable();
        try {
            boolean running = true;
            while (running) {
                EventSet batch = vm.eventQueue().remove();
                for (Event event : batch) {
                    if (event instanceof ClassPrepareEvent ready) {
                        Method method = ready.referenceType().methodsByName("a","(Lwf;II)V").get(0);
                        for (int offset : offsets) {
                            BreakpointRequest point = vm.eventRequestManager().createBreakpointRequest(method.locationOfCodeIndex(offset));
                            point.setSuspendPolicy(EventRequest.SUSPEND_EVENT_THREAD); point.enable();
                        }
                    } else if (event instanceof BreakpointEvent hit) {
                        ClassType oracle = type(vm,"Cs2StackOracle");
                        int pc = (int)hit.location().codeIndex();
                        if (((IntegerValue)oracle.getValue(oracle.fieldByName("stop"))).value() != pc) continue;
                        boolean ints = pc == 0x5fc8 || pc == 0x5ff3 || pc == 0x6019 || pc == 0x1a53 || pc == 0x313b;
                        write(type(vm,ints?"tg":"g"), ints?"B":"p",oracle.getValue(oracle.fieldByName(ints?"otherInts":"otherStrings")));
                        if (pc == 0x2e62) {
                            ObjectReference area = (ObjectReference)oracle.getValue(oracle.fieldByName("area"));
                            area.setValue(area.referenceType().fieldByName("S"),oracle.getValue(oracle.fieldByName("newName")));
                        }
                        write(oracle,"changes",vm.mirrorOf(1)); write(oracle,"stop",vm.mirrorOf(-1));
                    } else if (event instanceof VMDeathEvent || event instanceof VMDisconnectEvent) running = false;
                }
                if (running) batch.resume();
            }
        } catch (VMDisconnectedException done) {
            // The debuggee has exited.
        } finally {
            try { vm.dispose(); } catch (VMDisconnectedException done) {}
            if (!process.waitFor(10, java.util.concurrent.TimeUnit.SECONDS)) process.destroyForcibly();
            int status = process.waitFor(); out.join(); err.join();
            if (status != 0) throw new AssertionError("gamepack VM exit " + status);
        }
    }
}
