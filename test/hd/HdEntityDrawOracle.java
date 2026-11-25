import java.util.ArrayList;
import java.util.List;

// Leave the original entity, definition, JS5 and cache classes intact. A model records the
// call boundary at which these three original methods hand their work to the renderer.
class HdEntityDrawOracle {
    static final List<String> events = new ArrayList<>();
    static final ga caller = new ga(), owned = new ga();
    static int fault;

    static final class Model extends ak {
        final int tag;
        Model(int tag) { this.tag = tag; }
        int b() {
            events.add("height " + tag);
            if (fault == 2) throw new IllegalStateException();
            return -tag;
        }
        void a(int a, int b, int c, int d, int e, int f, int g, int h, long key, int plane, ga particles) {
            events.add("draw " + tag + " " + a + "," + b + "," + c + "," + d + "," + e + "," + f + "," + g + "," + h + "," + key + "," + plane + "," + (particles == caller ? "caller" : particles == owned ? "owned" : "null"));
            if (fault == 1) throw new IllegalStateException();
        }
        ak a(boolean alpha, boolean colour, boolean normals) {
            events.add("copy " + tag + " " + alpha + "," + colour + "," + normals);
            return this;
        }
        void d(int pitch) { events.add("pitch " + pitch); }
        void b(int x, int y, int z) { events.add("scale " + x + "," + y + "," + z); }
        void i() { events.add("rotate90"); }

        int c() { throw new AssertionError(); }
        boolean d() { throw new AssertionError(); }
        void e() { throw new AssertionError(); }
        void b(int n) { throw new AssertionError(); }
        void f() { throw new AssertionError(); }
        int g() { throw new AssertionError(); }
        int h() { throw new AssertionError(); }
        void c(int n) { throw new AssertionError(); }
        int j() { throw new AssertionError(); }
        void a(int a, int b, int c, int d) { throw new AssertionError(); }
        ak b(boolean a, boolean b, boolean c) { throw new AssertionError(); }
        void a(int a, int[] b, int c, int d, int e, boolean f) { throw new AssertionError(); }
        void a(int a, int b, int c, int d, int e, int f, int g, long h) { throw new AssertionError(); }
        ak c(boolean a, boolean b, boolean c) { throw new AssertionError(); }
        void c(int a, int b, int c) { throw new AssertionError(); }
        int k() { throw new AssertionError(); }
        void a(int a, int[] b, int c, int d, int e, boolean f, int g, int[] h) { throw new AssertionError(); }
        void l() { throw new AssertionError(); }
    }

    static void field(Object target, String name, Object value) throws Exception {
        var member = target.getClass().getDeclaredField(name);
        member.setAccessible(true);
        member.set(target, value);
    }

    static void draw(th entity, int step, int error) {
        fault = error;
        events.clear();
        events.add("before " + entity.b());
        try {
            entity.a(step, -2, 3, -4, 5);
            entity.a(step, -2, 3, -4, 5, -6, 7, -8, Long.MIN_VALUE + step, 2, (step & 1) == 0 ? caller : null);
        } catch (ld wrapped) {
            if (!(wrapped.f instanceof IllegalStateException)) throw wrapped;
            events.add(wrapped.e);
        }
        events.add("after " + entity.b());
        System.out.println(String.join("|", events));
    }

    public static void main(String[] args) throws Exception {
        tf.w = true;
        ve missing = new ve(new v() {
            ii b(int guard) { return null; }
            void a(int id, int guard) { throw new AssertionError(); }
            int b(int id, int guard) { throw new AssertionError(); }
            byte[] c(int id, int guard) { throw new AssertionError(); }
        }, true, true);
        sj.r = he.cb = missing;
        for (int id = 1; id <= 3; id++) {
            h type = new h();
            type.Y = id;
            if (id == 1) {
                type.tb = new int[10];
                type.z = new int[10];
                type.tb[0] = 2;
                type.z[0] = 5;
            }
            cb.Y.a((byte)-107, type, id);
            if (id != 3) tl.c.a((byte)-123, new Model(10 * id), id);

            eg spot = new eg();
            spot.m = id;
            field(spot, "b", 96);
            field(spot, "n", 160);
            field(spot, "q", 90);
            wk.t.a((byte)-109, spot, id);
            if (id != 3) ef.b.a((byte)-96, new Model(30 + id), id);
        }
        uj item = new uj();
        item.D = 1;
        int step = 0;
        for (int count : new int[]{1,4,5,12}) { item.v = count; draw(item, step++, 0); }
        item.D = 3;
        draw(item, step++, 0);
        item.D = 1;
        draw(item, step++, 1);
        draw(item, step++, 2);
        for (int id : new int[]{1,3}) {
            bh spot = new bh(id,0,64,64,0,0,1);
            ra projectile = new ra(id,0,64,64,0,0,8,-1,0,0,0);
            field(spot, "y", owned);
            field(projectile, "Q", owned);
            field(projectile, "ab", 511);
            for (int error : new int[]{0,1,2}) {
                draw(spot, step++, error);
                draw(projectile, step++, error);
            }
            tk sequence = new tk();
            sequence.G = new int[]{1, 3, 5};
            sequence.g = new int[]{100, 200, 300};
            field(spot, "J", sequence);
            spot.T = false;
            var frame = bh.class.getDeclaredField("B");
            var cycle = bh.class.getDeclaredField("U");
            frame.setAccessible(true);
            cycle.setAccessible(true);
            for (int delta : new int[]{0, 1, 1, 2, 5, 2, Integer.MAX_VALUE}) {
                spot.a(true, delta);
                System.out.println("advance " + frame.getInt(spot) + " " + cycle.getInt(spot) + " " + spot.T);
            }
        }
    }
}
