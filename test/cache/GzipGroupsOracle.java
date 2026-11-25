import java.io.*;
import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.Arrays;

public class GzipGroupsOracle {
    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("hd");
        Class<?> packet = Class.forName(hd ? "wa" : "gd");
        Constructor<?> makePacket = packet.getDeclaredConstructor(byte[].class);
        makePacket.setAccessible(true);
        Field pos = packet.getDeclaredField(hd ? "T" : "yb");
        pos.setAccessible(true);
        Class<?> codec = Class.forName(hd ? "ha" : "bi");
        Constructor<?> constructor = codec.getDeclaredConstructor();
        constructor.setAccessible(true);
        Object inflater = constructor.newInstance();
        Method run = hd ? codec.getDeclaredMethod("a", byte[].class, packet, boolean.class)
            : codec.getDeclaredMethod("a", byte[].class, byte.class, packet);
        run.setAccessible(true);
        MessageDigest hash = MessageDigest.getInstance("SHA-256");
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(new FileInputStream(args[1])));
             OutputStream out = new BufferedOutputStream(System.out)) {
            while (true) {
                int length;
                try { length = in.readInt(); } catch (EOFException end) { break; }
                int destination = in.readInt(), offset = in.readInt();
                byte[] input = new byte[length];
                in.readFully(input);
                byte[] output = destination < 0 ? input : new byte[destination];
                if (destination >= 0) Arrays.fill(output,(byte)0xa5);
                Object buffer = makePacket.newInstance((Object)input);
                pos.setInt(buffer,offset);
                int status = 0;
                try {
                    if (hd) run.invoke(inflater, output, buffer, false);
                    else run.invoke(inflater, output, (byte)-118, buffer);
                } catch (InvocationTargetException e) {
                    if (!(e.getCause() instanceof RuntimeException)) throw e;
                    status = 1;
                }
                if (pos.getInt(buffer) != offset) throw new AssertionError("Packet cursor changed");
                out.write(status);
                out.write(hash.digest(output));
            }
        }
    }
}
