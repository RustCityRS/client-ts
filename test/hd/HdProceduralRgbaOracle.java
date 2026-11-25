import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.DataInputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.StringJoiner;
import java.util.zip.CRC32;

// The input contains the untouched cache index and group containers. The HD
// game's ve, nk and lc decode the archives, sprites and nested textures.
public class HdProceduralRgbaOracle {
    private static final HexFormat HEX = HexFormat.of();

    static final class Provider extends v {
        final ii table;
        final byte[][] groups;

        Provider(Path path) throws Exception {
            try (DataInputStream in = new DataInputStream(new BufferedInputStream(Files.newInputStream(path)))) {
                byte[] reference = in.readNBytes(in.readInt());
                CRC32 crc = new CRC32();
                crc.update(reference);
                table = new ii(reference, (int)crc.getValue());
                groups = new byte[table.u][];
                for (int id : table.m) {
                    if (in.readInt() != id) throw new AssertionError("group order in " + path);
                    groups[id] = in.readNBytes(in.readInt());
                }
                if (in.read() != -1) throw new AssertionError("extra groups in " + path);
            }
        }

        ii b(int guard) { return table; }
        byte[] c(int group, int guard) { return groups[group]; }
        void a(int group, int guard) {}
        int b(int group, int guard) { return 100; }
    }

    static Field graphField(String name) throws Exception {
        Field field = lc.class.getDeclaredField(name);
        field.setAccessible(true);
        return field;
    }

    static String ids(int[] values) {
        StringJoiner ids = new StringJoiner(",");
        for (int value : values) ids.add(Integer.toString(value));
        return ids.toString();
    }

    static String failure(RuntimeException ex) {
        Throwable cause = ex instanceof ld wrapper ? wrapper.f : ex;
        if (cause instanceof ArrayIndexOutOfBoundsException) return "bounds " + cause.getMessage().split(" ")[1];
        if (cause instanceof NegativeArraySizeException) return "negative";
        if (cause instanceof NullPointerException) return "null";
        throw ex;
    }

    // Ask the decoded colour operator for its own JAR pixels, then shorten
    // one returned array. Competing faults distinguish the HD/SD read order.
    static final class DamagedChannel extends j {
        final j source;
        final String damage;

        DamagedChannel(j source, String damage) {
            super(0, false);
            this.source = source;
            this.damage = damage;
        }

        int[][] b(int guard, int row) {
            visits.add(Integer.toString(row));
            if (damage.equals("alpha")) return new int[][]{new int[0]};
            int[][] channels = source.b(guard, row);
            if (damage.equals("short")) return Arrays.copyOf(channels, 1);
            if (damage.equals("red")) return new int[][]{new int[1], null, null};
            if (damage.equals("green") || (damage.equals("lateGreen") && row == 1)) return new int[][]{channels[0], new int[1], null};
            if (damage.equals("lateGreen")) return channels;
            if (damage.equals("blue")) return new int[][]{channels[0], channels[1], new int[1]};
            if (damage.equals("emptyGamma") || damage.equals("nullGamma")) {
                setGamma(damage.equals("nullGamma") ? null : new int[0]);
                return channels;
            }
            if (damage.equals("conditionalAlpha")) return new int[][]{new int[]{4096, 0}, new int[2], new int[2]};
            setGamma(new int[0]);
            return new int[][]{channels[0], channels[1], null};
        }
    }

    static StringJoiner visits;
    static void setGamma(int[] table) { i.ac = table; }

    static String probeState(lc graph) throws Exception {
        StringBuilder caches = new StringBuilder();
        for (j op : (j[])graphField("g").get(graph)) caches.append(op.H != null ? 'm' : op.t != null ? 'c' : '-');
        return "|" + visits + "|" + caches;
    }

    static String probe(String[] args) throws Exception {
        String kind = args[1], damage = args[2];
        lc graph = new lc(new wa(HEX.parseHex(args[3])));
        int[] savedGamma = i.ac;
        visits = new StringJoiner(",");
        try {
            if (!damage.equals("none")) {
                Field root = graphField(damage.equals("alpha") ? "i" : "d");
                root.set(graph, new DamagedChannel((j)root.get(graph), damage));
                if (damage.equals("conditionalAlpha")) graphField("i").set(graph, new j(0, false) {
                    int[][] b(int guard, int row) { return new int[][]{new int[0]}; }
                });
            }
            if (kind.equals("packed")) return ids(graph.a(2, false, 2, 1.0, 327680, null, null, false)) + probeState(graph);
            return HEX.formatHex(graph.a(2, 2, false, null, 1.0, 8839, null)) + probeState(graph);
        } catch (RuntimeException ex) {
            return failure(ex) + probeState(graph);
        } finally {
            i.ac = savedGamma;
        }
    }

    public static void main(String[] args) throws Exception {
        Path directory = Path.of(args[0]);
        Provider textureDisk = new Provider(directory.resolve("9"));
        ve textures = new ve(textureDisk, false, true);
        ve sprites = new ve(new Provider(directory.resolve("8")), false, true);
        ve materials = new ve(new Provider(directory.resolve("26")), false, true);
        nk provider = new nk(textures, materials, sprites, 20, false);
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        Field spriteIds = graphField("b"), textureIds = graphField("k"), operators = graphField("g");
        for (int id : textureDisk.table.m) {
            wa packet = new wa(textures.a(id, (byte)-122, 0));
            lc graph = new lc(packet);
            StringJoiner line = new StringJoiner("|");
            line.add(Integer.toString(id)).add(Integer.toString(packet.T))
                .add(ids((int[])spriteIds.get(graph))).add(ids((int[])textureIds.get(graph)));
            if (!graph.a(true, provider, sprites)) throw new AssertionError("unready texture " + id);
            for (int flags = 0; flags < 4; flags++) {
                int size = (flags & 1) == 0 ? 64 : 128;
                boolean transpose = (flags & 2) != 0;
                double gamma = ((id ^ flags) & 1) == 0 ? (double)0.7F : 1.0;
                byte[] pixels = graph.a(size, size, transpose, provider, gamma, 8839, sprites);
                line.add(HEX.formatHex(sha.digest(pixels)));
            }
            System.out.println(line);
        }
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = in.readLine()) != null; ) {
            String[] args1 = line.split(" ");
            if (args1[0].equals("probe")) {
                System.out.println("probe|" + probe(args1));
                continue;
            }
            lc graph = new lc(new wa(HEX.parseHex(args1[0])));
            String result;
            try {
                byte[] pixels = graph.a(Integer.parseInt(args1[1]), Integer.parseInt(args1[2]),
                    Boolean.parseBoolean(args1[3]), null, Double.parseDouble(args1[4]), 8839, null);
                result = HEX.formatHex(pixels);
            } catch (RuntimeException ex) {
                result = failure(ex);
            }
            StringBuilder cacheState = new StringBuilder();
            for (j op : (j[])operators.get(graph)) {
                cacheState.append(op.H != null ? 'm' : op.t != null ? 'c' : '-');
            }
            System.out.println("case|" + result + "|" + pe.r + "," + nj.k + "|" + cacheState);
        }
    }
}
