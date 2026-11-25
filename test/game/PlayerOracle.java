import java.lang.reflect.*;
import java.util.HexFormat;

class PlayerOracle {
    static Field field(String name) throws Exception {
        String[] parts = name.split("\\.");
        var f = Class.forName(parts[0]).getDeclaredField(parts[1]);
        f.setAccessible(true);
        return f;
    }
    static int value(String name, Object actor) throws Exception {
        Object v = field(name).get(actor);
        return v instanceof int[] array ? array[0] : (Integer)v;
    }
    public static void main(String[] args) throws Exception {
        var ctor = Class.forName("pb").getDeclaredConstructor();
        ctor.setAccessible(true);
        var self = ctor.newInstance();
        field("te.g").set(null, self);
        var players = (Object[])field("tf.J").get(null);
        players[2047] = self;
        field("hh.kb").set(null, 100);
        var buf = field("hd.b").get(null);
        var decode = Class.forName("sc").getDeclaredMethod("e", int.class);
        decode.setAccessible(true);
        var advance = Class.forName("gk").getDeclaredMethod("a", int.class, int.class, Class.forName("ob"));
        advance.setAccessible(true);
        for (String arg : args) {
            if (arg.equals("motion")) {
                for (int i = 0; i < 80; i++) {
                    field("hh.kb").set(null, 101 + i);
                    var actor = players[73];
                    advance.invoke(null, -1, 1, actor);
                    System.out.println(value("ob.Z", actor) + " " + value("ob.S", actor) + " " + value("ob.gb", actor));
                }
                continue;
            }
            var bytes = HexFormat.of().parseHex(arg);
            field("gd.fb").set(buf, bytes);
            field("gd.yb").set(buf, 0);
            field("af.I").set(null, bytes.length);
            decode.invoke(null, -1);
            var actor = players[73];
            var out = new java.util.StringJoiner(" ");
            out.add("" + value("ah.f", null));
            for (String name : new String[]{"ob.L", "ob.ac"}) {
                out.add("" + value(name, self));
            }
            for (String name : new String[]{"ob.L", "ob.ac", "ob.F", "ob.gb", "ob.Bb", "ob.Ob", "ob.Db", "ob.Sb", "ob.eb"}) {
                out.add("" + value(name, actor));
            }
            System.out.println(out);
        }
    }
}
