import java.io.*;
import java.lang.reflect.*;
import java.nio.file.*;
import java.util.*;

/** Each command names a method in the original gamepack. Write every pixel after each fixture. */
public class SdPrimitiveOracle {
    static Object construct(Class<?> type, Class<?>[] signature, Object... args) throws Exception {
        Constructor<?> c = type.getDeclaredConstructor(signature);
        c.setAccessible(true);
        return c.newInstance(args);
    }

    static Method method(Class<?> type, String name, Class<?>[] signature) throws Exception {
        for (Class<?> c = type; c != null; c = c.getSuperclass()) {
            try {
                Method m = c.getDeclaredMethod(name, signature);
                m.setAccessible(true);
                return m;
            } catch (NoSuchMethodException ignored) {}
        }
        throw new NoSuchMethodException(type.getName() + "." + name);
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("hd");
        Class<?> raster = Class.forName(hd ? "kb" : "td");
        Class<?> solid = Class.forName(hd ? "mm" : "rh"), alpha = Class.forName(hd ? "am" : "vh");
        Class<?> indexed = Class.forName(hd ? "ek" : "ch"), font = Class.forName(hd ? "dd" : "fg");
        Class<?> i = int.class, a = int[].class, b = byte[].class;
        Class<?>[] sprite = {i,i,i,i,i,i,a};
        Map<String,Object> objects = new HashMap<>();
        int[] pixels = new int[39 * 31], starts = new int[28], lengths = new int[28];
        for (int n = 0; n < starts.length; n++) { starts[n] = n % 3; lengths[n] = 4 + n % 4; }
        byte[][] glyphs = new byte[256][];
        glyphs[65] = new byte[11 * 9];
        int[] sizes = new int[256];
        Arrays.fill(sizes, 11);
        try (DataOutputStream out = new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(Path.of(args[2]))))) {
            for (String line : Files.readAllLines(Path.of(args[1]))) {
                if (line.equals("frame")) {
                    for (int n = 0; n < pixels.length; n++) pixels[n] = (n + 1) * 0x8f72cb09;
                    int[] rgb = new int[99], palette = {0x10203040, 0, 0xffb672ac, 0x3479c2e8, 0x00ffeeb3};
                    byte[] indices = new byte[99];
                    for (int n = 0; n < rgb.length; n++) {
                        rgb[n] = n % 4 == 0 ? 0 : n % 5 == 0 ? 0x998877 : (n + 1) * 0x834c971f;
                        indices[n] = (byte)(n % 5);
                        glyphs[65][n] = (byte)(n % 5 == 0 ? 0 : 153);
                    }
                    objects.put("sprite", construct(solid,sprite,15,11,2,1,11,9,rgb.clone()));
                    objects.put("alpha", construct(alpha,sprite,15,11,2,1,11,9,rgb.clone()));
                    objects.put("indexed", construct(indexed,new Class<?>[]{i,i,i,i,i,i,b,a},15,11,2,1,11,9,indices,palette));
                    objects.put("font", construct(font,new Class<?>[]{b,a,a,a,a,byte[][].class},new byte[257],sizes,sizes,sizes,sizes,glyphs));
                    method(raster,"a",new Class<?>[]{a,i,i}).invoke(null,pixels,39,31);
                    method(raster,hd ? "c" : "b",new Class<?>[]{i,i,i,i}).invoke(null,1,1,37,29);
                } else if (line.equals("save")) {
                    for (int word : pixels) out.writeInt(word);
                } else {
                    String[] parts = line.split(" ");
                    Object receiver = objects.get(parts[0]);
                    String name = parts[hd ? 2 : 1];
                    Object[] values = new Object[parts.length - 3];
                    Class<?>[] types = new Class<?>[values.length];
                    for (int n = 0; n < values.length; n++) {
                        String s = parts[n + 3];
                        if (s.equals("starts") || s.equals("lengths")) { values[n] = s.equals("starts") ? starts : lengths; types[n] = a; }
                        else if (s.equals("true") || s.equals("false")) { values[n] = Boolean.parseBoolean(s); types[n] = boolean.class; }
                        else if (s.contains(".")) { values[n] = Double.parseDouble(s); types[n] = double.class; }
                        else { values[n] = Integer.parseInt(s); types[n] = int.class; }
                    }
                    method(receiver == null ? raster : receiver.getClass(), name, types).invoke(receiver, values);
                }
            }
        }
    }
}
