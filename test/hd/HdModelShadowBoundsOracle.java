import java.lang.reflect.*;
import java.util.*;

public class HdModelShadowBoundsOracle {
    static void set(td model, String name, Object value) throws Exception {
        Field field = td.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(model, value);
    }

    public static void main(String[] args) throws Exception {
        var constructor = td.class.getDeclaredConstructor();
        constructor.setAccessible(true);
        var shadow = td.class.getDeclaredMethod("a", ek.class);
        shadow.setAccessible(true);
        for (int mode = 0; mode < 19; mode++) {
            td model = constructor.newInstance();
            ae bounds = new ae();
            bounds.h = true; bounds.d = bounds.f = 32;
            set(model, "U", bounds); set(model, "I", 4); set(model, "S", 4); set(model, "lb", 2);
            int[] x = {0, 32, 0, 32}, y = {0, 0, 0, 0}, z = {0, 0, 32, 32};
            int[] offsets = {0, 1, 2, 3, 4};
            short[] indices = {1, 2, 3, 4}, a = {0, 1}, b = {2, 2}, c = {1, 3};
            int[] sz = {-7,-7,-7,-7}, sx = mode == 17 ? sz : mode == 18 ? x : new int[]{-9,-9,-9,-9};
            if (mode == 1) x = null;
            if (mode == 2) y = Arrays.copyOf(y, 2);
            if (mode == 3) z = Arrays.copyOf(z, 1);
            if (mode == 4) offsets = Arrays.copyOf(offsets, 3);
            if (mode == 5) offsets[2] = -1;
            if (mode == 6) indices = Arrays.copyOf(indices, 2);
            if (mode == 7) indices[2] = 0;
            if (mode == 8) indices[2] = -3;
            if (mode == 9) indices[2] = 13;
            if (mode == 10) sx = null;
            if (mode == 11) sx = new int[]{-9,-9};
            if (mode == 12) a = Arrays.copyOf(a, 1);
            if (mode == 13) b[1] = -3;
            if (mode == 14) c[1] = 6;
            if (mode == 15) c = null;
            set(model,"H",x); set(model,"eb",y); set(model,"hb",z);
            set(model,"X",offsets); set(model,"N",indices);
            set(model,"w",a); set(model,"P",b); set(model,"Q",c);
            set(model,"B", mode == 16 ? new byte[]{-7} : new byte[]{-7,0});
            set(null,"ub",sz); set(null,"qb",sx);
            mk.c = mk.d = 0;
            ek sprite = new ek(5,5,0);
            Arrays.fill(sprite.o, (byte)-1);
            String fault = "ok";
            try { shadow.invoke(model, sprite); }
            catch (InvocationTargetException e) {
                Throwable cause = e.getCause();
                if (cause instanceof NullPointerException) fault = "null";
                else if (cause instanceof ArrayIndexOutOfBoundsException)
                    fault = cause.getMessage().split(" ")[1];
                else throw e;
            }
            System.out.println(mode + " " + fault + " " + Arrays.toString(sz) + " " +
                Arrays.toString(sx) + " " + HexFormat.of().formatHex(sprite.o));
        }
    }
}
