import java.io.*;
import java.lang.reflect.*;
import java.net.Socket;
import java.util.Arrays;
import java.util.HexFormat;

// Run against the unmodified 530 SD gamepack. Expose a single byte per client tick.
class Js5NetOracle {
    static class TestSocket extends Socket {
        final ByteArrayInputStream in;
        final ByteArrayOutputStream out = new ByteArrayOutputStream();
        int visible;

        TestSocket(byte[] wire) { in = new ByteArrayInputStream(wire); }
        public void setSoTimeout(int timeout) {}
        public void setTcpNoDelay(boolean value) {}
        public OutputStream getOutputStream() { return out; }
        public InputStream getInputStream() {
            return new FilterInputStream(in) {
                public int available() { return visible; }
                public int read(byte[] data, int pos, int len) throws IOException {
                    int n = super.read(data, pos, Math.min(len, visible));
                    visible -= n;
                    return n;
                }
            };
        }
    }

    static Object create(String name, Class<?>[] types, Object... args) throws Exception {
        var ctor = Class.forName(name).getDeclaredConstructor(types);
        ctor.setAccessible(true);
        return ctor.newInstance(args);
    }

    static Method method(Object target, String name, Class<?>... types) throws Exception {
        var method = target.getClass().getDeclaredMethod(name, types);
        method.setAccessible(true);
        return method;
    }

    static Field field(String owner, String name) throws Exception {
        var field = Class.forName(owner).getDeclaredField(name);
        field.setAccessible(true);
        return field;
    }

    static Object stream(Socket socket) throws Exception {
        var stream = create("se", new Class<?>[]{Socket.class, Class.forName("fb")}, socket, null);
        var task = create("dj", new Class<?>[]{});
        field("dj", "b").setInt(task, 2);
        field("se", "n").set(stream, task);
        return stream;
    }

    static byte[] writes(Object stream) throws Exception {
        var bytes = (byte[])field("se", "B").get(stream);
        return bytes == null ? new byte[0] : Arrays.copyOf(bytes, field("se", "o").getInt(stream));
    }

    static String queue(Object net, String fieldName) throws Exception {
        var list = field("ej", fieldName).get(net);
        var ids = new java.util.ArrayList<Long>();
        var node = method(list, "a", int.class).invoke(list, 104);
        while (node != null) {
            ids.add(field("ei", "v").getLong(node));
            node = method(list, "a", boolean.class).invoke(list, true);
        }
        return ids.toString();
    }

    static void state(Object net, Object stream, String result) throws Exception {
        var req = field("ej", "J").get(net);
        var header = field("ej", "I").get(net);
        var current = req == null ? "-" : field("ei", "v").getLong(req) + "/" + field("fd", "U").getInt(req);
        var bits = String.join(";", result, "" + field("ej","F").getInt(net), "" + field("ej","G").getInt(net),
            field("ej","B").get(net) == null ? "off" : "on", ""+field("ej","H").getByte(net),
            "" + field("gd","yb").getInt(header), current, queue(net,"c"), queue(net,"x"), queue(net,"y"), queue(net,"z"),
            stream == null ? "" : HexFormat.of().formatHex(writes(stream)));
        System.out.println(bits);
    }

    static void edges() throws Exception {
        var net = create("ej", new Class<?>[]{});
        var request = method(net, "a", byte.class, int.class, int.class, byte.class, boolean.class);
        var tick = method(net, "g", int.class);
        var attach = method(net, "a", boolean.class, byte.class, Class.forName("se"));
        var data = HexFormat.of().parseHex("010006000000000101010006000000000102");
        var first = new TestSocket(data);
        var s = stream(first);
        state(net, null, "" + tick.invoke(net, 0));
        request.invoke(net, (byte)0, 6, 1, (byte)-30, true);
        request.invoke(net, (byte)2, 6, 1, (byte)-30, true);
        request.invoke(net, (byte)0, 2, 6, (byte)-30, false);
        state(net, null, "" + tick.invoke(net, 0));
        attach.invoke(net, false, (byte)119, s);
        method(net, "a", byte.class, boolean.class).invoke(net, (byte)-10, true);
        method(net, "a", boolean.class).invoke(net, true);
        first.visible = data.length;
        for (int start : new int[]{100,99,99,99,99,0}) state(net, s, "" + tick.invoke(net, start));
        // The asynchronous writer's stored failure is consumed before any more requests move.
        request.invoke(net, (byte)0, 7, 7, (byte)-30, false);
        field("se", "y").setBoolean(s, true);
        state(net, s, "" + tick.invoke(net, 100));
        var second = new TestSocket(HexFormat.of().parseHex("ff00020000000001"));
        s = stream(second);
        attach.invoke(net, true, (byte)119, s);
        state(net, s, "attach");
        second.visible = 8;
        state(net, s, "" + tick.invoke(net, 0));

        var rng=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");
        rng.setAccessible(true);
        ((java.util.Random)rng.get(null)).setSeed(530);
        method(net, "c", byte.class).invoke(net, (byte)101);
        state(net, s, "crc");
        field("ej","H").setByte(net, (byte)0x99);
        var malformed = HexFormat.of().parseHex("07000780fffffff0");
        for (int i = 0; i < malformed.length; i++) malformed[i] ^= (byte)0x99;
        var third = new TestSocket(malformed);
        s = stream(third);
        attach.invoke(net, true, (byte)119, s);
        third.visible = 8;
        try { tick.invoke(net, 0); throw new AssertionError("Missing size failure"); }
        catch (InvocationTargetException expected) { state(net, s, "runtime"); }
        method(net, "f", int.class).invoke(net, -112);
        state(net, s, field("se","f").get(s).getClass().getSimpleName().equals("lf") ? "broken" : "open");
        method(net, "b", boolean.class).invoke(net, true);
        state(net, s, field("se","m").getBoolean(s) ? "closed" : "open");
        Object offline = create("ej", new Class<?>[]{});
        System.out.println(tick.invoke(offline,7) + "/" + (field("ej","I").get(offline) == null));
        Object busy = create("ej", new Class<?>[]{});
        request.invoke(busy,(byte)0,1,1,(byte)-30,true);
        System.out.println(tick.invoke(busy,7) + "/" + (field("ej","I").get(busy) == null));
    }

    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("edges")) { edges(); return; }
        if (args.length == 1 && args[0].equals("reads")) {
            int[] read = {0,0,0};
            var socket = new TestSocket(new byte[0]) {
                public InputStream getInputStream() {
                    return new InputStream() {
                        public int available() { return visible; }
                        public int read() { throw new AssertionError(); }
                        public int read(byte[] bytes, int offset, int length) throws IOException {
                            read[0]++;
                            read[1] = offset;
                            read[2] = length;
                            throw new IOException();
                        }
                    };
                }
            };
            Object net = create("ej",new Class<?>[]{}), connection = stream(socket);
            var request = method(net,"a",byte.class,int.class,int.class,byte.class,boolean.class);
            Object urgent = request.invoke(net,(byte)0,9,3,(byte)-30,true);
            Object low = request.invoke(net,(byte)0,13,4,(byte)-30,false);
            field("ei","v").setLong(urgent,0x7ffffffeeeeabcdfL);
            field("ei","v").setLong(low,0x8000000fffffffd3L);
            method(net,"a",boolean.class,byte.class,connection.getClass()).invoke(net,true,(byte)119,connection);
            var service = method(net,"g",int.class);
            System.out.println(service.invoke(net,0) + ":" + HexFormat.of().formatHex(writes(connection)));
            var header = field("ej","I").get(net);
            field("gd","yb").setInt(header,-1);
            socket.visible = 2;
            System.out.println(service.invoke(net,0) + ":" + Arrays.toString(read) + ":" + field("gd","yb").getInt(header) + ":" + field("ej","F").getInt(net) + ":" + field("ej","G").getInt(net));
            return;
        }
        byte[] wire = HexFormat.of().parseHex(args[0]);
        var socket = new TestSocket(wire);
        var stream = stream(socket);
        var net = create("ej", new Class<?>[]{});
        var request = method(net, "a", byte.class, int.class, int.class, byte.class, boolean.class);
        var prefetch = request.invoke(net, (byte)2, 258, 7, (byte)-30, false);
        var urgent = request.invoke(net, (byte)0, 65502, 3, (byte)-30, true);
        var percent = method(prefetch, "c", byte.class);
        var read = method(prefetch, "e", int.class);
        var tick = method(net, "g", int.class);
        method(net, "a", boolean.class, byte.class, stream.getClass()).invoke(net, false, (byte)119, stream);
        tick.invoke(net, 0);
        var progress = new ByteArrayOutputStream();
        for (int i = 0; i < wire.length; i++) {
            socket.visible++;
            tick.invoke(net, 0);
            progress.write((int)percent.invoke(prefetch, (byte)-52));
            progress.write((int)percent.invoke(urgent, (byte)-52));
        }
        method(net, "b", boolean.class).invoke(net, true);
        for (byte[] value : new byte[][]{writes(stream), (byte[])read.invoke(prefetch, 0), (byte[])read.invoke(urgent, 0), progress.toByteArray()}) {
            System.out.println(HexFormat.of().formatHex(value));
        }
    }
}
