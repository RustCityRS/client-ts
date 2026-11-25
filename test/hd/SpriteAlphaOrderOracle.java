import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Identical staging data drives p.a(byte) or re.b(int) in the respective unmodified JAR. */
public class SpriteAlphaOrderOracle {
    static boolean hd;
    static Field field(String sd, String gl) throws Exception {
        String[] names = (hd ? gl : sd).split("\\.");
        Field result = Class.forName(names[0]).getDeclaredField(names[1]);
        result.setAccessible(true);
        return result;
    }
    static String fault(Throwable wrapper) throws Exception {
        Field cause = wrapper.getClass().getDeclaredField(hd ? "f" : "a");
        cause.setAccessible(true);
        Throwable error = (Throwable)cause.get(wrapper);
        if (error instanceof NullPointerException) return "null";
        if (!(error instanceof ArrayIndexOutOfBoundsException)) throw new AssertionError(error);
        Matcher index = Pattern.compile("Index (-?\\d+)").matcher(error.getMessage());
        if (!index.find()) throw new AssertionError(error);
        return "bounds:" + index.group(1);
    }
    static byte[] bytes(int mode, boolean indices) {
        if (mode == 0) return null;
        byte[] value = indices ? new byte[]{1,(byte)254} : new byte[]{(byte)191,0};
        return Arrays.copyOf(value, mode==1 ? 0 : mode==2 ? 1 : 2);
    }
    public static void main(String[] args) throws Exception {
        hd = args[0].equals("gl");
        Field pixels = field("vg.hb","ah.l"), alpha = field("tb.d","fb.n"), palette = field("ke.m","vc.R");
        Field heights = field("df.H","ca.Y"), widths = field("jh.l","uj.x");
        Method[] factories = hd ? new Method[] {
            Class.forName("re").getDeclaredMethod("b",int.class), Class.forName("gi").getDeclaredMethod("b",int.class), Class.forName("cj").getDeclaredMethod("a",int.class)
        } : new Method[] {
            Class.forName("p").getDeclaredMethod("a",byte.class), Class.forName("ud").getDeclaredMethod("a",byte.class), Class.forName("oc").getDeclaredMethod("a",byte.class)
        };
        for (Method factory : factories) factory.setAccessible(true);
        BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
        for (String line; (line=input.readLine())!=null;) {
            int[] v=Arrays.stream(line.split(" ")).mapToInt(Integer::parseInt).toArray();
            int[] rgb = v[2]==0 ? null : new int[v[2]==1 ? 1 : 256];
            if (rgb!=null) for(int i=0; i<rgb.length; i++) rgb[i]=(0xa134c1 * i)&0xffffff;
            field("lc.q","nb.h").set(null,1);
            field("ad.g","jk.x").set(null,2);
            field("lh.g","sg.h").set(null,1);
            field("qj.B","wf.b").set(null,new int[]{0});
            field("ff.s","wa.z").set(null,new int[]{0});
            field("c.v","mi.W").set(null,new boolean[]{true});
            pixels.set(null,v[3]==1 ? null : v[3]==2 ? new byte[0][] : new byte[][]{bytes(v[0],true)});
            heights.set(null,v[4]==1 ? null : v[4]==2 ? new int[0] : new int[]{1});
            widths.set(null,v.length < 7 || v[6]==0 ? new int[]{2} : v[6]==1 ? null : new int[0]);
            alpha.set(null,new byte[][]{bytes(v[1],false)});
            palette.set(null,rgb);
            String result;
            try {
                int builder = v.length < 6 ? 0 : v[5];
                Object guard;
                if (hd) guard = new int[]{-26802,100,-5}[builder]; else guard = new byte[]{-10,57,-62}[builder];
                Object sprite = factories[builder].invoke(null,guard);
                if (builder != 1) sprite = ((Object[])sprite)[0];
                Field colours=field("rh.I","mm.L");
                result=Arrays.toString((int[])colours.get(sprite));
            } catch (InvocationTargetException ex) {
                result=fault(ex.getCause());
            }
            System.out.println(result+"|"+(pixels.get(null)==null)+","+(palette.get(null)==null)+","+(widths.get(null)==null));
        }
    }
}
