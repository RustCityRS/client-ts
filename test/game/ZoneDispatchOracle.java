import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

public class ZoneDispatchOracle {
    static final class Boundary extends Error {}
    static int mode, at, value, gates, buffers, stateReads;
    static be first, second;
    static StringJoiner trace;
    static pb firstPlayer, secondPlayer;

    static void instrument(Path output) throws Exception {
        ClassReader reader;
        try (InputStream in = ZoneDispatchOracle.class.getResourceAsStream("/qd.class")) { reader = new ClassReader(in); }
        ClassWriter writer = new ClassWriter(reader, 0);
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            public MethodVisitor visitMethod(int flags, String name, String desc, String sig, String[] exceptions) {
                MethodVisitor mv = super.visitMethod(flags, name, desc, sig, exceptions);
                if (!name.equals("a") || !desc.equals("(I)V")) return mv;
                return new MethodVisitor(Opcodes.ASM8, mv) {
                    public void visitFieldInsn(int op, String owner, String field, String type) {
                        String hook = switch (op + ":" + owner + "." + field + type) {
                            case "178:o.YI" -> "opcode";
                            case "178:hd.bLbe;" -> "buffer";
                            case "178:te.gLpb;" -> "player";
                            case "180:mg.B[[I" -> "transforms";
                            default -> null;
                        };
                        if (hook == null) super.visitFieldInsn(op, owner, field, type);
                        else super.visitMethodInsn(Opcodes.INVOKESTATIC, "ZoneDispatchOracle", hook,
                            op == Opcodes.GETFIELD ? "(Lmg;)" + type : "()" + type, false);
                    }
                    public void visitMethodInsn(int op, String owner, String name, String type, boolean iface) {
                        super.visitMethodInsn(op, owner, name, type, iface);
                        if (op == Opcodes.INVOKESTATIC && owner.equals("g") && name.equals("a") && type.equals("(IIIIIIIIBIIII)V"))
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "ZoneDispatchOracle", "afterMerge", "()V", false);
                    }
                };
            }
        }, 0);
        Files.write(output.resolve("qd.class"), writer.toByteArray());
    }

    public static int opcode() {
        if (++gates == at) {
            if (mode == 1) o.Y = value;
            if (mode == 2) { trace.add("stopO"); throw new Boundary(); }
        }
        trace.add("o" + o.Y);
        return o.Y;
    }
    public static be buffer() {
        if (++buffers == at) {
            if (mode == 3) hd.b = second;
            if (mode == 4) hd.b = null;
            if (mode == 5) { trace.add("stopB"); throw new Boundary(); }
        }
        trace.add("b" + (hd.b == first ? 1 : hd.b == second ? 2 : 0) + ":" + first.yb + "/" + second.yb);
        return hd.b;
    }
    public static pb player() {
        if (mode == 7 && ++stateReads == at) te.g = value == 0 ? null : secondPlayer;
        trace.add("p" + (te.g == firstPlayer ? 1 : te.g == secondPlayer ? 2 : 0));
        return te.g;
    }
    public static int[][] transforms(mg bas) {
        if (mode == 8 && ++stateReads == at) {
            bas.B = value == 0 ? null : value == 1 ? new int[][]{null} : new int[][]{ new int[]{93, -21, 14} };
        }
        trace.add("t");
        return bas.B;
    }
    public static void afterMerge() {
        trace.add("merge");
        if (mode == 6) o.Y = value;
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 0) { instrument(Path.of(args[0])); return; }
        r.V.a(0L, new li(), (byte)-71);
        var projX = hl.class.getDeclaredField("q");
        var projZ = hl.class.getDeclaredField("Z");
        var projY = hl.class.getDeclaredField("t");
        for (var field : List.of(projX, projZ, projY)) field.setAccessible(true);
        var lines = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = lines.readLine()) != null;) {
            String[] words = line.split(" ");
            o.Y = Integer.parseInt(words[0]); mode = Integer.parseInt(words[1]); at = Integer.parseInt(words[2]); value = Integer.parseInt(words[3]);
            first = new be(0); second = new be(0);
            first.fb = HexFormat.of().parseHex(words[4]); second.fb = HexFormat.of().parseHex(words[5]); second.yb = 3;
            hd.b = first; gates = buffers = stateReads = 0; trace = new StringJoiner(",");
            dg.C = ha.a = mode >= 6 ? 0 : 200;
            ah.f = mi.y = 0; hh.kb = 100;
            ag.l = 0; dd.u = 127;
            te.g = firstPlayer = new pb(); secondPlayer = new pb();
            firstPlayer.L[0] = firstPlayer.ac[0] = 0; secondPlayer.L[0] = secondPlayer.ac[0] = 104;
            te.g.U = -1; tb.o.B = new int[][]{new int[]{31, 15, 17}};
            kl.Bb = new ra[1][8][8]; ve.q = null;
            nl.Q.b((byte)125); wh.S.b((byte)125); cg.f.b((byte)125);
            String status = "ok";
            try { qd.a(64); }
            catch (Boundary stop) { status = "stop"; }
            catch (RuntimeException err) {
                Throwable root = err;
                while (root instanceof g wrapped) root = wrapped.a;
                status = root.getClass().getSimpleName() + "@" + ((g)err).q;
            }
            StringJoiner merges = new StringJoiner("/");
            for (jk node = (jk)nl.Q.d(0); node != null; node = (jk)nl.Q.a(0))
                merges.add(node.B + "," + node.y + "," + node.s + "," + node.v + "," + node.z + "," + node.t + "," + node.E);
            StringJoiner locs = new StringJoiner("/");
            for (ff node = (ff)wh.S.d(0); node != null; node = (ff)wh.S.a(0)) locs.add(node.L + "," + node.w + "," + node.N);
            StringJoiner sounds = new StringJoiner("/");
            for (int i = 0; i < ag.l; i++) sounds.add(ff.J[i] + "," + uh.Q[i] + "," + u.r[i] + "," + gk.e[i]);
            StringJoiner projectiles = new StringJoiner("/");
            for (tf n = (tf)cg.f.d(0); n != null; n = (tf)cg.f.a(0))
                projectiles.add(projX.getInt(n.G) + "," + projZ.getInt(n.G) + "," + projY.getInt(n.G));
            System.out.println(status + "|" + trace + "|" + first.yb + "," + second.yb + "," + o.Y + "|" + merges + "|" + locs + "|" + sounds + "|" + projectiles);
        }
    }
}
