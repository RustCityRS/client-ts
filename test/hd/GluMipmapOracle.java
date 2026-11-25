import com.sun.opengl.impl.mipmap.Extract;
import com.sun.opengl.impl.mipmap.Extract1010102;
import com.sun.opengl.impl.mipmap.Extract1555rev;
import com.sun.opengl.impl.mipmap.Extract2101010rev;
import com.sun.opengl.impl.mipmap.Extract233rev;
import com.sun.opengl.impl.mipmap.Extract332;
import com.sun.opengl.impl.mipmap.Extract4444;
import com.sun.opengl.impl.mipmap.Extract4444rev;
import com.sun.opengl.impl.mipmap.Extract5551;
import com.sun.opengl.impl.mipmap.Extract565;
import com.sun.opengl.impl.mipmap.Extract565rev;
import com.sun.opengl.impl.mipmap.Extract8888;
import com.sun.opengl.impl.mipmap.Extract8888rev;
import com.sun.opengl.impl.mipmap.HalveImage;
import com.sun.opengl.impl.mipmap.Image;
import com.sun.opengl.impl.mipmap.Mipmap;
import com.sun.opengl.impl.mipmap.PixelStorageModes;
import com.sun.opengl.impl.mipmap.ScaleInternal;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.nio.Buffer;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.IntBuffer;
import java.nio.ShortBuffer;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import javax.media.opengl.GL;
import javax.media.opengl.GLContext;
import javax.media.opengl.GLException;
import javax.media.opengl.glu.GLU;

// Runs the shipped jogl.jar GLU mipmap path (javax.media.opengl.glu.GLU.gluBuild2DMipmaps and
// com.sun.opengl.impl.mipmap.Mipmap.gluBuild2DMipmaps) against a recording javax.media.opengl.GL proxy.
// No native code is loaded: the shrunk jogl.jar's GLU, Mipmap, BuildMipmap, HalveImage, ScaleInternal, Image,
// Type_Widget and Extract* classes are pure Java. GLU finds its GL through GLContext.getCurrent(), so a FakeContext
// subclass installs the proxy as the current context (GLContext.setCurrent is protected static and a plain static
// field in the shipped class). The "mipmap" entry calls Mipmap.gluBuild2DMipmaps directly to reach its Object-data
// arms (byte[], short[], int[], float[]). The "fill" entry calls Image.fill_image directly (BuildMipmap only calls it
// for GL_BITMAP) with the proxy's unpack modes (Mipmap.retrieveStoreModes) and a native-order direct ShortBuffer of
// `cap` bytes, and prints that buffer whole. The "extract" entry runs one Extract (chosen by `type`) directly on the
// data ByteBuffer: extract, then (position reset to `pos`) shove of four given floats at an index, printing the
// extracted components (float bits), the buffer state and every byte. The "halve" and "scale" entries call
// HalveImage.halveImage and ScaleInternal.scale_internal (the GL_BITMAP path's routines, whose only caller hands them
// 1-component or all-0/all-0xFFFF data) directly on the data ShortBuffer, with a native-order direct ShortBuffer of
// `cap` bytes as output, and print that buffer whole.
// Run without -ea, as the client JVM is: the mipmap classes' assert statements stay disabled.
//
// Input, one case per line, space-separated key=value tokens:
//   id entry(glu|noctx|mipmap|fill|extract|halve|scale) target ifmt w h fmt type data pos hex ver max store fault cap index x
//   data: bbheap bbdirect sbheap sbdirect ibheap fbheap (buffers, positioned at pos; sbdirect is a native-order direct
//     view) bytes shorts ints floats (arrays) null object
//   hex: the payload bytes ('-' for none); multi-byte elements are read big-endian from it
//   ver: GL_VERSION as hex UTF-16 code units, or null; max: GL_MAX_TEXTURE_SIZE and the proxy-texture limit
//   store: the 12 pixel-store values in STORE order; fault: '-' or <glMethod>#<nth call>#<gle|rte>
//   cap, index: the fill/halve/scale entries' output capacity in bytes; fill's index_format (0/1)
//   x: the extract entry's <be|le>,<swap 0|1>,<shove index>,<4 shove floats as raw int bits in hex>; the halve
//     entry's <components>; the scale entry's <components>,<widthout>,<heightout> (w and h are the input size)
// Output per case: "case <id>", one line per GL call, "result <int>" or "throw <class>", "data <pos> <lim> <mark>"
// for buffer data, "image <pos> <lim> <hex of every element>" for the fill/halve/scale entries, "store <12 values>". A pixel buffer
// prints as B:<byte|short|int|float>:<pos>:<lim>:<cap>:<direct|heap>:<hex of each element of [pos, lim) in the
// buffer's order>, the bytes GL reads. The proxy is stateful like a GL: glPixelStorei changes what glGetIntegerv
// returns, and glGetTexLevelParameteriv(GL_TEXTURE_WIDTH) answers the last proxy image: its width when
// (width << level) and (height << level) are both <= max, else 0.
public class GluMipmapOracle {
    static final int[] STORE = {3312, 3313, 3314, 3315, 3316, 3317, 3328, 3329, 3330, 3331, 3332, 3333};

    static final class OracleFailure extends Error {
        OracleFailure(String message) { super(message); }
    }

    static final class FakeContext extends GLContext {
        final GL gl;
        FakeContext(GL gl) { this.gl = gl; }
        public int makeCurrent() { setCurrent(this); return 1; } // CONTEXT_CURRENT (inlined; the shrunk class has no constants)
        public void release() { setCurrent(null); }
        public void destroy() {}
        public GL getGL() { return gl; }
    }

    static final StringBuilder out = new StringBuilder();
    static final Map<Integer, Integer> store = new HashMap<>();
    static final Map<String, Integer> calls = new HashMap<>();
    static int seq, max, proxyTarget, proxyLevel, proxyW, proxyH;
    static String version, faultMethod, faultKind;
    static int faultCall;
    static Field markField;

    static String hex(byte[] bytes) { return HexFormat.of().formatHex(bytes); }

    static String utf16(String s) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < s.length(); i++) b.append(String.format("%04x", (int)s.charAt(i)));
        return b.toString();
    }

    static String fromUtf16(String h) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < h.length(); i += 4) b.append((char)Integer.parseInt(h.substring(i, i + 4), 16));
        return b.toString();
    }

    // The bytes GL reads for elements [from, to): each element encoded in the buffer's own order.
    static String elements(Buffer o, int from, int to) {
        if (o instanceof ByteBuffer b) {
            ByteBuffer d = b.duplicate();
            d.limit(to).position(from);
            byte[] a = new byte[d.remaining()];
            d.get(a);
            return hex(a);
        }
        if (o instanceof ShortBuffer b) {
            ShortBuffer d = b.duplicate();
            d.limit(to).position(from);
            ByteBuffer e = ByteBuffer.allocate(d.remaining() * 2).order(b.order());
            while (d.hasRemaining()) e.putShort(d.get());
            return hex(e.array());
        }
        if (o instanceof IntBuffer b) {
            IntBuffer d = b.duplicate();
            d.limit(to).position(from);
            ByteBuffer e = ByteBuffer.allocate(d.remaining() * 4).order(b.order());
            while (d.hasRemaining()) e.putInt(d.get());
            return hex(e.array());
        }
        if (o instanceof FloatBuffer b) {
            FloatBuffer d = b.duplicate();
            d.limit(to).position(from);
            ByteBuffer e = ByteBuffer.allocate(d.remaining() * 4).order(b.order());
            while (d.hasRemaining()) e.putInt(Float.floatToRawIntBits(d.get()));
            return hex(e.array());
        }
        throw new OracleFailure("buffer kind " + o);
    }

    static String buffer(Object o) {
        if (o == null) return "null";
        if (!(o instanceof Buffer)) throw new OracleFailure("non-buffer reached GL: " + o);
        Buffer b = (Buffer)o;
        String kind = b instanceof ByteBuffer ? "byte" : b instanceof ShortBuffer ? "short" : b instanceof IntBuffer ? "int" : b instanceof FloatBuffer ? "float" : null;
        if (kind == null) throw new OracleFailure("buffer kind " + o);
        return "B:" + kind + ":" + b.position() + ":" + b.limit() + ":" + b.capacity() + ":" + (b.isDirect() ? "direct" : "heap") + ":" + elements(b, b.position(), b.limit());
    }

    static boolean proxy(int target) { return target == 32867 || target == 32868 || target == 34075; }

    static Object handle(String name, Object[] args) {
        int count = calls.merge(name, 1, Integer::sum);
        StringBuilder line = new StringBuilder().append(++seq).append('\t').append(name);
        boolean fault = name.equals(faultMethod) && count == faultCall;
        Object result = null;
        switch (name) {
            case "glGetString" -> {
                line.append('\t').append(args[0]);
                if (!fault) {
                    if ((int)args[0] != 7938) throw new OracleFailure("glGetString " + args[0]);
                    result = version;
                    line.append("\t=> ").append(version == null ? "null" : "S:" + utf16(version));
                }
            }
            case "glGetIntegerv" -> {
                int pname = (int)args[0];
                int[] params = (int[])args[1];
                int offset = (int)args[2];
                line.append('\t').append(pname).append("\tI").append(params.length).append('@').append(offset);
                if (!fault) {
                    int value;
                    if (pname == 3379) value = max;
                    else if (store.containsKey(pname)) value = store.get(pname);
                    else throw new OracleFailure("glGetIntegerv " + pname);
                    params[offset] = value;
                    line.append("\t=> ").append(value);
                }
            }
            case "glGetTexLevelParameteriv" -> {
                int target = (int)args[0], level = (int)args[1], pname = (int)args[2];
                int[] params = (int[])args[3];
                int offset = (int)args[4];
                line.append('\t').append(target).append('\t').append(level).append('\t').append(pname)
                    .append("\tI").append(params.length).append('@').append(offset);
                if (!fault) {
                    if (pname != 4096) throw new OracleFailure("glGetTexLevelParameteriv " + pname);
                    int value = target == proxyTarget && level == proxyLevel &&
                        (proxyW << level) <= max && (proxyH << level) <= max ? proxyW : 0;
                    params[offset] = value;
                    line.append("\t=> ").append(value);
                }
            }
            case "glTexImage2D" -> {
                for (int i = 0; i < 8; i++) line.append('\t').append(args[i]);
                line.append('\t').append(buffer(args[8]));
                if (!fault && proxy((int)args[0])) {
                    proxyTarget = (int)args[0]; proxyLevel = (int)args[1]; proxyW = (int)args[3]; proxyH = (int)args[4];
                }
            }
            case "glTexImage1D" -> {
                for (int i = 0; i < 7; i++) line.append('\t').append(args[i]);
                line.append('\t').append(buffer(args[7]));
                if (!fault && proxy((int)args[0])) {
                    proxyTarget = (int)args[0]; proxyLevel = (int)args[1]; proxyW = (int)args[3]; proxyH = 1;
                }
            }
            case "glPixelStorei" -> {
                int pname = (int)args[0], param = (int)args[1];
                line.append('\t').append(pname).append('\t').append(param);
                if (!store.containsKey(pname)) throw new OracleFailure("glPixelStorei " + pname);
                if (!fault) store.put(pname, param);
            }
            default -> throw new OracleFailure("unexpected GL call " + name);
        }
        if (fault) line.append("\t!! ").append(faultKind);
        out.append(line).append('\n');
        if (fault) {
            if (faultKind.equals("gle")) throw new GLException("fault");
            throw new RuntimeException("fault");
        }
        return result;
    }

    static Object data(String kind, byte[] bytes, int pos) {
        ByteBuffer be = ByteBuffer.wrap(bytes);
        switch (kind) {
            case "bbheap": { ByteBuffer b = ByteBuffer.wrap(bytes); b.position(pos); return b; }
            case "bbdirect": { ByteBuffer b = ByteBuffer.allocateDirect(bytes.length); b.put(bytes); b.position(pos); return b; }
            case "sbheap": { short[] s = new short[bytes.length / 2]; be.asShortBuffer().get(s); ShortBuffer b = ShortBuffer.wrap(s); b.position(pos); return b; }
            case "sbdirect": { short[] s = new short[bytes.length / 2]; be.asShortBuffer().get(s); ShortBuffer b = ByteBuffer.allocateDirect(s.length * 2).order(ByteOrder.nativeOrder()).asShortBuffer(); b.put(s); b.position(pos); return b; }
            case "ibheap": { int[] s = new int[bytes.length / 4]; be.asIntBuffer().get(s); IntBuffer b = IntBuffer.wrap(s); b.position(pos); return b; }
            case "fbheap": { float[] s = new float[bytes.length / 4]; be.asFloatBuffer().get(s); FloatBuffer b = FloatBuffer.wrap(s); b.position(pos); return b; }
            case "bytes": return bytes;
            case "shorts": { short[] s = new short[bytes.length / 2]; be.asShortBuffer().get(s); return s; }
            case "ints": { int[] s = new int[bytes.length / 4]; be.asIntBuffer().get(s); return s; }
            case "floats": { float[] s = new float[bytes.length / 4]; be.asFloatBuffer().get(s); return s; }
            case "null": return null;
            case "object": return new Object();
            default: throw new OracleFailure("data kind " + kind);
        }
    }

    static Extract extractFor(int type) {
        switch (type) {
            case 32818: return new Extract332();
            case 33634: return new Extract233rev();
            case 33635: return new Extract565();
            case 33636: return new Extract565rev();
            case 32819: return new Extract4444();
            case 33637: return new Extract4444rev();
            case 32820: return new Extract5551();
            case 33638: return new Extract1555rev();
            case 32821: return new Extract8888();
            case 33639: return new Extract8888rev();
            case 32822: return new Extract1010102();
            case 33640: return new Extract2101010rev();
            default: throw new OracleFailure("extract type " + type);
        }
    }

    public static void main(String[] argv) throws Exception {
        markField = Buffer.class.getDeclaredField("mark");
        markField.setAccessible(true);
        InvocationHandler handler = (p, method, args) -> handle(method.getName(), args);
        GL gl = (GL)Proxy.newProxyInstance(GL.class.getClassLoader(), new Class<?>[]{GL.class}, handler);
        FakeContext context = new FakeContext(gl);
        PrintStream stdout = new PrintStream(System.out, false, "UTF-8");
        try (BufferedReader input = new BufferedReader(new InputStreamReader(System.in, "UTF-8"))) {
            for (String line; (line = input.readLine()) != null;) {
                if (line.isEmpty()) continue;
                Map<String, String> c = new HashMap<>();
                for (String token : line.split(" ")) {
                    int eq = token.indexOf('=');
                    c.put(token.substring(0, eq), token.substring(eq + 1));
                }
                out.setLength(0);
                calls.clear();
                seq = 0;
                proxyTarget = proxyLevel = proxyW = proxyH = 0;
                String[] values = c.get("store").split(",");
                for (int i = 0; i < STORE.length; i++) store.put(STORE[i], Integer.parseInt(values[i]));
                version = c.get("ver").equals("null") ? null : fromUtf16(c.get("ver"));
                max = Integer.parseInt(c.get("max"));
                String fault = c.get("fault");
                if (fault.equals("-")) { faultMethod = null; faultCall = 0; faultKind = null; }
                else { String[] f = fault.split("#"); faultMethod = f[0]; faultCall = Integer.parseInt(f[1]); faultKind = f[2]; }
                String hexData = c.get("hex");
                byte[] bytes = hexData.equals("-") ? new byte[0] : HexFormat.of().parseHex(hexData);
                Object data = data(c.get("data"), bytes, Integer.parseInt(c.get("pos")));
                int target = Integer.parseInt(c.get("target")), ifmt = Integer.parseInt(c.get("ifmt"));
                int w = Integer.parseInt(c.get("w")), h = Integer.parseInt(c.get("h"));
                int fmt = Integer.parseInt(c.get("fmt")), type = Integer.parseInt(c.get("type"));
                String entry = c.get("entry");
                int cap = Integer.parseInt(c.get("cap"));
                boolean index = c.get("index").equals("1");
                ShortBuffer[] image = {null};
                ByteBuffer[] probe = {null};
                out.append("case\t").append(c.get("id")).append('\n');
                try {
                    int result = switch (entry) {
                        case "glu" -> { context.makeCurrent(); yield new GLU().gluBuild2DMipmaps(target, ifmt, w, h, fmt, type, (Buffer)data); }
                        case "noctx" -> { context.release(); yield new GLU().gluBuild2DMipmaps(target, ifmt, w, h, fmt, type, (Buffer)data); }
                        case "mipmap" -> { context.release(); yield Mipmap.gluBuild2DMipmaps(gl, target, ifmt, w, h, fmt, type, data); }
                        case "fill" -> {
                            context.release();
                            PixelStorageModes psm = new PixelStorageModes();
                            Mipmap.retrieveStoreModes(gl, psm);
                            image[0] = ByteBuffer.allocateDirect(cap).order(ByteOrder.nativeOrder()).asShortBuffer();
                            if (data != null && !(data instanceof ByteBuffer)) throw new OracleFailure("fill takes a java.nio.ByteBuffer");
                            Image.fill_image(psm, w, h, fmt, type, index, (ByteBuffer)data, image[0]);
                            yield 0;
                        }
                        case "extract" -> {
                            context.release();
                            String[] x = c.get("x").split(",");
                            ByteBuffer b = (ByteBuffer)data;
                            probe[0] = b;
                            b.order(x[0].equals("le") ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN);
                            Extract e = extractFor(type);
                            float[] got = new float[4];
                            try {
                                e.extract(x[1].equals("1"), b, got);
                                out.append("extract\t").append(b.position());
                                for (float g : got) out.append('\t').append(Integer.toHexString(Float.floatToRawIntBits(g)));
                                out.append('\n');
                            } catch (OracleFailure f) {
                                throw f;
                            } catch (Throwable t) {
                                out.append("extract-throw\t").append(t.getClass().getName()).append('\n');
                            }
                            b.position(Integer.parseInt(c.get("pos")));
                            float[] put = new float[4];
                            for (int k = 0; k < 4; k++) put[k] = Float.intBitsToFloat(Integer.parseUnsignedInt(x[3 + k], 16));
                            e.shove(put, Integer.parseInt(x[2]), b);
                            yield 0;
                        }
                        case "halve", "scale" -> {
                            context.release();
                            String[] x = c.get("x").split(",");
                            if (!(data instanceof ShortBuffer)) throw new OracleFailure(entry + " takes a java.nio.ShortBuffer");
                            image[0] = ByteBuffer.allocateDirect(cap).order(ByteOrder.nativeOrder()).asShortBuffer();
                            if (entry.equals("halve")) HalveImage.halveImage(Integer.parseInt(x[0]), w, h, (ShortBuffer)data, image[0]);
                            else ScaleInternal.scale_internal(Integer.parseInt(x[0]), w, h, (ShortBuffer)data, Integer.parseInt(x[1]), Integer.parseInt(x[2]), image[0]);
                            yield 0;
                        }
                        default -> throw new OracleFailure("entry " + entry);
                    };
                    out.append("result\t").append(result).append('\n');
                } catch (OracleFailure e) {
                    throw e;
                } catch (Throwable e) {
                    out.append("throw\t").append(e.getClass().getName()).append('\n');
                } finally {
                    context.release();
                }
                if (data instanceof Buffer b) {
                    out.append("data\t").append(b.position()).append('\t').append(b.limit()).append('\t').append(markField.getInt(b)).append('\n');
                }
                if (probe[0] != null) {
                    out.append("bytes\t").append(elements(probe[0], 0, probe[0].capacity())).append('\n');
                }
                if (image[0] != null) {
                    ShortBuffer i = image[0];
                    out.append("image\t").append(i.position()).append('\t').append(i.limit()).append('\t').append(elements(i, 0, i.capacity())).append('\n');
                }
                out.append("store");
                for (int key : STORE) out.append('\t').append(store.get(key));
                out.append('\n');
                stdout.print(out);
            }
        }
        stdout.flush();
    }
}
