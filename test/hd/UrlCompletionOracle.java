import java.nio.file.*;
import java.util.*;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;

// Isolate the straight-line URL-request polling block in each original loop, including its own branch instructions.
// Browser navigation is intercepted at the applet boundary. Hooks record the actual static field reads and writes.
public class UrlCompletionOracle {
    static final List<String> events=new ArrayList<>();
    static int cut, reads;
    static boolean hd;
    static java.lang.reflect.Field request, address, window;
    static void event(String op) throws Exception {
        events.add(op);
        if (op.equals("get-request") && ++reads==cut) request.set(null,null);
    }
    public static void open() { events.add("open"); }
    static void extract(ClassWriter w, String owner, int role) throws Exception {
        ClassNode cls=new ClassNode(); new ClassReader(owner).accept(cls,ClassReader.SKIP_DEBUG|ClassReader.SKIP_FRAMES);
        String req=hd?"cj.n":"b.L", url=hd?"nm.W":"client.sb", target=hd?"na.W":"pa.tb";
        Map<String,String> names=Map.of(req,"request",url,"address",target,"window");
        for (MethodNode method : cls.methods) {
            AbstractInsnNode first=null, last=null; int stores=0;
            for (AbstractInsnNode i : method.instructions) {
                if (i instanceof FieldInsnNode f) {
                    String field=f.owner+"."+f.name;
                    if (first==null && f.getOpcode()==Opcodes.GETSTATIC && field.equals(req)) first=i;
                    if (first!=null && f.getOpcode()==Opcodes.PUTSTATIC && names.containsKey(field) && ++stores==3) { last=i; break; }
                }
            }
            if (last==null) continue;
            for (AbstractInsnNode previous=first.getPrevious();previous!=null;previous=previous.getPrevious()) {
                if (previous.getOpcode()<0) continue;
                if (previous.getOpcode()==Opcodes.ACONST_NULL) first=previous;
                break;
            }
            MethodVisitor body=w.visitMethod(Opcodes.ACC_PUBLIC|Opcodes.ACC_STATIC,"poll"+role,"()V",null,null);
            body.visitCode(); Set<Label> emitted=new HashSet<>(), jumps=new HashSet<>();
            for (AbstractInsnNode i=first;;i=i.getNext()) {
                if (i instanceof FieldInsnNode f && names.containsKey(f.owner+"."+f.name)) {
                    String op=f.getOpcode()==Opcodes.GETSTATIC?"get-":"set-";
                    body.visitLdcInsn(op+names.get(f.owner+"."+f.name));
                    body.visitMethodInsn(Opcodes.INVOKESTATIC,"UrlCompletionOracle","event","(Ljava/lang/String;)V",false);
                    i.accept(body);
                } else if (i instanceof MethodInsnNode m) {
                    if (!m.owner.equals(hd?"nf":"nl") || !m.name.equals("a")) throw new AssertionError(m.owner+"."+m.name);
                    for (int n=0;n<3;n++) body.visitInsn(Opcodes.POP);
                    body.visitMethodInsn(Opcodes.INVOKESTATIC,"UrlCompletionOracle","open","()V",false);
                } else {
                    if (i instanceof LabelNode l) emitted.add(l.getLabel());
                    if (i instanceof JumpInsnNode j) jumps.add(j.label.getLabel());
                    i.accept(body);
                }
                if (i==last) break;
            }
            for (Label l:jumps) if (!emitted.contains(l)) body.visitLabel(l);
            body.visitInsn(Opcodes.RETURN); body.visitMaxs(0,0); body.visitEnd(); return;
        }
        throw new AssertionError("Missing URL completion in "+owner);
    }
    static java.lang.reflect.Field field(String owner,String name) throws Exception {
        var value=Class.forName(owner).getDeclaredField(name); value.setAccessible(true); return value;
    }
    public static void main(String[] args) throws Exception {
        hd=args[0].equals("gl");
        if (args.length>1) {
            ClassWriter w=new ClassWriter(ClassWriter.COMPUTE_FRAMES);
            w.visit(Opcodes.V1_8,Opcodes.ACC_PUBLIC,"NativeUrlCompletion",null,"java/lang/Object",null);
            extract(w,"client",1); extract(w,hd?"gg":"t",0); w.visitEnd();
            Files.write(Path.of(args[1],"NativeUrlCompletion.class"),w.toByteArray()); return;
        }
        request=field(hd?"cj":"b",hd?"n":"L"); address=field(hd?"nm":"client",hd?"W":"sb"); window=field(hd?"na":"pa",hd?"W":"tb");
        var ctor=request.getType().getDeclaredConstructor(); ctor.setAccessible(true);
        var status=field(hd?"im":"dj",hd?"d":"b"); var result=field(hd?"im":"dj",hd?"e":"a");
        for (int title=0;title<2;title++) for (int state=-1;state<3;state++) for (cut=0;cut<=3;cut++) {
            Object handle=ctor.newInstance(); status.setInt(handle,state==0?0:1); result.set(handle,state==2?new Object():null);
            request.set(null,state<0?null:handle); address.set(null,null); window.setBoolean(null,true);
            events.clear(); reads=0; String outcome="ok";
            try { Class.forName("NativeUrlCompletion").getMethod("poll"+title).invoke(null); }
            catch (java.lang.reflect.InvocationTargetException fault) {
                if (!(fault.getCause() instanceof NullPointerException)) throw fault; outcome="null";
            }
            System.out.println(title+" "+state+" "+cut+"|"+String.join(";",events)+"|"+outcome);
        }
    }
}
