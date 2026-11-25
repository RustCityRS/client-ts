import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;

class RequestOracle {
    static Field f(String owner, String name) throws Exception {
        Field f = Class.forName(owner).getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static Method m(String owner, String name, Class<?>... types) throws Exception {
        Method m = Class.forName(owner).getDeclaredMethod(name, types);
        m.setAccessible(true);
        return m;
    }

    static String invoke(Method m, Object receiver, Object... args) throws Exception {
        try {
            Object value = m.invoke(receiver, args);
            if (value instanceof byte[]) return value == f("gd","fb").get(f("fd","P").get(receiver)) ? "same" : "different";
            return String.valueOf(value);
        } catch (InvocationTargetException e) { return "exception"; }
    }

    public static void main(String[] args) throws Exception {
        Constructor<?> ctor = Class.forName("fd").getDeclaredConstructor();
        ctor.setAccessible(true);
        Constructor<?> buffer = Class.forName("gd").getDeclaredConstructor(byte[].class);
        buffer.setAccessible(true);
        Object request = ctor.newInstance();
        Method percent = m("fd","c",byte.class), data = m("fd","e",int.class);
        System.out.println(f("df","D").get(request) + " " + f("df","E").get(request) + " " + f("df","I").get(request) +
            " " + f("fd","U").get(request) + " " + f("fd","M").get(request) + " " + invoke(percent,request,(byte)-52) + " " + invoke(data,request,0));
        for (int size : new int[]{0, 3, 16}) {
            Object packet = buffer.newInstance(new byte[size]);
            f("fd","P").set(request,packet);
            for (int pad : new int[]{-2,0,2,3,16}) {
                f("fd","M").setByte(request,(byte)pad);
                for (int pos : new int[]{-1,0,1,2,3,14,16,Integer.MAX_VALUE}) {
                    f("gd","yb").setInt(packet,pos);
                    for (boolean incomplete : new boolean[]{false,true}) {
                        f("df","D").setBoolean(request,incomplete);
                        System.out.println(invoke(percent,request,(byte)-52) + " " + invoke(data,request,0));
                    }
                }
            }
        }
        Method now = m("eh","a",int.class);
        for (long adjustment : new long[]{0L,-1000L,Long.MAX_VALUE}) {
            f("eh","a").setLong(null,Long.MAX_VALUE);
            f("eh","b").setLong(null,adjustment);
            System.out.println(invoke(now,null,19644));
        }
    }
}
