import java.awt.Canvas;
import java.awt.Graphics;
import java.lang.reflect.Field;
import java.lang.reflect.Proxy;
import java.nio.file.*;
import java.util.*;
import java.util.jar.JarFile;
import javax.media.opengl.GL;
import javax.media.opengl.GLDrawable;
import jdk.internal.org.objectweb.asm.*;

public class HdTitleDrawOracle {
    static final List<String> events = new ArrayList<>();
    static final int[] pixels = new int[132 * 91];
    static rk first, second, cached;
    static int nextList;
    static int mode;

    static void patch(String jar, Path output) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            for (String owner : List.of("j","jm")) {
                ClassReader cr = new ClassReader(file.getInputStream(file.getJarEntry(owner + ".class")));
                ClassWriter cw = new ClassWriter(cr, ClassWriter.COMPUTE_MAXS);
                cr.accept(new ClassVisitor(Opcodes.ASM8,cw) {
                    public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] errors) {
                        MethodVisitor base = super.visitMethod(access,name,desc,sig,errors);
                        if (!name.equals("a") || !desc.equals(owner.equals("j") ? "(BZLna;)V" : "(Z)V")) return base;
                        return new MethodVisitor(Opcodes.ASM8,base) {
                            public void visitFieldInsn(int op,String o,String n,String d) {
                                super.visitFieldInsn(op,o,n,d);
                                if (op != Opcodes.PUTSTATIC || !Set.of("hi.a","nf.h","oj.v","vg.c","rg.s","bn.V","od.i").contains(o+"."+n)) return;
                                super.visitLdcInsn(o+"."+n);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdTitleDrawOracle","write","(Ljava/lang/String;)V",false);
                            }
                            public void visitMethodInsn(int op,String o,String n,String d,boolean itf) {
                                String target = switch (o+"."+n+d) {
                                    case "rk.b(Lna;I)I" -> "width";
                                    case "rk.c(Lna;I)I" -> "lines";
                                    case "rk.a(Lna;IIIIIIIII)I" -> "paragraph";
                                    case "vk.a(IILjava/awt/Graphics;I)V" -> "blit";
                                    case "hh.a(II)V" -> "animateGroup";
                                    case "al.a(Z)V" -> "drawGroup";
                                    default -> null;
                                };
                                if (target == null) super.visitMethodInsn(op,o,n,d,itf);
                                else {
                                    String type = op == Opcodes.INVOKEVIRTUAL ? "(L"+o+";"+d.substring(1) : d;
                                    super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdTitleDrawOracle",target,type,false);
                                }
                            }
                        };
                    }
                },0);
                Files.write(output.resolve(owner+".class"),cw.toByteArray());
            }
        }
    }

    public static void write(String slot) { events.add(slot); }
    public static void animateGroup(int guard,int group) {
        events.add("animate="+group);
        if (mode == 2) md.W = -1;
    }
    public static void drawGroup(boolean guard) {
        events.add("draw="+vg.c);
        if (mode == 1) tf.w = !tf.w;
        if (mode == 3) throw new IllegalStateException();
    }
    static int label(rk font) {
        if (font == null) throw new NullPointerException();
        return font == first ? 1 : font == second ? 2 : 3;
    }
    public static int width(rk font,na text,int limit) {
        events.add("width="+label(font)+","+limit);
        if (mode == 8) return font.b(text,limit);
        if (mode == 1 || mode == 2) rh.h = mode == 1 ? second : null;
        return 39;
    }
    public static int lines(rk font,na text,int limit) {
        events.add("lines="+label(font)+","+limit);
        if (mode == 8) return font.c(text,limit);
        if (mode == 3) rh.h = second;
        return 2;
    }
    public static int paragraph(rk font,na text,int x,int y,int w,int h,int c,int shadow,int ha,int va,int spacing) {
        events.add("text="+label(font)+","+x+","+y+","+w+","+h+","+c+","+shadow+","+ha+","+va+","+spacing);
        if (mode == 8) return font.a(text,x,y,w,h,c,shadow,ha,va,spacing);
        if (mode == 4) tf.w = !tf.w;
        if (mode == 5) throw new IllegalStateException();
        return 0;
    }
    public static void blit(vk screen,int x,int y,Graphics g,int ignored) {
        if (screen == null) throw new NullPointerException();
        events.add("blit="+x+","+y);
        if (mode == 6) throw new IllegalStateException();
        if (mode == 7) throw new AssertionError();
    }
    static class Surface extends Canvas {
        public Graphics getGraphics() {events.add("graphics"); return null;}
        public void repaint() {events.add("repaint");}
    }
    static void field(Class<?> type,String name,Object value) throws Exception {
        Field f = type.getDeclaredField(name);
        f.setAccessible(true); f.set(null,value);
    }
    static Object proxy(Class<?> type) {
        return Proxy.newProxyInstance(type.getClassLoader(),new Class<?>[] {type},(object,method,args) -> {
            String n = method.getName();
            if (n.equals("glGenLists")) return nextList++;
            if (n.equals("glGenTextures")) {
                ((int[])args[1])[(Integer)args[2]] = 415;
                return null;
            }
            ArrayList<String> params = new ArrayList<>();
            if (args != null) for (Object arg : args) {
                if (arg instanceof Float f) params.add(Integer.toString(Float.floatToRawIntBits(f)));
                else if (arg instanceof Double d) params.add(Long.toString(d.longValue()));
                else params.add(String.valueOf(arg));
            }
            events.add(n+"="+String.join(",",params));
            return null;
        });
    }
    public static void main(String[] args) throws Exception {
        if (args[0].equals("patch")) {patch(args[1],Path.of(args[2])); return;}
        first = (rk)HdTitleFrameOracle.headlessInstance(dd.class);
        second = (rk)HdTitleFrameOracle.headlessInstance(dd.class);
        vd.w = (vk)HdTitleFrameOracle.headlessInstance(ti.class);
        md.L = new Surface();
        field(tf.class,"E",proxy(GLDrawable.class));
        tf.t = (GL)proxy(GL.class);
        tf.J = 132; tf.A = 91;
        Path cache = Path.of(args[1]);
        en data = HdTitleFrameOracle.open(cache.resolve("main_file_cache.dat2"),5200);
        en reference = HdTitleFrameOracle.open(cache.resolve("main_file_cache.idx255"),6000);
        ge master = new ge(255,data,reference,500000);
        ve sprites = new ve(new HdTitleFrameOracle.Disk(master,data,cache,8),false,false);
        ve metrics = new ve(new HdTitleFrameOracle.Disk(master,data,cache,13),false,false);
        int group = sprites.a(cd.a("p12_full",(byte)-127),(byte)-30);
        na box = cd.a("RuneScape<br>Loading",(byte)-127);
        for (String line : Files.readAllLines(Path.of(args[0]))) {
            int[] v = Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int draw = v[0], active = v[1], flag = v[2], guard = v[4];
            mode = v[3]; rh.h = first;
            Arrays.fill(pixels, 0x102030);
            kb.a(pixels,132,91);
            tf.w = active == 1;
            field(tf.class,"o",false); field(tf.class,"l",true); field(tf.class,"u",true); field(tf.class,"F",true);
            field(tf.class,"s",-1); field(tf.class,"d",false);
            if (mode == 8) {
                nextList = 1000;
                rh.h = cached = k.a(0,group,(byte)125,sprites,metrics);
                if (cached == null || (tf.w && !(cached instanceof mb)) || (!tf.w && !(cached instanceof dd))) throw new AssertionError("p12 class");
            }
            bn.V = 3; pa.R = new boolean[]{false,true,false}; ch.y = new boolean[]{false,false,true}; sc.z = new boolean[]{true,false,false};
            vh.b = new int[]{0,17,120}; e.sc = new int[]{0,15,2}; sd.V = new int[]{9,4,7}; fe.lb = new int[]{9,3,4};
            hi.a = 13; nf.h = new be(); oj.v = 12; gj.d = 77; vg.c = false; rg.s = 9; md.W = flag == 1 ? 55 : -1; od.i = 42;
            events.clear(); String outcome = "ok";
            try {
                if (draw == 1) jm.a(true);
                else j.a((byte)guard,flag == 1,v[5] == 1 ? null : box);
            } catch (ld e) { outcome = e.e; }
            catch (AssertionError e) { outcome = "fatal"; }
            String flags = Arrays.toString(pa.R)+Arrays.toString(ch.y)+Arrays.toString(sc.z);
            System.out.println(String.join(";",events)+"|"+outcome+"|"+Arrays.hashCode(pixels)+"|"+flags.replace(" ","")+"|"
                +hi.a+","+ (nf.h==null)+","+oj.v+","+vg.c+","+rg.s+","+bn.V+","+od.i);
        }
    }
}
