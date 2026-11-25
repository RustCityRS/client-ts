import java.io.DataOutputStream;
import java.lang.reflect.Array;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.IdentityHashMap;

/** Exercise independent tile arrays directly on ra/bj, including old references after field replacement. */
public final class SquareSpanOracle {
    private static void holder(DataOutputStream output, String className, String hdField) throws Exception {
        Class<?> type = Class.forName(className);
        Constructor<?> constructor = type.getDeclaredConstructor();
        constructor.setAccessible(true);
        Object value = constructor.newInstance();
        int size = 0;
        for (Field field : type.getDeclaredFields()) {
            if (!Modifier.isStatic(field.getModifiers())) size++;
        }
        output.writeInt(size);
        if (hdField == null) return;
        Field field = type.getDeclaredField(hdField);
        field.setAccessible(true);
        output.writeInt(field.getType() == boolean.class ? (field.getBoolean(value) ? 1 : 0) : (field.get(value) == null ? -1 : 1));
    }

    private static void bounds(DataOutputStream output, int[] span, int index) throws Exception {
        try {
            output.writeInt(span[index]);
            throw new AssertionError("accepted load at " + index);
        } catch (ArrayIndexOutOfBoundsException expected) {
            output.writeInt(index);
        }
        try {
            span[index] = 0x6aa55aa6;
            throw new AssertionError("accepted store at " + index);
        } catch (ArrayIndexOutOfBoundsException expected) {
            output.writeInt(index);
        }
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        Class<?> tile = Class.forName(hd ? "bj" : "ra");
        Constructor<?> constructor = tile.getDeclaredConstructor(int.class, int.class, int.class);
        Field span = tile.getDeclaredField(hd ? "P" : "A");
        Field sprites = tile.getDeclaredField(hd ? "w" : "H");
        String[] names = hd ? new String[]{"W", "Q", "R", "H", "D"} : new String[]{"K", "N", "w", "v", "P"};
        Field[] coords = new Field[names.length];
        constructor.setAccessible(true);
        span.setAccessible(true);
        sprites.setAccessible(true);
        for (int i = 0; i < names.length; i++) {
            coords[i] = tile.getDeclaredField(names[i]);
            coords[i].setAccessible(true);
        }
        DataOutputStream output = new DataOutputStream(System.out);
        holder(output, hd ? "bm" : "pk", hd ? "n" : null);
        holder(output, hd ? "sm" : "wj", hd ? "a" : null);
        Object[] tiles = new Object[385];
        int[][] saved = new int[tiles.length][];
        IdentityHashMap<Object, Boolean> arrays = new IdentityHashMap<>();
        for (int i = 0; i < tiles.length; i++) {
            Object value = tiles[i] = constructor.newInstance(i - 193, Integer.MAX_VALUE - i, Integer.MIN_VALUE + i);
            for (Field coord : coords) output.writeInt(coord.getInt(value));
            Object[] objects = (Object[])sprites.get(value);
            int[] flags = saved[i] = (int[])span.get(value);
            output.writeInt(objects.length);
            output.writeInt(Arrays.hashCode(objects));
            output.writeInt(flags.length);
            output.writeInt(Arrays.hashCode(flags));
            if (arrays.put(objects, true) != null || arrays.put(flags, true) != null) throw new AssertionError("shared tile array");
            for (int j = 0; j < flags.length; j++) flags[j] = i * -1640531527 + j;
        }
        output.writeInt(arrays.size());
        for (int i = 0; i < tiles.length; i++) {
            int[] flags = saved[i];
            bounds(output, flags, -1);
            bounds(output, flags, 5);
            if (i % 17 == 0) {
                span.set(tiles[i], new int[5]);
                flags[2] ^= -1;
            }
        }
        for (int i = 0; i < tiles.length; i++) {
            for (int n : saved[i]) output.writeInt(n);
            for (int n : (int[])span.get(tiles[i])) output.writeInt(n);
        }
        for (boolean readFirst : new boolean[]{false, true}) {
            Object tileValue = constructor.newInstance(0, 0, 0);
            Object[] oldObjects = readFirst ? (Object[])sprites.get(tileValue) : null;
            int[] oldFlags = readFirst ? (int[])span.get(tileValue) : null;
            sprites.set(tileValue, null);
            span.set(tileValue, null);
            try {
                output.writeInt(((Object[])sprites.get(tileValue))[-1] == null ? 0 : 1);
            } catch (NullPointerException expected) {
                output.writeInt(-1);
            }
            try {
                ((int[])span.get(tileValue))[5] = 7;
                output.writeInt(1);
            } catch (NullPointerException expected) {
                output.writeInt(-1);
            }
            Object[] substitute = (Object[])Array.newInstance(sprites.getType().getComponentType(), 1);
            int[] flags = {17};
            sprites.set(tileValue, substitute);
            span.set(tileValue, flags);
            output.writeInt(sprites.get(tileValue) == substitute && span.get(tileValue) == flags ? 1 : 0);
            output.writeInt(oldObjects == null ? -1 : oldObjects.length);
            if (oldFlags != null) oldFlags[0] = 42;
            output.writeInt(((int[])span.get(tileValue))[0]);
        }
        output.flush();
    }
}
