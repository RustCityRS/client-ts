import java.io.*;
import java.util.HexFormat;

public final class JagStringReplaceCharOracle {
    public static void main(String[] args) throws Exception {
        if (args.length == 1 && args[0].equals("toString")) {
            try { new na().toString(); throw new AssertionError("returned"); }
            catch (ld error) {
                if (error.f.getClass() != RuntimeException.class || error.f.getMessage() != null) throw error;
                System.out.println(error.e);
            }
            return;
        }
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) {
            String[] fields = line.split(" ");
            na source = new na();
            int capacity = Integer.parseInt(fields[0]);
            if (capacity >= 0) {
                source.T = new byte[capacity];
                for (int i = 0; i < capacity; i++) source.T[i] = (byte)i;
            }
            source.lb = Integer.parseInt(fields[1]);
            try {
                na result = source.c(Integer.parseInt(fields[2]),40,Integer.parseInt(fields[3]));
                if (result == source || result.T == source.T) throw new AssertionError("shared string");
                System.out.println(result.lb + ":" + HexFormat.of().formatHex(result.T));
            } catch (ld error) {
                System.out.println(error.f.getClass().getSimpleName() + " " + error.e);
            }
        }
    }
}
