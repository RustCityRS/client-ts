import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HexFormat;

class HdPacketWritersOracle {
    public static void main(String[] args) throws Exception {
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            String[] parts = line.split(" ");
            int bits = Integer.parseUnsignedInt(parts[1], 16);
            int length = Integer.parseInt(parts[3]);
            byte[] bytes = length < 0 ? null : new byte[length];
            if (bytes != null) {
                for (int i = 0; i < bytes.length; i++) bytes[i] = (byte) (bits + i * 37);
            }
            wa packet = new wa(bytes);
            packet.T = Integer.parseInt(parts[2]);
            String result = "ok";
            try {
                switch (parts[0]) {
                    case "float" -> packet.a(881, Float.intBitsToFloat(bits));
                    case "floatLE" -> packet.a(Float.intBitsToFloat(bits), (byte) 94);
                    case "integerLE" -> packet.e(bits, 95);
                    case "protocolLE" -> packet.b(bits, (byte) -120);
                    case "alt2" -> packet.j(bits, 1437452424);
                    case "g2s" -> result = Integer.toString(packet.l((byte) 46));
                    case "g2" -> result = Integer.toString(packet.c(1));
                    case "g3" -> result = Integer.toString(packet.n((byte) 83));
                    case "ig3" -> result = Integer.toString(packet.h((byte) -99));
                    case "readAlt2" -> result = Integer.toString(packet.k(-1));
                    case "readAlt3" -> result = Integer.toString(packet.o((byte) -90));
                    case "little" -> result = Integer.toString(packet.l(bits));
                    case "signedNeg" -> result = Byte.toString(packet.i((byte)bits));
                    case "g4" -> result = Integer.toString(packet.e(-502942936));
                    default -> throw new AssertionError(parts[0]);
                }
            } catch (ld wrapped) {
                if (wrapped.f instanceof ArrayIndexOutOfBoundsException) {
                    // Reads can advance over multiple bytes before their first
                    // array access, so report the actual JVM fault index.
                    result = "bounds " + wrapped.f.getMessage().split(" ")[1];
                } else if (wrapped.f instanceof NullPointerException) {
                    result = "null";
                } else throw wrapped;
                if (parts[0].equals("g2s") || parts[0].equals("little") || parts[0].equals("signedNeg")) result += " " + wrapped.e;
            }
            System.out.println(result + "|" + packet.T + "|" + (bytes == null ? "-" : HexFormat.of().formatHex(bytes)));
        }
    }
}
