import java.lang.reflect.Field;

public final class CacheMaintenanceOracle {
    private static final String[] names = {
        "ik.U", "vj.h", "hh.S", "he.w", "lj.c", "vf.T", "uj.f", "gf.Z", "uk.k", "pb.xc", "fa.b", "ra.M", "gb.r", "ga.B", "gl.x", "r.V", "m.O", "cd.d", "vf.S", "ig.n", "hj.f", "mk.A", "ak.d", "r.X", "ii.i", "vk.S", "gl.u", "bj.b", "gf.S", "cf.f", "te.a", "ml.w", "wk.o", "fa.p"
    };
    private static final Field[] fields = new Field[names.length];
    private static final ve[] caches = new ve[names.length];
    private static final Object value = new Object();
    private static Field table;
    private static Field remaining;

    private static Field field(Class<?> type, String name) throws Exception {
        Field f = type.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    private static void reset() throws Exception {
        for (int i = 0; i < fields.length; i++) {
            caches[i] = new ve(2);
            fields[i].set(null, caches[i]);
            caches[i].a(1L, value, (byte)-71);
        }
    }

    private static void snapshot(String event) throws Exception {
        StringBuilder row = new StringBuilder(event);
        for (ve cache : caches) {
            mk node = (mk)((nc)table.get(cache)).a((byte)-82, 1L);
            row.append(node.d(true) ? " s" : " h").append(node.v);
        }
        System.out.println(row);
    }

    public static void main(String[] args) throws Exception {
        table = field(ve.class, "o");
        remaining = field(ve.class, "p");
        Field capacity = field(ve.class, "a");
        StringBuilder sizes = new StringBuilder("capacity");
        for (int i = 0; i < names.length; i++) {
            int split = names[i].indexOf('.');
            fields[i] = field(Class.forName(names[i].substring(0, split)), names[i].substring(split + 1));
            sizes.append(' ').append(capacity.getInt(fields[i].get(null)));
        }
        System.out.println(sizes);
        for (int i = 0; i < fields.length; i++) {
            reset();
            fields[i].set(null, null);
            try {
                ea.a(false);
                throw new AssertionError(names[i]);
            } catch (RuntimeException expected) {
                snapshot("stop" + i);
            }
        }
        reset();
        for (int tick = 0; tick <= 52; tick++) {
            if (tick != 0) ea.a(false);
            snapshot("tick" + tick);
            if (tick == 6 || tick == 50) {
                for (int i : new int[]{0, 10, 28}) {
                    if (caches[i].a(1L, false) != value) throw new AssertionError(names[i]);
                }
            }
        }
        for (int interrupted = 0; interrupted <= fields.length; interrupted++) {
            reset();
            for (ve cache : caches) {
                cache.a(0, 100);
                cache.a(2L, value, (byte)-71);
            }
            if (interrupted < fields.length) fields[interrupted].set(null, null);
            try {
                gf.f(-1);
                if (interrupted < fields.length) throw new AssertionError(names[interrupted]);
            } catch (RuntimeException e) {
                if (interrupted == fields.length) throw e;
            }
            if (interrupted == fields.length) gf.f(-1);
            StringBuilder row = new StringBuilder("removeSoft" + interrupted);
            for (ve cache : caches) {
                nc entries = (nc)table.get(cache);
                mk first = (mk)entries.a((byte)-82, 1L);
                mk second = (mk)entries.a((byte)-82, 2L);
                row.append(' ').append(first == null ? '-' : first.d(true) ? 's' : 'h')
                   .append(second == null ? '-' : second.d(true) ? 's' : 'h')
                   .append(remaining.getInt(cache));
            }
            System.out.println(row);
        }
    }
}
