import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.*;
import java.util.jar.JarFile;
import jdk.internal.org.objectweb.asm.ClassReader;
import jdk.internal.org.objectweb.asm.Opcodes;
import jdk.internal.org.objectweb.asm.tree.*;

// Classfile inventory. Reads both archives without loading or initializing their classes.
public class HdJoglInventory {
    static final String HD_SHA = "38df9ba79fdaad00380006c2b98a272d0cc1c55399d201a268a500fbe5df4398";
    static final String JOGL_SHA = "af1cf9a3bfc9b4ff7c3262653fda868e068b694cd3fd38849bbf04ad3c3dc79b";
    static final String GL = "javax/media/opengl/GL";

    static Map<String, ClassNode> classes(Path path, String expectedSha, int flags) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path));
        String actualSha = HexFormat.of().formatHex(digest);
        if (!actualSha.equals(expectedSha)) throw new IllegalArgumentException(path + " has SHA-256 " + actualSha + ", expected " + expectedSha);
        var classes = new TreeMap<String, ClassNode>();
        try (var archive = new JarFile(path.toFile())) {
            for (var entry : Collections.list(archive.entries())) {
                if (!entry.getName().endsWith(".class")) continue;
                var node = new ClassNode();
                try (var stream = archive.getInputStream(entry)) { new ClassReader(stream).accept(node, flags); }
                if (classes.put(node.name, node) != null) throw new IllegalStateException("Duplicate class " + node.name);
            }
        }
        return classes;
    }

    // Find the declaration even when the instruction names a subclass or subinterface.
    static String declaration(Map<String, ClassNode> types, String owner, String name, String desc) {
        ClassNode type = types.get(owner);
        if (type == null) return null;
        for (var method : type.methods) if (method.name.equals(name) && method.desc.equals(desc)) return owner;
        if (name.equals("<init>")) return null;
        String parent = declaration(types, type.superName, name, desc);
        if (parent != null) return parent;
        for (String iface : type.interfaces) {
            parent = declaration(types, iface, name, desc);
            if (parent != null) return parent;
        }
        return null;
    }

    static String opcode(int opcode) {
        return switch (opcode) {
            case Opcodes.INVOKEVIRTUAL -> "invokevirtual";
            case Opcodes.INVOKESPECIAL -> "invokespecial";
            case Opcodes.INVOKESTATIC -> "invokestatic";
            case Opcodes.INVOKEINTERFACE -> "invokeinterface";
            default -> throw new IllegalArgumentException("Unexpected invocation " + opcode);
        };
    }

    static String row(String... fields) { return String.join("\t", fields); }

    // These headings describe API calls. They do not assign deobfuscated names to HD gamepack classes.
    static String family(String owner, String name) {
        if (owner.equals("javax/media/opengl/glu/GLU")) return "GLU";
        if (!owner.equals(GL)) return "drawable and context";
        if (name.contains("Program")) return "ARB vertex program";
        if (name.contains("Lists") || name.endsWith("List")) return "display lists";
        if (name.contains("BufferARB") || name.contains("BuffersARB") || name.contains("BufferDataARB") ||
                name.contains("BufferSubDataARB") || name.contains("Pointer") || name.contains("ClientState") ||
                name.equals("glInterleavedArrays") || name.equals("glDrawElements")) return "geometry buffers and vertex arrays";
        if (name.startsWith("glTex") || name.endsWith("Texture") || name.endsWith("Textures") ||
                name.equals("glMultiTexCoord2f")) return "textures and coordinates";
        if (name.startsWith("glLight") || name.startsWith("glFog") || name.equals("glColorMaterial") ||
                name.equals("glShadeModel")) return "lighting and fog";
        if (name.contains("Matrix") || name.equals("glViewport") || name.equals("glLoadIdentity") ||
                name.equals("glOrtho") || name.equals("glRotatef") || name.equals("glScalef") ||
                name.equals("glTranslatef")) return "matrices and viewport";
        if (name.startsWith("glGet") || name.equals("isExtensionAvailable")) return "queries";
        if (name.equals("glBegin") || name.equals("glEnd") || name.startsWith("glVertex") ||
                name.startsWith("glColor")) return "immediate geometry and colour";
        return "raster and other GL state";
    }

    static void ancestry(Map<String, ClassNode> types, Set<String> owners, String name) {
        ClassNode node = types.get(name);
        if (node == null || !owners.add(name)) return;
        ancestry(types, owners, node.superName);
        for (String iface : node.interfaces) ancestry(types, owners, iface);
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 2) throw new IllegalArgumentException("Expected paths to runescape_gl.jar and jogl.jar");
        int flags = ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES;
        var hd = classes(Path.of(args[0]), HD_SHA, flags);
        var jogl = classes(Path.of(args[1]), JOGL_SHA, flags | ClassReader.SKIP_CODE);
        var types = new HashMap<>(jogl);
        for (var entry : hd.entrySet()) if (types.put(entry.getKey(), entry.getValue()) != null) throw new IllegalStateException("Overlapping class " + entry.getKey());
        var targets = new TreeMap<String, Integer>();
        var opcounts = new TreeMap<String, Integer>();
        var groups = new TreeMap<String, Integer>();
        var owners = new TreeSet<String>();
        var data = new ArrayList<String>();
        int classCount = 0, methodCount = 0, siteCount = 0, commandCount = 0, programCount = 0;
        for (var type : hd.values()) {
            var methods = new ArrayList<String>();
            type.methods.sort(Comparator.comparing((MethodNode m) -> m.name).thenComparing(m -> m.desc));
            for (var method : type.methods) {
                int pc = -1, sites = 0;
                String member = type.name + "." + method.name + method.desc;
                var instructions = new ArrayList<String>();
                for (var insn : method.instructions) {
                    if (insn.getOpcode() < 0) continue;
                    pc++; // Zero-based instruction ordinal. Labels, frames and line numbers are excluded.
                    if (insn instanceof LdcInsnNode ldc && ldc.cst instanceof String s &&
                            (s.contains("!!ARBvp") || s.contains("!!ARBfp"))) {
                        instructions.add(row("assembly", member, String.valueOf(pc),
                            Base64.getEncoder().encodeToString(s.getBytes(StandardCharsets.UTF_8))));
                        programCount++;
                    }
                    if (!(insn instanceof MethodInsnNode call)) continue;
                    String declaring = declaration(types, call.owner, call.name, call.desc);
                    if (declaring == null || !jogl.containsKey(declaring)) continue;
                    String op = opcode(call.getOpcode());
                    instructions.add(row("call", member, String.valueOf(pc), op, call.owner, call.name, call.desc, declaring));
                    opcounts.merge(op, 1, Integer::sum);
                    groups.merge(family(declaring, call.name), 1, Integer::sum);
                    targets.merge(row(call.owner, call.name, call.desc, declaring), 1, Integer::sum);
                    ancestry(types, owners, declaring);
                    if (declaring.equals(GL) && call.name.startsWith("gl")) commandCount++;
                    sites++;
                }
                if (sites != 0) {
                    methods.add(row("method", type.name, method.name, method.desc, String.valueOf(sites)));
                    methodCount++;
                    siteCount += sites;
                }
                methods.addAll(instructions);
            }
            if (!methods.isEmpty()) {
                if (methods.stream().anyMatch(s -> s.startsWith("method\t"))) classCount++;
                ancestry(types, owners, type.name);
                data.add(row("class", type.name, type.superName, String.join(",", type.interfaces)));
                data.addAll(methods);
            }
        }
        System.out.println(row("jar", "runescape_gl.jar", HD_SHA, String.valueOf(hd.size())));
        System.out.println(row("jar", "jogl.jar", JOGL_SHA, String.valueOf(jogl.size())));
        System.out.println(row("summary", String.valueOf(classCount), String.valueOf(methodCount),
            String.valueOf(siteCount), String.valueOf(targets.size()), String.valueOf(commandCount), String.valueOf(programCount)));
        opcounts.forEach((key,count) -> System.out.println(row("opcode", key, count.toString())));
        groups.forEach((key,count) -> System.out.println(row("family", key, count.toString())));
        for (String name : owners) {
            ClassNode type = types.get(name);
            System.out.println(row("inheritance", hd.containsKey(name) ? "HD" : "JOGL", name,
                (type.access & Opcodes.ACC_INTERFACE) == 0 ? "class" : "interface", type.superName, String.join(",", type.interfaces)));
        }
        targets.forEach((key,count) -> System.out.println(row("target", key, count.toString())));
        data.forEach(System.out::println);
    }
}
