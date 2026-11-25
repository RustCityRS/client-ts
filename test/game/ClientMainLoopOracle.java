import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import jdk.internal.org.objectweb.asm.*;

/** Keep the complete client.a(int) instruction stream and its branches. Replace only the
 * polled subsystems with recorded calls whose state transitions come from each test row. */
class ClientMainLoopOracle {
    static final List<String> calls = new ArrayList<>();
    static String changeAt;
    static int nextState, response;
    static final Map<String,String> observed = Map.ofEntries(
        Map.entry("client.g(I)V","js5"), Map.entry("wi.a(Z)V","master"),
        Map.entry("sd.e(I)V","fade"), Map.entry("uj.a(I)V","pcm"),
        Map.entry("ng.b(Z)V","keyboard"), Map.entry("wk.a(B)V","mouse"),
        Map.entry("le.a(B)I","wheel"), Map.entry("client.f(B)V","load"),
        Map.entry("ed.d(I)V","slow"), Map.entry("gj.e(I)V","map"),
        Map.entry("client.g(B)V","title"), Map.entry("hi.a(I)V","account"),
        Map.entry("ig.a(I)V","world"), Map.entry("le.a(I)V","login"),
        Map.entry("t.c(I)V","game"), Map.entry("hg.a(Z)V","resume"), Map.entry("ig.b(I)V","logout"));

    public static int calendar(Calendar calendar,int field) {
        return switch(field) {case Calendar.HOUR_OF_DAY -> 14; case Calendar.MINUTE -> 23; case Calendar.SECOND -> 41; default -> throw new AssertionError(field);};
    }
    public static void note(String call) {
        calls.add(call);
        if (call.equals(changeAt)) tf.C = nextState;
        if (call.equals("login")) dg.h = response;
    }
    static void prepare(Path jar,Path out) throws Exception {
        try(JarFile source=new JarFile(jar.toFile())) {
            ClassReader reader=new ClassReader(source.getInputStream(source.getJarEntry("client.class")));
            ClassWriter writer=new ClassWriter(0);
            reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
                public MethodVisitor visitMethod(int a,String name,String desc,String sig,String[] exceptions) {
                    MethodVisitor original=super.visitMethod(a,name,desc,sig,exceptions);
                    if(!name.equals("a") || !desc.equals("(I)V")) return original;
                    return new MethodVisitor(Opcodes.ASM8,original) {
                        public void visitMethodInsn(int op,String owner,String name,String desc,boolean itf) {
                            String call=observed.get(owner+"."+name+desc);
                            if (call!=null) {
                                // Every observed call takes one primitive argument, plus its receiver on non-static calls.
                                super.visitInsn(op==Opcodes.INVOKESTATIC ? Opcodes.POP : Opcodes.POP2);
                                super.visitLdcInsn(call);
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"ClientMainLoopOracle","note","(Ljava/lang/String;)V",false);
                                if(call.equals("wheel")) super.visitIntInsn(Opcodes.BIPUSH,7);
                            } else if(owner.equals("java/util/Calendar") && name.equals("get")) {
                                super.visitMethodInsn(Opcodes.INVOKESTATIC,"ClientMainLoopOracle","calendar","(Ljava/util/Calendar;I)I",false);
                            } else super.visitMethodInsn(op,owner,name,desc,itf);
                        }
                    };
                }
            },0);
            Files.write(out.resolve("client.class"),writer.toByteArray());
        }
    }
    public static void main(String[] args) throws Exception {
        if(args.length!=0) {prepare(Path.of(args[0]),Path.of(args[1])); return;}
        Class<?> unsafe=Class.forName("sun.misc.Unsafe");
        Field field=unsafe.getDeclaredField("theUnsafe"); field.setAccessible(true);
        Method allocate=unsafe.getMethod("allocateInstance",Class.class);
        client app=(client)allocate.invoke(field.get(null),client.class);
        wi master=(wi)allocate.invoke(field.get(null),wi.class);
        le wheel=wg.a(-128);
        BufferedReader in=new BufferedReader(new InputStreamReader(System.in));
        for(String row; (row=in.readLine())!=null;) {
            String[] words=row.split(" ");
            tf.C=Integer.parseInt(words[0]); changeAt=words[1]; nextState=Integer.parseInt(words[2]);
            response=Integer.parseInt(words[3]); int peers=Integer.parseInt(words[4]);
            hh.kb=Integer.parseInt(words[5]); mi.v=(peers&1)==0?null:master; lj.k=(peers&2)==0?null:wheel;
            ei.s=-1; bi.i.setSeed(123); kf.l=-123; dg.h=-3; calls.clear();
            app.a(100);
            System.out.println(tf.C+"/"+hh.kb+"/"+ei.s+"/"+bi.i.nextInt()+"/"+kf.l+"/"+String.join(",",calls));
        }
    }
}
