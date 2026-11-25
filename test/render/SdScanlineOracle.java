import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.Arrays;

/** Runs the four private dc scanline methods in the original SD gamepack. */
public class SdScanlineOracle {
    static Class<?> raster;
    static Field field(String name) throws ReflectiveOperationException {
        Field f = raster.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    static Method span(String name, int arrays, int ints) throws ReflectiveOperationException {
        Class<?>[] types = new Class<?>[arrays + ints];
        Arrays.fill(types, 0, arrays, int[].class);
        Arrays.fill(types, arrays, types.length, int.class);
        Method m = raster.getDeclaredMethod(name, types);
        m.setAccessible(true);
        return m;
    }
    static int[] words(DataInputStream in) throws IOException {
        int[] words = new int[in.readInt()];
        for (int i = 0; i < words.length; i++) words[i] = in.readInt();
        return words;
    }
    public static void main(String[] args) throws Exception {
        raster = Class.forName("dc");
        Method flat = span("a", 1, 5), gouraud = span("a", 1, 7);
        Method terrain = span("a", 2, 13), model = span("b", 2, 13);
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(Files.newInputStream(Path.of(args[0]))));
             DataOutputStream out = new DataOutputStream(new BufferedOutputStream(System.out))) {
            int[] pixels = words(in), palette = words(in), small = words(in), large = words(in);
            field("o").set(null, palette);
            for (int count = in.readInt(); count > 0; count--) {
                int[] s = words(in);
                field("p").setInt(null, s[1]); field("j").setBoolean(null, s[2] != 0);
                field("e").setInt(null, s[3]); field("a").setBoolean(null, (s[4] & 1) != 0);
                field("m").setBoolean(null, (s[4] & 1) != 0); field("n").setBoolean(null, (s[4] & 2) != 0);
                field("f").setInt(null, s[10]);
                switch (s[0]) {
                    case 0 -> flat.invoke(null, pixels, s[5], s[8], 0, s[6], s[7]);
                    case 1 -> gouraud.invoke(null, pixels, s[5], 0, 0, s[6], s[7], s[8], s[9]);
                    default -> (s[0] == 2 ? terrain : model).invoke(null, pixels, (s[4] & 1) != 0 ? small : large,
                        0, 0, s[5], s[6], s[7], s[8], s[9], s[11], s[12], s[13], s[14], s[15], s[16]);
                }
            }
            for (int pixel : pixels) out.writeInt(pixel);
        }
    }
}
