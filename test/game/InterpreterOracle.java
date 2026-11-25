import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

// Install m objects into the client's real script cache and invoke gh.a.
class InterpreterOracle {
    static final HexFormat hex = HexFormat.of();
    static int injectAt, breakField, newLength;
    static String atKey;
    static int num(String value) { return Integer.parseInt(value); }
    static id text(String value) {
        if (value.equals("-")) return null;
        byte[] bytes = hex.parseHex(value);
        return ea.a(bytes, 0, bytes.length, 0);
    }
    static int[] ints(String field) {
        if (field.equals("-")) return null;
        if (field.isEmpty()) return new int[0];
        return Arrays.stream(field.split(",")).mapToInt(Integer::parseInt).toArray();
    }
    static aj component(String number, String child) {
        if (number.equals("-")) return null;
        aj c = new aj();
        c.Kc = num(number);
        c.bc = num(child);
        return c;
    }
    static int stringHash(id value) {
        return value == null ? 0 : 31 * Arrays.hashCode(value.A) + value.c;
    }
    static int stringsHash(id[] values) {
        if (values == null) return 0;
        int hash = 1;
        for (id value : values) hash = hash * 31 + stringHash(value);
        return hash;
    }
    static int frameHash() {
        int hash = 1;
        for (qf frame : kc.p) {
            hash *= 31;
            if (frame == null) continue;
            hash += Long.hashCode(frame.d.k);
            hash = 31 * hash + frame.i;
            hash = 31 * hash + Arrays.hashCode(frame.k);
            hash = 31 * hash + stringsHash(frame.g);
        }
        return hash;
    }
    static void errorScript(int number, id name, int opcode, Integer operand) {
        m code = new m();
        code.J = name;
        code.D = new int[]{opcode, 21};
        code.F = operand == null ? null : new int[]{operand, 0};
        code.B = new id[2];
        sf.g.a(number, 0, code);
    }
    static int[] chatInts(int size, int base) {
        if (size < 0) return null;
        int[] rows = new int[size];
        for (int i = 0; i < size; i++) rows[i] = base + i;
        return rows;
    }
    static id[] chatStrings(int size, id[] markers, int offset) {
        if (size < 0) return null;
        id[] rows = new id[size];
        for (int i = 0; i < size; i++) rows[i] = markers[(i + offset) % markers.length];
        return rows;
    }
    static String chatHead(id[] rows) {
        if (rows == null || rows.length == 0 || rows[0] == null) return "-";
        return hex.formatHex(rows[0].A, 0, rows[0].c);
    }
    static String chatSnapshot() {
        return String.join(",", ""+ve.m, ""+sb.c, ""+Arrays.hashCode(de.t), ""+Arrays.hashCode(jg.z),
                ""+stringsHash(m.T), ""+stringsHash(ui.q), ""+stringsHash(ma.j), chatHead(m.T), chatHead(ui.q),
                ""+(m.T != null && m.T.length > 0 && m.T[0] == uj.i),
                ""+(ui.q != null && ui.q.length > 0 && ui.q[0] == bh.e));
    }
    static void observeKey() { atKey = chatSnapshot(); }
    static void afterChatWrite(int point) {
        if (point != injectAt) return;
        switch (breakField) {
            case 0: de.t = newLength < 0 ? null : new int[newLength]; break;
            case 1: m.T = newLength < 0 ? null : new id[newLength]; break;
            case 2: ui.q = newLength < 0 ? null : new id[newLength]; break;
            case 3: ma.j = newLength < 0 ? null : new id[newLength]; break;
            case 4: jg.z = newLength < 0 ? null : new int[newLength]; break;
        }
    }
    // Keep the original gh and jd instructions. Observe both jf.k reads; inject a swapped
    // static array only immediately after the count or transmit-cycle store in fault cases.
    static void prepare(Path file, Path directory) throws Exception {
        try (JarFile jar = new JarFile(file.toFile())) {
            for (String owner : new String[]{"gh", "jd"}) {
                ClassReader original = new ClassReader(jar.getInputStream(jar.getJarEntry(owner+".class")));
                ClassWriter patched = new ClassWriter(ClassWriter.COMPUTE_MAXS);
                int[] observations = new int[1];
                original.accept(new ClassVisitor(Opcodes.ASM8,patched) {
                    public MethodVisitor visitMethod(int access,String name,String desc,String signature,String[] thrown) {
                        MethodVisitor method = super.visitMethod(access,name,desc,signature,thrown);
                        if (!name.equals("a") || !desc.equals(owner.equals("gh") ? "(Lwf;II)V" : "(ILid;Lid;IILid;)V")) return method;
                        return new MethodVisitor(Opcodes.ASM8,method) {
                            public void visitFieldInsn(int opcode,String target,String field,String type) {
                                if (owner.equals("gh") && opcode == Opcodes.GETFIELD && target.equals("jf") && field.equals("k") && type.equals("J")) {
                                    observations[0]++;
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterpreterOracle","observeKey","()V",false);
                                }
                                super.visitFieldInsn(opcode,target,field,type);
                                if (!owner.equals("jd") || opcode != Opcodes.PUTSTATIC || !type.equals("I")) return;
                                int point = target.equals("ve") && field.equals("m") ? 1 : target.equals("sb") && field.equals("c") ? 2 : 0;
                                if (point != 0) {
                                    observations[0]++;
                                    super.visitInsn(point == 1 ? Opcodes.ICONST_1 : Opcodes.ICONST_2);
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"InterpreterOracle","afterChatWrite","(I)V",false);
                                }
                            }
                        };
                    }
                },0);
                if (observations[0] != 2) throw new AssertionError(owner+" probe sites: "+observations[0]);
                Files.write(directory.resolve(owner+".class"),patched.toByteArray());
            }
        }
    }
    static void errorChat(PrintStream out, String[] t) throws Exception {
        d.c = num(t[1]);
        sf.g = new vj(128);
        int kind = num(t[2]), field = num(t[3]), cap = num(t[4]);
        injectAt = field < 10 ? 0 : field / 10; breakField = field % 10; newLength = cap; atKey = "-";
        ve.m = num(t[5]); sb.c = -22; bb.e = 431;
        id[] markers = {null, text("61"), text("62"), text("63")};
        de.t = chatInts(field == 0 ? cap : 100, 773);
        m.T = chatStrings(field == 1 ? cap : 100, markers, 1);
        ui.q = chatStrings(field == 2 ? cap : 100, markers, 2);
        ma.j = chatStrings(field == 3 ? cap : 100, markers, 3);
        jg.z = chatInts(field == 4 ? cap : 100, -249);
        id high = text("5280c3a9e282acff"), caller = text("43616c6c6572");
        switch (kind) {
            case 0: errorScript(8001, null, 9999, 0); break;
            case 1: errorScript(8001, high, 9999, 0); break;
            case 2: errorScript(8001, caller, 40, 8002); errorScript(8002, text("6d6964"), 40, 8003); errorScript(8003, high, 40, 9911); break;
            case 3: errorScript(8001, caller, 40, 8002); errorScript(8002, null, 9999, 0); break;
            case 4: errorScript(8001, null, 40, 8002); errorScript(8002, high, 9999, 0); break;
            case 5: errorScript(8001, high, 40, null); break;
            case 6: errorScript(8001, high, 21, 0); break;
            case 7: errorScript(8001, high, 40, 9911); break;
            case 8: errorScript(8001, null, 40, 9911); break;
            default: throw new IllegalArgumentException(t[2]);
        }
        wf event = new wf(); event.G = new Object[]{8001};
        ByteArrayOutputStream log = new ByteArrayOutputStream();
        String[] atReport = {"-"};
        PrintStream capture = new PrintStream(log, true, StandardCharsets.UTF_8) {
            public void println(String s) {
                if (s.contains(" | CS2 - scr:")) atReport[0] = chatSnapshot();
                super.println(s);
            }
        };
        String outcome = "ok";
        System.setOut(capture);
        try { gh.a(event, -22368, 100); }
        catch (RuntimeException ex) {
            Throwable cause = ex;
            while (cause instanceof g wrapped && wrapped.a != null) cause = wrapped.a;
            outcome = cause.getClass().getSimpleName();
        } finally { System.setOut(out); }
        String diagnostic = log.toString(StandardCharsets.UTF_8);
        int start = diagnostic.indexOf(" | CS2 - scr:");
        diagnostic = start < 0 ? "" : diagnostic.substring(start + 3).replaceFirst("\\r?\\n$", "");
        out.println(String.join("/", outcome, ""+oi.b, chatSnapshot(), atReport[0], hex.formatHex(diagnostic.getBytes(StandardCharsets.UTF_8)), atKey));
    }
    public static void main(String[] argv) throws Exception {
        if (argv.length != 0) { prepare(Path.of(argv[0]),Path.of(argv[1])); return; }
        PrintStream out = System.out;
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            String[] t = line.split("\t", -1);
            if (t[0].equals("chat")) { errorChat(out, t); continue; }
            if (t[0].equals("seed")) {
                var generator = Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
                generator.setAccessible(true);
                ((Random)generator.get(null)).setSeed(Long.parseLong(t[1]));
                continue;
            }
            if (t[0].equals("appearance")) {
                te.g = new pb();
                if (!t[1].equals("-")) {
                    te.g.pc = new cl();
                    te.g.pc.m = t[1].equals("1");
                }
                continue;
            }
            if (t[0].equals("language")) { hl.w = num(t[1]); continue; }
            if (t[0].equals("font")) {
                byte[] metrics = new byte[257];
                Arrays.fill(metrics, (byte)4);
                metrics[32] = 2;
                metrics[256] = 10;
                fa.p.a(16L,new fg(metrics),(byte)-71);
                continue;
            }
            if (t[0].equals("def")) {
                m s = new m();
                s.J = text(t[2]);
                s.E = num(t[3]); s.I = num(t[4]); s.K = num(t[5]); s.R = num(t[6]);
                s.D = ints(t[7]); s.F = ints(t[8]);
                s.B = Arrays.stream(t[9].split(",", -1)).map(InterpreterOracle::text).toArray(id[]::new);
                s.N = new nc[]{new nc(1)};
                s.N[0].a((byte)-96, new oe(2), 17L);
                sf.g.a(num(t[1]), 0, s);
                continue;
            }
            wf event = new wf();
            event.D = num(t[3]); event.K = num(t[4]); event.y = num(t[5]);
            event.C = component(t[6], t[7]); event.B = component(t[8], t[9]);
            event.x = num(t[10]); event.E = num(t[11]); event.z = text(t[12]);
            event.G = new Object[t.length - 12]; event.G[0] = num(t[1]);
            for (int i = 13; i < t.length; i++) event.G[i - 12] =
                t[i].startsWith("i") ? Integer.valueOf(t[i].substring(1)) : text(t[i].substring(1));
            ByteArrayOutputStream log = new ByteArrayOutputStream();
            System.setOut(new PrintStream(log, true, StandardCharsets.UTF_8));
            boolean threw = false;
            try { gh.a(event, -22368, num(t[2])); } catch (RuntimeException ex) { threw = true; }
            finally { System.setOut(out); }
            String report = log.toString(StandardCharsets.UTF_8);
            int start = report.indexOf(" | CS2 - scr:");
            report = start < 0 ? "" : report.substring(start + 3).replaceFirst("\\r?\\n$", "");
            out.println(String.join("/", String.valueOf(threw), String.valueOf(oi.b),
                String.valueOf(Arrays.hashCode(mk.J)), String.valueOf(stringsHash(lk.t)),
                String.valueOf(Arrays.hashCode(tg.B)), String.valueOf(stringsHash(g.p)),
                String.valueOf(Arrays.hashCode(hf.G)), String.valueOf(Arrays.deepHashCode(ie.H)),
                String.valueOf(frameHash()), String.valueOf(lk.t != null && lk.t.length > 0 && lk.t[0] == event.z),
                hex.formatHex(report.getBytes(StandardCharsets.UTF_8))));
        }
    }
}
