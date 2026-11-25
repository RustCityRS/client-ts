import java.lang.reflect.*;

/** The real model, primitive, text, sprite and animation entry points all reach their own guarded CS1 call. */
public final class WidgetConditionOracle {
    static boolean hd;
    static Class<?> widget;
    static Class<?> type(String sd, String gl) throws Exception { return Class.forName(hd ? gl : sd); }
    static Field field(Class<?> owner, String name) throws Exception {
        Field f = owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    static void set(Object target, String sd, String gl, Object value) throws Exception {
        field(widget, hd ? gl : sd).set(target, value);
    }
    static Object guard(int n) { if (hd) return Integer.valueOf(n); return Byte.valueOf((byte)n); }

    static String invoke(Method method, Object... args) throws Exception {
        try { return String.valueOf(method.invoke(null, args)); }
        catch (InvocationTargetException e) {
            Throwable wrapper = e.getCause();
            Throwable cause = (Throwable)field(wrapper.getClass(), hd ? "f" : "a").get(wrapper);
            String context = (String)field(wrapper.getClass(), hd ? "e" : "q").get(wrapper);
            String first = context.split(" ")[0];
            return cause.getClass().getSimpleName() + " " + first;
        }
    }

    public static void main(String[] args) throws Exception {
        hd = args[0].equals("gl");
        widget = type("aj", "be");
        Class<?> slots = Array.newInstance(widget, 0).getClass();
        Class<?> intType = int.class;
        Method active = type("e", "md").getDeclaredMethod("a", widget, hd ? intType : byte.class);
        Method draw = hd ? Class.forName("gn").getDeclaredMethod("a", intType,intType,intType,slots,intType,intType,intType,intType,byte.class,intType)
            : Class.forName("lf").getDeclaredMethod("a", intType,slots,intType,intType,intType,intType,intType,intType,boolean.class,intType);
        Method animate = type("fk", "jd").getDeclaredMethod("a", intType, intType, slots);
        type("td", "kb").getDeclaredMethod("a", int[].class, intType, intType).invoke(null, new int[256], 16, 16);
        ((boolean[])field(type("n", "sc"), hd ? "z" : "i").get(null))[0] = true;
        Object font = type("fg", "dd").getDeclaredConstructor(byte[].class).newInstance((Object)new byte[257]);
        Object cache = field(type("cf", "gn"), hd ? "i" : "f").get(null);
        if (hd) cache.getClass().getDeclaredMethod("a", byte.class,Object.class,long.class).invoke(cache,(byte)-77,font,5L);
        else cache.getClass().getDeclaredMethod("a", long.class,Object.class,byte.class).invoke(cache,5L,font,(byte)-103);
        for (int kind : new int[]{3,4,5,6,7}) {
            Object c = widget.getDeclaredConstructor().newInstance();
            set(c,"ob","I",kind == 7 ? 6 : kind);
            set(c,"n","N",-1); set(c,"C","n",12); set(c,"H","R",12); set(c,"mc","uc",5);
            set(c,"jc","id",3);
            set(c,"bd","Bc",new int[]{0}); set(c,"eb","kd",null);
            Object widgets = Array.newInstance(widget, 1);
            Array.set(widgets, 0, c);
            if (kind == 7) System.out.println(invoke(animate,hd ? 23206 : -1,hd ? -1 : -1970,widgets));
            else if (hd) System.out.println(invoke(draw,0,0,0,widgets,16,-1,0,16,(byte)119,0));
            else System.out.println(invoke(draw,0,widgets,-1,16,0,0,16,0,true,0));
        }
        for (int guard : hd ? new int[]{26,97,69,110,33} : new int[]{-70,125,-117,-17,-74}) {
            System.out.println(invoke(active, null, guard(guard)));
            for (int code : new int[]{0,2,3,4}) for (int target : new int[]{6,7,8}) {
                Object c = widget.getDeclaredConstructor().newInstance();
                set(c,"bd","Bc",new int[]{code}); set(c,"eb","kd",new int[]{target});
                set(c,"Vb","ad",new int[][]{{20,7,0}});
                System.out.println(invoke(active,c,guard(guard)));
            }
        }
    }
}
