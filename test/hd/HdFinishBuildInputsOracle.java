import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

// Run di.a up to its native mesh submissions. The intercepted callees replace the mutable scene inputs between submissions.
public class HdFinishBuildInputsOracle {
    static final IdentityHashMap<Object,String> ids = new IdentityHashMap<>();
    static final List<String> events = new ArrayList<>();
    static int generation, fault;
    static boolean underwater;
    static final class End extends Error {}
    static byte[][][] bytes(String name) {
        byte[][][] value = new byte[4][104][104];
        ids.put(value, name+generation); ids.put(value[0],name+generation);
        return value;
    }
    static int[][][] heights(String name) {
        int[][][] value = new int[2][105][105];
        ids.put(value[0],name+generation);
        return value;
    }
    static void replace() {
        generation++;
        bb.g=bytes("flags"); n.h=bytes("shapes"); ui.eb=bytes("under"); tg.g=bytes("over"); ac.e=bytes("rot");
        gj.m=heights("heights"); id.i=heights("surface"); f.ab=new int[104][104]; ids.put(f.ab,"water"+generation);
        if (generation == fault) ui.eb=new byte[0][][];
    }
    static void log(String name, Object... values) {
        StringJoiner line=new StringJoiner(","); for (Object v : values) line.add(v==null ? "-" : ids.get(v));
        events.add(name+"="+line);
    }
    public static hg[] under(byte[][][] flags, byte[][] shape, byte[][] below, int[][] shade, float[][] ny,
                             int[][] water, byte[][] above, byte[][] rotation, float[][] nx, int level, float[][] nz,
                             int[][] color, int[][] ground, int[][] surface, int guard) {
        log("under",flags,shape,below,water,above,rotation,ground,surface); replace(); return new hg[0];
    }
    public static hg[] over(float[][] ny,float[][] nx,int[][] ground,int level,float[][] nz,byte[][] rotation,
                            int[][] shade,int guard,byte[][] shapes,byte[][] below,byte[][] above,byte[][][] flags) {
        log("over",ground,rotation,shapes,below,above,flags); replace(); return new hg[0];
    }
    public static void submit(int level,hg[] batches) { events.add("submit"); if (underwater) throw new End(); }
    public static void lights(float[][] nz,byte[][] below,byte[][] rotation,gi[] lights,int level,int count,
                              float[][] ny,byte[][] shapes,byte[][] above,int[][] ground,int guard,float[][] nx) {
        log("lights",below,rotation,shapes,above,ground); throw new End();
    }
    static void instrument(Path dir) throws Exception {
        ClassReader r=new ClassReader("di"); ClassWriter w=new ClassWriter(r,0);
        r.accept(new ClassVisitor(Opcodes.ASM8,w) {
            public MethodVisitor visitMethod(int a,String n,String d,String s,String[] e) {
                MethodVisitor mv=super.visitMethod(a,n,d,s,e);
                if (!n.equals("a") || !d.equals("([Lmj;ZI)V")) return mv;
                return new MethodVisitor(Opcodes.ASM8,mv) {
                    public void visitMethodInsn(int op,String owner,String n,String d,boolean iface) {
                        String replace=switch(owner+"."+n+d) {
                            case "pi.a([[[B[[B[[B[[I[[F[[I[[B[[B[[FI[[F[[I[[I[[II)[Lhg;" -> "under";
                            case "a.a([[F[[F[[II[[F[[B[[II[[B[[B[[B[[[B)[Lhg;" -> "over";
                            case "ih.a(I[Lhg;)V" -> "submit";
                            case "s.a([[F[[B[[B[Lgi;II[[F[[B[[B[[II[[F)V" -> "lights";
                            default -> null;
                        };
                        if (replace==null) super.visitMethodInsn(op,owner,n,d,iface);
                        else super.visitMethodInsn(op,"HdFinishBuildInputsOracle",replace,d,false);
                    }
                };
            }
        },0); Files.write(dir.resolve("di.class"),w.toByteArray());
    }
    public static void main(String[] args) throws Exception {
        if (args.length!=0) { instrument(Path.of(args[0])); return; }
        for (int water=0;water<=1;water++) for (fault=0;fault<4;fault++) {
            generation=0; underwater=water!=0; tf.w=true; od.c=true; events.clear(); ids.clear();
            replace(); jd.d=new byte[4][105][105]; s.i=new int[104]; l.l=new int[104];
            wk.v=new int[104]; ug.d=new int[104]; ka.r=new int[104];
            String status="complete";
            try { di.a(null,underwater,98); }
            catch (End end) { status="submitted"; }
            catch (ld wrapped) {
                if (!(wrapped.f instanceof ArrayIndexOutOfBoundsException)) throw wrapped;
                status="bounds";
            }
            System.out.println(water+" "+fault+"|"+String.join(";",events)+"|"+status);
        }
    }
}
