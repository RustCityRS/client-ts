import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

// Execute p.a and preserve all its array reads. Only its external scene/model calls are instrumented.
public class HdDecorOffsetOracle {
    static final pb type = new pb();
    static final List<String> events = new ArrayList<>();
    static boolean flip;

    public static pb loc(int guard, int id) { return type; }
    public static long wall(int level, int x, int z) { return 0L; }
    public static sm model(pb receiver, int angle, int x, int[][] ground, int shape, int y,
                           int[][] upper, boolean share, ek shadow, byte guard, boolean makeShadow, int z) {
        events.add("model=" + angle);
        if (flip) tf.w = !tf.w;
        if (fb.q.length != 0) fb.q[1] += 4;
        if (j.O.length != 0) j.O[1] += 8;
        return new sm();
    }
    public static void shadow(ek image, int x, int y, int z) { events.add("shadow=" + x + "," + y + "," + z); }
    public static void decor(int a, int b, int c, int d, th e, th f, int g, int h, int x, int z, long tag) { events.add("decor=" + x + "," + z); }
    static void instrument(Path dir) throws Exception {
        ClassReader reader = new ClassReader("p");
        ClassWriter writer = new ClassWriter(reader, 0);
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            public MethodVisitor visitMethod(int a, String n, String d, String s, String[] e) {
                MethodVisitor next = super.visitMethod(a,n,d,s,e);
                if (!n.equals("a") || !d.equals("(IZIZLmj;IIIBII)V")) return next;
                return new MethodVisitor(Opcodes.ASM8,next) {
                    public void visitMethodInsn(int op, String owner, String n, String d, boolean iface) {
                        String name = switch (owner+"."+n+d) {
                            case "wc.a(II)Lpb;" -> "loc";
                            case "vj.a(III)J" -> "wall";
                            case "pb.a(II[[III[[IZLek;BZI)Lsm;" -> "model";
                            case "tj.c(Lek;III)V" -> "shadow";
                            case "hc.a(IIIILth;Lth;IIIIJ)V" -> "decor";
                            default -> null;
                        };
                        if (name == null) super.visitMethodInsn(op,owner,n,d,iface);
                        else super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdDecorOffsetOracle",name,
                            op == Opcodes.INVOKEVIRTUAL ? "(L"+owner+";"+d.substring(1) : d,false);
                    }
                };
            }
        },0);
        Files.write(dir.resolve("p.class"), writer.toByteArray());
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 0) { instrument(Path.of(args[0])); return; }
        gj.m = new int[2][5][5];
        type.D=true; type.mb=-1; type.db=null; type.L=false; type.e=type.l=1;
        for (int shape : new int[]{5,6,8}) for (int flags=0; flags<16; flags++) {
            events.clear(); tf.w=(flags & 1)!=0; flip=(flags & 2)!=0;
            fb.q=(flags & 4)!=0 ? new int[0] : new int[]{1,2,3,4};
            j.O=(flags & 8)!=0 ? new int[0] : new int[]{5,6,7,8};
            String status="ok";
            try { p.a(0,false,0,false,null,3,shape,2,(byte)50,2,1); }
            catch (ld fault) {
                if (!(fault.f instanceof ArrayIndexOutOfBoundsException)) throw fault;
                status="bounds";
            }
            System.out.println(shape+" "+flags+"|"+String.join(";",events)+"|"+status);
        }
    }
}
