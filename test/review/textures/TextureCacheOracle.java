import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.zip.CRC32;

// The real kg (TextureCache) and qi (Texture) over the real cache archives 9 (textures), 26 (texture metadata) and
// 8 (sprites). Only the JS5 disk provider is substituted. Reads one operation per line from stdin and prints one
// result line per operation; textures.test.ts runs the same script through the TS port and compares every line.
// Every pc/kg call passes the constant its call sites in the jar pass (documented in TextureCache.ts).
public class TextureCacheOracle {
    static class Disk extends ud {
        final int archive;
        final db table;
        final RandomAccessFile data, index;

        Disk(Path dir, int id) throws IOException {
            archive = id;
            data = new RandomAccessFile(dir.resolve("main_file_cache.dat2").toFile(), "r");
            index = new RandomAccessFile(dir.resolve("main_file_cache.idx" + id).toFile(), "r");
            try (RandomAccessFile master = new RandomAccessFile(dir.resolve("main_file_cache.idx255").toFile(), "r")) {
                byte[] raw = read(master, 255, id);
                CRC32 crc = new CRC32();
                crc.update(raw);
                table = new db(raw, (int) crc.getValue());
            }
        }
        byte[] read(RandomAccessFile idx, int archiveId, int group) throws IOException {
            idx.seek(group * 6L);
            byte[] bytes = new byte[(idx.readUnsignedByte() << 16) | idx.readUnsignedShort()];
            int sector = (idx.readUnsignedByte() << 16) | idx.readUnsignedShort();
            for (int offset = 0; offset < bytes.length; offset += 512) {
                data.seek(sector * 520L);
                if (data.readUnsignedShort() != group || data.readUnsignedShort() != offset / 512) {
                    throw new IOException("bad sector for " + archiveId + "/" + group);
                }
                sector = (data.readUnsignedByte() << 16) | data.readUnsignedShort();
                if (data.readUnsignedByte() != archiveId) throw new IOException("bad archive");
                data.readFully(bytes, offset, Math.min(512, bytes.length - offset));
            }
            return bytes;
        }
        db b(int guard) { return table; }
        byte[] a(int mode, int group) {
            try { return read(index, archive, group); }
            catch (IOException ex) { throw new UncheckedIOException(ex); }
        }
        int c(int group, int guard) { return 100; }
        void b(int guard, int group) {}
    }

    static Field field(Class<?> owner, String name) throws Exception {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static final IdentityHashMap<Object, Integer> seen = new IdentityHashMap<>();

    // '#'<first-seen index>':'<length>':'<Arrays.hashCode>, or "null".
    static String ints(int[] a) {
        if (a == null) return "null";
        Integer tag = seen.get(a);
        if (tag == null) {
            tag = seen.size();
            seen.put(a, tag);
        }
        return "#" + tag + ":" + a.length + ":" + Arrays.hashCode(a);
    }
    static String bools(boolean[] a) {
        StringBuilder s = new StringBuilder();
        for (boolean b : a) s.append(b ? '1' : '0');
        return s.toString();
    }
    static String bytes(byte[] a) { return a.length + ":" + Arrays.hashCode(a); }
    static String shorts(short[] a) { return a.length + ":" + Arrays.hashCode(a); }

    static String classify(Throwable t) {
        while (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ClassCastException) return "cce";
        if (t instanceof ArithmeticException) return "arith";
        throw new RuntimeException("unexpected exception", t);
    }

    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args[0]);
        Field kgK = field(kg.class, "k");
        Field[] kgBools = { field(kg.class, "h"), field(kg.class, "p"), field(kg.class, "a"), field(kg.class, "E"), field(kg.class, "i") };
        Field[] kgBytes = { field(kg.class, "d"), field(kg.class, "m"), field(kg.class, "g"), field(kg.class, "c") };
        Field kgT = field(kg.class, "t"), kgG = field(kg.class, "G"), kgQ = field(kg.class, "q");
        Field qiO = field(qi.class, "O"), qiN = field(qi.class, "N"), qiQ = field(qi.class, "Q"), qiI = field(qi.class, "I");
        Field qiT = field(qi.class, "T"), qiK = field(qi.class, "K");
        Field nkN = field(nk.class, "N");
        al textures = new al(new Disk(dir, 9), false, true);
        al meta = new al(new Disk(dir, 26), false, true);
        al sprites = new al(new Disk(dir, 8), false, true);
        PrintStream out = new PrintStream(System.out, false, "UTF-8");
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
        kg cache = null;
        String line;
        while ((line = in.readLine()) != null) {
            String[] op = line.split(" ");
            String result;
            try {
                switch (op[0]) {
                    case "new": {
                        cache = new kg(textures, meta, sprites, Integer.parseInt(op[1]), op[2].equals("1"));
                        result = "ok";
                        break;
                    }
                    case "meta": {
                        StringBuilder s = new StringBuilder();
                        for (Field f : kgBools) s.append(bools((boolean[]) f.get(cache))).append('|');
                        for (Field f : kgBytes) s.append(bytes((byte[]) f.get(cache))).append('|');
                        s.append(shorts((short[]) kgT.get(cache))).append('|').append(kgG.getBoolean(cache)).append('|').append(kgQ.getInt(cache));
                        result = s.toString();
                        break;
                    }
                    case "colour": result = Integer.toString(cache.a((byte) -120, Integer.parseInt(op[1]))); break;
                    case "small": result = Boolean.toString(cache.a(Integer.parseInt(op[1]), 0)); break;
                    case "avail": result = Boolean.toString(cache.b(0, Integer.parseInt(op[1]))); break;
                    case "solid": result = Boolean.toString(cache.d(0, Integer.parseInt(op[1]))); break;
                    case "loaded": result = Boolean.toString(cache.a(Integer.parseInt(op[1]), (byte) -95)); break;
                    case "pix": result = ints(cache.c(117, Integer.parseInt(op[1]))); break;
                    case "data": {
                        float brightness = Float.intBitsToFloat(Integer.parseInt(op[2]));
                        result = ints(cache.a(Integer.parseInt(op[1]), brightness, 15964));
                        break;
                    }
                    case "anim": {
                        cache.b(Integer.parseInt(op[1]), (byte) -33);
                        result = "ok";
                        break;
                    }
                    case "low": {
                        cache.a(-85, op[1].equals("1"));
                        result = "ok";
                        break;
                    }
                    case "clear": {
                        cache.a(0);
                        result = "ok";
                        break;
                    }
                    case "foreign": {
                        // A non-qi node in the LRU: GetTexture's and RunAnims' checkcasts must throw.
                        ((vj) kgK.get(cache)).a(Long.parseLong(op[1]), 0, new ei());
                        result = "ok";
                        break;
                    }
                    case "inject": {
                        // A freshly decoded texture under any key, e.g. one past the metadata arrays.
                        qi t = new qi(new gd(textures.a(-809612665, 0, Integer.parseInt(op[1]))));
                        ((vj) kgK.get(cache)).a(Long.parseLong(op[2]), 0, t);
                        result = "ok";
                        break;
                    }
                    case "scroll": {
                        // Overrides a cached texture's scroll speeds (no texture in the cache scrolls along x only).
                        qi t = (qi) ((vj) kgK.get(cache)).a(261775, Long.parseLong(op[1]));
                        qiT.setInt(t, Integer.parseInt(op[2]));
                        qiK.setInt(t, Integer.parseInt(op[3]));
                        result = "ok";
                        break;
                    }
                    case "dump": {
                        // The LRU in hash-table order (vj.a(I) then vj.a(B)), each texture's state, then nk.N.
                        vj table = (vj) kgK.get(cache);
                        StringBuilder s = new StringBuilder();
                        for (jf node = table.a(3); node != null; node = table.a((byte) 88)) {
                            if (!(node instanceof qi)) {
                                s.append(node.k).append(":foreign;");
                                continue;
                            }
                            qi t = (qi) node;
                            s.append(t.k).append(':').append(t.P ? 1 : 0).append(':')
                                .append(Float.floatToIntBits(qiN.getFloat(t))).append(':')
                                .append(qiQ.getBoolean(t) ? 1 : 0).append(qiI.getBoolean(t) ? 1 : 0).append(':')
                                .append(qiT.getInt(t)).append(',').append(qiK.getInt(t)).append(':')
                                .append(ints((int[]) qiO.get(t))).append(';');
                        }
                        s.append("N=").append(ints((int[]) nkN.get(null)));
                        result = s.toString();
                        break;
                    }
                    default: throw new IllegalArgumentException(line);
                }
            } catch (RuntimeException ex) {
                if (ex instanceof IllegalArgumentException) throw ex;
                result = "!" + classify(ex);
            }
            out.println(result);
        }
        out.flush();
    }
}
