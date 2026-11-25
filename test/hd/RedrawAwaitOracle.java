import java.lang.reflect.*;

public final class RedrawAwaitOracle {
    static Field field(Class<?> owner, String name) throws ReflectiveOperationException {
        Field f=owner.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }
    public static void main(String[] args) throws Exception {
        boolean hd = args[0].equals("gl");
        Class<?> vm = Class.forName("sun.misc.Unsafe");
        Field singleton = vm.getDeclaredField("theUnsafe");
        singleton.setAccessible(true);
        Object shell = vm.getMethod("allocateInstance",Class.class).invoke(singleton.get(null),Class.forName("client"));
        field(Class.forName(hd ? "ol" : "ka"),hd ? "fb" : "k").setInt(null,51);
        Method redraw = Class.forName(hd ? "rc" : "p").getDeclaredMethod("e",int.class);
        redraw.setAccessible(true);
        try { redraw.invoke(shell,hd ? 0 : -10911); throw new AssertionError("unexpected draw"); }
        catch (InvocationTargetException e) {
            Object wrapper=e.getCause();
            Throwable cause=(Throwable)field(wrapper.getClass(),hd ? "f" : "a").get(wrapper);
            if (!(cause instanceof NullPointerException)) throw e;
            System.out.println(field(wrapper.getClass(),hd ? "e" : "q").get(wrapper));
        }
    }
}
