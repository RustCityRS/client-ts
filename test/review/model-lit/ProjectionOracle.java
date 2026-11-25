import java.lang.reflect.Field;
import java.util.Arrays;

// Observe the original fc world projection before its Render2 exception handler.
public class ProjectionOracle {
    static final String[] arrays = {"U", "q", "v", "Jb", "Cb", "Bb", "Fb", "rb", "Mb"};
    static final int[][] source = {{-3, 7, 1}, {-4, 5, 0}, {-52, -49, 40}};

    static Field field(String name) throws Exception {
        Field f = fc.class.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static void number(fc model, String name, int value) throws Exception {
        Field f = field(name);
        if (f.getType() == short.class) f.setShort(model, (short)value);
        else f.setInt(model, value);
    }

    static void sample(int mode, int cut, int length) throws Exception {
        fc model = new fc();
        field("K").setBoolean(model, true);
        number(model, "D", 3);
        number(model, "F", mode == 0 ? 0 : 1);
        number(model, "C", mode == 0 ? 30 : 60);
        for (String n : new String[]{"Q", "p", "S"}) number(model, n, -60);
        for (String n : new String[]{"B", "w", "o"}) number(model, n, 60);
        model.j = true;
        oc.m = true;
        rg.g = ud.d = dd.r = 0;
        pf.W = new long[mode == 3 ? 0 : 2];
        int[][] storage = new int[arrays.length][];
        for (int i = 0; i < storage.length; i++) {
            int size = i == cut ? length : 3;
            if (size >= 0) {
                storage[i] = new int[size];
                if (i < 3) System.arraycopy(source[i], 0, storage[i], 0, size);
                else Arrays.fill(storage[i], -770 - i);
            }
            if (mode == 2 && i == 4) storage[i] = storage[3];
            if (mode == 2 && i == 8) storage[i] = storage[2];
            field(arrays[i]).set(i < 3 ? model : null, storage[i]);
        }
        String outcome = "ok";
        try { model.a(0, 0, 65536, 0, 65536, 0, 0, 100, 71L, 0, null); }
        catch (NullPointerException e) { outcome = "null"; }
        catch (ArrayIndexOutOfBoundsException e) { outcome = "bounds"; }
        StringBuilder row = new StringBuilder(mode+" "+cut+" "+length+" "+outcome+" "+dd.r+" "+Arrays.hashCode(pf.W));
        for (int[] a : storage) row.append(' ').append(Arrays.hashCode(a));
        System.out.println(row);
    }

    public static void main(String[] args) throws Exception {
        td.a(new int[320 * 240], 320, 240);
        dc.d();
        for (int mode = 0; mode < 4; mode++)
            for (int cut = 0; cut < arrays.length; cut++)
                for (int length : new int[]{-1, 0, 1, 2, 3}) sample(mode, cut, length);
    }
}
