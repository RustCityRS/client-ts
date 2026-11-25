import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;
import java.util.zip.CRC32;

class HdLightTypeOracle {
    static class Provider extends v {
        final ii index;
        final int group;
        final byte[] bytes;
        Provider(byte[] reference, int group, byte[] bytes) {
            CRC32 crc = new CRC32(); crc.update(reference);
            this.index = new ii(reference, (int)crc.getValue());
            this.group = group;
            this.bytes = bytes;
        }
        ii b(int guard) { return index; }
        void a(int id, int guard) {}
        int b(int id, int guard) { return id == group ? 100 : 0; }
        byte[] c(int id, int guard) { return id == group ? bytes : null; }
    }

    static String fields(ic type) { return type.c + "," + type.p + "," + type.g + "," + type.o; }
    static String failure(RuntimeException ex) {
        Throwable root = ex instanceof ld wrapper ? wrapper.f : ex;
        if (root instanceof ArrayIndexOutOfBoundsException) {
            return "bounds:" + root.getMessage().split(" ")[1];
        }
        if (root instanceof NullPointerException) return "null";
        if (root instanceof ClassCastException) return "cast";
        throw ex;
    }
    static String list(int key) {
        try { return fields(la.a(1001, key)); }
        catch (RuntimeException ex) { return failure(ex); }
    }

    static client stage(Path dir) throws Exception {
        var provider = new Provider(Files.readAllBytes(dir.resolve("stage-index")), 0, new byte[]{0,0,0,0,1,0});
        ve config = wf.g = new ve(provider, false, false);
        ve others = new ve(provider, false, false);
        wl.s = km.Nc = nj.l = ni.k = ui.cb = jh.p = mf.W = uj.J = cd.B = sf.b = others;
        ra.K = vl.g = dc.z = ve.l = ud.J = re.B = others;
        Class<?> unsafe = Class.forName("sun.misc.Unsafe");
        Field singleton = unsafe.getDeclaredField("theUnsafe"); singleton.setAccessible(true);
        client game = (client)unsafe.getMethod("allocateInstance", Class.class).invoke(singleton.get(null), client.class);
        Method mainLoad = client.class.getDeclaredMethod("i", int.class); mainLoad.setAccessible(true);
        na.h = true; nc.j = 70;
        mainLoad.invoke(game, 107);
        System.out.println("stage " + nc.j + " " + (gl.a == config));
        return game;
    }

    public static void main(String[] args) throws Exception {
        Path dir = Path.of(args[0]);
        client game = stage(dir);
        ve real = new ve(new Provider(Files.readAllBytes(dir.resolve("index")), 31,
            Files.readAllBytes(dir.resolve("group"))), false, false);
        id.a(real, (byte)69);
        int[] ids = real.a((byte)-128, 31);
        System.out.println("real-group " + (ids == null ? "absent" : ids.length) + " " + list(0));
        if (ids != null) for (int file : ids) {
            ic type = la.a(1001, file);
            System.out.println("real " + file + " " + fields(type) + " " + (type == la.a(1001, file)));
        }
        // Config archive 2 in the original build-530 cache has no group 31.
        // Give the real loader a one-file group so its success and failure paths both execute.
        ve archive = new ve(new Provider(Files.readAllBytes(dir.resolve("light-index")), 31,
            Files.readAllBytes(dir.resolve("light-group"))), false, false);
        id.a(archive, (byte)69);
        gd.b(-19761);
        int key = 0;
        ic cached = la.a(1001, key);
        System.out.println("populated " + fields(cached));
        id.a(null, (byte)69);
        System.out.println("null-archive " + (cached == la.a(1001,key)) + " " + list(-12345));
        rm.d.a((byte)-75, new Object(), -12345L);
        System.out.println("wrong-cache " + list(-12345));
        id.a(archive, (byte)69);
        gd.b(-19761);
        ic missing = la.a(1001, -1);
        System.out.println("missing " + fields(missing) + " " + (missing == la.a(1001,-1)));
        Field unpacked = ve.class.getDeclaredField("A"); unpacked.setAccessible(true);
        Object[] group = ((Object[][])unpacked.get(archive))[31];
        group[key] = new byte[]{3,42};
        System.out.println("broken " + list(key) + " " + (rm.d.b((long)key,(byte)121) == null));
        group[key] = new byte[]{4,-1,-1,0};
        System.out.println("repaired " + list(key));
        c.c(83,0);
        hd.a(103);
        System.out.println("soft " + (rm.d.b((long)key,(byte)121) == null));
        // Each input is a fresh packet. Read it directly through ic's normal decoder to observe
        // the committed fields and packet cursor even when a payload ends in the middle of an opcode.
        try (BufferedReader input = new BufferedReader(new InputStreamReader(System.in))) {
            for (String line; (line = input.readLine()) != null;) {
                String[] words = line.split(" ", -1);
                wa packet = new wa(words[1].equals("null") ? null : HexFormat.of().parseHex(words[1]));
                packet.T = Integer.parseInt(words[0]);
                ic type = new ic();
                String status = "ok";
                try { type.a(2, packet, key); }
                catch (RuntimeException ex) { status = failure(ex); }
                System.out.println("decode " + status + " " + packet.T + " " + fields(type));
            }
        }
        game.c(126);
        System.out.println("released " + (gl.c == null) + " " + (gl.a == null));
    }
}
