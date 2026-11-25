import java.io.BufferedInputStream;
import java.io.DataInputStream;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HexFormat;

// Runs both interface decoders on the original gamepack. Includes every instance
// field even when its default value is the only one encountered in this cache.
class ComponentOracle {
    static int hash(Object value) throws Exception {
        if (value == null) return 0;
        if (value instanceof Number n) return n.intValue();
        if (value instanceof Boolean b) return b ? 1231 : 1237;
        if (value instanceof l p) return 31 * p.E + p.x;
        if (value instanceof id s) {
            int h = 1;
            for (int i = 0; i < s.c; i++) h = 31 * h + (s.A[i] & 255);
            return h;
        }
        if (value.getClass().isArray()) {
            int h = 1;
            for (int i = 0; i < Array.getLength(value); i++) h = 31 * h + hash(Array.get(value, i));
            return h;
        }
        throw new AssertionError("Unhandled field " + value.getClass());
    }

    public static void main(String[] args) throws Exception {
        Field[] fields = Arrays.stream(aj.class.getDeclaredFields()).filter(f -> !Modifier.isStatic(f.getModifiers()))
                .sorted(Comparator.comparing(Field::getName)).toArray(Field[]::new);
        for (Field field : fields) field.setAccessible(true);
        int[] hashes = new int[fields.length];
        Arrays.fill(hashes, 1);
        DataInputStream in = new DataInputStream(new BufferedInputStream(System.in));
        int count = in.readInt();
        int cursorHash = 1, errors = 0;
        for (int i = 0; i < count; i++) {
            int uid = in.readInt(), length = in.readInt();
            aj c = new aj();
            int cursor = 0;
            if (length >= 0) {
                gd p = new gd(in.readNBytes(length));
                c.Kc = uid;
                try {
                    if (p.fb[0] == -1) c.b(20327, p);
                    else c.a(-5, p);
                } catch (RuntimeException failure) {
                    errors++;
                    cursor = -1;
                }
                cursor = cursor < 0 ? ~p.yb : p.yb;
            }
            cursorHash = 31 * cursorHash + cursor;
            for (int j = 0; j < fields.length; j++) hashes[j] = 31 * hashes[j] + hash(fields[j].get(c));
        }
        System.out.println(count + " " + errors + " " + cursorHash);
        for (int j = 0; j < fields.length; j++) {
            Field f = fields[j];
            System.out.println(f.getName() + " " + f.getType().descriptorString() + " " + hashes[j]);
        }
        aj c = new aj();
        id label = aj.a("Example", (byte)-100);
        int errorsOnWrite = 0;
        for (int index : new int[]{-1, 3, 7, 2, -1}) {
            try { c.a(label, index, (byte)121); } catch (RuntimeException e) { errorsOnWrite++; }
            try { c.a(index, 121, index + 81); } catch (RuntimeException e) { errorsOnWrite++; }
            System.out.println(hash(c.Yc) + " " + hash(c.v) + " " + errorsOnWrite);
        }
        System.out.println(c.Yc[2] == label);
        c.Zb = new int[]{10,20,30};
        c.Ob = new int[]{40,50,60};
        c.b(118, 0, 2);
        c.Ob = new int[]{25};
        try { c.b(118, 0, 1); } catch (RuntimeException e) { errorsOnWrite++; }
        System.out.println(hash(c.Zb) + " " + hash(c.Ob) + " " + errorsOnWrite);
        for (int language : new int[]{0, 1, 0, 2}) {
            ii.a((byte)127, language);
            for (int button : new int[]{1, 4, 5, 6}) {
                byte[] data = HexFormat.of().parseHex("08000000000000000001000100ffffffff00000000");
                data[1] = (byte)button;
                aj localized = new aj();
                boolean initialIdentity = localized.fc == vi.eb;
                localized.a(-5, new gd(data));
                id labelText = button == 1 ? vi.eb : button == 6 ? ea.i : bj.n;
                System.out.println(language + " " + button + " " + initialIdentity + " " + (labelText == localized.fc) + " " + hash(localized.fc));
            }
        }
    }
}
