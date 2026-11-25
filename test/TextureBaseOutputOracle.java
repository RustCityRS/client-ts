import java.lang.reflect.*;
import java.util.ArrayList;
import java.util.List;

public final class TextureBaseOutputOracle {
    static Field field(Class<?> type, String name) throws Exception {
        Field field = type.getDeclaredField(name);
        field.setAccessible(true);
        return field;
    }

    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        Class<?> base = Class.forName(hd ? "j" : "bf");
        Method mono = base.getDeclaredMethod("a", int.class, byte.class);
        Method colour = base.getDeclaredMethod(hd ? "b" : "a", hd ? int.class : boolean.class, int.class);
        mono.setAccessible(true);
        colour.setAccessible(true);
        Object monoReceiver = Class.forName(hd ? "fm" : "fk").getDeclaredConstructor().newInstance();
        Object colourReceiver = Class.forName(hd ? "rj" : "wb").getDeclaredConstructor().newInstance();
        Field hidden = hd ? null : field(base, "E");
        Object initial = hd ? null : hidden.get(null);
        if (!hd && initial == null) throw new AssertionError("missing starting hidden verb");
        List<String> out = new ArrayList<>();
        for (int row : new int[]{Integer.MIN_VALUE, 13, Integer.MAX_VALUE}) {
            for (int i = -128; i < 128; i++)
                out.add(call(mono, monoReceiver, hd, row, (byte)i));
            for (int i : (hd ? new int[]{-2,-1,0,1,Integer.MAX_VALUE} : new int[]{0,1})) {
                if (hidden != null) hidden.set(null, initial);
                Object guard = hd ? (Object)Integer.valueOf(i) : Boolean.valueOf(i != 0);
                out.add(call(colour, colourReceiver, hd, guard, row) + "|" + (hidden == null || hidden.get(null) != null));
            }
        }
        System.out.println(String.join("\n", out));
    }

    static String call(Method method, Object receiver, boolean hd, Object... args) throws Exception {
        try {
            Object result = method.invoke(receiver, args);
            if (result != null) throw new AssertionError("unexpected output");
            return "null";
        } catch (InvocationTargetException failure) {
            Throwable wrapper = failure.getCause();
            if (!wrapper.getClass().getName().equals(hd ? "ld" : "g")) throw failure;
            Throwable cause = (Throwable)field(wrapper.getClass(), hd ? "f" : "a").get(wrapper);
            String context = (String)field(wrapper.getClass(), hd ? "e" : "q").get(wrapper);
            return context + "|" + cause.getClass().getSimpleName() + "|" + cause.getMessage();
        }
    }
}
