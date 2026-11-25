import java.lang.reflect.*;

public final class LevelVisibilityOracle {
    static Field field(String owner,String name) throws ReflectiveOperationException {
        Field f=Class.forName(owner).getDeclaredField(name); f.setAccessible(true); return f;
    }
    static Method method(String owner,String name,Class<?>... signature) throws ReflectiveOperationException {
        Method m=Class.forName(owner).getDeclaredMethod(name,signature); m.setAccessible(true); return m;
    }

    public static void main(String[] args) throws ReflectiveOperationException {
        boolean hd=args[0].equals("gl");
        Field active=hd?field("tf","w"):null, saved=hd?field("ml","ab"):field("rj","l");
        Field low=hd?field("gn","d"):field("uj","j");
        Method get=hd?method("km","f",int.class):method("dl","a",boolean.class);
        Method set=hd?method("ec","a",int.class,boolean.class):method("pb","a",byte.class,boolean.class);
        for (int bits=0;bits<32;bits++) {
            saved.setBoolean(null,(bits&1)!=0);
            low.setBoolean(null,(bits&2)!=0);
            if (hd) active.setBoolean(null,(bits&4)!=0);
            boolean before=(boolean)(hd?get.invoke(null,42):get.invoke(null,true));
            if (hd) set.invoke(null,96,(bits&8)!=0);
            else set.invoke(null,(byte)-87,(bits&8)!=0);
            boolean effective=(boolean)(hd?get.invoke(null,42):get.invoke(null,true));
            if (hd) active.setBoolean(null,(bits&16)!=0);
            boolean afterSwitch=(boolean)(hd?get.invoke(null,42):get.invoke(null,true));
            System.out.println(bits+" "+before+" "+saved.getBoolean(null)+" "+low.getBoolean(null)+" "+effective+" "+afterSwitch);
        }
    }
}
