import java.awt.Frame;
import java.lang.reflect.*;
import java.util.Arrays;
import javax.media.opengl.GLDrawable;

// Observe client.f(40) around the real tf.d call. State 42 performs no surface drawing.
class HdFramePresentOracle {
    static int swaps;
    static boolean swapFails;

    static String bits(boolean[] flags) {
        StringBuilder bits = new StringBuilder();
        for (boolean flag : flags) bits.append(flag ? '1' : '0');
        return bits.toString();
    }

    public static void main(String[] args) throws Exception {
        client game = (client)HdTitleFrameOracle.headlessInstance(client.class);
        fh.Y = (Frame)HdTitleFrameOracle.headlessInstance(Frame.class);
        Field drawable = tf.class.getDeclaredField("E");
        drawable.setAccessible(true);
        drawable.set(null, Proxy.newProxyInstance(GLDrawable.class.getClassLoader(),new Class<?>[]{GLDrawable.class},
            (proxy, method, values) -> {
                if (!method.getName().equals("swapBuffers")) throw new AssertionError(method);
                swaps++;
                if (swapFails) throw new IllegalStateException("swap");
                return null;
            }));
        ca.ab = true;
        tf.w = true;
        fh.P = false;
        tl.d = 42;
        id.f = false;
        for (int count : new int[]{0,1,7,99,100,101}) for (int size : new int[]{99,100,101}) for (boolean fail : new boolean[]{false,true}) {
            bn.V = count;
            pa.R = new boolean[size];
            ch.y = new boolean[100];
            Arrays.fill(ch.y,true);
            swaps = 0;
            swapFails = fail;
            String error = "-";
            try { game.f(40); }
            catch (ld wrapped) {
                if (!(wrapped.f instanceof ArrayIndexOutOfBoundsException)) throw wrapped;
                error = "bounds";
            }
            System.out.println(error+"|"+swaps+"|"+bits(pa.R)+"|"+bits(ch.y));
        }
    }
}
