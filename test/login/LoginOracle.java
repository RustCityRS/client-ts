import java.io.*;
import java.lang.reflect.*;
import java.math.BigInteger;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.zip.CRC32;

class LoginOracle {
    static Class<?> type(String name) throws Exception { return Class.forName(name); }
    static Field field(String name) throws Exception {
        String[] parts = name.split("\\.");
        var f = type(parts[0]).getDeclaredField(parts[1]);
        f.setAccessible(true);
        return f;
    }
    static Object create(String name, Class<?>[] args, Object... values) throws Exception {
        var c = type(name).getDeclaredConstructor(args);
        c.setAccessible(true);
        return c.newInstance(values);
    }
    static Object call(String name, Object object, Class<?>[] args, Object... values) throws Exception {
        String[] parts = name.split("\\.");
        var m = type(parts[0]).getDeclaredMethod(parts[1], args);
        m.setAccessible(true);
        return m.invoke(object, values);
    }
    static Object str(String value) throws Exception {
        var string = create("id", new Class<?>[]{});
        var bytes = value.getBytes(StandardCharsets.ISO_8859_1);
        field("id.A").set(string, bytes);
        field("id.c").set(string, bytes.length);
        return string;
    }

    public static void main(String[] args) throws Exception {
        // Run the game's login state 3 in memory with its own archive and preference code.
        var socket = new Socket() {
            public void setTcpNoDelay(boolean b) {}
            public void setSoTimeout(int i) {}
            public InputStream getInputStream() { return new ByteArrayInputStream(HexFormat.of().parseHex("ffeeddcc76543210")); }
            public OutputStream getOutputStream() { return new ByteArrayOutputStream(); }
        };
        var stream = create("se", new Class<?>[]{Socket.class, type("fb")}, socket, null);
        field("se.n").set(stream, create("dj", new Class<?>[]{}));
        field("ek.s").set(null, stream);
        field("od.O").set(null, 3);
        field("te.e").set(null, 128);
        call("jd.a", null, new Class<?>[]{int.class, type("fb")}, -100, null);
        field("hi.f").set(null, 765);
        field("fl.l").set(null, 503);
        field("oj.k").set(null, str("test"));
        field("ga.G").set(null, str("One_Two"));
        field("ga.F").set(null, str("pa£s"));
        String[] archives = "uh.O bc.c sf.b dd.l rg.m re.d al.l rk.k h.i ha.b ek.D gd.E il.B nf.j f.f gj.Z fk.db bh.c ve.e ok.t ml.t ta.M jl.f aa.d kh.B wf.u wh.X ll.g".split(" ");
        byte[] empty = {0,0,0,0,4,5,0,0,0};
        var crc = new CRC32();
        crc.update(empty);
        for (int i = 0; i < archives.length; i++) {
            var index = create("db", new Class<?>[]{byte[].class, int.class}, empty, (int)crc.getValue());
            var archive = create("al", new Class<?>[]{type("ud"), boolean.class, boolean.class}, null, true, true);
            field("db.b").set(index, i - 17);
            field("al.x").set(archive, index);
            field(archives[i]).set(null, archive);
        }
        // Keep the random words observable, then use gd.a to produce the original RSA ciphertext.
        var exponent = field("bi.g").get(null);
        field("bi.g").set(null, BigInteger.ONE);
        if (args.length != 0 && args[0].equals("missing")) {
            for (String name : archives) {
                Object saved = field(name).get(null);
                field(name).set(null,null);
                field("od.O").setInt(null,3);
                field("se.f").set(stream,new ByteArrayInputStream(HexFormat.of().parseHex("ffeeddcc76543210")));
                try {
                    call("le.a",null,new Class<?>[]{int.class},-28426);
                    throw new AssertionError("missing archive " + name);
                } catch (InvocationTargetException ex) {
                    if (!(ex.getCause() instanceof RuntimeException)) throw ex;
                }
                Object out = field("wd.e").get(null);
                byte[] bytes = (byte[])field("gd.fb").get(out);
                int length = field("gd.yb").getInt(out);
                System.out.println(HexFormat.of().formatHex(bytes,0,length));
                field(name).set(null,saved);
            }
            return;
        }
        if(System.getProperty("rs530.seed")!=null){
            Class.forName("le");
            var rng=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
            rng.setAccessible(true);((java.util.Random)rng.get(null)).setSeed(Long.getLong("rs530.seed"));
        }
        call("le.a", null, new Class<?>[]{int.class}, -28426);
        var out = field("wd.e").get(null);
        var bytes = (byte[])field("gd.fb").get(out);
        var length = (int)field("gd.yb").get(out);
        System.out.println(HexFormat.of().formatHex(bytes, 0, length));
        int rsa = 3 + 159 + 5;
        byte[] credentials = Arrays.copyOfRange(bytes, rsa + 1, length);
        var packet = create("gd", new Class<?>[]{int.class}, 128);
        System.arraycopy(credentials, 0, field("gd.fb").get(packet), 0, credentials.length);
        field("gd.yb").set(packet, credentials.length);
        call("gd.a", packet, new Class<?>[]{BigInteger.class, byte.class, BigInteger.class}, exponent, (byte)127, field("mg.H").get(null));
        System.out.println(HexFormat.of().formatHex((byte[])field("gd.fb").get(packet), 0, (int)field("gd.yb").get(packet)));
        // Read values from the freshly seeded server ISAAC stream, also used to frame game packets.
        var cipher = field("be.Jb").get(field("hd.b").get(null));
        for (int i = 0; i < 513; i++) {
            System.out.println(call(cipher.getClass().getName() + ".b", cipher, new Class<?>[]{byte.class}, (byte)124));
        }
    }
}
