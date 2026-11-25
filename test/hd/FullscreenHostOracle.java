import java.awt.Frame;
import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;

/** Run the original nf.a and pm.a(mode list) against SignLink's display capability/request boundary. */
public final class FullscreenHostOracle {
    static String scenario;
    static int checks;
    static final List<String> events=new ArrayList<>();
    static class Display extends Frame {
        public void setVisible(boolean visible) { events.add("visible="+visible); }
        public void dispose() { events.add("dispose"); }
    }
    static Display display;

    public static boolean supports(boolean ignored) {
        events.add("supports");
        ++checks;
        return !scenario.equals("unsupported") && !(scenario.equals("lost") && checks==2);
    }
    public static im modes(byte guard) {
        if (guard!=8) throw new AssertionError("mode list guard");
        events.add("list");
        im result=new im();
        result.d=scenario.equals("listFailed")?2:1;
        result.e=switch(scenario) {
            case "nullList" -> null;
            case "wrongList" -> "bad";
            case "none" -> new int[]{765,503,24,144};
            default -> new int[]{765,503,32,144,1024,768,16,144,1024,768,32,60,1024,768,24,240,1024,768,32,120,45,68};
        };
        return result;
    }
    public static im enter(int refresh,int depth,int height,int width,int guard) {
        events.add("enter="+refresh+","+depth+","+height+","+width);
        if (guard!=-121) throw new AssertionError("enter guard");
        im result=new im();
        result.d=scenario.equals("frameFailed")?2:1;
        result.e=scenario.equals("nullFrame")?null:scenario.equals("wrongFrame")?"bad":display;
        return result;
    }
    public static im exit(Frame frame,int guard) {
        if (frame!=display||guard!=86) throw new AssertionError("exit frame");
        events.add("exit"); im result=new im(); result.d=1; return result;
    }

    static void supplyHost(Path directory) throws Exception {
        var reader=new ClassReader("ll");
        var writer=new ClassWriter(reader,ClassWriter.COMPUTE_MAXS);
        reader.accept(new ClassVisitor(Opcodes.ASM8,writer) {
            public MethodVisitor visitMethod(int access,String name,String desc,String sig,String[] ex) {
                MethodVisitor m=super.visitMethod(access,name,desc,sig,ex);
                String boundary=name.equals("a")?switch(desc) {
                    case "(Z)Z" -> "supports";
                    case "(B)Lim;" -> "modes";
                    case "(IIIII)Lim;" -> "enter";
                    case "(Ljava/awt/Frame;I)Lim;" -> "exit";
                    default -> null;
                }:null;
                if (boundary==null) return m;
                m.visitCode();
                int index=1;
                for (Type a:Type.getArgumentTypes(desc)) {
                    m.visitVarInsn(a.getOpcode(Opcodes.ILOAD),index);
                    index+=a.getSize();
                }
                m.visitMethodInsn(Opcodes.INVOKESTATIC,"FullscreenHostOracle",boundary,desc,false);
                m.visitInsn(Type.getReturnType(desc).getOpcode(Opcodes.IRETURN));
                m.visitMaxs(0,0);
                m.visitEnd();
                return null;
            }
        },0);
        Files.write(directory.resolve("ll.class"),writer.toByteArray());
    }

    public static void main(String[] args) throws Exception {
        if (args.length==1) {supplyHost(Path.of(args[0]));return;}
        ll link=(ll)WindowLayoutOracle.headless(ll.class);
        display=(Display)WindowLayoutOracle.headless(Display.class);
        for (String sample:List.of("unsupported","lost","listFailed","nullList","wrongList","none","nullFrame","wrongFrame","frameFailed","ok")) {
            scenario=sample;
            events.clear(); checks=0;
            String result;
            try { result=nf.a(2,0,0,768,1024,link)==display?"frame":"null"; }
            catch (ld e) { result=e.f.getClass().getSimpleName()+" "+e.e; }
            System.out.println(sample+"|"+String.join(" ",events)+"|"+result);
        }
    }
}
