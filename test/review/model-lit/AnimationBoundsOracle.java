import java.lang.reflect.Field;
import java.util.Arrays;

public class AnimationBoundsOracle {
    static Field field(String name) throws Exception {
        Field f = fc.class.getDeclaredField(name);
        f.setAccessible(true);
        return f;
    }

    static void sample(int op, int mode, int[] sin, int[] cos) throws Exception {
        fc model = new fc();
        int[][] points = {{Integer.MAX_VALUE, -142, 83}, {-911, 53, 15}, {136, 791, Integer.MIN_VALUE}};
        int[][] vertices = {{0, 1, 2}, {2, 1, 1}};
        int[] labels = {0, 1};
        int x = 7, y = 13, z = 23;
        dc.l = sin;
        dc.g = cos;
        switch (mode) {
            case 1: points[0] = null; break;
            case 2: points[1] = null; break;
            case 3: points[2] = null; break;
            case 4: case 5: case 6: points[mode - 4] = Arrays.copyOf(points[mode - 4], 1); break;
            case 7: vertices[0][1] = -1; break;
            case 8: vertices[1][2] = 9; break;
            case 9: labels[1] = -1; break;
            case 10: labels[0] = 5; break;
            case 11: labels = null; break;
            case 12: vertices[1] = null; break;
            case 13: vertices = null; break;
            case 14: points[1] = points[0]; break;
            case 15: points[2] = points[1]; break;
            case 16: points[2] = points[1] = points[0]; break;
            case 17: x = -77; break;
            case 18: y = 4097; break;
            case 19: z = -13; break;
            case 20: dc.l = null; break;
            case 21: dc.g = Arrays.copyOf(cos, 10); z = 0; break;
            case 22: dc.l = Arrays.copyOf(sin, 13); z = 3; break;
            case 23: labels = new int[0]; break;
            case 24: vertices[0] = points[0]; break;
            case 25: labels = points[1]; break;
        }
        String[] coords = {"U","q","v"}, origin = {"ob","Kb","xb"};
        for (int i = 0; i < 3; i++) {
            field(coords[i]).set(model, points[i]);
            field(origin[i]).setInt(null, 31 - 5 * i);
        }
        field("Y").set(model, vertices);
        String outcome = "ok";
        try { model.a(op, labels, x, y, z, false); }
        catch (NullPointerException error) { outcome = "null"; }
        catch (ArrayIndexOutOfBoundsException error) {
            outcome = error.getMessage().replaceFirst("^Index ", "").split(" ")[0];
        }
        StringBuilder line = new StringBuilder(op+" "+mode+" "+outcome);
        for (String name : origin) line.append(' ').append(field(name).getInt(null));
        for (int[] point : points) line.append(' ').append(Arrays.toString(point));
        System.out.println(line);
    }

    public static void main(String[] args) throws Exception {
        int[] sin = dc.l, cos = dc.g;
        for (int op = 0; op < 3; op++)
            for (int mode = 0; mode < 26; mode++) sample(op, mode, sin, cos);
    }
}
