import java.io.InputStream;
import java.lang.reflect.Field;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.*;
import jdk.internal.org.objectweb.asm.tree.*;
import sun.misc.Unsafe;

// Find a closed-world erasure: a finalizer increments one dead counter, and
// only the obfuscator's diagnostic reset ever touches that counter elsewhere.
class CounterFinalizersOracle implements Opcodes {
    static ClassNode read(InputStream input) throws Exception {
        try (input) {
            ClassNode c = new ClassNode();
            new ClassReader(input).accept(c, ClassReader.SKIP_FRAMES | ClassReader.SKIP_DEBUG);
            return c;
        }
    }
    static List<AbstractInsnNode> code(MethodNode m) {
        List<AbstractInsnNode> instructions = new ArrayList<>();
        for (AbstractInsnNode i : m.instructions) if (i.getOpcode() >= 0) instructions.add(i);
        return instructions;
    }
    static boolean sameField(FieldInsnNode a, FieldInsnNode b) {
        return a.owner.equals(b.owner) && a.name.equals(b.name) && a.desc.equals(b.desc);
    }
    static void check(boolean test, String message) {
        if (!test) throw new AssertionError(message);
    }
    public static void main(String[] args) throws Exception {
        List<ClassNode> classes = new ArrayList<>();
        try (JarFile jar = new JarFile(args[0])) {
            for (var entry : jar.stream().filter(e -> e.getName().endsWith(".class")).toList())
                classes.add(read(jar.getInputStream(entry)));
        }
        var objectFinalize = read(Object.class.getResourceAsStream("/java/lang/Object.class")).methods.stream()
            .filter(m -> m.name.equals("finalize") && m.desc.equals("()V")).findFirst().orElseThrow();
        check(code(objectFinalize).size()==1 && code(objectFinalize).get(0).getOpcode()==RETURN, "Object.finalize");
        Field singleton = Unsafe.class.getDeclaredField("theUnsafe");
        singleton.setAccessible(true);
        Unsafe unsafe = (Unsafe)singleton.get(null);
        for (ClassNode owner : classes) for (MethodNode m : owner.methods) {
            if (!m.name.equals("finalize") || !m.desc.equals("()V")) continue;
            var insns = code(m);
            if (!(insns.get(0) instanceof FieldInsnNode field) || field.getOpcode()!=GETSTATIC ||
                insns.get(1).getOpcode()!=ICONST_1 || insns.get(2).getOpcode()!=IADD ||
                !(insns.get(3) instanceof FieldInsnNode put) || put.getOpcode()!=PUTSTATIC ||
                !sameField(field,put) || !field.desc.equals("I") || !field.owner.equals(owner.name)) continue;
            int end = 4;
            boolean callsSuper = insns.get(end).getOpcode()==ALOAD &&
                ((VarInsnNode)insns.get(end)).var==0 && insns.get(end+1) instanceof MethodInsnNode call &&
                call.getOpcode()==INVOKESPECIAL && call.owner.equals("java/lang/Object") &&
                call.name.equals("finalize") && call.desc.equals("()V");
            if (callsSuper) end += 2;
            if (insns.get(end).getOpcode()!=RETURN) continue;
            check(m.access==(ACC_PROTECTED|ACC_FINAL), owner.name+" finalizer access");
            check(m.tryCatchBlocks.size()==1, owner.name+" handler count");
            TryCatchBlockNode handler = m.tryCatchBlocks.get(0);
            check(handler.type.equals("java/lang/RuntimeException") && handler.start.getNext()==insns.get(0) &&
                handler.end.getNext()==insns.get(end) && handler.handler.getNext()==insns.get(end+1),
                owner.name+" exception boundaries");
            int resets = 0;
            for (ClassNode other : classes) for (MethodNode method : other.methods) {
                AbstractInsnNode prev = null;
                for (AbstractInsnNode i : method.instructions) {
                    if (i.getOpcode()<0) continue;
                    if (i instanceof MethodInsnNode ref && ref.owner.equals(owner.name) && ref.name.equals(m.name)
                        && ref.desc.equals(m.desc)) throw new AssertionError("explicit caller of "+owner.name+".finalize");
                    if (i!=field && i!=put && i instanceof FieldInsnNode use && sameField(field,use)) {
                        check(other.name.equals("tj") && method.name.equals("a") && method.desc.equals("(I)V") &&
                            use.getOpcode()==PUTSTATIC && prev!=null && prev.getOpcode()==ICONST_0, "live use of "+field.owner+"."+field.name);
                        resets++;
                    }
                    prev = i;
                }
            }
            check(resets==1, owner.name+" reset count");
            Class<?> cls = Class.forName(owner.name);
            Object value = unsafe.allocateInstance(cls);
            Field counter = cls.getDeclaredField(field.name);
            counter.setAccessible(true);
            var finalize = cls.getDeclaredMethod("finalize");
            finalize.setAccessible(true);
            for (int initial : new int[]{0, Integer.MAX_VALUE, -1}) {
                counter.setInt(null, initial);
                finalize.invoke(value);
                check(counter.getInt(null)==initial+1, owner.name+" increment");
            }
            System.out.println(owner.name+" "+m.name+m.desc+" "+field.name+":"+field.desc+" "+callsSuper);
        }
    }
}
