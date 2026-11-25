import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;

// Execute the original cache classes. Retain the outer array, original rows and
// individual channels independently, just as separate texture operators can.
class ScanlineCacheOracle {
    private static final Field COLOUR_PIXELS = field(pi.class, "a");
    private static final Field MONO_PIXELS = field(wk.class, "v");
    private final IdentityHashMap<Object, Integer> ids = new IdentityHashMap<>();
    private final pi colour;
    private final wk mono;
    private final Object[] root;
    private final Object[] rows;
    private final List<int[]> channels = new ArrayList<>();

    private static Field field(Class<?> type, String name) {
        try {
            Field result = type.getDeclaredField(name);
            result.setAccessible(true);
            return result;
        } catch (ReflectiveOperationException failure) {
            throw new AssertionError(failure);
        }
    }

    private Object[] livePixels() throws IllegalAccessException {
        return (Object[]) (colour == null ? MONO_PIXELS.get(mono) : COLOUR_PIXELS.get(colour));
    }

    private int id(Object ref) {
        if (ref == null) return 0;
        return ids.computeIfAbsent(ref, key -> ids.size() + 1);
    }

    private ScanlineCacheOracle(boolean rgb, int capacity, int height, int width) throws Exception {
        colour = rgb ? new pi(capacity, height, width) : null;
        mono = rgb ? null : new wk(capacity, height, width);
        root = livePixels();
        rows = root.clone();
        id(root);
        for (Object row : rows) {
            id(row);
            if (rgb) {
                for (int[] channel : (int[][])row) {
                    id(channel);
                    channels.add(channel);
                }
            }
        }
    }

    private static String fault(RuntimeException failure) {
        Throwable cause = failure;
        while (cause instanceof g) cause = ((g)cause).a;
        if (cause instanceof NegativeArraySizeException) return "size";
        if (cause instanceof NullPointerException) return "null";
        if (cause instanceof ArrayIndexOutOfBoundsException) return "bounds";
        if ("Can only retrieve a full image cache".equals(cause.getMessage())) return "partial";
        throw new AssertionError(cause);
    }

    private String operation(String op, int step) {
        int arg = op.length() == 1 ? 0 : Integer.parseInt(op.substring(1));
        switch (op.charAt(0)) {
            case 'g': {
                Object row = colour == null ? mono.a(arg, true) : colour.a(arg, 80);
                int result = id(row);
                int[] first = row == null || colour == null ? (int[])row : ((int[][])row)[0];
                if (first != null && first.length != 0) first[0] = (step + 1) * -19937;
                return "id" + result;
            }
            case 'a': return "id" + id(colour == null ? mono.b((byte)80) : colour.a((byte)-18));
            case 'c':
                if (colour == null) mono.a(arg);
                else colour.b((byte)-56);
                break;
            case 'z': root[arg] = null; break;
            case 'h': ((int[][])rows[arg])[0] = null; break;
            case 'd':
                if (colour == null) ri.R = null;
                else lh.c = null;
                break;
            case 'e':
                if (colour == null) ri.R = new lc(0, 0);
                else lh.c = new c(0, 0);
                break;
            default: throw new AssertionError(op);
        }
        return "ok";
    }

    private int snapshot() throws IllegalAccessException {
        int hash = 31 + id(livePixels());
        for (Object row : root) hash = 31 * hash + id(row);
        for (Object row : rows) {
            hash = 31 * hash + id(row);
            if (colour == null) {
                for (int value : (int[])row) hash = 31 * hash + value;
            } else {
                for (int[] channel : (int[][])row) {
                    hash = 31 * hash + id(channel);
                    if (channel != null) {
                        for (int value : channel) hash = 31 * hash + value;
                    }
                }
            }
        }
        for (int[] channel : channels) {
            if (channel.length != 0) hash = 31 * hash + channel[0];
        }
        return hash;
    }

    private static String run(String line) throws Exception {
        String[] args = line.split(" ", 5);
        boolean rgb = args[0].equals("C");
        if (rgb) lh.c = new c(0, 0);
        else ri.R = new lc(0, 0);
        ScanlineCacheOracle cache;
        try {
            cache = new ScanlineCacheOracle(rgb, Integer.parseInt(args[1]), Integer.parseInt(args[2]), Integer.parseInt(args[3]));
        } catch (RuntimeException failure) {
            return "init:" + fault(failure);
        }
        StringBuilder out = new StringBuilder("init:ok");
        String[] ops = args[4].split(",");
        for (int step = 0; step < ops.length; step++) {
            String result;
            try {
                result = cache.operation(ops[step], step);
            } catch (RuntimeException failure) {
                result = fault(failure);
            }
            boolean dirty = rgb ? cache.colour.w : cache.mono.w;
            out.append('|').append(result).append(':').append(dirty ? 1 : 0).append(':').append(cache.snapshot());
        }
        return out.toString();
    }

    public static void main(String[] args) throws Exception {
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line = input.readLine()) != null;) System.out.println(run(line));
    }
}
