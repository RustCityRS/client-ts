import java.applet.Applet;
import java.awt.Canvas;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.Insets;
import java.io.InputStream;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Observe each gamepack's original PUTSTATIC writes inside the window geometry branch. */
@SuppressWarnings("removal")
public final class WindowLayoutOracle {
    static final String[] NAMES = {"fw", "fh", "w", "h", "x", "y"};
    static final String[] SD = {"vk.rb", "oh.j", "hi.f", "fl.l", "pa.rb", "sk.N"};
    static final String[] HD = {"fl.U", "jh.c", "dl.d", "uj.B", "lf.f", "od.e"};
    static final List<String> events = new ArrayList<>();
    static int fault, width, height;

    static void event(String value) {
        events.add(value);
        if (events.size() == fault) throw new IllegalStateException("probe");
    }
    public static void stored(String slot, int value) { event(slot + "=" + value); }

    static void instrument(boolean hd, Path output) throws Exception {
        instrument(hd,output,hd ? "pm" : "he",hd ? "(ZIZIZII)V" : "(IIIIZZI)V");
    }

    static void instrument(boolean hd, Path output, String owner, String signatureFilter) throws Exception {
        Map<String, String> names = new HashMap<>();
        for (int i = 0; i < NAMES.length; i++) names.put((hd ? HD : SD)[i], NAMES[i]);
        ClassReader reader;
        try (InputStream src = WindowLayoutOracle.class.getResourceAsStream("/" + owner + ".class")) { reader = new ClassReader(src); }
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            public MethodVisitor visitMethod(int access, String name, String desc, String signature, String[] exceptions) {
                MethodVisitor next = super.visitMethod(access, name, desc, signature, exceptions);
                if (!name.equals("a") || !desc.equals(signatureFilter)) return next;
                return new MethodVisitor(Opcodes.ASM8, next) {
                    public void visitFieldInsn(int opcode, String owner, String name, String desc) {
                        super.visitFieldInsn(opcode, owner, name, desc);
                        String slot = names.get(owner + "." + name);
                        if (opcode == Opcodes.PUTSTATIC && slot != null) {
                            super.visitLdcInsn(slot);
                            super.visitFieldInsn(Opcodes.GETSTATIC, owner, name, desc);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "WindowLayoutOracle", "stored", "(Ljava/lang/String;I)V", false);
                        }
                    }
                };
            }
        }, 0);
        Files.write(output.resolve(owner + ".class"), writer.toByteArray());
    }

    static final class Boundary extends Error {}
    static final class Page extends Applet {
        public Dimension getSize() { event("size"); return new Dimension(width, height); }
    }
    static final class Window extends Frame {
        public Dimension getSize() { event("size"); return new Dimension(width, height); }
        public Insets getInsets() { event("insets"); return new Insets(7,3,13,8); }
    }
    static final class Screen extends Canvas {
        public void setSize(int w, int h) { event("canvas=" + w + "x" + h); }
        public void setLocation(int x, int y) { event("at=" + x + "," + y); throw new Boundary(); }
    }

    static int marginFailure;
    static final Boundary marginError = new Boundary();
    static void marginEvent(String call) {
        events.add(call);
        if (marginFailure == 1) throw new IllegalStateException();
        if (marginFailure == 2) throw marginError;
    }
    static final class MarginPage extends Applet {
        public java.awt.Graphics getGraphics() { marginEvent("page.graphics"); return null; }
    }
    static final class MarginFrame extends Frame {
        public Insets getInsets() { marginEvent("insets"); return new Insets(7, 3, 13, 8); }
        public java.awt.Graphics getGraphics() { marginEvent("frame.graphics"); return null; }
    }

    static void margins(boolean hd, Object link) throws Exception {
        Method clear = Class.forName(hd ? "l" : "bh").getDeclaredMethod(hd ? "b" : "a", int.class);
        String[] slots = hd ? HD : SD;
        field(hd ? "ll.i" : "fb.o").set(link, headless(MarginPage.class));
        MarginFrame desktop = (MarginFrame)headless(MarginFrame.class);
        MarginFrame full = (MarginFrame)headless(MarginFrame.class);
        for (int host = 0; host < 3; host++) {
            field(hd ? "d.Y" : "tb.h").set(null, host == 0 ? null : desktop);
            field(hd ? "fh.Y" : "aj.kb").set(null, host == 2 ? full : null);
            for (int margin = 0; margin < 2; margin++) {
                int[] values = {80, 60, 80, 60, margin, 0};
                for (int i = 0; i < slots.length; i++) field(slots[i]).setInt(null, values[i]);
                for (marginFailure = 0; marginFailure < 3; marginFailure++) {
                    events.clear();
                    String result = "ok";
                    try { clear.invoke(null, hd ? -1 : 90); }
                    catch (InvocationTargetException e) {
                        if (e.getCause() != marginError) throw e;
                        result = "error";
                    }
                    System.out.println(String.join(" ", events) + "|" + result);
                }
            }
        }
    }

    static Field field(String slot) throws Exception {
        String[] parts = slot.split("\\.");
        return Class.forName(parts[0]).getDeclaredField(parts[1]);
    }

    static Object headless(Class<?> type) throws Exception {
        Class<?> vm = Class.forName("sun.misc.Unsafe");
        Field singleton = vm.getDeclaredField("theUnsafe");
        singleton.setAccessible(true);
        return vm.getMethod("allocateInstance", Class.class).invoke(singleton.get(null), type);
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        if (args.length == 2) { instrument(hd, Path.of(args[1])); return; }
        String[] names = hd ? HD : SD;
        Class<?> shell = Class.forName(hd ? "pm" : "he");
        Method method = hd ? shell.getDeclaredMethod("a", boolean.class,int.class,boolean.class,int.class,boolean.class,int.class,int.class)
            : shell.getDeclaredMethod("a", int.class,int.class,int.class,int.class,boolean.class,boolean.class,int.class);
        Object link = headless(Class.forName(hd ? "ll" : "fb"));
        field(hd ? "ll.i" : "fb.o").set(link, headless(Page.class));
        field(hd ? "fk.l" : "tj.m").set(null, link);
        field(hd ? "md.L" : "pe.S").set(null, new Screen());
        Window standalone = (Window)headless(Window.class);
        Field frame = field(hd ? "d.Y" : "tb.h");
        Field context = field(hd ? "ld.e" : "g.q");
        for (int host = 0; host <= 1; host++) for (int size = 0; size <= 1; size++) {
            frame.set(null, host == 0 ? null : standalone);
            width = size == 0 ? 610 : 1181;
            height = size == 0 ? 407 : 803;
            for (int mode : new int[]{-1, 0, 1, 2, 4}) for (fault = 0; fault <= 14; fault++) {
                for (String name : names) field(name).setInt(null, -77);
                events.clear();
                String result;
                try {
                    if (hd) method.invoke(null, false,mode,false,2,false,123,456);
                    else method.invoke(null, mode,34,123,2,false,false,456);
                    throw new AssertionError("missed end of window sizing");
                } catch (InvocationTargetException e) {
                    Throwable cause = e.getCause();
                    result = cause instanceof Boundary ? "at-window" : (String)context.get(cause);
                }
                StringJoiner values = new StringJoiner(",");
                for (String name : names) values.add(Integer.toString(field(name).getInt(null)));
                System.out.println(String.join(" ",events) + "|" + result + "|" + values);
            }
        }
        margins(hd, link);
    }
}
