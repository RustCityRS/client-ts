import java.io.*;
import java.lang.invoke.MethodType;
import java.lang.reflect.Method;
import java.nio.*;
import java.nio.charset.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.regex.*;
import javax.media.opengl.*;

/** Reader for the versioned JOGL inventory and serialized argument values. */
final class ReplayTrace {
    record Rule(String name, Method method, String receiver, List<String> roles, String result, String flag) {}
    final Map<String, List<Rule>> rules = new HashMap<>();
    final Map<String, Map<Integer, Integer>> counts = new HashMap<>();
    private final Map<String, byte[]> blobs = new HashMap<>();
    private final Path blobDirectory;
    static final HexFormat HEX = HexFormat.of();
    static final Pattern HASH = Pattern.compile("[0-9a-f]{64}");
    static final Pattern COUNT = Pattern.compile("([A-Z]+)\\(\\$(\\d+)\\)");

    ReplayTrace(Path specification, Path blobDirectory) throws Exception {
        this.blobDirectory = blobDirectory;
        String section = "";
        for (String line : Files.readAllLines(specification)) {
            if (line.equals("<!-- entry-table:begin -->"))
                section = "rules";
            if (line.equals("<!-- count-tables:begin -->"))
                section = "counts";
            if (line.endsWith(":end -->"))
                section = "";
            if (!line.startsWith("| `") || section.isEmpty())
                continue;
            String[] cells = line.substring(1, line.length() - 1).replace("`", "").split("\\|", -1);
            Arrays.setAll(cells, i -> cells[i].trim());
            if (section.equals("counts")) {
                counts.computeIfAbsent(cells[0], k -> new HashMap<>())
                        .put(Integer.parseInt(cells[1].split(" ")[0]), Integer.parseInt(cells[2]));
                continue;
            }
            String[] member = cells[0].split("\\.");
            Class<?> owner = member.length == 1 ? GL.class : switch (member[0]) {
                case "GLDrawableFactory" -> GLDrawableFactory.class;
                case "GLDrawable" -> GLDrawable.class;
                case "GLContext" -> GLContext.class;
                default -> throw bad("unknown surface " + member[0]);
            };
            MethodType type = MethodType.fromMethodDescriptorString(cells[1], GL.class.getClassLoader());
            Method method = owner.getMethod(member[member.length - 1], type.parameterArray());
            List<String> roles = cells[3].equals("-") ? List.of() : List.of(cells[3].split(" "));
            if (!method.getReturnType().equals(type.returnType()) || method.getParameterCount() != roles.size())
                throw bad(line);
            rules.computeIfAbsent(cells[0], k -> new ArrayList<>())
                    .add(new Rule(cells[0], method, cells[2], roles, cells[4], cells[5]));
        }
        if (rules.values().stream().mapToInt(List::size).sum() != 110 || counts.isEmpty())
            throw bad("incomplete GLTrace v1 inventory");
    }

    static IllegalArgumentException bad(String description) {
        return new IllegalArgumentException(description);
    }

    static int integer(String token) {
        int value = Integer.parseInt(token);
        if (!Integer.toString(value).equals(token))
            throw bad("invalid int: " + token);
        return value;
    }

    static int natural(String token) {
        int value = integer(token);
        if (value < 0)
            throw bad("negative count " + token);
        return value;
    }

    static boolean bool(String token) {
        return switch (token) {
            case "T" -> true;
            case "F" -> false;
            default -> throw bad("invalid bool " + token);
        };
    }

    static long bits(String text, int digits) {
        if (text.length() != digits)
            throw bad("invalid hex bits " + text);
        for (int i = 0; i < digits; i++) {
            char c = text.charAt(i);
            if (!(c >= '0' && c <= '9') && !(c >= 'a' && c <= 'f'))
                throw bad("invalid hex bits " + text);
        }
        return Long.parseUnsignedLong(text, 16);
    }

    static float floatBits(String text) {
        return Float.intBitsToFloat((int) bits(text, 8));
    }

    static boolean prefix(String role, String token) {
        if (role.equals("buf") || role.startsWith("buf[") || role.startsWith("out-buf"))
            return token.startsWith("B:") || token.equals("null");
        if (role.equals("long"))
            return token.startsWith("o:");
        if (role.startsWith("in-f") || role.startsWith("out-f"))
            return token.startsWith("fv:") || token.equals("null");
        if (role.contains("names:") || role.startsWith("out-i"))
            return token.startsWith("iv:") || token.equals("null");
        return true;
    }

    Rule rule(String name, String[] columns) {
        Rule result = null;
        for (Rule rule : rules.getOrDefault(name, List.of())) {
            int start = 2 + (rule.receiver.equals("-") ? 0 : 1);
            int length = start + rule.roles.size() + (rule.result.equals("void") ? 0 : 1);
            if (columns.length != length)
                continue;
            boolean match = true;
            for (int i = 0; i < rule.roles.size(); i++)
                if (!prefix(rule.roles.get(i), columns[start + i]))
                    match = false;
            if (match) {
                if (result != null)
                    throw bad("ambiguous overload " + name);
                result = rule;
            }
        }
        if (result == null)
            throw bad("unsupported entry or invalid operands for " + name);
        return result;
    }

    int count(String role, String[] args) {
        int bracket = role.indexOf('[');
        if (bracket == -1)
            return Integer.MAX_VALUE;
        String expr = role.substring(bracket + 1, role.length() - 1);
        if (expr.startsWith("$"))
            return Math.max(0, integer(args[natural(expr.substring(1))]));
        Matcher table = COUNT.matcher(expr);
        if (table.matches())
            return counts.get(table.group(1)).getOrDefault(integer(args[natural(table.group(2))]), 1);
        return natural(expr);
    }

    static String sha(byte[] data) throws Exception {
        return HEX.formatHex(MessageDigest.getInstance("SHA-256").digest(data));
    }

    byte[] payload(String hash, byte[] inline, int size) throws Exception {
        if (!HASH.matcher(hash).matches())
            throw bad("invalid blob name " + hash);
        if ((size <= 256) != (inline != null))
            throw bad("incorrect inline encoding for " + hash);
        byte[] bytes = inline;
        if (bytes == null) {
            bytes = blobs.get(hash);
            if (bytes == null) {
                Path blob = blobDirectory.resolve(hash);
                if (!Files.isRegularFile(blob) || Files.size(blob) != size)
                    throw bad("missing or incorrectly sized blob " + hash);
                bytes = Files.readAllBytes(blob);
                if (!sha(bytes).equals(hash))
                    throw bad("blob SHA-256 mismatch " + hash);
                blobs.put(hash, bytes);
            }
        } else if (!sha(bytes).equals(hash))
            throw bad("inline SHA-256 mismatch " + hash);
        if (bytes.length != size)
            throw bad("payload length mismatch " + hash);
        return bytes;
    }

    String string(String token) throws Exception {
        if (token.equals("null"))
            return null;
        String[] p = token.split(":", 4);
        if (p.length < 3 || !p[0].equals("S"))
            throw bad("expected a string");
        byte[] inline = null;
        if (p.length == 4) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            for (int i = 0; i < p[3].length(); i++) {
                char c = p[3].charAt(i);
                if (c == '%') {
                    String escape = p[3].substring(i + 1, i + 3);
                    int value = HEX.parseHex(escape)[0] & 255;
                    if (!escape.equals(escape.toUpperCase(Locale.ROOT))
                            || (value >= 33 && value <= 126 && value != '%'))
                        throw bad("noncanonical string escape");
                    out.write(value);
                    i += 2;
                } else {
                    if (c < 33 || c > 126)
                        throw bad("invalid string byte");
                    out.write(c);
                }
            }
            inline = out.toByteArray();
        }
        byte[] data = payload(p[2], inline, natural(p[1]));
        return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(data)).toString();
    }

    Buffer buffer(String token, int count) throws Exception {
        if (token.equals("null"))
            return null;
        String[] p = token.split(":", -1);
        if ((p.length != 7 && p.length != 8) || !p[0].equals("B"))
            throw bad("malformed buffer " + token);
        int pos = natural(p[2]), limit = natural(p[3]), cap = natural(p[4]);
        if (pos > limit || limit > cap)
            throw bad("invalid buffer position or limit");
        int unit = switch (p[1]) {
            case "byte" -> 1;
            case "short" -> 2;
            case "int", "float" -> 4;
            default -> throw bad("unsupported buffer type");
        };
        int bytes = Math.multiplyExact(Math.min(limit - pos, count), unit);
        int capacity = Math.multiplyExact(cap, unit);
        if (capacity > 268435456)
            throw bad("buffer over 256 MiB cannot be replayed");
        if (p.length == 8 && !p[7].equals(p[7].toLowerCase(Locale.ROOT)))
            throw bad("malformed buffer hex");
        byte[] data = payload(p[6], p.length == 8 ? HEX.parseHex(p[7]) : null, bytes);
        boolean direct = switch (p[5]) {
            case "direct" -> true;
            case "heap" -> false;
            default -> throw bad("unsupported buffer storage");
        };
        ByteBuffer raw = (direct ? ByteBuffer.allocateDirect(capacity) : ByteBuffer.allocate(capacity))
                                 .order(ByteOrder.nativeOrder());
        raw.put(pos * unit, data);
        Buffer result = switch (p[1]) {
            case "byte" -> raw;
            case "short" -> {
                if (direct)
                    yield raw.asShortBuffer();
                short[] a = new short[cap];
                raw.asShortBuffer().get(a);
                yield ShortBuffer.wrap(a);
            }
            case "int" -> {
                if (direct)
                    yield raw.asIntBuffer();
                int[] a = new int[cap];
                raw.asIntBuffer().get(a);
                yield IntBuffer.wrap(a);
            }
            case "float" -> {
                if (direct)
                    yield raw.asFloatBuffer();
                float[] a = new float[cap];
                raw.asFloatBuffer().get(a);
                yield FloatBuffer.wrap(a);
            }
            default -> throw new AssertionError();
        };
        return result.limit(limit).position(pos);
    }

    static GLCapabilities caps(String token) {
        if (token.equals("null"))
            return null;
        String[] p = token.split(":", -1);
        if (p.length != 16 || !p[0].equals("K"))
            throw bad("invalid GLCapabilities");
        GLCapabilities c = new GLCapabilities();
        c.setDoubleBuffered(bool(p[1]));
        c.setStereo(bool(p[2]));
        c.setHardwareAccelerated(bool(p[3]));
        c.setDepthBits(natural(p[4]));
        c.setStencilBits(natural(p[5]));
        c.setRedBits(natural(p[6]));
        c.setGreenBits(natural(p[7]));
        c.setBlueBits(natural(p[8]));
        c.setAlphaBits(natural(p[9]));
        c.setAccumRedBits(natural(p[10]));
        c.setAccumGreenBits(natural(p[11]));
        c.setAccumBlueBits(natural(p[12]));
        c.setAccumAlphaBits(natural(p[13]));
        c.setSampleBuffers(bool(p[14]));
        c.setNumSamples(natural(p[15]));
        return c;
    }
}
