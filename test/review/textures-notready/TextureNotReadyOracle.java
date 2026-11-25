import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintStream;
import java.io.RandomAccessFile;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.Set;
import java.util.zip.CRC32;

// The real kg (TextureCache) and qi (Texture) over cache archives 9 (textures), 26 (texture metadata) and 8 (sprites),
// with chosen groups of archives 8 and 9 withheld by the disk while "hide" is in force, so jd.a(Lpc;BLal;)Z reports
// "not ready". The sprite archive discards packed and unpacked data (al(ud, true, true)), so a sprite read once is
// fetched again on the next readiness check and can be withheld after a texture was already built. Reads one
// operation per line from stdin, prints one result line per operation; textures-notready.test.ts runs the same
// script through the TS port. Every pc/kg call passes the constant its call sites in the jar pass.
// Args: cache dir, comma-separated withheld sprite groups, comma-separated withheld texture groups.
public class TextureNotReadyOracle {
    static class Disk extends ud {
        final int archive;
        final db table;
        final RandomAccessFile data, index;
        final Set<Integer> withheld;
        boolean hiding = false;

        Disk(Path dir, int id, Set<Integer> withheld) throws IOException {
            archive = id;
            this.withheld = withheld;
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
            if (hiding && withheld.contains(group)) return null;
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

    static String classify(Throwable t) {
        while (t instanceof g && ((g) t).a != null) t = ((g) t).a;
        if (t instanceof ArrayIndexOutOfBoundsException) return "aioobe";
        if (t instanceof NullPointerException) return "npe";
        if (t instanceof ClassCastException) return "cce";
        if (t instanceof ArithmeticException) return "arith";
        throw new RuntimeException("unexpected exception", t);
    }

    static Set<Integer> parse(String list) {
        Set<Integer> set = new HashSet<>();
        for (String s : list.split(",")) if (!s.isEmpty()) set.add(Integer.parseInt(s));
        return set;
    }

    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args[0]);
        Field kgK = field(kg.class, "k");
        Field qiO = field(qi.class, "O"), qiN = field(qi.class, "N");
        Field nkN = field(nk.class, "N");
        Disk textureDisk = new Disk(dir, 9, parse(args[2]));
        Disk spriteDisk = new Disk(dir, 8, parse(args[1]));
        al textures = new al(textureDisk, false, true);
        al meta = new al(new Disk(dir, 26, new HashSet<>()), false, true);
        al sprites = new al(spriteDisk, true, true);
        PrintStream out = new PrintStream(System.out, false, "UTF-8");
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, "UTF-8"));
        kg cache = null;
        String line;
        while ((line = in.readLine()) != null) {
            String[] op = line.split(" ");
            String result;
            try {
                switch (op[0]) {
                    case "new": cache = new kg(textures, meta, sprites, Integer.parseInt(op[1]), op[2].equals("1")); result = "ok"; break;
                    case "hide": textureDisk.hiding = spriteDisk.hiding = true; result = "ok"; break;
                    case "reveal": textureDisk.hiding = spriteDisk.hiding = false; result = "ok"; break;
                    case "loaded": result = Boolean.toString(cache.a(Integer.parseInt(op[1]), (byte) -95)); break;
                    case "pix": result = ints(cache.c(117, Integer.parseInt(op[1]))); break;
                    case "data": result = ints(cache.a(Integer.parseInt(op[1]), Float.intBitsToFloat(Integer.parseInt(op[2])), 15964)); break;
                    case "anim": cache.b(Integer.parseInt(op[1]), (byte) -33); result = "ok"; break;
                    case "inject": {
                        // A freshly decoded texture under any key, e.g. one past the metadata arrays.
                        qi t = new qi(new gd(textures.a(-809612665, 0, Integer.parseInt(op[1]))));
                        ((vj) kgK.get(cache)).a(Long.parseLong(op[2]), 0, t);
                        result = "ok";
                        break;
                    }
                    case "dump": {
                        // The LRU in hash-table order (vj.a(I) then vj.a(B)): key, used flag, brightness bits, texels.
                        vj table = (vj) kgK.get(cache);
                        StringBuilder s = new StringBuilder();
                        for (jf node = table.a(3); node != null; node = table.a((byte) 88)) {
                            qi t = (qi) node;
                            s.append(t.k).append(':').append(t.P ? 1 : 0).append(':')
                                .append(Float.floatToIntBits(qiN.getFloat(t))).append(':')
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
