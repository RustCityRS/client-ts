import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.PrintWriter;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Comparator;

// Feed the same archive files and truncated streams to the original HD component decoders.
class HdWidgetDepthOracle {
    static int hash(Object value) {
        if (value == null) return 0;
        if (value instanceof Number number) return number.intValue();
        if (value instanceof Boolean flag) return flag ? 1231 : 1237;
        if (value instanceof bf properties) return 31 * properties.x + properties.q;
        if (value instanceof na string) {
            int hash = 1;
            for (int i = 0; i < string.lb; i++) hash = 31 * hash + (string.T[i] & 255);
            return hash;
        }
        if (value.getClass().isArray()) {
            int hash = 1;
            for (int i = 0; i < Array.getLength(value); i++) hash = 31 * hash + hash(Array.get(value, i));
            return hash;
        }
        throw new AssertionError("Unhandled component field value " + value.getClass());
    }

    static void writeValue(DataOutputStream out, Object value) throws Exception {
        if (value == null) {
            out.writeByte(0);
        } else if (value instanceof Number number) {
            out.writeByte(1);
            out.writeInt(number.intValue());
        } else if (value instanceof na string) {
            out.writeByte(2);
            out.writeInt(string.lb);
            out.write(string.T, 0, string.lb);
        } else if (value instanceof bf properties) {
            out.writeByte(3);
            out.writeInt(properties.x);
            out.writeInt(properties.q);
        } else if (value.getClass().isArray()) {
            out.writeByte(4);
            int count = Array.getLength(value);
            out.writeInt(count);
            for (int i = 0; i < count; i++) writeValue(out, Array.get(value, i));
        } else {
            throw new AssertionError("Unexpected decoded reference " + value.getClass());
        }
    }

    public static void main(String[] args) throws Exception {
        try (var in = new DataInputStream(new BufferedInputStream(Files.newInputStream(Path.of(args[0]))));
             var out = new PrintWriter(new BufferedOutputStream(Files.newOutputStream(Path.of(args[1]))));
             var state = new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(Path.of(args[2]))));
             var values = new DataOutputStream(new BufferedOutputStream(Files.newOutputStream(Path.of(args[3]))))) {
            Field[] fields = Arrays.stream(be.class.getDeclaredFields()).filter(f -> !Modifier.isStatic(f.getModifiers()))
                .sorted(Comparator.comparing(Field::getName)).toArray(Field[]::new);
            state.writeInt(fields.length);
            for (Field field : fields) {
                field.setAccessible(true);
                state.writeUTF(field.getName());
                state.writeUTF(field.getType().descriptorString());
            }
            int cases = in.readInt();
            for (int i = 0; i < cases; i++) {
                be c = new be();
                c.Fc = in.readInt();
                boolean if3 = in.readBoolean();
                int length = in.readInt();
                wa packet = new wa(in.readNBytes(length));
                String status = "ok";
                try {
                    if (if3) c.c(-1, packet);
                    else c.a(-110, packet);
                } catch (ld wrapped) {
                    if (!(wrapped.f instanceof ArrayIndexOutOfBoundsException)) throw wrapped;
                    status = "bounds " + wrapped.f.getMessage().split(" ")[1];
                }
                out.println(c.Fc + "|" + status + "|" + packet.T + "|" + c.I + "|" + c.Hb + "|" +
                    c.ab + "|" + c.Z + "|" + c.ic + "|" + c.Eb + "|" + c.D + "|" + c.ld + "|" + c.Gc + "|" +
                    c.j + "|" + c.id + "|" + c.A + "|" + c.Vc + "|" + c.o + "|" + c.md + "|" +
                    c.F + "|" + c.pd + "|" + c.pc + "|" + c.Mb);
                for (Field field : fields) {
                    Object value = field.get(c);
                    state.writeInt(hash(value));
                    if (!field.getType().isPrimitive()) writeValue(values, value);
                }
            }
            if (in.read() != -1) throw new AssertionError("extra fixture records");
        }
    }
}
