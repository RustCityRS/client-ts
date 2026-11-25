import java.lang.reflect.Field;

// Four real th.draw callbacks in ub.a(bj,Z) observe jf's selected level. Each
// callback can change tf.w before the subsequent model or raised object pile.
public class FillRendererFlagOracle {
    static final StringBuilder events = new StringBuilder();
    static Field lastLevel;
    static int mask;

    static class Model extends th {
        final int id;
        Model(int id) { this.id = id; }
        void a(int a, int b, int c, int d, int e) {}
        int b() { return 0; }
        void a(int a, int b, int c, int d, int e, int x, int y, int z, long key, int level, ga particles) {
            try {
                events.append(' ').append(id).append('/').append(tf.w ? 1 : 0).append('/').append(lastLevel.getInt(null));
                lastLevel.setInt(null, -1);
                tf.w = (mask & (1 << (id + 1))) != 0;
            } catch (IllegalAccessException ex) { throw new AssertionError(ex); }
        }
    }

    public static void main(String[] args) throws Exception {
        lastLevel = jf.class.getDeclaredField("i");
        lastLevel.setAccessible(true);
        // The game's 2D orthographic state makes depth-bias updates return before calling JOGL.
        Field ortho = tf.class.getDeclaredField("o");
        ortho.setAccessible(true);
        ortho.setBoolean(null, true);
        od.c = true;
        jf.a(1, 1, 1);
        jf.f();
        gj.m = new int[1][2][2];
        gf.O = null;
        jm.r = 1;
        kc.o = new bj[1][1][1];
        for (mask = 0; mask < 32; mask++) {
            tf.w = (mask & 1) != 0;
            lastLevel.setInt(null, -1);
            events.setLength(0);
            bj square = kc.o[0][0][0] = new bj(0, 0, 0);
            square.x = square.A = true;
            bj bridge = square.M = new bj(0, 0, 0);
            bridge.K = new jh();
            bridge.K.e = new Model(0);
            for (int i = 0; i < 2; i++) {
                ec sprite = bridge.w[i] = new ec();
                sprite.c = new Model(i + 1);
            }
            bridge.y = 2;
            square.X = new jj();
            square.X.n = 1;
            square.X.a = new Model(3);
            rc.p = 1;
            ub.a(square, false);
            System.out.println(mask + events.toString() + " end/" + (tf.w ? 1 : 0) + "/" + rc.p);
        }
    }
}
