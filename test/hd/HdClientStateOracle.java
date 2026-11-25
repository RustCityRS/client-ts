import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

/** Run the five original HD methods. Record the edges to browser services and selected state writes. */
public class HdClientStateOracle {
    static final List<String> events = new ArrayList<>();
    static String stop = "";
    public static int ready, listCode;
    public static long heap;

    static void event(String value) {
        events.add(value);
        if (value.equals(stop)) throw new IllegalStateException(value);
    }
    public static void copy() { event("copy:" + tl.d); }
    public static void noise() { event("noise"); }
    public static void save(ll link, byte guard) { event("save"); }
    public static void mode(boolean replace, int mode, int guard, int width, int height) {
        event("mode:" + mode + "," + width + "," + height + "," + replace);
    }
    public static void transition(int state, int guard) { event("state:" + state); }
    public static void js5(jb queue, boolean loggedIn, boolean guard) { event("js5:" + loggedIn); }
    public static void interfaces(int guard) {}

    static void write(String cls, JarFile jar, Path out) throws Exception {
        ClassReader reader = new ClassReader(jar.getInputStream(jar.getJarEntry(cls + ".class")));
        ClassWriter writer = new ClassWriter(reader, ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8, writer) {
            public MethodVisitor visitMethod(int flags, String name, String desc, String sig, String[] exceptions) {
                MethodVisitor original = super.visitMethod(flags, name, desc, sig, exceptions);
                String key = cls + "." + name + desc;
                if (!List.of("k.a(Lna;Z)V","client.i(I)V","pl.a(II)V","lf.a(I)V","tk.a(Z)V").contains(key)) return original;
                return new MethodVisitor(Opcodes.ASM8, original) {
                    public void visitFieldInsn(int op, String owner, String name, String type) {
                        super.visitFieldInsn(op,owner,name,type);
                        if (op != Opcodes.PUTSTATIC) return;
                        String label = switch (key + "/" + owner + "." + name) {
                            case "client.i(I)V/hn.X" -> "aa";
                            case "client.i(I)V/pa.N" -> "liveAA";
                            case "client.i(I)V/rg.F" -> "window";
                            case "client.i(I)V/lb.A" -> "area";
                            case "client.i(I)V/na.h" -> "safe";
                            case "client.i(I)V/qc.P" -> "percent";
                            case "client.i(I)V/nc.j" -> "stage";
                            case "client.i(I)V/jm.z" -> "text";
                            case "tk.a(Z)V/pm.ab" -> "camera";
                            case "tk.a(Z)V/pe.a" -> "verify";
                            case "pl.a(II)V/tl.d" -> "commit";
                            case "pl.a(II)V/wc.g" -> "missingLocs";
                            case "pl.a(II)V/sj.p" -> "filePeak";
                            case "pl.a(II)V/t.y" -> "phase";
                            case "pl.a(II)V/cn.B" -> "modelPeak";
                            case "pl.a(II)V/nm.U" -> "missingFiles";
                            default -> null;
                        };
                        if (label != null) {
                            super.visitLdcInsn(label);
                            super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdClientStateOracle","event","(Ljava/lang/String;)V",false);
                        }
                    }
                    public void visitMethodInsn(int op, String owner, String name, String desc, boolean itf) {
                        String edge = owner + "." + name + desc;
                        if (key.equals("client.i(I)V")) {
                            String loadEdge=switch(edge) {
                                case "java/lang/Runtime.totalMemory()J" -> "heap";
                                case "java/lang/Runtime.freeMemory()J" -> "zeroLong";
                                case "ad.a(B)J" -> "clock";
                                case "java/lang/System.gc()V", "hn.a(Lve;ILve;)V", "cg.a(ILve;)V", "ve.a(IZZ)V" -> "void";
                                case "al.b(I)Z", "fn.a(Lve;Lve;Z)I", "lk.a(ILve;)I", "cd.a(Lve;B)I" -> "ready";
                                case "ld.a(B)I", "ia.a(I)I", "f.h(I)I", "ve.a(Lna;B)I" -> "one";
                                case "al.a(ZZZIZ)Lve;" -> "null";
                                case "ql.b(I)I" -> "list";
                                default -> null;
                            };
                            if (loadEdge!=null) {
                                Type[] args=Type.getArgumentTypes(desc);
                                for (int i=args.length-1;i>=0;i--) super.visitInsn(args[i].getSize()==2?Opcodes.POP2:Opcodes.POP);
                                if (op!=Opcodes.INVOKESTATIC) super.visitInsn(Opcodes.POP);
                                switch(loadEdge) {
                                    case "heap" -> super.visitFieldInsn(Opcodes.GETSTATIC,"HdClientStateOracle","heap","J");
                                    case "zeroLong" -> super.visitInsn(Opcodes.LCONST_0);
                                    case "clock" -> super.visitLdcInsn(2999L);
                                    case "ready" -> super.visitFieldInsn(Opcodes.GETSTATIC,"HdClientStateOracle","ready","I");
                                    case "one" -> super.visitInsn(Opcodes.ICONST_1);
                                    case "null" -> super.visitInsn(Opcodes.ACONST_NULL);
                                    case "list" -> super.visitFieldInsn(Opcodes.GETSTATIC,"HdClientStateOracle","listCode","I");
                                }
                                return;
                            }
                        }
                        String probe = switch (edge) {
                            case "tf.h()V" -> "copy";
                            case "lm.a()V" -> "noise";
                            case "qh.a(Lll;B)V" -> "save";
                            case "th.a(ZIIII)V" -> "mode";
                            case "pl.a(II)V" -> key.equals("lf.a(I)V") || key.equals("client.i(I)V") ? "transition" : null;
                            case "jb.a(ZZ)V" -> "js5";
                            case "eb.d(I)V" -> "interfaces";
                            default -> null;
                        };
                        if (probe == null) super.visitMethodInsn(op,owner,name,desc,itf);
                        else super.visitMethodInsn(Opcodes.INVOKESTATIC, "HdClientStateOracle", probe,
                            op == Opcodes.INVOKEVIRTUAL ? "(L" + owner + ";" + desc.substring(1) : desc, false);
                    }
                };
            }
        },0);
        Files.write(out.resolve(cls + ".class"),writer.toByteArray());
    }

    static void row(String scenario, Runnable exercise, java.util.function.Supplier<String> state) {
        events.clear();
        boolean failed = false;
        try { exercise.run(); } catch (RuntimeException e) { failed = true; }
        System.out.println(scenario + "|" + failed + "|" + String.join(";",events) + "|" + state.get());
    }
    public static void main(String[] args) throws Exception {
        if (args.length != 0) {
            try (JarFile jar = new JarFile(args[0])) {
                for (String cls : List.of("pl","lf","k","client","tk")) write(cls,jar,Path.of(args[1]));
            }
            return;
        }
        for (boolean active : new boolean[]{false,true}) for (int before : new int[]{10,25,28,30,40})
            for (int next : new int[]{10,25,28,30,40}) for (boolean fail : new boolean[]{false,true}) {
                tf.w = active; tl.d = before; bb.n = 0; stop = fail ? "copy:" + before : "";
                row("state,"+active+","+before+","+next+","+fail, () -> pl.a(next,5), () -> Integer.toString(tl.d));
            }
        for (boolean active : new boolean[]{false,true}) for (int before : new int[]{5,10,25,28,30,40}) {
            tf.w = active; tl.d = before; stop = "";
            row("rebuild,"+active+","+before, () -> lf.a(100), () -> Integer.toString(tl.d));
        }
        for (int rights : new int[]{0,2}) for (String text : List.of("::wm0","::WM1","::wm2","::wm3","::wm3 ","::wm4"))
            for (boolean fail : new boolean[]{false,true}) {
                pg.S = rights; ag.P = new i(128); ag.P.a(new int[]{1,22,4,8},false);
                int index = text.charAt(4) - '0';
                stop = fail ? "mode:"+index+","+(index==3?"1024,768":"-1,-1")+",false" : "";
                row("cheat,"+rights+","+text+","+fail, () -> k.a(cd.a(text,(byte)-128),false),
                    () -> HexFormat.of().formatHex(ag.P.y,0,ag.P.T));
            }
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Field singleton = unsafe.getDeclaredField("theUnsafe"); singleton.setAccessible(true);
        client instance = (client)unsafe.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),client.class);
        Method load = client.class.getDeclaredMethod("i",int.class); load.setAccessible(true);
        for (boolean safe : new boolean[]{false,true}) for (String failure : List.of("","noise","liveAA","safe","save","mode","percent","stage","text")) {
            na.h=safe; hn.X=2; pa.N=1; rg.F=2; lb.A=3; nc.j=150; qc.P=97; jm.z=null;
            stop=failure.equals("mode") ? "mode:"+(safe?0:2)+",-1,-1,false" : failure;
            row("load,"+safe+","+failure, () -> {
                try { load.invoke(instance,107); } catch (ReflectiveOperationException e) { throw new RuntimeException(e); }
            }, () -> hn.X+","+pa.N+","+rg.F+","+lb.A+","+na.h+","+nc.j+","+qc.P+","+(jm.z==rg.E));
        }
        for (int stage : new int[]{0,10,30,50,60,65,80,135,140}) for (int gate : new int[]{0,1})
            for (String failure : List.of("","text","stage","percent")) {
                ready=gate; heap=gate==0?0:20L*1024L*1024L; listCode=gate==0?-1:0;
                na.h=true; en.A=true; nm.Y=0L; mj.A=0L; nc.j=stage; qc.P=-1; jm.z=null;
                v.f=(al)unsafe.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),al.class);
                stop=failure;
                row("progress,"+stage+","+gate+","+failure, () -> {
                    try { load.invoke(instance,107); } catch (ReflectiveOperationException e) { throw new RuntimeException(e); }
                }, () -> nc.j+","+qc.P+","+(jm.z!=null));
            }
        for (boolean active : new boolean[]{false,true}) for (int shortArray : new int[]{-1,0,1,2})
            for (boolean failAtCamera : new boolean[]{false,true}) {
                stop=failAtCamera?"camera":""; tf.w=active; sa.W=false; pe.a=9; pm.ab=false;
                od.f=new jd(); md.W=-1; tl.d=10;
                hk.fb=new int[shortArray==0?24:25]; lb.p=new int[shortArray==1?24:25]; sg.b=new int[shortArray==2?24:25];
                Arrays.fill(hk.fb,1); Arrays.fill(lb.p,1); Arrays.fill(sg.b,1);
                ag.P=new i(128); ag.P.a(new int[]{1,22,4,8},false);
                row("reset,"+active+","+shortArray+","+failAtCamera, () -> tk.a(true),
                    () -> sa.W+","+pm.ab+","+pe.a+","+Arrays.stream(hk.fb).sum()+","+Arrays.stream(lb.p).sum()+","+Arrays.stream(sg.b).sum());
            }
    }
}
