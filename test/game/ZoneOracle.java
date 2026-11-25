import java.lang.reflect.*;
import java.util.HexFormat;

class ZoneOracle {
    static Field field(String name) throws Exception {
        var parts = name.split("\\.");
        var f = Class.forName(parts[0]).getDeclaredField(parts[1]);
        f.setAccessible(true);
        return f;
    }
    static Method method(String name, Class<?>... args) throws Exception {
        var parts = name.split("\\.");
        var m = Class.forName(parts[0]).getDeclaredMethod(parts[1], args);
        m.setAccessible(true);
        return m;
    }
    public static void main(String[] args) throws Exception {
        int plane = 2, x = 51, z = 77;
        field("kl.Bb").set(null, Array.newInstance(Class.forName("ra"), 4, 104, 104));
        field("dg.C").set(null, 48);
        field("ha.a").set(null, 72);
        field("ah.f").set(null, plane);
        field("mi.y").set(null, 1);
        var source = field("hd.b").get(null);
        var ctor = Class.forName("kl").getDeclaredConstructor();
        ctor.setAccessible(true);
        for (int id : new int[]{0x1234, 0x1235, 0x1236, 0x1237}) {
            var obj = ctor.newInstance();
            field("kl.h").set(obj, id == 0x1234 ? 1 : 12);
            field("kl.ib").set(obj, id == 0x1234 ? 1 : 0);
            method("ve.a", long.class, Object.class, byte.class).invoke(field("fa.b").get(null), (long)id, obj, (byte)-71);
        }
        var decode = method("qd.a", int.class);
        for (String arg : args) {
            var hex = arg.split("-");
            field("o.Y").set(null, Integer.parseInt(hex[0]));
            field("gd.fb").set(source, HexFormat.of().parseHex(hex[1]));
            field("gd.yb").set(source, 0);
            decode.invoke(null, 64);
            var tile = ((Object[][][])field("kl.Bb").get(null))[plane][x][z];
            var pile = tile == null ? null : field("ra.y").get(tile);
            var out = new java.util.StringJoiner(",");
            if (pile != null) {
                for (String name : new String[]{"mh.k", "mh.b", "mh.f"}) {
                    var item = field(name).get(pile);
                    if (item != null) out.add(field("ig.m").getInt(item) + ":" + field("ig.p").getInt(item));
                }
            }
            System.out.println(out);
        }
    }
}
