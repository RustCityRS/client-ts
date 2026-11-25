import java.io.*;
import java.lang.reflect.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.function.BooleanSupplier;
import javax.media.opengl.*;

/** Headless JOGL dispatch for the unmodified 530 jars. Each instance owns one trace. */
public final class GlRecorder implements AutoCloseable {
    static final HexFormat HEX = HexFormat.of();
    private static final Object[] EMPTY = {};
    private final Path directory;
    private final Map<Character, Map<Integer, Integer>> names = new HashMap<>();
    private final Map<Character, Integer> serials = new HashMap<>();
    private final Set<String> written = new HashSet<>();
    private final BufferedWriter output;
    private final Map<Character, IdentityHashMap<Object, Integer>> refs = new HashMap<>();
    private Object lastGL;
    private final Map<Integer, int[]> integers = new HashMap<>();
    private final Map<Integer, String> strings = new HashMap<>();
    private final Map<Integer, float[]> floats = new HashMap<>();
    private Set<String> extensions = Set.of();
    private Set<?> unavailable = Set.of();
    private boolean profileLoaded;
    private int frame, sequence, deletionSequence;

    public GlRecorder(Path directory) {
        this(directory, null);
    }

    GlRecorder(Path directory, String profileName) {
        if (profileName != null && !profileName.matches("[A-Za-z0-9_.-]+")) throw new IllegalArgumentException(profileName);
        this.directory = directory;
        try {
            if (directory == null) output = null;
            else {
                Files.createDirectories(directory);
                output = Files.newBufferedWriter(directory.resolve("trace.tsv"), StandardCharsets.UTF_8);
                output.write("#GLTrace v1\n");
                if (profileName != null) output.write("#! profile=" + profileName + "\n");
            }
        } catch (IOException e) { throw new UncheckedIOException(e); }
    }

    /** Existing fixture-specific assertions/faults run through this recorder too. */
    static GlRecorder forOracle() {
        String output = System.getProperty("gltrace.dir");
        GlRecorder recorder = new GlRecorder(output == null ? null : Path.of(output));
        if (output != null) Runtime.getRuntime().addShutdownHook(new Thread(recorder::close));
        return recorder;
    }

    public void loadProfile(Path capture) throws IOException {
        Json reader = new Json(Files.readString(capture));
        Map<?,?> profile = (Map<?,?>)reader.value();
        if (reader.next() != -1 || !"rs530-caps-profile-v1".equals(profile.get("format"))) throw new IOException("Invalid GL profile " + capture);
        strings.clear(); integers.clear(); floats.clear();
        ((Map<?,?>)profile.get("strings")).forEach((k,v) -> strings.put(Integer.parseInt((String)k), (String)v));
        ((Map<?,?>)profile.get("integers")).forEach((k,v) -> integers.put(Integer.parseInt((String)k),
            ((List<?>)v).stream().mapToInt(n -> (int)n).toArray()));
        ((Map<?,?>)profile.get("floats")).forEach((k,v) -> {
            List<?> list = (List<?>)v;
            float[] values = new float[list.size()];
            for (int i = 0; i < values.length; i++) values[i] = Float.intBitsToFloat(Integer.parseUnsignedInt((String)list.get(i), 16));
            floats.put(Integer.parseInt((String)k), values);
        });
        unavailable = Set.copyOf((List<?>)profile.get("missingEntryPoints"));
        // GLTRACE.md 16 item 3: only the looked-up entry points can be missing.
        for (Object name : unavailable) if (!DYNAMIC.contains(name)) throw new IOException("Invalid GL profile " + capture + ": missing entry point " + name);
        // As JOGL's FunctionAvailabilityCache.initAvailableExtensions: StringTokenizer's default delimiters, each token trimmed.
        extensions = new HashSet<>();
        for (StringTokenizer tokens = new StringTokenizer(strings.get(7939)); tokens.hasMoreTokens();) extensions.add(tokens.nextToken().trim());
        try {
            // Invoke the bundled JOGL version parser, including its vendor-prefix/version token rules.
            Class<?> version = Class.forName("com.sun.opengl.impl.FunctionAvailabilityCache$Version");
            var constructor = version.getDeclaredConstructor(String.class);
            var getMajor = version.getDeclaredMethod("getMajor");
            var getMinor = version.getDeclaredMethod("getMinor");
            AccessibleObject.setAccessible(new AccessibleObject[]{constructor, getMajor, getMinor}, true);
            Object parsed = constructor.newInstance(strings.get(7938));
            int major = (int)getMajor.invoke(parsed), minor = (int)getMinor.invoke(parsed);
            while (major > 0) {
                while (minor >= 0) extensions.add("GL_VERSION_" + major + "_" + minor--);
                if (major == 2) minor = 5;
                major--;
            }
        } catch (ReflectiveOperationException e) { throw new IOException("JOGL version for " + capture, e); }
        profileLoaded = true;
    }

    /** The profile schema uses objects, arrays, quoted strings and signed decimal integers. */
    private static final class Json {
        final String text;
        int at;
        Json(String text) { this.text = text; }
        int next() {
            while (at < text.length() && Character.isWhitespace(text.charAt(at))) at++;
            return at == text.length() ? -1 : text.charAt(at);
        }
        boolean take(char c) { if (next() != c) return false; at++; return true; }
        void require(char c) { if (!take(c)) throw new IllegalArgumentException("Expected " + c + " at " + at); }
        String string() {
            require('"');
            StringBuilder s = new StringBuilder();
            while (at < text.length()) {
                char c = text.charAt(at++);
                if (c == '"') return s.toString();
                if (c == '\\') c = switch (text.charAt(at++)) {
                    case '"' -> '"'; case '/' -> '/'; case '\\' -> '\\'; case 't' -> '\t'; case 'r' -> '\r';
                    case 'n' -> '\n'; case 'f' -> '\f'; case 'b' -> '\b';
                    case 'u' -> { int start = at; at += 4; yield (char)Integer.parseInt(text, start, at, 16); }
                    default -> throw new IllegalArgumentException("Invalid escape at " + at);
                };
                s.append(c);
            }
            throw new IllegalArgumentException("Unterminated string");
        }
        Object value() {
            if (take('{')) {
                Map<String,Object> values = new HashMap<>();
                if (!take('}')) {
                    do { String k = string(); require(':'); values.put(k, value()); } while (take(','));
                    require('}');
                }
                return values;
            }
            if (take('[')) {
                List<Object> values = new ArrayList<>();
                if (!take(']')) { do { values.add(value()); } while (take(',')); require(']'); }
                return values;
            }
            if (next() == '"') return string();
            int start = at;
            if (next() == '-') at++;
            while (at < text.length() && Character.isDigit(text.charAt(at))) at++;
            return Integer.parseInt(text, start, at, 10);
        }
    }

    public GL gl() { return gl(null); }

    public GL gl(InvocationHandler driver) {
        return proxy(GL.class, driver == null ? new Driver(true) : driver);
    }

    public GLDrawable drawable(InvocationHandler driver) {
        return drawable(driver, true);
    }

    private GLDrawable drawable(InvocationHandler driver, boolean doubleBuffered) {
        boolean[] realized = {false};
        return proxy(GLDrawable.class, driver == null ? (p, method, args) -> switch (method.getName()) {
            case "createContext" -> context(proxy(GL.class, new Driver(doubleBuffered)), () -> realized[0]);
            case "setRealized" -> { realized[0] = (boolean)args[0]; yield null; }
            case "swapBuffers" -> null;
            default -> throw new AssertionError(method);
        } : driver);
    }

    private <T> T proxy(Class<T> type, InvocationHandler driver) {
        return type.cast(Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (p, method, nullable) -> {
            Object[] args = nullable == null ? EMPTY : nullable;
            String call = method.getName();
            if (method.getDeclaringClass() == Object.class) return switch (call) {
                case "equals" -> p == args[0];
                case "hashCode" -> System.identityHashCode(p);
                case "toString" -> type.getSimpleName();
                default -> throw new AssertionError(method);
            };
            if (directory == null) return driver.invoke(p, method, nullable);
            return record(p, call, args, () -> driver.invoke(p, method, nullable));
        }));
    }

    public GLDrawableFactory factory() {
        return new GLDrawableFactory() {
            public GLDrawable getGLDrawable(Object surface, GLCapabilities caps, GLCapabilitiesChooser chooser) {
                return (GLDrawable)platformCall(this, "getGLDrawable", new Object[]{surface, caps, chooser}, () -> {
                    if (surface == null) throw new IllegalArgumentException("Null target");
                    return drawable(null, caps == null || caps.getDoubleBuffered());
                });
            }
        };
    }

    /** Install the factory entry point that tf.a(Canvas,int) uses, and restore it when this fixture ends. */
    public AutoCloseable installFactory() throws ReflectiveOperationException {
        Field field = GLDrawableFactory.class.getDeclaredField("factory");
        field.setAccessible(true);
        Object previous = field.get(null);
        field.set(null, factory());
        return () -> field.set(null, previous);
    }

    // The shipped GLU resolves GLContext.getCurrent().getGL() internally on every mipmap build.
    public GLContext context(GL gl) {
        return context(gl, () -> true);
    }

    private GLContext context(GL gl, BooleanSupplier realized) {
        return new GLContext() {
            boolean created, destroyed;
            public int makeCurrent() {
                return (int)platformCall(this, "makeCurrent", EMPTY, () -> {
                    if (getCurrent() == this) return 1;
                    setCurrent(null);
                    if (!realized.getAsBoolean() || destroyed) return 0;
                    int result = created ? 1 : 2;
                    created = true;
                    setCurrent(this);
                    return result;
                });
            }
            public GL getGL() { return (GL)platformCall(this, "getGL", EMPTY, () -> gl); }
            public void release() { platformCall(this, "release", EMPTY, () -> { setCurrent(null); return null; }); }
            public void destroy() { platformCall(this, "destroy", EMPTY, () -> { destroyed = true; return null; }); }
        };
    }

    private interface Call { Object invoke() throws Throwable; }
    private Object platformCall(Object receiver, String name, Object[] args, Call body) {
        try { return directory == null ? body.invoke() : record(receiver, name, args, body); }
        catch (RuntimeException | Error e) { throw e; }
        catch (Throwable e) { throw new AssertionError(e); }
    }

    // Only these entries use a looked-up address in the shipped GLImpl. Core exports are direct calls.
    private static final Set<String> DYNAMIC = Set.of("glActiveTexture", "glBindBufferARB", "glBindProgramARB",
        "glBufferDataARB", "glBufferSubDataARB", "glClientActiveTexture", "glDeleteBuffersARB", "glGenBuffersARB",
        "glGenProgramsARB", "glMultiTexCoord2f", "glPointParameterfARB", "glPointParameterfvARB",
        "glProgramLocalParameter4fARB", "glProgramLocalParameter4fvARB", "glProgramStringARB", "glTexImage3D");
    private record ImageLevel(int target, int level) {}
    private final class Driver implements InvocationHandler {
        private final Map<Character, Integer> ids = new HashMap<>();
        private final Map<ImageLevel, int[]> images = new HashMap<>();
        private float[] ambient = {0.2f, 0.2f, 0.2f, 1.0f};
        private int readBuffer, drawBuffer;

        Driver(boolean doubleBuffered) {
            readBuffer = drawBuffer = doubleBuffered ? 1029 : 1028; // GL_BACK / GL_FRONT
        }

        public Object invoke(Object proxy, Method method, Object[] args) throws IOException {
            return respond(method, args == null ? EMPTY : args, this);
        }

        int allocate(char kind, int count) {
            if (count <= 0) return 0;
            int base = ids.getOrDefault(kind, 1);
            ids.put(kind, base + count);
            return base;
        }

        void image(int target, int level, int border, int width, int height, int depth) {
            if (target != 32867 && target != 32868 && target != 32880 && target != 34075) return;
            int[] maximum = integers.getOrDefault(target == 32880 ? 32883 : target == 34075 ? 34076 : 3379, integers.get(3379));
            int max = maximum == null || maximum.length == 0 ? 0 : maximum[0];
            double scale = Math.pow(2, level);
            boolean fits = border == 0 && level >= 0 && width >= 0 && width * scale <= max;
            if (target == 32867) height = 1;
            else fits &= height >= 0 && height * scale <= max;
            if (target != 32880) depth = 1;
            else fits &= depth >= 0 && depth * scale <= max;
            if (target == 34075) fits &= width == height;
            images.put(new ImageLevel(target, level), fits ? new int[]{width, height, depth} : new int[3]);
        }
    }

    private Object respond(Method method, Object[] a, Driver driver) throws IOException {
        String call = method.getName();
        if (!profileLoaded) loadProfile(Path.of(System.getProperty("gltrace.caps", "test/hd/rtx5070.json")));
        for (int i = 0; i < a.length; i++) {
            if (a[i] instanceof int[] || a[i] instanceof float[]) {
                int length = Array.getLength(a[i]), offset = (int)a[i + 1];
                if ((call.startsWith("glGen") || call.startsWith("glDelete")) && length < offset + (int)a[0])
                    throw new ArrayIndexOutOfBoundsException("Required " + a[0] + " elements in array, only had " + (length - offset));
                if (length <= offset) {
                    String offsetName = switch (call) {
                        case "glGenTextures", "glDeleteTextures" -> "textures_offset";
                        case "glGenBuffersARB", "glGenProgramsARB", "glDeleteBuffersARB" -> "ids_offset";
                        case "glColor4fv" -> "v_offset";
                        case "glLoadMatrixf" -> "m_offset";
                        default -> "params_offset";
                    };
                    throw new GLException("array offset argument \"" + offsetName + "\" (" + offset + ") equals or exceeds array length (" + length + ")");
                }
            }
        }
        if (DYNAMIC.contains(call) && unavailable.contains(call)) throw new GLException("Method \"" + call + "\" not available");
        switch (call) {
            case "glGetString" -> { return strings.get((int)a[0]); }
            case "isExtensionAvailable" -> { return extensions.contains((String)a[0]); }
            case "glGenLists" -> { return driver.allocate('L', (int)a[0]); }
            case "glGenTextures", "glGenBuffersARB", "glGenProgramsARB" -> {
                for (int i = 0; i < (int)a[0]; i++) ((int[])a[1])[(int)a[2] + i] = driver.allocate(kind(call), 1);
            }
            case "glGetIntegerv" -> {
                int[] values = switch ((int)a[0]) {
                    case 3073 -> new int[]{driver.drawBuffer};
                    case 3074 -> new int[]{driver.readBuffer};
                    case 34379 -> new int[]{-1};
                    default -> integers.get((int)a[0]);
                };
                if (values != null) for (int i = 0; i < values.length; i++) ((int[])a[1])[(int)a[2] + i] = values[i];
            }
            case "glGetFloatv" -> {
                float[] values = (int)a[0] == 2899 ? driver.ambient : floats.get((int)a[0]);
                if (a.length == 2) {
                    FloatBuffer output = (FloatBuffer)Objects.requireNonNull(a[1]);
                    if (values == null) return null;
                    for (int i = 0; i < values.length; i++) output.put(output.position() + i, values[i]);
                } else if (values != null) {
                    for (int i = 0; i < values.length; i++) ((float[])a[1])[(int)a[2] + i] = values[i];
                }
            }
            case "glLightModelfv" -> {
                // mk.a(IFFF) sets this context's ambient. rd.a(I) reads it into ARB local 66.
                if ((int)a[0] == 2899 && a[1] instanceof float[] values) {
                    int off = (int)a[2];
                    if (off >= 0 && off <= values.length - 4) driver.ambient = Arrays.copyOfRange(values, off, off + 4);
                }
            }
            case "glDrawBuffer" -> driver.drawBuffer = (int)a[0];
            case "glReadBuffer" -> driver.readBuffer = (int)a[0];
            case "glTexImage1D" -> driver.image((int)a[0], (int)a[1], (int)a[4], (int)a[3], 1, 1);
            case "glTexImage2D" -> driver.image((int)a[0], (int)a[1], (int)a[5], (int)a[3], (int)a[4], 1);
            case "glTexImage3D" -> driver.image((int)a[0], (int)a[1], (int)a[6], (int)a[3], (int)a[4], (int)a[5]);
            case "glGetTexLevelParameteriv" -> {
                int index = switch ((int)a[2]) { case 4096 -> 0; case 4097 -> 1; case 32881 -> 2; default -> -1; };
                int[] image = driver.images.get(new ImageLevel((int)a[0], (int)a[1]));
                ((int[])a[3])[(int)a[4]] = index < 0 || image == null ? 0 : image[index];
            }
            default -> { if (method.getReturnType() != void.class) throw new AssertionError(method); }
        }
        return null;
    }

    private static char kind(String call) {
        if (call.contains("Texture")) return 'T';
        if (call.contains("Buffer")) return 'B';
        if (call.contains("List")) return 'L';
        if (call.contains("Program")) return 'P';
        throw new IllegalArgumentException(call);
    }

    private void register(char kind, int id) {
        if (id != 0) names.computeIfAbsent(kind, ignored -> new HashMap<>())
            .put(id, serials.merge(kind, 1, Integer::sum));
    }

    private String name(char kind, int id) {
        Integer normalized = names.getOrDefault(kind, Map.of()).get(id);
        return id == 0 ? "0" : normalized == null ? "#" + kind + "?" + id : "#" + kind + normalized;
    }

    static byte[] bytes(Buffer buffer, int count) {
        int n = Math.min(buffer.remaining(), count);
        if (buffer instanceof ByteBuffer source) {
            byte[] bytes = new byte[n];
            source.duplicate().get(bytes);
            return bytes;
        }
        if (buffer instanceof IntBuffer source) {
            ByteBuffer bytes = ByteBuffer.allocate(n * 4).order(source.order());
            bytes.asIntBuffer().put(source.duplicate().limit(source.position() + n));
            return bytes.array();
        }
        if (buffer instanceof FloatBuffer source) {
            ByteBuffer bytes = ByteBuffer.allocate(n * 4).order(source.order());
            for (int i = source.position(); i < source.position() + n; i++) bytes.putInt(Float.floatToRawIntBits(source.get(i)));
            return bytes.array();
        }
        if (buffer instanceof ShortBuffer source) {
            ByteBuffer bytes = ByteBuffer.allocate(n * 2).order(source.order());
            bytes.asShortBuffer().put(source.duplicate().limit(source.position() + n));
            return bytes.array();
        }
        throw new IllegalArgumentException("Unsupported JOGL buffer " + buffer.getClass());
    }

    static String sha(byte[] bytes) {
        try { return HEX.formatHex(MessageDigest.getInstance("SHA-256").digest(bytes)); }
        catch (NoSuchAlgorithmException e) { throw new AssertionError(e); }
    }

    private String buffer(Buffer b, int count) throws IOException {
        byte[] bytes = bytes(b, count);
        String hash = sha(bytes);
        String type = b instanceof ByteBuffer ? "byte" : b instanceof IntBuffer ? "int" : b instanceof ShortBuffer ? "short" : "float";
        String prefix = "B:" + type + ":" + b.position() + ":" + b.limit() + ":" + b.capacity() + ":"
            + (b.isDirect() ? "direct:" : "heap:") + hash;
        blob(bytes, hash);
        return bytes.length <= 256 ? prefix + ":" + HEX.formatHex(bytes) : prefix;
    }

    private void blob(byte[] bytes, String hash) throws IOException {
        if (written.add(hash)) {
            Files.createDirectories(directory.resolve("blobs"));
            Files.write(directory.resolve("blobs").resolve(hash), bytes);
        }
    }

    private int count(String call, Object[] a) {
        return switch (call) {
            case "glLoadMatrixf" -> 16;
            case "glGetIntegerv" -> 1;
            case "glGetFloatv" -> (int)a[0] == 2899 ? 4 : 1;
            case "glGetTexLevelParameteriv" -> 1;
            case "glPointParameterfvARB" -> (int)a[0] == 33065 ? 3 : 1;
            case "glLightfv" -> switch ((int)a[1]) { case 4612 -> 3; case 4608, 4609, 4610, 4611 -> 4; default -> 1; };
            case "glFogfv" -> (int)a[0] == 2918 ? 4 : 1;
            case "glLightModelfv" -> (int)a[0] == 2899 ? 4 : 1;
            case "glTexEnvfv" -> (int)a[1] == 8705 ? 4 : 1;
            case "glTexGenfv" -> (int)a[1] == 9473 || (int)a[1] == 9474 ? 4 : 1;
            case "glColor4fv", "glProgramLocalParameter4fvARB" -> 4;
            default -> Math.max(0, (int)a[0]); // names passed to glGen* or glDelete*
        };
    }

    private String array(String call, Object[] args, int i, boolean allocating) {
        int offset = (int)args[i + 1], count = count(call, args);
        int available = offset < 0 ? 0 : Math.max(0, Math.min(count, Array.getLength(args[i]) - offset));
        StringJoiner values = new StringJoiner(",", args[i] instanceof int[] ? "iv:" : "fv:", "");
        for (int j = offset; j < offset + available; j++) {
            if (args[i] instanceof int[] ids) {
                if (allocating && call.startsWith("glGen")) register(kind(call), ids[j]);
                values.add(call.startsWith("glGen") || call.startsWith("glDelete") ? name(kind(call), ids[j]) : Integer.toString(ids[j]));
            } else values.add(HEX.toHexDigits(Float.floatToRawIntBits(((float[])args[i])[j])));
        }
        if (available < count) values.add("!" + (count - available));
        return values.toString();
    }

    private String string(String s) throws IOException {
        byte[] bytes = s.getBytes(StandardCharsets.UTF_8);
        String hash = sha(bytes);
        blob(bytes, hash);
        String token = "S:" + bytes.length + ":" + hash;
        if (bytes.length > 256) return token;
        StringBuilder text = new StringBuilder(token).append(':');
        for (byte b : bytes) {
            int u = b & 255;
            if (u >= 33 && u <= 126 && u != '%') text.append((char)u);
            else text.append('%').append(HEX.withUpperCase().toHexDigits(b));
        }
        return text.toString();
    }

    private String reference(char kind, Object object) {
        if (object == null) return "null";
        var map = refs.computeIfAbsent(kind, k -> new IdentityHashMap<>());
        return "@" + kind + map.computeIfAbsent(object, k -> map.size() + 1);
    }

    private String arg(String call, Object[] args, int i, boolean allocating) throws IOException {
        Object v = args[i];
        if (v == null) return "null";
        if (call.equals("getGLDrawable") && i != 1) return reference('O', v);
        if (v instanceof Buffer b) return buffer(b, call.equals("glProgramLocalParameter4fvARB") || call.equals("glGetFloatv")
            ? count(call, args) : Integer.MAX_VALUE);
        if (v instanceof float[] || v instanceof int[]) return array(call, args, i, allocating);
        if (v instanceof Float f) return "f:" + HEX.toHexDigits(Float.floatToRawIntBits(f));
        if (v instanceof Double d) return "d:" + HEX.toHexDigits(Double.doubleToRawLongBits(d));
        if (v instanceof Long l) return "o:" + l;
        if (v instanceof Boolean b) return b ? "T" : "F";
        if (v instanceof String s) return string(s);
        if ((i == 1 && (call.equals("glBindTexture") || call.equals("glBindBufferARB") || call.equals("glBindProgramARB")))
            || i == 0 && (call.equals("glNewList") || call.equals("glCallList") || call.equals("glDeleteLists")))
            return name(kind(call), (int)v);
        if (call.equals("getGLDrawable")) {
            GLCapabilities c = (GLCapabilities)v;
            return "K:" + (c.getDoubleBuffered() ? "T" : "F") + ":" + (c.getStereo() ? "T" : "F") + ":"
                + (c.getHardwareAccelerated() ? "T" : "F") + ":" + c.getDepthBits() + ":" + c.getStencilBits() + ":"
                + c.getRedBits() + ":" + c.getGreenBits() + ":" + c.getBlueBits() + ":" + c.getAlphaBits() + ":"
                + c.getAccumRedBits() + ":" + c.getAccumGreenBits() + ":" + c.getAccumBlueBits() + ":" + c.getAccumAlphaBits()
                + ":" + (c.getSampleBuffers() ? "T" : "F") + ":" + c.getNumSamples();
        }
        if (v instanceof GLContext) return reference('C', v);
        return v.toString();
    }

    private void append(String entry, List<String> columns, boolean deletion, boolean endFrame, boolean withStack) {
        String id = frame + "." + (deletion ? "d" + deletionSequence++ : sequence++);
        writeLine(id + "\t" + entry + (columns.isEmpty() ? "" : "\t" + String.join("\t", columns)));
        if (withStack && Boolean.parseBoolean(System.getProperty("gltrace.stacks", "true"))) {
            String stack = StackWalker.getInstance().walk(frames -> frames
                .filter(f -> !f.getClassName().equals("GlRecorder") && !f.getClassName().startsWith("GlRecorder$")
                    && !f.getClassName().startsWith("jdk.proxy"))
                .limit(8).map(f -> f.getClassName() + "." + f.getMethodName() + " " + f.getByteCodeIndex())
                .reduce((a, b) -> a + " < " + b).orElse("?"));
            writeLine("#@ " + stack);
        }
        if (endFrame) {
            frame++; sequence = 0; deletionSequence = 0;
            try { output.flush(); } catch (IOException e) { throw new UncheckedIOException(e); }
        }
    }

    public void mark(String label) {
        if (!label.matches("[A-Za-z0-9_.:\\-]+")) throw new IllegalArgumentException(label);
        if (output != null) append("~mark", List.of(label), false, false, false);
    }

    private Object record(Object receiver, String call, Object[] args, Call body) throws Throwable {
        boolean deletion = call.startsWith("glDelete");
        String entry = call;
        List<String> columns = new ArrayList<>();
        if (receiver instanceof GL) {
            if (!deletion && lastGL != receiver) {
                lastGL = receiver;
                append("~gl", List.of(reference('G', receiver)), false, false, false);
            }
        } else {
            char kind = receiver instanceof GLDrawable ? 'D' : receiver instanceof GLContext ? 'C' : 'F';
            entry = (kind == 'D' ? "GLDrawable." : kind == 'C' ? "GLContext." : "GLDrawableFactory.") + call;
            columns.add(reference(kind, receiver));
        }
        int out = switch (call) {
            case "glGenTextures", "glGenProgramsARB", "glGenBuffersARB", "glGetIntegerv", "glGetFloatv" -> 1;
            case "glGetTexLevelParameteriv" -> 3;
            default -> -1;
        };
        int base = columns.size();
        for (int i = 0; i < args.length; i++) columns.add(i == out ? null : arg(call, args, i, false));
        Object result = null;
        Throwable fault = null;
        try { result = body.invoke(); } catch (Throwable e) { fault = e; }
        if (out >= 0) columns.set(base + out, arg(call, args, out, fault == null));
        if (fault != null) {
            columns.add("!> " + (fault instanceof GLException ? "GLException" : fault instanceof RuntimeException
                ? "RuntimeException" : fault instanceof Error ? "Error" : fault instanceof Exception ? "Exception" : "Throwable"));
        } else if (call.equals("glGenLists")) {
            int raw = (int)result;
            if (raw != 0) for (int i = 0; i < (int)args[0]; i++) register('L', raw + i);
            columns.add("=> " + name('L', raw));
        } else if (call.equals("glGetString")) {
            columns.add("=> " + (result == null ? "null" : string((String)result)));
        } else if (call.equals("getGL") || call.equals("createContext") || call.equals("getGLDrawable")) {
            columns.add("=> " + reference(call.equals("getGL") ? 'G' : call.equals("createContext") ? 'C' : 'D', result));
        } else if (call.equals("isExtensionAvailable") || call.equals("makeCurrent")) {
            columns.add("=> " + (result instanceof Boolean b ? b ? "T" : "F" : result));
        }
        append(entry, columns, deletion, call.equals("swapBuffers"), true);
        if (fault != null) throw fault;
        return result;
    }

    private void writeLine(String line) {
        try { output.write(line); output.write('\n'); } catch (IOException e) { throw new UncheckedIOException(e); }
    }

    public void close() {
        if (output != null)
            try { output.close(); } catch (IOException e) { throw new UncheckedIOException(e); }
    }
}
