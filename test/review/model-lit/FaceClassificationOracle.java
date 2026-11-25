import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;

// Invoke fc's first face pass without the outer WorldRender exception handler.
public class FaceClassificationOracle {
    static Field field(String name) throws Exception {
        Field field = fc.class.getDeclaredField(name);
        field.setAccessible(true);
        return field;
    }

    public static void main(String[] args) throws Exception {
        td.a(new int[320 * 240], 320, 240);
        dc.d();
        Method render = fc.class.getDeclaredMethod("a", boolean.class, boolean.class, long.class, int.class, int.class, ue.class);
        render.setAccessible(true);
        for (boolean near : new boolean[]{false, true}) for (String cut : args) {
            fc model = new fc();
            field("y").setInt(model, 1);
            field("L").set(model, new int[]{cut.equals("hidden") ? -2 : 0});
            field("r").set(model, new int[]{0});
            field("N").set(model, new int[]{1});
            field("J").set(model, new int[]{2});
            field("Jb").set(null, new int[]{near ? -5000 : 10, 5, 12});
            field("Cb").set(null, cut.equals("shortY") ? new int[1] : new int[]{5, 5, 8});
            field("Bb").set(null, cut.equals("shortZ") ? new int[1] : new int[3]);
            field("Fb").set(null, new int[]{5, 0, 0});
            field("rb").set(null, new int[]{0, 0, 5});
            field("Mb").set(null, new int[]{1, 1, 1});
            boolean[] nearFlags = cut.equals("nullNear") ? null : cut.equals("shortNear") ? new boolean[0] : new boolean[]{!near};
            boolean[] xFlags = cut.equals("nullX") ? null : cut.equals("shortX") ? new boolean[0] : new boolean[]{true};
            field("yb").set(null, nearFlags);
            field("pb").set(null, xFlags);
            int[] counts = new int[1600];
            field("ib").set(null, counts);
            int[] row = cut.equals("nullRow") ? null : cut.equals("shortRow") ? new int[0] : new int[]{-11};
            int[][] rows = cut.equals("nullRows") ? null : cut.equals("shortRows") ? new int[1][] : new int[][]{null, row};
            field("lb").set(null, rows);
            rg.g = 10 - dc.f;
            ud.d = 5 - dc.b;
            dd.r = 0;
            pf.W = new long[cut.equals("shortPick") ? 0 : 1];
            String outcome = "ok";
            try { render.invoke(model, near, true, 71L, 1, 0, null); }
            catch (InvocationTargetException e) {
                if (e.getCause() instanceof NullPointerException) outcome = "null";
                else if (e.getCause() instanceof ArrayIndexOutOfBoundsException) outcome = "bounds";
                else throw e;
            }
            System.out.println(near+" "+cut+" "+outcome+" "+dd.r+" "+Arrays.hashCode(pf.W)+" "+
                Arrays.hashCode(nearFlags)+" "+Arrays.hashCode(xFlags)+" "+counts[1]+" "+Arrays.hashCode(row));
        }
    }
}
