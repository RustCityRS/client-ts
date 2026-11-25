import java.nio.*;
import java.util.*;
import javax.media.opengl.GL;

/** Bounds and lifetime of the memory the compatibility driver reads from client arrays. */
final class NativeInput {
    private static final int ARRAY = 34962, ELEMENT = 34963, VERTEX = 32884, NORMAL = 32885, COLOUR = 32886,
                             TEX = 32888;
    static final class Store {
        int size;
        byte[] data;
        final BitSet initialized = new BitSet();
    }

    private record Attribute(int kind, int unit) {}

    private record Pointer(Buffer host, Store gpu, long offset, int end, int stride) {
        void check(long index) {
            long size = host != null ? remaining(host) : gpu.size;
            long last = Math.addExact(Math.addExact(offset, end), Math.multiplyExact(index, stride));
            if (last > size)
                throw bad("enabled client array needs " + last + " bytes, only " + size + " available");
        }
    }
    private final Map<Integer, Store> storage;
    private final Map<Attribute, Pointer> pointers = new HashMap<>();
    private final Set<Attribute> enabled = new HashSet<>();
    private int unit = 33984;
    private boolean immediate;

    NativeInput(Map<Integer, Store> shared) {
        storage = shared;
    }

    Map<Integer, Store> storage() {
        return storage;
    }

    static IllegalArgumentException bad(String s) {
        return ReplayTrace.bad(s);
    }

    static int nonnegative(int n) {
        if (n < 0)
            throw bad("negative native count");
        return n;
    }

    static int component(int type) {
        return switch (type) {
            case 5120, 5121 -> 1;
            case 5122, 5123 -> 2;
            case 5124, 5125, 5126 -> 4;
            case 5130 -> 8;
            default -> throw bad("unsupported component type " + type);
        };
    }

    static long remaining(Buffer b) {
        return (long) b.remaining() * (b instanceof ByteBuffer ? 1 : b instanceof ShortBuffer ? 2 : 4);
    }

    static ByteBuffer bytes(Buffer b) {
        if (b instanceof ByteBuffer v)
            return v.slice().order(ByteOrder.nativeOrder());
        ByteBuffer v = ByteBuffer.allocate(Math.toIntExact(remaining(b))).order(ByteOrder.nativeOrder());
        if (b instanceof IntBuffer a)
            v.asIntBuffer().put(a.duplicate());
        else if (b instanceof FloatBuffer a)
            v.asFloatBuffer().put(a.duplicate());
        else if (b instanceof ShortBuffer a)
            v.asShortBuffer().put(a.duplicate());
        else
            throw bad("unsupported native buffer");
        return v;
    }

    static int integer(GL gl, int pname) {
        int[] p = {0};
        gl.glGetIntegerv(pname, p, 0);
        return p[0];
    }

    private int bound(GL gl, int target) {
        return integer(gl, switch (target) {
            case ARRAY -> 34964;
            case ELEMENT -> 34965;
            default -> throw bad("unsupported buffer target " + target);
        });
    }

    private Attribute key(int kind) {
        if (kind != VERTEX && kind != NORMAL && kind != COLOUR && kind != TEX)
            throw bad("unsupported client array " + kind);
        return new Attribute(kind, kind == TEX ? unit : 0);
    }

    private void pointer(GL gl, int kind, int end, int stride, Object memory) {
        int bound = bound(gl, ARRAY);
        Buffer host = null;
        Store gpu = null;
        long offset = 0;
        if (memory instanceof Buffer b) {
            if (!b.isDirect() || bound != 0)
                throw bad("client array requires direct memory and no array VBO");
            host = b;
        } else if (memory instanceof Long address) {
            if (bound == 0)
                throw bad("array offset without a VBO");
            gpu = storage.computeIfAbsent(bound, k -> new Store());
            offset = address;
        } else
            throw bad("missing client array");
        // The driver retains this address beyond the Java call. A context owns
        // independent pointers including one texture coord pointer per client unit.
        pointers.put(key(kind), new Pointer(host, gpu, offset, end, stride));
    }

    private void interleaved(GL gl, Object[] a) {
        int[][] layouts = {{0, 0, 0, 8}, {0, 0, 0, 12}, {0, 4, 0, 8}, {0, 4, 0, 12}, {0, 12, 0, 12},
                {0, 0, 12, 12}, {0, 16, 12, 12}, {8, 0, 0, 12}, {16, 0, 0, 16}, {8, 4, 0, 12}, {8, 12, 0, 12},
                {8, 0, 12, 12}, {8, 16, 12, 12}, {16, 16, 12, 16}};
        int fmt = (int) a[0] - 10784;
        if (fmt < 0 || fmt >= layouts.length)
            throw bad("unsupported interleaved array format");
        int[] sizes = layouts[fmt], kinds = {TEX, COLOUR, NORMAL, VERTEX};
        int stride = nonnegative((int) a[1]);
        if (stride == 0)
            stride = Arrays.stream(sizes).sum();
        int end = 0;
        for (int i = 0; i < kinds.length; i++) {
            Attribute key = key(kinds[i]);
            if (sizes[i] == 0) {
                enabled.remove(key);
                continue;
            }
            enabled.add(key);
            end += sizes[i];
            pointer(gl, kinds[i], end, stride, a[2]);
        }
    }

    private void upload(GL gl, Object[] a, boolean sub) {
        int target = (int) a[0], id = bound(gl, target);
        if (id == 0)
            throw bad("buffer data without a binding");
        int offset = sub ? nonnegative((int) a[1]) : 0, size = nonnegative((int) a[sub ? 2 : 1]);
        if (size > 268435456)
            throw bad("buffer larger than 256 MiB");
        Buffer source = (Buffer) a[sub ? 3 : 2];
        if (source == null && sub && size != 0)
            throw bad("null subdata");
        if (source != null && remaining(source) < size)
            throw bad("short buffer data");
        Store store = storage.computeIfAbsent(id, k -> new Store());
        if (!sub) {
            store.size = size;
            store.data = null;
            store.initialized.clear();
        }
        if ((long) offset + size > store.size)
            throw bad("subdata exceeds allocated buffer");
        if (source != null) {
            if (store.data == null)
                store.data = new byte[store.size];
            bytes(source).get(store.data, offset, size);
            store.initialized.set(offset, offset + size);
        }
    }

    private void elements(GL gl, Object[] a) {
        int n = nonnegative((int) a[1]), type = (int) a[2];
        if (type != 5121 && type != 5123 && type != 5125)
            throw bad("invalid element index type");
        int size = Math.multiplyExact(n, component(type));
        int bound = bound(gl, ELEMENT);
        ByteBuffer indices;
        if (a[3] instanceof Buffer source) {
            if (bound != 0 || remaining(source) < size)
                throw bad("short or VBO-bound client index buffer");
            indices = bytes(source);
        } else if (a[3] instanceof Long address) {
            Store store = storage.get(bound);
            if (bound == 0 || store == null || address > store.size || (long) size > store.size - address)
                throw bad("index range exceeds element VBO");
            if (size == 0)
                return;
            int offset = Math.toIntExact(address);
            if (store.data == null || store.initialized.nextClearBit(offset) < offset + size)
                throw bad("uninitialized index bytes");
            indices = ByteBuffer.wrap(store.data, offset, size).slice().order(ByteOrder.nativeOrder());
        } else
            throw bad("missing element index buffer");
        if (n == 0)
            return;
        long highest = 0;
        for (int i = 0; i < n; i++) {
            long index = switch (type) {
                case 5121 -> indices.get() & 255;
                case 5123 -> indices.getShort() & 65535;
                default -> Integer.toUnsignedLong(indices.getInt());
            };
            highest = Math.max(highest, index);
        }
        for (Attribute k : enabled) {
            Pointer p = pointers.get(k);
            if (p == null)
                throw bad("enabled array has no pointer " + k);
            p.check(highest);
        }
    }

    private static void pixelInput(GL gl, String call, Object[] a) {
        int last = a.length - 1;
        Buffer pixels = (Buffer) a[last];
        if (pixels == null) {
            if (call.equals("glDrawPixels"))
                throw bad("null pixel block");
            return;
        }
        int w, h, d;
        if (call.equals("glDrawPixels")) {
            w = (int) a[0];
            h = (int) a[1];
            d = 1;
        } else {
            w = (int) a[3];
            h = call.equals("glTexImage1D") ? 1 : (int) a[4];
            d = call.equals("glTexImage3D") ? (int) a[5] : 1;
        }
        nonnegative(w);
        nonnegative(h);
        nonnegative(d);
        if (w == 0 || h == 0 || d == 0)
            return;
        int type = (int) a[last - 1], format = (int) a[last - 2];
        int channels = switch (format) {
            case 6400, 6401, 6402, 6403, 6404, 6405, 6406, 6409 -> 1;
            case 6410 -> 2;
            case 6407, 32992 -> 3;
            case 6408, 32993 -> 4;
            default -> throw bad("unsupported unpack format " + format);
        };
        int pixel = channels * component(type);
        int rowLength = integer(gl, 3314), skipRows = integer(gl, 3315), skipPixels = integer(gl, 3316),
            alignment = integer(gl, 3317);
        int imageHeight = call.equals("glTexImage3D") ? integer(gl, 32878) : 0,
            skipImages = call.equals("glTexImage3D") ? integer(gl, 32877) : 0;
        if (alignment != 1 && alignment != 2 && alignment != 4 && alignment != 8)
            throw bad("invalid unpack alignment");
        long pitch = Math.multiplyExact((long) (rowLength == 0 ? w : rowLength), pixel);
        pitch = (pitch + alignment - 1) & -(long) alignment;
        long rows = Math.addExact((long) skipRows + h - 1,
                Math.multiplyExact((long) skipImages + d - 1, imageHeight == 0 ? h : imageHeight));
        long end =
                Math.addExact(Math.multiplyExact(rows, pitch), Math.multiplyExact((long) skipPixels + w, pixel));
        if (end > remaining(pixels))
            throw bad("pixel transfer needs " + end + " bytes, supplied " + remaining(pixels));
    }

    void before(GL gl, String call, Object[] a) {
        switch (call) {
            case "glBindBufferARB" -> {
                if ((int) a[0] != ARRAY && (int) a[0] != ELEMENT)
                    throw bad("unsupported buffer binding target " + a[0]);
            }
            case "glBegin" -> {
                if (immediate)
                    throw bad("nested glBegin");
                immediate = true;
                return;
            }
            case "glEnd" -> {
                if (!immediate)
                    throw bad("glEnd outside primitive");
                immediate = false;
                return;
            }
        }
        if (immediate) {
            if (!Set.of("glColor3ub", "glColor4ub", "glColor4f", "glColor4fv", "glTexCoord2f", "glMultiTexCoord2f",
                            "glVertex2f")
                            .contains(call))
                throw bad("unsupported call inside glBegin: " + call);
            return;
        }
        switch (call) {
            case "glBufferDataARB", "glBufferSubDataARB" -> upload(gl, a, call.equals("glBufferSubDataARB"));
            case "glDrawElements" -> elements(gl, a);
            case "glTexImage1D", "glTexImage2D", "glTexImage3D", "glDrawPixels" -> pixelInput(gl, call, a);
            case "glClientActiveTexture" -> {
                int next = (int) a[0];
                if (next < 33984 || next >= 33984 + integer(gl, 34018))
                    throw bad("invalid client texture unit " + next);
                unit = next;
            }
            case "glEnableClientState" -> enabled.add(key((int) a[0]));
            case "glDisableClientState" -> enabled.remove(key((int) a[0]));
            case "glInterleavedArrays" -> interleaved(gl, a);
            case "glVertexPointer", "glTexCoordPointer", "glColorPointer", "glNormalPointer" -> {
                int kind = switch (call) {
                    case "glVertexPointer" -> VERTEX;
                    case "glTexCoordPointer" -> TEX;
                    case "glColorPointer" -> COLOUR;
                    default -> NORMAL;
                };
                int i = kind == NORMAL ? 0 : 1, components = kind == NORMAL ? 3 : (int) a[0];
                if (components < (kind == VERTEX ? 2 : kind == COLOUR ? 3 : 1) || components > 4)
                    throw bad("invalid array components");
                int type = (int) a[i];
                if ((kind == VERTEX || kind == TEX) && !Set.of(5122, 5124, 5126, 5130).contains(type))
                    throw bad("invalid vertex or texcoord type");
                if (kind == NORMAL && !Set.of(5120, 5122, 5124, 5126, 5130).contains(type))
                    throw bad("invalid normal type");
                int end = components * component(type), stride = nonnegative((int) a[i + 1]);
                pointer(gl, kind, end, stride == 0 ? end : stride, a[i + 2]);
            }
            case "glDeleteBuffersARB" -> {
                int[] ids = (int[]) a[1];
                int offset = (int) a[2];
                for (int i = 0; i < (int) a[0]; i++)
                    storage.remove(ids[offset + i]);
            }
            case "glProgramStringARB" -> {
                String program = (String) a[3];
                if (program == null
                        || nonnegative((int) a[2])
                                > program.getBytes(java.nio.charset.StandardCharsets.US_ASCII).length
                        || !java.nio.charset.StandardCharsets.US_ASCII.newEncoder().canEncode(program))
                    throw bad("unsupported native program string");
            }
            case "glGetIntegerv" -> {
                if (!Set.of(3073, 3074, 3122, 3312, 3313, 3314, 3315, 3316, 3317, 3328, 3329, 3330, 3331, 3332,
                                3333, 3379, 34018, 34379, 34929, 34930)
                                .contains((int) a[0]))
                    throw bad("unsupported native integer query " + a[0]);
            }
            case "glGetFloatv" -> {
                if ((int) a[0] != 33063 && (int) a[0] != 2899)
                    throw bad("unsupported native float query " + a[0]);
            }
        }
    }
}
