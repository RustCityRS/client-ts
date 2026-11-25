import java.lang.reflect.*;

class ProjectileOracle {
    static Field field(String s) throws Exception {
        var parts = s.split("\\.");
        var f = Class.forName(parts[0]).getDeclaredField(parts[1]);
        f.setAccessible(true);
        return f;
    }
    public static void main(String[] args) throws Exception {
        var gfx = Class.forName("li").getDeclaredConstructor();
        gfx.setAccessible(true);
        var put = Class.forName("ve").getDeclaredMethod("a", long.class, Object.class, byte.class);
        put.setAccessible(true);
        put.invoke(field("r.V").get(null), 1L, gfx.newInstance(), (byte)-71);
        var i = int.class;
        var type = Class.forName("hl");
        var ctor = type.getDeclaredConstructor(i,i,i,i,i,i,i,i,i,i,i);
        ctor.setAccessible(true);
        var target = type.getDeclaredMethod("a", byte.class,i,i,i,i);
        var advance = type.getDeclaredMethod("a", byte.class,i);
        advance.setAccessible(true);
        target.setAccessible(true);
        for (int pitch = -1; pitch < 255; pitch++) {
            var p = ctor.newInstance(1, 0, 2000, 3000, -70, 100, 140, pitch, 24, 0, 0);
            target.invoke(p, (byte)-117, 2500, -20, 2700, 100);
            System.out.println(Long.toHexString(Double.doubleToRawLongBits(field("hl.F").getDouble(p))));
            for (int tick=100; tick<=140; tick++) {
                if (tick == 110 || tick == 130) target.invoke(p,(byte)-117,2500+tick,-30,2700-tick,tick);
                advance.invoke(p, (byte)28, 1);
                System.out.println((int)field("hl.O").getDouble(p) + " " + (int)field("hl.L").getDouble(p) + " " +
                    (int)field("hl.v").getDouble(p) + " " + field("hl.o").getInt(p) + " " + field("hl.M").getInt(p));
            }
        }
    }
}
