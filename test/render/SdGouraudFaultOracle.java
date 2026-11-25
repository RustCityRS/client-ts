import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;

public class SdGouraudFaultOracle {
    private static Field field(Class<?> type, String name) throws Exception {
        Field f = type.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    public static void main(String[] args) throws Exception {
        Class<?> dc = Class.forName("dc");
        Method span = dc.getDeclaredMethod("a", int[].class, int.class, int.class, int.class,
            int.class, int.class, int.class, int.class);
        span.setAccessible(true);
        try (DataInputStream in = new DataInputStream(Files.newInputStream(Path.of(args[0])));
             DataOutputStream out = new DataOutputStream(new BufferedOutputStream(System.out))) {
            int cases = in.readInt();
            for (int i = 0; i < cases; i++) {
                int size = in.readInt(), low = in.readInt(), alpha = in.readInt(), base = in.readInt();
                int x = in.readInt(), end = in.readInt(), shade = in.readInt(), step = in.readInt();
                int[] palette = size < 0 ? null : new int[size];
                if (palette != null) for (int j = 0;j < size;j++) palette[j] = j * 0x63175A + 1234;
                field(dc,"o").set(null,palette);
                field(dc,"a").setBoolean(null,low != 0);
                field(dc,"e").setInt(null,alpha);
                field(dc,"j").setBoolean(null,false);
                int[] pixels = new int[33];
                for (int j = 0;j < pixels.length;j++) pixels[j] = j * 657438;
                if (size == -2) field(dc,"o").set(null,pixels);
                int fault = Integer.MIN_VALUE;
                try { span.invoke(null,pixels,base,0,0,x,end,shade,step); }
                catch (InvocationTargetException ex) {
                    if (ex.getCause() instanceof ArrayIndexOutOfBoundsException bounds)
                        fault = Integer.parseInt(bounds.getMessage().split(" ")[1]);
                    else if (ex.getCause() instanceof NullPointerException) fault = Integer.MAX_VALUE;
                    else throw ex;
                }
                out.writeInt(fault);
                for (int p : pixels) out.writeInt(p);
            }
            if (args.length > 1 && args[1].equals("triangles")) {
                Method bind = Class.forName("td").getDeclaredMethod("a", int[].class, int.class, int.class);
                Method clip = dc.getDeclaredMethod("d");
                Method triangle = dc.getDeclaredMethod("a", int.class, int.class, int.class, int.class, int.class,
                    int.class, int.class, int.class, int.class);
                bind.setAccessible(true);
                clip.setAccessible(true);
                triangle.setAccessible(true);
                for (boolean low : new boolean[]{false, true}) for (int alpha : new int[]{0, 177}) {
                    int[] pixels = new int[33];
                    for (int j = 0; j < pixels.length; j++) pixels[j] = j * 657438;
                    bind.invoke(null, pixels, 11, 3);
                    clip.invoke(null);
                    field(dc, "a").setBoolean(null, low);
                    field(dc, "e").setInt(null, alpha);
                    field(dc, "o").set(null, pixels);
                    triangle.invoke(null, 0, 3, 1, 0, 4, 10, 0, 7, 9);
                    triangle.invoke(null, 2, 0, 3, 10, 3, 0, 2, 4, 5);
                    for (int p : pixels) out.writeInt(p);
                }
            }
        }
    }
}
