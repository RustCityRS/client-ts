import java.awt.Frame;
import java.io.InputStream;
import java.lang.reflect.*;
import java.nio.file.*;
import jdk.internal.org.objectweb.asm.*;

/** Replace only the final AWT/renderer call, leaving the original mode decision and exception handler intact. */
public class WindowRequestOracle {
    static String call;
    static boolean fail;

    public static void hd(boolean replace, int mode, boolean rebuild, int previous, boolean unused, int height, int width) {
        if (unused) throw new AssertionError("pm.a guard");
        record(mode, height, previous, rebuild, replace, width);
    }

    public static void sd(int mode, int guard, int height, int previous, boolean rebuild, boolean replace, int width) {
        if (guard != 34) throw new AssertionError("he.a guard");
        record(mode, height, previous, rebuild, replace, width);
    }

    static void record(int mode, int height, int previous, boolean rebuild, boolean replace, int width) {
        call = mode + "," + height + "," + previous + "," + rebuild + "," + replace + "," + width;
        if (fail) throw new IllegalStateException("window");
    }

    static void instrument(boolean hd, Path output) throws Exception {
        String owner = hd ? "th" : "ui", target = hd ? "pm" : "he";
        String descriptor = hd ? "(ZIIII)V" : "(IZIZI)V", mount = hd ? "(ZIZIZII)V" : "(IIIIZZI)V";
        try (InputStream bytes = WindowRequestOracle.class.getResourceAsStream("/" + owner + ".class")) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter writer = new ClassWriter(reader, 0);
            int[] replaced = {0};
            reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
                public MethodVisitor visitMethod(int access, String name, String desc, String sig, String[] exceptions) {
                    MethodVisitor parent = super.visitMethod(access,name,desc,sig,exceptions);
                    if (!name.equals("a") || !desc.equals(descriptor)) return parent;
                    return new MethodVisitor(Opcodes.ASM8,parent) {
                        public void visitMethodInsn(int op, String cls, String method, String desc, boolean iface) {
                            if (cls.equals(target) && method.equals("a") && desc.equals(mount)) {
                                replaced[0]++;
                                super.visitMethodInsn(op,"WindowRequestOracle",hd ? "hd" : "sd",desc,false);
                            } else super.visitMethodInsn(op,cls,method,desc,iface);
                        }
                    };
                }
            },0);
            if (replaced[0] != 1) throw new AssertionError("Window call count " + replaced[0]);
            Files.write(output.resolve(owner + ".class"),writer.toByteArray());
        }
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        if (args.length == 2) { instrument(hd,Path.of(args[1])); return; }
        Method request = hd ? Class.forName("th").getDeclaredMethod("a",boolean.class,int.class,int.class,int.class,int.class)
                            : Class.forName("ui").getDeclaredMethod("a",int.class,boolean.class,int.class,boolean.class,int.class);
        Field refresh = WindowLayoutOracle.field(hd ? "hi.f" : "oa.a");
        Field os = WindowLayoutOracle.field(hd ? "ll.n" : "fb.l");
        Field context = WindowLayoutOracle.field(hd ? "ld.e" : "g.q");
        Frame fullscreen = (Frame)WindowLayoutOracle.headless(Frame.class);
        for (int current = 0; current < (hd ? 4 : 1); current++) {
            if (hd) {
                WindowLayoutOracle.field("tf.w").setBoolean(null,current != 0);
                WindowLayoutOracle.field("jk.y").setBoolean(null,current == 2);
                WindowLayoutOracle.field("fh.Y").set(null,current == 3 ? fullscreen : null);
            }
            for (String host : new String[]{"windows","mac os x",null})
                for (int mode : new int[]{-1,0,1,2,3,4}) for (int mask = 0; mask < 8; mask++) {
                    boolean apply = (mask & 1) != 0, replace = (mask & 2) != 0;
                    fail = (mask & 4) != 0;
                    os.set(null,host); refresh.setLong(null,12345L); call = "-";
                    String error = "-";
                    try {
                        if (hd) request.invoke(null,replace,mode,-8914,-321,987);
                        else request.invoke(null,-321,apply,mode,replace,987);
                    } catch (InvocationTargetException e) {
                        error = (String)context.get(e.getCause());
                    }
                    System.out.println(current + "|" + host + "|" + mode + "|" + mask + "|" + refresh.getLong(null) + "|" + call + "|" + error);
                }
        }
    }
}
