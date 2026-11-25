import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.IdentityHashMap;

// Executes the original three title methods from the SD gamepack. Only ud's packed-cache source is replaced.
public final class TitleLoadingOracle {
    static Path directory;
    static int missing = -1;
    static int corrupt = -1;
    static boolean noIndex;
    static al sprites;
    static mb font;
    static final StringBuilder reads = new StringBuilder();
    static final IdentityHashMap<Object, Integer> spritesSeen = new IdentityHashMap<>();

    static int identity(Object sprite) {
        return sprite == null ? 0 : spritesSeen.computeIfAbsent(sprite, unused -> spritesSeen.size() + 1);
    }

    static String pixelHash() {
        if (td.g == null) return "-";
        try {
            ByteBuffer bytes = ByteBuffer.allocate(td.g.length * 4);
            for (int pixel : td.g) bytes.putInt(pixel);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes.array()));
        } catch (Exception error) {
            throw new AssertionError(error);
        }
    }

    static class Cache extends ud {
        final int archive;
        Cache(int archive) { this.archive = archive; }
        byte[] data(int archive, int group) {
            try {
                return Files.readAllBytes(directory.resolve(archive + "-" + group));
            } catch (Exception e) {
                throw new AssertionError(e);
            }
        }
        db b(int unused) {
            reads.append("i").append(archive).append("/");
            if (noIndex) return null;
            byte[] bytes = data(255, archive);
            return new db(bytes, q.a(0, bytes, bytes.length));
        }
        byte[] a(int unused, int group) {
            // Capture published sprite slots and clearing/background draw at each resource read.
            reads.append("g").append(archive).append(".").append(group).append(".")
                .append(kg.H ? 1 : 0).append(".").append(identity(ai.k)).append(".")
                .append(identity(ad.i)).append(".").append(pixelHash()).append("/");
            if (group == missing) return null;
            if (group == corrupt) return new byte[] {0, 0, 0, 0, 2, 0, 1};
            return data(archive, group);
        }
        void b(int unused, int group) { throw new AssertionError("prefetch " + group); }
        int c(int group, int unused) { throw new AssertionError("percentage " + group); }
    }

    static void perform(String[] cmd) {
        switch (cmd[0]) {
        case "init": {
            al glyphs = new al(new Cache(8), true, true);
            g.a(60, glyphs);
            int id = glyphs.a((byte) 103, aj.a("b12_full", (byte) -77));
            font = sb.a(glyphs, id, 0, 0, new al(new Cache(13), true, true));
            if (font == null) throw new AssertionError("b12_full");
            ie.A = aj.a("Loading sprites - 37%", (byte) -77);
            me.v = aj.a("Loading - please wait.", (byte) -77);
            break;
        }
        case "archive":
            missing = cmd[1].equals("back") ? ed.a : cmd[1].equals("logo") ? da.h : -1;
            corrupt = cmd[1].equals("corrupt-back") ? ed.a : cmd[1].equals("corrupt-logo") ? da.h : -1;
            noIndex = cmd[1].equals("no-index");
            sprites = new al(new Cache(8), true, true);
            break;
        case "text":
            me.v = cmd[1].equals("heading") ? null : aj.a("Loading - please wait.", (byte) -77);
            ie.A = cmd[1].equals("status") ? null : aj.a("Loading sprites - 37%", (byte) -77);
            break;
        case "screen":
            hi.f = Integer.parseInt(cmd[1]);
            fl.l = Integer.parseInt(cmd[2]);
            break;
        case "frame": {
            int length = Integer.parseInt(cmd[3]);
            td.a(length < 0 ? null : new int[length], Integer.parseInt(cmd[1]), Integer.parseInt(cmd[2]));
            break;
        }
        case "seed":
            for (int i = 0; i < td.g.length; i++) td.g[i] = 0x234567 ^ i * 83429;
            break;
        case "clip":
            td.b(Integer.parseInt(cmd[1]), Integer.parseInt(cmd[2]), Integer.parseInt(cmd[3]), Integer.parseInt(cmd[4]));
            break;
        case "open": ef.a(cmd[1].equals("null") ? null : sprites, (byte) -62); break;
        case "close": rk.a((byte) -80); break;
        case "draw":
            ga.D = Integer.parseInt(cmd[3]);
            mk.a(Integer.parseInt(cmd[2]), cmd[4].equals("null") ? null : font, cmd[1].equals("1"));
            break;
        default: throw new AssertionError(cmd[0]);
        }
    }

    public static void main(String[] args) throws Exception {
        directory = Path.of(args[0]);
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            String outcome = "ok";
            reads.setLength(0);
            try {
                perform(line.split(" "));
            } catch (RuntimeException ex) {
                Throwable cause = ex;
                while (cause instanceof g) cause = ((g) cause).a;
                if (cause instanceof NullPointerException) outcome = "null";
                else if (cause instanceof IndexOutOfBoundsException) outcome = "bounds";
                else throw ex;
            }
            System.out.println(outcome + " " + (kg.H ? 1 : 0) + " " + identity(ai.k) + " " + identity(ad.i)
                + " " + td.e + "," + td.b + "," + td.h + "," + td.d + " " + pixelHash() + " " + reads);
        }
    }
}
