import java.applet.Applet;
import java.nio.file.*;
import java.util.Objects;
import java.util.function.Function;
import jdk.internal.org.objectweb.asm.*;
import netscape.javascript.JSObject;

@SuppressWarnings("removal")
public final class SdLiveConnectMemberOracle {
    // JDK 21's JSObject still implements the plugin API except the static
    // getWindow(Applet) resolver. Add that method on the JDK host side.
    static void patchJdk(Path directory) throws Exception {
        String owner = "netscape/javascript/JSObject";
        try (var bytes = JSObject.class.getResourceAsStream("/" + owner + ".class")) {
            ClassReader reader = new ClassReader(bytes);
            ClassWriter out = new ClassWriter(reader, 0);
            reader.accept(new ClassVisitor(Opcodes.ASM8, out) {
                public void visitEnd() {
                    super.visitField(Opcodes.ACC_PUBLIC | Opcodes.ACC_STATIC, "fixtureResolver", "Ljava/util/function/Function;", null, null).visitEnd();
                    var m = super.visitMethod(Opcodes.ACC_PUBLIC | Opcodes.ACC_STATIC, "getWindow",
                        "(Ljava/applet/Applet;)Lnetscape/javascript/JSObject;", null, null);
                    m.visitCode();
                    m.visitFieldInsn(Opcodes.GETSTATIC, owner, "fixtureResolver", "Ljava/util/function/Function;");
                    m.visitVarInsn(Opcodes.ALOAD, 0);
                    m.visitMethodInsn(Opcodes.INVOKEINTERFACE, "java/util/function/Function", "apply", "(Ljava/lang/Object;)Ljava/lang/Object;", true);
                    m.visitTypeInsn(Opcodes.CHECKCAST, owner);
                    m.visitInsn(Opcodes.ARETURN); m.visitMaxs(2, 1); m.visitEnd();
                    super.visitEnd();
                }
            }, 0);
            Path file=directory.resolve(owner+".class");
            Files.createDirectories(file.getParent()); Files.write(file,out.toByteArray());
        }
    }
    static final Object token = new Object();
    static final IllegalStateException failure = new IllegalStateException();
    static String action;
    static final class Window extends JSObject {
        public Object call(String name,Object... args) {
            if(args!=null)throw new AssertionError("expected null argument array");
            action="call/"+name;
            if ("fail".equals(name)) throw failure;
            return token;
        }
        public Object eval(String source) {
            action="eval/"+source;
            if ("fail".equals(source)) throw failure;
            return token;
        }
        public Object getMember(String n){throw new AssertionError();}
        public void setMember(String n,Object v){throw new AssertionError();}
        public void removeMember(String n){throw new AssertionError();}
        public Object getSlot(int i){throw new AssertionError();}
        public void setSlot(int i,Object v){throw new AssertionError();}
    }
    public static void main(String[] args) throws Throwable {
        if(args.length>0){patchJdk(Path.of(args[0]));return;}
        Applet page=new Applet();Window window=new Window();
        Function<Applet,JSObject> resolver=a->{
            Objects.requireNonNull(a);
            if(a!=page)throw new AssertionError("unexpected applet identity");
            return window;
        };
        JSObject.class.getDeclaredField("fixtureResolver").set(null,resolver);
        for(boolean call:new boolean[]{false,true}) for(boolean enabled:new boolean[]{false,true})
            for(boolean present:new boolean[]{false,true}) for(String text:new String[]{null,"hello","fail"}) {
                action="-";String result;
                try {
                    if(call){
                        Object r=w.a(enabled?-11594:-11593,present?page:null,text);
                        result=r==token?"same":r==null?"null":"different";
                    } else {w.a(enabled?13:12,text,present?page:null);result="void";}
                } catch(NullPointerException e){result="null applet";}
                  catch(IllegalStateException e){if(e!=failure)throw e;result="same exception";}
                System.out.println(call+"|"+enabled+"|"+present+"|"+text+"|"+action+"|"+result);
            }
    }
}
