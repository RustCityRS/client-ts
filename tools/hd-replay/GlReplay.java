import java.awt.Canvas;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.image.BufferedImage;
import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import javax.media.opengl.*;

/** Replays a GLTrace v1 against the original 530 WGL/JOGL implementation. */
public final class GlReplay implements AutoCloseable {
    final ReplayTrace trace;
    final Path output;
    final int width, height;
    final Map<String, Object> refs = new HashMap<>();
    final Map<Object, String> idsByIdentity = new IdentityHashMap<>();
    final Map<Character, Integer> referenceSerials = new HashMap<>();
    final Map<String, Integer> names = new HashMap<>();
    final Map<String, Map<Integer, NativeInput.Store>> nameSpaces = new HashMap<>();

    record RawName(char kind, int value) {}
    final Map<Map<Integer, NativeInput.Store>, Map<RawName, String>> latest = new IdentityHashMap<>();
    final Map<String, Integer> listRangeRemaining = new HashMap<>();
    final Map<Character, Integer> allocated = new HashMap<>();
    final List<Frame> windows = new ArrayList<>();
    final Set<GLDrawable> realized = Collections.newSetFromMap(new IdentityHashMap<>());
    final Set<GLContext> contexts = Collections.newSetFromMap(new IdentityHashMap<>());
    final Map<GL, GLContext> owners = new IdentityHashMap<>();
    final Map<GLContext, GLDrawable> surfaces = new IdentityHashMap<>();
    final Map<GLContext, NativeInput> memory = new IdentityHashMap<>();
    final Set<String> observedDifferences = new LinkedHashSet<>();
    final BufferedWriter frames;
    GL selected;
    String label = "";
    int frame, seq, del, records;

    GlReplay(ReplayTrace trace, Path output, int width, int height) throws IOException {
        this.trace = trace;
        this.output = output;
        this.width = width;
        this.height = height;
        Files.createDirectories(output);
        frames = Files.newBufferedWriter(
                output.resolve("frames.tsv"), StandardCharsets.UTF_8, StandardOpenOption.CREATE_NEW);
        frames.write("frame\tmark\tfile\n");
    }

    static IllegalArgumentException bad(String reason) {
        return ReplayTrace.bad(reason);
    }

    static int integer(String token) {
        return ReplayTrace.integer(token);
    }

    static int positive(String token) {
        int n = ReplayTrace.natural(token);
        if (n == 0)
            throw bad("expected positive id");
        return n;
    }

    static void tag(String token, char kind) {
        if (!token.startsWith("@" + kind))
            throw bad("expected a " + kind + " reference, got " + token);
        positive(token.substring(2));
    }

    Object reference(String id, String role) {
        if (id.equals("null"))
            return null;
        tag(id, role.charAt(4));
        Object value = refs.get(id);
        if (value == null)
            throw bad("unknown " + id);
        return value;
    }

    void recordReference(String token, String role, Object object) {
        if (object == null) {
            if (!token.equals("null"))
                throw bad("driver returned null for " + token);
            return;
        }
        tag(token, role.charAt(4));
        Object previous = refs.get(token);
        if (previous == null) {
            char kind = role.charAt(4);
            if (!token.equals("@" + kind + referenceSerials.merge(kind, 1, Math::addExact)))
                throw bad("unexpected new reference " + token);
            if (idsByIdentity.putIfAbsent(object, token) != null)
                throw bad("object already assigned to another reference");
            refs.put(token, object);
        } else if (previous != object)
            throw bad("changed object reference " + token);
    }

    Canvas target(String token) {
        tag(token, 'O');
        if (!refs.containsKey(token)) {
            Frame window = new Frame();
            window.setFocusableWindowState(false);
            window.setAutoRequestFocus(false);
            Canvas canvas = new Canvas();
            canvas.setFocusable(false);
            canvas.setPreferredSize(new Dimension(width, height));
            window.add(canvas);
            window.pack();
            windows.add(window);
            recordReference(token, "ref:O", canvas);
        }
        return (Canvas) refs.get(token);
    }

    int resolveName(char kind, String token) {
        if (token.equals("0"))
            return 0;
        if (!token.startsWith("#" + kind))
            throw bad("unexpected name " + token);
        if (token.charAt(2) == '?')
            throw bad("unallocated raw GL name cannot be safely mapped: " + token);
        positive(token.substring(2));
        Integer raw = names.get(token);
        if (raw == null)
            throw bad("name used before allocation: " + token);
        if (nameSpaces.get(token) != memory.get(GLContext.getCurrent()).storage())
            throw bad("name used outside its sharing context: " + token);
        if (!token.equals(latest.get(nameSpaces.get(token)).get(new RawName(kind, raw))))
            throw bad("the native driver reused the raw name of a separately referenced allocation: " + token);
        return raw;
    }

    void allocate(char kind, String token, int raw) {
        if (raw == 0) {
            if (!token.equals("0"))
                throw bad("hardware failed to allocate " + token);
            return;
        }
        int serial = allocated.merge(kind, 1, Math::addExact);
        if (!token.equals("#" + kind + serial))
            throw bad("unexpected allocation " + token + " (expected #" + kind + serial + ")");
        names.put(token, raw);
        nameSpaces.put(token, memory.get(GLContext.getCurrent()).storage());
        latest.computeIfAbsent(nameSpaces.get(token), k -> new HashMap<>()).put(new RawName(kind, raw), token);
    }

    static String[] elements(String token) {
        String body = token.substring(3);
        return body.isEmpty() ? new String[0] : body.split(",", -1);
    }

    Object array(String role, String token, int offset, int count) {
        if (token.equals("null"))
            throw bad("unsupported null native array");
        if (offset < 0 || offset > 4194304 || count > 4194304)
            throw bad("invalid native array dimensions");
        String[] list = elements(token);
        if (list.length != count || (count > 0 && list[count - 1].startsWith("!")))
            throw bad("incomplete native array " + token);
        int length = Math.addExact(offset, count);
        if (token.startsWith("fv:")) {
            float[] a = new float[length];
            for (int i = 0; i < count; i++)
                a[offset + i] = ReplayTrace.floatBits(list[i]);
            return a;
        }
        int[] a = new int[length];
        for (int i = 0; i < count; i++) {
            if (role.startsWith("in-names:"))
                a[offset + i] = resolveName(role.charAt(9), list[i]);
            else if (!role.startsWith("out-names:"))
                a[offset + i] = integer(list[i]);
        }
        return a;
    }

    Object argument(ReplayTrace.Rule rule, String[] tokens, int index) throws Exception {
        String role = rule.roles().get(index), token = tokens[index];
        if (role.equals("caps"))
            return ReplayTrace.caps(token);
        if (role.startsWith("ref:")) {
            if (rule.name().equals("GLDrawableFactory.getGLDrawable") && index == 0)
                return target(token);
            if (rule.name().equals("GLDrawableFactory.getGLDrawable") && index == 2 && !token.equals("null"))
                throw bad("custom capabilities chooser has no trace body");
            return reference(token, role);
        }
        if (role.startsWith("name:"))
            return resolveName(role.charAt(5), token);
        int count = trace.count(role, tokens);
        if (role.equals("buf") || role.startsWith("buf[") || role.startsWith("out-buf[")) {
            Buffer b = trace.buffer(token, count);
            if (count != Integer.MAX_VALUE && (b == null || !(b instanceof FloatBuffer) || b.remaining() < count))
                throw bad("undersized native float buffer");
            return b;
        }
        if (role.startsWith("in-") || role.startsWith("out-"))
            return array(role, token, integer(tokens[index + 1]), count);
        return switch (role) {
            case "int" -> integer(token);
            case "byte" -> {
                int n = integer(token);
                if (n != (byte) n)
                    throw bad("byte out of range");
                yield(byte) n;
            }
            case "float" -> {
                if (!token.startsWith("f:"))
                    throw bad("invalid float");
                yield ReplayTrace.floatBits(token.substring(2));
            }
            case "double" -> {
                if (!token.startsWith("d:"))
                    throw bad("invalid double");
                yield Double.longBitsToDouble(ReplayTrace.bits(token.substring(2), 16));
            }
            case "bool" -> ReplayTrace.bool(token);
            case "long" -> {
                if (!token.startsWith("o:"))
                    throw bad("invalid offset");
                long n = Long.parseLong(token.substring(2));
                if (n < 0 || !token.equals("o:" + n))
                    throw bad("invalid native offset");
                yield n;
            }
            case "string" -> trace.string(token);
            default -> throw bad("unsupported role " + role);
        };
    }

    void outputs(ReplayTrace.Rule rule, String[] inputs, Object[] args) throws Exception {
        for (int i = 0; i < args.length; i++) {
            String role = rule.roles().get(i);
            if (!role.startsWith("out-"))
                continue;
            if (role.startsWith("out-buf")) {
                int n = trace.count(role, inputs);
                FloatBuffer observed = (FloatBuffer) args[i], expected = (FloatBuffer) trace.buffer(inputs[i], n);
                for (int j = 0; j < n; j++)
                    if (Float.floatToRawIntBits(observed.get(observed.position() + j))
                            != Float.floatToRawIntBits(expected.get(expected.position() + j)))
                        observation(rule, inputs, i);
                continue;
            }
            int offset = (int) args[i + 1];
            String[] expected = elements(inputs[i]);
            for (int j = 0; j < expected.length; j++) {
                if (role.startsWith("out-names:"))
                    allocate(role.charAt(10), expected[j], ((int[]) args[i])[offset + j]);
                else if (role.startsWith("out-i") && integer(expected[j]) != ((int[]) args[i])[offset + j])
                    observation(rule, inputs, i);
                else if (role.startsWith("out-f")
                        && ReplayTrace.bits(expected[j], 8)
                                != Integer.toUnsignedLong(
                                        Float.floatToRawIntBits(((float[]) args[i])[offset + j])))
                    observation(rule, inputs, i);
            }
        }
    }

    void observation(ReplayTrace.Rule rule, String[] inputs, int index) {
        observedDifferences.add(
                rule.name() + " " + inputs[0] + ": native output differs from recorded " + inputs[index]);
    }

    void returns(ReplayTrace.Rule rule, String token, Object returned, Object[] args) throws Exception {
        String role = rule.result();
        if (role.startsWith("ref:")) {
            recordReference(token, role, returned);
            return;
        }
        if (role.startsWith("alloc-lists")) {
            int n = (int) args[0], base = (int) returned;
            if (n > 0 && base != 0) {
                if (n > 4194304)
                    throw bad("display list allocation too large");
                allocate('L', token, base);
                listRangeRemaining.put(token, n);
                for (int j = 1; j < n; j++) {
                    String next = "#L" + (allocated.get('L') + 1);
                    allocate('L', next, base + j);
                    listRangeRemaining.put(next, n - j);
                }
            } else if (resolveName('L', token) != base)
                throw bad("display list allocation differed");
            return;
        }
        Object expected = switch (role) {
            case "string" -> trace.string(token);
            case "bool" -> ReplayTrace.bool(token);
            case "int" -> integer(token);
            default -> throw bad(role);
        };
        if (!Objects.equals(expected, returned)) {
            if (rule.name().equals("GLContext.makeCurrent"))
                throw bad("context result " + returned + " differs from " + expected);
            observedDifferences.add(
                    rule.name() + " " + Arrays.toString(args) + ": recorded " + expected + ", native " + returned);
        }
    }

    void capture(GLDrawable drawable) throws Exception {
        GLContext current = GLContext.getCurrent();
        if (current == null || surfaces.get(current) != drawable)
            throw bad("swap does not target the current context");
        BufferedImage image = NativeGlReadback.readBack(current.getGL(), width, height);
        String filename = "frame-%04d.png".formatted(frame);
        try (OutputStream out = Files.newOutputStream(output.resolve(filename), StandardOpenOption.CREATE_NEW)) {
            if (!ImageIO.write(image, "PNG", out))
                throw new IOException("PNG writer missing");
        }
        frames.write(frame + "\t" + label + "\t" + filename + "\n");
        label = "";
    }

    void record(String[] c) throws Exception {
        if (c.length < 2)
            throw bad("record has no entry");
        String call = c[1],
               id = frame + "."
                + ((call.equals("glDeleteTextures") || call.equals("glDeleteBuffersARB")
                           || call.equals("glDeleteLists"))
                                ? "d" + del++
                                : seq++);
        if (!c[0].equals(id))
            throw bad("expected record " + id);
        if (c[c.length - 1].startsWith("!> "))
            throw bad("faulted native call cannot be replayed: " + c[c.length - 1]);
        if (call.equals("~mark")) {
            if (c.length != 3 || !c[2].matches("[A-Za-z0-9_.:-]+"))
                throw bad("invalid frame marker");
            label = label.isEmpty() ? c[2] : label + "," + c[2];
            return;
        }
        if (call.equals("~gl")) {
            if (c.length != 3)
                throw bad("invalid GL marker");
            selected = (GL) reference(c[2], "ref:G");
            return;
        }
        ReplayTrace.Rule rule = trace.rule(call, c);
        boolean platform = !rule.receiver().equals("-");
        Object receiver;
        if (platform) {
            if (rule.receiver().equals("ref:F"))
                recordReference(c[2], "ref:F", GLDrawableFactory.getFactory());
            receiver = reference(c[2], rule.receiver());
        } else {
            receiver = selected;
            if (rule.flag().equals("deletion") && GLContext.getCurrent() != null)
                receiver = GLContext.getCurrent().getGL();
            if (receiver == null || GLContext.getCurrent() == null
                    || owners.get(receiver) != GLContext.getCurrent())
                throw bad("GL receiver is not current");
        }
        int start = platform ? 3 : 2;
        String[] inputs = Arrays.copyOfRange(c, start, start + rule.roles().size());
        Object[] args = new Object[inputs.length];
        for (int i = 0; i < args.length; i++)
            args[i] = argument(rule, inputs, i);
        if (call.equals("glGenLists") && ((int) args[0] < 0 || (int) args[0] > 4194304))
            throw bad("unsupported display list range");
        if (call.equals("glDeleteLists")
                && ((int) args[1] < 0 || (int) args[1] > listRangeRemaining.getOrDefault(inputs[0], 0)))
            throw bad("display list deletion crosses an unrecorded allocation boundary");
        if (call.equals("GLDrawable.swapBuffers"))
            capture((GLDrawable) receiver);
        if (!rule.result().equals("void") && !c[c.length - 1].startsWith("=> "))
            throw bad("missing return value");
        if (!platform)
            memory.get(GLContext.getCurrent()).before((GL) receiver, call, args);
        Object result = rule.method().invoke(receiver, args);
        outputs(rule, inputs, args);
        if (!rule.result().equals("void"))
            returns(rule, c[c.length - 1].substring(3), result, args);
        switch (call) {
            case "GLDrawable.setRealized" -> {
                if ((boolean) args[0])
                    realized.add((GLDrawable) receiver);
                else
                    realized.remove(receiver);
            }
            case "GLDrawable.createContext" -> {
                contexts.add((GLContext) result);
                surfaces.put((GLContext) result, (GLDrawable) receiver);
                memory.put((GLContext) result,
                        new NativeInput(
                                args[0] == null ? new HashMap<>() : memory.get((GLContext) args[0]).storage()));
            }
            case "GLContext.getGL" -> owners.put((GL) result, (GLContext) receiver);
            case "GLContext.destroy" -> {
                contexts.remove((GLContext) receiver);
                memory.remove((GLContext) receiver);
            }
            case "GLDrawable.swapBuffers" -> {
                frame++;
                seq = del = 0;
            }
        }
    }

    void run(Path file) throws Exception {
        validateEncoding(file);
        try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            if (!"#GLTrace v1".equals(reader.readLine()))
                throw bad("missing GLTrace v1 header");
            boolean stackAllowed = false;
            for (String line; (line = reader.readLine()) != null;) {
                if (line.startsWith("#! ") && records == 0 && !line.contains("\t"))
                    continue;
                if (line.startsWith("#@ ") && stackAllowed && !line.contains("\t")) {
                    stackAllowed = false;
                    continue;
                }
                try {
                    record
                    (line.split("\t", -1));
                } catch (Exception e) {
                    throw new IOException("GLTrace record " + line.substring(0, Math.min(140, line.length())), e);
                }
                stackAllowed = true;
                records++;
            }
        }
        for (String mismatch : observedDifferences)
            System.err.println("hardware observation: " + mismatch);
        System.out.println("Replayed " + records + " records, " + frame + " swaps.");
    }

    static void validateEncoding(Path file) throws IOException {
        byte[] chunk = new byte[65536];
        int last = -1;
        try (InputStream input = Files.newInputStream(file)) {
            for (int n; (n = input.read(chunk)) != -1;) {
                for (int i = 0; i < n; i++) {
                    int b = chunk[i] & 255;
                    if ((b < 32 || b == 127) && b != '\n' && b != '\t')
                        throw bad("GLTrace contains a control character other than tab or LF");
                    last = b;
                }
            }
        }
        if (last != '\n')
            throw bad("GLTrace must end with LF");
    }

    public void close() throws IOException {
        try {
            GLContext current = GLContext.getCurrent();
            if (current != null)
                current.release();
            for (GLContext c : contexts)
                c.destroy();
            for (GLDrawable d : realized)
                d.setRealized(false);
        } finally {
            for (Frame w : windows)
                w.dispose();
            frames.close();
        }
    }

    public static void main(String[] args) throws Exception {
        if (args.length != 6)
            throw bad("usage: GlReplay GLTRACE.md trace.tsv native-dir width height new-output-dir");
        Path path = Path.of(args[1]).toAbsolutePath(), natives = Path.of(args[2]).toAbsolutePath();
        ReplayTrace source = new ReplayTrace(Path.of(args[0]), path.getParent().resolve("blobs"));
        int width = positive(args[3]), height = positive(args[4]);
        System.loadLibrary("jawt");
        System.load(natives.resolve("jogl.dll").toString());
        System.load(natives.resolve("jogl_awt.dll").toString());
        try (GlReplay replay = new GlReplay(source, Path.of(args[5]), width, height)) {
            replay.run(path);
        }
    }
}
