import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Original i.p and aa.a, with a read-only observer after stores to the user-visible cross and selection state. */
public final class HdExamineMenuOracle {
    static final Map<String,String> stores = Map.of("fi.k","mode", "jh.j","x", "c.eb","y", "bg.M","crossTicks",
        "fl.P","highlightTicks", "v.b","highlight", "uf.t","slot", "vd.C","selected");
    static final List<String> writes = new ArrayList<>();
    static final List<String> routeReads = new ArrayList<>();
    public static void observedPath(int[] path, String axis) {
        routeReads.add((path == nk.O.K || path == nk.O.w ? "local" : "target") + axis);
    }
    public static void observed(String field) { writes.add(field); }
    static int targetFailure;
    static final AssertionError fatal = new AssertionError("target leave");
    public static void leaveTarget(byte guard) {
        if (targetFailure == 3 || targetFailure == 5) throw new IllegalStateException("target leave");
        if (targetFailure == 4 || targetFailure == 6) throw fatal;
        ec.a(guard);
    }

    static void instrument(Path output, String clazz, String method, String descriptor) throws Exception {
        instrument(output, clazz, method, descriptor, stores, null);
    }

    static void instrument(Path output, String clazz, String method, String descriptor,
                           Map<String,String> fields, String hookObserver) throws Exception {
        ClassReader reader;
        try (var input = HdExamineMenuOracle.class.getResourceAsStream("/" + clazz + ".class")) { reader = new ClassReader(input); }
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            public MethodVisitor visitMethod(int access, String name, String desc, String signature, String[] exceptions) {
                MethodVisitor next = super.visitMethod(access, name, desc, signature, exceptions);
                if (!name.equals(method) || !desc.equals(descriptor)) return next;
                return new MethodVisitor(Opcodes.ASM8, next) {
                    public void visitMethodInsn(int op, String owner, String name, String desc, boolean iface) {
                        if (hookObserver != null && owner.equals("gi") && name.equals("a") && desc.equals("(ILjl;)V")) {
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, hookObserver, "runHook", desc, false);
                        } else if (owner.equals("ec") && name.equals("a") && desc.equals("(B)V")) {
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdExamineMenuOracle", "leaveTarget", desc, false);
                        } else super.visitMethodInsn(op, owner, name, desc, iface);
                    }
                    public void visitFieldInsn(int op, String owner, String name, String desc) {
                        super.visitFieldInsn(op, owner, name, desc);
                        if (op == Opcodes.GETFIELD && (owner.equals("e") || owner.equals("km")) &&
                                desc.equals("[I") && (name.equals("K") || name.equals("w"))) {
                            super.visitInsn(Opcodes.DUP);
                            super.visitLdcInsn(name.equals("K") ? "X" : "Z");
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdExamineMenuOracle", "observedPath", "([ILjava/lang/String;)V", false);
                        }
                        String field = fields.get(owner + "." + name);
                        if ((op == Opcodes.PUTSTATIC || op == Opcodes.PUTFIELD) && field != null) {
                            super.visitLdcInsn(field);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdExamineMenuOracle", "observed", "(Ljava/lang/String;)V", false);
                        }
                    }
                };
            }
        }, 0);
        Files.write(output.resolve(clazz + ".class"), writer.toByteArray());
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) { instrument(Path.of(args[0]), "i", "p", "(II)V"); return; }
        be widget = new be(), old = new be();
        widget.Fc = 2; widget.cb = 19; widget.Uc = 0; old.Uc = 1; old.cb = 19; oj.v = 19;
        th.j = new be[][]{{null, null, widget, null}}; sc.m = new boolean[]{true};
        h item = new h(); item.E = new na(); item.E.T = "Arrow".getBytes(StandardCharsets.ISO_8859_1); item.E.lb = 5;
        cb.Y.a((byte)-77, item, 0x95bcL);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null;) {
            int[] a = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int action = a[0], which = a[1], quantity = a[2], capacity = a[3], start = a[4], selected = a[5];
            pl.e = new int[]{which == 2 ? 3 : 1}; ef.c = new int[]{which == 1 ? 3 : 2};
            d.eb = new short[]{(short)action}; mi.U = new long[]{0x56781234000095bcL};
            if (a.length > 6 && a[6] == 1) { d.eb = new short[0]; mi.U = null; }
            if (a.length > 6 && a[6] == 2) { d.eb = null; mi.U = new long[0]; }
            widget.wd = which == 3 ? null : new int[]{2,quantity};
            targetFailure = a.length > 6 ? a[6] : 0;
            sd.R = 2; vd.C = selected; th.n = targetFailure >= 3; v.b = old; fl.P = 9; uf.t = -52;
            fi.k = 3; bg.M = 45; jh.j = 57; c.eb = 68; ah.s = -141; em.y = 941;
            pa.R[0] = pa.R[1] = false; f.Z = 0; sj.q[0] = null;
            ag.P.y = new byte[capacity]; Arrays.fill(ag.P.y, (byte)0xa5); ag.P.T = start;
            ag.P.a(new int[]{1,22,4,8},false);
            writes.clear();
            String fault = "-", context = "-";
            try { i.p(2597, 0); }
            catch (ld error) {
                fault = error.f instanceof NullPointerException ? "null" : error.f instanceof IndexOutOfBoundsException ? "bounds" : error.f.getClass().getSimpleName();
                context = error.e;
            }
            catch (AssertionError error) { if (error != fatal) throw error; fault = "Error"; }
            String packet = HexFormat.of().formatHex(ag.P.y);
            int position = ag.P.T;
            ag.P.y = new byte[1]; ag.P.T = 0; ag.P.r(0,251);
            String text = sj.q[0] == null ? "-" : new String(sj.q[0].T,0,sj.q[0].lb,StandardCharsets.ISO_8859_1);
            System.out.println(String.join("|",Boolean.toString(aa.a((short)action,121)),fault,position+","+packet+","+(ag.P.y[0]&255),
                fi.k+","+bg.M+","+jh.j+","+c.eb,fl.P+","+(v.b==widget?1:v.b==old?2:0)+","+uf.t,
                vd.C+","+pa.R[0]+","+pa.R[1], f.Z+","+text, String.join(",",writes), context));
        }
    }
}
