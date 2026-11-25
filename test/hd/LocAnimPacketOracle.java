import java.io.*;
import java.lang.reflect.*;
import java.net.Socket;
import java.util.Arrays;
import java.util.HexFormat;

/** Drive original rg.a / ac.a on a pending packet over an in-memory socket in both gamepacks. */
public final class LocAnimPacketOracle {
    static final class Peer extends Socket {
        final byte[] transport;
        Peer(byte[] wire) { transport = Arrays.copyOf(wire, wire.length + 1); }
        public void setSoTimeout(int timeout) {}
        public void setTcpNoDelay(boolean enabled) {}
        public InputStream getInputStream() { return new ByteArrayInputStream(transport); }
        public OutputStream getOutputStream() { return OutputStream.nullOutputStream(); }
    }

    static Field field(String owner, String name) throws Exception {
        return Class.forName(owner).getDeclaredField(name);
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        Class<?> packetType = Class.forName(hd ? "i" : "be");
        Constructor<?> packet = packetType.getDeclaredConstructor(int.class);
        Class<?> socketType = Class.forName(hd ? "ma" : "se");
        Constructor<?> socket = socketType.getDeclaredConstructor(Socket.class, Class.forName(hd ? "ll" : "fb"));
        Method dispatch = Class.forName(hd ? "ac" : "rg").getDeclaredMethod("a", byte.class);
        Field bytes = field(hd ? "wa" : "gd", hd ? "y" : "fb");
        Field cursor = field(hd ? "wa" : "gd", hd ? "T" : "yb");
        Field input = field(hd ? "eg" : "hd", hd ? "e" : "b");
        Field stream = field(hd ? "jk" : "ek", hd ? "B" : "s");
        Field opcode = field(hd ? "na" : "o", hd ? "l" : "Y");
        Field length = field(hd ? "sc" : "af", hd ? "o" : "I");
        Field scene = field(hd ? "kc" : "kl", hd ? "o" : "Bb");
        Field context = field(hd ? "ld" : "g", hd ? "e" : "q");
        Field cause = field(hd ? "ld" : "g", hd ? "f" : "a");
        Field history = field(hd ? "sj" : "fk", hd ? "t" : "X");
        Field previous = field(hd ? "af" : "la", hd ? "k" : "W");
        Field oldest = field(hd ? "dm" : "jh", "q");
        Field idle = field(hd ? "qf" : "ia", hd ? "M" : "q");
        field(hd ? "se" : "hk", hd ? "a" : "e").setInt(null, 3200);
        field(hd ? "lc" : "vj", hd ? "n" : "t").setInt(null, 6400);
        Object empty = Array.newInstance(Class.forName(hd ? "bj" : "ra"), 4, 104, 104);

        BufferedReader rows = new BufferedReader(new InputStreamReader(System.in));
        for (String row; (row = rows.readLine()) != null;) {
            String[] columns = row.split(" ", -1);
            String mode = columns[0];
            byte[] wire = HexFormat.of().parseHex(columns[1]);
            Object p = packet.newInstance(0);
            bytes.set(p, mode.equals("null") ? null : new byte[wire.length]);
            cursor.setInt(p, 8);
            input.set(null, p);
            stream.set(null, socket.newInstance(new Peer(wire), null));
            opcode.setInt(null, 235);
            length.setInt(null, mode.equals("pending") ? wire.length + 2 : wire.length);
            scene.set(null, mode.equals("missing") ? null : empty);
            history.setInt(null, 41); previous.setInt(null, 42); oldest.setInt(null, 43); idle.setInt(null, 71);
            String result;
            try {
                result = dispatch.invoke(null, (byte)(hd ? -83 : 57)).toString();
            } catch (InvocationTargetException failure) {
                Throwable wrapper = failure.getCause();
                if (!context.getDeclaringClass().isInstance(wrapper)) throw failure;
                Throwable root = (Throwable)cause.get(wrapper);
                if (root instanceof ArrayIndexOutOfBoundsException) {
                    result = "bounds " + root.getMessage().split(" ")[1];
                } else if (root instanceof NullPointerException) {
                    result = "null";
                } else throw failure;
                result += " " + context.get(wrapper);
            }
            System.out.println(result + "|" + cursor.getInt(p) + "," + opcode.getInt(null) + "," + length.getInt(null)
                + "|" + idle.getInt(null) + "," + history.getInt(null) + "," + previous.getInt(null) + "," + oldest.getInt(null));
        }
    }
}
