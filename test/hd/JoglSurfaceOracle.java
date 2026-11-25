import java.nio.file.Path;
import java.util.*;
import java.util.jar.JarFile;
import javax.media.opengl.GLCapabilities;
import jdk.internal.org.objectweb.asm.ClassReader;
import jdk.internal.org.objectweb.asm.Opcodes;
import jdk.internal.org.objectweb.asm.Type;
import jdk.internal.org.objectweb.asm.tree.*;
import jdk.internal.org.objectweb.asm.tree.analysis.*;
import jdk.internal.org.objectweb.asm.util.Printer;

// Oracle for test/hd/jogl-surface.test.ts. Run with jogl.jar on the class path:
//   java --add-exports java.base/jdk.internal.org.objectweb.asm{,.tree,.tree.analysis,.util}=ALL-UNNAMED
//        -cp jogl.jar JoglSurfaceOracle.java runescape_gl.jar jogl.jar
// Output rows (tab separated):
//   site    <jar> <class.method+desc> <owner> <name> <desc> <arg>...   every javax.media.opengl call site
//   literal <value> <class.method+desc> <next opcode>                    int literals and switch keys in
//                                                                       jogl.jar's GLU and mipmap classes
//   caps    <label> <toString()> <getters>                               the shipped GLCapabilities
// A site argument is the set of compile-time constants that can reach it (constant propagation over the
// method's frames, merged across branches), "?" when any path supplies a non-constant, or "null".
public class JoglSurfaceOracle {
    static final Object NULL = new Object() { public String toString() { return "null"; } };
    static final Comparator<Object> ORDER = Comparator.comparing(Object::toString);

    static final class ConstantValue implements Value {
        final BasicValue basic;
        final Set<Object> constants; // null: some path supplies a non-constant

        ConstantValue(BasicValue basic, Set<Object> constants) { this.basic = basic; this.constants = constants; }
        public int getSize() { return basic.getSize(); }
        public boolean equals(Object o) { return o instanceof ConstantValue c && basic.equals(c.basic) && Objects.equals(constants, c.constants); }
        public int hashCode() { return Objects.hash(basic, constants); }
        Object single() { return constants != null && constants.size() == 1 ? constants.iterator().next() : null; }
    }

    // BasicInterpreter for value kinds and sizes, plus constant sets for int, long, float, double, String and null.
    static final class ConstantInterpreter extends Interpreter<ConstantValue> {
        final BasicInterpreter basic = new BasicInterpreter();

        ConstantInterpreter() { super(Opcodes.ASM9); }

        static ConstantValue of(BasicValue value, Object constant) {
            if (value == null) return null;
            if (constant == null) return new ConstantValue(value, null);
            Set<Object> set = new TreeSet<>(ORDER);
            set.add(constant);
            return new ConstantValue(value, set);
        }

        public ConstantValue newValue(Type type) { return of(basic.newValue(type), null); }

        public ConstantValue newOperation(AbstractInsnNode insn) throws AnalyzerException {
            int op = insn.getOpcode();
            Object constant = null;
            if (op == Opcodes.ACONST_NULL) constant = NULL;
            else if (op >= Opcodes.ICONST_M1 && op <= Opcodes.ICONST_5) constant = op - Opcodes.ICONST_0;
            else if (op == Opcodes.LCONST_0 || op == Opcodes.LCONST_1) constant = (long) (op - Opcodes.LCONST_0);
            else if (op >= Opcodes.FCONST_0 && op <= Opcodes.FCONST_2) constant = (float) (op - Opcodes.FCONST_0);
            else if (op == Opcodes.DCONST_0 || op == Opcodes.DCONST_1) constant = (double) (op - Opcodes.DCONST_0);
            else if (op == Opcodes.BIPUSH || op == Opcodes.SIPUSH) constant = ((IntInsnNode) insn).operand;
            else if (op == Opcodes.LDC) {
                Object cst = ((LdcInsnNode) insn).cst;
                if (cst instanceof Integer || cst instanceof Long || cst instanceof Float || cst instanceof Double || cst instanceof String) constant = cst;
            }
            return of(basic.newOperation(insn), constant);
        }

        public ConstantValue copyOperation(AbstractInsnNode insn, ConstantValue value) throws AnalyzerException {
            return new ConstantValue(basic.copyOperation(insn, value.basic), value.constants);
        }

        public ConstantValue unaryOperation(AbstractInsnNode insn, ConstantValue value) throws AnalyzerException {
            BasicValue result = basic.unaryOperation(insn, value.basic);
            if (result == null) return null;
            if (insn.getOpcode() == Opcodes.CHECKCAST) return new ConstantValue(result, value.constants);
            Object constant = null;
            if (value.single() instanceof Integer i) {
                switch (insn.getOpcode()) {
                    case Opcodes.INEG -> constant = -i;
                    case Opcodes.I2L -> constant = (long) i;
                    case Opcodes.I2F -> constant = (float) i;
                    case Opcodes.I2B -> constant = (int) (byte) (int) i;
                    case Opcodes.I2S -> constant = (int) (short) (int) i;
                    case Opcodes.I2C -> constant = (int) (char) (int) i;
                    default -> {}
                }
            }
            return of(result, constant);
        }

        public ConstantValue binaryOperation(AbstractInsnNode insn, ConstantValue a, ConstantValue b) throws AnalyzerException {
            BasicValue result = basic.binaryOperation(insn, a.basic, b.basic);
            if (result == null) return null;
            Object constant = null;
            if (a.single() instanceof Integer i && b.single() instanceof Integer j) {
                switch (insn.getOpcode()) {
                    case Opcodes.IADD -> constant = i + j;
                    case Opcodes.ISUB -> constant = i - j;
                    case Opcodes.IMUL -> constant = i * j;
                    case Opcodes.IOR -> constant = i | j;
                    case Opcodes.IAND -> constant = i & j;
                    case Opcodes.IXOR -> constant = i ^ j;
                    case Opcodes.ISHL -> constant = i << j;
                    case Opcodes.ISHR -> constant = i >> j;
                    case Opcodes.IUSHR -> constant = i >>> j;
                    default -> {}
                }
            }
            return of(result, constant);
        }

        public ConstantValue ternaryOperation(AbstractInsnNode insn, ConstantValue a, ConstantValue b, ConstantValue c) throws AnalyzerException {
            return of(basic.ternaryOperation(insn, a.basic, b.basic, c.basic), null);
        }

        public ConstantValue naryOperation(AbstractInsnNode insn, List<? extends ConstantValue> values) throws AnalyzerException {
            List<BasicValue> basics = new ArrayList<>();
            for (ConstantValue value : values) basics.add(value.basic);
            return of(basic.naryOperation(insn, basics), null);
        }

        public void returnOperation(AbstractInsnNode insn, ConstantValue value, ConstantValue expected) {}

        public ConstantValue merge(ConstantValue a, ConstantValue b) {
            BasicValue merged = basic.merge(a.basic, b.basic);
            Set<Object> constants = null;
            if (a.constants != null && b.constants != null && merged.equals(a.basic)) {
                constants = new TreeSet<>(ORDER);
                constants.addAll(a.constants);
                constants.addAll(b.constants);
                if (constants.size() > 32) constants = null;
            }
            ConstantValue result = new ConstantValue(merged, constants);
            return result.equals(a) ? a : result;
        }
    }

    static String format(ConstantValue value) {
        if (value.constants == null) return "?";
        StringJoiner joined = new StringJoiner(",");
        for (Object constant : value.constants) {
            if (constant instanceof Long l) joined.add(l + "L");
            else if (constant instanceof Float f) joined.add(Integer.toHexString(Float.floatToRawIntBits(f)) + "f");
            else if (constant instanceof Double d) joined.add(Long.toHexString(Double.doubleToRawLongBits(d)) + "d");
            else if (constant instanceof String s) joined.add("S" + s.length());
            else joined.add(String.valueOf(constant));
        }
        return joined.toString();
    }

    static List<ClassNode> classes(String jar, String... prefixes) throws Exception {
        List<ClassNode> nodes = new ArrayList<>();
        try (var archive = new JarFile(Path.of(jar).toFile())) {
            List<String> names = new ArrayList<>();
            for (var entry : Collections.list(archive.entries())) {
                String name = entry.getName();
                if (!name.endsWith(".class")) continue;
                boolean wanted = prefixes.length == 0;
                for (String prefix : prefixes) wanted |= name.startsWith(prefix);
                if (wanted) names.add(name);
            }
            Collections.sort(names);
            for (String name : names) {
                var node = new ClassNode();
                try (var stream = archive.getInputStream(archive.getEntry(name))) { new ClassReader(stream).accept(node, 0); }
                nodes.add(node);
            }
        }
        return nodes;
    }

    static void sites(StringBuilder out, String tag, List<ClassNode> nodes) throws AnalyzerException {
        for (ClassNode node : nodes) {
            for (MethodNode method : node.methods) {
                boolean calls = false;
                for (var insn : method.instructions) calls |= insn instanceof MethodInsnNode m && m.owner.startsWith("javax/media/opengl/");
                if (!calls) continue;
                Frame<ConstantValue>[] frames = new Analyzer<>(new ConstantInterpreter()).analyze(node.name, method);
                int index = 0;
                for (var insn : method.instructions) {
                    if (insn instanceof MethodInsnNode m && m.owner.startsWith("javax/media/opengl/")) {
                        out.append("site\t").append(tag).append('\t').append(node.name).append('.').append(method.name).append(method.desc)
                            .append('\t').append(m.owner).append('\t').append(m.name).append('\t').append(m.desc);
                        Frame<ConstantValue> frame = frames[index];
                        Type[] arguments = Type.getArgumentTypes(m.desc);
                        if (frame == null) out.append("\tDEAD");
                        else for (int a = 0; a < arguments.length; a++) out.append('\t').append(format(frame.getStack(frame.getStackSize() - arguments.length + a)));
                        out.append('\n');
                    }
                    index++;
                }
            }
        }
    }

    static String next(AbstractInsnNode insn) {
        AbstractInsnNode n = insn.getNext();
        while (n != null && n.getOpcode() < 0) n = n.getNext();
        return n == null ? "-" : Printer.OPCODES[n.getOpcode()];
    }

    static void literals(StringBuilder out, List<ClassNode> nodes) {
        for (ClassNode node : nodes) {
            for (MethodNode method : node.methods) {
                String where = node.name + "." + method.name + method.desc;
                for (var insn : method.instructions) {
                    int op = insn.getOpcode();
                    Integer value = null;
                    if (op == Opcodes.BIPUSH || op == Opcodes.SIPUSH) value = ((IntInsnNode) insn).operand;
                    else if (op == Opcodes.LDC && ((LdcInsnNode) insn).cst instanceof Integer i) value = i;
                    if (value != null) out.append("literal\t").append(value).append('\t').append(where).append('\t').append(next(insn)).append('\n');
                    if (insn instanceof LookupSwitchInsnNode s) for (int key : s.keys) out.append("literal\t").append(key).append('\t').append(where).append("\tLOOKUPSWITCH\n");
                    if (insn instanceof TableSwitchInsnNode s) for (int key = s.min; key <= s.max; key++) out.append("literal\t").append(key).append('\t').append(where).append("\tTABLESWITCH\n");
                }
            }
        }
    }

    static void caps(StringBuilder out, String label, GLCapabilities c) {
        out.append("caps\t").append(label).append('\t').append(c.toString()).append('\t')
            .append(c.getDoubleBuffered()).append(',').append(c.getStereo()).append(',').append(c.getHardwareAccelerated()).append(',')
            .append(c.getDepthBits()).append(',').append(c.getStencilBits()).append(',').append(c.getRedBits()).append(',')
            .append(c.getGreenBits()).append(',').append(c.getBlueBits()).append(',').append(c.getAlphaBits()).append(',')
            .append(c.getAccumRedBits()).append(',').append(c.getAccumGreenBits()).append(',').append(c.getAccumBlueBits()).append(',')
            .append(c.getAccumAlphaBits()).append(',').append(c.getSampleBuffers()).append(',').append(c.getNumSamples()).append('\n');
    }

    // Mirrored step for step by the TS side of the test.
    static void caps(StringBuilder out) {
        GLCapabilities c = new GLCapabilities();
        caps(out, "default", c);
        for (int samples : new int[] {2, 4}) {
            GLCapabilities aa = new GLCapabilities(); // tf.a(Ljava/awt/Canvas;I)I with n > 0
            aa.setSampleBuffers(true);
            aa.setNumSamples(samples);
            caps(out, "aa" + samples, aa);
        }
        c.setSampleBuffers(true);
        c.setNumSamples(4);
        GLCapabilities copy = (GLCapabilities) c.clone();
        copy.setNumSamples(8);
        copy.setDepthBits(32);
        caps(out, "clone-source", c);
        caps(out, "clone", copy);
        c.setDoubleBuffered(false);
        c.setStereo(true);
        c.setHardwareAccelerated(false);
        c.setDepthBits(16);
        c.setStencilBits(8);
        c.setRedBits(5);
        c.setGreenBits(6);
        c.setBlueBits(-5);
        c.setAlphaBits(1);
        c.setAccumRedBits(16);
        c.setAccumGreenBits(2147483647);
        c.setAccumBlueBits(0);
        c.setAccumAlphaBits(-2147483648);
        c.setNumSamples(-1);
        c.setPbufferFloatingPointBuffers(true);
        caps(out, "all", c);
        c.setSampleBuffers(false);
        caps(out, "no-samples", c);
    }

    public static void main(String[] args) throws Exception {
        StringBuilder out = new StringBuilder();
        sites(out, "gamepack", classes(args[0]));
        sites(out, "jogl", classes(args[1]));
        literals(out, classes(args[1], "com/sun/opengl/impl/mipmap/", "javax/media/opengl/glu/"));
        caps(out);
        System.out.print(out);
    }
}
