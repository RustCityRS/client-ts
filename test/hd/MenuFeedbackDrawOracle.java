import java.io.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Observe the text, font choice and invalidation arguments at the original dm.a call sites. */
public final class MenuFeedbackDrawOracle {
    static final List<String> events = new ArrayList<>();
    static rk normal, alternate;
    static String fault, branch;
    static na word(String s) {
        na value = gn.a((byte)-92,s.length());
        for (char c : s.toCharArray()) value.d(c,(byte)115);
        return value;
    }
    static String text(na value) {
        return value == null ? "-" : HexFormat.of().formatHex(value.T,0,value.lb);
    }
    static dd font(int stride) {
        byte[] metrics = new byte[257]; Arrays.fill(metrics,(byte)stride); metrics[256] = 5;
        int[] x = new int[256], y = new int[256], w = new int[256], h = new int[256];
        Arrays.fill(w,1); Arrays.fill(h,2); Arrays.fill(y,1);
        byte[][] masks = new byte[256][];
        for (int i = 0; i < 256; i++) masks[i] = new byte[]{1,1};
        return new dd(metrics,x,y,w,h,masks);
    }
    public static rk widgetFont(be c, ok[] icons, int guard) {
        if (guard != 0 || icons != mi.T) throw new AssertionError();
        events.add("font");
        if (fault.equals("font")) throw new IllegalStateException();
        return branch.equals("widget") ? alternate : null;
    }
    static String label(rk font) { return Objects.requireNonNull(font) == normal ? "base" : "alt"; }
    public static int plain(rk f, na s, int x, int y, int colour, int shadow, Random random, int seed) {
        events.add("plain " + label(f) + " " + text(s) + " " + x + "," + y + "," + colour + "," + shadow + "," + seed);
        int jitter = f.a(s,x,y,colour,shadow,random,seed);
        if (fault.equals("swap")) wl.q = alternate;
        if (fault.equals("drop")) wl.q = null;
        return jitter;
    }
    public static int width(rk f, na s) {
        events.add("width " + label(f) + " " + text(s));
        return f.a(s);
    }
    public static int aligned(rk f, na s, int x, int y, int w, int h, int col, int sh, int hor, int ver, Random r, int seed, int[] bounds) {
        events.add("aligned " + label(f) + " " + text(s) + " " + x + "," + y + "," + w + "," + h + "," + col + "," + sh + "," + hor + "," + ver + "," + seed);
        return f.a(s,x,y,w,h,col,sh,hor,ver,r,seed,bounds);
    }
    public static void invalidate(int x, int w, byte dummy, int y, int h) {
        if (dummy != -40) throw new AssertionError();
        events.add("area " + x + "," + y + "," + w + "," + h);
        kf.a(x,w,dummy,y,h);
    }
    static void instrument(Path directory) throws Exception {
        try (InputStream stream = MenuFeedbackDrawOracle.class.getResourceAsStream("/dm.class")) {
            ClassReader reader = new ClassReader(stream);
            ClassWriter writer = new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int a,String n,String d,String s,String[] ex) {
                    MethodVisitor mv=super.visitMethod(a,n,d,s,ex);
                    if (!n.equals("a") || !d.equals("(Lbe;III)V")) return mv;
                    return new MethodVisitor(Opcodes.ASM8,mv) {
                        public void visitMethodInsn(int op,String cls,String name,String desc,boolean itf) {
                            String hook = switch (cls + "." + name + desc) {
                                case "be.a([Lok;I)Lrk;" -> "widgetFont";
                                case "rk.a(Lna;IIIILjava/util/Random;I)I" -> "plain";
                                case "rk.a(Lna;)I" -> "width";
                                case "rk.a(Lna;IIIIIIIILjava/util/Random;I[I)I" -> "aligned";
                                case "kf.a(IIBII)V" -> "invalidate";
                                default -> null;
                            };
                            if (hook == null) super.visitMethodInsn(op,cls,name,desc,itf);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"MenuFeedbackDrawOracle",hook,
                                op == Opcodes.INVOKESTATIC ? desc : "(L" + cls + ";" + desc.substring(1),false);
                        }
                    };
                }
            },0);
            Files.write(directory.resolve("dm.class"),writer.toByteArray());
        }
    }
    public static void main(String[] args) throws Exception {
        if (args.length == 1) { instrument(Path.of(args[0])); return; }
        kb.a(new int[100 * 70],100,70);
        normal = font(4); alternate = font(6);
        uj.C = new na[]{word("Walk"),word("Take"),word("Read"),word("Try")};
        t.v = new na[]{word(""),word("Coin"),word("Caf\u00e9"),word("Box")};
        hn.W=word("Cast"); gd.i=word("Fire"); ck.D=word("Key");
        vh.b=new int[]{0,10,39}; e.sc=new int[]{0,10,0}; sd.V=new int[]{8,41,33}; fe.lb=new int[]{8,29,32}; bn.V=3;
        var input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            String[] parts = line.split(" ");
            int guard=Integer.parseInt(parts[0]); branch=parts[1]; String selection=parts[2]; fault=parts[3];
            sk.kb=switch(selection){case "idle","use","spell" -> 1; case "two" -> 2; default -> 4;};
            vd.C=selection.equals("use") ? 1 : 0; th.n=selection.equals("spell");
            nj.a=selection.equals("shift"); pb.q=new boolean[112]; pb.q[81]=nj.a;
            wl.q=fault.equals("noFont") ? null : normal; d.S=fault.equals("random") ? null : new Random(1987);
            em.D=-203; pa.R=new boolean[fault.equals("roots") ? 1 : 3];
            e.pc=fault.equals("nullBounds") ? null : fault.equals("shortBounds") ? new int[]{-4,-3} : new int[]{-4,-3,-2,-1};
            be c=branch.equals("null") ? null : new be();
            if (c!=null) { c.n=77; c.R=33; c.rb=0x72c549; c.Oc=0x120924; c.S=1; c.yb=2; }
            events.clear(); String result="ok";
            try { dm.a(c,guard,6,11); }
            catch(ld ex) {
                Throwable root=ex; while(root instanceof ld wrapped) root=wrapped.f;
                result=root.getClass().getSimpleName()+" "+ex.e.substring(ex.e.lastIndexOf("dm.D("));
            }
            System.out.println(line+"|"+result+"|"+String.join(";",events)+"|"+Arrays.toString(e.pc)+"|"+Arrays.toString(pa.R));
        }
    }
}
