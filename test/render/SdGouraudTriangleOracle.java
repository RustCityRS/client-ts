import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

// Raw packed pixels after each short ordered sequence of flat and Gouraud triangles in dc.
public class SdGouraudTriangleOracle {
    static Field field(Class<?> owner, String name) throws Exception {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    static Method triangle(Class<?> owner, int count) throws Exception {
        Class<?>[] ints = new Class<?>[count];
        Arrays.fill(ints, int.class);
        Method method = owner.getDeclaredMethod("a", ints);
        method.setAccessible(true);
        return method;
    }
    public static void main(String[] args) throws Exception {
        Class<?> dc = Class.forName("dc"), td = Class.forName("td");
        Method gouraud = triangle(dc,9), flat = triangle(dc,7);
        int[] palette = new int[65536];
        for (int i = 0; i < palette.length; i++) palette[i] = i * 0x181165;
        field(dc,"o").set(null,palette);
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(Files.newInputStream(Path.of(args[0]))));
             DataOutputStream out = new DataOutputStream(new BufferedOutputStream(System.out))) {
            int width = in.readInt(), height = in.readInt(), frames = in.readInt();
            field(td,"c").setInt(null,width);
            field(td,"i").setInt(null,height);
            for (int f = 0; f < frames; f++) {
                int[] pixels = new int[width * height];
                for (int i = 0; i < pixels.length; i++) pixels[i] = i * 0x913a7811 ^ f;
                field(td,"g").set(null,pixels);
                int left = in.readInt(), top = in.readInt(), w = in.readInt(), h = in.readInt();
                int[] rows = new int[h];
                for (int y = 0; y < h; y++) rows[y] = left + (y + top) * width;
                field(dc,"d").set(null,rows);
                field(dc,"p").setInt(null,w);
                field(dc,"q").setInt(null,h);
                for (int remaining = in.readInt(); remaining > 0; remaining--) {
                    int count = in.readInt();
                    field(dc,"j").setBoolean(null,in.readInt()!=0);
                    field(dc,"a").setBoolean(null,in.readInt()!=0);
                    field(dc,"e").setInt(null,in.readInt());
                    Object[] geometry = new Object[count];
                    for (int i = 0; i < count; i++) geometry[i] = in.readInt();
                    (count == 9 ? gouraud : flat).invoke(null,geometry);
                }
                for (int pixel : pixels) out.writeInt(pixel);
            }
        }
    }
}
