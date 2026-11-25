import java.io.PrintStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;

public class HdMemoryCommandsOracle {
    static final List<String> events = new ArrayList<>();

    static void instrument(String jar, Path dir) throws Exception {
        try (JarFile file = new JarFile(jar)) {
            ClassReader reader = new ClassReader(file.getInputStream(file.getJarEntry("k.class")));
            ClassWriter writer = new ClassWriter(reader,0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int flags,String name,String desc,String signature,String[] exceptions) {
                    MethodVisitor method = super.visitMethod(flags,name,desc,signature,exceptions);
                    if (!name.equals("a") || !desc.equals("(Lna;Z)V")) return method;
                    return new MethodVisitor(Opcodes.ASM8,method) {
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                            String probe = switch (owner+"."+name+desc) {
                                case "java/lang/System.gc()V" -> "gc";
                                case "je.h(I)V" -> "clearCaches";
                                case "i.a(Lna;ILna;I)V" -> "chat";
                                case "bf.c(I)V" -> "releaseModels";
                                default -> null;
                            };
                            if (probe == null) super.visitMethodInsn(op,owner,name,desc,itf);
                            else super.visitMethodInsn(Opcodes.INVOKESTATIC,"HdMemoryCommandsOracle",probe,desc,false);
                        }
                    };
                }
            },0);
            Files.write(dir.resolve("k.class"),writer.toByteArray());
        }
    }

    public static void gc() { events.add("gc"); }
    public static void clearCaches(int guard) { events.add("caches"); }
    public static void releaseModels(int guard) { events.add("release"); bf.c(guard); }
    public static void chat(na name,int type,na text,int guard) {
        events.add(new String(text.T,0,text.lb,StandardCharsets.ISO_8859_1).replaceAll("=-?\\d+k", "=<heap>k"));
    }

    public static void main(String[] args) throws Exception {
        if (args.length > 0) { instrument(args[0],Path.of(args[1])); return; }
        PrintStream result = System.out;
        System.setOut(new PrintStream(result) {
            public void println(String line) { events.add(line); }
        });
        for (int rights : new int[]{0,1,2,3}) for (boolean active : new boolean[]{false,true})
            for (int scene : new int[]{0,1,2}) for (String command : List.of("::mm","::MM","::cardmem","::CARDMEM","::cardmem ")) {
                pg.S = rights;
                tf.w = active;
                sk.lb = scene == 2;
                kc.o = scene == 0 ? new bj[0][][] : null;
                fa.f = -217; fa.e = 381; fa.a = 172032;
                ag.P = new i(128);
                ag.P.a(new int[]{1,22,4,8},false);
                events.clear();
                boolean failed = false;
                try { k.a(cd.a(command,(byte)-128),false); } catch (RuntimeException e) { failed = true; }
                result.println(String.join("|",rights+","+active+","+scene+","+command,Boolean.toString(failed),
                    Boolean.toString(sk.lb),HexFormat.of().formatHex(ag.P.y,0,ag.P.T),String.join(";",events)));
            }
    }
}
