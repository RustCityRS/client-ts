import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.FileDescriptor;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.lang.reflect.Field;
import java.nio.Buffer;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.IntBuffer;
import java.nio.ShortBuffer;
import java.util.LinkedHashMap;
import java.util.Map;

// Interprets the nio corpus from stdin on real java.nio, one output line per corpus line:
//   <n> <result> | <state of the target slot>[ arr=<array>][ src=<state of the source buffer>]
// test/hd/nio.test.ts runs the same corpus on src/util/nio and compares the lines. Run with
// --add-opens java.base/java.nio=ALL-UNNAMED so the mark can be read.
public final class NioOracle {
    private static final Map<String, Object> slots = new LinkedHashMap<>();
    private static Field markField;

    private static final class CorpusError extends Error {
        CorpusError(String message) { super(message); }
    }

    public static void main(String[] args) throws Exception {
        markField = Buffer.class.getDeclaredField("mark");
        markField.setAccessible(true);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
        PrintStream out = new PrintStream(new BufferedOutputStream(new FileOutputStream(FileDescriptor.out), 1 << 16), false, "UTF-8");
        String line;
        int n = 0;
        while ((line = in.readLine()) != null) {
            if (line.isEmpty()) continue;
            out.print(n++);
            out.print(' ');
            out.print(run(line.split(" ")));
            out.print('\n');
        }
        out.flush();
    }

    private static Object slot(String name) {
        if (!slots.containsKey(name)) throw new CorpusError("no slot " + name);
        return slots.get(name);
    }

    private static int i(String s) { return Integer.parseInt(s); }

    private static float fbits(String s) { return Float.intBitsToFloat((int) Long.parseLong(s, 16)); }

    private static String self(Object returned, Object target) { return returned == target ? "this" : "other"; }

    private static String f(float x) { return Float.isNaN(x) ? "f:NaN" : String.format("f:%08x", Float.floatToRawIntBits(x)); }

    private static String hex2(int b) { return String.format("%02x", b & 0xff); }

    private static String identity(Object a) {
        for (Map.Entry<String, Object> e : slots.entrySet()) if (e.getValue() == a) return "same:" + e.getKey();
        return "new";
    }

    private static String run(String[] t) {
        String op = t[0];
        String target = t.length > 1 ? t[1] : null;
        String result;
        String extra = "";
        try {
            switch (op) {
                case "nativeOrder": result = ByteOrder.nativeOrder().toString(); target = null; break;
                case "bytes": case "shorts": case "ints": case "floats": case "nullarr":
                    slots.put(t[1], parseArray(op, t.length > 2 ? t[2] : "-"));
                    return "ok | arr=" + dumpArr(t[1]);
                case "dumpArr": return "ok | arr=" + dumpArr(t[1]);
                case "allocate": slots.put(t[1], ByteBuffer.allocate(i(t[2]))); result = "ok"; break;
                case "allocateDirect": slots.put(t[1], ByteBuffer.allocateDirect(i(t[2]))); result = "ok"; break;
                case "wrap": slots.put(t[1], ByteBuffer.wrap((byte[]) slot(t[2]))); result = "ok"; break;
                case "wrap3": slots.put(t[1], ByteBuffer.wrap((byte[]) slot(t[2]), i(t[3]), i(t[4]))); result = "ok"; break;
                case "sallocate": slots.put(t[1], ShortBuffer.allocate(i(t[2]))); result = "ok"; break;
                case "swrap": slots.put(t[1], ShortBuffer.wrap((short[]) slot(t[2]))); result = "ok"; break;
                case "swrap3": slots.put(t[1], ShortBuffer.wrap((short[]) slot(t[2]), i(t[3]), i(t[4]))); result = "ok"; break;
                case "iallocate": slots.put(t[1], IntBuffer.allocate(i(t[2]))); result = "ok"; break;
                case "iwrap": slots.put(t[1], IntBuffer.wrap((int[]) slot(t[2]))); result = "ok"; break;
                case "iwrap3": slots.put(t[1], IntBuffer.wrap((int[]) slot(t[2]), i(t[3]), i(t[4]))); result = "ok"; break;
                case "fallocate": slots.put(t[1], FloatBuffer.allocate(i(t[2]))); result = "ok"; break;
                case "fwrap": slots.put(t[1], FloatBuffer.wrap((float[]) slot(t[2]))); result = "ok"; break;
                case "fwrap3": slots.put(t[1], FloatBuffer.wrap((float[]) slot(t[2]), i(t[3]), i(t[4]))); result = "ok"; break;
                case "asShort": slots.put(t[1], ((ByteBuffer) slot(t[2])).asShortBuffer()); result = "ok"; break;
                case "asInt": slots.put(t[1], ((ByteBuffer) slot(t[2])).asIntBuffer()); result = "ok"; break;
                case "asFloat": slots.put(t[1], ((ByteBuffer) slot(t[2])).asFloatBuffer()); result = "ok"; break;
                case "asRO": slots.put(t[1], ((FloatBuffer) slot(t[2])).asReadOnlyBuffer()); result = "ok"; break;
                case "dump": result = "ok"; break;
                case "glbytes": result = glBytes((Buffer) slot(t[1])); break;
                default: {
                    Object o = slot(t[1]);
                    String common = common(op, (Buffer) o, t);
                    if (common != null) {
                        result = common;
                        if (op.equals("array")) extra = " arr=" + dumpArr(t[2]);
                    } else if (o instanceof ByteBuffer) {
                        result = byteOp(op, (ByteBuffer) o, t);
                    } else if (o instanceof ShortBuffer) {
                        result = shortOp(op, (ShortBuffer) o, t);
                    } else if (o instanceof IntBuffer) {
                        result = intOp(op, (IntBuffer) o, t);
                    } else if (o instanceof FloatBuffer) {
                        result = floatOp(op, (FloatBuffer) o, t);
                    } else {
                        throw new CorpusError("bad slot " + t[1]);
                    }
                    if (op.startsWith("getArr") || op.startsWith("putArr")) extra = " arr=" + dumpArr(t[2]);
                    if (op.equals("putBuf")) extra = " src=" + state(t[2]);
                }
            }
        } catch (CorpusError e) {
            throw e;
        } catch (Throwable e) {
            result = "!" + e.getClass().getSimpleName();
            if (op.startsWith("getArr") || op.startsWith("putArr") || op.equals("array")) extra = " arr=" + dumpArr(t[2]);
            if (op.equals("putBuf")) extra = " src=" + state(t[2]);
        }
        return result + " | " + (target == null ? "-" : state(target)) + extra;
    }

    private static String common(String op, Buffer b, String[] t) {
        switch (op) {
            case "capacity": return "" + b.capacity();
            case "position": return "" + b.position();
            case "setPosition": return self(b.position(i(t[2])), b);
            case "limit": return "" + b.limit();
            case "setLimit": return self(b.limit(i(t[2])), b);
            case "mark": return self(b.mark(), b);
            case "reset": return self(b.reset(), b);
            case "clear": return self(b.clear(), b);
            case "flip": return self(b.flip(), b);
            case "rewind": return self(b.rewind(), b);
            case "remaining": return "" + b.remaining();
            case "hasRemaining": return b.hasRemaining() ? "T" : "F";
            case "isDirect": return b.isDirect() ? "T" : "F";
            case "isReadOnly": return b.isReadOnly() ? "T" : "F";
            case "hasArray": return b.hasArray() ? "T" : "F";
            case "arrayOffset": return "" + b.arrayOffset();
            case "array": {
                Object a = b.array();
                String id = identity(a);
                slots.put(t[2], a);
                return id;
            }
            case "order":
                if (b instanceof ByteBuffer) return ((ByteBuffer) b).order().toString();
                if (b instanceof ShortBuffer) return ((ShortBuffer) b).order().toString();
                if (b instanceof IntBuffer) return ((IntBuffer) b).order().toString();
                return ((FloatBuffer) b).order().toString();
            default: return null;
        }
    }

    private static String byteOp(String op, ByteBuffer b, String[] t) {
        switch (op) {
            case "setOrder": return self(b.order(t[2].equals("BIG") ? ByteOrder.BIG_ENDIAN : t[2].equals("LITTLE") ? ByteOrder.LITTLE_ENDIAN : null), b);
            case "get": return "" + b.get();
            case "getAt": return "" + b.get(i(t[2]));
            case "getArr": return self(b.get((byte[]) slot(t[2])), b);
            case "getArr3": return self(b.get((byte[]) slot(t[2]), i(t[3]), i(t[4])), b);
            case "put": return self(b.put((byte) i(t[2])), b);
            case "putAt": return self(b.put(i(t[2]), (byte) i(t[3])), b);
            case "putArr": return self(b.put((byte[]) slot(t[2])), b);
            case "putArr3": return self(b.put((byte[]) slot(t[2]), i(t[3]), i(t[4])), b);
            case "putBuf": return self(b.put((ByteBuffer) slot(t[2])), b);
            case "getShort": return "" + b.getShort();
            case "getShortAt": return "" + b.getShort(i(t[2]));
            case "getInt": return "" + b.getInt();
            case "getIntAt": return "" + b.getInt(i(t[2]));
            case "getFloat": return f(b.getFloat());
            case "getFloatAt": return f(b.getFloat(i(t[2])));
            case "putShort": return self(b.putShort((short) i(t[2])), b);
            case "putShortAt": return self(b.putShort(i(t[2]), (short) i(t[3])), b);
            case "putInt": return self(b.putInt(i(t[2])), b);
            case "putIntAt": return self(b.putInt(i(t[2]), i(t[3])), b);
            case "putFloat": return self(b.putFloat(fbits(t[2])), b);
            case "putFloatAt": return self(b.putFloat(i(t[2]), fbits(t[3])), b);
            default: throw new CorpusError("bad byte op " + op);
        }
    }

    private static String shortOp(String op, ShortBuffer b, String[] t) {
        switch (op) {
            case "get": return "" + b.get();
            case "getAt": return "" + b.get(i(t[2]));
            case "put": return self(b.put((short) i(t[2])), b);
            case "putAt": return self(b.put(i(t[2]), (short) i(t[3])), b);
            case "putArr": return self(b.put((short[]) slot(t[2])), b);
            case "putArr3": return self(b.put((short[]) slot(t[2]), i(t[3]), i(t[4])), b);
            case "putBuf": return self(b.put((ShortBuffer) slot(t[2])), b);
            default: throw new CorpusError("bad short op " + op);
        }
    }

    private static String intOp(String op, IntBuffer b, String[] t) {
        switch (op) {
            case "get": return "" + b.get();
            case "getAt": return "" + b.get(i(t[2]));
            case "put": return self(b.put(i(t[2])), b);
            case "putAt": return self(b.put(i(t[2]), i(t[3])), b);
            case "putArr": return self(b.put((int[]) slot(t[2])), b);
            case "putArr3": return self(b.put((int[]) slot(t[2]), i(t[3]), i(t[4])), b);
            case "putBuf": return self(b.put((IntBuffer) slot(t[2])), b);
            default: throw new CorpusError("bad int op " + op);
        }
    }

    private static String floatOp(String op, FloatBuffer b, String[] t) {
        switch (op) {
            case "get": return f(b.get());
            case "getAt": return f(b.get(i(t[2])));
            case "put": return self(b.put(fbits(t[2])), b);
            case "putAt": return self(b.put(i(t[2]), fbits(t[3])), b);
            case "putArr": return self(b.put((float[]) slot(t[2])), b);
            case "putArr3": return self(b.put((float[]) slot(t[2]), i(t[3]), i(t[4])), b);
            case "putBuf": return self(b.put((FloatBuffer) slot(t[2])), b);
            default: throw new CorpusError("bad float op " + op);
        }
    }

    private static Object parseArray(String kind, String body) {
        if (kind.equals("nullarr")) return null;
        String[] parts = body.equals("-") ? new String[0] : body.split(",");
        switch (kind) {
            case "bytes": { byte[] a = new byte[parts.length]; for (int k = 0; k < a.length; k++) a[k] = (byte) Integer.parseInt(parts[k], 16); return a; }
            case "shorts": { short[] a = new short[parts.length]; for (int k = 0; k < a.length; k++) a[k] = (short) Integer.parseInt(parts[k]); return a; }
            case "ints": { int[] a = new int[parts.length]; for (int k = 0; k < a.length; k++) a[k] = Integer.parseInt(parts[k]); return a; }
            default: { float[] a = new float[parts.length]; for (int k = 0; k < a.length; k++) a[k] = fbits(parts[k]); return a; }
        }
    }

    private static String dumpArr(String name) {
        if (!slots.containsKey(name)) return "none";
        Object a = slots.get(name);
        StringBuilder sb = new StringBuilder();
        if (a == null) return "null";
        if (a instanceof byte[]) { sb.append("b:"); for (byte x : (byte[]) a) sb.append(hex2(x)); }
        else if (a instanceof short[]) { sb.append("s:"); short[] s = (short[]) a; for (int k = 0; k < s.length; k++) sb.append(k == 0 ? "" : ",").append(s[k]); }
        else if (a instanceof int[]) { sb.append("i:"); int[] s = (int[]) a; for (int k = 0; k < s.length; k++) sb.append(k == 0 ? "" : ",").append(s[k]); }
        else { sb.append("f:"); float[] s = (float[]) a; for (int k = 0; k < s.length; k++) sb.append(k == 0 ? "" : ",").append(String.format("%08x", Float.floatToRawIntBits(s[k]))); }
        return sb.toString();
    }

    private static String kind(Buffer b) {
        if (b instanceof ByteBuffer) return "byte";
        if (b instanceof ShortBuffer) return "short";
        if (b instanceof IntBuffer) return "int";
        return "float";
    }

    private static ByteOrder orderOf(Buffer b) {
        if (b instanceof ByteBuffer) return ((ByteBuffer) b).order();
        if (b instanceof ShortBuffer) return ((ShortBuffer) b).order();
        if (b instanceof IntBuffer) return ((IntBuffer) b).order();
        return ((FloatBuffer) b).order();
    }

    // element i as raw bits; the caller keeps i < limit
    private static long element(Buffer b, int k) {
        if (b instanceof ByteBuffer) return ((ByteBuffer) b).get(k) & 0xff;
        if (b instanceof ShortBuffer) return ((ShortBuffer) b).get(k) & 0xffff;
        if (b instanceof IntBuffer) return ((IntBuffer) b).get(k) & 0xffffffffL;
        return Float.floatToRawIntBits(((FloatBuffer) b).get(k)) & 0xffffffffL;
    }

    private static int size(Buffer b) {
        if (b instanceof ByteBuffer) return 1;
        if (b instanceof ShortBuffer) return 2;
        return 4;
    }

    private static String state(String name) {
        if (!slots.containsKey(name)) return name + " none";
        Object o = slots.get(name);
        if (o == null) return name + " null";
        if (!(o instanceof Buffer)) return name + " array";
        Buffer b = (Buffer) o;
        int mark;
        try { mark = markField.getInt(b); } catch (IllegalAccessException e) { throw new CorpusError(e.toString()); }
        StringBuilder sb = new StringBuilder();
        sb.append(name).append(' ').append(kind(b)).append(" p=").append(b.position()).append(" l=").append(b.limit())
            .append(" c=").append(b.capacity()).append(" m=").append(mark).append(" o=").append(orderOf(b) == ByteOrder.BIG_ENDIAN ? 'B' : 'L')
            .append(" d=").append(b.isDirect() ? 1 : 0).append(" r=").append(b.isReadOnly() ? 1 : 0).append(" [");
        int lim = b.limit();
        b.limit(b.capacity());
        int digits = size(b) * 2;
        for (int k = 0; k < b.capacity(); k++) {
            if (k > 0 && digits > 2) sb.append(',');
            sb.append(String.format("%0" + digits + "x", element(b, k)));
        }
        b.limit(lim);
        return sb.append(']').toString();
    }

    // [position, limit) with every element encoded in the buffer's order: the bytes GL reads
    private static String glBytes(Buffer b) {
        StringBuilder sb = new StringBuilder("g:");
        boolean big = orderOf(b) == ByteOrder.BIG_ENDIAN;
        int n = size(b);
        for (int k = b.position(); k < b.limit(); k++) {
            long v = element(b, k);
            for (int j = 0; j < n; j++) {
                int shift = big ? (n - 1 - j) * 8 : j * 8;
                sb.append(hex2((int) (v >>> shift)));
            }
        }
        return sb.toString();
    }
}
