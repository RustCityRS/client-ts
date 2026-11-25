import java.io.*;
import java.lang.reflect.*;
import java.util.HexFormat;

class MovementOracle {
    static Field field(String name) throws Exception {
        String[] parts = name.split("\\.");
        var f = Class.forName(parts[0]).getDeclaredField(parts[1]);
        f.setAccessible(true);
        return f;
    }
    static Object make(String name) throws Exception {
        var ctor = Class.forName(name).getDeclaredConstructor();
        ctor.setAccessible(true);
        return ctor.newInstance();
    }
    static Method method(String name, Class<?>... args) throws Exception {
        String[] parts = name.split("\\.");
        var m = Class.forName(parts[0]).getDeclaredMethod(parts[1], args);
        m.setAccessible(true);
        return m;
    }
    static void place(Object actor, int x, int z) throws Exception {
        ((int[])field("ob.L").get(actor))[0] = x;
        ((int[])field("ob.ac").get(actor))[0] = z;
    }
    public static void main(String[] args) throws Exception {
        var in = new DataInputStream(new BufferedInputStream(System.in));
        var i = int.class;
        var b = byte.class;
        var self = make("pb");
        field("te.g").set(null, self);
        var ctor = Class.forName("ke").getDeclaredConstructor(i, i);
        ctor.setAccessible(true);
        var map = ctor.newInstance(104, 104);
        ((Object[])field("hc.c").get(null))[0] = map;
        var flags = (int[][])field("ke.d").get(map);
        for (int x = 0; x < 104; x++) {
            for (int z = 0; z < 104; z++) flags[x][z] = in.readInt();
        }
        var npc = make("bk");
        var player = make("pb");
        int id = 407;
        ((Object[])field("uc.l").get(null))[id] = npc;
        ((Object[])field("tf.J").get(null))[id] = player;
        ((long[])field("sa.z").get(null))[0] = id;
        var buf = field("qk.v").get(null);
        method("be.a", int[].class, i).invoke(buf, new int[]{1, 2, 3, 4}, -7);
        var route = method("hj.a", i, i, i, i, b, boolean.class, i, i, i, i, i, i);
        var action = method("bd.c", i, i);
        int[] npcActions = {49, 19, 14, 29, 4};
        int[] playerActions = {33, 8, 51, 9, 31, 40, 34, 17};
        int[] locActions = {20, 11, 58, 45, 1003, 1004};
        int[] objActions = {21, 25, 7, 35, 43, 1006};
        var loc = make("jb");
        field("jb.fb").set(loc, 3);
        field("jb.y").set(loc, 2);
        field("jb.tb").set(loc, 5);
        method("ve.a", long.class, Object.class, b).invoke(field("he.w").get(null), (long)id, loc, (byte)-71);
        field("hk.e").set(null, 3072);
        field("vj.t").set(null, 3168);
        var widget = make("aj");
        field("l.E").set(field("aj.Sc").get(widget), 0x7fe);
        var widgets = Array.newInstance(widget.getClass(), 2, 260);
        Array.set(Array.get(widgets, 1), 259, widget);
        field("fk.ab").set(null, widgets);
        var children = Array.newInstance(widget.getClass(), 3);
        Array.set(children, 2, widget);
        field("aj.pb").set(widget, children);
        int component = (1 << 16) + 259;
        int count = in.readInt();
        for (int test = 0; test < count; test++) {
            field("gd.yb").set(buf, 0);
            int width = in.readUnsignedByte(), sx = in.readUnsignedByte(), sz = in.readUnsignedByte();
            int tx = in.readUnsignedByte(), tz = in.readUnsignedByte(), op = in.readUnsignedByte();
            boolean ctrl = in.readBoolean();
            ((boolean[])field("ob.q").get(null))[82] = ctrl;
            field("ob.A").set(self, width);
            place(self, sx, sz);
            place(npc, tx, tz);
            place(player, tx, tz);
            ((long[])field("sa.z").get(null))[0] = id;
            ((int[])field("ml.x").get(null))[0] = component;
            if (op == 0) route.invoke(null, 0, tz, tx, 0, (byte)-6, true, 0, 0, sz, 0, 0, sx);
            else if (op <= 13) {
                int menu = op <= 5 ? npcActions[op - 1] : playerActions[op - 6];
                ((short[])field("p.u").get(null))[0] = (short)menu;
                action.invoke(null, 2, 0);
            } else if (op <= 23) {
                method("bd.a", Class.forName("id"), i, i, i, i).invoke(null, null, 10, 2, component, op - 13);
            } else if (op == 24) {
                ((short[])field("p.u").get(null))[0] = 13;
                action.invoke(null, 2, 0);
            } else if (op == 25) method("af.a", b, i, i).invoke(null, (byte)92, 2, component);
            else {
                int shape = test % 23, angle = test / 7 % 4, menu;
                ((int[])field("mh.h").get(null))[0] = tx;
                ((int[])field("ml.x").get(null))[0] = tz;
                if (op <= 31) {
                    menu = locActions[op - 26];
                    ((long[])field("sa.z").get(null))[0] = op == 31 ? id : ((long)id << 32) | (shape << 14) | (angle << 20);
                } else if (op <= 37) menu = objActions[op - 32];
                else {
                    menu = 57;
                    ((long[])field("sa.z").get(null))[0] = 1;
                    field("a.e").set(null, -41);
                    field("ca.n").set(null, 18);
                    field("df.B").set(null, 1856);
                    field("ag.e").set(null, -15);
                    field("kk.db").set(null, 46);
                    field("ob.Z").set(self, sx * 128 + width * 64);
                    field("ob.S").set(self, sz * 128 + width * 64);
                }
                ((short[])field("p.u").get(null))[0] = (short)menu;
                action.invoke(null, 2, 0);
            }
            var data = (byte[])field("gd.fb").get(buf);
            System.out.println(HexFormat.of().formatHex(data, 0, field("gd.yb").getInt(buf)));
        }
    }
}
