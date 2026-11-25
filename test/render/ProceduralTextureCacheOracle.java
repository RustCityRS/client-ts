import java.io.IOException;
import java.io.RandomAccessFile;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;
import java.util.StringJoiner;
import java.util.zip.CRC32;

// Only the disk provider is substituted. The JAR reads its own db/al indexes and
// groups, decodes archive-8 sprites, and uses its real kg/qi for nested textures.
public class ProceduralTextureCacheOracle {
    static class Disk extends ud implements AutoCloseable {
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
        public void close() throws IOException { index.close(); data.close(); }
    }

    static Field field(String name) throws Exception {
        Field f = jd.class.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    static String csv(int[] values) {
        StringJoiner list = new StringJoiner(",");
        for (int value : values) list.add(Integer.toString(value));
        return list.toString();
    }
    static String digest(int[] pixels, MessageDigest sha) {
        ByteBuffer buf = ByteBuffer.allocate(pixels.length * 4).order(ByteOrder.LITTLE_ENDIAN);
        buf.asIntBuffer().put(pixels);
        return HexFormat.of().formatHex(sha.digest(buf.array()));
    }
    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args[0]);
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        Map<Class<?>, Integer> types = new HashMap<>();
        for (int i = 0; i < 40; i++) types.put(la.d(-112, i).getClass(), i);
        Field operators = field("c"), spriteIds = field("p"), textureIds = field("a");
        try (Disk textureSource = new Disk(dir, 9); Disk spriteSource = new Disk(dir, 8); Disk materials = new Disk(dir, 26)) {
            al textures = new al(textureSource, false, true), sprites = new al(spriteSource, false, true);
            kg provider = new kg(textures, new al(materials, false, true), sprites, 20, false);
            for (int id : textureSource.table.d) {
                gd packet = new gd(textures.a(-809612665, 0, id));
                jd graph = new jd(packet);
                StringJoiner ops = new StringJoiner(",");
                for (bf op : (bf[]) operators.get(graph)) ops.add(types.get(op.getClass()).toString());
                boolean ready = graph.a(provider, (byte) 115, sprites);
                StringJoiner line = new StringJoiner("|");
                line.add(Integer.toString(id)).add(Integer.toString(packet.yb)).add(ops.toString());
                line.add(csv((int[]) spriteIds.get(graph))).add(csv((int[]) textureIds.get(graph)));
                line.add(ready ? "1" : "0").add(provider.a(id, 0) ? "64" : "128");
                if (ready) for (int flags = 0; flags < 4; flags++) {
                    int size = ((id ^ flags) & 1) == 0 ? 64 : 128;
                    int[] pixels = graph.a(provider, sprites, 71, (flags & 2) != 0, size,
                        (flags & 1) != 0, (flags & 1) == 0 ? (double) 0.7F : 1.0, size);
                    line.add(digest(pixels, sha));
                }
                System.out.println(line);
            }
        }
    }
}
